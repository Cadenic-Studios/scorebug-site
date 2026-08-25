/**
 * A curated club list for the public gear hub.
 *
 * ─── WHY THIS IS NOT THE APP'S REGISTRY ──────────────────────────────────────
 * The app knows 793 teams. This is 32, and the difference is deliberate rather
 * than lazy: every entry here becomes a statically generated, indexable page,
 * and 793 near-identical affiliate pages is a doorway-page pattern — Google's
 * spam policy names "thin affiliate pages" and mass-generated low-value pages
 * explicitly. Thirty-two pages for the clubs people actually search, each with
 * real links, is a content surface. Eight hundred is a liability.
 *
 * ─── IT WILL DRIFT, AND THAT IS ACCEPTED ─────────────────────────────────────
 * Club names change (relocations, rebrands). This list has no automated tie to
 * lib/leagueRegistry.ts in the app repo — there is no shared package between the
 * two deployments. The cost of drift here is a Fanatics search that returns
 * slightly stale results, not a broken page, so a hand-maintained list is the
 * right trade against building a sync pipeline for a marketing page.
 *
 * Only leagues Fanatics actually carries are listed. The CFL and the European
 * football leagues are absent on purpose: a Fanatics search for "Saskatchewan
 * Roughriders" returns an empty page, and sending a fan to an empty shop is
 * worse than not linking at all. Those clubs still get eBay and tickets in the
 * app; this hub is Fanatics-led, so they are out of scope for it.
 */

export type GearTeam = {
  /** URL slug — also the static param. */
  slug: string
  /** Full club name, exactly as Fanatics and TicketNetwork search for it. */
  name: string
  /** Short form for headings. */
  short: string
  league: 'NHL' | 'NFL' | 'NBA' | 'MLB'
  /** Registry league colour, for the card accent. */
  color: string
}

export const GEAR_TEAMS: GearTeam[] = [
  // NHL
  { slug: 'edmonton-oilers',      name: 'Edmonton Oilers',      short: 'Oilers',      league: 'NHL', color: '#FF4C00' },
  { slug: 'toronto-maple-leafs',  name: 'Toronto Maple Leafs',  short: 'Maple Leafs', league: 'NHL', color: '#00205B' },
  { slug: 'montreal-canadiens',   name: 'Montreal Canadiens',   short: 'Canadiens',   league: 'NHL', color: '#AF1E2D' },
  { slug: 'boston-bruins',        name: 'Boston Bruins',        short: 'Bruins',      league: 'NHL', color: '#FFB81C' },
  { slug: 'new-york-rangers',     name: 'New York Rangers',     short: 'Rangers',     league: 'NHL', color: '#0038A8' },
  { slug: 'vegas-golden-knights', name: 'Vegas Golden Knights', short: 'Golden Knights', league: 'NHL', color: '#B4975A' },
  { slug: 'colorado-avalanche',   name: 'Colorado Avalanche',   short: 'Avalanche',   league: 'NHL', color: '#6F263D' },
  { slug: 'new-jersey-devils',    name: 'New Jersey Devils',    short: 'Devils',      league: 'NHL', color: '#CE1126' },

  // NFL
  { slug: 'kansas-city-chiefs',   name: 'Kansas City Chiefs',   short: 'Chiefs',      league: 'NFL', color: '#E31837' },
  { slug: 'dallas-cowboys',       name: 'Dallas Cowboys',       short: 'Cowboys',     league: 'NFL', color: '#003594' },
  { slug: 'philadelphia-eagles',  name: 'Philadelphia Eagles',  short: 'Eagles',      league: 'NFL', color: '#004C54' },
  { slug: 'san-francisco-49ers',  name: 'San Francisco 49ers',  short: '49ers',       league: 'NFL', color: '#AA0000' },
  { slug: 'buffalo-bills',        name: 'Buffalo Bills',        short: 'Bills',       league: 'NFL', color: '#00338D' },
  { slug: 'green-bay-packers',    name: 'Green Bay Packers',    short: 'Packers',     league: 'NFL', color: '#203731' },
  { slug: 'detroit-lions',        name: 'Detroit Lions',        short: 'Lions',       league: 'NFL', color: '#0076B6' },
  { slug: 'baltimore-ravens',     name: 'Baltimore Ravens',     short: 'Ravens',      league: 'NFL', color: '#241773' },

  // NBA
  { slug: 'los-angeles-lakers',   name: 'Los Angeles Lakers',   short: 'Lakers',      league: 'NBA', color: '#552583' },
  { slug: 'boston-celtics',       name: 'Boston Celtics',       short: 'Celtics',     league: 'NBA', color: '#007A33' },
  { slug: 'golden-state-warriors',name: 'Golden State Warriors',short: 'Warriors',    league: 'NBA', color: '#1D428A' },
  { slug: 'toronto-raptors',      name: 'Toronto Raptors',      short: 'Raptors',     league: 'NBA', color: '#CE1141' },
  { slug: 'denver-nuggets',       name: 'Denver Nuggets',       short: 'Nuggets',     league: 'NBA', color: '#0E2240' },
  { slug: 'new-york-knicks',      name: 'New York Knicks',      short: 'Knicks',      league: 'NBA', color: '#F58426' },
  { slug: 'oklahoma-city-thunder',name: 'Oklahoma City Thunder',short: 'Thunder',     league: 'NBA', color: '#007AC1' },
  { slug: 'miami-heat',           name: 'Miami Heat',           short: 'Heat',        league: 'NBA', color: '#98002E' },

  // MLB
  { slug: 'toronto-blue-jays',    name: 'Toronto Blue Jays',    short: 'Blue Jays',   league: 'MLB', color: '#134A8E' },
  { slug: 'new-york-yankees',     name: 'New York Yankees',     short: 'Yankees',     league: 'MLB', color: '#003087' },
  { slug: 'los-angeles-dodgers',  name: 'Los Angeles Dodgers',  short: 'Dodgers',     league: 'MLB', color: '#005A9C' },
  { slug: 'boston-red-sox',       name: 'Boston Red Sox',       short: 'Red Sox',     league: 'MLB', color: '#BD3039' },
  { slug: 'chicago-cubs',         name: 'Chicago Cubs',         short: 'Cubs',        league: 'MLB', color: '#0E3386' },
  { slug: 'atlanta-braves',       name: 'Atlanta Braves',       short: 'Braves',      league: 'MLB', color: '#CE1141' },
  { slug: 'philadelphia-phillies',name: 'Philadelphia Phillies',short: 'Phillies',    league: 'MLB', color: '#E81828' },
  { slug: 'houston-astros',       name: 'Houston Astros',       short: 'Astros',      league: 'MLB', color: '#EB6E1F' },
]

export function getGearTeam(slug: string): GearTeam | undefined {
  return GEAR_TEAMS.find(t => t.slug === slug)
}

export const GEAR_LEAGUES = ['NHL', 'NFL', 'NBA', 'MLB'] as const
