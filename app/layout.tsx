import type { Metadata } from 'next'
import { Anton, Inter, Oswald } from 'next/font/google'
import { SITE, WEB_APP } from './config'
// Derived — a hand-typed league count in metadata is a claim that goes stale
// silently and ships to every search and answer engine before anyone notices.
import { LEAGUE_COUNT } from './leagues'
import './globals.css'

/**
 * ONE description, reused verbatim by the meta tag, the OG card, the Twitter
 * card and the JSON-LD. There used to be four different ones and they
 * disagreed about what the product is; a crawler that sees four answers to
 * "what is this" picks the shortest, which was the worst of them. Keep it
 * under ~150 chars so Google shows all of it, and keep it identical in all
 * four places. Middot, not em dash: the middot is the house separator and
 * already carries the trust strip and the footer.
 */
const DESCRIPTION =
  `Sports logbook app: rate every game you watch out of 5.0, write your take, and keep it forever. Live scores across ${LEAGUE_COUNT} leagues.`

const TITLE = 'Scorebug · Chronicle every game'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
// Oswald mirrors the app's own display face, so text inside the device mockups
// reads as the product. Anton is the store creative's headline voice.
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap' })
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: '%s · Scorebug',
  },
  description: DESCRIPTION,
  /**
   * `keywords` carries no ranking weight at Google and has not for years. It is
   * kept because it is still read by several smaller engines and by some
   * answer-engine crawlers, and because it costs nothing — but the SEO work that
   * matters is in the visible copy and the JSON-LD below, not here. The terms
   * are the high-intent ones the page is actually written to answer, so they
   * stay in step with the headings rather than being a wishlist.
   */
  keywords: [
    'sports logbook app', 'game memory journal', 'personal sports vault',
    'track sports stats watched', 'sports diary app', 'rate games you watch',
    'log every game you watch', 'Letterboxd for sports', 'sports watch history',
    'fan game journal', 'NHL game log', 'NFL game log', 'F1 race log',
    'college football game tracker', 'Premier League match log',
  ],
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'Scorebug',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  appleWebApp: { title: 'Scorebug' },
  category: 'sports',
}

/** SoftwareApplication + FAQPage + Organization, for answer engines.
 *  No aggregateRating on purpose: the listing is new, and invented ratings are
 *  a structured-data violation that gets rich results pulled. Add it only once
 *  real Play Store ratings exist. */
/**
 * ─── THE STUDIO, AS ONE ENTITY ACROSS THREE DOMAINS ─────────────────────────
 *
 * This site, playdeltav.space and cadenic.studio are three domains and one
 * publisher, and until now nothing in the markup said so — the graph below
 * described "Scorebug" as a company that appeared from nowhere and answered to
 * no one. A search engine had no reason to connect it to anything.
 *
 * The @id is a cadenic.studio URL ON PURPOSE. It is the exact string that site
 * publishes its own Organization under, and the same string playdeltav.space
 * now emits, so a crawler that reads any two of the three merges them into one
 * entity instead of describing three studios that share a name. Change it here
 * only if it changes in all three places.
 */
const STUDIO_ID = 'https://cadenic.studio/#organization'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MobileApplication',
      '@id': `${SITE}/#app`,
      name: 'Scorebug',
      alternateName: TITLE,
      description: DESCRIPTION,
      // The same product runs at getscorebug.app, which the page links to.
      // 'Web' only, and that is not modesty. `operatingSystem` is a claim about
      // where a visitor can RUN this today; the Android build is in closed
      // testing and cannot be installed by the public, so listing it invites
      // Google to surface an install intent that dead-ends. Add 'Android' back
      // the day the listing is public.
      operatingSystem: 'Web',
      applicationCategory: 'SportsApplication',
      // `installUrl` pointed at a Play listing that does not exist yet and
      // answers 404. Structured data is a machine-readable factual claim —
      // a bad installUrl is exactly the kind of thing that gets rich results
      // suppressed. The web app is the real, working install target.
      installUrl: WEB_APP,
      // The app itself is free; The Front Office is an in-app subscription.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: SITE,
      screenshot: `${SITE}/og.png`,
      publisher: { '@id': `${SITE}/#org` },
      // Publisher and author are different facts and both are true: Scorebug
      // is the brand a listing appears under, Cadenic Studios is who built it.
      author: { '@id': STUDIO_ID },
      featureList: [
        `The Slate: live scores and schedules across ${LEAGUE_COUNT} leagues (NHL, NFL, NBA, MLB, CFL, NCAA football and men’s basketball, MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League, the Chinese Super League, the Indian Super League, Japan’s J1 League, the Indian Premier League and Formula 1)`,
        'Rate & Chronicle: grade any finished game out of 5.0, write your take, and add private photos',
        'The Time Machine: chronicle any final back to 2002',
        'The Vault: your lifetime archive, sortable by highest- and lowest-rated',
        'The Wire: a news desk built around the teams you follow',
        'The Bleachers: community reviews, fan takes and Linemates',
        'The Franchise: your Starting Lineup’s combined season record',
        'The Front Office: the full Analytics Desk, an unlimited Docket, and no feed ads in The Bleachers',
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'Scorebug',
      url: SITE,
      logo: `${SITE}/icon.svg`,
      // Scorebug is a product line, not a company. The operating entity named
      // on all three legal pages (COMPANY in config.ts) is the studio, and
      // this is that same fact stated where a machine can read it.
      parentOrganization: { '@id': STUDIO_ID },
    },
    {
      '@type': 'Organization',
      '@id': STUDIO_ID,
      name: 'Cadenic Studios',
      url: 'https://cadenic.studio',
      // Deliberately minimal. The studio describes itself in full on its own
      // domain; repeating a description, a logo or an address here would
      // create a second, competing account of the same entity that goes stale
      // the moment the real one is edited. Name, home and sameAs are the three
      // properties needed to make the join, and nothing else is asserted.
      sameAs: ['https://cadenic.studio', 'https://github.com/Cadenic-Studios'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#site`,
      url: SITE,
      name: 'Scorebug',
      publisher: { '@id': `${SITE}/#org` },
      about: { '@id': `${SITE}/#app` },
    },
    /* ── THE SITE FAQ IS NOT IN THIS GRAPH ─────────────────────────────
       It used to be, and it shipped on EVERY page because this graph is
       injected from the root layout. FAQPage markup has to describe FAQ
       content that is visible on the URL carrying it — that is a stated
       Google requirement, not a preference — and the eleven questions in
       app/faqs.ts are rendered on the homepage alone. On /gear/*, /shop/*
       and now /leagues/* and /matchups/* it was describing content that was
       not there, and once the programmatic pages started publishing their
       OWN topical FAQPage there were two FAQPage entities on one URL for a
       crawler to choose between.

       It now lives on the homepage, next to the section it describes:
       app/page.tsx -> homeFaqSchema(). */
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} ${anton.variable}`}>
      <body className="font-sans bg-canvas text-ink min-h-screen">
        <script
          type="application/ld+json"
          // Serialized once at build; '<' is escaped so schema text can never
          // break out of the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  )
}
