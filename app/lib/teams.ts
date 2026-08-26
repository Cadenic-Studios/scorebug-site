/**
 * The club list for the public gear hub.
 *
 * ─── SCOPE: FANATICS-SERVED LEAGUES, GENERATED FROM THE APP REGISTRY ─────────
 * Every team in the five leagues Fanatics actually stocks per-club shops for —
 * NHL, NFL, NBA, MLB and MLS — extracted from the app's own registry
 * (lib/api/teams.ts) via scripts/gen-gear-teams.mjs so the names and slugs
 * cannot drift by hand. ${GEAR_TEAMS.length} clubs, each with a real Fanatics
 * result behind its link.
 *
 * ─── WHY NOT ALL ~790 TEAMS THE APP KNOWS ────────────────────────────────────
 * Deliberately capped at the Fanatics-served majors + MLS. The app also knows
 * ~130 NCAA programs and the European football leagues, and generating a page
 * for every one would be a doorway-page pattern — Google's spam policy names
 * "thin affiliate pages" and mass-generated low-value pages explicitly, and the
 * penalty is not per-page but can demote the whole domain that carries the
 * landing page and the shop. Just as concretely: Fanatics returns an EMPTY shop
 * for a CFL or La Liga or NCAA club, and sending a fan to an empty store is
 * worse than not linking at all. These 154 all resolve to a stocked shop.
 *
 * NCAA and European clubs still get eBay + tickets inside the app; this public
 * hub is Fanatics-led, so they are out of scope for it.
 *
 * ─── COLOURS ARE PER-LEAGUE ──────────────────────────────────────────────────
 * The registry stores accent colour per league, not per club, so every NHL card
 * shares the league blue, every NBA card the league coral, and so on. At 154
 * cards that reads as an intentional system (grouped by league, each league its
 * own colour) rather than the 32-card hand-picked palette it replaces.
 *
 * Regenerate after a league adds/moves a team:  npx tsx scripts/gen-gear-teams.ts (in the app repo)
 */

export type GearLeague = 'NHL' | 'NFL' | 'NBA' | 'MLB' | 'MLS'

export type GearTeam = {
  /** URL slug — also the static param. */
  slug: string
  /** Full club name, exactly as Fanatics and TicketNetwork search for it. */
  name: string
  /** Short form for headings (full name for MLS, where city+nickname doesn't split). */
  short: string
  league: GearLeague
  /** League accent colour, for the card. */
  color: string
}

