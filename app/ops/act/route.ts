import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { OPS_COOKIE, SESSION_DAYS, act, passwordMatches, sessionToken, sessionValid, signInAllowed, noteSignIn } from '../../lib/ops'
import { SITE } from '../../config'

/**
 * SCOREBUG // OPS ACTIONS
 *
 * Every control on /ops is a plain <form method="post">. No client JavaScript,
 * no fetch, no hydration — which is why the console works on a phone with a
 * bad connection and cannot desynchronise from the engine. Two jobs: sign in
 * (set the session cookie), and forward one action to the engine with the
 * server-held secret. Both redirect back to /ops with a short message in the
 * query string, so a refresh never repeats an action.
 *
 * ─── WHY THE ORIGIN CHECK ───────────────────────────────────────────────────
 * The only CSRF defence here was `SameSite=Lax` on the cookie, which stops
 * CROSS-SITE requests. `app.getscorebug.app` is not cross-site — SameSite is
 * scoped to the registrable domain, not the origin — and that app renders
 * user-written Bleachers comments and Play reviews. Injected markup there could
 * auto-submit a form at this route with the owner's cookie attached and reach
 * `approve` (post to five networks now), `newsletter` (send to the whole list)
 * or `golive`. An explicit Origin check is the part SameSite cannot do.
 */

export const dynamic = 'force-dynamic'

function back(message: string, ok = true) {
  const url = new URL('/ops', SITE)
  /* Bounded and stripped of anything that is not ordinary prose. The page only
     renders this to a signed-in owner (see ops/page.tsx), so it is no longer a
     phishing surface — but engine error text ends up here, and error text does
     not belong in a URL in the first place. */
  const clean = message.replace(/[^\w \u00b7.,:;!?()'"$%/@+—–-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
  url.searchParams.set(ok ? 'ok' : 'err', clean || (ok ? 'Done.' : 'That did not work.'))
  return NextResponse.redirect(url, { status: 303 })
}

/** This exact origin, or nothing. Checked before the body is even read. */
function sameOrigin(request: Request): boolean {
  const expected = new URL(SITE).origin
  const origin = request.headers.get('origin')
  if (origin) return origin === expected
  const referer = request.headers.get('referer')
  if (referer) { try { return new URL(referer).origin === expected } catch { return false } }
  return false   // a browser always sends one of the two on a form POST
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return back('That request did not come from the console.', false)
  const form = await request.formData()
  const jar = cookies()

  if (form.get('intent') === 'signin') {
    // One shared bucket: this console has exactly one user, so there is no
    // reason to let an attacker's guesses and the owner's typo be counted
    // apart, and no reason to trust a client-supplied address for keying.
    const gate = signInAllowed('console')
    if (!gate.ok) return back(`Too many attempts. Try again in ${Math.ceil(gate.waitMs / 60_000)} minutes.`, false)
    const password = String(form.get('password') ?? '')
    const ok = passwordMatches(password)
    await noteSignIn('console', ok)
    if (!ok) return back('That password is not right.', false)
    jar.set(OPS_COOKIE, sessionToken(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * SESSION_DAYS })
    return back('Signed in.')
  }
  if (!sessionValid(jar.get(OPS_COOKIE)?.value)) return back('Sign in first.', false)
  if (form.get('intent') === 'signout') { jar.delete(OPS_COOKIE); return back('Signed out.') }

  const action = String(form.get('action') ?? '')
  const id = String(form.get('id') ?? '')
  if (!action || !id) return back('Nothing to do.', false)
  const extra: Record<string, string> = {}
  for (const key of ['line', 'amount', 'note', 'on']) {
    const v = form.get(key)
    if (typeof v === 'string' && v) extra[key] = v
  }
  const result = await act(action, id, extra)
  return back(result.message, result.ok)
}
