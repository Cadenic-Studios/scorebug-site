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
  sport: 'Hockey' | 'Football' | 'Basketball' | 'Baseball' | 'Soccer' | 'Racing'
}

/**
 * Ordered the way the app's own league registry orders them: the four North
 * American majors, then Formula 1, then the remaining North American leagues,
 * then the football/soccer competitions by global audience. A visitor scanning
 * left to right should hit the league they came for as early as possible.
 */
export const LEAGUES: SiteLeague[] = [
  { id: 'NHL',    label: 'NHL',          full: 'National Hockey League',        color: '#58A6FF', sport: 'Hockey' },
  { id: 'NFL',    label: 'NFL',          full: 'National Football League',      color: '#A371F7', sport: 'Football' },
  { id: 'NBA',    label: 'NBA',          full: 'National Basketball Association', color: '#F78166', sport: 'Basketball' },
  { id: 'MLB',    label: 'MLB',          full: 'Major League Baseball',         color: '#D29922', sport: 'Baseball' },
  { id: 'F1',     label: 'F1',           full: 'Formula 1',                     color: '#E10600', sport: 'Racing' },
  { id: 'CFL',    label: 'CFL',          full: 'Canadian Football League',      color: '#10B981', sport: 'Football' },
  { id: 'NCAAF',  label: 'NCAAF',        full: 'NCAA College Football',         color: '#EC4899', sport: 'Football' },
  { id: 'NCAAB',  label: 'NCAAB',        full: "NCAA Men's College Basketball", color: '#EA580C', sport: 'Basketball' },
  { id: 'EPL',    label: 'Premier League', full: 'English Premier League',      color: '#963CFF', sport: 'Soccer' },
  { id: 'UCL',    label: 'Champions Lg', full: 'UEFA Champions League',         color: '#4453D6', sport: 'Soccer' },
  { id: 'LALIGA', label: 'La Liga',      full: 'La Liga',                       color: '#E11D48', sport: 'Soccer' },
  { id: 'SERIEA', label: 'Serie A',      full: 'Serie A',                       color: '#0EA5E9', sport: 'Soccer' },
  { id: 'BUND',   label: 'Bundesliga',   full: 'Bundesliga',                    color: '#84CC16', sport: 'Soccer' },
  { id: 'LIGUE1', label: 'Ligue 1',      full: 'Ligue 1',                       color: '#F59E0B', sport: 'Soccer' },
  { id: 'MLS',    label: 'MLS',          full: 'Major League Soccer',           color: '#00B2A9', sport: 'Soccer' },
]

/** Derived, never typed twice. The page quotes this count in several places and
 *  they used to be hardcoded "15"s that could quietly disagree with the list. */
export const LEAGUE_COUNT = LEAGUES.length

/** The team leagues, i.e. everything except Formula 1, which has no clubs. The
 *  Starting Lineup caps are expressed against this number, not LEAGUE_COUNT. */
export const TEAM_LEAGUE_COUNT = LEAGUES.filter(l => l.sport !== 'Racing').length

/** One comma-separated string for metadata, JSON-LD and answer engines. */
export const LEAGUE_SENTENCE = LEAGUES.map(l => l.full).join(', ')
