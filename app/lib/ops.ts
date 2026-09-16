import 'server-only'
import { timingSafeEqual, createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * SCOREBUG // THE ENGINE'S CONTROL SURFACE
 *
 * The marketing engine runs as Cloud Functions (scorebug-site/engine). Its
 * daily digest email is the surface for ordinary days; /ops is the surface for
 * the days when something needs looking at. This module is the server-only
 * bridge.
 *
 * ─── AUTH, AND WHY IT IS A PASSWORD AND NOT SUPABASE ────────────────────────
 * One person uses this page. A session from the app's auth would mean shipping
 * the Supabase client to a route that is otherwise pure server HTML, and an
 * allow-list of one user id is a password with extra steps. So: one password
 * in an environment variable and an HttpOnly cookie.
 *
 * ─── WHAT THE COOKIE USED TO BE, AND WHY IT CHANGED ─────────────────────────
 * `sha256('sb-ops:' + CONSOLE_PASSWORD)`. Two problems, both real:
 *
 *   1. It DISCLOSED THE PASSWORD. Unsalted SHA-256, no KDF, a known constant
 *      prefix — anyone who saw the cookie once (a proxy log, a shared machine,
 *      a browser profile backup) could recover a human-chosen password at
 *      billions of guesses a second and then try it wherever it was reused.
 *   2. It could not be REVOKED. The value was a pure function of the password,
 *      identical for every session for ever, so "sign out" only deleted the
 *      owner's own copy; anybody else holding it stayed signed in until the
 *      password itself changed.
 *
 * Now it is an expiring HMAC over the expiry, keyed by the two server secrets.
 * It reveals neither of them, it dies on its own, and rotating either secret
 * invalidates every outstanding session at once.
 *
 * The engine's own secret (OPS_SECRET) NEVER reaches the browser. It is sent
 * server-to-server, in a header, from this file only.
 */

const OPS_URL = process.env.DISPATCH_OPS_URL ?? ''
const OPS_SECRET = process.env.DISPATCH_OPS_SECRET ?? ''
const CONSOLE_PASSWORD = process.env.OPS_CONSOLE_PASSWORD ?? ''

export const OPS_COOKIE = 'sb_ops'
export const opsConfigured = OPS_URL.length > 0 && OPS_SECRET.length > 0 && CONSOLE_PASSWORD.length > 0

export const SESSION_DAYS = 30
const SESSION_KEY = `${OPS_SECRET}\u0000${CONSOLE_PASSWORD}`

/**
 * Compare two secrets without leaking their length.
 *
 * `a.length === b.length && timingSafeEqual(a, b)` is the usual shape, and it
 * returns EARLY on a length mismatch — which is the one bit it then leaks.
 * Hashing both sides to a fixed 32 bytes first means every comparison does the
 * same work regardless of what was submitted. It matters here because the
 * sign-in below has no other cost to the attacker.
 */
function secretEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

/** `<expiryMs>.<hmac>` — reveals neither secret, expires by itself, revocable by rotating either. */
export function sessionToken(now: number = Date.now()): string {
  const exp = now + SESSION_DAYS * 86_400_000
  const mac = createHmac('sha256', SESSION_KEY).update(`sb-ops:${exp}`).digest('hex').slice(0, 40)
  return `${exp}.${mac}`
}

export function passwordMatches(candidate: string): boolean {
  if (!CONSOLE_PASSWORD) return false
  return secretEquals(String(candidate), CONSOLE_PASSWORD)
}

export function sessionValid(cookieValue: string | undefined, now: number = Date.now()): boolean {
  if (!cookieValue || !CONSOLE_PASSWORD || !OPS_SECRET) return false
  const [expRaw, mac] = String(cookieValue).split('.')
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now) return false
  const want = createHmac('sha256', SESSION_KEY).update(`sb-ops:${exp}`).digest('hex').slice(0, 40)
  return secretEquals(String(mac || ''), want)
}

/* ─────────────────────────────────────────────── BRUTE FORCE, SLOWED DOWN */

/**
 * There was no rate limit at all: one request per guess, a clean yes/no, no
 * counter, no delay, no lockout, and behind that one password sits "approve
 * and post to five networks" and "send the newsletter to the whole list".
 *
 * This is per-instance memory, not a shared store, so it is a speed bump
 * rather than a wall — but Vercel keeps an instance warm through exactly the
 * sustained hammering that matters, and a 30-guess-then-locked instance is a
 * different proposition from an unlimited one. Every failure also costs a
 * fixed delay, so even a distributed attempt pays for each guess.
 */
type Attempts = { fails: number; until: number }
const attempts = new Map<string, Attempts>()
const LOCK_AFTER = 8
const LOCK_MS = 15 * 60_000

export function signInAllowed(who: string): { ok: true } | { ok: false; waitMs: number } {
  const a = attempts.get(who)
  if (a && a.until > Date.now()) return { ok: false, waitMs: a.until - Date.now() }
  return { ok: true }
}

export async function noteSignIn(who: string, success: boolean): Promise<void> {
  if (success) { attempts.delete(who); return }
  const a = attempts.get(who) ?? { fails: 0, until: 0 }
  a.fails += 1
  if (a.fails >= LOCK_AFTER) { a.until = Date.now() + LOCK_MS; a.fails = 0 }
  attempts.set(who, a)
  if (attempts.size > 5000) attempts.clear()   // never a memory lever
  // A flat cost per guess, whether or not this instance is the one counting.
  await new Promise((r) => setTimeout(r, 400))
}

/** A random opaque id, so a flash message can be looked up rather than reflected. */
export function flashId(): string { return randomBytes(9).toString('base64url') }

