import type { Metadata } from 'next'
import { Anton, Inter, Oswald } from 'next/font/google'
import { FAQS } from './faqs'
import { SITE, PLAY_URL } from './config'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
// Oswald mirrors the app's own display face, so text inside the device mockups
// reads as the product. Anton is the store creative's headline voice.
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap' })
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Scorebug — Chronicle Every Game',
    template: '%s · Scorebug',
  },
  // ~150 chars: long enough to earn the click, short enough that Google shows
  // all of it rather than cutting mid-sentence.
  description:
    'The ultimate fan log. Track live scores, rate every matchup out of 5, and build a permanent archive of every game you watch — across 15 leagues.',
  keywords: [
    'sports tracking app', 'log sports games', 'rate sports games',
    'Letterboxd for sports', 'sports diary', 'game journal', 'fan log',
    'NHL tracker', 'NFL tracker', 'F1 race log', 'sports social network',
  ],
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'Scorebug',
    title: 'Scorebug — Chronicle Every Game',
    description:
      'The ultimate fan log. Rate the classics, journal the heartbreaks, and build a permanent archive of your lifetime in sports.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug — chronicle every game' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scorebug — Chronicle Every Game',
    description:
      'The ultimate fan log. Track live scores, rate matchups, and save your record across 15 leagues.',
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
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MobileApplication',
      '@id': `${SITE}/#app`,
      name: 'Scorebug',
      alternateName: 'Scorebug — Chronicle Every Game',
      description:
        'The ultimate fan log. Track live scores, rate matchups out of 5, and build a permanent archive of every game you watch across 15 leagues.',
      // The same product runs at getscorebug.app, which the page links to.
      operatingSystem: 'Android, Web',
      applicationCategory: 'SportsApplication',
      installUrl: PLAY_URL,
      // The app itself is free; The Front Office is an in-app subscription.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: SITE,
      screenshot: `${SITE}/og.png`,
      publisher: { '@id': `${SITE}/#org` },
      featureList: [
        'The Slate: live scores and schedules across 15 leagues — NHL, NFL, NBA, MLB, CFL, NCAA football and men’s basketball, MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League and Formula 1',
        'Rate & Chronicle: grade any finished game out of 5.0, write your take, and add private photos',
        'The Time Machine: chronicle any final back to 2002',
        'The Vault: your lifetime archive, sortable by highest- and lowest-rated',
        'The Wire: a news desk built around the teams you follow',
        'The Bleachers: community reviews, fan takes and Linemates',
        'The Franchise: your Starting Lineup’s combined season record',
        'The Front Office: the full Analytics Desk, unlimited Docket and Clippings, and no ads',
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'Scorebug',
      url: SITE,
      logo: `${SITE}/icon.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#site`,
      url: SITE,
      name: 'Scorebug',
      publisher: { '@id': `${SITE}/#org` },
      about: { '@id': `${SITE}/#app` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE}/#faq`,
      url: SITE,
      isPartOf: { '@id': `${SITE}/#site` },
      mainEntity: FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
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
