// Scorebug dispatch — the ranker.
//
// ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
//
// Delta-V's problem was a quiet manifest: some days nothing launched, and the
// engine had to find a sentence. Scorebug's problem is the exact inverse. On a
// Saturday in November there are Premier League fixtures at breakfast, sixty
// college football games through the afternoon, a full NHL and NBA slate at
// night and the J.League overnight — well over a hundred finals in one Mountain
// day. An engine that posts every final is an account people mute by Sunday.
//
// So every FINAL is a CANDIDATE, and this file decides which ones become posts:
// it scores each game on what made it worth watching, applies a per-network
// budget for the day, keeps a gap between posts, and refuses anything under a
// quality floor even when there is room. Under-posting is always fine.
//
// ── WHAT THE SCORE IS MADE OF ───────────────────────────────────────────────
//
// Every feature is something the RECORD says, never a judgement about play:
// margin against the sport's own idea of close, overtime, a comeback visible in
// the period scores, an upset visible in the records, a rivalry from a fixed
// table, playoffs up and preseason down, and the market weight of the league
// and of a Canadian side. The bandit (optimize.js) may tune the weights; it
// cannot add a feature the record does not carry.
//
// ── WHY NETWORKS HAVE DIFFERENT CLOCKS ──────────────────────────────────────
//
// A North American final lands between 21:00 and 00:30 Mountain. On X and
// Bluesky that is when sports fans are awake and arguing, so a final posts
// within minutes. On Threads and Instagram it is dead air, so those networks
// get the best final again at 07:00 as the MORNING beat. The two lists below
// are that decision in code.

import { LEAGUE_BY_ID, SPORT_SHAPE, CANADIAN, localParts } from './leagues.js';

/** Which networks each beat goes to. The morning beat exists BECAUSE of this table. */
export const NETWORKS_FOR = Object.freeze({
  FINAL: ['bluesky', 'mastodon', 'x'],
  PREGAME: ['bluesky', 'x'],
  MORNING: ['threads', 'instagram'],
  SLATE: ['bluesky', 'mastodon', 'threads', 'x'],
  ANNIVERSARY: ['bluesky', 'mastodon', 'threads', 'x', 'instagram'],
  PRODUCT: ['bluesky', 'mastodon', 'threads', 'x'],
  WEEKAHEAD: ['bluesky', 'mastodon', 'threads', 'x'],
  WEEKNUMBERS: ['bluesky', 'mastodon', 'threads', 'x', 'instagram'],
});

/** Default weights. Settings may override key by key; the bandit writes to the same shape. */
export const WEIGHTS = Object.freeze({
  audience: 1.0,   // × league audience (0–3)
  tight: 3, close: 1.5, ot: 3, shootout: 1, comeback: 2, upset: 2, rivalry: 2,
  playoff: 3, preseason: -3, highTotal: 1, canadian: 1, primetime: 0.5, weekend: 0.5,
});

/** The floors. A final under `minFinal` never posts, however empty the day. */
export const FLOORS = Object.freeze({ minFinal: 4, minPregame: 3, xLink: 8 });

