import { NextRequest, NextResponse } from 'next/server'
import { resolveById, leagueFromSlug } from '../../../../lib/gamepage'

/**
 * /game/[league]/id/[id] — resolve a game id to its canonical page, once.
 *
 * WHY THIS EXISTS. Every link built from the database has an id but not a
 * reliable date: game_records stores when a person WATCHED, and nothing in the
 * schema stores when the game was played. The page's URL needs the real date,
 * because that is what finds the game on ESPN's scoreboard for that day.
 *
 * Rather than have the index guess a slug — and emit links that 404 for any
 * back-logged or timezone-straddling game, which search engines would crawl and
 * remember — links point here. This finds the game (trying the hinted day and
 * the days either side) and sends a 301 to the one true URL.
 *
 * A 301 and not a 307: the id form is a lookup, not a destination. Telling
 * crawlers the canonical page is permanent keeps the ranking on the page that
 * has the content rather than splitting it across two addresses.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { league: string; id: string } }) {
  const lg = leagueFromSlug(params.league)
  const id = String(params.id || '')
  if (!lg || !/^\d{6,}$/.test(id)) return new NextResponse('Not found', { status: 404 })

  const hint = req.nextUrl.searchParams.get('d')
  const game = await resolveById(params.league, id, hint && /^\d{4}-\d{2}-\d{2}$/.test(hint) ? hint : null)
  if (!game) return new NextResponse('Not found', { status: 404 })

  return NextResponse.redirect(new URL(`/game/${game.leagueId.toLowerCase()}/${game.slug}`, req.nextUrl.origin), 301)
}
