import type { Metadata } from 'next'
import { SITE } from '../config'
import { requireSportHub } from '../sports'
import SportHubPage from '../components/SportHubPage'

/**
 * /hockey — the sport hub scorebug.hockey lands on.
 *
 * A four-line route file on purpose: everything that makes this page is in
 * app/sports.ts (the copy and the derived lists) and
 * app/components/SportHubPage.tsx (the body). Both hubs render from the same
 * component, so a layout fix lands on both and they cannot drift apart.
 */
/* Resolved at module scope, and `requireSportHub` throws rather than returning
 * undefined: a folder whose slug is not in SPORT_HUBS should fail the build
 * here, not ship a page with nothing in it. There is no runtime `notFound()`
 * because there is no runtime input — the slug is the folder name. */
const HUB = requireSportHub('hockey')

export const metadata: Metadata = {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `${SITE}/hockey` },
  openGraph: {
    type: 'website', siteName: 'Scorebug',
    url: `${SITE}/hockey`,
    title: HUB.title,
    description: HUB.description,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }],
  },
  twitter: { card: 'summary_large_image', title: HUB.title, description: HUB.description },
}

export default function Page() {
  return <SportHubPage hub={HUB} />
}
