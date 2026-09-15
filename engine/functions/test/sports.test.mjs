// Scorebug engine — the sports tests. Everything Delta-V never had to think
// about: a Saturday with a hundred and twenty finals, a postponed game, a
// cricket scoreline, a record that names a player, a draft that mentions odds,
// and a site that says the app is not on Android yet.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEAGUES, LEAGUE_BY_ID, inSeason, localParts, clock, longDate, seasonLabel, SPORT_SHAPE } from '../dispatch/leagues.js';
import { normalizeEspn, normalizeTsdb, scoreboardUrl, readFeed, readWeek } from '../dispatch/feed.js';
import { detect, needsHuman, isRoutine, titleOf, weekKey, isSensitive, WINDOWS } from '../dispatch/events.js';
import { features, finalScore, pregameScore, select, slatePick, winShare, comebackIn, FLOORS, NETWORKS_FOR } from '../dispatch/rank.js';
import { draft, lint, sourcesFor, compose, scoreline, endingClause, featureClause, tagged, getUrl, logUrl, LIMITS, BETTING, altFor } from '../dispatch/draft.js';
import { FALLBACK_FACTS, productLines, platformLine, fetchFacts } from '../dispatch/facts.js';
import { tagsFor, TAG_BUDGET } from '../dispatch/tags.js';
import { cardFor, gameCard, slateCard } from '../dispatch/cards.js';
import { memoryStore, loadSettings, DEFAULT_SETTINGS } from '../dispatch/store.js';
import { tick, routeFor, todaysBudget, sendApproved, markSlot, SLOTS, EV, GM } from '../dispatch/run.js';
import { findAnniversary, yearsToTry, leaguesForDay } from '../dispatch/archive.js';
import { supabaseClient, weekInNumbers, communityFor } from '../dispatch/supabase.js';
import { buildWeek, contentTick, assembleNewsletter } from '../dispatch/content.js';
import { buildDigest } from '../dispatch/digest.js';
import { PLAN, status as budgetStatus, HARD_RULES } from '../dispatch/budget.js';
import { policyFor, EXPERIMENTS, tally, findings } from '../dispatch/optimize.js';
import { unsubscribeToken, findOpportunities } from '../dispatch/channels.js';

const TZ = 'America/Edmonton';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Saturday 19 September 2026, 20:50 Mountain (02:50Z Sunday). NHL preseason opener night in Edmonton. */
const SAT_NIGHT = Date.parse('2026-09-20T02:50:00Z');
/** Sunday 20 September 2026, 07:30 Mountain. */
const SUN_MORNING = Date.parse('2026-09-20T13:30:00Z');
/** Tuesday 15 September 2026, 19:40 Mountain. */
const TUE_EVENING = Date.parse('2026-09-16T01:40:00Z');
/** Monday 14 September 2026, 12:30 Mountain. */
const MON_NOON = Date.parse('2026-09-14T18:30:00Z');

const side = (abbr, name, short, score, extra = {}) => ({ espnId: null, abbr, name, short, location: null, nickname: short, color: null, score, scoreText: score == null ? null : String(score), record: null, winner: null, rank: null, linescores: [], ...extra });

/** A game, with sensible defaults, one line to override. */
function game(o = {}) {
  const league = o.league || 'NHL';
  const l = LEAGUE_BY_ID[league];
  return {
    id: `${league}-${o.n || 1}`, espnId: String(o.n || 1), league, sport: l.sport, name: null, shortName: null,
    start: o.start ?? SAT_NIGHT - 3 * HOUR, state: o.state || 'post', completed: o.completed ?? (o.state ? o.state === 'post' : true),
    statusName: 'STATUS_FINAL', detail: o.detail || 'Final', postponed: !!o.postponed, canceled: !!o.canceled, suspended: !!o.suspended,
    period: o.period ?? 3, clock: null, seasonType: o.seasonType ?? 2, seasonYear: 2027, week: o.week ?? null, note: o.note || null, headline: o.headline || null,
    neutral: false, venue: o.venue || 'Rogers Place', city: 'Edmonton', broadcast: o.broadcast || null,
    home: o.home || side('EDM', 'Edmonton Oilers', 'Oilers', 4, { record: '5-2-0' }),
    away: o.away || side('CGY', 'Calgary Flames', 'Flames', 3, { record: '4-3-0' }),
    entrants: null, people: o.people || [], source: 'espn',
  };
}

const feedOf = (games) => async () => ({ games, errors: [], leagues: [...new Set(games.map((g) => g.league))] });
const noFacts = async () => ({ ...FALLBACK_FACTS });
const settingsDoc = (extra = {}) => ({ enabled: true, dryRun: true, ...extra });

/* ─────────────────────────────────────────────────────────────── leagues */

