/**
 * SCOREBUG // THE DATA BEHIND A GAME PAGE
 *
 * One game, from two sources answering two different questions:
 *
 *   ESPN      what happened — score, overtime, line scores, records. Public
 *             record, there the moment the game ends, and there for every game
 *             back to 2002.
 *   SUPABASE  what the people who watched it thought. Ours alone, and the whole
 *             reason this page can exist.
 *
 * Both fail soft. A page with a scoreline and no grades is useful; grades with
 * no scoreline are not, so ESPN is the one that gates rendering.
 *
 * ─── WHY THE SCOREBOARD AND NOT THE SUMMARY ENDPOINT ────────────────────────
 *
 * ESPN also serves /summary?event=<id>, which looks like the obvious choice for
 * one game. This uses /scoreboard?dates=<day> instead, for a reason worth
 * writing down: the engine ALREADY parses scoreboard events, in
 * dispatch/feed.js, and that parser is covered by tests against real captured
 * payloads. The summary endpoint has a different shape that nothing here has
 * ever verified — and ESPN is not reachable from the environment this was
 * written in, so "I think the field is called that" could not have been
 * checked. Every field path below is copied from the tested parser.
 *
 * It is also better cached: one request serves every game that league played
 * that day, so a night of NHL pages costs one fetch rather than twelve.
 *
 * ─── WHY THE ESPN ID IS IN THE URL ──────────────────────────────────────────
 * The app already stores ESPN's event id as `game_records.game_id`, so it is
 * the join key between "what happened" and "what people said" with nothing in
 * between to go wrong. The date is in the URL too, which is what lets a single
 * scoreboard call find it.
 */

import { createHmac } from 'node:crypto'
import { watchability, type GameShape, type Sport, type Watchability } from './watchability'
import { SITE } from '../config'

/** id → sport, ESPN path, extra query. Hand-mirrored from engine/functions/dispatch/leagues.js. */
const LEAGUES: Record<string, { sport: Sport; path: string; name: string; params?: string }> = {
  NHL:     { sport: 'hockey',     path: 'hockey/nhl',                         name: 'NHL' },
  NFL:     { sport: 'football',   path: 'football/nfl',                       name: 'NFL' },
  NBA:     { sport: 'basketball', path: 'basketball/nba',                     name: 'NBA' },
  MLB:     { sport: 'baseball',   path: 'baseball/mlb',                       name: 'MLB' },
  IPL:     { sport: 'cricket',    path: 'cricket/8048',                       name: 'IPL' },
  CFL:     { sport: 'football',   path: 'football/cfl',                       name: 'CFL' },
  NCAAF:   { sport: 'football',   path: 'football/college-football',          name: 'College Football' },
  NCAAB:   { sport: 'basketball', path: 'basketball/mens-college-basketball', name: 'College Basketball', params: 'groups=50' },
  EPL:     { sport: 'soccer',     path: 'soccer/eng.1',                       name: 'Premier League' },
  UCL:     { sport: 'soccer',     path: 'soccer/uefa.champions',              name: 'Champions League' },
  LALIGA:  { sport: 'soccer',     path: 'soccer/esp.1',                       name: 'La Liga' },
  SERIEA:  { sport: 'soccer',     path: 'soccer/ita.1',                       name: 'Serie A' },
  BUND:    { sport: 'soccer',     path: 'soccer/ger.1',                       name: 'Bundesliga' },
  LIGUE1:  { sport: 'soccer',     path: 'soccer/fra.1',                       name: 'Ligue 1' },
  MLS:     { sport: 'soccer',     path: 'soccer/usa.1',                       name: 'MLS' },
  CSL:     { sport: 'soccer',     path: 'soccer/chn.1',                       name: 'Chinese Super League' },
  ISL:     { sport: 'soccer',     path: 'soccer/ind.1',                       name: 'Indian Super League' },
  JLEAGUE: { sport: 'soccer',     path: 'soccer/jpn.1',                       name: 'J.League' },
  /* F1 is deliberately absent. A race has entrants, not a home and an away, so
     there is no scoreline to rate and no "was it close" to answer. The engine
     makes the same exclusion in its anniversary finder, for the same reason. */
}

export const LEAGUE_IDS = Object.keys(LEAGUES)
export function leagueFromSlug(slug: string) {
  const id = String(slug || '').toUpperCase()
  return LEAGUES[id] ? { id, ...LEAGUES[id] } : null
}

