// Scorebug dispatch — the archive beat: on this day, in a past season.
//
// ── WHY THIS IS THE RIGHT ANNIVERSARY ───────────────────────────────────────
//
// Delta-V's almanac was a curated table of ninety-nine dates, because space
// history is a list of famous days. Sports history is a scoreboard: the same
// calendar date in every season back to 2002 — which is exactly how far the
// product lets a fan back-log — and the record already says which of those
// games was worth remembering: overtime, one goal, a comeback in the period
// scores. So the beat asks ESPN for that date in a handful of past seasons,
// ranks the finals with the same scorer the nightly beat uses, and posts one.
// No curation, no claims about significance, no names. A scoreline, a date,
// and the sentence that it is in the archive if you were there.
//
// ── WHY IT IS RATIONED ──────────────────────────────────────────────────────
//
// Twenty-four seasons times nineteen leagues is 456 requests for one post.
// This makes at most `maxRequests` (twelve by default): the round-number
// anniversaries first (5, 10, 15, 20 years), across the two or three leagues
// in season with the biggest audience, rotating by the day of the year so the
// same league does not own every anniversary. When nothing clears the floor,
// there is no anniversary today, and that is fine.

import { LEAGUES, inSeason, localParts } from './leagues.js';
import { readEspn } from './feed.js';
import { finalScore } from './rank.js';
import { FIRST_SEASON } from './leagues.js';

export const ROUND_YEARS = [10, 5, 20, 15, 25];
export const ARCHIVE_FLOOR = 5;

/** Which leagues get a turn today: in season, audience ≥ 1, rotated by day of year. */
export function leaguesForDay(now, tz = 'America/Edmonton', count = 3) {
  const p = localParts(now, tz);
  const pool = LEAGUES.filter((l) => l.espn && l.audience >= 1 && inSeason(l, p.month)).sort((a, b) => b.audience - a.audience);
  if (!pool.length) return [];
  const doy = Math.floor((Date.UTC(p.year, p.month, p.date) - Date.UTC(p.year, 0, 1)) / 86_400_000);
  const start = doy % pool.length;
  const out = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) out.push(pool[(start + i) % pool.length]);
  return out;
}

/** The years to try, best first, never before the first season the app can log. */
export function yearsToTry(year, max = 8) {
  const out = [];
  for (const back of ROUND_YEARS) if (year - back >= FIRST_SEASON) out.push(year - back);
  for (let back = 1; out.length < max && year - back >= FIRST_SEASON; back += 1) if (!out.includes(year - back)) out.push(year - back);
  return out.slice(0, max);
}

/**
 * Find today's anniversary. Returns { game, years, score } or null. Every
 * request failure is swallowed — an archive that does not answer is a day
 * with no anniversary, never an error in the tick.
 */
export async function findAnniversary({ now = Date.now(), tz = 'America/Edmonton', fetchImpl = fetch, maxRequests = 12, floor = ARCHIVE_FLOOR, log = () => {}, weights = null }) {
  const p = localParts(now, tz);
  const leagues = leaguesForDay(now, tz);
  if (!leagues.length) return null;
  const years = yearsToTry(p.year, Math.ceil(maxRequests / leagues.length));
  let best = null;
  let requests = 0;
  for (const y of years) {
    for (const l of leagues) {
      if (requests >= maxRequests) break;
      requests += 1;
      let games = [];
      try {
        games = await readEspn({ league: l, from: { year: y, month: p.month, date: p.date }, fetchImpl });
      } catch (e) { log('archive', l.id, y, String(e.message)); continue; }
      for (const g of games) {
        /* Racing normalises to home:null / away:null on purpose (feed.js), and
           F1 sits in the league pool for most of the year — so `g.home.score`
           threw a TypeError straight out of this function on roughly three days
           in thirteen. The inner try only wraps the fetch, so it escaped, the
           caller swallowed it as "no anniversary", and the slot was closed for
           the day. An anniversary needs two clubs and a scoreline anyway. */
        if (!g.home || !g.away) continue;
        if (!g.completed || g.postponed || g.canceled || g.home.score == null || g.away.score == null) continue;
        if (g.seasonType === 1) continue; // a preseason anniversary is nobody's memory
        const { score, features } = finalScore(g, { tz, weights });
        if (score < floor) continue;
        const years_ = p.year - y;
        // Round anniversaries win ties; otherwise the better game.
        const bonus = ROUND_YEARS.includes(years_) ? 1 : 0;
        if (!best || score + bonus > best.score + best.bonus) best = { game: g, years: years_, score, bonus, features };
      }
    }
    if (best && ROUND_YEARS.includes(best.years)) break; // a round-number anniversary that clears the floor is the post
  }
  if (!best) return null;
  return { game: best.game, years: best.years, score: best.score, features: best.features };
}