test('the registry mirrors the app: nineteen leagues, CFL off ESPN, NCAAB needs groups=50 and one request per day', () => {
  assert.equal(LEAGUES.length, 19);
  assert.equal(LEAGUE_BY_ID.CFL.espn, false);
  assert.match(scoreboardUrl('NCAAB', { year: 2026, month: 0, date: 17 }), /groups=50/);
  assert.match(scoreboardUrl('NCAAB', { year: 2026, month: 0, date: 12 }, { year: 2026, month: 0, date: 18 }), /dates=20260112&/, 'NCAAB never gets a range');
  assert.match(scoreboardUrl('NHL', { year: 2026, month: 0, date: 12 }, { year: 2026, month: 0, date: 18 }), /dates=20260112-20260118/);
  assert.match(scoreboardUrl('IPL', { year: 2026, month: 3, date: 1 }), /cricket\/8048\//, 'cricket is addressed by a numeric id');
});

test('season windows wrap the new year and are padded wide', () => {
  assert.ok(inSeason('NHL', 8) && inSeason('NHL', 0) && inSeason('NHL', 5) && !inSeason('NHL', 6));
  assert.ok(inSeason('NFL', 6) && inSeason('NFL', 1) && !inSeason('NFL', 3));
  assert.ok(inSeason('IPL', 3) && !inSeason('IPL', 8));
});

test('local time is a Mountain day, and a final at 23:40 belongs to tonight', () => {
  const p = localParts(SAT_NIGHT, TZ);
  assert.equal(p.day, '2026-09-19');
  assert.equal(p.weekday, 'Sat');
  assert.equal(p.hour, 20);
  assert.equal(clock(Date.parse('2026-09-15T00:15:00Z'), TZ), '6:15pm');
  assert.equal(clock(Date.parse('2026-09-19T11:30:00Z'), TZ), '5:30am');
  assert.equal(longDate(Date.parse('2016-09-18T20:00:00Z'), TZ), '18 September 2016');
  assert.equal(seasonLabel('NHL', 2027), '2026-27', "ESPN's season.year is the END year of a split season");
  assert.equal(seasonLabel('NFL', 2026), '2026');
  assert.equal(weekKey(SAT_NIGHT, TZ), '2026-W38');
  assert.equal(weekKey(MON_NOON, TZ), '2026-W38');
});

/* ────────────────────────────────────────────────────────────────── feed */

const ESPN_EVENT = {
  id: '401559', date: '2026-09-20T00:00Z', name: 'Winnipeg Jets at Edmonton Oilers', shortName: 'WPG @ EDM',
  season: { year: 2027, type: 1 },
  competitions: [{
    id: '401559', date: '2026-09-20T00:00Z', neutralSite: false,
    status: { type: { name: 'STATUS_FINAL', state: 'post', completed: true, detail: 'Final/OT', shortDetail: 'Final/OT' }, period: 4, displayClock: '0:00' },
    competitors: [
      { homeAway: 'home', winner: true, score: '4', team: { id: '6', abbreviation: 'EDM', displayName: 'Edmonton Oilers', shortDisplayName: 'Oilers', name: 'Oilers', location: 'Edmonton', color: 'FF4C00' }, records: [{ summary: '0-0-0' }], linescores: [{ value: 1 }, { value: 1 }, { value: 1 }, { value: 1 }] },
      { homeAway: 'away', winner: false, score: '3', team: { id: '28', abbreviation: 'WPG', displayName: 'Winnipeg Jets', shortDisplayName: 'Jets', name: 'Jets', location: 'Winnipeg' }, records: [{ summary: '0-0-0' }], linescores: [{ value: 2 }, { value: 1 }, { value: 0 }, { value: 0 }] },
    ],
    venue: { fullName: 'Rogers Place', address: { city: 'Edmonton', state: 'AB' } },
    broadcasts: [{ names: ['SN'] }],
    leaders: [{ name: 'points', leaders: [{ athlete: { displayName: 'Connor McDavid' } }] }],
  }],
};

test('an ESPN event normalises to the engine shape and names its people', () => {
  const g = normalizeEspn(ESPN_EVENT, 'NHL');
  assert.equal(g.id, 'NHL-401559');
  assert.equal(g.state, 'post');
  assert.equal(g.completed, true);
  assert.equal(g.detail, 'Final/OT');
  assert.equal(g.home.abbr, 'EDM');
  assert.equal(g.home.score, 4);
  assert.equal(g.away.score, 3);
  assert.deepEqual(g.home.linescores, [1, 1, 1, 1]);
  assert.equal(g.seasonType, 1);
  assert.equal(g.broadcast, 'SN');
  assert.deepEqual(g.people, ['Connor McDavid']);
  assert.equal(normalizeEspn({ id: 'x', competitions: [{ competitors: [] }] }, 'NHL'), null, 'no competitors, no game');
});

test('a cricket scoreline stays a string and a race has entrants, not sides', () => {
  const c = normalizeEspn({ id: '9', date: '2026-04-01T14:00Z', competitions: [{ status: { type: { state: 'post', completed: true, detail: 'Result' } }, competitors: [
    { homeAway: 'home', winner: true, score: { displayValue: '185/6 (20 ov)' }, team: { id: '1', abbreviation: 'MI', displayName: 'Mumbai Indians', shortDisplayName: 'Mumbai' } },
    { homeAway: 'away', winner: false, score: { displayValue: '180/8 (20 ov)' }, team: { id: '2', abbreviation: 'CSK', displayName: 'Chennai Super Kings', shortDisplayName: 'Chennai' } },
  ] }] }, 'IPL');
  assert.equal(c.home.score, null, 'a scoreline string is not a number');
  assert.equal(c.home.scoreText, '185/6 (20 ov)');
  assert.equal(scoreline(c), 'Mumbai 185/6 (20 ov), Chennai 180/8 (20 ov)');
  const r = normalizeEspn({ id: '7', date: '2026-09-13T13:00Z', name: 'Madrid Grand Prix', competitions: [{ status: { type: { state: 'pre' } }, competitors: [{ athlete: { displayName: 'A Driver' } }, { athlete: { displayName: 'B Driver' } }] }] }, 'F1');
  assert.equal(r.entrants, 2);
  assert.equal(r.home, null);
  assert.deepEqual(r.people, ['A Driver', 'B Driver']);
});

test('TheSportsDB CFL events normalise to the same shape, with abbreviations the shields know', () => {
  const g = normalizeTsdb({ idEvent: '123', strEvent: 'Saskatchewan Roughriders vs Winnipeg Blue Bombers', strHomeTeam: 'Saskatchewan Roughriders', strAwayTeam: 'Winnipeg Blue Bombers', intHomeScore: '27', intAwayScore: '24', strStatus: 'Match Finished', strTimestamp: '2026-09-19T23:00:00', strVenue: 'Mosaic Stadium', intRound: '14', strSeason: '2026' });
  assert.equal(g.league, 'CFL');
  assert.equal(g.home.abbr, 'SSK');
  assert.equal(g.away.abbr, 'WPG');
  assert.equal(g.completed, true);
  assert.equal(g.home.winner, true);
  assert.equal(scoreline(g), 'Roughriders 27, Bombers 24');
});

test('the feed fails soft per league and de-duplicates across day requests', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/nhl/')) return { ok: true, text: async () => JSON.stringify({ events: [ESPN_EVENT] }) };
    if (url.includes('/nfl/')) throw new Error('boom');
    if (url.includes('mens-college-basketball')) return { ok: true, text: async () => JSON.stringify({ events: [{ ...ESPN_EVENT, id: '77' }] }) };
    if (url.includes('thesportsdb')) return { ok: true, text: async () => JSON.stringify({ events: [] }) };
    return { ok: true, text: async () => JSON.stringify({ events: [] }) };
  };
  const leagues = [LEAGUE_BY_ID.NHL, LEAGUE_BY_ID.NFL, LEAGUE_BY_ID.NCAAB, LEAGUE_BY_ID.CFL, LEAGUE_BY_ID.IPL];
  const { games, errors, leagues: active } = await readFeed({ now: Date.parse('2026-11-14T20:00:00Z'), leagues, fetchImpl });
  assert.ok(errors.some((e) => e.startsWith('NFL')), 'the league that threw is named');
  assert.equal(games.filter((g) => g.league === 'NHL').length, 1);
  assert.equal(games.filter((g) => g.league === 'NCAAB').length, 1, 'three day requests, one game');
  assert.equal(calls.filter((u) => u.includes('mens-college-basketball')).length, 3, 'NCAAB fans out per day');
  assert.ok(!active.includes('IPL'), 'November is not cricket season, so no request');
  assert.ok(calls.some((u) => u.includes('thesportsdb')), 'CFL goes to TheSportsDB');
});

/* ───────────────────────────────────────────────────────────────── events */

test('a final is a candidate once, within eight hours of the start, and never after it was posted', () => {
  const g = game();
  const first = detect({ now: SAT_NIGHT, games: [g], tz: TZ });
  assert.ok(first.some((e) => e.type === 'FINAL' && e.id === 'NHL-1-FINAL'));
  const state = new Map([[g.id, { posted: { FINAL: 'x' } }]]);
  assert.ok(!detect({ now: SAT_NIGHT, games: [g], state, tz: TZ }).some((e) => e.type === 'FINAL'));
  const old = game({ start: SAT_NIGHT - 9 * HOUR });
  assert.ok(!detect({ now: SAT_NIGHT, games: [old], tz: TZ }).some((e) => e.type === 'FINAL'), 'the night is over');
  const noScore = game({ home: side('EDM', 'Edmonton Oilers', 'Oilers', null), away: side('CGY', 'Calgary Flames', 'Flames', null) });
  assert.ok(!detect({ now: SAT_NIGHT, games: [noScore], tz: TZ }).some((e) => e.type === 'FINAL'), 'no score, no final');
});

test('a postponed game, a sensitive headline and a race all wait for a person', () => {
  assert.equal(needsHuman({ type: 'FINAL', game: game({ postponed: true }) }), true);
  assert.equal(needsHuman({ type: 'FINAL', game: game({ headline: 'Forward stretchered off after collision' }) }), true);
  assert.equal(isSensitive(game({ note: 'Moment of silence before the game' })), true);
  assert.equal(needsHuman({ type: 'FINAL', game: game({ league: 'F1', home: null, away: null }) }), true);
  assert.equal(needsHuman({ type: 'FINAL', game: game() }), false);
  assert.equal(isRoutine({ type: 'FINAL', game: game() }), true);
  assert.equal(isRoutine({ type: 'SLATE', games: [game(), game({ headline: 'Player hospitalised' })] }), false);
  assert.equal(titleOf({ type: 'FINAL', game: game({ detail: 'Final/OT' }) }), 'Flames at Oilers · NHL · Final/OT');
});

