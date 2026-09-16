// Cadenic dispatch — THE KEYLESS SOURCES
//
// ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Discovery used to begin with `if (!searchProvider) return` — no Google key,
// no prospects, ever. That made the whole revenue side of the engine wait on a
// console setup, and it capped the funnel at Google's free hundred queries a
// day even once it was done.
//
// Every source in this file needs no key, no card and no account. They are not
// a fallback for when the search key is missing; they are a different and in
// places better population, because each one is a place where a business has
// already published both a Discord link and a way to reach it. They run
// alongside the search API, not instead of it.
//
// ─── WHAT WE DELIBERATELY DO NOT USE ────────────────────────────────────────
//
// Researched and rejected, so that nobody re-adds them later believing they
// were merely overlooked:
//
//   Disboard, top.gg, Discadia   behind an active Cloudflare bot challenge.
//                                An anti-bot interstitial is an unambiguous
//                                answer to the question of whether automated
//                                access is welcome, and the answer is no.
//   Reddit                       403 without OAuth, and its data terms
//                                restrict commercial use. Also our own
//                                standing rule: read and rank, never post.
//   Product Hunt                 its API terms say the API "must not be used
//                                for commercial purposes" without written
//                                permission. Lead generation for a studio
//                                that invoices is commercial.
//   Common Crawl                 the CDX index indexes URLs, not page
//                                contents, so it can only find discord.gg
//                                itself — the inverse of what we want. The
//                                outbound-link data lives in multi-terabyte
//                                WAT files, and data.commoncrawl.org's
//                                robots.txt is `Disallow: /`.
//   Marginalia                   free tier is non-commercial only.
//   public SearXNG instances     JSON output is off by default and the open
//                                instances rate-limit or refuse.
//
// ─── THE SHAPE ──────────────────────────────────────────────────────────────
//
// Every feed returns the same thing the search adapters return —
// { ok, results: [{ url, title, snippet }] } — so discover.js assesses a lead
// from itch.io exactly as it assesses one from Google: robots.txt first, the
// company's own page second, a published address or nothing.
//
// `emailHint` is the one addition. Steam publishes a support email on the
// store page as structured data, which is a conspicuously published business
// address in the CASL sense and saves a crawl. It is a hint and never a
// shortcut: a lead still has to have a Discord link on its own site to
// qualify, and the hint is only used when the site itself shows no address.

import { USER_AGENT } from './sources.js';

const UA = USER_AGENT;

/** Every feed is wrapped in this: a source that is down costs us that source
 *  for one morning and must never cost us the run. */