export interface Team { name: string; abbr: string; score: number | null; scoreText: string | null; logo: string | null; record: string | null; winner: boolean }
export interface Community { logs: number; avg: number; dist: [number, number, number, number, number] }
export interface GamePage {
  id: string
  leagueId: string
  leagueName: string
  sport: Sport
  startISO: string | null
  detail: string
  completed: boolean
  venue: string | null
  home: Team
  away: Team
  watch: Watchability
  community: Community | null
  /** The canonical slug, so a wrong one redirects instead of duplicating the page. */
  slug: string
}

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'

const str = (v: unknown): string => (v == null ? '' : String(v)).trim()
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** "St. Louis Blues" → "st-louis-blues". */
export function slugifyTeam(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** away-vs-home-YYYY-MM-DD-<espnId>. Date and id both parse straight back out. */
export function gameSlug(away: string, home: string, startISO: string | null, id: string): string {
  const date = startISO ? startISO.slice(0, 10) : ''
  return [slugifyTeam(away), 'vs', slugifyTeam(home), date, id].filter(Boolean).join('-')
}

/** Pull the date and id a slug carries. Team names never end in a date or a long number. */
export function parseSlug(slug: string): { date: string; id: string } | null {
  const m = String(slug || '').match(/-(\d{4}-\d{2}-\d{2})-(\d{6,})$/)
  return m ? { date: m[1], id: m[2] } : null
}

/** ESPN's competitor shape — field paths copied from the engine's tested parser. */
function side(c: any): Team | null {
  if (!c) return null
  const t = c.team || {}
  /* Cricket sends score as an object with displayValue ("185/6"); everything
     else sends a number-ish string. Both are kept: the text for display, the
     number for arithmetic, null when there isn't one. */
  const scoreText = c.score != null && typeof c.score === 'object' ? str(c.score.displayValue) : str(c.score)
  return {
    name: str(t.displayName || t.name),
    abbr: str(t.abbreviation || t.shortDisplayName).toUpperCase(),
    score: num(scoreText),
    scoreText: scoreText || null,
    logo: str(t.logo) || (Array.isArray(t.logos) && t.logos[0]?.href ? str(t.logos[0].href) : null) || null,
    record: Array.isArray(c.records) && c.records[0] ? str(c.records[0].summary) || null : null,
    winner: c.winner === true,
  }
}

function lineOf(c: any): number[] | null {
  if (!Array.isArray(c?.linescores)) return null
  const out = c.linescores.map((l: any) => num(l?.value)).filter((v: number | null) => v != null) as number[]
  return out.length ? out : null
}

/**
 * One game. Fetches the whole day's scoreboard for that league — cached, and
 * shared by every other game on the same card — then picks the event out by id.
 */
export async function loadGame(leagueSlug: string, date: string, id: string): Promise<GamePage | null> {
  const lg = leagueFromSlug(leagueSlug)
  if (!lg || !/^\d{6,}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const extra = lg.params ? `&${lg.params}` : ''
  let json: any
  try {
    const res = await fetch(`${ESPN}/${lg.path}/scoreboard?dates=${date.replace(/-/g, '')}${extra}`, {
      next: { revalidate: 86400 },     // a final never changes
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    json = await res.json()
  } catch { return null }

  const raw = (Array.isArray(json?.events) ? json.events : []).find((e: any) => String(e?.id) === id)
  if (!raw) return null

  const comp = (raw.competitions && raw.competitions[0]) || {}
  const st = (comp.status && comp.status.type) || (raw.status && raw.status.type) || {}
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : []
  const homeC = competitors.find((c: any) => c.homeAway === 'home')
  const awayC = competitors.find((c: any) => c.homeAway === 'away')
  const home = side(homeC), away = side(awayC)
  if (!home || !away) return null

  const statusName = str(st.name).toUpperCase()
  const detail = str(st.detail || st.shortDetail || st.description)
  const completed = st.completed === true || st.state === 'post'
  /* A postponed or cancelled fixture is not a game that was any good or bad.
     Rating one would be a category error, so it simply is not rated. */
  const abandoned = /POSTPONED|CANCEL|SUSPEND/.test(statusName) || /postponed|cancel|suspend/i.test(detail)
  const startMs = Date.parse(comp.date || raw.date)
  const startISO = Number.isFinite(startMs) ? new Date(startMs).toISOString() : null

  const shape: GameShape = {
    sport: lg.sport,
    homeScore: completed && !abandoned ? home.score : null,
    awayScore: completed && !abandoned ? away.score : null,
    detail,
    homeLine: lineOf(homeC),
    awayLine: lineOf(awayC),
    seasonType: num(raw.season?.type),
    homeRecord: home.record,
    awayRecord: away.record,
  }

  return {
    id,
    leagueId: lg.id,
    leagueName: lg.name,
    sport: lg.sport,
    startISO,
    detail,
    completed: completed && !abandoned,
    venue: str(comp.venue?.fullName) || null,
    home,
    away,
    watch: watchability(shape),
    community: null,
    slug: gameSlug(away.name, home.name, startISO, id),
  }
}

/**
 * What the stands said. Counts and an average — never a username, a note or a
 * date, because those were shared inside the app and not to a search engine.
 * null means nobody has logged it, which the page says plainly rather than
 * dressing up as a zero.
 */
export async function loadCommunity(gameId: string): Promise<Community | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/engine_game_page`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_game_id: gameId }),
      next: { revalidate: 900 },
    })
    if (!res.ok) return null
    const rows = await res.json()
    const r = Array.isArray(rows) ? rows[0] : rows
    if (!r || !Number(r.logs)) return null
    return {
      logs: Number(r.logs) || 0,
      avg: Number(r.avg_grade) || 0,
      dist: [Number(r.g1) || 0, Number(r.g2) || 0, Number(r.g3) || 0, Number(r.g4) || 0, Number(r.g5) || 0],
    }
  } catch { return null }
}

export interface RecentGame {
  id: string; leagueId: string; leagueName: string; logs: number; avg: number
  homeTeam: string; awayTeam: string; homeAbbr: string; awayAbbr: string
  homeScore: number | null; awayScore: number | null
  /** A hint, not an authority — see the SQL. Used only to find the right scoreboard day. */
  dateHint: string | null
  href: string
}

/** The most recently logged games, for the index and for internal links. */
export async function loadRecent(limit = 60): Promise<RecentGame[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/engine_game_index`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_limit: limit, p_min_logs: 1 }),
      next: { revalidate: 1800 },
    })
    if (!res.ok) return []
    const rows = await res.json()
    if (!Array.isArray(rows)) return []
    return rows.flatMap((r: any) => {
      const leagueId = str(r.league).toUpperCase()
      const lg = LEAGUES[leagueId]
      if (!lg || !r.game_id) return []
      return [{
        id: str(r.game_id), leagueId, leagueName: lg.name,
        logs: Number(r.logs) || 0, avg: Number(r.avg_grade) || 0,
        homeTeam: str(r.home_team), awayTeam: str(r.away_team),
        homeAbbr: str(r.home_abbr), awayAbbr: str(r.away_abbr),
        homeScore: num(r.home_score), awayScore: num(r.away_score),
        dateHint: str(r.watched_on) ? str(r.watched_on).slice(0, 10) : null,
        /* Links go through the id resolver rather than a guessed slug: the index
           only has a date HINT, and a link to a slug with the wrong date in it
           is a 404 that search engines would happily index. The resolver finds
           the real day and redirects once, permanently. */
        href: `/game/${leagueId.toLowerCase()}/id/${str(r.game_id)}${str(r.watched_on) ? `?d=${str(r.watched_on).slice(0, 10)}` : ''}`,
      }]
    })
  } catch { return [] }
}


