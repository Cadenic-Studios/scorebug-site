import type { Metadata } from 'next'
import { SITE } from '../config'

/**
 * One page's metadata, built so the canonical, the Open Graph URL and the card
 * title cannot disagree.
 *
 * ─── THE BUG THIS EXISTS TO KILL ────────────────────────────────────────────
 * Next's metadata resolution merges `openGraph` by BLOCK, not by field. A route
 * that sets `title` and `description` but no `openGraph` inherits the ROOT
 * layout's entire OG block — so /leagues, /matchups, /pricing, /privacy,
 * /terms, /refunds and /account-deletion each shipped
 * `og:url = https://getscorebug.app` and `og:title = Scorebug · Chronicle every
 * game` while their canonical pointed somewhere else. Every share of those
 * seven pages unfurled as the homepage.
 *
 * The mirror-image failure is just as real: a route that DOES declare an
 * `openGraph` block replaces the parent's wholesale, which is why /football and
 * /hockey emitted no `og:site_name` at all.
 *
 * Passing one `path` and getting both the canonical and the OG URL from it
 * makes the first bug unrepresentable, and spelling out `siteName` here fixes
 * the second everywhere it is used.
 *
 * ─── WHY IT IS NOT IN lib/seo.ts ───────────────────────────────────────────
 * That file is JSON-LD only, and keeping the two apart is deliberate: one
 * describes the ENTITY to a knowledge graph, this one describes the DOCUMENT to
 * a crawler and a share card. They go stale for different reasons.
 *
 * ─── og:image IS THE SAME CARD EVERYWHERE, ON PURPOSE ──────────────────────
 * Every route serves the one static /og.png, so `alt` stays generic. A per-page
 * alt would describe an image that does not depict that page, which is worse
 * for the screen-reader users the attribute exists for than saying less.
 */
export function pageMeta(
  { path, title, description }: { path: string; title: string; description: string },
): Metadata {
  const url = `${SITE}${path}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Scorebug',
      title,
      description,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}
