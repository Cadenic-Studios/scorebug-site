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
 * carry rel="sponsored noopener" (never `noreferrer`, which would hide the
 * referring domain from the network). See <Sponsored /> in
 * app/components/Sponsored.tsx — it is the only disclosure component, it takes
 * no props, and that is deliberate so no surface can water the wording down.
 */

import { LEAGUES } from '../leagues'

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
 * ─── THE INTERNATIONAL STOREFRONT, ON ITS OWN CAMPAIGN ──────────────────────
 *
 * A separate Impact campaign (895352 rather than 586570) covering the
 * international Fanatics business — the one that used to be Kitbag and that
 * runs the official club stores across Europe. The active contract pays on
 * Fanatics IT, ES, FR, DE and MX, plus Online Sale EU/UK/ROW, so these clicks
 * are commissionable and were being thrown away.
 *
 * No query string on this one, so the first appended param uses `?`. That is
 * why `impactUrl()` below computes the separator instead of hardcoding `&`.
 */
const FANATICS_INTL_BASE = 'https://fanatics.93n6tx.net/c/7512608/895352/9663'

/** The US storefront host, for the domestic campaign. */
const FANATICS_US_ORIGIN = 'https://www.fanatics.com'
/**
 * The international storefront host. fanatics.co.uk is the English-language
 * international shop — it prices in GBP, ships worldwide, and is where the
 * European club stock actually lives (fanatics.de / .fr / .es / .it are the
 * localised siblings of the same catalogue).
 */
const FANATICS_INTL_ORIGIN = 'https://www.fanatics.co.uk'

/**
 * Leagues the DOMESTIC (US) storefront stocks per-club.
 *
 * Still a set here rather than a league-table field, because "does the US shop
 * carry this" is a fact about a merchant, and the site's league table exists to
 * mirror the app's registry. The INTERNATIONAL side is different — see below.
 */
const FANATICS_US_LEAGUES = new Set(['NHL', 'NFL', 'NBA', 'MLB', 'NCAAF', 'NCAAB', 'MLS'])

/**
 * Leagues the INTERNATIONAL storefront stocks per-club.
 *
 * ─── MEASURED, NOT ASSUMED (2026-09-08) ─────────────────────────────────────
 * This file previously asserted that Fanatics "does NOT carry the European
 * football leagues". That was true of fanatics.com and false of the
 * international shop, and it cost the ten association-football leagues on
 * /football a real club store each. Probed in a browser against the
 * destination host — never the Impact tracking link, which would register a
 * click — reading rendered product TITLES:
 *
 *   Arsenal            299 items, "Arsenal adidas Away Shirt 2026-27"      ✓
 *   Real Madrid        183 items, "Real Madrid adidas Away Shirt 2026-27"  ✓
 *   Juventus           125 items, "Juventus adidas Third Shirt 2026-27"    ✓
 *   Borussia Dortmund   93 items, "Borussia Dortmund PUMA Home Shirt"      ✓
 *   Paris Saint-Germain      "PSG Nike Home Stadium Shirt 2026-27"         ✓
 *   Olympique Marseille  72 items, 70 title hits                           ✓
 *   Champions League   393 items, 9 title hits — thin, mostly retro        ~
 *   Kashima Antlers      2 items, one 1993-94 retro shirt                  ✗
 *   Saskatchewan Rough. 100 items, ZERO title hits — Yankees memorabilia   ✗
 *
 * ─── WHY ITEM COUNTS ARE NOT EVIDENCE ──────────────────────────────────────
 * That last row is the important one. This shop does NOT return an empty page
 * for something it does not stock — it returns a hundred fuzzily-matched
 * products from unrelated sports. So a non-zero count proves nothing, and the
 * only reliable test is whether the product titles contain the club's name.
 * Anyone re-checking this list must test titles, not counts.
 *
 * UCL is included because every club in its field is stocked under its
 * domestic league; the competition-level query itself is thin.
 */
/**
 * The INTERNATIONAL storefront's leagues come from the league table's
 * `fanaticsStore` field, mirroring the app, where the same fact lives on the
 * league registry.
 *
 * It moved out of a hand-kept set here because the app's league-coverage audit
 * rejected exactly that shape on the app side, and it was right: a six-entry
 * subset of nineteen leagues goes stale silently, and the next league added
 * would inherit the US shop by accident. Keeping the two repos structurally
 * the same also means a reader who has understood one has understood both.
 */
function intlLeagueIds(): Set<string> {
  return new Set(LEAGUES.filter(l => l.fanaticsStore === 'intl').map(l => l.id))
}

export type FanaticsStore = 'us' | 'intl'

/** Which Fanatics storefront stocks this league, or null if neither does. */
export function fanaticsStoreFor(league?: string | null): FanaticsStore | null {
  if (!league) return null
  const id = String(league).trim().toUpperCase()
  if (FANATICS_US_LEAGUES.has(id)) return 'us'
  if (intlLeagueIds().has(id)) return 'intl'
  return null
}

export function fanaticsCarriesLeague(league?: string | null): boolean {
  return fanaticsStoreFor(league) !== null
}

/**
 * Assemble an Impact click URL, appending with the right separator.
 *
 * The US base already carries `?partnerpropertyid=...`, so its params need `&`;
 * the international base has no query string and needs `?`. A second `?`
 * truncates the tracking ids and silently breaks attribution while still
 * rendering a link that works perfectly for the visitor — which is the worst
 * possible failure mode, so the separator is computed rather than typed.
 */
