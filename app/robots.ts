import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The proxied app routes serve an auth wall to crawlers — keep bots on
        // the marketing surface where the answers actually are.
        disallow: ['/the-', '/player-card', '/linemates', '/fan', '/activity', '/auth'],
      },
    ],
    sitemap: 'https://getscorebug.app/sitemap.xml',
  }
}
