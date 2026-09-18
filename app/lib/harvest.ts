/**
 * THE GAMES NOBODY HAS GRADED YET.
 *
 * ─── THE PROBLEM THIS SOLVES ────────────────────────────────────────────────
 *
 * /game renders "No games have been graded yet", the sitemap carries 258 URLs
 * of which 154 are merchandise and zero are games, and llms.txt tells answer
 * engines that "every game has a page for it at getscorebug.app/game". All
 * three of those are downstream of one decision: the index read
 * `engine_game_index` with `p_min_logs: 1`, so a game appeared only once a
 * human had logged it. With no users, that is the empty set, forever.
 *
 * Meanwhile the per-game pages themselves have worked the whole time. They
 * render, they carry structured data, they have a signed share card. Nothing
 * linked to them and nothing listed them, so nothing crawled them.
 *
 * ─── WHY THIS CAN EXIST WITH ZERO USERS ─────────────────────────────────────
 *
 * watchability() rates a finished game from the box score alone — margin,
 * overtime, comeback size, lead changes, what was at stake. It needs no
 * opinions, which means every game ever played already has a defensible answer
 * to "was it any good", and that answer is the only thing on this site that
 * scales before the product has an audience.
 *
 * So the index is built from finished fixtures, rated by the box score, and
 * the fan grade is layered on top wherever one exists. A game with grades is
 * strictly better than one without; a game without is still worth a page.
 *
 * ─── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 *
 * It is not a page per fixture ever played. app/matchups.ts and lib/teams.ts
 * both refuse to generate their full combinatorial space, for the same reason:
 * an index of thousands of near-identical pages is the doorway pattern, and it
 * is punished. This harvests a bounded recent window, ranked, and the pages it
 * surfaces are the ones with something to say — a one-goal overtime game rates
 * differently from a 40-point blowout, and the page says which and why.
 */

import { leagueFromSlug, gameSlug, LEAGUE_IDS } from './gamepage'
import { watchability } from './watchability'

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'

const str = (v: unknown): string => (v == null ? '' : String(v))
const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface GradedGame {
  id: string
  leagueId: string
  leagueName: string
  date: string
  homeName: string
  awayName: string
  homeAbbr: string
  awayAbbr: string
  homeScore: number | null
  awayScore: number | null
  /** 0-100 from the box score. Never null here — unrated games are dropped. */
  watch: number
  verdict: string
  summary: string
  href: string
}

/**
 * One league, one day. Finished games only, each rated.
 *
 * Shares Next's fetch cache with loadSlate() and loadGame(), which request the
 * same scoreboard URLs — so a day already fetched for a game page costs nothing
 * here. That overlap is the reason this sweeps by day rather than by any
 * cleverer route.
 */
