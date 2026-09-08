import { GEAR_TEAMS, type GearTeam } from './lib/teams'
import { CLUBS } from './clubs'

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

  // ── Association football, outside North America ──
  // Curated the same way the North American pairs are: each of these is a
  // fixture with a name people actually type, not a generated permutation.
  ['real-madrid', 'barcelona', 'El Clásico'],
  ['atletico-madrid', 'real-madrid', 'the Madrid derby'],
  ['real-betis', 'sevilla', 'the Seville derby'],
  ['manchester-united', 'liverpool', 'the North West derby'],
  ['manchester-city', 'manchester-united', 'the Manchester derby'],
  ['arsenal', 'tottenham-hotspur', 'the North London derby'],
  ['liverpool', 'everton', 'the Merseyside derby'],
  ['inter-milan', 'ac-milan', 'the Derby della Madonnina'],
  ['juventus', 'inter-milan', 'the Derby d\'Italia'],
  ['as-roma', 'lazio', 'the Derby della Capitale'],
  ['bayern-munich', 'borussia-dortmund', 'Der Klassiker'],
  ['borussia-dortmund', 'borussia-monchengladbach'],
  ['paris-sg', 'marseille', 'Le Classique'],
  ['lyon', 'marseille', 'the Olympico'],

  // ── CFL ──
  ['calgary-stampeders', 'edmonton-elks', 'the Battle of Alberta'],
  ['saskatchewan-roughriders', 'winnipeg-blue-bombers', 'the Banjo Bowl'],
  ['toronto-argonauts', 'hamilton-tiger-cats', 'the Labour Day Classic'],

  // ── NCAA football ──
  ['alabama-crimson-tide', 'auburn-tigers', 'the Iron Bowl'],
  ['ohio-state-buckeyes', 'michigan-wolverines', 'The Game'],

  // ── MLS ──
  ['portland-timbers', 'seattle-sounders', 'the Cascadia rivalry'],
  ['la-galaxy', 'lafc', 'El Trafico'],
  ['toronto-fc', 'cf-montreal', 'the 401 Derby'],
  ['new-york-city-fc', 'new-york-red-bulls', 'the Hudson River Derby'],
  ['atlanta-united', 'orlando-city'],
]

/**
 * ─── RESOLUTION FALLS BACK TO THE FULL DIRECTORY ────────────────────────────
 * `GEAR_TEAMS` holds only the five leagues Fanatics stocks per-club shops for,
 * so for as long as it was the only source, a rivalry could only exist between
 * NHL/NFL/NBA/MLB/MLS clubs. The visible consequence was that /football argued
 * "not a North American app" and then showed a rivalry list in which ten of its
 * thirteen leagues did not appear — no Clásico for a reader arriving from
 * scorebug.football in Madrid, no Labour Day Classic on the page calling the
 * CFL first-class.
 *
 * `CLUBS` (generated, 853 entries) resolves the rest. GEAR_TEAMS is still tried
 * FIRST so that a club with a /gear page keeps the richer record and the pair's
 * `league` stays the gear league.
 *
 * This does NOT open the door to mass generation: PAIRS is still hand-curated,
 * and the docblock above still governs. It just stops the curator from being
 * limited to a third of the product.
 */
const bySlug = new Map<string, GearTeam>()
const asGearTeam = (c: (typeof CLUBS)[number]): GearTeam => ({
  slug: c.slug, name: c.name, short: c.short,
  league: c.league as GearTeam['league'], color: '#8B949E',
})
/* DOMESTIC LEAGUE FIRST, CONTINENTAL SECOND, and the order is load-bearing.
   Real Madrid, Bayern and Juventus all appear twice in CLUBS — once in their
   domestic league and once in the Champions League field — and CLUBS is in
   registry order, which puts UCL ahead of La Liga, Serie A, the Bundesliga and
   Ligue 1. Taking the first match filed El Clásico and Der Klassiker under UCL,
   so they vanished from their own league pages and the La Liga rivalry list
   read as one fixture. A club's identity is its domestic league. */
/* FIRST wins within the domestic pass, so registry order decides. Alabama and
   Ohio State exist in both NCAAF and NCAAB, and NCAAF is registered first —
   last-wins filed the Iron Bowl and The Game under college BASKETBALL. */
for (const c of CLUBS) if (c.league !== 'UCL' && !bySlug.has(c.slug)) bySlug.set(c.slug, asGearTeam(c))
for (const c of CLUBS) if (c.league === 'UCL' && !bySlug.has(c.slug)) bySlug.set(c.slug, asGearTeam(c))
/* GEAR_TEAMS last: a club with a /gear page keeps the richer record. */
for (const t of GEAR_TEAMS) bySlug.set(t.slug, t)

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
