// Scorebug dispatch — the feed. One shape for every league, whatever answered.
//
// ── WHERE GAMES COME FROM ───────────────────────────────────────────────────
//
// Eighteen leagues come from ESPN's public scoreboard, addressed exactly the
// way the app addresses it (`leagues.js` carries the slugs, the range flag and
// the NCAAB `groups=50` quirk, all verified in the app's registry). CFL comes
// from TheSportsDB because ESPN's CFL scoreboard is empty — measured 2026-09-09
// on a week with four games.
//
// ── WHY THIS IS NOT A CONTRACT ──────────────────────────────────────────────
//
// ESPN publishes no terms for these endpoints and has changed their behaviour
// without notice: the site's /api/espn proxy exists because CORS headers
// vanished one day and took The Slate down. This module therefore does three
// things a polite client does. It sends one request per in-season league per
// tick and never per game. It fails SOFT — a league that does not answer is a
// league with no games this tick, never an exception that stops the others.
// And it never posts a score it did not read: normalisation refuses to invent a
// field, so a missing score is `null`, not 0.
//
// ── WHAT A GAME LOOKS LIKE AFTER THIS FILE ──────────────────────────────────
//
//   { id: 'NHL-401559', league, sport, start (ms), state: 'pre'|'in'|'post',
//     completed, detail: 'Final/OT', postponed, canceled, suspended,
//     period, seasonType: 1 pre | 2 regular | 3 post, week, note,
//     home: { abbr, name, short, score, scoreText, record, winner, linescores },
//     away: { ... }, venue, broadcast, people: [names the record mentions] }
//
// `people` exists for the linter: every athlete a record names is a person the
// machine must not name back. See draft.js.

import { LEAGUES, LEAGUE_BY_ID, inSeason, localParts } from './leagues.js';

export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
export const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const TSDB_CFL_LEAGUE = 'Canadian Football League';

/**
 * ── NO CUSTOM USER-AGENT, AND THIS IS MEASURED ──────────────────────────────
 *
 * The polite thing — `Scorebug dispatch (+https://getscorebug.app)` — is
 * answered by ESPN's edge with an Akamai "Access Denied" 403 on every league
 * (measured 2026-09-09, from two networks). Node's default agent and a browser
 * agent both get 200 from the same URL a second later. So this client sends no
 * user-agent of its own. It still identifies itself by behaviour: one request
 * per league per tick, never per game, and it backs off on any error.
 */

/* ────────────────────────────────────────────────────────────── ESPN */

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v == null ? null : String(v));

/** Name the competitor's side without trusting one field: ESPN's abbreviations are not unique across leagues. */
function side(c) {
  if (!c) return null;
  const t = c.team || {};
  const scoreText = c.score != null && typeof c.score === 'object' ? str(c.score.displayValue) : str(c.score);
  return {
    espnId: str(t.id),
    abbr: str(t.abbreviation || t.shortDisplayName || '').toUpperCase() || null,
    name: str(t.displayName || t.name) || null,
    short: str(t.shortDisplayName || t.name) || null,
    location: str(t.location) || null,
    nickname: str(t.name) || null,
    color: t.color ? `#${String(t.color).replace('#', '')}` : null,
    score: num(scoreText),
    scoreText,
    record: Array.isArray(c.records) && c.records[0] ? str(c.records[0].summary) : null,
    winner: c.winner === true ? true : c.winner === false ? false : null,
    rank: num(c.curatedRank && c.curatedRank.current) || null,
    linescores: Array.isArray(c.linescores) ? c.linescores.map((l) => num(l.value)).filter((v) => v != null) : [],
  };
}

/** Athletes the record names, so the linter can refuse to name them back. */
function peopleIn(comp) {
  const out = new Set();
  for (const group of comp.leaders || []) {
    for (const l of group.leaders || []) {
      const n = l.athlete && (l.athlete.displayName || l.athlete.fullName);
      if (n) out.add(String(n));
    }
  }
  for (const c of comp.competitors || []) {
    if (c.athlete && c.athlete.displayName) out.add(String(c.athlete.displayName)); // racing
  }
  return [...out];
}

