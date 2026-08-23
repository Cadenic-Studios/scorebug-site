import type { MetadataRoute } from 'next'
import { SITE } from './config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The proxied app routes serve an auth wall to crawlers — keep bots on
        // the marketing surface where the answers actually are.
        // '/go' is the affiliate redirector and '/admin' the back office —
        // both are proxied through this domain and neither belongs in an index.
        disallow: [
          '/the-', '/player-card', '/linemates', '/fan', '/activity',
          '/auth', '/admin', '/go',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
