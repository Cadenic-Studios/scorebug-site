// Scorebug dispatch — Cloud Functions entry points.
//
// Imported by functions/index.js, which owns initializeApp. Eight scheduled
// functions and one HTTP endpoint:
//
//   dispatchTick     every 10 min    scoreboards → events → rank → linted drafts → posts
//   engageTick       every 30 min    mentions → reply drafts / replies
//   metricsTick      03:20 & 15:20   logs, signups, GA4, followers, per-post engagement
//   optimizeTick     03:40 daily     re-tally the bandit, choose the policy
//   reviewsTick      04:00 daily     Play reviews → drafted or auto-replied (off until public)
//   contentTick      Mon 05:00       the week's slate page + newsletter draft
//   dailyDigest      07:00           the one email
//   weeklyDispatch   Mon 09:00       send the approved newsletter to the consented list
//   dispatchOps      HTTPS           signed one-click links, and JSON status for /ops
//
// Order matters: metrics before optimize before the digest, so the morning
// email reflects last night's measurement and this morning's policy.
//
// Every secret is a Firebase secret. A missing secret disables exactly one
// capability and is reported in the digest's health block; nothing throws at
// cold start. Master switches live in Firestore at dispatch/settings.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
/**
 * ── WHY THIS IS LOADED LAZILY ──────────────────────────────────────────────
 *
 * Deploying runs a DISCOVERY pass: the CLI loads this module purely to read the
 * list of exported functions, and gives it ten seconds. Importing the Firestore
 * SDK at module scope spends the entire budget building a database client that
 * discovery will never touch — measured at 14 seconds on Delta-V, against a
 * 10-second limit. Loaded on first USE instead, inside a handler.
 */
let _firestore = null;
async function adminFirestore() {
  if (!_firestore) ({ getFirestore: _firestore } = await import('firebase-admin/firestore'));
  return _firestore();
}
/* The ROOT 'firebase-functions' barrel drags in every trigger type just to
   reach the logger. The dedicated entry point loads in twenty milliseconds. */
import * as logger from 'firebase-functions/logger';

import { firestoreStore, loadSettings } from './store.js';
import { resolveThreadsToken } from './threadsToken.js';
import { spendStatus } from './xspend.js';
import { readFeed, readWeek } from './feed.js';
import { fromSecrets } from './publish.js';
import { tick, sendApproved } from './run.js';
import { engageTick as runEngage } from './engage.js';
import { metricsTick as runMetrics } from './metrics.js';
import { optimizeTick as runOptimize } from './optimize.js';
import { reviewsTick as runReviews, replyToReview } from './reviews.js';
import { contentTick as runContent } from './content.js';
import { buildDigest, sendEmail, verify } from './digest.js';
import { parseServiceAccount } from './google.js';
import { recordSpend, PLAN } from './budget.js';
import { toDiscord, findOpportunities, newsletterHtml, newsletterText, unsubscribeToken } from './channels.js';
import { supabaseClient } from './supabase.js';
import { fetchFacts } from './facts.js';
import { localParts, clock, LEAGUE_BY_ID } from './leagues.js';
import { teamName } from './draft.js';

const SECRET_NAMES = [
  'BSKY_HANDLE', 'BSKY_APP_PASSWORD', 'BSKY_DISPLAY_HANDLE', 'MASTODON_BASE', 'MASTODON_TOKEN',
  'THREADS_USER_ID', 'THREADS_TOKEN', 'IG_USER_ID', 'IG_TOKEN',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'X_HANDLE',
  'ANTHROPIC_API_KEY', 'RESEND_API_KEY',
  'OPS_SECRET', 'GOOGLE_SERVICE_ACCOUNT', 'PLAY_BUCKET', 'PLAY_PACKAGE',
  'GA4_PROPERTY_ID', 'INDEXNOW_KEY',
  // The site's facts endpoint and card press; our own Discord.
  'DISPATCH_KEY', 'SITE_BASE_URL', 'DISCORD_WEBHOOK_URL',
  // The product's database, read-only, aggregates only. ENGINE_KEY unlocks the
  // consented newsletter list and signs its unsubscribe links.
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ENGINE_KEY',
];

