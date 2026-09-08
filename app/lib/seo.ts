import { SITE, appPlatforms } from '../config'

/**
 * Structured data shared by the programmatic pages.
 *
 * ─── WHY THESE THREE TYPES ──────────────────────────────────────────────────
 * `SoftwareApplication` is what puts the app's name, platform, price and rating
 * context into an AI overview when somebody asks "is there an app that…".
 * `SportsOrganization` identifies Scorebug as the publisher of the coverage
 * being described, which is what lets an answer engine attribute a claim.
 * `FAQPage` is the only one of the three whose content can be quoted verbatim
 * into a search snippet, which is why the questions are written as the
 * questions people actually type rather than as marketing headings.
 *
 * ─── EVERY CLAIM HERE MUST BE TRUE ──────────────────────────────────────────
 * Structured data is a machine-readable assertion, and a false one is worse
 * than none: it is the shape of claim that gets a site's rich results revoked
 * wholesale. `offers` says the app is free to use because it is; the paid tier
 * is an upgrade, not a price of entry, so it is not stated as a price here.
 * Nothing in this file claims a rating, a review count, or a league
 * partnership — see scorebug-marketing-claims for what the product does not
 * support.
 */

/**
 * ─── THESE NODES ARE REFERENCES, NOT DEFINITIONS ────────────────────────────
 *
 * app/layout.tsx injects the full Organization, WebSite and SoftwareApplication
 * graph on EVERY page. These helpers used to define their own copies — and
 * under a different @id, because `SITE` carries no trailing slash, so this file
 * emitted `getscorebug.app#organization` while the layout emitted
 * `getscorebug.app/#org`. Different IRIs are different entities: every hub,
 * league and matchup page shipped TWO Scorebug organisations and TWO Scorebug
 * apps, and the node being diluted was the layout's — the one carrying
 * `parentOrganization` up to cadenic.studio.
 *
 * They now emit the SAME @id as the layout and carry ONLY what is genuinely
 * per-page. A node repeating `@id` merges with the layout's; a node also
 * repeating `name`, `logo` and `description` merges into a contradiction.
 *
 * Before adding a property here, check app/layout.tsx does not already say it.
 * Two values for one property on one node is worse than none.
 */

/** Per-page topical scope. Everything else about the organisation is in the
 *  layout's node, which this merges into. */
export function organizationSchema(knowsAbout: string[]) {
  return { '@id': `${SITE}/#org`, knowsAbout }
}

/**
 * Per-page nuance about the app.
 *
 * `description` is deliberately NOT accepted: the layout already supplies one,
 * and schema.org has no notion of a "more specific" description — a second
 * value is a conflict, not a refinement. `operatingSystem` comes from
 * appPlatforms() so this file and the layout cannot disagree about whether
 * Android is publicly available.
 */
export function applicationSchema() {
  return { '@id': `${SITE}/#app`, operatingSystem: appPlatforms() }
}

export interface Faq { q: string; a: string }

export function faqSchema(faqs: Faq[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

/**
 * One `@graph` rather than three separate script tags: it lets the nodes
 * reference each other by `@id` (the app names its publisher) instead of
 * repeating the organisation inline three times, which is both smaller and
 * what Google's own documentation recommends for multi-entity pages.
 */
export function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes }
}