/** A curated rivalry table, by league, both orders. Add; never generate. */
const RIVALRIES = Object.freeze({
  NHL: [['EDM', 'CGY'], ['TOR', 'MTL'], ['NYR', 'NYI'], ['PIT', 'PHI'], ['BOS', 'MTL'], ['TOR', 'OTT'], ['VAN', 'CGY'], ['CHI', 'DET'], ['WSH', 'PIT'], ['COL', 'DET'], ['TOR', 'BOS']],
  NFL: [['GB', 'CHI'], ['DAL', 'PHI'], ['KC', 'LV'], ['PIT', 'BAL'], ['DAL', 'WSH'], ['NYG', 'PHI'], ['SF', 'SEA'], ['KC', 'BUF'], ['DEN', 'KC'], ['MIN', 'GB']],
  NBA: [['LAL', 'BOS'], ['GS', 'CLE'], ['NY', 'BOS'], ['MIA', 'BOS'], ['LAL', 'LAC'], ['PHI', 'BOS']],
  MLB: [['NYY', 'BOS'], ['LAD', 'SF'], ['TOR', 'NYY'], ['CHC', 'STL'], ['NYY', 'NYM'], ['LAD', 'SD']],
  CFL: [['EDM', 'CGY'], ['SSK', 'WPG'], ['TOR', 'HAM']],
  EPL: [['ARS', 'TOT'], ['LIV', 'MUN'], ['MCI', 'MUN'], ['LIV', 'EVE'], ['ARS', 'CHE'], ['NEW', 'SUN'], ['LIV', 'MCI'], ['CHE', 'TOT']],
  LALIGA: [['RMA', 'BAR'], ['RMA', 'ATM'], ['SEV', 'BET'], ['ATH', 'RSO']],
  SERIEA: [['INT', 'MIL'], ['JUV', 'INT'], ['ROM', 'LAZ'], ['JUV', 'MIL']],
  BUND: [['BAY', 'DOR'], ['DOR', 'SCH'], ['BAY', 'LEV']],
  LIGUE1: [['PSG', 'MAR'], ['LYON', 'STE'], ['LYO', 'STE']],
  MLS: [['TOR', 'MTL'], ['SEA', 'POR'], ['LAFC', 'LAG'], ['NYC', 'NY'], ['ATL', 'ORL']],
  UCL: [], NCAAF: [['MICH', 'OSU'], ['ALA', 'AUB'], ['TEX', 'OU'], ['ND', 'USC'], ['ARMY', 'NAVY']], NCAAB: [['DUKE', 'UNC'], ['UK', 'LOU']],
  CSL: [], ISL: [], JLEAGUE: [], IPL: [['MI', 'CSK']], F1: [],
});

const key = (a, b) => [String(a || ''), String(b || '')].sort().join('|');
const RIVALRY_SET = Object.fromEntries(Object.entries(RIVALRIES).map(([l, pairs]) => [l, new Set(pairs.map(([a, b]) => key(a, b)))]));

/** "12-3" / "12-3-1" / "12-3-2" → win share of decided games; null when unreadable or too few. */
export function winShare(record) {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(String(record || '').trim());
  if (!m) return null;
  const w = Number(m[1]), l = Number(m[2]);
  if (w + l < 5) return null;
  return w / (w + l);
}

/** Cumulative period scores → did the eventual winner trail by `by` at the end of any period? */
export function comebackIn(game, by) {
  const h = game.home, a = game.away;
  if (!h || !a || !h.linescores.length || h.linescores.length !== a.linescores.length) return false;
  if (h.score == null || a.score == null || h.score === a.score) return false;
  const winnerHome = h.score > a.score;
  let hs = 0, as = 0;
  for (let i = 0; i < h.linescores.length - 1; i += 1) { // never the final period
    hs += h.linescores[i]; as += a.linescores[i];
    const deficit = winnerHome ? as - hs : hs - as;
    if (deficit >= by) return true;
  }
  return false;
}

const COMEBACK_BY = Object.freeze({ hockey: 2, soccer: 2, basketball: 10, football: 10, baseball: 3, cricket: 0, racing: 0 });