/** A day either side, so a one-day skew in the hint still finds the game. */
function neighbourDays(date: string): string[] {
  const t = Date.parse(`${date}T12:00:00Z`)
  if (!Number.isFinite(t)) return [date]
  const day = 86_400_000
  return [0, -1, 1].map(d => new Date(t + d * day).toISOString().slice(0, 10))
}

/**
 * Find a game from its id when the exact date is not known — the case for every
 * link built from the database, which stores when someone WATCHED rather than
 * when the game was played. Tries the hint, then the days either side.
 */
export async function resolveById(leagueSlug: string, id: string, hint: string | null): Promise<GamePage | null> {
  const days = hint && /^\d{4}-\d{2}-\d{2}$/.test(hint)
    ? neighbourDays(hint)
    : neighbourDays(new Date().toISOString().slice(0, 10))
  for (const d of days) {
    const g = await loadGame(leagueSlug, d, id)
    if (g) return g
  }
  return null
}


export interface SlateGame {
  id: string; home: string; away: string
  homeScore: number | null; awayScore: number | null
  time: string; final: boolean
  /** Only for finished games — an unplayed one has nothing to rate. */
  watch: number | null
  verdict: string
}

/**
 * Today's card for one league, with the finished games already rated.
 *
 * This is the bot's reason to be opened on an ordinary Tuesday: not "what was
 * the score" — every app on the phone does that — but "which of tonight's games
 * is worth staying up for", which nothing else answers.
 *
 * Returns null when ESPN could not be reached, so the caller can say so rather
 * than claiming there are no games. An empty array genuinely means no fixtures.
 */