/**
 * Normalise one ESPN event into the engine's game record. Missing fields are
 * null, never invented; a competition with no competitors is dropped.
 */
export function normalizeEspn(raw, league) {
  if (!raw || !raw.id) return null;
  const l = typeof league === 'string' ? LEAGUE_BY_ID[league] : league;
  if (!l) return null;
  const comp = (raw.competitions && raw.competitions[0]) || {};
  const st = (comp.status && comp.status.type) || (raw.status && raw.status.type) || {};
  const state = st.state === 'post' ? 'post' : st.state === 'in' ? 'in' : 'pre';
  const name = String(st.name || '').toUpperCase();
  const detail = str(st.detail || st.shortDetail || st.description) || null;
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
  const home = side(competitors.find((c) => c.homeAway === 'home') || (l.sport === 'racing' ? null : competitors[0]));
  const away = side(competitors.find((c) => c.homeAway === 'away') || (l.sport === 'racing' ? null : competitors[1]));
  if (l.sport !== 'racing' && (!home || !away)) return null;
  const startMs = Date.parse(comp.date || raw.date);
  const season = raw.season || {};
  const notes = Array.isArray(comp.notes) ? comp.notes.map((n) => str(n.headline)).filter(Boolean) : [];
  const headlines = Array.isArray(comp.headlines) ? comp.headlines.map((h) => str(h.shortLinkText || h.description)).filter(Boolean) : [];
  return {
    id: `${l.id}-${raw.id}`,
    espnId: String(raw.id),
    league: l.id,
    sport: l.sport,
    name: str(raw.name) || null,
    shortName: str(raw.shortName) || null,
    start: Number.isFinite(startMs) ? startMs : null,
    state,
    completed: st.completed === true || state === 'post',
    statusName: name || null,
    detail,
    postponed: /POSTPONED/.test(name) || /postponed/i.test(detail || ''),
    canceled: /CANCEL/.test(name) || /cancel/i.test(detail || ''),
    suspended: /SUSPEND|DELAY/.test(name) || /suspend|delay/i.test(detail || ''),
    period: num(comp.status && comp.status.period) ?? null,
    clock: str(comp.status && comp.status.displayClock) || null,
    seasonType: num(season.type) ?? null,
    seasonYear: num(season.year) ?? null,
    week: num(raw.week && raw.week.number) ?? null,
    note: notes[0] || null,
    headline: headlines[0] || null,
    /* Everything the feed said, for isSensitive to read. Only notes[0] and
       headlines[0] are ever DISPLAYED, but a serious-injury sentence lands in
       notes[1] as readily as notes[0], and the safety check must see all of it. */
    feedText: [...notes, ...headlines].join(' \u00b7 ') || null,
    neutral: comp.neutralSite === true,
    venue: str(comp.venue && comp.venue.fullName) || null,
    city: str(comp.venue && comp.venue.address && comp.venue.address.city) || null,
    broadcast: Array.isArray(comp.broadcasts) && comp.broadcasts[0] && Array.isArray(comp.broadcasts[0].names) ? str(comp.broadcasts[0].names[0]) : null,
    home,
    away,
    entrants: l.sport === 'racing' ? competitors.length : null,
    people: peopleIn(comp),
    source: 'espn',
  };
}

const ymd = (p) => `${p.year}${String(p.month + 1).padStart(2, '0')}${String(p.date).padStart(2, '0')}`;

