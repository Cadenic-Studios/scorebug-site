import type { MetadataRoute } from 'next'
import { SITE, LEGAL_PATHS, LEGAL_UPDATED_ISO, REFUNDS_UPDATED_ISO } from './config'
import { GEAR_TEAMS } from './lib/teams'
import { LEAGUES } from './leagues'
import { SPORT_HUBS } from './sports'
import { MATCHUPS } from './matchups'
import { getProductHandles } from './lib/shopify'
import { harvestRecent } from './lib/harvest'

/**
 * ─── WHY THIS IS A CONSTANT AND NOT `new Date()` ────────────────────────────
 *
 * Every entry in this file used to call `new Date()` at render time, so every
 * one of the 258 URLs claimed to have been modified the moment the crawler
 * asked. Two fetches thirty-seven minutes apart returned two different
 * timestamps for the same unchanged page.
 *
 * `lastmod` means the content changed. When it always says "just now", Google
 * detects that it is meaningless and discounts it sitewide — which costs the
 * one signal that gets a genuinely updated page recrawled quickly. Paying that
 * price on the pages that DO change is the real cost of lying on the ones that
 * do not.
 *
 * Module scope, so it is evaluated once per deployment rather than once per
 * request. That is still not the content's true modification date — it is the
 * build's — but a date that moves when the site is rebuilt is an honest
 * approximation, and a date that moves when a crawler blinks is not.
 */
const BUILT = new Date()

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
  /* Both in flight at once. A crawler waiting on a sitemap is a crawler
     spending its budget on nothing, and these two have no relationship.

     A harvest failure returns an empty array rather than throwing, so ESPN
     being unreachable costs this file its game URLs for one cache window and
     costs the other 258 nothing. A sitemap that 500s is worse than a sitemap
     that is briefly shorter. */
  const [productHandles, recentGames] = await Promise.all([
    getProductHandles(),
    harvestRecent({ days: 4, limit: 180 }).catch(() => []),
  ])
  const legalUpdated = new Date(LEGAL_UPDATED_ISO)
  return [
    { url: SITE, lastModified: BUILT, changeFrequency: 'weekly', priority: 1 },
    /**
     * /slate is the archive of the weekly fixture pages the marketing engine
     * publishes (app/slate). Weekly: a new page every Monday. The individual
     * weeks are discovered from the archive rather than listed here, because
     * the engine, not this build, knows which weeks exist.
     */
    { url: `${SITE}/slate`, lastModified: BUILT, changeFrequency: 'weekly', priority: 0.7 },
    /**
     * /game is the index of games fans have graded, and the individual game
     * pages are discovered FROM it rather than listed here — the same reasoning
     * as /slate directly above.
     *
     * That WAS the only honest option, and the reasoning is preserved here
     * because it was right at the time: a game's canonical URL contains the
     * date it was PLAYED, the database stores when somebody WATCHED, the index
     * had to link through a resolver that 301s, and listing guessed dates would
     * have filled this file with 404s.
     *
     * The harvester removed the constraint rather than the rule. It reads
     * finished fixtures from the scoreboard, so it holds the real start date
     * and builds the exact canonical slug — no resolver, no guess, no redirect.
     * The rule stands; the obstacle is gone.
     *
     * `daily`: the list changes every night somebody logs a game.
     */
    { url: `${SITE}/game`, lastModified: BUILT, changeFrequency: 'daily', priority: 0.8 },
    /**
     * THE GAME PAGES THEMSELVES.
     *
     * Bounded to a recent window on purpose. Every fixture ever played would be
     * a doorway farm, which app/matchups.ts and lib/teams.ts both refuse for the
     * same reason — and a sitemap of a hundred thousand near-identical URLs is
     * how a domain earns that judgement. These are the last few days, rated,
     * and a page only appears once the box score says something about it.
     *
     * `lastModified` is the day the game was played. A finished box score never
     * changes, so that date is true and stays true — the one genuinely accurate
     * lastmod in this file.
     */
    ...recentGames.map(g => ({
      url: `${SITE}${g.href}`,
      lastModified: new Date(`${g.date}T12:00:00.000Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
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
    { url: `${SITE}/discord`, lastModified: BUILT, changeFrequency: 'monthly', priority: 0.7 },
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
    { url: `${SITE}/shop`, lastModified: BUILT, changeFrequency: 'daily', priority: 0.9 },
    /* One entry per product, now that each has a real page on THIS domain.
       Fetched rather than hard-coded so a newly published product is in the
       sitemap on the next regeneration — the same source generateStaticParams
       uses, so this cannot advertise a handle the route will not serve. An
       unreachable Shopify yields [] and simply omits them, which is correct:
       better a short sitemap than one full of URLs that 404. */
    ...productHandles.map(handle => ({
      url: `${SITE}/shop/${handle}`,
      lastModified: BUILT,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    { url: `${SITE}/gear`, lastModified: BUILT, changeFrequency: 'weekly', priority: 0.8 },
    /* One entry per statically generated club page. Generated from the same list
       the route's generateStaticParams uses, so the sitemap cannot advertise a
       URL the build did not produce. */
    ...GEAR_TEAMS.map(t => ({
      url: `${SITE}/gear/${t.slug}`,
      lastModified: BUILT,
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
      lastModified: BUILT,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    /* ── Programmatic set: league hubs and rivalry pages ───────────────────
       Generated from the same lists their routes' generateStaticParams use, so
       the sitemap cannot advertise a URL the build did not produce. Both routes
       set `dynamicParams = false`, which means anything outside these lists is a
       real 404 rather than an infinitely-generatable thin page. */
    { url: `${SITE}/leagues`, lastModified: BUILT, changeFrequency: 'weekly', priority: 0.8 },
    ...LEAGUES.map(l => ({
      url: `${SITE}/leagues/${l.id.toLowerCase()}`,
      lastModified: BUILT,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    { url: `${SITE}/matchups`, lastModified: BUILT, changeFrequency: 'weekly', priority: 0.7 },
    ...MATCHUPS.map(m => ({
      url: `${SITE}/matchups/${m.slug}`,
      lastModified: BUILT,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    /* /news is listed but see the long note in app/news/page.tsx — aggregated
       headlines are unlikely to rank and this entry is here so the page is
       discoverable, not because it is expected to carry search traffic. */
    { url: `${SITE}/news`, lastModified: BUILT, changeFrequency: 'hourly', priority: 0.4 },
    /* /pricing is a commercial page, not a legal one: it changes when the
       product's tiers change, and a payment provider re-checks it. */
    { url: `${SITE}/pricing`, lastModified: BUILT, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}${LEGAL_PATHS.refunds}`, lastModified: new Date(REFUNDS_UPDATED_ISO), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.privacy}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.terms}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}${LEGAL_PATHS.accountDeletion}`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.5 },
  ]
}
