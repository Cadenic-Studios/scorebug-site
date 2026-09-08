/**
 * The leagues Scorebug actually supports.
 *
 * ─── HAND-MIRRORED FROM THE APP, ON PURPOSE ─────────────────────────────────
 * The source of truth is `lib/leagueRegistry.ts` in the scorebug-app repo. This
 * is a separate deployment with no shared package, so the list is copied rather
 * than imported — the same hand-sync convention the app's tailwind.config.js
 * already documents for lib/palette.ts. The `color` values are the registry's
 * own league colours, so the badge bar and the app agree.
 *
 * IF YOU ADD A LEAGUE: add it in the registry FIRST, then here, then update the
 * count in `LEAGUE_COUNT` below — which is derived, so it cannot drift.
 *
 * ─── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────
 * PGA and UFC. Neither exists in the app: a repo-wide search of the registry
 * for PGA, UFC, golf and MMA returns nothing, and there is no ESPN slug, no
 * scoreboard route and no sport surface for either. Advertising a league the
 * app cannot log is the most damaging kind of marketing copy, because the
 * visitor discovers it is untrue about ninety seconds after installing.
 * If golf or MMA ship later, they go in the registry first.
 */

export type SiteLeague = {
  /** Registry id, used as the React key. */
  id: string
  /** What goes on the badge. Short enough to read at a glance. */
  label: string
  /** Spelled-out name, used for the tooltip and for assistive tech. This is
   *  also the string an answer engine is most likely to match on. */
  full: string
  /** The registry's league colour. */
  color: string
  sport: 'Hockey' | 'Football' | 'Basketball' | 'Baseball' | 'Soccer' | 'Racing' | 'Cricket'
  /** Where the league plays, written the way a person would say it. Drives the
   *  "one app, not a North American one" story on the sport hubs, and is the
   *  detail an answer engine needs in order to place a league for a reader who
   *  is not American. */
  country: string
  /** Coarse region, used to group the hubs. */
  region: 'North America' | 'Europe' | 'Asia'
  /**
   * The actual countries this league plays in — the thing a "countries covered"
   * figure must be counted from.
   *
   * It exists separately from `country` above because `country` is a DISPLAY
   * string, and counting display strings gets the answer wrong: deduping
   * 'United States', 'Canada' and 'United States and Canada' yields three
   * countries where there are two. A hub that prints a derived figure has to
   * derive it from something that is actually a set of countries.
   *
   * Empty for a continental competition: the Champions League adds no country
   * that its clubs' domestic leagues do not already account for, and claiming
   * every UEFA member would inflate the figure in the other direction.
   */
  nations: string[]
  /**
   * The name to put in a SHOP query, when the league's own full name makes a
   * bad one. Falls back to `full`.
   *
   * "J1 League (Japan) shirt" is the case that forced this: a parenthetical in
   * a marketplace search is dead weight at best and a zero-result filter at
   * worst. "NCAA College Football" is the other — retailers file that under
   * "College Football", and the acronym returns almost nothing.
   *
   * NOTE: these are judgement calls, not measured ones. eBay bot-blocks
   * scripted requests (a search fetched from a script returns an 1,832-byte
   * stub with no listings), so result counts could not be compared. If a
   * league's gear rail underperforms in the affiliate reports, this string is
   * the first thing to change.
   */
  shopName?: string
  /**
   * Which football this is. Only meaningful when `sport` is 'Football' or
   * 'Soccer', and it is the whole reason /football can serve both codes without
   * lying to either: they share a name and share nothing else.
   */
  code?: 'gridiron' | 'association'
}

/**
 * Ordered the way the app's own league registry orders them: the four North
 * American majors, then Formula 1, then the remaining North American leagues,
 * then the football/soccer competitions by global audience. A visitor scanning
 * left to right should hit the league they came for as early as possible.
 */