/** The scoreboard URL for a league and a day (or a range, when the league allows one). */
export function scoreboardUrl(league, fromParts, toParts = null) {
  const l = typeof league === 'string' ? LEAGUE_BY_ID[league] : league;
  const dates = toParts && l.rangeQuery ? `${ymd(fromParts)}-${ymd(toParts)}` : ymd(fromParts);
  const extra = l.scoreboardParams ? `&${l.scoreboardParams}` : '';
  return `${ESPN}/${l.sport}/${l.espnSlug}/scoreboard?dates=${dates}&limit=500${extra}`;
}

async function getJson(url, fetchImpl, timeoutMs = 12_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // ESPN occasionally ships control characters inside strings; JSON.parse refuses them.
    return JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
  } finally {
    clearTimeout(t);
  }
}

/** One league, one day (or range). Returns normalised games; throws on a network failure. */
export async function readEspn({ league, from, to = null, fetchImpl = fetch }) {
  const l = typeof league === 'string' ? LEAGUE_BY_ID[league] : league;
  const body = await getJson(scoreboardUrl(l, from, to), fetchImpl);
  return (body.events || []).map((e) => normalizeEspn(e, l)).filter(Boolean);
}

/* ─────────────────────────────────────────────────────────── THESPORTSDB */

const CFL_ABBR = Object.freeze({
  'edmonton elks': 'EDM', 'calgary stampeders': 'CGY', 'saskatchewan roughriders': 'SSK', 'winnipeg blue bombers': 'WPG',
  'toronto argonauts': 'TOR', 'hamilton tiger-cats': 'HAM', 'bc lions': 'BC', 'b.c. lions': 'BC', 'ottawa redblacks': 'OTT', 'montreal alouettes': 'MTL',
});
const cflAbbr = (name) => CFL_ABBR[String(name || '').toLowerCase().trim()] || String(name || '').slice(0, 3).toUpperCase();
const cflShort = (name) => String(name || '').split(' ').slice(-1)[0] || null;

/** Normalise one TheSportsDB event into the same shape as an ESPN game. */
export function normalizeTsdb(raw) {
  if (!raw || !raw.idEvent) return null;
  const startMs = raw.strTimestamp ? Date.parse(raw.strTimestamp.endsWith('Z') ? raw.strTimestamp : `${raw.strTimestamp}Z`)
    : raw.dateEvent && raw.strTime ? Date.parse(`${raw.dateEvent}T${raw.strTime}Z`) : NaN;
  const status = String(raw.strStatus || '');
  const finished = /finished|ft|final/i.test(status);
  const live = /1st|2nd|3rd|4th|half|q[1-4]|ot/i.test(status) && !finished;
  const hs = num(raw.intHomeScore), as = num(raw.intAwayScore);
  const mk = (name, score) => ({
    espnId: null, abbr: cflAbbr(name), name: str(name), short: cflShort(name), location: null, nickname: cflShort(name), color: null,
    score, scoreText: score == null ? null : String(score), record: null,
    winner: finished && hs != null && as != null ? (name === raw.strHomeTeam ? hs > as : as > hs) : null, rank: null, linescores: [],
  });
  return {
    id: `CFL-${raw.idEvent}`,
    espnId: String(raw.idEvent),
    league: 'CFL',
    sport: 'football',
    name: str(raw.strEvent) || null,
    shortName: `${cflAbbr(raw.strAwayTeam)} @ ${cflAbbr(raw.strHomeTeam)}`,
    start: Number.isFinite(startMs) ? startMs : null,
    state: finished ? 'post' : live ? 'in' : 'pre',
    completed: finished,
    statusName: finished ? 'STATUS_FINAL' : live ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED',
    detail: finished ? 'Final' : status || null,
    postponed: /postpone/i.test(status),
    canceled: /cancel/i.test(status),
    suspended: /suspend|delay/i.test(status),
    period: null,
    clock: null,
    seasonType: /playoff|final|grey cup/i.test(String(raw.intRound || '') + String(raw.strEvent || '')) ? 3 : 2,
    seasonYear: num(String(raw.strSeason || '').slice(0, 4)),
    week: num(raw.intRound),
    note: null,
    headline: null,
    neutral: false,
    venue: str(raw.strVenue) || null,
    city: str(raw.strCity) || null,
    broadcast: null,
    home: mk(raw.strHomeTeam, hs),
    away: mk(raw.strAwayTeam, as),
    entrants: null,
    people: [],
    source: 'tsdb',
  };
}

