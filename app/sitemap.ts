import type { MetadataRoute } from 'next'
import { SITE } from './config'

/**
 * ONE URL, and that is correct.
 *
 * This deployment serves exactly one indexable document. Every app route —
 * including /privacy and /terms — now 307s to app.getscorebug.app (see the
 * redirects block in next.config.js), and a sitemap must never list a URL that
 * redirects: it tells a crawler the address is canonical when the server
 * immediately says it is not. The legal pages belong in the app deployment's
 * own sitemap, on the host that actually serves them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  ]
}