test('the slate fires once, in its window, from the day\'s unplayed games', () => {
  const morning = Date.parse('2026-09-19T13:30:00Z'); // 07:30 MT Saturday
  const later = game({ n: 2, state: 'pre', completed: false, start: morning + 10 * HOUR });
  const done = game({ n: 3, start: morning - 12 * HOUR }); // last night's final, not on today's slate
  const evs = detect({ now: morning, games: [later, done], tz: TZ });
  const slate = evs.find((e) => e.type === 'SLATE');
  assert.ok(slate);
  assert.equal(slate.games.length, 1);
  assert.equal(slate.slotKey, 'slate:2026-09-19');
  assert.ok(!detect({ now: morning, games: [later], slots: { fired: { 'slate:2026-09-19': 'x' } }, tz: TZ }).some((e) => e.type === 'SLATE'), 'fired slots do not fire twice');
  assert.ok(!detect({ now: morning + 3 * HOUR, games: [later], tz: TZ }).some((e) => e.type === 'SLATE'), 'outside the window it waits for tomorrow');
});

test('pregame fires an hour out, product fires Tuesday evening, numbers only when the gate passed', () => {
  const g = game({ state: 'pre', completed: false, start: SAT_NIGHT + 60 * 60_000 });
  assert.ok(detect({ now: SAT_NIGHT, games: [g], tz: TZ }).some((e) => e.type === 'PREGAME'));
  assert.ok(!detect({ now: SAT_NIGHT - 2 * HOUR, games: [g], tz: TZ }).some((e) => e.type === 'PREGAME'), 'three hours out is too early');
  assert.ok(detect({ now: TUE_EVENING, games: [], tz: TZ }).some((e) => e.type === 'PRODUCT'));
  assert.ok(!detect({ now: TUE_EVENING + DAY, games: [], tz: TZ }).some((e) => e.type === 'PRODUCT'), 'Wednesday is not a product day');
  const sunEvening = Date.parse('2026-09-21T02:30:00Z'); // 20:30 MT Sunday
  assert.ok(!detect({ now: sunEvening, games: [], tz: TZ, community: { ok: false } }).some((e) => e.type === 'WEEKNUMBERS'));
  assert.ok(detect({ now: sunEvening, games: [], tz: TZ, community: { ok: true, logs: 40, leagues: 4 } }).some((e) => e.type === 'WEEKNUMBERS'));
  assert.ok(detect({ now: MON_NOON, games: [], tz: TZ, weekAhead: { slug: '2026-W38', count: 300, leagues: 12, range: 'x' } }).some((e) => e.type === 'WEEKAHEAD'));
  assert.ok(detect({ now: SUN_MORNING, games: [], tz: TZ, recentFinals: [{ id: 'a', game: game(), score: 7 }] }).some((e) => e.type === 'MORNING'));
});

/* ───────────────────────────────────────────────────────────────── ranker */

test('features read the record: tight, overtime, comeback, upset, rivalry, preseason', () => {
  const f = features(game({ detail: 'Final/OT' }), { tz: TZ });
  assert.ok(f.tight && f.ot && f.rivalry && f.canadian && !f.preseason, JSON.stringify(f));
  const cb = game({ home: side('EDM', 'Edmonton Oilers', 'Oilers', 4, { linescores: [0, 1, 3] }), away: side('CGY', 'Calgary Flames', 'Flames', 3, { linescores: [2, 1, 0] }) });
  assert.equal(comebackIn(cb, 2), true, 'down 2-0 after one, won');
  assert.equal(features(cb).comeback, true);
  const up = game({ league: 'NFL', home: side('TEN', 'Tennessee Titans', 'Titans', 16, { record: '2-8' }), away: side('DET', 'Detroit Lions', 'Lions', 15, { record: '8-2' }) });
  assert.equal(features(up).upset, true);
  assert.equal(winShare('12-3-1'), 0.8);
  assert.equal(winShare('1-2'), null, 'too few games to mean anything');
  assert.equal(features(game({ seasonType: 1 })).preseason, true);
  const hoops = game({ league: 'NBA', home: side('TOR', 'Toronto Raptors', 'Raptors', 118), away: side('BOS', 'Boston Celtics', 'Celtics', 115) });
  assert.equal(features(hoops).tight, true, 'three points is one possession');
  assert.equal(features(hoops).canadian, true);
});

test('the score orders the night: overtime rivalry over a routine win over a preseason blowout', () => {
  const ot = finalScore(game({ detail: 'Final/OT' }), { tz: TZ }).score;
  const routine = finalScore(game({ home: side('EDM', 'Edmonton Oilers', 'Oilers', 5), away: side('SEA', 'Seattle Kraken', 'Kraken', 1) }), { tz: TZ }).score;
  const pre = finalScore(game({ seasonType: 1, home: side('DAL', 'Dallas Stars', 'Stars', 6), away: side('STL', 'St. Louis Blues', 'Blues', 0) }), { tz: TZ }).score;
  assert.ok(ot > routine && routine > pre, `${ot} > ${routine} > ${pre}`);
  assert.ok(pre < FLOORS.minFinal, 'a preseason blowout never posts');
});

test('a Saturday with 120 finals posts at most the caps, one final per tick, two per league, and never a dull one', () => {
  const events = [];
  for (let i = 0; i < 120; i += 1) {
    const league = ['NHL', 'NCAAF', 'MLB', 'EPL', 'NBA'][i % 5];
    const l = LEAGUE_BY_ID[league];
    const ot = i % 7 === 0;
    const margin = i % 4 === 0 ? 1 : 9;
    const g = game({ n: 100 + i, league, detail: ot ? 'Final/OT' : 'Final', home: side(`H${i}`, `Home ${i}`, `Home${i}`, 10 + margin), away: side(`A${i}`, `Away ${i}`, `Away${i}`, 10) });
    g.sport = l.sport;
    events.push({ type: 'FINAL', id: `${g.id}-FINAL`, at: SAT_NIGHT, game: g, day: '2026-09-19' });
  }
  // One tick chooses exactly one final.
  const one = select({ events, settings: DEFAULT_SETTINGS, now: SAT_NIGHT, tz: TZ });
  assert.equal(one.filter((e) => e.type === 'FINAL').length, 1);
  assert.ok(one[0].score >= FLOORS.minFinal);
  // Simulate the night: tick every ten minutes for six hours.
  const sentToday = {}, lastSentAt = {}, leagueToday = {};
  let xLinked = false;
  const posted = [];
  for (let t = 0; t < 36; t += 1) {
    const now = SAT_NIGHT + t * 10 * 60_000;
    const remaining = events.filter((e) => !posted.includes(e.id));
    const out = select({ events: remaining, settings: DEFAULT_SETTINGS, now, tz: TZ, sentToday, lastSentAt, leagueToday, xLinkedToday: xLinked });
    for (const e of out) {
      posted.push(e.id);
      for (const n of e.networks) { sentToday[n] = (sentToday[n] || 0) + 1; lastSentAt[n] = now; }
      leagueToday[e.game.league] = (leagueToday[e.game.league] || 0) + 1;
      if (e.link) xLinked = true;
    }
  }
  assert.ok(posted.length <= DEFAULT_SETTINGS.maxPerDay.bluesky, `posted ${posted.length}`);
  assert.ok(Object.values(leagueToday).every((n) => n <= 2), JSON.stringify(leagueToday));
  assert.ok((sentToday.x || 0) <= DEFAULT_SETTINGS.maxPerDay.x);
  assert.ok(!('threads' in sentToday), 'finals never go to Threads at night — the morning beat does that');
});

