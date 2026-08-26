import { NextResponse } from 'next/server'

/**
 * Server-side ESPN proxy for the WEB app.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * ESPN's public scoreboard endpoints stopped sending `Access-Control-Allow-
 * Origin`. Every league request from https://app.getscorebug.app is now blocked
 * by the browser before it leaves, so The Slate renders "couldn't reach the
 * sports wire" with zero games — a total outage of the app's core screen.
 *
 * Nothing in our code changed. Confirmed by fetching the same URLs server-side,
 * which returns 200 in ~100ms: the data is fine, only the browser is refused.
 *
 * The NATIVE Android build is unaffected and does not use this. Capacitor's
 * `CapacitorHttp` (enabled in capacitor.config.json) patches `fetch` to go
 * through the native HTTP stack, which is not subject to browser CORS at all.
 * So this proxy is web-only by design — see `proxied()` in the app's
 * lib/api/espn.ts, which leaves native requests pointing straight at ESPN
 * because that path is both working and faster.
 *
 * ─── WHY IT LIVES ON THE MARKETING SITE ──────────────────────────────────────
 * The app is `output: 'export'` — a static bundle with no server of its own, so
 * it cannot host a route like this. This deployment already runs a server for
 * /shop and /news, so the proxy costs no new infrastructure. A Supabase Edge
 * Function would work equally well and would sit beside the other proxies; the
 * deciding factor was that this one ships on a `git push` rather than needing a
 * separate deploy step while the Slate is down.
 *
 * ─── THIS IS NOT AN OPEN PROXY ───────────────────────────────────────────────
 * `u` is validated against an explicit host allowlist and rejected otherwise.
 * An unrestricted `?u=` on our own origin is an SSRF primitive: it would let
 * anyone use this domain to reach internal addresses and hand back the
 * response, with our IP and our TLS certificate on it. Same rule the CJ hop at
 * app/go/cj enforces for redirects.
 */

/** Exactly the ESPN hosts the app already declares in its own CSP. */
const ALLOWED_HOSTS = new Set([
  'site.api.espn.com',
  'site.web.api.espn.com',
  'sports.core.api.espn.com',
  'cdn.espn.com',
])

/** Only the web app may call this. */
const ALLOWED_ORIGIN = 'https://app.getscorebug.app'

function cors(origin: string | null): Record<string, string> {
  // Echo only our own app origin. `*` would let any site borrow this proxy.
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin')
  const raw = new URL(req.url).searchParams.get('u')
  if (!raw) {
    return NextResponse.json({ error: 'missing u' }, { status: 400, headers: cors(origin) })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400, headers: cors(origin) })
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 403, headers: cors(origin) })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { accept: 'application/json' },
      // Live scores. 30s is long enough to blunt a refresh storm across many
      // clients and short enough that an in-progress game is never stale on
      // screen — the app polls on its own cadence on top of this.
      next: { revalidate: 30 },
    })
    if (!upstream.ok) {
      // Pass the status through so the app's circuit breaker still sees a 429
      // or a 5xx as itself and backs off correctly, rather than seeing our 200.
      return NextResponse.json(
        { error: `upstream-${upstream.status}` },
        { status: upstream.status, headers: cors(origin) },
      )
    }
    const body = await upstream.text()
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...cors(origin),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'upstream-unreachable' }, { status: 502, headers: cors(origin) })
  }
}