/**
 * THE SENTINEL, AND WHY IT EXISTS.
 *
 * `defineSecret` is a deploy-time contract: every name declared here must
 * already have a value in Secret Manager or the deploy stops. That collides
 * with the rule that a missing capability is a SUPPORTED STATE. So
 * scripts/ignite.mjs gives every name it has no real value for this sentinel,
 * all of them exist, the deploy proceeds, and `readSecrets` treats the sentinel
 * as absent. (Filtering the declaration list through an env var did NOT work
 * on Delta-V — the discovery subprocess does not reliably see functions/.env.)
 */
export const UNSET_SENTINEL = '__scorebug_unset__';

const secrets = Object.fromEntries(SECRET_NAMES.map((n) => [n, defineSecret(n)]));
const secretList = Object.values(secrets);
const OWNER_EMAIL = defineString('DISPATCH_OWNER_EMAIL', { default: 'wyattmcph@gmail.com' });
const FROM_EMAIL = defineString('DISPATCH_FROM_EMAIL', { default: 'Scorebug <dispatch@getscorebug.app>' });
/**
 * Where the digest's one-tap links point. A REAL default, not an empty string:
 * Firebase treats an empty default as no default and a non-interactive deploy
 * stops. This is the deterministic alias every Cloud Functions deployment
 * answers on; ignite.mjs overwrites it with whatever the deploy prints.
 */
const OPS_URL = defineString('DISPATCH_OPS_URL', { default: 'https://us-central1-scorebug-engine.cloudfunctions.net/dispatchOps' });
const TZ = 'America/Edmonton';
const opts = (extra = {}) => ({ secrets: secretList, timeZone: TZ, timeoutSeconds: 300, memory: '512MiB', ...extra });

/** The secrets that carry a real value. A sentinel is filtered out here and nowhere else. */
function readSecrets() {
  const out = {};
  for (const [k, p] of Object.entries(secrets)) {
    try {
      const v = p.value();
      if (v && v !== UNSET_SENTINEL) out[k] = v;
    } catch { /* unset is a normal state */ }
  }
  return out;
}
const log = (...a) => logger.info(a.map(String).join(' '));

async function deps() {
  const s = readSecrets();
  const store = firestoreStore(await adminFirestore());
  const publishers = fromSecrets(s);
  const feed = ({ now } = {}) => readFeed({ now, tz: TZ, log });
  const week = ({ now } = {}) => readWeek({ now, tz: TZ, log });
  const supabase = supabaseClient({ url: s.SUPABASE_URL, anonKey: s.SUPABASE_ANON_KEY, log });
  return { s, store, publishers, feed, week, supabase, sa: parseServiceAccount(s.GOOGLE_SERVICE_ACCOUNT) };
}

/** deps(), with the Threads token resolved against Firestore first (see threadsToken.js). */
async function liveDeps() {
  const d = await deps();
  const t = await resolveThreadsToken({ store: d.store, secrets: d.s, fetchImpl: fetch, log });
  if (t.token && t.token !== d.s.THREADS_TOKEN) d.publishers = fromSecrets({ ...d.s, THREADS_TOKEN: t.token });
  d.threadsToken = t;
  return d;
}

/** What the digest's health block reports. Truthful about what is not wired. */
function health(s, publishers) {
  const need = {
    'Bluesky': ['BSKY_HANDLE', 'BSKY_APP_PASSWORD'],
    'Mastodon': ['MASTODON_BASE', 'MASTODON_TOKEN'],
    'Threads': ['THREADS_USER_ID', 'THREADS_TOKEN'],
    'Instagram': ['IG_USER_ID', 'IG_TOKEN'],
    'X': ['X_API_KEY', 'X_ACCESS_TOKEN'],
    'Play installs and reviews': ['GOOGLE_SERVICE_ACCOUNT', 'PLAY_BUCKET'],
    'site analytics': ['GA4_PROPERTY_ID', 'GOOGLE_SERVICE_ACCOUNT'],
    'the product numbers (logs, signups)': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    'the newsletter list': ['ENGINE_KEY', 'RESEND_API_KEY'],
    'reply drafts': ['ANTHROPIC_API_KEY'],
    'this email': ['RESEND_API_KEY'],
    'IndexNow': ['INDEXNOW_KEY'],
    'the product facts and the card press': ['DISPATCH_KEY'],
    'the Discord mirror': ['DISCORD_WEBHOOK_URL'],
  };
  const missing = Object.entries(need).filter(([, keys]) => keys.some((k) => !s[k])).map(([label]) => label);
  return { publishers: Object.keys(publishers), missingSecrets: missing, declaredSecrets: SECRET_NAMES.length, warnings: [] };
}