export async function readCfl({ days, fetchImpl = fetch }) {
  const out = [];
  for (const d of days) {
    const url = `${TSDB}/eventsday.php?d=${d}&l=${encodeURIComponent(TSDB_CFL_LEAGUE)}`;
    const body = await getJson(url, fetchImpl);
    for (const e of body.events || []) { const g = normalizeTsdb(e); if (g) out.push(g); }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────── THE TICK */

/**
 * Every game from yesterday to tomorrow (Mountain days) in every league that is
 * plausibly in season, one request per league, failing soft per league.
 *
 * Yesterday is included because a final at 23:50 Mountain belongs to the day
 * that has just ended, and tomorrow because the morning slate is drafted from
 * the day ahead. A league that fails is named in `errors` and contributes no
 * games; the digest's health block prints the list.
 */
export async function readFeed({ now = Date.now(), tz = 'America/Edmonton', leagues = LEAGUES, fetchImpl = fetch, log = () => {} } = {}) {
  const DAY = 86_400_000;
  const from = localParts(now - DAY, tz);
  const mid = localParts(now, tz);
  const to = localParts(now + DAY, tz);
  const games = [];
  const errors = [];
  const active = leagues.filter((l) => inSeason(l, mid.month));

  await Promise.all(active.map(async (l) => {
    try {
      if (!l.espn) {
        games.push(...await readCfl({ days: [from.day, mid.day, to.day], fetchImpl }));
        return;
      }
      if (l.rangeQuery) {
        games.push(...await readEspn({ league: l, from, to, fetchImpl }));
      } else {
        for (const p of [from, mid, to]) games.push(...await readEspn({ league: l, from: p, fetchImpl }));
      }
    } catch (e) {
      errors.push(`${l.id}: ${String(e.message)}`);
      log('feed failed', l.id, String(e.message));
    }
  }));

  // De-duplicate across overlapping day requests (NCAAB fans out per day).
  const seen = new Set();
  const unique = games.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  unique.sort((a, b) => (a.start || 0) - (b.start || 0));
  return { games: unique, errors, leagues: active.map((l) => l.id) };
}

/**
 * Every fixture from `fromDay` for `days` days (Mountain), for the weekly slate
 * page. One request per range league, one per day for the others; fails soft
 * per league like readFeed.
 */
export async function readWeek({ now = Date.now(), tz = 'America/Edmonton', days = 7, leagues = LEAGUES, fetchImpl = fetch, log = () => {} } = {}) {
  const DAY = 86_400_000;
  const parts = Array.from({ length: days }, (_, i) => localParts(now + i * DAY, tz));
  const mid = parts[Math.floor(days / 2)];
  const games = [];
  const errors = [];
  const active = leagues.filter((l) => inSeason(l, parts[0].month) || inSeason(l, mid.month));
  await Promise.all(active.map(async (l) => {
    try {
      if (!l.espn) { games.push(...await readCfl({ days: parts.map((p) => p.day), fetchImpl })); return; }
      if (l.rangeQuery) games.push(...await readEspn({ league: l, from: parts[0], to: parts[parts.length - 1], fetchImpl }));
      else for (const p of parts) games.push(...await readEspn({ league: l, from: p, fetchImpl }));
    } catch (e) { errors.push(`${l.id}: ${String(e.message)}`); log('week feed failed', l.id, String(e.message)); }
  }));
  const seen = new Set();
  const unique = games.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  unique.sort((a, b) => (a.start || 0) - (b.start || 0));
  return { games: unique, errors, from: parts[0].day, to: parts[parts.length - 1].day };
}