test('the gap between posts is kept per network, and the slate is exempt', () => {
  const g = game({ detail: 'Final/OT' });
  const events = [{ type: 'FINAL', id: 'NHL-1-FINAL', at: SAT_NIGHT, game: g }, { type: 'SLATE', id: 'slate:x', slotKey: 'slate:x', at: SAT_NIGHT, games: [g] }];
  const out = select({ events, settings: DEFAULT_SETTINGS, now: SAT_NIGHT, tz: TZ, lastSentAt: { bluesky: SAT_NIGHT - 5 * 60_000, x: SAT_NIGHT - 5 * 60_000, mastodon: SAT_NIGHT - 5 * 60_000 } });
  const slate = out.find((e) => e.type === 'SLATE');
  assert.ok(slate && slate.networks.includes('bluesky'), 'the slate ignores the gap');
  assert.ok(!out.some((e) => e.type === 'FINAL'), 'the final waits for the next tick');
});

test('one pregame a day, the best one, and one linked X post a day', () => {
  const a = game({ n: 1, state: 'pre', completed: false, start: SAT_NIGHT + HOUR, seasonType: 1 });
  const b = game({ n: 2, state: 'pre', completed: false, start: SAT_NIGHT + HOUR, league: 'NFL', home: side('KC', 'Kansas City Chiefs', 'Chiefs', null), away: side('BUF', 'Buffalo Bills', 'Bills', null), broadcast: 'NBC' });
  b.sport = 'football';
  const out = select({ events: [{ type: 'PREGAME', id: 'a', game: a }, { type: 'PREGAME', id: 'b', game: b }], settings: DEFAULT_SETTINGS, now: SAT_NIGHT, tz: TZ });
  assert.equal(out.filter((e) => e.type === 'PREGAME').length, 1);
  assert.equal(out[0].id, 'b', 'the rivalry on national television beats a preseason game');
  const hot = { type: 'FINAL', id: 'f', game: game({ detail: 'Final/OT', seasonType: 3 }) };
  assert.equal(select({ events: [hot], settings: DEFAULT_SETTINGS, now: SAT_NIGHT, tz: TZ })[0].link, true, 'a playoff overtime rivalry earns the link');
  assert.equal(select({ events: [hot], settings: DEFAULT_SETTINGS, now: SAT_NIGHT, tz: TZ, xLinkedToday: true })[0].link, false, 'but only once a day');
});

/* ────────────────────────────────────────────────────────────────── draft */

function lintAll(texts, ev) {
  const src = sourcesFor(ev, { now: SAT_NIGHT, tz: TZ });
  const out = {};
  for (const [net, t] of Object.entries(texts)) {
    const p = lint(t, { sources: src, network: net === 'xReply' ? 'x' : net, people: ev.game ? ev.game.people : [] });
    if (p.length) out[net] = p;
  }
  return out;
}

test('a final drafts as a scoreline, one clause and an invitation; every network passes the linter; X carries no link', () => {
  const ev = { type: 'FINAL', id: 'x', game: game({ detail: 'Final/OT', people: ['Connor McDavid'] }), networks: ['bluesky', 'mastodon', 'x'], link: true };
  ev.features = features(ev.game, { tz: TZ });
  const texts = draft(ev, { now: SAT_NIGHT, tz: TZ, invite: 'question' });
  assert.match(texts.bluesky, /^Oilers 4, Flames 3\. Overtime\./);
  assert.match(texts.bluesky, /One goal\./);
  assert.match(texts.bluesky, /What was it out of 5\.0\?/);
  // c=final-q, not c=final: the campaign carries the invite variant so that
  // `tester_signups.source` can tell which closing line actually brings people
  // to the waitlist, rather than which one collects likes.
  assert.match(texts.bluesky, /getscorebug\.app\/r\/the-log\?s=bluesky&c=final-q&gameId=1/);
  assert.match(texts.bluesky, /#LetsGoOilers #Flames/);
  assert.ok(!/https?:/.test(texts.x), 'X gets no link in the body');
  assert.match(texts.xReply, /s=x&c=final/);
  assert.equal(texts.threads, undefined, 'a final does not go to Threads at night');
  assert.deepEqual(lintAll(texts, ev), {});
  for (const [n, t] of Object.entries(texts)) assert.ok(t.length <= LIMITS[n === 'xReply' ? 'x' : n], `${n} within its limit`);
});

test('soccer draws, penalties, extra innings and a comeback are worded from the record', () => {
  const draw = game({ league: 'EPL', period: 2, home: side('BHA', 'Brighton', 'Brighton', 1), away: side('ARS', 'Arsenal', 'Arsenal', 1) }); draw.sport = 'soccer';
  assert.equal(scoreline(draw), 'Brighton 1, Arsenal 1');
  assert.equal(endingClause(draw), 'A draw.');
  const pens = game({ league: 'UCL', detail: 'FT-Pens', period: 4, home: side('RMA', 'Real Madrid', 'Real Madrid', 2), away: side('BAY', 'Bayern', 'Bayern', 2) }); pens.sport = 'soccer';
  assert.equal(endingClause(pens), 'On penalties.');
  const extras = game({ league: 'MLB', detail: 'Final/11', period: 11, home: side('TOR', 'Toronto Blue Jays', 'Blue Jays', 5), away: side('NYY', 'New York Yankees', 'Yankees', 4) }); extras.sport = 'baseball';
  assert.equal(endingClause(extras), '11 innings.');
  const cb = game({ home: side('EDM', 'Edmonton Oilers', 'Oilers', 4, { linescores: [0, 1, 3] }), away: side('CGY', 'Calgary Flames', 'Flames', 3, { linescores: [2, 1, 0] }) });
  assert.equal(featureClause(cb, features(cb)), 'One goal.', 'the tightest fact wins the one clause');
  const cb2 = game({ home: side('EDM', 'Edmonton Oilers', 'Oilers', 6, { linescores: [0, 1, 5] }), away: side('CGY', 'Calgary Flames', 'Flames', 3, { linescores: [3, 0, 0] }) });
  assert.equal(featureClause(cb2, features(cb2)), 'Oilers trailed after the second.');
  const twoOt = game({ league: 'NBA', detail: 'Final/2OT', home: side('TOR', 'Toronto Raptors', 'Raptors', 130), away: side('BOS', 'Boston Celtics', 'Celtics', 128) }); twoOt.sport = 'basketball';
  assert.equal(endingClause(twoOt), 'Two overtimes.');
});

test('the linter refuses a person, a betting word, a price shape, an exclamation mark, an emoji and a foreign link', () => {
  const src = 'Oilers 4 Flames 3';
  assert.deepEqual(lint('Oilers 4, Flames 3. McDavid with the winner.', { sources: src, people: ['Connor McDavid'] }), ['names a person: Connor McDavid']);
  assert.ok(lint('Oilers 4, Flames 3. Connor McDavid scored.', { sources: src, people: ['Connor McDavid'] }).includes('names a person: Connor McDavid'));
  assert.ok(lint('Oilers 4, Flames 3. The spread was 2.', { sources: `${src} 2` }).some((p) => p.startsWith('betting language')));
  assert.ok(lint('Oilers 4, Flames 3. They were +150.', { sources: `${src} 150` }).some((p) => p.startsWith('betting language')));
  assert.ok(lint('Best bet of the night', { sources: '' }).some((p) => p.startsWith('betting language')));
  assert.ok(lint('Oilers win!', { sources: src }).includes('exclamation mark'));
  assert.ok(lint('Oilers 4, Flames 3 🏒', { sources: src }).includes('emoji'));
  assert.ok(lint('Oilers 4, Flames 3. https://fanatics.com/x', { sources: src }).some((p) => p.startsWith('foreign link')));
  assert.ok(lint('Oilers 4, Flames 3. An instant classic.', { sources: src }).includes('hype word'));
  assert.ok(lint('Oilers 4, Flames 3, 52 shots.', { sources: src }).includes('unsourced number 52'));
  assert.deepEqual(lint('Oilers 4, Flames 3. Grade it out of 5.0 and keep it.', { sources: src }), [], 'the verified invitation carries its own number');
  assert.ok(lint('A B C #One #Two #Three', { sources: '', network: 'bluesky' }).some((p) => p.startsWith('too many hashtags')));
  assert.ok(BETTING.test('parlay') && BETTING.test('over/under') && !BETTING.test('better late than never'));
});

test('every product line passes the linter on every network, and the platform claim follows the stage', () => {
  for (const line of productLines(FALLBACK_FACTS)) {
    for (const net of ['bluesky', 'mastodon', 'threads', 'x', 'instagram']) assert.deepEqual(lint(line.text, { sources: '', network: net }), [], `${line.id} on ${net}`);
  }
  assert.equal(platformLine({ stage: 'testing' }), 'Free on the web. Android early access is open.');
  assert.equal(platformLine({ stage: 'live' }), 'Free on the web and on Google Play.');
  assert.ok(!productLines({ ...FALLBACK_FACTS, stage: 'testing' }).some((l) => /Google Play/.test(l.text)), 'a closed test never advertises Play');
});

test('the facts come from the site, and an unreachable site means the smaller claim', async () => {
  const live = await fetchFacts({ key: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ stage: 'live', platforms: 'Android, Web', leagueCount: 19 }) }) });
  assert.equal(live.stage, 'live');
  assert.equal(live.fallback, false);
  const down = await fetchFacts({ key: 'k', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(down.stage, 'testing');
  assert.equal(down.fallback, true);
  const noKey = await fetchFacts({ key: '' });
  assert.equal(noKey.fallback, true);
});