export const dispatchTick = onSchedule(opts({ schedule: 'every 10 minutes' }), async () => {
  const { s, store, publishers, feed, supabase } = await liveDeps();
  const summary = await tick({ store, feed, publishers, secrets: s, log, supabase, tz: TZ });
  await mirrorToDiscord({ store, secrets: s, sent: summary.sent });
  logger.info('dispatchTick', summary);
});

/** Put what just went out into our own Discord. A dead webhook is logged and dropped. */
async function mirrorToDiscord({ store, secrets: s, sent }) {
  if (!s.DISCORD_WEBHOOK_URL || !sent || !sent.length) return;
  const settings = await loadSettings(store);
  if (!settings.channels || settings.channels.discord === false) return;
  for (const id of sent.slice(0, 4)) {
    const e = await store.get(`dispatch/state/events/${id}`);
    if (!e || !e.texts) continue;
    const links = Object.entries(e.postedUrls || {}).filter(([k]) => k !== 'blueskyUri');
    const body = [e.texts.mastodon || e.texts.bluesky || e.texts.threads || e.texts.x, links.length ? links.map(([k, u]) => `[${k}](${u})`).join(' · ') : null]
      .filter(Boolean).join('\n\n');
    const r = await toDiscord({ webhookUrl: s.DISCORD_WEBHOOK_URL, content: body, imageUrl: e.media && e.media.kind === 'image' ? e.media.publicUrl : null });
    if (r && r.error) logger.warn('discord mirror', r.error);
  }
}

export const engageTick = onSchedule(opts({ schedule: 'every 30 minutes', timeoutSeconds: 120 }), async () => {
  const { s, store, publishers } = await liveDeps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  const facts = await fetchFacts({ base: s.SITE_BASE_URL || undefined, key: s.DISPATCH_KEY, log });
  logger.info('engageTick', await runEngage({ store, publishers, settings, secrets: s, log, facts }));
});

export const metricsTick = onSchedule(opts({ schedule: '20 3,15 * * *' }), async () => {
  const { s, store, publishers, supabase } = await deps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  const doc = await runMetrics({ store, secrets: s, publishers, log, supabase });
  logger.info('metricsTick', { logs7d: doc.product && doc.product.logs7d, posts: doc.engagement && doc.engagement.postsMeasured });
});

export const optimizeTick = onSchedule(opts({ schedule: '40 3 * * *' }), async () => {
  const { store } = await deps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  const p = await runOptimize({ store });
  logger.info('optimizeTick', { chosen: p.chosen, sample: p.sampleSize, findings: p.findings.length });
});

export const reviewsTick = onSchedule(opts({ schedule: '0 4 * * *' }), async () => {
  const { s, store, sa } = await deps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  logger.info('reviewsTick', await runReviews({ store, sa, secrets: s, settings, log }));
});

export const contentTick = onSchedule(opts({ schedule: '0 5 * * 1' }), async () => {
  const { s, store, week } = await deps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  logger.info('contentTick', await runContent({ store, week, secrets: s, settings, log, tz: TZ }));
});

