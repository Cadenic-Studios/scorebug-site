import { NextRequest, NextResponse } from 'next/server'
import { SITE } from '../../config'

/**
 * SCOREBUG // /r — THE SHORT SITE LINK
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * GA4 needs utm_source, utm_medium and utm_campaign spelled out in full. On a
 * 300-character Bluesky post that is a third of the budget spent on machinery
 * the reader has to look past, and it makes every post look like it came out
 * of a pipeline. So the engine posts `getscorebug.app/r/the-slate?s=x&c=slate`
 * and this route rebuilds the full tagging server-side. Analytics sees
 * precisely what it would have seen; the reader sees a clean link.
 *
 * Two query keys pass through untouched: `gameId` and `gameTime`, which The
 * Log reads to open a specific game (`/the-log?gameId=…`). Nothing else does.
 *
 * ─── WHY THIS CANNOT BECOME AN OPEN REDIRECT ────────────────────────────────
 * The destination is never taken from the query string. It is assembled from
 * the path segments Next has already parsed, each filtered to a safe pattern,
 * and joined onto THIS origin. There is no input that can name another host,
 * because the host is not an input. (The app's own /go/cj hop and this site's
 * /api/espn proxy follow the same rule.)
 *
 * The site's redirect rules then hand app routes (/the-log, /the-slate) to
 * app.getscorebug.app with the query intact — so a tagged deep link is two
 * hops, both on hosts we own.
 */

export const dynamic = 'force-dynamic'

/** One path segment: letters, digits, dash, underscore, dot. Nothing else. */
const SEG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const TAG = /^[a-z0-9][a-z0-9-]{0,31}$/
/** ESPN event ids are digits; a game time is an ISO instant. Anything else is dropped. */
const GAME_ID = /^\d{1,12}$/
const GAME_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/

const cleanTag = (v: string | null, fallback: string) => {
  const s = (v ?? '').trim().toLowerCase()
  return TAG.test(s) ? s : fallback
}

export function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = (params.path ?? []).filter(s => SEG.test(s))
  const q = req.nextUrl.searchParams
  const source = cleanTag(q.get('s'), 'direct')
  const campaign = cleanTag(q.get('c'), 'dispatch')
  const medium = cleanTag(q.get('m'), 'dispatch')
  const url = new URL(`/${segments.join('/')}`, SITE)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', campaign)
  const gameId = q.get('gameId')
  const gameTime = q.get('gameTime')
  if (gameId && GAME_ID.test(gameId)) url.searchParams.set('gameId', gameId)
  if (gameTime && GAME_TIME.test(gameTime)) url.searchParams.set('gameTime', gameTime)
  return NextResponse.redirect(url.toString(), { status: 302, headers: { 'cache-control': 'no-store' } })
}
