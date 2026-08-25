import type { MetadataRoute } from 'next'
import { SITE, LEGAL_PATHS, LEGAL_UPDATED_ISO } from './config'

/**
 * FOUR URLs: the landing page and the three legal documents.
 *
 * The rule this file used to state — never list a URL that redirects — still
 * holds, and it is why every other app route is absent: they 307 to
 * app.getscorebug.app, and advertising a redirect as canonical tells a crawler
 * the opposite of what the server does.
 *
 * /privacy, /terms and /account-deletion are no longer among them. They were
 * removed from the APP_ROUTES allow-list in next.config.js because Google Play
 * fetches those URLs itself, out of band, and will not accept a cross-host
 * bounce as "reachable". They are real pages in this deployment now, so they
 * belong here — a store reviewer or crawler that starts at the sitemap should
 * find the policy, the terms and the deletion instructions without guessing.
 *
 * `lastModified` on the three tracks LEGAL_UPDATED_ISO rather than the build
 * clock: a legal document's date is the day its wording changed, and every
 * deploy claiming a fresh policy is a claim that is nearly always false.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const legalUpdated = new Date(LEGAL_UPDATED_ISO)
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}${LEGAL_PATHS.privacy}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.terms}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.accountDeletion}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
  ]
}