async function getJson(url, { fetchImpl = fetch, timeoutMs = 12_000, headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': UA, ...headers } });
    if (!res.ok) return { ok: false, reason: `${res.status}` };
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, { fetchImpl = fetch, timeoutMs = 12_000, headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { 'user-agent': UA, ...headers } });
    if (!res.ok) return { ok: false, reason: `${res.status}` };
    return { ok: true, text: (await res.text()).slice(0, 600_000) };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

/* ══════════════════════════════════════════════════ 1. HACKER NEWS */

/**
 * Show HN and Launch HN, filtered to posts that mention a Discord.
 *
 * The best-shaped source of the five. An HN story's `url` is the founder's own
 * domain — not a profile, not a directory, not a platform page — and a Show HN
 * is by definition someone who has shipped something and wants to talk about
 * it. Algolia's index is public, keyless, and explicitly offered for this.
 *
 * `numericFilters` keeps it to the recent past. A four-year-old Show HN is
 * either a real company that has long since solved this or a dead project.
 */
export async function hackerNews({ days = 400, hits = 40, fetchImpl = fetch } = {}) {
  const since = Math.floor((Date.now() - days * 86_400_000) / 1000);
  const out = [];
  for (const tag of ['show_hn', 'story']) {
    const u = new URL('https://hn.algolia.com/api/v1/search');
    u.searchParams.set('query', 'discord.gg');
    u.searchParams.set('tags', tag);
    u.searchParams.set('hitsPerPage', String(Math.min(100, hits)));
    u.searchParams.set('numericFilters', `created_at_i>${since}`);
    const r = await getJson(u.toString(), { fetchImpl });
    if (!r.ok) continue;
    for (const h of r.json.hits || []) {
      if (!h.url) continue;
      out.push({ url: h.url, title: h.title || '', snippet: (h.story_text || h._highlightResult?.story_text?.value || '').replace(/<[^>]+>/g, ' ').slice(0, 200), via: `hn/${tag}` });
    }
  }
  if (!out.length) return { ok: false, reason: 'hacker news returned nothing' };
  return { ok: true, results: dedupe(out) };
}

/* ══════════════════════════════════════════════════════ 2. GITHUB */

/**
 * Repository search, not code search.
 *
 * Code search is the obvious choice and the wrong one: it is limited to ten
 * requests a minute against repository search's thirty, it requires auth where
 * repository search does not, and — the part that actually decides it — its
 * tokeniser treats punctuation as a wildcard, so `discord.gg` is matched as
 * `discord gg` and the results are noise. GitHub staff have confirmed the
 * regex syntax that would fix that is web-UI only and not available over REST.
 *
 * `homepage` is the field that matters: it is the project's own site, which is
 * the thing we actually want to assess. A repository with no homepage is
 * skipped rather than assessed as a github.com URL, which the platform filter
 * would reject anyway one HTTP request later.
 */
export async function githubRepos({ token, query = '"discord.gg" in:readme', count = 30, minStars = 5, fetchImpl = fetch } = {}) {
  const u = new URL('https://api.github.com/search/repositories');
  u.searchParams.set('q', `${query} stars:>=${minStars} pushed:>${new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)}`);
  u.searchParams.set('sort', 'updated');
  u.searchParams.set('per_page', String(Math.min(100, count)));
  const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await getJson(u.toString(), { fetchImpl, headers });
  if (!r.ok) return { ok: false, reason: `github ${r.reason}${token ? '' : ' (unauthenticated: 10 requests/minute — set GITHUB_TOKEN for 30)'}` };
  const results = (r.json.items || [])
    .filter((i) => i.homepage && /^https?:\/\//i.test(i.homepage))
    .map((i) => ({ url: i.homepage, title: i.full_name || '', snippet: (i.description || '').slice(0, 200), via: 'github' }));
  return { ok: true, results };
}

/* ═══════════════════════════════════════════════════════ 3. STEAM */

/**
 * Steam, via SteamSpy for the app list and Steam's own store API for details.
 *
 * The highest-quality lead in the file and the only one that arrives with a
 * contact address already attached. `support_info.email` is an address the
 * studio published themselves, deliberately, for people to write to about
 * their product — which is the conspicuous-publication test almost verbatim —
 * and `website` is their own domain, which is what we assess.
 *
 * A studio with a Steam page has revenue, a company behind it and a community
 * that lives on Discord. This is the segment most likely to buy.
 *
 * Both endpoints are undocumented and informally rate-limited, so the loop is
 * slow on purpose and small on purpose.
 */
export async function steamStudios({ limit = 12, pauseMs = 1500, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const top = await getJson('https://steamspy.com/api.php?request=top100in2weeks', { fetchImpl });
  if (!top.ok) return { ok: false, reason: `steamspy ${top.reason}` };
  const ids = Object.keys(top.json || {}).slice(0, Math.min(40, limit * 3));
  const results = [];
  for (const appid of ids) {
    if (results.length >= limit) break;
    const d = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,website,support_info`, { fetchImpl });
    await sleep(pauseMs);
    if (!d.ok) continue;
    const entry = d.json?.[appid];
    if (!entry?.success || !entry.data) continue;
    const site = entry.data.website || entry.data.support_info?.url || '';
    if (!site || !/^https?:\/\//i.test(site)) continue;
    const email = String(entry.data.support_info?.email || '').trim().toLowerCase();
    results.push({
      url: site,
      title: entry.data.name || '',
      snippet: (entry.data.short_description || '').slice(0, 200),
      via: 'steam',
      emailHint: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '',
      emailHintSource: `https://store.steampowered.com/app/${appid}/`,
    });
  }
  if (!results.length) return { ok: false, reason: 'no steam studios with a website' };
  return { ok: true, results };
}

/* ══════════════════════════════════════════════════════ 4. ITCH.IO */

/**
 * itch.io's browse pages answer to `.xml` with an RSS feed. Undocumented, but
 * served deliberately and permitted by their robots.txt, which disallows
 * `/search`, `/embed/`, `/checkout/` and the download paths and nothing we
 * touch here. We do not go near `/search`.
 *
 * The feed gives a game page on a developer subdomain, which is a platform
 * page and not a company site — so one extra fetch per item pulls the "Links"
 * block, where indie developers put their own homepage. That own homepage is
 * what gets assessed. Without that hop every itch lead would collapse onto the
 * single host `itch.io` and the one-contact-per-company rule would throw all
 * but the first away.
 */
export async function itchGames({ pages = 1, perPage = 8, fetchImpl = fetch } = {}) {
  const items = [];
  for (let p = 1; p <= pages; p++) {
    const r = await getText(`https://itch.io/games/newest.xml${p > 1 ? `?page=${p}` : ''}`, { fetchImpl, headers: { accept: 'application/xml' } });
    if (!r.ok) continue;
    for (const m of r.text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const link = (m[1].match(/<link>([^<]+)<\/link>/) || [])[1];
      const title = (m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1];
      if (link) items.push({ link: link.trim(), title: (title || '').trim() });
    }
  }
  const results = [];
  for (const it of items.slice(0, perPage)) {
    const page = await getText(it.link, { fetchImpl });
    if (!page.ok) continue;
    /* Only proceed when the game page mentions Discord at all — otherwise the
       outbound fetch is spent on a developer who has no community to improve. */
    if (!/discord\.gg|discord\.com\/invite/i.test(page.text)) continue;
    const own = ownSiteFrom(page.text, 'itch.io');
    if (!own) continue;
    results.push({ url: own, title: it.title, snippet: 'indie developer on itch.io', via: 'itch' });
  }
  if (!results.length) return { ok: false, reason: 'no itch developers with their own site and a Discord' };
  return { ok: true, results };
}

/**
 * The first outbound link on a platform page that points somewhere that is not
 * a platform. Deliberately conservative: a page full of social buttons should
 * yield nothing rather than yield twitter.com.
 */
const PLATFORMY = /(^|\.)(itch\.io|discord\.gg|discord\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|twitch\.tv|tiktok\.com|patreon\.com|ko-fi\.com|kickstarter\.com|steampowered\.com|steamcommunity\.com|reddit\.com|github\.com|linktr\.ee|bsky\.app|mastodon\.social|t\.co|bit\.ly)$/i;

export function ownSiteFrom(html, selfHost = '') {
  for (const m of String(html).matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    let h = '';
    try { h = new URL(m[1]).hostname.replace(/^www\./, '').toLowerCase(); } catch { continue; }
    if (!h || PLATFORMY.test(h)) continue;
    if (selfHost && h.endsWith(selfHost)) continue;
    return `https://${h}`;
  }
  return '';
}

/* ═════════════════════════════════════════════════════ 5. BLUESKY */

/**
 * Posts that carry a discord.gg link, read through the AppView that answers
 * unauthenticated. `public.api.bsky.app` sheds load by returning 403 to a
 * meaningful share of datacentre requests on purpose, so `api.bsky.app` is the
 * host used here; an app password upgrades this if the 403s ever become the
 * rule rather than the exception.
 *
 * A different population from the other four: people announcing a community
 * today rather than a company that has had one for two years. Noisier, and
 * worth having for exactly that reason.
 */
export async function blueskyPosts({ limit = 25, fetchImpl = fetch, auth = '' } = {}) {
  const u = new URL('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts');
  u.searchParams.set('q', 'discord.gg');
  u.searchParams.set('limit', String(Math.min(100, limit)));
  u.searchParams.set('sort', 'latest');
  const r = await getJson(u.toString(), { fetchImpl, headers: auth ? { authorization: `Bearer ${auth}` } : {} });
  if (!r.ok) return { ok: false, reason: `bluesky ${r.reason}` };
  const out = [];
  for (const post of r.json.posts || []) {
    const text = post.record?.text || '';
    /* Link facets carry the real destination; the visible text is often
       truncated with an ellipsis and will not parse as a URL. */
    const links = [];
    for (const f of post.record?.facets || []) {
      for (const feat of f.features || []) if (feat.uri) links.push(feat.uri);
    }
    for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) links.push(m[0]);
    for (const l of links) {
      let h = '';
      try { h = new URL(l).hostname.replace(/^www\./, '').toLowerCase(); } catch { continue; }
      if (!h || PLATFORMY.test(h)) continue;
      out.push({ url: `https://${h}`, title: post.author?.displayName || post.author?.handle || '', snippet: text.slice(0, 200), via: 'bluesky' });
      break;
    }
  }
  if (!out.length) return { ok: false, reason: 'no bluesky posts with a company link' };
  return { ok: true, results: dedupe(out) };
}

