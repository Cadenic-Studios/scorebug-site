import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'node:crypto'
import { LAUNCH_STAGE, appPlatforms, androidCta, PRICING, SITE, WEB_APP, VANITY_DOMAINS, VANITY_LIVE } from '../../../config'
import { LEAGUES, LEAGUE_COUNT } from '../../../leagues'
import { MATCHUPS } from '../../../matchups'

/**
 * SCOREBUG // THE PRODUCT FACTS, FOR THE MARKETING ENGINE
 *
 * ─── WHY THIS ENDPOINT EXISTS ───────────────────────────────────────────────
 * The engine (scorebug-site/engine) never hard-codes a claim about the
 * product. Every claim it can make — which platforms, what the Android button
 * should do, what The Front Office costs, how many leagues — has already been
 * wrong once somewhere on this site, and each was fixed by declaring one
 * source of truth in app/config.ts. This route serialises exactly those
 * exports so the engine reads the same truth the site renders. Flip
 * LAUNCH_STAGE, deploy, and every future post follows without touching the
 * engine.
 *
 * ─── AUTH ───────────────────────────────────────────────────────────────────
 * Nothing here is secret — it is all on the public site — but the key keeps
 * the endpoint from being a free JSON mirror for anyone else's scraper, and
 * it is the same DISPATCH_KEY the engine already holds. Constant-time compare.
 */

export const dynamic = 'force-dynamic'

/**
 * `a.length === b.length && timingSafeEqual(a, b)` is the usual shape, and it
 * returns EARLY on a length mismatch — leaking the one thing the comparison
 * was supposed to hide. Hashing both sides to a fixed 32 bytes first makes
 * every comparison do identical work whatever was submitted.
 */
function authorised(req: NextRequest): boolean {
  const want = process.env.DISPATCH_KEY ?? ''
  const got = req.headers.get('x-dispatch-key') ?? ''
  if (!want || !got) return false
  return timingSafeEqual(createHash('sha256').update(want).digest(), createHash('sha256').update(got).digest())
}

export function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cta = androidCta()
  /** Rivalries the site gives a page to, by league, as pairs of full club names (the engine matches on names or abbreviations). */
  const rivalries: Record<string, [string, string][]> = {}
  for (const m of MATCHUPS) {
    const league = String(m.league || '').toUpperCase()
    if (league && m.a?.name && m.b?.name) (rivalries[league] ||= []).push([m.a.name, m.b.name])
  }
  return NextResponse.json({
    stage: LAUNCH_STAGE,
    platforms: appPlatforms(),
    androidCta: { href: cta.href.startsWith('http') ? cta.href : `${SITE}${cta.href}`, label: cta.label },
    pricing: { monthly: PRICING.us.monthly, yearly: PRICING.us.yearly, perMonthEquivalent: PRICING.perMonthEquivalent, annualSavingsPct: PRICING.annualSavingsPct },
    leagueCount: LEAGUE_COUNT,
    leagues: LEAGUES.map(l => ({ id: l.id, label: l.label, full: l.full, sport: l.sport, country: l.country, color: l.color })),
    firstSeason: 2002,
    gradeScale: '5.0',
    site: SITE,
    webApp: WEB_APP,
    rivalries,
    vanity: VANITY_LIVE ? VANITY_DOMAINS.map(v => v.host) : [],
    generatedAt: new Date().toISOString(),
  }, { headers: { 'cache-control': 'private, max-age=300' } })
}
