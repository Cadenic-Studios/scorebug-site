// Scorebug dispatch — event detection.
//
// PURE. No I/O, no clock reads; `now` is an argument. A game is not an event;
// a game crossing a threshold since the last tick is. Everything here runs
// against fabricated scoreboards in tests, because the branches that matter —
// a Saturday with 120 finals, a postponed game, a cricket scoreline — will not
// happen on demand in production.
//
// ── THE BEATS ───────────────────────────────────────────────────────────────
//
//   SLATE        07:00–09:00 Mountain. Today's five best fixtures on one card.
//   PREGAME      One game a day, an hour before it starts. The day's best.
//   FINAL        A game went final. Candidates only — rank.js chooses.
//   MORNING      07:00–10:00. Last night's best final, again, for the networks
//                where nobody is awake at 23:40 (Threads, Instagram).
//   ANNIVERSARY  11:00–14:00. A final from this date in a past season.
//   PRODUCT      Tue/Thu evenings. One verified sentence about the app.
//   WEEKAHEAD    Monday midday. The week's slate page.
//   WEEKNUMBERS  Sunday evening. What the community logged, once there is one.
//
// ── WHAT IS DELIBERATELY NOT A BEAT ─────────────────────────────────────────
//
//   Live scores. Posting "2-1 after two" is what ESPN does faster and better;
//   the product's moment is the final, when a fan can grade it.
//   News. Every headline is about a person, and a person waits for the owner.
//   A fan's review. The Bleachers are public, but quoting one on a brand
//   account needs that fan's opt-in, which the app does not collect yet.

import { LEAGUE_BY_ID, localParts } from './leagues.js';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** A final is worth posting for this long after the game STARTED. Beyond it the night is over. */
export const FINAL_HORIZON = 8 * HOUR;
export const PREGAME_MIN = 45 * 60_000;
export const PREGAME_MAX = 80 * 60_000;

/** The daily windows, in Mountain minutes-since-midnight [from, to). */
export const WINDOWS = Object.freeze({
  SLATE: [7 * 60, 9 * 60],
  MORNING: [7 * 60, 10 * 60],
  ANNIVERSARY: [11 * 60, 14 * 60],
  WEEKAHEAD: [12 * 60, 14 * 60],
  PRODUCT: [19 * 60, 21 * 60],
  WEEKNUMBERS: [20 * 60, 22 * 60],
});
const PRODUCT_DAYS = new Set(['Tue', 'Thu']);

/** ISO week key, Monday-based, in the engine's zone: "2026-W38". */
export function weekKey(ms, tz = 'America/Edmonton') {
  const p = localParts(ms, tz);
  const d = new Date(Date.UTC(p.year, p.month, p.date));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow + 3); // Thursday of this week decides the year
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week = 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

const inWindow = (minutes, [from, to]) => minutes >= from && minutes < to;

/**
 * Words in a record's headline or note that mean a person is at the centre of
 * the story. Any of them and the whole game waits for the owner — not because
 * the score is wrong, but because the score is not the story that night.
 */
export const SENSITIVE = /\b(injur|hospital|death|died|dies|passed away|tragic|tragedy|collapse[ds]?|cardiac|cpr|unconscious|unresponsive|stretcher|carted|ambulance|paramedic|concussion|head injury|protocol|acl|mcl|achilles|torn|tore|ruptur|fractur|broken (leg|arm|ankle|collarbone|hand|foot|jaw|nose|rib|wrist)|surgery|out for the season|season[- ]ending|arrest|investigat|suspend(ed|s|sion)|ban(ned)?|allegation|assault|abuse|racis|memorial|moment of silence|tribute|funeral|shooting|crash|fatal|emergency|ejected|ejection|brawl|altercation|doping|banned substance|lawsuit|charged with)/i;

/**
 * Any of these in what the feed said about the game, and the whole thing waits
 * for the owner — not because the score is wrong, but because the score is not
 * the story that night.
 *
 * Reads every text field, not just the first headline. ESPN puts the same
 * sentence in `notes[1]` as often as `notes[0]`, and the old check looked at
 * exactly two fields and missed the words a sports injury is actually
 * described with — "concussion", "carted off", "torn ACL", "out for the
 * season" were all absent, so "Brock Purdy returns from concussion protocol"
 * posted itself, unattended, under autopilot.
 */
export function isSensitive(game) {
  if (!game) return false;
  const hay = [game.headline, game.note, game.feedText, game.name, game.detail]
    .filter(Boolean).join(' \u00b7 ');
  return SENSITIVE.test(hay);
}

/**
 * Detect the candidates. `state` maps game id → { posted: {FINAL: iso, PREGAME: iso} };
 * `slots` is the fired-slot map; `recentFinals` are yesterday's FINAL ledger
 * entries (for MORNING); `anniversary` is an archive candidate, when the caller
 * fetched one; `community` is the weekly aggregate, when the gate passed.
 */
