import 'server-only'

/**
 * SCOREBUG // THE ENGINE'S PUBLISHED CONTENT
 *
 * The marketing engine (scorebug-site/engine) writes one weekly slate per
 * Monday into Firestore at dispatch/public/articles/{week}. This module is
 * how the site reads it.
 *
 * ─── WHY THE REST API AND NOT THE FIREBASE SDK ──────────────────────────────
 * This site ships no Firebase SDK and should not start for one document a
 * week. Firestore's REST API is a plain `fetch`, participates in Next's data
 * cache like every other feed here, and costs thirty lines of typed-value
 * decoding. The API key is the project's public web key — it identifies the
 * project and authorises nothing; firestore.rules grant world read on
 * dispatch/public/articles/** and deny everything else under /dispatch.
 *
 * ─── FAILURE POSTURE ────────────────────────────────────────────────────────
 * Never throws. A missing week is `null` and the route 404s; a failing
 * upstream is an empty list and the index renders its empty state. A slate
 * page is a nice-to-have; it must not be able to take a route down.
 */

const PROJECT = process.env.NEXT_PUBLIC_ENGINE_PROJECT_ID ?? 'scorebug-engine'
const API_KEY = process.env.NEXT_PUBLIC_ENGINE_API_KEY ?? ''
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

export type SlateGame = {
  id: string
  espnId: string | null
  source: string | null
  start: string
  day: string
  date: string
  time: string
  away: string | null
  home: string | null
  awayAbbr: string | null
  homeAbbr: string | null
  name: string | null
  venue: string | null
  city: string | null
  broadcast: string | null
  note: string | null
  seasonType: number | null
  week: number | null
  postponed: boolean
}

export type SlateLeague = { league: string; name: string; count: number; games: SlateGame[] }

export type Slate = {
  slug: string
  monday: string
  range: string
  title: string
  count: number
  leagues: number
  byLeague: SlateLeague[]
  highlights: string[]
  canonical: string
  publishedAt: string
  firstPublishedAt?: string
}

type FirestoreValue = Record<string, unknown>

function decode(value: FirestoreValue | undefined): unknown {
  if (!value || typeof value !== 'object') return null
  if ('stringValue' in value) return String(value.stringValue)
  if ('booleanValue' in value) return Boolean(value.booleanValue)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return String(value.timestampValue)
  if ('nullValue' in value) return null
  if ('arrayValue' in value) {
    const arr = (value.arrayValue as { values?: FirestoreValue[] })?.values ?? []
    return arr.map(v => decode(v))
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, FirestoreValue> })?.fields ?? {}
    return decodeFields(fields)
  }
  return null
}
function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v)
  return out
}

async function get(path: string, revalidate: number): Promise<Record<string, unknown> | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch(`${BASE}/${path}?key=${API_KEY}`, { next: { revalidate } })
    if (!res.ok) return null
    const body = (await res.json()) as { fields?: Record<string, FirestoreValue> }
    return body.fields ? decodeFields(body.fields) : null
  } catch { return null }
}
async function list(path: string, revalidate: number): Promise<Array<Record<string, unknown>>> {
  if (!API_KEY) return []
  try {
    const res = await fetch(`${BASE}/${path}?key=${API_KEY}&pageSize=100`, { next: { revalidate } })
    if (!res.ok) return []
    const body = (await res.json()) as { documents?: Array<{ fields?: Record<string, FirestoreValue> }> }
    return (body.documents ?? []).map(d => (d.fields ? decodeFields(d.fields) : {}))
  } catch { return [] }
}

const s = (r: Record<string, unknown>, k: string): string | null => (typeof r[k] === 'string' && r[k] ? (r[k] as string) : null)
const n = (r: Record<string, unknown>, k: string): number | null => (Number.isFinite(Number(r[k])) && r[k] != null ? Number(r[k]) : null)

function asGame(raw: unknown): SlateGame | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!r.id || !r.start) return null
  return {
    id: String(r.id), espnId: s(r, 'espnId'), source: s(r, 'source'), start: String(r.start),
    day: s(r, 'day') ?? '', date: s(r, 'date') ?? '', time: s(r, 'time') ?? '',
    away: s(r, 'away'), home: s(r, 'home'), awayAbbr: s(r, 'awayAbbr'), homeAbbr: s(r, 'homeAbbr'), name: s(r, 'name'),
    venue: s(r, 'venue'), city: s(r, 'city'), broadcast: s(r, 'broadcast'), note: s(r, 'note'),
    seasonType: n(r, 'seasonType'), week: n(r, 'week'), postponed: r.postponed === true,
  }
}

function asSlate(raw: Record<string, unknown> | null): Slate | null {
  if (!raw || typeof raw.slug !== 'string' || typeof raw.title !== 'string') return null
  const byLeague = Array.isArray(raw.byLeague)
    ? (raw.byLeague as unknown[]).map(l => {
      if (!l || typeof l !== 'object') return null
      const r = l as Record<string, unknown>
      return { league: String(r.league ?? ''), name: String(r.name ?? r.league ?? ''), count: Number(r.count) || 0, games: Array.isArray(r.games) ? (r.games as unknown[]).map(asGame).filter((g): g is SlateGame => !!g) : [] }
    }).filter((l): l is SlateLeague => !!l && !!l.league)
    : []
  return {
    slug: raw.slug,
    monday: s(raw, 'monday') ?? '',
    range: s(raw, 'range') ?? '',
    title: raw.title,
    count: Number(raw.count) || 0,
    leagues: Number(raw.leagues) || byLeague.length,
    byLeague,
    highlights: Array.isArray(raw.highlights) ? (raw.highlights as unknown[]).map(String) : [],
    canonical: s(raw, 'canonical') ?? '',
    publishedAt: s(raw, 'publishedAt') ?? '',
    firstPublishedAt: s(raw, 'firstPublishedAt') ?? undefined,
  }
}

/** One week's slate, or null. Revalidates hourly: the engine refreshes it on Mondays and fixtures move. */
export async function readSlate(week: string): Promise<Slate | null> {
  if (!/^\d{4}-W\d{2}$/.test(week)) return null
  /* The shape check is load-bearing — `week` is interpolated straight into the
     Firestore REST path below — but on its own it admits a million distinct
     slugs, and with `dynamicParams` + hourly ISR each one is a separate cache
     entry and a separate Firestore read on first request. A loop over
     /slate/9999-W99 was a cheap way to grow both. The engine started in 2026
     and ISO weeks stop at 53. */
  const [y, w] = [Number(week.slice(0, 4)), Number(week.slice(6))]
  const thisYear = new Date().getUTCFullYear()
  if (y < 2026 || y > thisYear + 1 || w < 1 || w > 53) return null
  return asSlate(await get(`dispatch/public/articles/${week}`, 3600))
}

/** Every published week, newest first. */
export async function listSlates(): Promise<Slate[]> {
  const docs = await list('dispatch/public/articles', 3600)
  return docs.map(asSlate).filter((x): x is Slate => !!x).sort((a, b) => (a.slug < b.slug ? 1 : -1))
}

export const engineConfigured = API_KEY.length > 0