test('links are short, tagged server-side, and only ever point at the site', () => {
  assert.equal(tagged('the-slate', 'bluesky', 'slate'), 'https://getscorebug.app/r/the-slate?s=bluesky&c=slate');
  assert.equal(getUrl('x', 'archive'), 'https://getscorebug.app/get?s=x&c=archive');
  assert.match(logUrl(game(), 'threads', 'final'), /\/r\/the-log\?s=threads&c=final&gameId=1&gameTime=/);
  assert.ok(!/gameId/.test(logUrl({ ...game(), source: 'tsdb' }, 'threads', 'final')), 'a TheSportsDB id is not an app game id');
  assert.ok(getUrl('bluesky', 'vault').length < 50, 'short enough to leave the sentence room');
});

test('the slate, the anniversary, the product line, the week ahead and the numbers all draft and lint clean', () => {
  const g1 = game({ n: 1, state: 'pre', completed: false, start: Date.parse('2026-09-14T19:00:00Z'), league: 'EPL', home: side('LEE', 'Leeds United', 'Leeds', null), away: side('NEW', 'Newcastle United', 'Newcastle', null) }); g1.sport = 'soccer';
  const g2 = game({ n: 2, state: 'pre', completed: false, start: Date.parse('2026-09-15T00:15:00Z'), league: 'NFL', home: side('KC', 'Kansas City Chiefs', 'Chiefs', null), away: side('DEN', 'Denver Broncos', 'Broncos', null), broadcast: 'ESPN', week: 1 }); g2.sport = 'football';
  const slate = { type: 'SLATE', id: 'slate:2026-09-14', slotKey: 'slate:2026-09-14', games: [g1, g2], pick: [g1, g2], day: '2026-09-14', networks: NETWORKS_FOR.SLATE };
  const st = draft(slate, { now: Date.parse('2026-09-14T13:30:00Z'), tz: TZ });
  assert.match(st.bluesky, /^Monday on The Slate\. Newcastle at Leeds 1:00pm, Broncos at Chiefs 6:15pm MT\./);
  assert.match(st.bluesky, /Log the ones you watch\./);
  assert.deepEqual(lintAll(st, { ...slate, game: null }), {});

  const anniv = { type: 'ANNIVERSARY', id: 'anniv:x', game: game({ league: 'NFL', start: Date.parse('2016-09-18T20:00:00Z'), home: side('TEN', 'Tennessee Titans', 'Titans', 16, { record: '1-1' }), away: side('DET', 'Detroit Lions', 'Lions', 15, { record: '1-1' }), week: 2 }), years: 10, networks: NETWORKS_FOR.ANNIVERSARY, link: false };
  anniv.game.sport = 'football';
  anniv.features = features(anniv.game, { tz: TZ });
  const an = draft(anniv, { now: Date.parse('2026-09-18T18:00:00Z'), tz: TZ });
  assert.match(an.bluesky, /^18 September 2016\. Titans 16, Lions 15\./);
  assert.match(an.bluesky, /One point\./);
  assert.match(an.bluesky, /10 years ago today, in the NFL\./);
  assert.match(an.instagram, /It is in the archive if you were there\./);
  assert.ok(!/https?:/.test(an.instagram), 'instagram carries no link');
  assert.deepEqual(lintAll(an, anniv), {});

  const product = { type: 'PRODUCT', id: 'product:2026-09-15', day: '2026-09-15', networks: NETWORKS_FOR.PRODUCT };
  const pr = draft(product, { now: TUE_EVENING, tz: TZ, productIndex: 0 });
  assert.match(pr.bluesky, /That is The Vault\./);
  assert.match(pr.bluesky, /getscorebug\.app\/get\?s=bluesky&c=vault/);
  assert.match(pr.xReply, /Scorebug is free\. https:\/\/getscorebug\.app\/get\?s=x&c=vault/);
  assert.deepEqual(lintAll(pr, product), {});

  const week = { type: 'WEEKAHEAD', id: 'weekahead:2026-W38', week: { slug: '2026-W38', count: 312, leagues: 13, range: '14–20 September 2026', highlights: ['Broncos at Chiefs, Monday 6:15pm MT'] }, networks: NETWORKS_FOR.WEEKAHEAD, link: true };
  const wk = draft(week, { now: MON_NOON, tz: TZ });
  assert.match(wk.bluesky, /^312 games across 13 leagues on The Slate this week, 14–20 September 2026\./);
  assert.match(wk.bluesky, /\/r\/slate\/2026-W38\?s=bluesky&c=weekahead/);
  assert.deepEqual(lintAll(wk, week), {});

  const numbers = { type: 'WEEKNUMBERS', id: 'weeknumbers:2026-W38', community: { ok: true, logs: 412, leagues: 6, top: { scoreline: 'Oilers 4, Flames 3', grade: 4.2, logs: 38 } }, networks: NETWORKS_FOR.WEEKNUMBERS, link: false };
  const nm = draft(numbers, { now: SUN_MORNING, tz: TZ });
  assert.match(nm.bluesky, /^412 games logged on Scorebug this week across 6 leagues\./);
  assert.match(nm.bluesky, /Highest community grade: Oilers 4, Flames 3, 4\.2 from 38 logs\./);
  assert.deepEqual(lintAll(nm, numbers), {});
});

test('compose only writes the networks the event carries, and the tag budget is per network', () => {
  const t = compose({ lead: 'A.', close: 'B.', url: 'https://getscorebug.app/get?s=NET&c=x', campaign: 'x', type: 'PRODUCT', networks: ['threads', 'instagram'], link: false });
  assert.deepEqual(Object.keys(t).sort(), ['instagram', 'threads']);
  assert.equal(tagsFor('x', 'FINAL', game()).length, 0);
  assert.deepEqual(tagsFor('bluesky', 'FINAL', game()), ['LetsGoOilers', 'Flames']);
  assert.deepEqual(tagsFor('mastodon', 'FINAL', game()), ['LetsGoOilers', 'Flames', 'NHL']);
  assert.deepEqual(tagsFor('threads', 'FINAL', game()), ['LetsGoOilers']);
  assert.equal(tagsFor('instagram', 'FINAL', game()).length, TAG_BUDGET.instagram);
  assert.deepEqual(tagsFor('bluesky', 'FINAL', game({ league: 'CSL', home: side('SHA', 'Shanghai Port', 'Shanghai', 1), away: side('BEI', 'Beijing Guoan', 'Beijing', 0) })), ['CSL', 'SportsLog'], 'no team tag means the league tag, never a generated one');
});