export const dailyDigest = onSchedule(opts({ schedule: '0 7 * * *' }), async () => {
  const { s, store, publishers, feed, threadsToken } = await liveDeps();
  const settings = await loadSettings(store);
  if (!settings.enabled) return;
  const { games = [], errors = [] } = await feed().catch(() => ({ games: [], errors: ['feed failed'] }));
  const now = Date.now();
  const upcoming = games.filter((g) => g.start && g.start > now).map((g) => ({
    start: g.start, when: clock(g.start, TZ), league: LEAGUE_BY_ID[g.league] ? LEAGUE_BY_ID[g.league].name : g.league,
    label: g.sport === 'racing' ? g.name : `${teamName(g.away)} at ${teamName(g.home)}`,
  }));
  const opportunities = settings.channels && settings.channels.opportunities !== false ? await findOpportunities({ log }).catch(() => []) : [];
  const events = (await store.list('dispatch/state/events/')).map((d) => d.data);
  const organicDays = new Set(events.filter((e) => e.sentAt).map((e) => localParts(Date.parse(e.sentAt), TZ).day)).size;
  const digest = await buildDigest({
    store, publishers, upcoming, settings, opportunities, organicDays,
    opsUrl: OPS_URL.value(), opsSecret: s.OPS_SECRET || 'unset',
    health: { ...health(s, publishers), warnings: [threadsToken && threadsToken.warn, ...errors.map((e) => `feed: ${e}`)].filter(Boolean), xSpend: await spendStatus({ store, settings }) },
  });
  if (s.RESEND_API_KEY) {
    const subject = digest.counts.decisions
      ? `Scorebug · ${digest.counts.decisions} need you · ${digest.counts.sent} sent`
      : `Scorebug · all clear · ${digest.counts.sent} sent`;
    await sendEmail({ apiKey: s.RESEND_API_KEY, from: FROM_EMAIL.value(), to: OWNER_EMAIL.value(), subject, text: digest.text, html: digest.html });
  }
  logger.info('dailyDigest', digest.counts);
});

