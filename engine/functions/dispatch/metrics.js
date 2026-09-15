// Scorebug dispatch — the measurement spine.
//
// Nothing else in this system is allowed to be clever until this file works.
// A machine that posts is a poster; a machine that measures what it posted and
// what the posting did is a growth system. Every number here is fetched, never
// estimated, and every source that fails leaves a null rather than a guess —
// the digest prints "n/a", which is honest, instead of a plausible fiction.
//
// FIVE SOURCES, FIVE FAILURE MODES, ALL SOFT:
//   product           Supabase aggregates — logs this week, active loggers,
//                     waitlist signups by platform. THE north-star numbers:
//                     a marketing engine for a logbook is measured in logs.
//   installs/ratings  Play Console's Cloud Storage report bucket (monthly CSVs,
//                     UTF-16). Needs GOOGLE_SERVICE_ACCOUNT + PLAY_BUCKET.
//   site              GA4 Data API, sessions and key events by utm_source.
//                     Needs GA4_PROPERTY_ID and the service account added as a
//                     Viewer on the property. Empty until GTM is live.
//   followers         Each network's own profile endpoint.
//   per-post          Bluesky app.bsky.feed.getPosts (public AppView, no auth
//                     needed) and Mastodon GET /api/v1/statuses/:id, read back
//                     for every post the ledger says we sent in the window.
//
// The per-post numbers are the important ones: they are what optimize.js turns
// into a policy. Followers are vanity; engagement per post is the signal.

import { parseServiceAccount, gcsList, gcsText, parseCsv, column, googleFetch, SCOPES } from './google.js';

const EV = 'dispatch/state/events/';
const DAY = 86_400_000;

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const ym = (ms) => ymd(ms).slice(0, 7).replace('-', '');
const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; };

/* ─────────────────────────────────────────────────────────── PLAY INSTALLS */

/**
 * Read the current month's installs overview and return the most recent rows.
 * Play publishes yesterday's row about a day late, so `latest` is normally
 * D-1 or D-2. Returning the whole recent window lets the digest show a trend
 * without a second call.
 */