test('cards are site URLs with the shields\' abbreviations, the right shape per network, and a community band only when there is one', () => {
  const ev = { type: 'FINAL', game: game({ detail: 'Final/OT' }), networks: ['bluesky', 'x'] };
  const c = gameCard(ev, { tz: TZ });
  assert.match(c.url, /^https:\/\/getscorebug\.app\/api\/card\?k=final&l=NHL&a=CGY&an=Flames&as=3&h=EDM&hn=Oilers&hs=4&d=Final%2FOT/);
  assert.match(c.url, /season=2026-27/);
  assert.match(c.url, /size=wide/);
  const m = gameCard({ ...ev, type: 'MORNING', networks: ['threads'] }, { tz: TZ, community: { logs: 12, grade: 4.1 } });
  assert.match(m.url, /band=community&g=4\.1&n=12&size=square/);
  const s = slateCard({ type: 'SLATE', games: [game()], networks: ['bluesky'], day: '2026-09-19' }, { tz: TZ });
  assert.match(s.url, /k=slate&day=2026-09-19&size=wide&g=NHL%7CCGY%7CEDM%7C/);
  const att = cardFor(ev, { tz: TZ, alt: altFor(ev) });
  assert.equal(att.kind, 'image');
  assert.equal(att.publicUrl, att.url);
  assert.match(att.alt, /Oilers 4, Flames 3\. Overtime\. NHL\./);
});

/* ─────────────────────────────────────────────────────────────────── tick */

test('a dry-run tick records what it would have sent, where, and touches the game so it never re-drafts', async () => {
  const store = memoryStore({ 'dispatch/settings': settingsDoc() });
  const g = game({ detail: 'Final/OT' });
  const s1 = await tick({ store, feed: feedOf([g]), now: SAT_NIGHT, factsFetch: noFacts, tz: TZ });
  assert.deepEqual(s1.dry, ['NHL-1-FINAL']);
  const e = await store.get(`${EV}NHL-1-FINAL`);
  assert.equal(e.status, 'dry');
  assert.equal(e.route, 'approval', 'autopilot is off, so it would have waited');
  assert.deepEqual(e.networks, ['bluesky', 'mastodon', 'x']);
  assert.ok(e.media && e.media.url.includes('/api/card?k=final'));
  assert.equal(e.title, 'Flames at Oilers · NHL · Final/OT');
  assert.ok((await store.get(`${GM}NHL-1`)).posted.FINAL);
  const s2 = await tick({ store, feed: feedOf([g]), now: SAT_NIGHT + 10 * 60_000, factsFetch: noFacts, tz: TZ });
  assert.deepEqual(s2.dry, [], 'idempotent by construction');
});

test('live autopilot sends a final to its networks only, retries the one that failed, and routes a postponed game to a person', async () => {
  const store = memoryStore({ 'dispatch/settings': settingsDoc({ dryRun: false, autopilot: true }) });
  let mastodonFails = true;
  const posts = [];
  const pub = (name, fail = () => false) => ({ name, post: async (text, o) => { if (fail()) throw new Error('down'); posts.push({ name, text, replyTo: !!o.replyTo, media: !!o.media }); return { id: `${name}-1`, url: `https://${name}/1` }; } });
  const publishers = { bluesky: pub('bluesky'), mastodon: pub('mastodon', () => mastodonFails), threads: pub('threads'), x: pub('x') };
  const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer, body: null });
  const g = game({ detail: 'Final/OT' });
  const s1 = await tick({ store, feed: feedOf([g]), publishers, now: SAT_NIGHT, factsFetch: noFacts, tz: TZ, fetchImpl });
  assert.deepEqual(s1.sent, ['NHL-1-FINAL']);
  const e = await store.get(`${EV}NHL-1-FINAL`);
  assert.equal(e.status, 'sent');
  assert.deepEqual(e.pending, ['mastodon']);
  assert.ok(!posts.some((p) => p.name === 'threads'), 'a night final never reaches Threads');
  assert.ok(posts.some((p) => p.name === 'x' && p.replyTo), 'the link rode in an X reply');
  mastodonFails = false;
  const s2 = await tick({ store, feed: feedOf([g]), publishers, now: SAT_NIGHT + 10 * 60_000, factsFetch: noFacts, tz: TZ, fetchImpl });
  assert.deepEqual(s2.retried, ['NHL-1-FINAL']);
  assert.deepEqual((await store.get(`${EV}NHL-1-FINAL`)).pending, []);
  // A postponed game waits for a person, even on autopilot.
  const pp = game({ n: 9, postponed: true, detail: 'Postponed' });
  const s3 = await tick({ store, feed: feedOf([pp]), publishers, now: SAT_NIGHT + 20 * 60_000, factsFetch: noFacts, tz: TZ, fetchImpl });
  assert.deepEqual(s3.sent, [], 'postponed is not a final');
  assert.equal(routeFor({ type: 'FINAL', game: pp }, { autopilot: true }), 'approval');
});

test('a draft that names a person is parked for approval with the reason, whatever autopilot says', async () => {
  const store = memoryStore({ 'dispatch/settings': settingsDoc({ dryRun: false, autopilot: true }) });
  // Force the name into the text by naming the team after the player: the
  // record's people list wins over the template.
  const g = game({ detail: 'Final/OT', home: side('EDM', 'Edmonton Oilers', 'McDavid', 4), people: ['Connor McDavid'] });
  const posts = [];
  const publishers = { bluesky: { post: async (t) => { posts.push(t); return { id: '1', url: 'u' }; } } };
  const s = await tick({ store, feed: feedOf([g]), publishers, now: SAT_NIGHT, factsFetch: noFacts, tz: TZ });
  assert.deepEqual(s.approval, ['NHL-1-FINAL']);
  assert.equal(posts.length, 0);
  assert.match((await store.get(`${EV}NHL-1-FINAL`)).note, /names a person: Connor McDavid/);
});

test('dry run is authoritative: the approved queue and the digest link both stay silent until it ends', async () => {
  const store = memoryStore({ 'dispatch/settings': settingsDoc(), [`${EV}q`]: { id: 'q', type: 'FINAL', status: 'approved', createdAt: new Date(SAT_NIGHT).toISOString(), texts: { bluesky: 'x' }, networks: ['bluesky'] } });
  let hit = 0;
  const publishers = { bluesky: { post: async () => { hit += 1; return { id: '1', url: 'u' }; } } };
  await tick({ store, feed: feedOf([]), publishers, now: SAT_NIGHT, factsFetch: noFacts, tz: TZ });
  await assert.rejects(sendApproved({ store, publishers, id: 'q', now: SAT_NIGHT }), /Dry run is on/);
  assert.equal(hit, 0);
  await store.update('dispatch/settings', { dryRun: false });
  const s = await tick({ store, feed: feedOf([]), publishers, now: SAT_NIGHT + 60_000, factsFetch: noFacts, tz: TZ });
  assert.deepEqual(s.sent, ['q']);
  assert.equal(hit, 1);
});