function impactUrl(base: string, destination: string, placementId: string): string {
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}u=${encodeURIComponent(destination)}&subId1=${encodeURIComponent(placementId)}`
}

export function fanaticsTeamUrl(
  teamName: string,
  category?: 'jerseys' | 'hats' | 'gear' | 'apparel',
  league?: string | null,
  placementId = 'public_gear',
): string | null {
  const team = (teamName ?? '').trim()
  if (!team) return null
  // No league given means a domestic-looking query from an older call site.
  const store = league ? fanaticsStoreFor(league) : 'us'
  if (!store) return null
  const query = category && category !== 'gear' ? `${team} ${category}` : team
  const origin = store === 'intl' ? FANATICS_INTL_ORIGIN : FANATICS_US_ORIGIN
  const base = store === 'intl' ? FANATICS_INTL_BASE : FANATICS_BASE
  return impactUrl(base, `${origin}/search?query=${encodeURIComponent(query)}`, placementId)
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
/**
 * ─── THE SAME CREATIVE THE APP RENDERS, AND THAT IS THE POINT ───────────────
 *
 * The publisher account has at least three live SoccerGarage creatives, all
 * valid, all confirmed by the owner:
 *
 *   10479704   a link creative. Pixel on ftjcfx.com. This one — it is what the
 *              app's RepYourSide renders, and this site's unit is the same
 *              shape: a text button with an impression pixel beside it.
 *   10596243   a 120x60 BANNER creative. Pixel on tqlkg.com. Briefly used here
 *              and reverted: this site renders a gold text button and never
 *              displays the banner image, so the banner's click id was being
 *              credited for an impression of an ad nobody saw. If a real
 *              banner placement is ever built, this is its id.
 *   11017822   used by the app's ad-engine slots and Lineup merch rail via
 *              `soccerGarageUrl`. A different placement family, deliberately
 *              reported separately.
 *
 * ─── THE PIXEL HOST IS PER CREATIVE ─────────────────────────────────────────
 * Each id has its own impression-pixel host, and they are not interchangeable:
 * 10479704 is ftjcfx.com, 10596243 is tqlkg.com. Pairing one creative's click
 * with another's pixel reports an impression against an ad that was never
 * shown. The two constants below must always change together.
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
/**
 * Where the SoccerGarage shop link is worth showing.
 *
 * It is no longer the merchant of last resort for European football — Fanatics
 * International stocks those clubs, and a real club store beats a generic shop
 * every time. What SoccerGarage still uniquely offers is the stuff no club
 * store sells: boots, keeper gloves, training kit and match balls. So the link
 * appears wherever association football does, and the copy asks for exactly
 * that rather than naming a club it cannot honour.
 */
const SOCCERGARAGE_LEAGUES = new Set([
  'EPL', 'UCL', 'LALIGA', 'SERIEA', 'BUND', 'LIGUE1', 'MLS', 'CSL', 'ISL', 'JLEAGUE',
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
export type Merchant = 'fanatics' | 'fanatics-intl' | 'soccergarage' | 'ebay'

/** The advertiser's own name, for the visible attribution beside SPONSORED. */
export function advertiserName(m: Merchant): string {
  if (m === 'fanatics') return 'Fanatics'
  // Named for the storefront the click actually lands on. A reader in Madrid
  // clicking a row labelled "Fanatics" and arriving on a GBP shop has been
  // told something slightly untrue about where they were going.
  if (m === 'fanatics-intl') return 'Fanatics UK'
  if (m === 'soccergarage') return 'SoccerGarage'
  return 'eBay'
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
  const fanatics = fanaticsTeamUrl(name, 'gear', league, placementId)
  if (fanatics) return fanatics
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
/**
 * What the merchandise is CALLED, per sport, because the noun decides the
 * result set.
 *
 * Association football kit is a "shirt"; North American kit is a "jersey";
 * searching the wrong one halves the results. Racing has neither — an F1 fan
 * buys team wear and die-casts, and "Formula 1 jersey" was a query nobody has
 * ever typed. Cricket follows the football usage.
 *
 * Keyed on `sport` rather than the football `code` so all nineteen leagues are
 * covered instead of just the two football families.
 */
const GARMENT: Record<string, string> = {
  Soccer: 'shirt',
  Cricket: 'shirt',
  Football: 'jersey',
  Hockey: 'jersey',
  Basketball: 'jersey',
  Baseball: 'jersey',
  Racing: 'merchandise',
}

export function leagueGearLink(
  league: {
    id: string; label: string; full: string
    shopName?: string; code?: string; sport?: string
  },
  placementId = 'public_hub',
): { url: string; merchant: Merchant } | null {
  const name = league.shopName ?? league.full
  const store = fanaticsStoreFor(league.id)
  if (store) {
    const url = fanaticsTeamUrl(league.shopName ?? league.label, 'gear', league.id, placementId)
    if (url) return { url, merchant: store === 'intl' ? 'fanatics-intl' : 'fanatics' }
  }
  const garment = GARMENT[league.sport ?? '']
    ?? (league.code === 'association' ? 'shirt' : 'jersey')
  const url = ebaySearchUrl(`${name} ${garment}`, placementId)
  return url ? { url, merchant: 'ebay' } : null
}
