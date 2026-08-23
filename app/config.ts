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
 * The Front Office pricing, as displayed.
 *
 * NOT AUTHORITATIVE. In the app these numbers come from Play Billing at
 * runtime; the values below mirror the app's own fallback catalogue, which is
 * marked `placeholder: true` in lib/services/billing.ts. Anything on the page
 * that shows a price must therefore ship with `PRICE_NOTE` beside it.
 */
export const PRICING = {
  monthly: '$3.99',
  monthlyCadence: '/ month',
  yearly: '$19.99',
  perMonthEquivalent: '$1.67',
} as const

export const PRICE_NOTE =
  'Planned rates shown; Google Play confirms the live price in your currency at checkout.'

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