export const GEAR_TEAMS: GearTeam[] = [
  // NHL — 32 clubs
  { slug: "anaheim-ducks", name: "Anaheim Ducks", short: "Ducks", league: 'NHL', color: '#58A6FF' },
  { slug: "boston-bruins", name: "Boston Bruins", short: "Bruins", league: 'NHL', color: '#58A6FF' },
  { slug: "buffalo-sabres", name: "Buffalo Sabres", short: "Sabres", league: 'NHL', color: '#58A6FF' },
  { slug: "calgary-flames", name: "Calgary Flames", short: "Flames", league: 'NHL', color: '#58A6FF' },
  { slug: "carolina-hurricanes", name: "Carolina Hurricanes", short: "Hurricanes", league: 'NHL', color: '#58A6FF' },
  { slug: "chicago-blackhawks", name: "Chicago Blackhawks", short: "Blackhawks", league: 'NHL', color: '#58A6FF' },
  { slug: "colorado-avalanche", name: "Colorado Avalanche", short: "Avalanche", league: 'NHL', color: '#58A6FF' },
  { slug: "columbus-blue-jackets", name: "Columbus Blue Jackets", short: "Blue Jackets", league: 'NHL', color: '#58A6FF' },
  { slug: "dallas-stars", name: "Dallas Stars", short: "Stars", league: 'NHL', color: '#58A6FF' },
  { slug: "detroit-red-wings", name: "Detroit Red Wings", short: "Red Wings", league: 'NHL', color: '#58A6FF' },
  { slug: "edmonton-oilers", name: "Edmonton Oilers", short: "Oilers", league: 'NHL', color: '#58A6FF' },
  { slug: "florida-panthers", name: "Florida Panthers", short: "Panthers", league: 'NHL', color: '#58A6FF' },
  { slug: "los-angeles-kings", name: "Los Angeles Kings", short: "Kings", league: 'NHL', color: '#58A6FF' },
  { slug: "minnesota-wild", name: "Minnesota Wild", short: "Wild", league: 'NHL', color: '#58A6FF' },
  { slug: "montreal-canadiens", name: "Montréal Canadiens", short: "Canadiens", league: 'NHL', color: '#58A6FF' },
  { slug: "nashville-predators", name: "Nashville Predators", short: "Predators", league: 'NHL', color: '#58A6FF' },
  { slug: "new-jersey-devils", name: "New Jersey Devils", short: "Devils", league: 'NHL', color: '#58A6FF' },
  { slug: "new-york-islanders", name: "New York Islanders", short: "Islanders", league: 'NHL', color: '#58A6FF' },
  { slug: "new-york-rangers", name: "New York Rangers", short: "Rangers", league: 'NHL', color: '#58A6FF' },
  { slug: "ottawa-senators", name: "Ottawa Senators", short: "Senators", league: 'NHL', color: '#58A6FF' },
  { slug: "philadelphia-flyers", name: "Philadelphia Flyers", short: "Flyers", league: 'NHL', color: '#58A6FF' },
  { slug: "pittsburgh-penguins", name: "Pittsburgh Penguins", short: "Penguins", league: 'NHL', color: '#58A6FF' },
  { slug: "san-jose-sharks", name: "San Jose Sharks", short: "Sharks", league: 'NHL', color: '#58A6FF' },
  { slug: "seattle-kraken", name: "Seattle Kraken", short: "Kraken", league: 'NHL', color: '#58A6FF' },
  { slug: "st-louis-blues", name: "St. Louis Blues", short: "Blues", league: 'NHL', color: '#58A6FF' },
  { slug: "tampa-bay-lightning", name: "Tampa Bay Lightning", short: "Lightning", league: 'NHL', color: '#58A6FF' },
  { slug: "toronto-maple-leafs", name: "Toronto Maple Leafs", short: "Maple Leafs", league: 'NHL', color: '#58A6FF' },
  { slug: "utah-hockey-club", name: "Utah Hockey Club", short: "Hockey Club", league: 'NHL', color: '#58A6FF' },
  { slug: "vancouver-canucks", name: "Vancouver Canucks", short: "Canucks", league: 'NHL', color: '#58A6FF' },
  { slug: "vegas-golden-knights", name: "Vegas Golden Knights", short: "Golden Knights", league: 'NHL', color: '#58A6FF' },
  { slug: "washington-capitals", name: "Washington Capitals", short: "Capitals", league: 'NHL', color: '#58A6FF' },
  { slug: "winnipeg-jets", name: "Winnipeg Jets", short: "Jets", league: 'NHL', color: '#58A6FF' },
  // NFL — 32 clubs
  { slug: "arizona-cardinals", name: "Arizona Cardinals", short: "Cardinals", league: 'NFL', color: '#A371F7' },
  { slug: "atlanta-falcons", name: "Atlanta Falcons", short: "Falcons", league: 'NFL', color: '#A371F7' },
  { slug: "baltimore-ravens", name: "Baltimore Ravens", short: "Ravens", league: 'NFL', color: '#A371F7' },
  { slug: "buffalo-bills", name: "Buffalo Bills", short: "Bills", league: 'NFL', color: '#A371F7' },
  { slug: "carolina-panthers", name: "Carolina Panthers", short: "Panthers", league: 'NFL', color: '#A371F7' },
  { slug: "chicago-bears", name: "Chicago Bears", short: "Bears", league: 'NFL', color: '#A371F7' },
  { slug: "cincinnati-bengals", name: "Cincinnati Bengals", short: "Bengals", league: 'NFL', color: '#A371F7' },
  { slug: "cleveland-browns", name: "Cleveland Browns", short: "Browns", league: 'NFL', color: '#A371F7' },
  { slug: "dallas-cowboys", name: "Dallas Cowboys", short: "Cowboys", league: 'NFL', color: '#A371F7' },
  { slug: "denver-broncos", name: "Denver Broncos", short: "Broncos", league: 'NFL', color: '#A371F7' },
  { slug: "detroit-lions", name: "Detroit Lions", short: "Lions", league: 'NFL', color: '#A371F7' },
  { slug: "green-bay-packers", name: "Green Bay Packers", short: "Packers", league: 'NFL', color: '#A371F7' },
  { slug: "houston-texans", name: "Houston Texans", short: "Texans", league: 'NFL', color: '#A371F7' },
  { slug: "indianapolis-colts", name: "Indianapolis Colts", short: "Colts", league: 'NFL', color: '#A371F7' },
  { slug: "jacksonville-jaguars", name: "Jacksonville Jaguars", short: "Jaguars", league: 'NFL', color: '#A371F7' },
  { slug: "kansas-city-chiefs", name: "Kansas City Chiefs", short: "Chiefs", league: 'NFL', color: '#A371F7' },
  { slug: "las-vegas-raiders", name: "Las Vegas Raiders", short: "Raiders", league: 'NFL', color: '#A371F7' },
  { slug: "los-angeles-chargers", name: "Los Angeles Chargers", short: "Chargers", league: 'NFL', color: '#A371F7' },
  { slug: "los-angeles-rams", name: "Los Angeles Rams", short: "Rams", league: 'NFL', color: '#A371F7' },
  { slug: "miami-dolphins", name: "Miami Dolphins", short: "Dolphins", league: 'NFL', color: '#A371F7' },
  { slug: "minnesota-vikings", name: "Minnesota Vikings", short: "Vikings", league: 'NFL', color: '#A371F7' },
  { slug: "new-england-patriots", name: "New England Patriots", short: "Patriots", league: 'NFL', color: '#A371F7' },
  { slug: "new-orleans-saints", name: "New Orleans Saints", short: "Saints", league: 'NFL', color: '#A371F7' },
  { slug: "new-york-giants", name: "New York Giants", short: "Giants", league: 'NFL', color: '#A371F7' },
  { slug: "new-york-jets", name: "New York Jets", short: "Jets", league: 'NFL', color: '#A371F7' },
  { slug: "philadelphia-eagles", name: "Philadelphia Eagles", short: "Eagles", league: 'NFL', color: '#A371F7' },
  { slug: "pittsburgh-steelers", name: "Pittsburgh Steelers", short: "Steelers", league: 'NFL', color: '#A371F7' },
  { slug: "san-francisco-49ers", name: "San Francisco 49ers", short: "49ers", league: 'NFL', color: '#A371F7' },
  { slug: "seattle-seahawks", name: "Seattle Seahawks", short: "Seahawks", league: 'NFL', color: '#A371F7' },
  { slug: "tampa-bay-buccaneers", name: "Tampa Bay Buccaneers", short: "Buccaneers", league: 'NFL', color: '#A371F7' },
  { slug: "tennessee-titans", name: "Tennessee Titans", short: "Titans", league: 'NFL', color: '#A371F7' },
  { slug: "washington-commanders", name: "Washington Commanders", short: "Commanders", league: 'NFL', color: '#A371F7' },
  // NBA — 30 clubs
  { slug: "atlanta-hawks", name: "Atlanta Hawks", short: "Hawks", league: 'NBA', color: '#F78166' },
  { slug: "boston-celtics", name: "Boston Celtics", short: "Celtics", league: 'NBA', color: '#F78166' },
  { slug: "brooklyn-nets", name: "Brooklyn Nets", short: "Nets", league: 'NBA', color: '#F78166' },
  { slug: "charlotte-hornets", name: "Charlotte Hornets", short: "Hornets", league: 'NBA', color: '#F78166' },
  { slug: "chicago-bulls", name: "Chicago Bulls", short: "Bulls", league: 'NBA', color: '#F78166' },
  { slug: "cleveland-cavaliers", name: "Cleveland Cavaliers", short: "Cavaliers", league: 'NBA', color: '#F78166' },
  { slug: "dallas-mavericks", name: "Dallas Mavericks", short: "Mavericks", league: 'NBA', color: '#F78166' },
  { slug: "denver-nuggets", name: "Denver Nuggets", short: "Nuggets", league: 'NBA', color: '#F78166' },
  { slug: "detroit-pistons", name: "Detroit Pistons", short: "Pistons", league: 'NBA', color: '#F78166' },
  { slug: "golden-state-warriors", name: "Golden State Warriors", short: "Warriors", league: 'NBA', color: '#F78166' },
  { slug: "houston-rockets", name: "Houston Rockets", short: "Rockets", league: 'NBA', color: '#F78166' },
  { slug: "indiana-pacers", name: "Indiana Pacers", short: "Pacers", league: 'NBA', color: '#F78166' },
  { slug: "la-clippers", name: "LA Clippers", short: "LA Clippers", league: 'NBA', color: '#F78166' },
  { slug: "los-angeles-lakers", name: "Los Angeles Lakers", short: "Lakers", league: 'NBA', color: '#F78166' },
  { slug: "memphis-grizzlies", name: "Memphis Grizzlies", short: "Grizzlies", league: 'NBA', color: '#F78166' },
  { slug: "miami-heat", name: "Miami Heat", short: "Heat", league: 'NBA', color: '#F78166' },
  { slug: "milwaukee-bucks", name: "Milwaukee Bucks", short: "Bucks", league: 'NBA', color: '#F78166' },
  { slug: "minnesota-timberwolves", name: "Minnesota Timberwolves", short: "Timberwolves", league: 'NBA', color: '#F78166' },
  { slug: "new-orleans-pelicans", name: "New Orleans Pelicans", short: "Pelicans", league: 'NBA', color: '#F78166' },
  { slug: "new-york-knicks", name: "New York Knicks", short: "Knicks", league: 'NBA', color: '#F78166' },
  { slug: "oklahoma-city-thunder", name: "Oklahoma City Thunder", short: "Thunder", league: 'NBA', color: '#F78166' },
  { slug: "orlando-magic", name: "Orlando Magic", short: "Magic", league: 'NBA', color: '#F78166' },
  { slug: "philadelphia-76ers", name: "Philadelphia 76ers", short: "76ers", league: 'NBA', color: '#F78166' },
  { slug: "phoenix-suns", name: "Phoenix Suns", short: "Suns", league: 'NBA', color: '#F78166' },
  { slug: "portland-trail-blazers", name: "Portland Trail Blazers", short: "Trail Blazers", league: 'NBA', color: '#F78166' },
  { slug: "sacramento-kings", name: "Sacramento Kings", short: "Kings", league: 'NBA', color: '#F78166' },
  { slug: "san-antonio-spurs", name: "San Antonio Spurs", short: "Spurs", league: 'NBA', color: '#F78166' },
  { slug: "toronto-raptors", name: "Toronto Raptors", short: "Raptors", league: 'NBA', color: '#F78166' },
  { slug: "utah-jazz", name: "Utah Jazz", short: "Jazz", league: 'NBA', color: '#F78166' },
  { slug: "washington-wizards", name: "Washington Wizards", short: "Wizards", league: 'NBA', color: '#F78166' },
  // MLB — 30 clubs
  { slug: "arizona-diamondbacks", name: "Arizona Diamondbacks", short: "Diamondbacks", league: 'MLB', color: '#D29922' },
  { slug: "atlanta-braves", name: "Atlanta Braves", short: "Braves", league: 'MLB', color: '#D29922' },
  { slug: "baltimore-orioles", name: "Baltimore Orioles", short: "Orioles", league: 'MLB', color: '#D29922' },
  { slug: "boston-red-sox", name: "Boston Red Sox", short: "Red Sox", league: 'MLB', color: '#D29922' },
  { slug: "chicago-cubs", name: "Chicago Cubs", short: "Cubs", league: 'MLB', color: '#D29922' },
  { slug: "chicago-white-sox", name: "Chicago White Sox", short: "White Sox", league: 'MLB', color: '#D29922' },
  { slug: "cincinnati-reds", name: "Cincinnati Reds", short: "Reds", league: 'MLB', color: '#D29922' },
  { slug: "cleveland-guardians", name: "Cleveland Guardians", short: "Guardians", league: 'MLB', color: '#D29922' },
  { slug: "colorado-rockies", name: "Colorado Rockies", short: "Rockies", league: 'MLB', color: '#D29922' },
  { slug: "detroit-tigers", name: "Detroit Tigers", short: "Tigers", league: 'MLB', color: '#D29922' },
  { slug: "houston-astros", name: "Houston Astros", short: "Astros", league: 'MLB', color: '#D29922' },
  { slug: "kansas-city-royals", name: "Kansas City Royals", short: "Royals", league: 'MLB', color: '#D29922' },
  { slug: "los-angeles-angels", name: "Los Angeles Angels", short: "Angels", league: 'MLB', color: '#D29922' },
  { slug: "los-angeles-dodgers", name: "Los Angeles Dodgers", short: "Dodgers", league: 'MLB', color: '#D29922' },
  { slug: "miami-marlins", name: "Miami Marlins", short: "Marlins", league: 'MLB', color: '#D29922' },
  { slug: "milwaukee-brewers", name: "Milwaukee Brewers", short: "Brewers", league: 'MLB', color: '#D29922' },
  { slug: "minnesota-twins", name: "Minnesota Twins", short: "Twins", league: 'MLB', color: '#D29922' },
  { slug: "new-york-mets", name: "New York Mets", short: "Mets", league: 'MLB', color: '#D29922' },
  { slug: "new-york-yankees", name: "New York Yankees", short: "Yankees", league: 'MLB', color: '#D29922' },
  { slug: "oakland-athletics", name: "Oakland Athletics", short: "Athletics", league: 'MLB', color: '#D29922' },
  { slug: "philadelphia-phillies", name: "Philadelphia Phillies", short: "Phillies", league: 'MLB', color: '#D29922' },
  { slug: "pittsburgh-pirates", name: "Pittsburgh Pirates", short: "Pirates", league: 'MLB', color: '#D29922' },
  { slug: "san-diego-padres", name: "San Diego Padres", short: "Padres", league: 'MLB', color: '#D29922' },
  { slug: "san-francisco-giants", name: "San Francisco Giants", short: "Giants", league: 'MLB', color: '#D29922' },
  { slug: "seattle-mariners", name: "Seattle Mariners", short: "Mariners", league: 'MLB', color: '#D29922' },
  { slug: "st-louis-cardinals", name: "St. Louis Cardinals", short: "Cardinals", league: 'MLB', color: '#D29922' },
  { slug: "tampa-bay-rays", name: "Tampa Bay Rays", short: "Rays", league: 'MLB', color: '#D29922' },
  { slug: "texas-rangers", name: "Texas Rangers", short: "Rangers", league: 'MLB', color: '#D29922' },
  { slug: "toronto-blue-jays", name: "Toronto Blue Jays", short: "Blue Jays", league: 'MLB', color: '#D29922' },
  { slug: "washington-nationals", name: "Washington Nationals", short: "Nationals", league: 'MLB', color: '#D29922' },
  // MLS — 30 clubs
  { slug: "atlanta-united", name: "Atlanta United", short: "Atlanta United", league: 'MLS', color: '#00B2A9' },
  { slug: "austin-fc", name: "Austin FC", short: "Austin FC", league: 'MLS', color: '#00B2A9' },
  { slug: "cf-montreal", name: "CF Montréal", short: "CF Montréal", league: 'MLS', color: '#00B2A9' },
  { slug: "charlotte-fc", name: "Charlotte FC", short: "Charlotte FC", league: 'MLS', color: '#00B2A9' },
  { slug: "chicago-fire", name: "Chicago Fire", short: "Chicago Fire", league: 'MLS', color: '#00B2A9' },
  { slug: "colorado-rapids", name: "Colorado Rapids", short: "Colorado Rapids", league: 'MLS', color: '#00B2A9' },
  { slug: "columbus-crew", name: "Columbus Crew", short: "Columbus Crew", league: 'MLS', color: '#00B2A9' },
  { slug: "d-c-united", name: "D.C. United", short: "D.C. United", league: 'MLS', color: '#00B2A9' },
  { slug: "fc-cincinnati", name: "FC Cincinnati", short: "FC Cincinnati", league: 'MLS', color: '#00B2A9' },
  { slug: "fc-dallas", name: "FC Dallas", short: "FC Dallas", league: 'MLS', color: '#00B2A9' },
  { slug: "houston-dynamo", name: "Houston Dynamo", short: "Houston Dynamo", league: 'MLS', color: '#00B2A9' },
  { slug: "inter-miami", name: "Inter Miami", short: "Inter Miami", league: 'MLS', color: '#00B2A9' },
  { slug: "la-galaxy", name: "LA Galaxy", short: "LA Galaxy", league: 'MLS', color: '#00B2A9' },
  { slug: "lafc", name: "LAFC", short: "LAFC", league: 'MLS', color: '#00B2A9' },
  { slug: "minnesota-united", name: "Minnesota United", short: "Minnesota United", league: 'MLS', color: '#00B2A9' },
  { slug: "nashville-sc", name: "Nashville SC", short: "Nashville SC", league: 'MLS', color: '#00B2A9' },
  { slug: "new-england-revolution", name: "New England Revolution", short: "New England Revolution", league: 'MLS', color: '#00B2A9' },
  { slug: "new-york-city-fc", name: "New York City FC", short: "New York City FC", league: 'MLS', color: '#00B2A9' },
  { slug: "new-york-red-bulls", name: "New York Red Bulls", short: "New York Red Bulls", league: 'MLS', color: '#00B2A9' },
  { slug: "orlando-city", name: "Orlando City", short: "Orlando City", league: 'MLS', color: '#00B2A9' },
  { slug: "philadelphia-union", name: "Philadelphia Union", short: "Philadelphia Union", league: 'MLS', color: '#00B2A9' },
  { slug: "portland-timbers", name: "Portland Timbers", short: "Portland Timbers", league: 'MLS', color: '#00B2A9' },
  { slug: "real-salt-lake", name: "Real Salt Lake", short: "Real Salt Lake", league: 'MLS', color: '#00B2A9' },
  { slug: "san-diego-fc", name: "San Diego FC", short: "San Diego FC", league: 'MLS', color: '#00B2A9' },
  { slug: "san-jose-earthquakes", name: "San Jose Earthquakes", short: "San Jose Earthquakes", league: 'MLS', color: '#00B2A9' },
  { slug: "seattle-sounders", name: "Seattle Sounders", short: "Seattle Sounders", league: 'MLS', color: '#00B2A9' },
  { slug: "sporting-kansas-city", name: "Sporting Kansas City", short: "Sporting Kansas City", league: 'MLS', color: '#00B2A9' },
  { slug: "st-louis-city", name: "St. Louis City", short: "St. Louis City", league: 'MLS', color: '#00B2A9' },
  { slug: "toronto-fc", name: "Toronto FC", short: "Toronto FC", league: 'MLS', color: '#00B2A9' },
  { slug: "vancouver-whitecaps", name: "Vancouver Whitecaps", short: "Vancouver Whitecaps", league: 'MLS', color: '#00B2A9' },
]

/** Derived, never hand-typed: the number in the copy cannot drift from the list. */
export const GEAR_TEAM_COUNT = GEAR_TEAMS.length

export function getGearTeam(slug: string): GearTeam | undefined {
  return GEAR_TEAMS.find(t => t.slug === slug)
}

/** Leagues present, in display order. */
export const GEAR_LEAGUES = ['NHL', 'NFL', 'NBA', 'MLB', 'MLS'] as const

/** Count per league, for the hub's league chips. */
export function gearLeagueCounts(): Record<string, number> {
  const c: Record<string, number> = {}
  for (const t of GEAR_TEAMS) c[t.league] = (c[t.league] || 0) + 1
  return c
}