export async function playInstalls({ sa, bucket, packageName, now = Date.now(), fetchImpl = fetch }) {
  if (!sa || !bucket || !packageName) return null;
  const prefix = 'stats/installs/';
  const names = await gcsList(sa, bucket, prefix, { fetchImpl });
  const want = `installs_${packageName}_${ym(now)}_overview.csv`;
  const prev = `installs_${packageName}_${ym(now - 31 * DAY)}_overview.csv`;
  const picks = [want, prev].map((w) => names.find((n) => n.endsWith(w))).filter(Boolean);
  if (!picks.length) return { error: `no installs overview in ${bucket}/${prefix} (looked for ${want})`, available: names.slice(-5) };

  const rows = [];
  for (const name of picks) rows.push(...parseCsv(await gcsText(sa, bucket, name, { fetchImpl })));
  const clean = rows
    .map((r) => ({
      date: String(column(r, 'Date') || '').slice(0, 10),
      dailyDeviceInstalls: num(column(r, 'Daily Device Installs', 'Daily Device Install')),
      dailyDeviceUninstalls: num(column(r, 'Daily Device Uninstalls')),
      activeDeviceInstalls: num(column(r, 'Active Device Installs')),
      totalUserInstalls: num(column(r, 'Total User Installs')),
      dailyUserInstalls: num(column(r, 'Daily User Installs')),
      installEvents: num(column(r, 'Install events')),
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!clean.length) return { error: 'installs CSV parsed to no dated rows' };
  const latest = clean[clean.length - 1];
  const window7 = clean.slice(-7);
  return {
    latest,
    installs7d: window7.reduce((s, r) => s + (r.dailyDeviceInstalls || 0), 0),
    uninstalls7d: window7.reduce((s, r) => s + (r.dailyDeviceUninstalls || 0), 0),
    activeDevices: latest.activeDeviceInstalls,
    totalUserInstalls: latest.totalUserInstalls,
    series: clean.slice(-30),
  };
}

/* ─────────────────────────────────────────────────────────── PLAY RATINGS */

export async function playRatings({ sa, bucket, packageName, now = Date.now(), fetchImpl = fetch }) {
  if (!sa || !bucket || !packageName) return null;
  const names = await gcsList(sa, bucket, 'stats/ratings/', { fetchImpl });
  const want = `ratings_${packageName}_${ym(now)}_overview.csv`;
  const name = names.find((n) => n.endsWith(want)) || names.filter((n) => n.includes('_overview.csv')).sort().pop();
  if (!name) return { error: 'no ratings overview in the bucket' };
  const rows = parseCsv(await gcsText(sa, bucket, name, { fetchImpl }))
    .map((r) => ({ date: String(column(r, 'Date') || '').slice(0, 10), daily: num(column(r, 'Daily Average Rating')), total: num(column(r, 'Total Average Rating')) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!rows.length) return { error: 'ratings CSV parsed to no dated rows' };
  const latest = rows[rows.length - 1];
  return { average: latest.total, latestDaily: latest.daily, date: latest.date };
}

/* ───────────────────────────────────────────────────────────────── GA4 */

/** Sessions and key events by utm_source for the last `days` days. */
export async function ga4({ sa, propertyId, days = 7, fetchImpl = fetch }) {
  if (!sa || !propertyId) return null;
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${String(propertyId).replace(/^properties\//, '')}:runReport`;
  const body = {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
    limit: 25,
  };
  const res = await googleFetch(sa, SCOPES.analytics, url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, { fetchImpl });
  if (!res.ok) return { error: `ga4 ${res.status}` };
  const out = await res.json();
  const bySource = (out.rows || []).map((r) => ({
    source: r.dimensionValues?.[0]?.value || '(none)',
    sessions: num(r.metricValues?.[0]?.value) || 0,
    users: num(r.metricValues?.[1]?.value) || 0,
    keyEvents: num(r.metricValues?.[2]?.value) || 0,
  })).sort((a, b) => b.sessions - a.sessions);
  return { days, bySource, sessions: bySource.reduce((s, r) => s + r.sessions, 0) };
}

/* ──────────────────────────────────────────────────── PER-POST ENGAGEMENT */

/**
 * Read back what each post actually did. Bluesky's public AppView answers
 * getPosts unauthenticated, up to 25 URIs per call, and carries likeCount,
 * repostCount, replyCount and quoteCount (verified 2026-09-03). Mastodon needs
 * no auth for a public status either.
 */
export async function postEngagement({ store, base = 'https://public.api.bsky.app', mastodonBase, sinceDays = 14, now = Date.now(), fetchImpl = fetch }) {
  const events = (await store.list(EV)).map((d) => d.data).filter((e) => e.sentAt && now - Date.parse(e.sentAt) <= sinceDays * DAY);
  const out = [];

  const blueskyUris = [];
  const byUri = new Map();
  for (const e of events) {
    const u = e.postedUrls && e.postedUrls.blueskyUri;
    if (u) { blueskyUris.push(u); byUri.set(u, e); }
  }
  for (let i = 0; i < blueskyUris.length; i += 25) {
    const chunk = blueskyUris.slice(i, i + 25);
    const qs = chunk.map((u) => `uris=${encodeURIComponent(u)}`).join('&');
    try {
      const res = await fetchImpl(`${base}/xrpc/app.bsky.feed.getPosts?${qs}`);
      if (!res.ok) continue;
      const body = await res.json();
      for (const p of body.posts || []) {
        const e = byUri.get(p.uri);
        out.push({
          eventId: e ? e.id : null, network: 'bluesky', type: e ? e.type : null, uri: p.uri,
          likes: p.likeCount || 0, reposts: p.repostCount || 0, replies: p.replyCount || 0, quotes: p.quoteCount || 0,
          at: e ? e.sentAt : p.indexedAt, hook: e ? e.hookId || null : null,
        });
      }
    } catch { /* a metrics read never breaks a run */ }
  }

  if (mastodonBase) {
    for (const e of events) {
      const id = e.postedIds && e.postedIds.mastodon;
      if (!id) continue;
      try {
        const res = await fetchImpl(`${String(mastodonBase).replace(/\/+$/, '')}/api/v1/statuses/${id}`);
        if (!res.ok) continue;
        const s = await res.json();
        out.push({
          eventId: e.id, network: 'mastodon', type: e.type, uri: s.url,
          likes: s.favourites_count || 0, reposts: s.reblogs_count || 0, replies: s.replies_count || 0, quotes: 0,
          at: e.sentAt, hook: e.hookId || null,
        });
      } catch { /* soft */ }
    }
  }
  return out;
}

/** One number per post, so arms can be compared: weighted engagement. */
export function engagementScore(p) {
  return (p.likes || 0) + 2 * (p.reposts || 0) + 2 * (p.replies || 0) + 3 * (p.quotes || 0);
}

/* ───────────────────────────────────────────────────────────── THE TICK */

export async function metricsTick({ store, secrets = {}, publishers = {}, now = Date.now(), fetchImpl = fetch, log = () => {}, supabase = null }) {
  const sa = parseServiceAccount(secrets.GOOGLE_SERVICE_ACCOUNT);
  const day = ymd(now);
  const doc = { day, collectedAt: new Date(now).toISOString() };

  const soft = async (name, fn) => {
    try { doc[name] = await fn(); } catch (e) { doc[name] = { error: String(e.message).slice(0, 200) }; log('metrics', name, String(e.message)); }
  };

  await soft('play', () => playInstalls({ sa, bucket: secrets.PLAY_BUCKET, packageName: secrets.PLAY_PACKAGE || 'ca.scorebug.sports', now, fetchImpl }));
  await soft('ratings', () => playRatings({ sa, bucket: secrets.PLAY_BUCKET, packageName: secrets.PLAY_PACKAGE || 'ca.scorebug.sports', now, fetchImpl }));
  await soft('site', () => ga4({ sa, propertyId: secrets.GA4_PROPERTY_ID, fetchImpl }));
  await soft('product', async () => (supabase ? (await supabase.counts()) || { error: 'no answer from the database' } : { error: 'SUPABASE_URL / SUPABASE_ANON_KEY not set' }));
  /* Acquisition, not engagement. The one number that says whether any of this
     is working: how many people reached the waitlist on a link this engine
     posted, split by the network and the closing line that brought them. */
  await soft('acquisition', async () => (supabase ? (await supabase.signupSources({ sinceDays: 30 })) || { error: 'no answer from the database' } : { error: 'SUPABASE_URL / SUPABASE_ANON_KEY not set' }));
  /* Reach, not engagement. Cards shared per week: the step between a fan
     logging a game and a stranger hearing about Scorebug. Soft, like every
     other collector here — a digest that fails because one RPC is missing is
     a digest nobody gets on the morning it mattered. */
  await soft('shares', async () => (supabase ? (await supabase.shareCounts({ weeks: 8 })) || { error: 'no answer from the database' } : { error: 'SUPABASE_URL / SUPABASE_ANON_KEY not set' }));

  const followers = {};
  for (const [name, pub] of Object.entries(publishers)) {
    if (!pub || !pub.profile) continue;
    try { followers[name] = (await pub.profile()).followers ?? null; } catch { followers[name] = null; }
  }
  doc.followers = followers;

  await soft('posts', () => postEngagement({ store, mastodonBase: secrets.MASTODON_BASE, now, fetchImpl }));
  const posts = Array.isArray(doc.posts) ? doc.posts : [];
  doc.engagement = {
    postsMeasured: posts.length,
    total: posts.reduce((s, p) => s + engagementScore(p), 0),
    median: median(posts.map(engagementScore)),
    byNetwork: Object.fromEntries(['bluesky', 'mastodon'].map((n) => {
      const set = posts.filter((p) => p.network === n);
      return [n, { posts: set.length, total: set.reduce((s, p) => s + engagementScore(p), 0), median: median(set.map(engagementScore)) }];
    })),
  };

  // Yesterday's document, so the digest can print deltas without a second read.
  const prev = await store.get(`dispatch/state/metrics/${ymd(now - DAY)}`);
  doc.deltas = deltas(doc, prev);

  await store.set(`dispatch/state/metrics/${day}`, doc);
  return doc;
}

export function median(xs) {
  const a = xs.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function deltas(cur, prev) {
  if (!prev) return null;
  const d = {};
  const f = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a - b : null);
  d.installs7d = f(cur.play?.installs7d, prev.play?.installs7d);
  d.activeDevices = f(cur.play?.activeDevices, prev.play?.activeDevices);
  d.sessions = f(cur.site?.sessions, prev.site?.sessions);
  d.logs7d = f(cur.product?.logs7d, prev.product?.logs7d);
  d.signups = f(cur.product?.signups?.android, prev.product?.signups?.android);
  d.followers = Object.fromEntries(Object.keys(cur.followers || {}).map((k) => [k, f(cur.followers[k], (prev.followers || {})[k])]));
  return d;
}
