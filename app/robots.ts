import type { MetadataRoute } from 'next'
import { SITE } from './config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        /* ── /api/card IS ALLOWED, AND IT MATTERS ─────────────────────────
           The card press renders the Open Graph image for every game page and
           for /discord. `Disallow: /api/` below covers it, so Google's image
           crawler — which honours robots.txt where most social unfurlers do
           not — could never fetch a single share image, and none of them could
           ever appear in image search. The allow is listed first because the
           longest matching prefix wins and an explicit Allow beats a Disallow
           of the same specificity. */
        allow: ['/', '/api/card'],
        // The proxied app routes serve an auth wall to crawlers — keep bots on
        // the marketing surface where the answers actually are.
        // '/go' is the affiliate redirector and '/admin' the back office —
        // both are proxied through this domain and neither belongs in an index.
        disallow: [
          '/the-', '/player-card', '/linemates', '/fan', '/activity',
          '/auth', '/admin', '/go',
          // The engine console, the two tagged redirectors and the card press:
          // none is a page, and a crawler following /get would land on the waitlist
          // with a campaign tag it invented.
          '/ops', '/get', '/r/', '/api/', '/newsletter/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
