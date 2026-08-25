/**
 * The handful of values that appear in more than one file.
 *
 * Each of these was previously re-typed per file, which is exactly how a
 * marketing site ends up advertising one price in the hero and another in the
 * FAQ. One definition, imported everywhere.
 */

export const SITE = 'https://getscorebug.app'

/**
 * ─── WHERE ANDROID ACTUALLY IS ───────────────────────────────────────────────
 *
 * This is the ONE switch that changes every Android call to action on the site:
 * the nav button, the hero, the Front Office CTA and the footer all read it.
 *
 * It exists because the site was advertising a Play Store listing that does not
 * exist yet. Every "Get it on Google Play" button pointed at
 * play.google.com/store/apps/details?id=ca.scorebug.sports, which today answers
 * with Google's "we're sorry, the requested URL was not found" page. That is
 * worse than no button: a visitor who taps it concludes the product is dead,
 * and it was also being fed to Google as `installUrl` in the page's structured
 * data, which is a factual claim about availability.
 *
 *   'waitlist' — no public build yet. CTAs open the signup form below the hero.
 *   'testing'  — a Play closed/open test exists. Fill PLAY_TESTING_URL and the
 *                CTAs point straight at the opt-in page.
 *   'live'     — publicly listed. CTAs revert to PLAY_URL.
 *
 * Flip the stage, fill the URL, deploy. Nothing else needs editing.
 */
export type LaunchStage = 'waitlist' | 'testing' | 'live'

export const LAUNCH_STAGE: LaunchStage = 'waitlist'

/**
 * The Play Console opt-in link for a closed or open test. Looks like
 * https://play.google.com/apps/testing/ca.scorebug.sports for a closed test,
 * or a normal store URL for an open one. Only read when LAUNCH_STAGE is
 * 'testing' — leaving it empty in that stage falls back to the waitlist rather
 * than shipping a dead button.
 */
export const PLAY_TESTING_URL = ''

/** The public listing. Only read when LAUNCH_STAGE is 'live'. */
export const PLAY_URL =
  'https://play.google.com/store/apps/details?id=ca.scorebug.sports'

/** The in-page signup section. Every waitlist-stage CTA targets this. */
export const WAITLIST_ANCHOR = '#waitlist'

/**
 * Resolve the Android CTA for the current stage — one place, so the nav and the
 * footer can never disagree with the hero about whether the app is out.
 */
export function androidCta(): { href: string; label: string; caption: string } {
  if (LAUNCH_STAGE === 'live') {
    return { href: PLAY_URL, label: 'Google Play', caption: 'Get it on' }
  }
  if (LAUNCH_STAGE === 'testing' && PLAY_TESTING_URL) {
    return { href: PLAY_TESTING_URL, label: 'Become a tester', caption: 'Android early access' }
  }
  return { href: WAITLIST_ANCHOR, label: 'Join the test', caption: 'Android early access' }
}

/**
 * Supabase, for the waitlist form only.
 *
 * The anon key is publishable by design — it is the browser-side key every
 * Supabase web app ships, and it is powerless without a Row Level Security
 * policy granting something. The service_role key must never appear here.
 *
 * Unset ⇒ the form renders a mailto fallback instead of throwing, so a missing
 * env var in one deploy degrades to "email us" rather than a blank section.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * Where the magic link lands. The web app, NOT this site — this domain has no
 * auth callback route, and Supabase will refuse any redirect target that is not
 * in its allow-list (Dashboard → Authentication → URL Configuration).
 */
export const AUTH_CALLBACK = 'https://app.getscorebug.app/auth/callback/'

/** Reachable contact, used by the waitlist fallback and the confirmation mail. */
export const CONTACT_EMAIL = 'hello@getscorebug.app'

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
 * Links into the web app, served through this domain by the fallback rewrite.
 *
 * NO TRAILING SLASHES HERE, and that is deliberate. This deployment runs on
 * Next's default `trailingSlash: false`, so `/the-slate/` is answered with a
 * 308 that strips the slash before the rewrite is even considered. Linking the
 * bare form skips that hop; next.config.js re-adds the slash on the way OUT to
 * the upstream, which is the side that requires it.
 */
export const APP_LINKS = {
  slate: '/the-slate',
  privacy: '/privacy',
  terms: '/terms',
} as const

/* ── Legal ──────────────────────────────────────────────────────────────────
 *
 * NOTE ON APP_LINKS ABOVE: `privacy` and `terms` are no longer app routes.
 * They are served by THIS deployment (app/privacy, app/terms) and have been
 * removed from the APP_ROUTES allow-list in next.config.js, so those two
 * entries now resolve to the local pages. The paths are identical either way,
 * which is why the footer needed no change.
 */

/**
 * The three documents the stores fetch. Listed here because the sitemap and
 * all three pages cross-link to each other, and a legal page that links to a
 * sibling with a typo is a broken policy URL in a store console.
 */
export const LEGAL_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
  accountDeletion: '/account-deletion',
} as const

/**
 * The operating entity.
 *
 * Earlier drafts of the legal copy said "Scorebug Inc.", which is not a
 * verified registered entity — naming a company that does not exist in a
 * privacy policy is worse than naming none. Scorebug is operated by Cadenic
 * Studios; that is the name that belongs on anything legally binding.
 */
export const COMPANY = 'Cadenic Studios'
export const COMPANY_LOCATION = 'Calgary, Alberta, Canada'
/** Alberta is the governing jurisdiction named in the Terms. */
export const COMPANY_JURISDICTION = 'the Province of Alberta, Canada'

/**
 * The effective date shown on all three legal pages. One constant so they can
 * never disagree about when the terms last changed — a reviewer comparing two
 * documents with two dates reads it as one of them being stale.
 *
 * Bump BOTH when the substance changes. The ISO form feeds <time dateTime>
 * and the sitemap's lastModified; the display form is what people read.
 */
export const LEGAL_UPDATED = 'August 24, 2026'
export const LEGAL_UPDATED_ISO = '2026-08-24'