test('the morning beat re-posts last night\'s best final to Threads, with the community grade when the gate passes', async () => {
  const g = game({ detail: 'Final/OT' });
  const store = memoryStore({
    'dispatch/settings': settingsDoc({ dryRun: false, autopilot: true }),
    [`${EV}NHL-1-FINAL`]: { id: 'NHL-1-FINAL', type: 'FINAL', status: 'sent', createdAt: new Date(SAT_NIGHT).toISOString(), sentAt: new Date(SAT_NIGHT).toISOString(), game: g, score: 9, networks: ['bluesky', 'x'] },
  });
  const posts = [];
  const publishers = { threads: { post: async (t, o) => { posts.push({ t, media: o.media }); return { id: '1', url: 'u' }; } }, bluesky: { post: async () => ({ id: '2', url: 'v' }) } };
  const supabase = { gameAggregates: async () => [{ gameId: '1', league: 'NHL', logs: 14, grade: 4.3 }], counts: async () => null };
  const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer });
  const s = await tick({ store, feed: feedOf([]), publishers, now: SUN_MORNING, factsFetch: noFacts, tz: TZ, supabase, fetchImpl });
  assert.deepEqual(s.sent, ['morning:2026-09-20']);
  assert.equal(posts.length, 1);
  assert.match(posts[0].t, /^Last night\. Oilers 4, Flames 3\. Overtime\./);
  const e = await store.get(`${EV}morning:2026-09-20`);
  assert.match(e.media.url, /band=community&g=4\.3&n=14&size=square/);
  assert.ok((await store.get(SLOTS)).fired['morning:2026-09-20']);
});

test('today\'s budget is read back from the ledger, per network, per league, and remembers the X link', () => {
  const day = '2026-09-19';
  const events = [
    { type: 'FINAL', status: 'sent', createdAt: new Date(SAT_NIGHT - HOUR).toISOString(), sentAt: new Date(SAT_NIGHT - HOUR).toISOString(), networks: ['bluesky', 'x'], game: { league: 'NHL' }, link: true },
    { type: 'SLATE', status: 'dry', createdAt: new Date(SAT_NIGHT - 12 * HOUR).toISOString(), networks: ['bluesky', 'threads'] },
    { type: 'FINAL', status: 'skipped', createdAt: new Date(SAT_NIGHT).toISOString(), networks: ['bluesky'], game: { league: 'NHL' } },
    { type: 'FINAL', status: 'sent', createdAt: new Date(SAT_NIGHT - 30 * HOUR).toISOString(), sentAt: new Date(SAT_NIGHT - 30 * HOUR).toISOString(), networks: ['bluesky'], game: { league: 'NHL' } },
  ];
  const b = todaysBudget(events, day, TZ);
  assert.deepEqual(b.sentToday, { bluesky: 2, x: 1, threads: 1 });
  assert.deepEqual(b.leagueToday, { NHL: 1 });
  assert.equal(b.xLinkedToday, true);
  assert.equal(b.lastSentAt.bluesky, SAT_NIGHT - HOUR);
});

test('the anniversary slot closes for the day when nothing clears the floor, so the archive is not asked every ten minutes', async () => {
  const store = memoryStore({ 'dispatch/settings': settingsDoc() });
  let asked = 0;
  const archive = async () => { asked += 1; return null; };
  const noon = Date.parse('2026-09-19T18:30:00Z'); // 12:30 MT
  await tick({ store, feed: feedOf([]), now: noon, factsFetch: noFacts, tz: TZ, archive });
  await tick({ store, feed: feedOf([]), now: noon + 10 * 60_000, factsFetch: noFacts, tz: TZ, archive });
  assert.equal(asked, 1);
  assert.equal((await store.get(SLOTS)).notes['anniv:2026-09-19'], 'no anniversary cleared the floor');
});

/* ─────────────────────────────────────────────────────────────── archive */

test('the archive tries round anniversaries first, rotates leagues by the day, and never goes before 2002', () => {
  assert.deepEqual(yearsToTry(2026, 6), [2016, 2021, 2006, 2011, 2025, 2024]);
  assert.ok(!yearsToTry(2010, 20).includes(2001));
  const a = leaguesForDay(SAT_NIGHT, TZ, 3).map((l) => l.id);
  const b = leaguesForDay(SAT_NIGHT + DAY, TZ, 3).map((l) => l.id);
  assert.equal(a.length, 3);
  assert.notDeepEqual(a, b, 'a different day, a different rotation');
});

test('findAnniversary picks the best final from a past season on this date, preferring a round number', async () => {
  const mk = (year, detail, hs, as) => ({ ...ESPN_EVENT, id: `${year}`, date: `${year}-09-19T20:00Z`, season: { year, type: 2 }, competitions: [{ ...ESPN_EVENT.competitions[0], status: { type: { name: 'STATUS_FINAL', state: 'post', completed: true, detail } }, competitors: [
    { homeAway: 'home', winner: hs > as, score: String(hs), team: { id: '6', abbreviation: 'EDM', displayName: 'Edmonton Oilers', shortDisplayName: 'Oilers' } },
    { homeAway: 'away', winner: as > hs, score: String(as), team: { id: '28', abbreviation: 'CGY', displayName: 'Calgary Flames', shortDisplayName: 'Flames' } },
  ] }] });
  const fetchImpl = async (url) => {
    const y = Number(/dates=(\d{4})/.exec(url)[1]);
    const events = y === 2016 ? [mk(2016, 'Final/OT', 3, 2)] : y === 2021 ? [mk(2021, 'Final', 7, 0)] : [];
    return { ok: true, text: async () => JSON.stringify({ events }) };
  };
  const a = await findAnniversary({ now: Date.parse('2026-09-19T18:30:00Z'), tz: TZ, fetchImpl, maxRequests: 12 });
  assert.ok(a);
  assert.equal(a.years, 10);
  assert.equal(a.game.detail, 'Final/OT');
  const none = await findAnniversary({ now: Date.parse('2026-09-19T18:30:00Z'), tz: TZ, fetchImpl: async () => ({ ok: true, text: async () => '{"events":[]}' }) });
  assert.equal(none, null);
});

/* ─────────────────────────────────────────────────────────────── supabase */

test('the community gate refuses to post a small number, and passes once one game has enough logs', async () => {
  const rows = (logs) => [{ game_id: '1', league: 'NHL', logs, avg_grade: '4.25', home_team: 'Oilers', away_team: 'Flames', home_abbr: 'EDM', away_abbr: 'CGY', home_score: 4, away_score: 3 }];
  const mkClient = (logs, counts) => supabaseClient({ url: 'https://x.supabase.co', anonKey: 'anon', fetchImpl: async (url) => ({ ok: true, json: async () => (url.includes('engine_counts') ? [counts] : url.includes('engine_game_aggregates') ? (logs >= 10 ? rows(logs) : []) : []) }) });
  const small = await weekInNumbers({ client: mkClient(3, { logs_7d: 9, loggers_7d: 4, leagues_7d: 2 }), minLogs: 10 });
  assert.equal(small.ok, false);
  const big = await weekInNumbers({ client: mkClient(40, { logs_7d: 412, loggers_7d: 90, leagues_7d: 6 }), minLogs: 10 });
  assert.equal(big.ok, true);
  assert.equal(big.top.scoreline, 'Oilers 4, Flames 3');
  assert.equal(big.top.grade, 4.3);
  assert.equal(await communityFor({ client: mkClient(3, {}), espnId: '1' }), null);
  assert.deepEqual(await communityFor({ client: mkClient(12, {}), espnId: '1' }), { logs: 12, grade: 4.3 });
  const dead = supabaseClient({ url: 'https://x.supabase.co', anonKey: 'anon', fetchImpl: async () => { throw new Error('down'); } });
  assert.equal(await dead.counts(), null, 'a database that does not answer is null, never zero');
  assert.equal(supabaseClient({ url: '', anonKey: '' }), null);
});

/* ──────────────────────────────────────────────────────────────── content */