/* ═════════════════════════════════════════════════════════════ ALL */

function dedupe(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    let h = '';
    try { h = new URL(r.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { continue; }
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push(r);
  }
  return out;
}

export const FEEDS = [
  { key: 'hn', label: 'Hacker News', run: (o) => hackerNews(o) },
  { key: 'github', label: 'GitHub', run: (o) => githubRepos(o) },
  { key: 'steam', label: 'Steam', run: (o) => steamStudios(o) },
  { key: 'itch', label: 'itch.io', run: (o) => itchGames(o) },
  { key: 'bluesky', label: 'Bluesky', run: (o) => blueskyPosts(o) },
];

/**
 * One feed per day, rotating, so each source is sampled weekly rather than all
 * five being hammered every morning. The feeds are cheap but they are somebody
 * else's servers, and a daily pass at a polite depth beats an hourly one at
 * any depth.
 */
export function feedsForDay(now = Date.now(), perDay = 2) {
  const day = Math.floor(now / 86_400_000);
  const start = day % FEEDS.length;
  return Array.from({ length: Math.min(perDay, FEEDS.length) }, (_, i) => FEEDS[(start + i) % FEEDS.length]);
}

/** Run today's feeds and return everything they found, tagged with its source. */
export async function harvest({ secrets = {}, now = Date.now(), perDay = 2, fetchImpl = fetch, log = () => {} } = {}) {
  const results = [];
  const notes = {};
  for (const feed of feedsForDay(now, perDay)) {
    try {
      const r = await feed.run({ fetchImpl, token: feed.key === 'github' ? secrets.GITHUB_TOKEN : undefined });
      if (r.ok) { results.push(...r.results); notes[feed.key] = `${r.results.length} found`; }
      else notes[feed.key] = r.reason;
    } catch (e) {
      notes[feed.key] = String(e.message || e).slice(0, 80);
      log('harvest', feed.key, String(e.message || e));
    }
  }
  return { results: dedupe(results), notes };
}
