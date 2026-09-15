// Scorebug dispatch — the content engine: the week's slate, on a page.
//
// Social posts decay in an hour. A page ranks for years. Every Monday this
// writes one page — every fixture across every in-season league for the
// coming week, with local times, a "grade it" link into the app for each —
// and tells the search engines it exists. It is the answer to the question
// people type on a Monday ("what games are on this week"), and it is written
// from the same feed the rest of the machine reads.
//
// ── HOW IT AVOIDS BEING SLOP ────────────────────────────────────────────────
//
// Nothing on the page is written by a model. The fixtures, the counts, the
// times and the venues come out of the feed as data and are rendered by the
// site. There is no standfirst to generate: a table of real fixtures with a
// real action per row is the whole value, and a paragraph on top would be the
// part a search engine has learned to discount. The site's own PARTNERS.md and
// matchups.ts already refuse thin programmatic pages for the same reason.
//
// ── WHERE IT LIVES ──────────────────────────────────────────────────────────
//
// dispatch/public/articles/{week} — the ONLY publicly readable part of the
// ledger (firestore.rules grants read there and nowhere else). The site
// renders it at /slate/[week] with a 1-hour revalidate. A copy of the summary
// goes to dispatch/state/slates/{week} for the Monday WEEKAHEAD beat.

import { SITE } from './facts.js';
import { LEAGUE_BY_ID, clock, localParts } from './leagues.js';
import { weekKey } from './events.js';
import { slatePick } from './rank.js';
import { teamName } from './draft.js';

const ART = 'dispatch/public/articles/';
const SL = 'dispatch/state/slates/';
const NEWS = 'dispatch/state/newsletters/';
const DAY = 86_400_000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** "14–20 September 2026" from two Mountain day parts. */
export function weekRangeLabel(a, b) {
  const sameMonth = a.month === b.month;
  const left = sameMonth ? `${a.date}` : `${a.date} ${MONTHS[a.month]}`;
  return `${left}–${b.date} ${MONTHS[b.month]} ${b.year}`;
}

/** Facts only. Everything the page renders as data comes from here. */
export function buildWeek({ games = [], now = Date.now(), tz = 'America/Edmonton' }) {
  const from = localParts(now, tz);
  const to = localParts(now + 6 * DAY, tz);
  const slug = weekKey(now, tz);
  const inWeek = games.filter((g) => g.start != null && !g.canceled).sort((a, b) => a.start - b.start);
  const byLeague = {};
  for (const g of inWeek) {
    const l = LEAGUE_BY_ID[g.league] || { id: g.league, name: g.league };
    const row = (byLeague[l.id] ||= { league: l.id, name: l.name, count: 0, games: [] });
    row.count += 1;
    const p = localParts(g.start, tz);
    row.games.push({
      id: g.id, espnId: g.espnId, source: g.source, start: new Date(g.start).toISOString(),
      day: DAYS[p.weekday] || p.weekday, date: p.day, time: `${clock(g.start, tz)} MT`,
      away: g.away ? teamName(g.away) : null, home: g.home ? teamName(g.home) : null,
      awayAbbr: g.away ? g.away.abbr : null, homeAbbr: g.home ? g.home.abbr : null,
      name: g.sport === 'racing' ? g.name : null,
      venue: g.venue, city: g.city, broadcast: g.broadcast, note: g.note,
      seasonType: g.seasonType, week: g.week, postponed: !!g.postponed,
    });
  }
  const leagues = Object.values(byLeague).sort((a, b) => b.count - a.count);
  const highlights = slatePick(inWeek, 5, { tz }).map((g) => (g.sport === 'racing'
    ? `${g.name}, ${DAYS[localParts(g.start, tz).weekday]}`
    : `${teamName(g.away)} at ${teamName(g.home)}, ${DAYS[localParts(g.start, tz).weekday]} ${clock(g.start, tz)} MT`));
  return {
    slug,
    monday: from.day,
    range: weekRangeLabel(from, to),
    count: inWeek.length,
    leagues: leagues.length,
    byLeague: leagues,
    highlights,
    canonical: `${SITE}/slate/${slug}`,
    title: `Every game this week, ${weekRangeLabel(from, to)}`,
  };
}

/** The same week as an email. Plain text; the site's template wraps it. */
export function assembleNewsletter(week, { facts = null } = {}) {
  const lines = [];
  lines.push(week.title, '');
  lines.push(`${week.count} games across ${week.leagues} leagues on The Slate this week. Times are Mountain.`, '');
  for (const l of week.byLeague) {
    lines.push(`${l.name} — ${l.count}`);
    for (const g of l.games.slice(0, 12)) lines.push(`  ${g.day} ${g.time} · ${g.name || `${g.away} at ${g.home}`}${g.broadcast ? ` · ${g.broadcast}` : ''}`);
    if (l.games.length > 12) lines.push(`  and ${l.games.length - 12} more on the page`);
    lines.push('');
  }
  lines.push(`The whole week, with a grade-it link for every game: ${week.canonical}?utm_source=email&utm_medium=dispatch&utm_campaign=slate`, '',
    'Scorebug is the logbook for every game you watch: grade it out of 5.0, say what it meant, keep it for good.',
    `${SITE}/get?s=email&c=slate`);
  return {
    week: week.slug,
    subject: week.title,
    body: lines.join('\n'),
    approved: false,
    createdAt: new Date().toISOString(),
  };
}

/** Tell IndexNow the page exists. Bing, Yandex and Naver read it; the sitemap covers Google. */
export async function pingIndexNow({ key, host = 'getscorebug.app', urls = [], fetchImpl = fetch }) {
  if (!key || !urls.length) return { skipped: true };
  const res = await fetchImpl('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/indexnow-key.txt`, urlList: urls }),
  });
  return { status: res.status, ok: res.ok };
}

/**
 * Write this week's slate page and its newsletter draft. Idempotent per week:
 * re-running refreshes the page (fixtures move) but never overwrites an
 * approved newsletter. The WEEKAHEAD social post is the tick's job — it fires
 * from dispatch/state/slates/{week} in the Monday window like any other beat.
 */
export async function contentTick({ store, week: readWeek, secrets = {}, settings = {}, now = Date.now(), tz = 'America/Edmonton', fetchImpl = fetch, log = () => {} }) {
  const { games = [], errors = [] } = await readWeek({ now });
  const week = buildWeek({ games, now, tz });
  const existing = await store.get(ART + week.slug);
  const publishedAt = new Date(now).toISOString();
  await store.set(ART + week.slug, { ...week, publishedAt, firstPublishedAt: (existing && existing.firstPublishedAt) || publishedAt, feedErrors: errors });
  await store.set(SL + week.slug, { slug: week.slug, count: week.count, leagues: week.leagues, range: week.range, highlights: week.highlights, canonical: week.canonical, publishedAt });

  const prior = await store.get(NEWS + week.slug);
  if (!prior || !prior.approved) await store.set(NEWS + week.slug, assembleNewsletter(week));

  let indexnow = { skipped: true };
  if (!settings.dryRun && week.count) {
    indexnow = await pingIndexNow({ key: secrets.INDEXNOW_KEY, urls: [week.canonical, `${SITE}/slate`], fetchImpl }).catch((e) => ({ error: String(e.message) }));
  }
  log('slate written', week.slug, week.count);
  return { slug: week.slug, count: week.count, leagues: week.leagues, indexnow, errors };
}
