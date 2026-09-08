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
export function ebayTeamUrl(
  teamName: string, modifier = 'memorabilia', placementId = 'public_gear',
): string | null {
  const t = (teamName ?? '').trim()
  if (!t) return null
  return ebaySearchUrl(`${t} ${modifier}`, placementId)
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
export function ticketNetworkTeamUrl(teamName: string, placementId = 'public_tickets'): string | null {
  const t = (teamName ?? '').trim()
  if (!t) return null
  const dest = `${TICKETNETWORK_ORIGIN}/search?q=${encodeURIComponent(t)}`
  // `sid` is CJ's sub-id. Without it every ticket click on this site arrived in
  // the reports as one undifferentiated row, so there was no way to tell which
  // surface earned — the same blind spot eBay's `customid` and Impact's
  // `subId1` already close on the other two networks.
  return `${CJ_CLICK_BASE}?url=${encodeURIComponent(dest)}&sid=${encodeURIComponent(placementId)}`
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

// ─── SoccerGarage (CJ) — world football ──────────────────────────────────────

/**
 * The soccer merchant. ONE destination, deliberately.
 *
 * ─── IT CANNOT BE DEEP-LINKED, AND THAT IS MEASURED ─────────────────────────
 * Probed against the destination host on 2026-09-07 (never the CJ click URL —
 * fetching that registers a real click and reads as fraud):
 *
 *   /catalogsearch/result/?q=arsenal          → 302 → /404.html
 *   /search.php?{keywords|q|search|keyword}=  → 200, all four byte-identical
 *                                               (167,429 bytes) — the parameter
 *                                               is ignored; the form is POST.
 *
 * So there is no per-club URL to build. A club-named button pointing at a
 * generic shop front would be a lie told by a layout, and the app's
 * RepYourSide already refuses exactly that. Until a merchant with real per-club
 * deep links is signed — see PARTNERS.md, Fanatics International EU is the one
 * to sign — world-football clubs get a per-club eBay link and a single honest
 * shop link, and the copy says "shop", not the club's name.
 *
 * ─── NO FIRST-PARTY HOP ON THIS ORIGIN ──────────────────────────────────────
 * dpbolvw.net is on the default uBlock/Brave/AdGuard lists, so some share of
 * these clicks will be blocked. The app solves that with a same-origin
 * /go/cj redirector; this site has none, and adding an open redirect to the
 * marketing origin is a phishing primitive. A lost commission beats a security
 * incident. Same reasoning as the TicketNetwork note above.
 */
const CJ_SOCCERGARAGE_LINK_ID = '10479704'
const SOCCERGARAGE_CLICK =
  `https://www.dpbolvw.net/click-${CJ_PUBLISHER_ID}-${CJ_SOCCERGARAGE_LINK_ID}`

/** The CJ impression pixel that ships with the SoccerGarage creative. Render it
 *  as a real element only on a surface that actually shows the creative. */
export const SOCCERGARAGE_PIXEL =
  `https://www.ftjcfx.com/image-${CJ_PUBLISHER_ID}-${CJ_SOCCERGARAGE_LINK_ID}`

/** The shop front. Takes no club, because it cannot honour one. */
export function soccerGarageUrl(placementId = 'public_soccer_shop'): string {
  return `${SOCCERGARAGE_CLICK}?sid=${encodeURIComponent(placementId)}`
}

/**
 * Which leagues SoccerGarage is the right merchant for: association football
 * that Fanatics does not carry. MLS is association football but IS carried by
 * Fanatics with real per-club stores, so it stays on Fanatics.
 */
const SOCCERGARAGE_LEAGUES = new Set([
  'EPL', 'UCL', 'LALIGA', 'SERIEA', 'BUND', 'LIGUE1', 'CSL', 'ISL', 'JLEAGUE',
])

export function soccerGarageCarriesLeague(league?: string | null): boolean {
  if (!league) return false
  return SOCCERGARAGE_LEAGUES.has(String(league).trim().toUpperCase())
}

/**
 * The three shops this site sends people to.
 *
 * There is deliberately NO `merchantForLeague(league)` helper any more. One
 * existed, it answered "which merchant fronts this league" from a static table,
 * and the hub used it to label rows whose URLs were built by a different
 * function — so every European row rendered a visible "SoccerGarage" over a
 * link to eBay. The merchant a surface displays must come from the same call
 * that produced the URL. `leagueGearLink` and `clubGearUrl` are those calls.
 */
export type Merchant = 'fanatics' | 'soccergarage' | 'ebay'

/** The advertiser's own name, for the visible attribution beside SPONSORED. */
export function advertiserName(m: Merchant): string {
  return m === 'fanatics' ? 'Fanatics' : m === 'soccergarage' ? 'SoccerGarage' : 'eBay'
}

/**
 * The best CLUB-level link available for a league, or null.
 *
 * Fanatics leagues get a real club store search. Everything else gets eBay,
 * which resolves for any club name on earth. SoccerGarage is never returned
 * here — it has no club form — which is why the shop link is rendered
 * separately and labelled as a shop.
 */
export function clubGearUrl(
  clubName: string,
  league: string,
  placementId = 'public_hub',
): string | null {
  const name = (clubName ?? '').trim()
  if (!name) return null
  if (fanaticsCarriesLeague(league)) {
    return fanaticsTeamUrl(name, 'gear', league, placementId)
  }
  return ebaySearchUrl(`${name} shirt`, placementId)
}

/**
 * The LEAGUE-level gear link used by the sport hubs.
 *
 * ─── IT RETURNS THE MERCHANT IT ACTUALLY USED ───────────────────────────────
 * This used to return a bare URL, and the caller labelled the row by asking
 * `merchantForLeague` separately. The two disagreed: `merchantForLeague` says
 * 'soccergarage' for the Premier League — correct, that IS the soccer merchant
 * — while this function correctly built an eBay link, because SoccerGarage has
 * no per-league URL to build. Every European row therefore rendered a visible
 * "SoccerGarage" attribution over a link to eBay.
 *
 * That is not a cosmetic bug. The visible merchant name beside SPONSORED is a
 * disclosure: it tells a reader where a paid link is about to send them. Two
 * functions that can drift is the wrong shape for that, so there is now one
 * function and it reports what it built.
 *
 * `garment` matters more than it looks: "shirt" is what association-football
 * kit is called and what its listings are titled, "jersey" is the North
 * American word. Searching the wrong one halves the result set.
 */
export function leagueGearLink(
  league: { id: string; label: string; full: string; shopName?: string; code?: string },
  placementId = 'public_hub',
): { url: string; merchant: Merchant } | null {
  const name = league.shopName ?? league.full
  if (fanaticsCarriesLeague(league.id)) {
    const url = fanaticsTeamUrl(league.shopName ?? league.label, 'gear', league.id, placementId)
    return url ? { url, merchant: 'fanatics' } : null
  }
  const garment = league.code === 'association' ? 'shirt' : 'jersey'
  const url = ebaySearchUrl(`${name} ${garment}`, placementId)
  return url ? { url, merchant: 'ebay' } : null
}