export function detect({ now, games = [], state = new Map(), slots = {}, settings = {}, tz = 'America/Edmonton', recentFinals = [], anniversary = null, community = null, weekAhead = null }) {
  const get = (id) => (state instanceof Map ? state.get(id) : state[id]) || { posted: {} };
  const fired = slots.fired || slots || {};
  const local = localParts(now, tz);
  const events = [];
  const day = local.day;

  // Games of the local day, and finals since last night.
  const todays = games.filter((g) => g.start != null && localParts(g.start, tz).day === day);

  /* ── SLATE ── */
  const slateKey = `slate:${day}`;
  if (!fired[slateKey] && inWindow(local.minutes, WINDOWS.SLATE)) {
    const upcoming = todays.filter((g) => g.state !== 'post' && !g.postponed && !g.canceled);
    if (upcoming.length) events.push({ type: 'SLATE', id: slateKey, slotKey: slateKey, at: now, games: upcoming, day });
  }

  /* ── PREGAME — candidates; rank.js keeps one per day ── */
  const pregameKey = `pregame:${day}`;
  if (!fired[pregameKey]) {
    for (const g of todays) {
      if (g.state !== 'pre' || g.postponed || g.canceled || g.start == null) continue;
      const dt = g.start - now;
      if (dt < PREGAME_MIN || dt > PREGAME_MAX) continue;
      if (get(g.id).posted && get(g.id).posted.PREGAME) continue;
      events.push({ type: 'PREGAME', id: `${g.id}-PREGAME`, slotKey: pregameKey, at: now, game: g, day });
    }
  }

  /* ── FINAL — candidates ── */
  for (const g of games) {
    if (!g.completed || g.start == null) continue;
    if (g.postponed || g.canceled) continue;
    const age = now - g.start;
    if (age < 0 || age > FINAL_HORIZON) continue;
    const posted = get(g.id).posted || {};
    if (posted.FINAL) continue;
    if (g.sport !== 'racing' && (g.home.score == null || g.away.score == null) && !(g.sport === 'cricket' && g.home.scoreText && g.away.scoreText)) continue;
    events.push({ type: 'FINAL', id: `${g.id}-FINAL`, at: now, game: g, day: localParts(g.start, tz).day, sensitive: isSensitive(g) });
  }

  /* ── MORNING — last night's best, for the networks that sleep ── */
  const morningKey = `morning:${day}`;
  if (!fired[morningKey] && inWindow(local.minutes, WINDOWS.MORNING) && recentFinals.length) {
    const best = [...recentFinals].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (best && best.game) events.push({ type: 'MORNING', id: morningKey, slotKey: morningKey, at: now, game: best.game, from: best.id, day, rank: best.score || 0 });
  }

  /* ── ANNIVERSARY ── */
  const annivKey = `anniv:${day}`;
  if (!fired[annivKey] && inWindow(local.minutes, WINDOWS.ANNIVERSARY) && anniversary && anniversary.game) {
    events.push({ type: 'ANNIVERSARY', id: annivKey, slotKey: annivKey, at: now, game: anniversary.game, years: anniversary.years, day });
  }

  /* ── PRODUCT ── */
  const productKey = `product:${day}`;
  if (!fired[productKey] && PRODUCT_DAYS.has(local.weekday) && inWindow(local.minutes, WINDOWS.PRODUCT) && settings.productPosts !== false) {
    events.push({ type: 'PRODUCT', id: productKey, slotKey: productKey, at: now, day });
  }

  /* ── WEEKAHEAD ── */
  const wk = weekKey(now, tz);
  const weekKey_ = `weekahead:${wk}`;
  if (!fired[weekKey_] && local.weekday === 'Mon' && inWindow(local.minutes, WINDOWS.WEEKAHEAD) && weekAhead) {
    events.push({ type: 'WEEKAHEAD', id: weekKey_, slotKey: weekKey_, at: now, week: weekAhead, day });
  }

  /* ── WEEKNUMBERS ── */
  const numbersKey = `weeknumbers:${wk}`;
  if (!fired[numbersKey] && local.weekday === 'Sun' && inWindow(local.minutes, WINDOWS.WEEKNUMBERS) && community && community.ok) {
    events.push({ type: 'WEEKNUMBERS', id: numbersKey, slotKey: numbersKey, at: now, community, day });
  }

  return events;
}

/** Stable ledger id. */
export function eventId(ev) { return ev.id; }

/**
 * What may never go out without a person. In sports that is anything where the
 * story is a person rather than a score: a game called off, a record whose
 * headline is an injury or worse, a racing event (the winner is a named driver
 * and the template would have to say so).
 */
export function needsHuman(ev) {
  const g = ev.game;
  if (g && (g.postponed || g.canceled || g.suspended)) return true;
  if (ev.sensitive || isSensitive(g)) return true;
  if (g && g.sport === 'racing' && ev.type !== 'SLATE') return true;
  if (ev.type === 'SLATE' && (ev.games || []).some(isSensitive)) return true;
  return false;
}

/** Which events autopilot may send. Everything here is a score, a date, a fixture or our own number. */
export function isRoutine(ev) {
  if (needsHuman(ev)) return false;
  return ['SLATE', 'PREGAME', 'FINAL', 'MORNING', 'ANNIVERSARY', 'PRODUCT', 'WEEKAHEAD', 'WEEKNUMBERS'].includes(ev.type);
}

/** A one-line title for the ledger and the digest: "Broncos at Chiefs · NFL · Final/OT". */
export function titleOf(ev) {
  const g = ev.game;
  const league = g ? (LEAGUE_BY_ID[g.league] ? LEAGUE_BY_ID[g.league].name : g.league) : '';
  if (ev.type === 'SLATE') return `The Slate · ${ev.day} · ${(ev.games || []).length} games`;
  if (ev.type === 'PRODUCT') return `Product line · ${ev.day}`;
  if (ev.type === 'WEEKAHEAD') return `Week ahead · ${ev.week && ev.week.range ? ev.week.range : ev.id}`;
  if (ev.type === 'WEEKNUMBERS') return `Week in numbers · ${ev.id.split(':')[1] || ''}`;
  if (!g) return ev.type;
  const who = g.sport === 'racing' ? (g.name || 'race') : `${g.away.short || g.away.abbr} at ${g.home.short || g.home.abbr}`;
  const tail = ev.type === 'FINAL' || ev.type === 'MORNING' ? ` · ${g.detail || 'Final'}` : ev.type === 'ANNIVERSARY' ? ` · ${ev.years} years ago` : '';
  return `${who} · ${league}${tail}`;
}