export async function harvestDay(leagueId: string, date: string): Promise<GradedGame[]> {
  const lg = leagueFromSlug(leagueId)
  if (!lg || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  const day = date.replace(/-/g, '')
  const extra = lg.params ? `&${lg.params}` : ''

  let json: any
  try {
    const res = await fetch(`${ESPN}/${lg.path}/scoreboard?dates=${day}${extra}`, {
      /* An hour. A finished game's box score never changes, and the only thing
         a shorter window would buy is re-fetching yesterday all day. */
      next: { revalidate: 3600 },
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    /* ESPN being unreachable must degrade to "no games found today", never to
       a 500 on the index. The caller cannot tell the difference and does not
       need to: an empty harvest renders the honest empty state. */
    return []
  }

  const events = Array.isArray(json?.events) ? json.events : []
  return events.flatMap((raw: any): GradedGame[] => {
    const comp = (raw.competitions && raw.competitions[0]) || {}
    const st = (comp.status && comp.status.type) || {}
    if (!(st.completed === true || st.state === 'post')) return []

    const cs = Array.isArray(comp.competitors) ? comp.competitors : []
    const hRaw = cs.find((c: any) => c.homeAway === 'home')
    const aRaw = cs.find((c: any) => c.homeAway === 'away')
    if (!hRaw || !aRaw) return []

    const hTeam = hRaw.team || {}
    const aTeam = aRaw.team || {}
    const homeName = str(hTeam.displayName || hTeam.name)
    const awayName = str(aTeam.displayName || aTeam.name)
    const id = str(raw.id)
    if (!homeName || !awayName || !/^\d{6,}$/.test(id)) return []

    const scoreOf = (c: any): number | null =>
      c?.score != null && typeof c.score === 'object' ? num(c.score.displayValue) : num(c?.score)
    const homeScore = scoreOf(hRaw)
    const awayScore = scoreOf(aRaw)

    const w = watchability({
      sport: lg.sport,
      homeScore,
      awayScore,
      detail: str(st.detail || st.shortDetail),
      homeLine: null,
      awayLine: null,
      seasonType: num(raw.season?.type),
      homeRecord: Array.isArray(hRaw.records) && hRaw.records[0] ? str(hRaw.records[0].summary) : null,
      awayRecord: Array.isArray(aRaw.records) && aRaw.records[0] ? str(aRaw.records[0].summary) : null,
    })
    /* An unrated game has nothing to say, so it gets no row and no URL. That
       is the whole editorial standard here: a page earns its place by having
       an answer on it. */
    if (!w.rated) return []

    /* The date the game STARTED, in UTC, which is what the slug carries and
       what loadGame() will look the scoreboard up by. Deriving it from the
       event rather than from the query day matters for a late kick-off that
       ESPN files under the previous date. */
    const startMs = Date.parse(str(comp.date || raw.date))
    const startISO = Number.isFinite(startMs) ? new Date(startMs).toISOString() : `${date}T00:00:00.000Z`
    const realDate = startISO.slice(0, 10)

    return [{
      id,
      leagueId,
      leagueName: lg.name,
      date: realDate,
      homeName,
      awayName,
      homeAbbr: str(hTeam.abbreviation || hTeam.shortDisplayName).toUpperCase(),
      awayAbbr: str(aTeam.abbreviation || aTeam.shortDisplayName).toUpperCase(),
      homeScore,
      awayScore,
      watch: w.score,
      verdict: w.verdict,
      summary: w.summary,
      href: `/game/${leagueId.toLowerCase()}/${gameSlug(awayName, homeName, startISO, id)}`,
    }]
  })
}

/** YYYY-MM-DD for n days before now, UTC. */
export function daysAgo(n: number, now = Date.now()): string {
  return new Date(now - n * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Sweep a recent window across leagues.
 *
 * Batched rather than one big Promise.all: nineteen leagues times four days is
 * seventy-six requests, and firing those simultaneously at somebody else's
 * scoreboard is how an IP stops being served. Six at a time is quick when the
 * fetch cache is warm and polite when it is not.
 *
 * Out-of-season leagues cost one cached empty response each, which is cheaper
 * than maintaining a season calendar that would drift.
 */
export async function harvestRecent({
  days = 3,
  leagues = LEAGUE_IDS,
  minScore = 0,
  limit = 120,
  now = Date.now(),
  concurrency = 6,
}: {
  days?: number
  leagues?: string[]
  minScore?: number
  limit?: number
  now?: number
  concurrency?: number
} = {}): Promise<GradedGame[]> {
  const jobs: Array<[string, string]> = []
  for (const lg of leagues) {
    for (let d = 0; d < days; d++) jobs.push([lg, daysAgo(d, now)])
  }

  const out: GradedGame[] = []
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(([lg, date]) => harvestDay(lg, date)))
    for (const r of results) out.push(...r)
  }

  /* One row per game id. The same fixture appears twice when a late start puts
     it on both the queried day and its own real date. */
  const seen = new Set<string>()
  const unique = out.filter((g) => {
    const k = `${g.leagueId}:${g.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return unique
    .filter((g) => g.watch >= minScore)
    .sort((a, b) => (b.watch - a.watch) || (a.date < b.date ? 1 : -1))
    .slice(0, limit)
}
