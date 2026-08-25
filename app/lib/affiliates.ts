/**
 * Affiliate link builders for the PUBLIC marketing site.
 *
 * ─── EVERY TRACKING PARAMETER HERE IS COPIED VERBATIM ────────────────────────
 * These IDs are how commissions get attributed. A transposed digit does not
 * throw, does not fail a build and does not look wrong on screen — it produces a
 * link that works perfectly for the visitor and pays nobody. They are copied
 * character-for-character from the app's lib/ads/affiliateLinks.ts and
 * lib/ads/ticketNetwork.ts. If a network ever reissues one, it changes in BOTH
 * repos or the two surfaces silently disagree about who gets paid.
 *
 * ─── WHY NO FIRST-PARTY /go/cj HOP ───────────────────────────────────────────
 * The app wraps CJ clicks in a same-origin `/go/cj/?u=…` redirector, because
 * CJ's click domains are on the default uBlock/Brave/AdGuard blocklists and a
 * direct anchor renders the blocker's interstitial instead of the advertiser.
 * That redirector is an APP route. This site has no equivalent, and adding one
 * would need its own ALLOWED_HOSTS allowlist — an open redirect on the marketing
 * origin is a phishing primitive, which is exactly why the app's version carries
 * one. Until that is built here, these links go direct: a blocked click is a
 * lost commission, an open redirect is a security incident, and the second is
 * much worse than the first.
 *
 * ─── DISCLOSURE IS NOT OPTIONAL ──────────────────────────────────────────────
 * Every rendered link built here must sit under a visible "Sponsored" label and
 * carry rel="sponsored noopener noreferrer". See <Sponsored /> in
 * app/components/Sponsored.tsx — it is the only disclosure component, it takes
 * no props, and that is deliberate so no surface can water the wording down.
 */

// ─── eBay Partner Network ────────────────────────────────────────────────────

const EPN_BASE = 'https://www.ebay.com/sch/i.html'
const EPN_CAMPAIGN_ID = '5339173053'

const EPN_FIXED: Record<string, string> = {
  _from: 'R40',
  _trksid: 'm570.l1313',
  mkcid: '1',
  mkrid: '711-53200-19255-0',
  siteid: '0',
  toolid: '10001',
  mkevt: '1',
  campid: EPN_CAMPAIGN_ID,
}

/**
 * 64482 is eBay's top-level SPORTS category. It is applied by default and should
 * stay that way: the app's own note records that unscoped queries like
 * "PSA 10 graded card" return Pokémon slabs, because PSA grades far more Pokémon
 * than hockey. A query is a hope; a category is a constraint.
 */
export const EBAY_SPORTS_CATEGORY = '64482'

export function ebaySearchUrl(
  searchQuery: string,
  placementId: string,
  categoryId: string = EBAY_SPORTS_CATEGORY,
): string | null {
  const q = (searchQuery ?? '').trim()
  if (!q) return null
  const params = new URLSearchParams({
    ...EPN_FIXED,
    _nkw: q,
    _sacat: categoryId,
    customid: placementId,
  })
  return `${EPN_BASE}?${params.toString()}`
}

/** Singles / rookie cards for one player. */
export function ebayPlayerCardUrl(playerName: string, modifier?: string): string | null {
  const name = (playerName ?? '').trim()
  if (!name) return null
  return ebaySearchUrl(modifier ? `${name} ${modifier}` : `${name} card`, 'public_memorabilia')
}

/** Memorabilia scoped to a club. */
export function ebayTeamUrl(teamName: string, modifier = 'memorabilia'): string | null {
  const t = (teamName ?? '').trim()
  if (!t) return null
  return ebaySearchUrl(`${t} ${modifier}`, 'public_gear')
}

// ─── Fanatics (Impact) ───────────────────────────────────────────────────────

/**
 * The FULL Impact tracking URL, not the vanity shortlink. The shortlink does not
 * support programmatic `u=` deep-linking; this /c/{mediaPartner}/{campaign}/{ad}
 * form does. It ALREADY carries a query string, so deep-link and sub-id params
 * are appended with `&`, never `?` — a second `?` truncates the tracking IDs and
 * silently breaks attribution while still rendering a working link.
 */
const FANATICS_BASE =
  'https://fanatics.93n6tx.net/c/7512608/586570/9663?partnerpropertyid=8645171&MediaPartnerPropertyId=8645171'

/**
 * Fanatics carries the North American majors and college, and does NOT carry the
 * CFL or the European football leagues. Returning null for those is not a
 * shortcut — a Fanatics search for "Saskatchewan Roughriders" returns an empty
 * results page, and sending a fan there is worse than showing them nothing.
 */
const FANATICS_LEAGUES = new Set(['NHL', 'NFL', 'NBA', 'MLB', 'NCAAF', 'NCAAB', 'MLS'])

export function fanaticsCarriesLeague(league?: string | null): boolean {
  if (!league) return false
  return FANATICS_LEAGUES.has(String(league).trim().toUpperCase())
}

export function fanaticsTeamUrl(
  teamName: string,
  category?: 'jerseys' | 'hats' | 'gear' | 'apparel',
  league?: string | null,
  placementId = 'public_gear',
): string | null {
  const team = (teamName ?? '').trim()
  if (!team) return null
  if (league && !fanaticsCarriesLeague(league)) return null
  const query = category && category !== 'gear' ? `${team} ${category}` : team
  const destination = `https://www.fanatics.com/search?query=${encodeURIComponent(query)}`
  return `${FANATICS_BASE}&u=${encodeURIComponent(destination)}&subId1=${encodeURIComponent(placementId)}`
}

// ─── TicketNetwork (CJ) ──────────────────────────────────────────────────────

const CJ_PUBLISHER_ID = '101840629'
const CJ_TICKETNETWORK_LINK_ID = '11080825'
const CJ_CLICK_BASE = `https://www.jdoqocy.com/click-${CJ_PUBLISHER_ID}-${CJ_TICKETNETWORK_LINK_ID}`
const TICKETNETWORK_ORIGIN = 'https://www.ticketnetwork.com'

/**
 * Team name → TicketNetwork search.
 *
 * The app verified the query FORM against the live destination host: a plain
 * `?q=<team>` search returns real dated events. Venue and kickoff are
 * deliberately NOT appended — they narrow the search to zero results far more
 * often than they help.
 *
 * NOTE FOR ANYONE TESTING THIS: never fetch the CJ click URL to "check" it.
 * That registers a real click against the publisher account and reads as fraud.
 * Fetch the DESTINATION host (ticketnetwork.com) if you need to verify a query.
 */
export function ticketNetworkTeamUrl(teamName: string): string | null {
  const t = (teamName ?? '').trim()
  if (!t) return null
  const dest = `${TICKETNETWORK_ORIGIN}/search?q=${encodeURIComponent(t)}`
  return `${CJ_CLICK_BASE}?url=${encodeURIComponent(dest)}`
}

/** "Away at Home" — the matchup form used beside a fixture. */
export function ticketNetworkGameUrl(away?: string | null, home?: string | null): string | null {
  const a = (away ?? '').trim()
  const h = (home ?? '').trim()
  if (!a && !h) return null
  const q = a && h ? `${a} at ${h}` : (h || a)
  const dest = `${TICKETNETWORK_ORIGIN}/search?q=${encodeURIComponent(q)}`
  return `${CJ_CLICK_BASE}?url=${encodeURIComponent(dest)}`
}