/** Every feature the record supports, as booleans and numbers. Pure. */
export function features(game, { tz = 'America/Edmonton', rivalries = null } = {}) {
  const l = LEAGUE_BY_ID[game.league] || { audience: 1 };
  const shape = SPORT_SHAPE[game.sport] || SPORT_SHAPE.soccer;
  const h = game.home || {}, a = game.away || {};
  const hasScore = h.score != null && a.score != null;
  const margin = hasScore ? Math.abs(h.score - a.score) : null;
  const total = hasScore ? h.score + a.score : null;
  const detail = String(game.detail || '');
  const ot = /\bOT\b|\d+OT|AET|extra time|\/1[0-9]\b|\/2[0-9]\b/i.test(detail) || (game.sport === 'baseball' && game.period != null && game.period > 9) || (game.sport === 'soccer' && game.period != null && game.period > 2);
  const shootout = /\bSO\b|pen|shootout/i.test(detail);
  const tight = margin != null && shape.tight > 0 && margin <= shape.tight;
  const close = margin != null && shape.close > 0 && margin <= shape.close && !tight;
  const comeback = COMEBACK_BY[game.sport] > 0 && comebackIn(game, COMEBACK_BY[game.sport]);
  let upset = false;
  if (hasScore && game.sport !== 'soccer' && h.score !== a.score) {
    const wh = winShare(h.record), wa = winShare(a.record);
    const winnerHome = h.score > a.score;
    if (wh != null && wa != null) upset = winnerHome ? wa - wh >= 0.25 : wh - wa >= 0.25;
    const wr = winnerHome ? h.rank : a.rank, lr = winnerHome ? a.rank : h.rank;
    if (!upset && lr && !wr) upset = true;
  }
  const rset = RIVALRY_SET[game.league] || new Set();
  const extra = rivalries && rivalries[game.league] ? rivalries[game.league] : [];
  // The site's table names clubs in full; the built-in table uses abbreviations. Either matches.
  const rivalry = rset.has(key(h.abbr, a.abbr)) || extra.some(([x, y]) => key(x, y) === key(h.abbr, a.abbr) || key(String(x).toLowerCase(), String(y).toLowerCase()) === key(String(h.name || '').toLowerCase(), String(a.name || '').toLowerCase()));
  const canadian = !!(CANADIAN[game.league] && (CANADIAN[game.league].has(h.abbr) || CANADIAN[game.league].has(a.abbr)));
  const start = game.start != null ? localParts(game.start, tz) : null;
  const primetime = !!start && start.hour >= 17 && start.hour <= 20;
  const weekend = !!start && (start.weekday === 'Sat' || start.weekday === 'Sun');
  return {
    audience: l.audience ?? 1, margin, total,
    tight, close, ot, shootout, comeback, upset, rivalry,
    playoff: game.seasonType === 3, preseason: game.seasonType === 1,
    highTotal: total != null && shape.highTotal > 0 && total >= shape.highTotal,
    canadian, primetime, weekend,
  };
}

/** The final's score: what the record says it was worth. */
export function finalScore(game, opts = {}) {
  const w = { ...WEIGHTS, ...(opts.weights || {}) };
  const f = features(game, opts);
  let s = w.audience * f.audience;
  for (const k of ['tight', 'close', 'ot', 'shootout', 'comeback', 'upset', 'rivalry', 'playoff', 'preseason', 'highTotal', 'canadian', 'primetime', 'weekend']) if (f[k]) s += w[k];
  return { score: Number(s.toFixed(2)), features: f };
}

/** Before the game: what makes it the one to preview. */
export function pregameScore(game, opts = {}) {
  const w = { ...WEIGHTS, ...(opts.weights || {}) };
  const f = features(game, opts);
  let s = w.audience * f.audience;
  for (const k of ['rivalry', 'playoff', 'preseason', 'canadian', 'primetime', 'weekend']) if (f[k]) s += w[k];
  if (game.broadcast) s += 0.5; // a national window is a signal the schedule already made
  return { score: Number(s.toFixed(2)), features: f };
}

/**
 * Choose what goes out this tick.
 *
 * `sentToday` is { network: count } for the local day; `lastSentAt` is
 * { network: ms }; `leagueToday` is { league: count } of FINAL posts today.
 * Returns the events to draft, in order, each carrying `networks`, `score`,
 * `features` and (for X) `link`.
 */
