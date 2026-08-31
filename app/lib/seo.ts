import { SITE, WEB_APP } from '../config'

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

const PUBLISHER = {
  '@type': 'SportsOrganization',
  '@id': `${SITE}#organization`,
  name: 'Scorebug',
  url: SITE,
  logo: `${SITE}/og.png`,
  description:
    'An independent sports logbook. Track live scores, then grade and write up '
    + 'every game you watch. No gambling ads and no sportsbook sponsorships.',
  areaServed: 'Worldwide',
  knowsAbout: [] as string[],
}

export function organizationSchema(knowsAbout: string[]) {
  return { ...PUBLISHER, knowsAbout }
}

export function applicationSchema(name: string, description: string) {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE}#app`,
    name,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Android, Web',
    url: WEB_APP,
    description,
    publisher: { '@id': `${SITE}#organization` },
    // Free to use. The Front Office tier is an optional upgrade, not a gate on
    // the product, so the entry price is the honest figure to publish.
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
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
