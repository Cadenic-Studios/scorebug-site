import type { MetadataRoute } from 'next'
import { SITE } from './config'

/**
 * The marketing surface, plus the two legal pages.
 *
 * The authenticated app routes (/the-slate, /the-vault, …) are deliberately
 * absent and are blocked in robots.ts — they render a login wall to a bot.
 * /privacy and /terms are proxied from the app deployment but are public,
 * indexable, and required reading for a Play Store listing, so they belong
 * here. Trailing slashes match what the upstream export actually serves.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/privacy/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/terms/`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
