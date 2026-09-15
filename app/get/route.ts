import { NextRequest, NextResponse } from 'next/server'
import { LAUNCH_STAGE, PLAY_URL, SITE } from '../config'

/**
 * SCOREBUG // /get — THE ONE LINK THAT IS ABOUT THE APP
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The marketing engine posts `getscorebug.app/get?s=bluesky&c=vault` — 40
 * characters — on every post whose subject is the product, and this route
 * decides where that click lands TODAY. It reads LAUNCH_STAGE, the same switch
 * every Android call to action on the site reads, so the engine can post the
 * same link for the life of the product and never advertise a listing that
 * does not admit the reader:
 *
 *   'live'     → Google Play, with the tags rebuilt as a Play `referrer`, so
 *                the install is attributed exactly as a direct link would be.
 *   otherwise  → the homepage waitlist, with the tags carried in the query so
 *                the signup form can write them into `tester_signups.source`.
 *
 * The site was once linking "Get it on Google Play" at a closed test that
 * admits nobody. This route is the mechanism that makes that mistake
 * impossible for every post ever sent, retroactively: flip the stage, deploy,
 * and the old posts start landing on Play.
 *
 * ─── WHY THE ALLOW-LISTS ────────────────────────────────────────────────────
 * `s` and `c` are copied into a URL we hand to a third party, from a query
 * string anyone can edit. They are matched against a fixed pattern and dropped
 * if they do not fit, so this cannot smuggle text into a Play referrer or
 * garbage up the acquisition report with junk campaigns.
 */

export const dynamic = 'force-dynamic'

/** Lowercase word characters and dashes only, and short. Anything else is dropped. */
const SAFE = /^[a-z0-9][a-z0-9-]{0,31}$/
const clean = (v: string | null, fallback: string) => {
  const s = (v ?? '').trim().toLowerCase()
  return SAFE.test(s) ? s : fallback
}

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const source = clean(q.get('s'), 'direct')
  const campaign = clean(q.get('c'), 'dispatch')
  const medium = clean(q.get('m'), 'dispatch')

  let target: string
  if (LAUNCH_STAGE === 'live') {
    const referrer = `utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`
    target = `${PLAY_URL}&referrer=${encodeURIComponent(referrer)}`
  } else {
    // The waitlist. The same three tags ride along as utm_* for GA4, plus the
    // short forms the signup form reads into `source`.
    target = `${SITE}/?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}&s=${source}&c=${campaign}#waitlist`
  }
  // 302, not 301: the mapping from a campaign tag to a destination is not
  // permanent — it changes the day the listing goes public — and a 301 would be
  // cached in readers' browsers past that change.
  return NextResponse.redirect(target, { status: 302, headers: { 'cache-control': 'no-store' } })
}