export const LEAGUES: SiteLeague[] = [
  { id: 'NHL',    label: 'NHL',          full: 'National Hockey League',        color: '#58A6FF', sport: 'Hockey', country: 'United States and Canada', region: 'North America', nations: ['United States', 'Canada'] },
  { id: 'NFL',    label: 'NFL',          full: 'National Football League',      color: '#A371F7', sport: 'Football', country: 'United States', region: 'North America', code: 'gridiron', nations: ['United States'] },
  { id: 'NBA',    label: 'NBA',          full: 'National Basketball Association', color: '#F78166', sport: 'Basketball', country: 'United States and Canada', region: 'North America', nations: ['United States', 'Canada'] },
  { id: 'MLB',    label: 'MLB',          full: 'Major League Baseball',         color: '#D29922', sport: 'Baseball', country: 'United States and Canada', region: 'North America', nations: ['United States', 'Canada'] },
  { id: 'F1',     label: 'F1',           full: 'Formula 1',                     color: '#E10600', sport: 'Racing', country: 'Worldwide', region: 'Europe', nations: [] },
  // Sits here for the same reason F1 does: the registry orders global
  // competitions above domestic ones, and the IPL is the largest cricket
  // league in the world.
  { id: 'IPL',    label: 'IPL',          full: 'Indian Premier League',         color: '#7E22CE', sport: 'Cricket', country: 'India', region: 'Asia', nations: ['India'] },
  { id: 'CFL',    label: 'CFL',          full: 'Canadian Football League',      color: '#10B981', sport: 'Football', country: 'Canada', region: 'North America', code: 'gridiron', nations: ['Canada'], shopName: 'CFL' },
  { id: 'NCAAF',  label: 'NCAAF',        full: 'NCAA College Football',         color: '#EC4899', sport: 'Football', country: 'United States', region: 'North America', code: 'gridiron', nations: ['United States'], shopName: 'College Football' },
  { id: 'NCAAB',  label: 'NCAAB',        full: "NCAA Men's College Basketball", color: '#EA580C', sport: 'Basketball', country: 'United States', region: 'North America', nations: ['United States'], shopName: 'College Basketball' },
  { id: 'EPL',    label: 'Premier League', full: 'English Premier League',      color: '#963CFF', sport: 'Soccer', country: 'England', region: 'Europe', code: 'association', nations: ['England'], shopName: 'Premier League' },
  { id: 'UCL',    label: 'Champions Lg', full: 'UEFA Champions League',         color: '#4453D6', sport: 'Soccer', country: 'Europe-wide', region: 'Europe', code: 'association', nations: [], shopName: 'Champions League' },
  { id: 'LALIGA', label: 'La Liga',      full: 'La Liga',                       color: '#E11D48', sport: 'Soccer', country: 'Spain', region: 'Europe', code: 'association', nations: ['Spain'] },
  { id: 'SERIEA', label: 'Serie A',      full: 'Serie A',                       color: '#0EA5E9', sport: 'Soccer', country: 'Italy', region: 'Europe', code: 'association', nations: ['Italy'] },
  { id: 'BUND',   label: 'Bundesliga',   full: 'Bundesliga',                    color: '#84CC16', sport: 'Soccer', country: 'Germany', region: 'Europe', code: 'association', nations: ['Germany'] },
  { id: 'LIGUE1', label: 'Ligue 1',      full: 'Ligue 1',                       color: '#F59E0B', sport: 'Soccer', country: 'France', region: 'Europe', code: 'association', nations: ['France'] },
  { id: 'MLS',    label: 'MLS',          full: 'Major League Soccer',           color: '#00B2A9', sport: 'Soccer', country: 'United States and Canada', region: 'North America', code: 'association', nations: ['United States', 'Canada'] },
  { id: 'CSL',    label: 'Chinese SL',   full: 'Chinese Super League',          color: '#C026D3', sport: 'Soccer', country: 'China', region: 'Asia', code: 'association', nations: ['China'] },
  { id: 'ISL',    label: 'Indian SL',    full: 'Indian Super League',           color: '#FF9933', sport: 'Soccer', country: 'India', region: 'Asia', code: 'association', nations: ['India'] },
  { id: 'JLEAGUE',label: 'J.League',     full: 'J1 League (Japan)',             color: '#BC002D', sport: 'Soccer', country: 'Japan', region: 'Asia', code: 'association', nations: ['Japan'], shopName: 'J.League' },
]

/** Derived, never typed twice. The page quotes this count in several places and
 *  they used to be hardcoded "15"s that could quietly disagree with the list. */
export const LEAGUE_COUNT = LEAGUES.length

/** The team leagues, i.e. everything except Formula 1, which has no clubs. The
 *  Starting Lineup caps are expressed against this number, not LEAGUE_COUNT. */
export const TEAM_LEAGUE_COUNT = LEAGUES.filter(l => l.sport !== 'Racing').length

/** One comma-separated string for metadata, JSON-LD and answer engines. */
export const LEAGUE_SENTENCE = LEAGUES.map(l => l.full).join(', ')