export const weeklyDispatch = onSchedule(opts({ schedule: '0 9 * * 1' }), async () => {
  // contentTick writes the newsletter; a human approves it in the console;
  // this only sends what is already approved, and only to addresses that
  // ticked the box — the consented list lives in Supabase, never in a file.
  const { s, store, supabase } = await deps();
  const settings = await loadSettings(store);
  if (!settings.enabled || !s.RESEND_API_KEY || !s.ENGINE_KEY || !supabase) return;
  if (!settings.channels || settings.channels.newsletter === false) return;
  const docs = (await store.list('dispatch/state/newsletters/')).map((d) => d.data)
    .filter((n) => n.approved && !n.sentAt).sort((a, b) => (a.week < b.week ? 1 : -1));
  const n = docs[0];
  if (!n) { logger.info('weeklyDispatch: nothing approved'); return; }
  const recipients = await supabase.newsletterRecipients({ key: s.ENGINE_KEY });
  if (!recipients || !recipients.length) { logger.info('weeklyDispatch: no consented recipients'); return; }
  const site = s.SITE_BASE_URL || 'https://getscorebug.app';
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients.slice(i, i + 100).map((r) => {
      const unsub = `${site}/newsletter/unsubscribe?e=${encodeURIComponent(r.email)}&t=${unsubscribeToken(s.ENGINE_KEY, r.email)}`;
      const text = `${n.body}\n\nUnsubscribe: ${unsub}`;
      return { from: FROM_EMAIL.value(), to: [r.email], subject: n.subject, text, html: `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#E6EDF3;background:#0A0B0E;padding:20px">${String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`, headers: {
        'List-Unsubscribe': `<${unsub}>`,
        // RFC 8058. Without this the mail client treats the header as a plain
        // link and prefetchers follow it; with it, the client POSTs, which is
        // the only method the route acts on.
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      } };
    });
    const res = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { authorization: `Bearer ${s.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(batch) });
    if (!res.ok) throw new Error(`resend batch ${res.status}: ${(await res.text()).slice(0, 200)}`);
    sent += batch.length;
  }
  await store.update(`dispatch/state/newsletters/${n.week}`, { sentAt: new Date().toISOString(), recipients: sent });
  logger.info('weeklyDispatch sent', n.week, sent);
});

/* ─────────────────────────────────────────────────────────────────── OPS */

export const dispatchOps = onRequest({ secrets: secretList, cors: false, timeoutSeconds: 120 }, async (req, res) => {
  const { s, store, publishers, sa } = await deps();
  const action = String(req.query.action || '');
  const id = String(req.query.id || '');

  // The console reads with the secret in a HEADER, never a URL.
  if (action === 'status') {
    if (!s.OPS_SECRET || String(req.get('x-ops-secret') || '') !== s.OPS_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
    const [settings, events, replies, reviews, metrics, policy, budget, newsletters, digests, slots, facts] = await Promise.all([
      loadSettings(store), store.list('dispatch/state/events/'), store.list('dispatch/state/replies/'),
      store.list('dispatch/state/reviews/'), store.list('dispatch/state/metrics/'), store.get('dispatch/state/meta/policy'),
      store.get('dispatch/state/meta/budget'), store.list('dispatch/state/newsletters/'), store.list('dispatch/state/digests/'),
      store.get('dispatch/state/meta/slots'), store.get('dispatch/state/meta/facts'),
    ]);
    res.json({
      settings, policy: policy || null, budget: { plan: PLAN, ...(budget || {}) }, health: health(s, publishers), facts: facts || null,
      events: events.map((d) => d.data).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200),
      replies: replies.map((d) => d.data), reviews: reviews.map((d) => d.data),
      metrics: metrics.map((d) => d.data).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 30),
      newsletters: newsletters.map((d) => d.data), digests: digests.map((d) => ({ day: d.data.day, counts: d.data.counts })),
      slots: (slots && slots.fired) || {}, slotNotes: (slots && slots.notes) || {},
    });
    return;
  }

  // Everything else is either a signed link from the digest, or a call from
  // the /ops console on the site, which holds the raw secret server-side.
  const viaConsole = !!s.OPS_SECRET && String(req.get('x-ops-secret') || '') === s.OPS_SECRET;
  if (!viaConsole) {
    const day = String(req.query.day || '');
    if (!action || !id || !day || !verify(s.OPS_SECRET || 'unset', action, id, day, req.query.t)) { res.status(403).send(page('That link is not valid.')); return; }
    const ageDays = (Date.now() - Date.parse(day)) / 86_400_000;
    if (!(ageDays >= -1 && ageDays < 3)) { res.status(410).send(page('That link has expired. Open the console instead.')); return; }
  } else if (!action || !id) { res.status(400).send(page('An action needs a target.')); return; }

  /* ── A LINK IN AN EMAIL MUST NOT BE ABLE TO PUBLISH ────────────────────────
   *
   * Every action here changed state on GET, and the digest puts those URLs in
   * both the HTML and the plain-text body of a daily email. Outlook Safe
   * Links, Gmail's proxy, corporate mail scanners and ordinary browser
   * prefetch all follow links in mail without a person touching them. One scan
   * of one digest could approve every queued post, end dry run and switch on
   * autopilot — on an engine whose whole design is that it runs unattended.
   *
   * So a GET now renders a confirmation page and changes nothing; the button
   * on that page POSTs the same signed token. A scanner fetches the question,
   * never the answer. The console POSTs directly and skips the page.
   */
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'POST' && !SAFE_ACTIONS.has(action)) {
    res.send(confirmPage(action, id, req.query));
    return;
  }

  try {
    switch (action) {
      case 'approve': {
        const e = await sendApproved({ store, publishers, id, log });
        const where = Object.entries(e.postedUrls || {}).filter(([k]) => k !== 'blueskyUri');
        res.send(page(where.length ? `Sent to ${where.map(([k]) => k).join(', ')}.` : 'No network was available, so nothing went out. It stays in the queue.', where.map(([k, u]) => ({ label: k, href: u }))));
        break;
      }
      case 'skip':
        await store.update(`dispatch/state/events/${id}`, { status: 'skipped', decidedAt: new Date().toISOString() });
        res.send(page('Skipped. It will not come back.'));
        break;
      case 'reply1': case 'reply2': case 'reply3': {
        const r = await store.get(`dispatch/state/replies/${id}`);
        if (!r) { res.status(404).send(page('That mention is gone.')); return; }
        const text = (r.candidates || [])[Number(action.slice(-1)) - 1];
        const pub = publishers[r.network];
        if (!pub || !text) { res.status(400).send(page(`${r.network} is not configured, so the reply cannot be sent.`)); return; }
        const out = await pub.post(text, { replyTo: { id: r.postId, uri: r.postId, cid: r.cid, root: r.root } });
        await store.update(`dispatch/state/replies/${id}`, { status: 'sent', reply: text, url: out.url, sentAt: new Date().toISOString() });
        res.send(page('Replied.', out.url ? [{ label: 'see it', href: out.url }] : []));
        break;
      }
      case 'dismiss':
        await store.update(`dispatch/state/replies/${id}`, { status: 'dismissed' });
        res.send(page('Left alone.'));
        break;
      case 'review': {
        const r = await store.get(`dispatch/state/reviews/${id}`);
        if (!r || !r.draft) { res.status(404).send(page('That review draft is gone.')); return; }
        /* The draft is re-checked HERE, not only where the button was drawn.
           The digest's HTML suppressed the button when the linter had rejected
           a draft and its plain-text half printed the link anyway, so one tap
           in a text-rendering mail client could post a hard-rejected reply to
           the public Play listing. A gate that lives in the template is not a
           gate; this is the one place that can actually refuse. */
        if ((r.problems || []).length || r.status === 'needs-human') {
          res.status(409).send(page(`That draft did not pass the linter (${(r.problems || []).join('; ')}). Write this one yourself.`));
          return;
        }
        await replyToReview({ sa, packageName: s.PLAY_PACKAGE || 'ca.scorebug.sports', reviewId: r.reviewId, replyText: r.draft });
        await store.update(`dispatch/state/reviews/${id}`, { status: 'sent', sentAt: new Date().toISOString() });
        res.send(page('Reply posted to the Play listing.'));
        break;
      }
      case 'dismiss-review':
        await store.update(`dispatch/state/reviews/${id}`, { status: 'dismissed' });
        res.send(page('Left alone.'));
        break;
      case 'pause':
        await store.update('dispatch/settings', { enabled: false, pausedAt: new Date().toISOString() });
        res.send(page('Everything is paused. Nothing will post, reply or send until you turn it back on in the console.'));
        break;
      /* Console only, like the three reverses below. "No signed email link can
         ever start the machine" is the rule, and autopilot — which removes the
         approval step from every routine beat — is the most literal start
         there is. Both of these lacked the guard while their own reverses had
         it, so the machine could be started from an inbox and only stopped
         from the console. The digest now links to the console for these. */
      case 'golive':
        if (!viaConsole) { res.status(403).send(page('Ending dry run is a console action — open getscorebug.app/ops.')); return; }
        await store.update('dispatch/settings', { dryRun: false });
        res.send(page('Dry run is off. Posts now go out — still one approval at a time until you turn on autopilot.'));
        break;
      case 'autopilot':
        if (!viaConsole) { res.status(403).send(page('Turning on autopilot is a console action — open getscorebug.app/ops.')); return; }
        await store.update('dispatch/settings', { autopilot: true });
        res.send(page('Autopilot is on. Slates, finals, anniversaries and product lines go out by themselves; anything about a person still waits for you.'));
        break;
      // The reverses of the digest's one-way switches. Console only: a link in
      // an email should be able to STOP the machine without a password, never start it.
      case 'resume':
        if (!viaConsole) { res.status(403).send(page('Resuming is a console action.')); return; }
        await store.update('dispatch/settings', { enabled: true });
        res.send(page('Running again.'));
        break;
      case 'dryrun':
        if (!viaConsole) { res.status(403).send(page('That is a console action.')); return; }
        await store.update('dispatch/settings', { dryRun: true });
        res.send(page('Back in dry run. Nothing will be sent.'));
        break;
      case 'autopilot-off':
        if (!viaConsole) { res.status(403).send(page('That is a console action.')); return; }
        await store.update('dispatch/settings', { autopilot: false });
        res.send(page('Autopilot off. Every post waits for you again.'));
        break;
      case 'network': {
        if (!viaConsole) { res.status(403).send(page('That is a console action.')); return; }
        const on = String(req.query.on || '') === '1';
        await store.update('dispatch/settings', { networks: { [id]: on } });
        res.send(page(`${id} is ${on ? 'on' : 'off'}.`));
        break;
      }
      case 'newsletter':
        if (!viaConsole) { res.status(403).send(page('That is a console action.')); return; }
        await store.update(`dispatch/state/newsletters/${id}`, { approved: true, approvedAt: new Date().toISOString() });
        res.send(page('Newsletter approved. It sends on Monday at 09:00 to everyone who ticked the box.'));
        break;
      case 'spend': {
        /* Console only: verify() signs (action, id, day) and NOT the amount, so
           a signed spend link could be edited to log any figure. Nothing mints
           one today; this makes that stay true. */
        if (!viaConsole) { res.status(403).send(page('Logging a spend is a console action.')); return; }
        const line = String(req.query.line || '');
        const amount = Number(req.query.amount || 0);
        if (!line || !amount) { res.status(400).send(page('A spend needs a line and an amount.')); return; }
        await recordSpend({ store, line, amount, note: String(req.query.note || '') });
        res.send(page(`Logged CA$${amount} against ${line}.`));
        break;
      }
      default:
        res.status(400).send(page('Unknown action.'));
    }
  } catch (e) {
    logger.error('dispatchOps', action, String(e.message));
    res.status(500).send(page(`That did not work: ${String(e.message).slice(0, 200)}`));
  }
});

/**
 * Actions a prefetcher may perform without asking. Only reads and the one
 * action whose accidental firing is harmless in the safe direction — stopping.
 * `pause` stays on GET so that the fastest possible route from "something is
 * wrong" to "nothing is posting" is one tap from a phone's lock screen.
 */
const SAFE_ACTIONS = new Set(['status', 'pause']);

/** The one-button page a digest link lands on. Renders; changes nothing. */
function confirmPage(action, id, query) {
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WHAT = {
    approve: 'Send this post to its networks now',
    skip: 'Skip this post for good',
    reply1: 'Send reply 1', reply2: 'Send reply 2', reply3: 'Send reply 3',
    dismiss: 'Leave this mention alone',
    review: 'Post this reply on the Play listing',
    'dismiss-review': 'Leave this review alone',
    newsletter: 'Approve this week\u2019s newsletter',
  };
  const hidden = Object.entries(query || {})
    .filter(([k]) => ['action', 'id', 'day', 't', 'on', 'line', 'amount', 'note'].includes(k))
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Scorebug</title>
<body style="margin:0;background:#0A0B0E;color:#E6EDF3;font:400 17px/1.6 system-ui,sans-serif">
<div style="max-width:34rem;margin:12vh auto;padding:0 24px">
  <div style="font:600 11px/1 system-ui;letter-spacing:.18em;text-transform:uppercase;color:#7D8590">Scorebug &middot; confirm</div>
  <p style="font:400 22px/1.45 system-ui;margin:14px 0 4px">${esc(WHAT[action] || action)}?</p>
  <p style="color:#7D8590;font-size:15px;margin:0 0 26px">${esc(id)}</p>
  <form method="POST">${hidden}
    <button type="submit" style="appearance:none;border:1px solid #7a0400;border-radius:12px;padding:14px 26px;font:600 16px system-ui;color:#fff;background:linear-gradient(180deg,#f0413c,#b00500);cursor:pointer">Yes, do it</button>
  </form>
  <p style="color:#7D8590;font-size:13px;margin-top:26px">Nothing has happened yet. This page exists because mail scanners follow links in email, and one of them following an approval link would have published a post nobody read.</p>
</div>`;
}

function page(msg, links = []) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scorebug dispatch</title>
<body style="background:#0A0B0E;color:#E6EDF3;font-family:system-ui,sans-serif;padding:40px 24px;margin:0">
<div style="max-width:520px;margin:0 auto">
<p style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#F85149;margin:0">Scorebug // dispatch</p>
<p style="font:400 20px/1.45 system-ui,sans-serif;margin:14px 0 0">${esc(msg)}</p>
${links.map((l) => `<p style="margin:10px 0 0"><a href="${esc(l.href)}" style="color:#58A6FF">${esc(l.label)}</a></p>`).join('')}
<p style="font:400 13px/1.6 ui-monospace,monospace;color:#9AA4B2;margin-top:28px">You can close this.</p>
</div></body>`;
}

// newsletterHtml / newsletterText are exported for the site's preview and tests.
export { newsletterHtml, newsletterText };
