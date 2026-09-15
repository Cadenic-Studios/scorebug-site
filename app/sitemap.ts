import type { MetadataRoute } from 'next'
import { SITE, LEGAL_PATHS, LEGAL_UPDATED_ISO, REFUNDS_UPDATED_ISO } from './config'
import { GEAR_TEAMS } from './lib/teams'
import { LEAGUES } from './leagues'
import { SPORT_HUBS } from './sports'
import { MATCHUPS } from './matchups'
import { getProductHandles } from './lib/shopify'

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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productHandles = await getProductHandles()
  const legalUpdated = new Date(LEGAL_UPDATED_ISO)
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    /**
     * /slate is the archive of the weekly fixture pages the marketing engine
     * publishes (app/slate). Weekly: a new page every Monday. The individual
     * weeks are discovered from the archive rather than listed here, because
     * the engine, not this build, knows which weeks exist.
     */
    { url: `${SITE}/slate`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    /**
     * /game is the index of games fans have graded, and the individual game
     * pages are discovered FROM it rather than listed here — the same reasoning
     * as /slate directly above.
     *
     * It is also the only honest option. A game's canonical URL contains the
     * date it was played, and the database stores when somebody WATCHED, not
     * when the game happened. The index links through a resolver that finds the
     * real date and 301s. Listing those resolver URLs would break this file's
     * own rule — never advertise a URL that redirects — and listing guessed
     * dated URLs would fill the sitemap with 404s for every back-logged game.
     *
     * `daily`: the list changes every night somebody logs a game.
     */
    { url: `${SITE}/game`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    /**
     * /discord answers "<product> discord", which is about the highest-intent
     * query a small product gets — the person already knows what you are and is
     * looking for the door. A discord.gg invite cannot rank for it: those pages
     * are noindex and the link carries no readable text. This page can, lives on
     * our domain, and survives the invite being regenerated.
     *
     * `monthly`: the channel and command lists change rarely, and claiming daily
     * freshness for a page that does not change trains a crawler to ignore the
     * signal on the pages that do.
     */
    { url: `${SITE}/discord`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    /**
     * /shop is the reason the Pro Shop was invisible to search, and the fix is
     * this line plus the robots rule beside it — not the "unlock" it looked
     * like. The catalogue was always public on the app; robots.txt just blocked
     * every path to it (`Disallow: /the-` is a PREFIX rule and caught
     * /the-pro-shop), and nothing indexable linked to it.
     *
     * `daily`, unlike the legal pages: stock and pricing move, and this is the
     * one page whose structured data makes a factual claim about both.
     */
    { url: `${SITE}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    /* One entry per product, now that each has a real page on THIS domain.
       Fetched rather than hard-coded so a newly published product is in the
       sitemap on the next regeneration — the same source generateStaticParams
       uses, so this cannot advertise a handle the route will not serve. An
       unreachable Shopify yields [] and simply omits them, which is correct:
       better a short sitemap than one full of URLs that 404. */
    ...productHandles.map(handle => ({
      url: `${SITE}/shop/${handle}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    { url: `${SITE}/gear`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    /* One entry per statically generated club page. Generated from the same list
       the route's generateStaticParams uses, so the sitemap cannot advertise a
       URL the build did not produce. */
    ...GEAR_TEAMS.map(t => ({
      url: `${SITE}/gear/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    /* ── The sport hubs ───────────────────────────────────────────────────
       Priority 0.8, level with /leagues: these are the pages the vanity
       domains land on, so they are an entry point to the site rather than a
       leaf. Their own URLs are the ones listed — scorebug.hockey and
       scorebug.football are NEVER listed anywhere, by anything. A sitemap
       naming a host that 308s away says the opposite of what the server does,
       which is the rule this file opens with. */
    ...SPORT_HUBS.map(h => ({
      url: `${SITE}/${h.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    /* ── Programmatic set: league hubs and rivalry pages ───────────────────
       Generated from the same lists their routes' generateStaticParams use, so
       the sitemap cannot advertise a URL the build did not produce. Both routes
       set `dynamicParams = false`, which means anything outside these lists is a
       real 404 rather than an infinitely-generatable thin page. */
    { url: `${SITE}/leagues`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...LEAGUES.map(l => ({
      url: `${SITE}/leagues/${l.id.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    { url: `${SITE}/matchups`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...MATCHUPS.map(m => ({
      url: `${SITE}/matchups/${m.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    /* /news is listed but see the long note in app/news/page.tsx — aggregated
       headlines are unlikely to rank and this entry is here so the page is
       discoverable, not because it is expected to carry search traffic. */
    { url: `${SITE}/news`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.4 },
    /* /pricing is a commercial page, not a legal one: it changes when the
       product's tiers change, and a payment provider re-checks it. */
    { url: `${SITE}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}${LEGAL_PATHS.refunds}`, lastModified: new Date(REFUNDS_UPDATED_ISO), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.privacy}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.terms}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.accountDeletion}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
  ]
}
