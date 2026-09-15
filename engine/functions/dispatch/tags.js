/**
 * SCOREBUG // DISCOVERY TAGS
 *
 * ── WHY TAGS ARE NOT ONE FEATURE ────────────────────────────────────────────
 *
 * The networks disagree about what a tag is FOR, and the Delta-V engine found
 * each of these the hard way:
 *
 *   MASTODON  has no algorithm. A post reaches followers plus everyone watching
 *             a hashtag. Tags are the entire distribution mechanism, so this is
 *             where they earn the most and get the biggest budget.
 *   BLUESKY   indexes tags and lets people follow them — but only when the post
 *             carries a richtext FACET for each. Text with a # and no facet is
 *             a grey string nothing indexes. publish.js adds the facets.
 *   THREADS   takes EXACTLY ONE. It hoists the first tag into a topic and
 *             strips the '#'; a second is left as a bare word. One in, one out.
 *   INSTAGRAM indexes several and readers search them; five is plenty.
 *   X         demotes hashtag-heavy posts and bills per post. It gets none.
 *
 * ── WHAT CHANGES FOR SPORTS ─────────────────────────────────────────────────
 *
 * The tag a fan follows is the TEAM'S, not the league's. #LetsGoOilers is a
 * feed; #Hockey is a haystack. So the order is team, then league, then beat —
 * and the team table is hand-checked (leagues.js TEAM_TAGS) rather than
 * generated, because a generated tag is how an account posts #NewYorkJets to a
 * fan base that uses #Jets and reads as a bot in one line.
 */

import { LEAGUE_BY_ID, TEAM_TAGS } from './leagues.js';

/** How many tags each network gets, and why is in the header above. */
export const TAG_BUDGET = Object.freeze({
  mastodon: 3,
  bluesky: 2,
  threads: 1,
  instagram: 5,
  x: 0,
});

/** Tags by beat. Behind the team and league tags; the budget takes from the front. */
const BY_TYPE = Object.freeze({
  FINAL: ['SportsLog'],
  MORNING: ['SportsLog'],
  PREGAME: ['GameDay'],
  SLATE: ['GameDay', 'SportsLog'],
  ANNIVERSARY: ['OnThisDay', 'SportsHistory'],
  PRODUCT: ['SportsLog', 'SportsApp'],
  WEEKAHEAD: ['GameDay', 'SportsLog'],
  WEEKNUMBERS: ['SportsLog'],
});

const FALLBACK = ['Sports', 'SportsLog'];

/** Team, league and beat tags for a game, in priority order, before any budget. */
export function tagsForGame(type, game) {
  const out = [];
  if (game) {
    const teams = TEAM_TAGS[game.league] || {};
    for (const s of [game.home, game.away]) if (s && s.abbr && teams[s.abbr]) out.push(teams[s.abbr]);
    const l = LEAGUE_BY_ID[game.league];
    if (l) out.push(...l.tags);
  }
  out.push(...(BY_TYPE[type] || FALLBACK));
  return out;
}

/**
 * The tags a given network should carry for this post. `extra` goes first,
 * where the budget keeps it.
 */
export function tagsFor(network, type, game = null, extra = []) {
  const budget = TAG_BUDGET[network] ?? 0;
  if (!budget) return [];
  const seen = new Set();
  const out = [];
  for (const t of [...extra, ...tagsForGame(type, game)]) {
    const clean = String(t).replace(/[^A-Za-z0-9]/g, '');
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push(clean);
    if (out.length >= budget) break;
  }
  return out;
}

/** Render as a single trailing line: "#LetsGoOilers #NHL". */
export function tagLine(tags) {
  return tags.length ? tags.map((t) => `#${t}`).join(' ') : '';
}
