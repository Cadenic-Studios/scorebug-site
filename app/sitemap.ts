import type { MetadataRoute } from 'next'

/**
 * Only the marketing surface is listed. App routes (/the-slate, /the-vault, …)
 * are proxied to the authenticated web app and have no business in a crawler's
 * queue — they render a login wall to a bot.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://getscorebug.app',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
