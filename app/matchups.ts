import { GEAR_TEAMS, type GearTeam } from './lib/teams'

/**
 * The rivalries that get their own page.
 *
 * ─── WHY A CURATED LIST AND NOT EVERY PAIR ──────────────────────────────────
 * Every pair within the five club leagues is 496 + 496 + 435 + 435 + 435 ≈
 * 2,300 combinations. Generating them would produce two thousand near-identical
 * pages whose only difference is two club names — which is Google's textbook
 * definition of a doorway page, and the exact failure `app/gear/[team]` already
 * guards against with `dynamicParams = false`. Mass thin pages do not rank; they
 * put the whole domain at risk.
 *
 * These are rivalries people actually search by name, which means each page has
 * a real query behind it and genuinely different content to carry: the two
 * clubs, their league, and the name the fixture is known by. Adding one is a
 * deliberate act, the same way adding a league is.
 *
 * `slug` is derived from the two club slugs so it can never drift from the team
 * table. A pair naming a club the table no longer has is dropped rather than
 * half-rendered, and reported in `MATCHUP_SKIPPED` so a renamed slug is visible
 * instead of silently costing a page.
 */

export interface Matchup {
  /** URL slug: `${a}-vs-${b}`. Derived, never hand-written. */
  slug: string
  a: GearTeam
  b: GearTeam
  league: string
  /** What the fixture is called, when it has a name people use. */
  nickname?: string
}

/** Club-slug pairs, plus the name the rivalry goes by where it has one. */
const PAIRS: Array<[string, string, string?]> = [
  // ── NHL ──
  ['toronto-maple-leafs', 'montreal-canadiens', 'the Original Six rivalry'],
  ['toronto-maple-leafs', 'boston-bruins'],
  ['boston-bruins', 'montreal-canadiens', 'the oldest rivalry in hockey'],
  ['calgary-flames', 'edmonton-oilers', 'the Battle of Alberta'],
  ['pittsburgh-penguins', 'philadelphia-flyers', 'the Battle of Pennsylvania'],
  ['pittsburgh-penguins', 'washington-capitals'],
  ['chicago-blackhawks', 'detroit-red-wings'],
  ['new-york-rangers', 'new-york-islanders'],
  ['colorado-avalanche', 'vegas-golden-knights'],
  ['vancouver-canucks', 'edmonton-oilers'],
  ['florida-panthers', 'tampa-bay-lightning'],
  ['dallas-stars', 'colorado-avalanche'],

  // ── NFL ──
  ['green-bay-packers', 'chicago-bears', 'the oldest rivalry in the NFL'],
  ['kansas-city-chiefs', 'las-vegas-raiders'],
  ['kansas-city-chiefs', 'buffalo-bills'],
  ['dallas-cowboys', 'philadelphia-eagles'],
  ['dallas-cowboys', 'washington-commanders'],
  ['pittsburgh-steelers', 'baltimore-ravens'],
  ['pittsburgh-steelers', 'cleveland-browns'],
  ['new-england-patriots', 'new-york-jets'],
  ['san-francisco-49ers', 'seattle-seahawks'],
  ['san-francisco-49ers', 'dallas-cowboys'],
  ['detroit-lions', 'minnesota-vikings'],
  ['denver-broncos', 'kansas-city-chiefs'],

  // ── NBA ──
  ['boston-celtics', 'los-angeles-lakers', 'the most-played Finals rivalry'],
  ['boston-celtics', 'new-york-knicks'],
  ['golden-state-warriors', 'cleveland-cavaliers'],
  ['los-angeles-lakers', 'la-clippers', 'the Battle of Los Angeles'],
  ['miami-heat', 'boston-celtics'],
  ['chicago-bulls', 'detroit-pistons'],
  ['new-york-knicks', 'brooklyn-nets'],
  ['denver-nuggets', 'minnesota-timberwolves'],
  ['oklahoma-city-thunder', 'denver-nuggets'],

  // ── MLB ──
  ['new-york-yankees', 'boston-red-sox', 'the greatest rivalry in baseball'],
  ['los-angeles-dodgers', 'san-francisco-giants'],
  ['chicago-cubs', 'st-louis-cardinals'],
  ['chicago-cubs', 'chicago-white-sox', 'the Crosstown Classic'],
  ['new-york-mets', 'new-york-yankees', 'the Subway Series'],
  ['houston-astros', 'texas-rangers', 'the Lone Star Series'],
  ['los-angeles-dodgers', 'san-diego-padres'],
  ['baltimore-orioles', 'new-york-yankees'],
  ['toronto-blue-jays', 'boston-red-sox'],

  // ── MLS ──
  ['portland-timbers', 'seattle-sounders', 'the Cascadia rivalry'],
  ['la-galaxy', 'lafc', 'El Trafico'],
  ['toronto-fc', 'cf-montreal', 'the 401 Derby'],
  ['new-york-city-fc', 'new-york-red-bulls', 'the Hudson River Derby'],
  ['atlanta-united', 'orlando-city'],
]

const bySlug = new Map(GEAR_TEAMS.map(t => [t.slug, t]))

export const MATCHUPS: Matchup[] = PAIRS.flatMap(([aSlug, bSlug, nickname]) => {
  const a = bySlug.get(aSlug)
  const b = bySlug.get(bSlug)
  // A pair naming a club that no longer exists in the team table is dropped
  // rather than rendered half-empty. `MATCHUP_SKIPPED` below surfaces it so a
  // silent drop is still visible to whoever changed the slug.
  if (!a || !b) return []
  return [{ slug: `${a.slug}-vs-${b.slug}`, a, b, league: a.league, nickname }]
})

/** Pairs that referenced a club slug the team table does not have. */
export const MATCHUP_SKIPPED = PAIRS
  .filter(([a, b]) => !bySlug.has(a) || !bySlug.has(b))
  .map(([a, b]) => `${a} vs ${b}`)

export const MATCHUP_COUNT = MATCHUPS.length

export function getMatchup(slug: string): Matchup | undefined {
  return MATCHUPS.find(m => m.slug === slug)
}