export async function loadSlate(leagueId: string, date?: string): Promise<SlateGame[] | null> {
  const lg = leagueFromSlug(leagueId)
  if (!lg) return null
  const day = (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  const extra = lg.params ? `&${lg.params}` : ''
  let json: any
  try {
    const res = await fetch(`${ESPN}/${lg.path}/scoreboard?dates=${day}${extra}`, {
      // Short, because a live card changes. Long enough that a busy channel is one fetch.
      next: { revalidate: 300 },
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    json = await res.json()
  } catch { return null }

  const events = Array.isArray(json?.events) ? json.events : []
  return events.flatMap((raw: any): SlateGame[] => {
    const comp = (raw.competitions && raw.competitions[0]) || {}
    const st = (comp.status && comp.status.type) || {}
    const cs = Array.isArray(comp.competitors) ? comp.competitors : []
    const h = side(cs.find((c: any) => c.homeAway === 'home'))
    const a = side(cs.find((c: any) => c.homeAway === 'away'))
    if (!h || !a) return []
    const final = st.completed === true || st.state === 'post'
    const startMs = Date.parse(comp.date || raw.date)
    const w = final
      ? watchability({
          sport: lg.sport, homeScore: h.score, awayScore: a.score,
          detail: str(st.detail || st.shortDetail), homeLine: null, awayLine: null,
          seasonType: num(raw.season?.type), homeRecord: h.record, awayRecord: a.record,
        })
      : null
    return [{
      id: str(raw.id),
      home: h.abbr || h.name, away: a.abbr || a.name,
      homeScore: final ? h.score : null, awayScore: final ? a.score : null,
      time: Number.isFinite(startMs)
        ? new Date(startMs).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })
        : '',
      final,
      watch: w && w.rated ? w.score : null,
      verdict: w && w.rated ? w.verdict : '',
    }]
  })
}


/**
 * THE SHARE IMAGE FOR A GAME PAGE — and the cheapest distribution this site has.
 *
 * Every page on this domain currently shares as the same static og.png. So a
 * link to a specific game, pasted into Discord, iMessage, Slack, WhatsApp or X,
 * unfurls as a generic logo — indistinguishable from every other Scorebug link
 * and worth nothing to whoever is looking at it.
 *
 * The card press already renders a broadcast-quality scoreboard for exactly
 * this game, with the shields, the score and the community grade on it. Pointing
 * the page's openGraph image at that URL means every share of every game page
 * becomes a branded graphic showing the actual result — for free, using a
 * renderer that was already built and already paid for.
 *
 * There is no new route and no stored file: the card press is the image, and
 * the platforms cache it themselves.
 *
 * Claims are SIGNED. The community grade is a claim, so the URL carries an HMAC
 * — without which the press renders the card and silently drops the grade. That
 * is what stops somebody pasting a hand-made card URL into their own page's
 * meta tags and passing a fabricated Scorebug rating off as ours.
 */
export function signedCardUrl(params: Record<string, string>): string {
  const u = new URL(`${SITE}/api/card`)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  const key = process.env.DISPATCH_KEY
  if (key) {
    const pairs: string[] = []
    u.searchParams.forEach((v, k) => { if (k !== 'sig') pairs.push(`${k}=${v}`) })
    u.searchParams.set('sig', createHmac('sha256', key).update(pairs.sort().join('&')).digest('hex').slice(0, 24))
  }
  return u.toString()
}

export function shareCardUrl(g: GamePage): string {
  return signedCardUrl({
    k: 'final',
    size: 'wide',
    l: g.leagueId,
    a: g.away.abbr, an: g.away.name, as: g.away.scoreText ?? '',
    h: g.home.abbr, hn: g.home.name, hs: g.home.scoreText ?? '',
    d: g.completed ? (g.detail || 'Final') : 'Scheduled',
    ...(g.startISO
      ? { date: new Date(g.startISO).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
      : {}),
    ...(g.community
      ? { band: 'community', g: g.community.avg.toFixed(1), n: String(g.community.logs) }
      : {}),
  })
}