export function select({ events, settings = {}, now = Date.now(), tz = 'America/Edmonton', sentToday = {}, lastSentAt = {}, leagueToday = {}, xLinkedToday = false, rivalries = null }) {
  const caps = { bluesky: 5, mastodon: 5, threads: 4, x: 3, instagram: 1, ...(settings.maxPerDay || {}) };
  /* `Number(x) || default` reads 0 as "unset". A deliberate `minGapMinutes: 0`
     ("post as fast as the caps allow") silently became 40, and
     `maxPerLeaguePerDay: 0` ("no finals from this league") became 2 — the
     opposite of what was asked, on the two settings whose whole purpose is to
     restrain the machine. xspend.js already treats a 0 cap as meaningful; so
     does this now. */
  const numOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const gapMs = numOr(settings.minGapMinutes, 40) * 60_000;
  const perLeague = numOr(settings.maxPerLeaguePerDay, 2);
  const floors = { ...FLOORS, ...(settings.floors || {}) };
  const weights = settings.weights || null;

  // 1. Score everything.
  const scored = [];
  for (const ev of events) {
    let score = 0, feats = null;
    if (ev.type === 'FINAL') ({ score, features: feats } = finalScore(ev.game, { tz, weights, rivalries }));
    else if (ev.type === 'PREGAME') ({ score, features: feats } = pregameScore(ev.game, { tz, weights, rivalries }));
    else if (ev.type === 'MORNING') score = ev.rank || 0;
    else score = 100; // a slot beat fires when its window opens; it is not competing with games
    scored.push({ ...ev, score, features: feats, networks: [...(NETWORKS_FOR[ev.type] || [])] });
  }

  // 2. Floors, and one pregame a day.
  const kept = [];
  let pregame = null;
  for (const ev of scored) {
    if (ev.type === 'FINAL' && ev.score < floors.minFinal) continue;
    if (ev.type === 'PREGAME') {
      if (ev.score < floors.minPregame) continue;
      if (!pregame || ev.score > pregame.score) pregame = ev;
      continue;
    }
    kept.push(ev);
  }
  if (pregame) kept.push(pregame);

  /* 3. Priority: the rare, time-boxed beats first, then finals.
   *
   *    PREGAME used to sort LAST, behind finals, and that is why it never
   *    fired. It shares bluesky and x with FINAL, so on any evening with a
   *    final in the tick the pregame lost both its networks to the 40-minute
   *    gap — and its whole window is 45-80 minutes out, three or four ticks.
   *    A pregame happens once a day and a final happens every ten minutes, so
   *    when the two collide the final is the one that can wait. */
  const prio = { SLATE: 0, MORNING: 1, WEEKAHEAD: 2, ANNIVERSARY: 3, WEEKNUMBERS: 4, PRODUCT: 5, PREGAME: 6, FINAL: 7 };
  kept.sort((a, b) => (prio[a.type] - prio[b.type]) || (b.score - a.score) || (((a.game && a.game.start) || 0) - ((b.game && b.game.start) || 0)));

  // 4. Budgets. A network drops off an event when it is full or too soon; an
  //    event with no networks left is deferred to a later tick, not dropped.
  const counts = { ...sentToday };
  const last = { ...lastSentAt };
  const league = { ...leagueToday };
  let xLinked = xLinkedToday;
  const out = [];
  let finalsOut = 0;
  for (const ev of kept) {
    if (ev.type === 'FINAL' && finalsOut >= 1) continue;
    if (ev.type === 'FINAL' && (league[ev.game.league] || 0) >= perLeague) continue;
    const nets = ev.networks.filter((n) => {
      if (settings.networks && settings.networks[n] === false) return false;
      if ((counts[n] || 0) >= (caps[n] ?? 0)) return false;
      if (last[n] && now - last[n] < gapMs && ev.type !== 'SLATE' && ev.type !== 'MORNING') return false;
      return true;
    });
    if (!nets.length) continue;
    ev.networks = nets;
    for (const n of nets) { counts[n] = (counts[n] || 0) + 1; last[n] = now; }
    if (ev.type === 'FINAL') { league[ev.game.league] = (league[ev.game.league] || 0) + 1; finalsOut += 1; }
    // The link on X costs thirteen times the post. One a day, and only for the
    // game that earned it; PRODUCT always carries one because the link IS the post.
    ev.link = ev.type === 'PRODUCT' || ev.type === 'WEEKAHEAD' || (!xLinked && ev.type === 'FINAL' && ev.score >= floors.xLink);
    if (ev.link && ev.type === 'FINAL') xLinked = true;
    out.push(ev);
    /* One FINAL per tick keeps the account human: the next-best waits ten
       minutes. `break` was wrong — it left the whole loop, and PREGAME sorts
       AFTER FINAL in the priority table above, so on any night with a final in
       each tick the pregame beat never fired at all. Its window is only 45-80
       minutes wide, three or four ticks, so a busy evening silently deleted it.
       `continue` past further finals is what was always meant. */
    if (out.filter((e) => e.type === 'FINAL').length >= 1) {
      const rest = kept.slice(kept.indexOf(ev) + 1).filter((e) => e.type !== 'FINAL');
      if (!rest.length) break;
    }
  }
  return out;
}

/** Top N of today's fixtures for the slate card. */
export function slatePick(games, n = 5, opts = {}) {
  return [...games]
    .map((g) => ({ g, s: pregameScore(g, opts).score }))
    .sort((a, b) => b.s - a.s || (a.g.start || 0) - (b.g.start || 0))
    .slice(0, n)
    .map((x) => x.g)
    .sort((a, b) => (a.start || 0) - (b.start || 0));
}