export type OpsEvent = {
  id: string
  type: string
  status: string
  createdAt?: string
  sentAt?: string
  note?: string | null
  route?: string
  title?: string
  day?: string | null
  networks?: string[]
  link?: boolean
  score?: number | null
  texts?: Record<string, string>
  postedUrls?: Record<string, string>
  pending?: string[]
  variants?: Record<string, string>
  game?: { league?: string; detail?: string; postponed?: boolean; canceled?: boolean; headline?: string | null; sport?: string } | null
  media?: { kind?: string; publicUrl?: string; alt?: string } | null
}

export type OpsMetrics = {
  day?: string
  product?: { logs7d?: number; loggers7d?: number; fans?: number; premium?: number; signups?: { android?: number; ios?: number; web?: number; newsletter?: number; invited?: number }; error?: string } | null
  play?: { installs7d?: number; activeDevices?: number; error?: string } | null
  site?: { sessions?: number; error?: string } | null
  followers?: Record<string, number | null>
  engagement?: { median?: number | null; postsMeasured?: number }
}

export type OpsStatus = {
  settings: Record<string, unknown> & { enabled?: boolean; dryRun?: boolean; autopilot?: boolean; networks?: Record<string, boolean>; maxPerDay?: Record<string, number> }
  policy: { chosen?: Record<string, string>; findings?: Array<{ text: string }>; sampleSize?: number } | null
  budget: { plan: { total: number; currency: string; lines: Array<{ id: string; label: string; cap: number; gate: string; earliest: string }> }; entries?: Array<{ line: string; amount: number; at: string; note?: string }> }
  health: { publishers: string[]; missingSecrets: string[] }
  facts?: { stage?: string; platforms?: string; fetchedAt?: string; fallback?: boolean } | null
  events: OpsEvent[]
  replies: Array<{ id: string; network: string; author?: string; comment?: string; candidates?: string[]; status: string; hostile?: boolean }>
  reviews: Array<{ id: string; stars?: number; author?: string; text?: string; draft?: string; problems?: string[]; status: string }>
  metrics: OpsMetrics[]
  newsletters: Array<{ week: string; subject: string; body: string; approved?: boolean; sentAt?: string; recipients?: number }>
  digests: Array<{ day: string; counts: Record<string, number> }>
  /* CADENIC. The agency's sales queue rides in the same status payload as the
     product's post queue, because there is one operator and one console. */
  prospects?: Array<{
    id: string; email: string; name?: string; company?: string; site?: string
    segment?: string; status: string; problems?: string[]
    draft?: { subject: string; body: string }
    followUp?: { subject: string; body: string }
    sentAt?: string; followUpAt?: string; foundBy?: string; foundQuery?: string
    found?: Array<{ key: string; text: string }>
  }>
  candidates?: Array<{ url: string; host: string; verdict: string; segment?: string; seenAt?: string; title?: string }>
  slots?: Record<string, string>
  slotNotes?: Record<string, string>
}

export async function readStatus(): Promise<{ ok: true; data: OpsStatus } | { ok: false; error: string }> {
  if (!opsConfigured) return { ok: false, error: 'DISPATCH_OPS_URL, DISPATCH_OPS_SECRET and OPS_CONSOLE_PASSWORD are not all set on this deployment.' }
  try {
    const res = await fetch(`${OPS_URL}?action=status`, {
      headers: { 'x-ops-secret': OPS_SECRET },
      cache: 'no-store',
      // The engine has a 120s timeout of its own; without one here a hung
      // function hangs /ops all the way to the platform's 504.
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return { ok: false, error: `The engine answered ${res.status}. It may not be deployed yet.` }
    const raw = (await res.json()) as Partial<OpsStatus>
    if (!raw || typeof raw !== 'object' || !raw.settings) {
      return { ok: false, error: 'The engine answered with something this console does not recognise. Check DISPATCH_OPS_URL points at the current deployment.' }
    }
    /* Defaults for EVERY collection the page walks. The page destructured
       `events`, `replies`, `reviews`, `metrics`, `newsletters`, `budget` and
       `health` with no fallback, so any 200 that was not exactly the current
       shape — a half-rolled-back engine, a stale URL — threw inside the server
       component and showed the owner Next's error page at precisely the moment
       they had come to look at what was wrong. */
    return {
      ok: true,
      data: {
        ...(raw as OpsStatus),
        settings: raw.settings ?? {},
        policy: raw.policy ?? null,
        budget: raw.budget ?? { plan: { total: 0, currency: 'CAD', lines: [] }, entries: [] },
        health: raw.health ?? { publishers: [], missingSecrets: [] },
        events: raw.events ?? [],
        replies: raw.replies ?? [],
        reviews: raw.reviews ?? [],
        metrics: raw.metrics ?? [],
        newsletters: raw.newsletters ?? [],
        digests: raw.digests ?? [],
        prospects: raw.prospects ?? [],
        candidates: raw.candidates ?? [],
        slots: raw.slots ?? {},
        slotNotes: raw.slotNotes ?? {},
      },
    }
  } catch (e) {
    return { ok: false, error: `Could not reach the engine: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}

export async function act(action: string, id: string, extra: Record<string, string> = {}): Promise<{ ok: boolean; message: string }> {
  if (!opsConfigured) return { ok: false, message: 'not configured' }
  const qs = new URLSearchParams({ action, id, ...extra })
  try {
    // POST: the engine renders a confirmation page for a GET now, because a
    // mail scanner following a digest link must not be able to publish.
    const res = await fetch(`${OPS_URL}?${qs}`, {
      method: 'POST',
      headers: { 'x-ops-secret': OPS_SECRET, 'content-length': '0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text()
    const m = text.match(/<p style="font:400 20px[^"]*">([^<]*)<\/p>/)
    return { ok: res.ok, message: m ? m[1] : res.ok ? 'Done.' : `Failed (${res.status}).` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'failed' }
  }
}
