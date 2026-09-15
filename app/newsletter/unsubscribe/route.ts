import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual, createHash } from 'node:crypto'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE } from '../../config'

/**
 * SCOREBUG // NEWSLETTER UNSUBSCRIBE
 *
 * One click, no sign-in, no confirmation page that asks twice — which is what
 * CASL and every mail client's List-Unsubscribe header expect. The link the
 * engine puts in every weekly slate carries the address and an HMAC of it
 * under ENGINE_KEY; this route verifies the pair and clears the consent flag
 * through a SECURITY DEFINER function that can do exactly that and nothing
 * else (scorebug-app/database-v54.sql, `newsletter_unsubscribe`).
 *
 * The token is checked HERE, before the database is asked, and again inside
 * the function — two independent walls, neither trusting the other.
 */

export const dynamic = 'force-dynamic'

function token(email: string): string {
  return createHmac('sha256', String(process.env.ENGINE_KEY ?? '')).update(email.trim().toLowerCase()).digest('hex').slice(0, 32)
}

function page(title: string, body: string, status = 200) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Scorebug</title>
<body style="background:#0A0B0E;color:#E6EDF3;font-family:system-ui,sans-serif;padding:48px 24px;margin:0"><div style="max-width:520px;margin:0 auto">
<p style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#F85149;margin:0">Scorebug</p>
<h1 style="font:700 26px/1.2 system-ui,sans-serif;margin:14px 0 0">${esc(title)}</h1>
<p style="font:400 16px/1.5 system-ui,sans-serif;color:#A8B3BF;margin:12px 0 0">${esc(body)}</p>
<p style="margin-top:28px"><a href="${SITE}" style="color:#58A6FF">getscorebug.app</a></p></div></body>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

/**
 * ── WHY THERE IS A GET AND A POST ───────────────────────────────────────────
 *
 * RFC 8058 one-click unsubscribe is a POST, and the reason is exactly the
 * problem this route had: the unsubscribe URL sits in the message body as well
 * as in the header, and Gmail's link protection, Outlook Safe Links, corporate
 * mail scanners and Apple Mail Privacy Protection all fetch every URL in a
 * message without a person touching it. As a GET-only endpoint, each of those
 * silently unsubscribed a reader who never clicked — and the HMAC was valid,
 * so nothing looked wrong.
 *
 * So: POST does it (the mail client's one-click button, and the button on the
 * page), GET only asks. Both still check the token; the RPC checks it again on
 * the database side.
 */
function verify(email: string, t: string): boolean {
  if (!email || !t || !process.env.ENGINE_KEY) return false
  // Hashed to a fixed width first, so the comparison cannot leak the length.
  return timingSafeEqual(createHash('sha256').update(token(email)).digest(), createHash('sha256').update(String(t)).digest())
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('e') ?? '').trim().toLowerCase()
  const t = (req.nextUrl.searchParams.get('t') ?? '').trim()
  if (!verify(email, t)) return page('That link is not valid.', 'Reply to the email and a person will remove you by hand.', 400)
  const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe · Scorebug</title>
<body style="background:#0A0B0E;color:#E6EDF3;font-family:system-ui,sans-serif;padding:48px 24px;margin:0"><div style="max-width:520px;margin:0 auto">
<p style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#F85149;margin:0">Scorebug</p>
<h1 style="font:700 26px/1.2 system-ui,sans-serif;margin:14px 0 0">Stop the weekly slate?</h1>
<p style="font:400 16px/1.5 system-ui,sans-serif;color:#A8B3BF;margin:12px 0 22px">One tap and ${esc(email)} comes off the list. Your Scorebug account, if you have one, is untouched.</p>
<form method="POST"><input type="hidden" name="e" value="${esc(email)}"><input type="hidden" name="t" value="${esc(t)}">
<button type="submit" style="appearance:none;border:1px solid #7a0400;border-radius:12px;padding:14px 26px;font:600 16px system-ui;color:#fff;background:linear-gradient(180deg,#f0413c,#b00500);cursor:pointer">Unsubscribe</button></form>
<p style="margin-top:28px"><a href="${SITE}" style="color:#58A6FF">getscorebug.app</a></p></div></body>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  // Both shapes: a form post from the page above, and RFC 8058's
  // `List-Unsubscribe=One-Click` body, which carries the ids in the URL.
  let email = (req.nextUrl.searchParams.get('e') ?? '').trim().toLowerCase()
  let t = (req.nextUrl.searchParams.get('t') ?? '').trim()
  if (!email || !t) {
    try {
      const form = await req.formData()
      email = String(form.get('e') ?? '').trim().toLowerCase() || email
      t = String(form.get('t') ?? '').trim() || t
    } catch { /* no body: the query string is the whole request */ }
  }
  if (!verify(email, t)) return page('That link is not valid.', 'Reply to the email and a person will remove you by hand.', 400)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return page('Not configured.', 'Reply to the email and a person will remove you by hand.', 500)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/newsletter_unsubscribe`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_email: email, p_token: t }),
    cache: 'no-store',
  })
  if (!res.ok) return page('That did not work.', 'Reply to the email and a person will remove you by hand.', 500)
  return page('You are off the list.', 'No more weekly slates. Your Scorebug account, if you have one, is untouched.')
}
