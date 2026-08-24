/**
 * The handful of values that appear in more than one file.
 *
 * Each of these was previously re-typed per file, which is exactly how a
 * marketing site ends up advertising one price in the hero and another in the
 * FAQ. One definition, imported everywhere.
 */

export const SITE = 'https://getscorebug.app'

export const PLAY_URL =
  'https://play.google.com/store/apps/details?id=ca.scorebug.sports'

/**
 * The web app, linked as the PRIMARY call to action.
 *
 * Absolute, not a proxied path: this is the one link whose job is to put the
 * visitor in the product immediately, and sending it through the marketing
 * domain's fallback rewrite would add a proxy hop for no benefit. Everything
 * else that points into the app (the footer's legal pages, "open The Slate")
 * still goes through APP_LINKS so the URL bar stays on getscorebug.app.
 */
export const WEB_APP = 'https://app.getscorebug.app'

/**
 * The Front Office pricing, per storefront.
 *
 * Play Billing remains authoritative at purchase time — a visitor outside
 * these two storefronts sees their own local price at checkout, which is why
 * `PRICE_NOTE` travels with every price on the page.
 *
 * The annual plan lands at ~$1.67 a month in BOTH currencies, which is the one
 * number worth leading with. The discount off monthly is NOT the same on both
 * (58% in USD, 67% in CAD), so the page never quotes a single percentage.
 */
export const PRICING = {
  us: { monthly: '$3.99', yearly: '$19.99', currency: 'USD' },
  ca: { monthly: '$5', yearly: '$20', currency: 'CAD' },
  /** True of both storefronts — $19.99/12 and $20/12 both round to $1.67. */
  perMonthEquivalent: '$1.67',
  monthlyCadence: '/ month',
} as const

export const PRICE_NOTE =
  'Cancel any time. Google Play confirms your local price at checkout.'

/**
 * Links into the web app.
 *
 * TRAILING SLASHES ARE LOAD-BEARING. The app deployment is a static export
 * with `trailingSlash: true`, so a request for `/the-slate` answers with a 308
 * to `/the-slate/`. Our fallback rewrite proxies the first request, but the
 * browser follows that redirect itself — to `app.getscorebug.app/the-slate/`,
 * putting the visitor on the subdomain and out of the marketing domain. Asking
 * for the slashed form up front means the proxy serves the document directly
 * and the URL bar stays on getscorebug.app.
 */
export const APP_LINKS = {
  slate: '/the-slate/',
  privacy: '/privacy/',
  terms: '/terms/',
} as const