test('the week is built from fixtures only, keyed by ISO week, and the newsletter is a table with a consent line', async () => {
  const g1 = game({ n: 1, state: 'pre', completed: false, start: Date.parse('2026-09-15T00:15:00Z'), league: 'NFL', home: side('KC', 'Kansas City Chiefs', 'Chiefs', null), away: side('DEN', 'Denver Broncos', 'Broncos', null), broadcast: 'ESPN' }); g1.sport = 'football';
  const g2 = game({ n: 2, state: 'pre', completed: false, start: Date.parse('2026-09-20T00:00:00Z') });
  const week = buildWeek({ games: [g1, g2], now: MON_NOON, tz: TZ });
  assert.equal(week.slug, '2026-W38');
  assert.equal(week.count, 2);
  assert.equal(week.leagues, 2);
  assert.equal(week.range, '14–20 September 2026');
  assert.equal(week.byLeague[0].games[0].time, '6:15pm MT');
  assert.equal(week.canonical, 'https://getscorebug.app/slate/2026-W38');
  const store = memoryStore({ 'dispatch/settings': settingsDoc() });
  const out = await contentTick({ store, week: async () => ({ games: [g1, g2], errors: [] }), settings: { dryRun: true }, now: MON_NOON, tz: TZ });
  assert.equal(out.slug, '2026-W38');
  assert.ok(await store.get('dispatch/public/articles/2026-W38'));
  assert.ok(await store.get('dispatch/state/slates/2026-W38'));
  const letter = await store.get('dispatch/state/newsletters/2026-W38');
  assert.equal(letter.approved, false);
  assert.match(letter.body, /Broncos at Chiefs/);
  await store.update('dispatch/state/newsletters/2026-W38', { approved: true });
  await contentTick({ store, week: async () => ({ games: [g1], errors: [] }), settings: { dryRun: true }, now: MON_NOON + HOUR, tz: TZ });
  assert.equal((await store.get('dispatch/state/newsletters/2026-W38')).approved, true, 'an approved letter is never overwritten');
  assert.equal((await store.get('dispatch/public/articles/2026-W38')).count, 1, 'but the page is refreshed');
});

/* ───────────────────────────────────────────────────────────────── digest */

test('the digest leads with decisions, says why each one waited, prints the product numbers first, and offers the kill switch', async () => {
  const store = memoryStore({
    'dispatch/settings': settingsDoc({ dryRun: false, autopilot: true }),
    [`${EV}a`]: { id: 'a', type: 'FINAL', status: 'approval', createdAt: new Date(SAT_NIGHT).toISOString(), title: 'Flames at Oilers · NHL · Final', texts: { bluesky: 'Oilers 4, Flames 3.' }, game: { postponed: true }, networks: ['bluesky'] },
    [`${EV}b`]: { id: 'b', type: 'FINAL', status: 'approval', createdAt: new Date(SAT_NIGHT).toISOString(), title: 'x', texts: { bluesky: 'y' }, note: 'lint: {"bluesky":["names a person: A B"]}', game: {} },
    [`${EV}c`]: { id: 'c', type: 'SLATE', status: 'sent', createdAt: new Date(SAT_NIGHT).toISOString(), sentAt: new Date(SAT_NIGHT).toISOString(), title: 'The Slate', texts: { bluesky: 'z' }, postedUrls: { bluesky: 'https://b/1' }, networks: ['bluesky'] },
    [`dispatch/state/metrics/2026-09-20`]: { day: '2026-09-20', product: { logs7d: 42, loggers7d: 11, fans: 60, premium: 2, signups: { android: 30, invited: 12, newsletter: 5 } }, site: { sessions: 100 } },
  });
  const d = await buildDigest({ store, now: SUN_MORNING, opsUrl: 'https://ops', opsSecret: 's', settings: await loadSettings(store), health: { publishers: ['bluesky'], missingSecrets: ['X'] }, upcoming: [{ start: SUN_MORNING + HOUR, when: '8:30am', label: 'Villa at Spurs', league: 'Premier League' }] });
  assert.equal(d.counts.decisions, 2);
  assert.match(d.text, /called off — a person decides/);
  assert.match(d.text, /named a person — never automatic/);
  assert.match(d.text, /games logged 7d: 42/);
  assert.match(d.text, /android waitlist: 30/);
  assert.match(d.text, /TODAY ON THE SLATE \(1\)/);
  assert.match(d.text, /action=pause/);
  assert.match(d.html, /Scorebug \/\/ daily digest/);
  assert.ok(!/Delta/.test(d.html));
});

/* ──────────────────────────────────────────────────────────────── budget */

test('the plan is CA$1,000, no line spends before its gate, and the rules refuse gambling and closed-test install ads', () => {
  assert.equal(PLAN.total, 1000);
  assert.equal(PLAN.currency, 'CAD');
  assert.ok(PLAN.lines.every((l) => l.gate && l.needs.length));
  const st = budgetStatus({ entries: [], now: Date.parse('2026-10-06T12:00:00Z'), metrics: null, organic: { days: 2 } });
  const opening = st.lines.find((l) => l.id === 'opening');
  assert.equal(opening.open, false);
  assert.match(opening.blocker, /2 of 7 organic days/);
  const ready = budgetStatus({ entries: [], now: Date.parse('2026-10-06T12:00:00Z'), metrics: { site: { sessions: 10 } }, organic: { days: 9 } });
  assert.equal(ready.lines.find((l) => l.id === 'opening').open, true);
  assert.ok(HARD_RULES.some((r) => /gambling/i.test(r)));
  assert.ok(HARD_RULES.some((r) => /closed testing/i.test(r)));
});

/* ─────────────────────────────────────────────────────────────── bandit */

test('the policy has safe defaults, the arms are the closing line, the card and the product line, and nothing else', () => {
  assert.deepEqual(Object.keys(EXPERIMENTS).sort(), ['card', 'invite', 'product']);
  const d = policyFor(null);
  assert.equal(d.invite, 'statement');
  assert.equal(d.card, 'grade');
  assert.equal(d.productIndex, 0);
  const odd = policyFor({ chosen: { invite: 'invite:shout', card: 'card:neon', product: 'product:99' } });
  assert.equal(odd.invite, 'statement');
  assert.equal(odd.card, 'grade');
  assert.ok(odd.productIndex < productLines().length);
  const t = tally({ posts: [{ eventId: 'A', network: 'bluesky', likes: 9 }, { eventId: 'B', network: 'bluesky', likes: 1 }], events: [{ id: 'A', variants: { invite: 'invite:question' } }, { id: 'B', variants: { invite: 'invite:none' } }] });
  assert.equal(t.invite['invite:question'].wins, 1);
  assert.deepEqual(findings(t), [], 'two posts is not a finding');
});

/* ─────────────────────────────────────────────────────────────── channels */

test('unsubscribe tokens are stable per address, case-insensitive, and the opportunity finder refuses betting threads', async () => {
  assert.equal(unsubscribeToken('k', 'Fan@Example.com'), unsubscribeToken('k', ' fan@example.com '));
  assert.notEqual(unsubscribeToken('k', 'a@b.c'), unsubscribeToken('k2', 'a@b.c'));
  const fetchImpl = async (url) => ({ ok: true, json: async () => ({ data: { children: [
    { data: { title: 'Is there a Letterboxd for sports?', selftext: 'want to log games I have watched', created_utc: Date.now() / 1000 - 3600, num_comments: 4, permalink: '/r/hockey/1' } },
    { data: { title: 'Best app to track games I watched and the odds', selftext: 'parlay tracker', created_utc: Date.now() / 1000 - 3600, num_comments: 40, permalink: '/r/hockey/2' } },
  ] } }) });
  const found = await findOpportunities({ fetchImpl, limit: 5 });
  assert.ok(found.length >= 1);
  assert.ok(found.every((o) => !/odds|parlay/.test(o.title)));
});
