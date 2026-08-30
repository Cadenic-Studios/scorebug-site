import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITE } from '../../config'
import { GEAR_TEAMS, getGearTeam } from '../../lib/teams'
import { fanaticsTeamUrl, ebayTeamUrl, ebayPlayerCardUrl, ticketNetworkTeamUrl } from '../../lib/affiliates'
import Sponsored, { AffiliateLink } from '../../components/Sponsored'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav, AppCta } from '../../components/SiteChrome'

/**
 * /gear/[team] — one static page per club.
 *
 * ─── generateStaticParams, NOT A DYNAMIC ROUTE ───────────────────────────────
 * These pages exist to be crawled. Rendering them at build time means the HTML
 * carries the club name, the headings and the outbound links without any
 * JavaScript, which is the whole difference between this and the app's version.
 * `dynamicParams = false` makes anything outside the curated list a real 404
 * rather than an infinitely-generatable affiliate page — mass-generated thin
 * affiliate pages are a named Google spam pattern, and an open [team] param is
 * exactly how a site accidentally ships one.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return GEAR_TEAMS.map(t => ({ team: t.slug }))
}

export async function generateMetadata(
  { params }: { params: { team: string } },
): Promise<Metadata> {
  const t = getGearTeam(params.team)
  if (!t) return {}
  const title = `${t.name} gear, jerseys and memorabilia`
  const description = `Shop ${t.name} jerseys, hats and apparel, hunt ${t.short} cards and collectibles, and find tickets. Then log the game in Scorebug.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/gear/${t.slug}` },
    openGraph: { type: 'website', url: `${SITE}/gear/${t.slug}`, title, description, images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }], },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function Row({
  label, blurb, cta, href, accent,
}: {
  label: string; blurb: string; cta: string; href: string | null; accent: string
}) {
  // A null href means the network does not carry this club. Rendering a dead
  // button is worse than rendering nothing — see fanaticsCarriesLeague.
  if (!href) return null
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>{label}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{blurb}</p>
        </div>
        <Sponsored className="mt-1" />
      </div>
      {/* Tinted per network rather than four identical red enamel buttons.
          Stacked, they read as one repeated control and give the page no
          hierarchy — the Fanatics row is the highest-intent link on it and
          looked exactly like the third eBay row. The accent is the network's
          own, and the ink is picked against it rather than assumed white:
          on the gold TicketNetwork fill, white measures ~2.3:1. */}
      <AffiliateLink
        href={href}
        ariaLabel={`${cta} (opens ${label} in a new tab)`}
        className="sb-cta mt-5 inline-block rounded-xl px-6 py-3 text-[14px] font-black"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}CC 100%)`,
          color: accent === '#E5B53C' ? '#1A1206' : '#FFFFFF',
          border: `1px solid ${accent}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 20px -8px ${accent}`,
        }}
      >
        {cta}
      </AffiliateLink>
    </div>
  )
}

export default function TeamGearPage({ params }: { params: { team: string } }) {
  const t = getGearTeam(params.team)
  if (!t) notFound()

  /**
   * CollectionPage, NOT Product.
   *
   * The directive asked for Product JSON-LD, and it is deliberately not used
   * here: these are affiliate CATEGORY links (a Fanatics search, an eBay
   * category), not individual products with a price and availability. Google's
   * Product markup requires a real `offers.price`, and asserting one we don't
   * have is the exact structured-data-doesn't-match-content violation that gets
   * rich results suppressed or earns a manual action — the same reason the app
   * schema in layout.tsx avoids faking a rating. A CollectionPage that honestly
   * describes the page as a curated set of outbound shopping links is the valid
   * schema for what this page actually is. Priced Product markup belongs on
   * /shop, where the prices are real and server-rendered.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t.name} gear and memorabilia`,
    description: `Shop ${t.name} jerseys, hats, cards, collectibles and tickets.`,
    url: `${SITE}/gear/${t.slug}`,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#site` },
    about: { '@type': 'SportsTeam', name: t.name, sport: t.league },
  }

  return (
    <>
      <Breadcrumbs trail={[
        { name: 'Scorebug', url: SITE },
        { name: 'Gear', url: `${SITE}/gear` },
        { name: t.name },
      ]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="lit-blue floodlights relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-4xl px-5 pb-24 pt-14">
        <BreadcrumbNav trail={[
          { name: 'Scorebug', href: '/' },
          { name: 'Gear', href: '/gear' },
          { name: t.name },
        ]} />

        <p
          className="glass-pill mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase"
          style={{ color: t.color }}
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
          {t.league}
        </p>

        <h1 className="headline headline-display mt-6 text-[2.8rem] text-white sm:text-[3.6rem]">
          {t.name}
          <br />
          gear.
        </h1>

        <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
          Everything for {t.short} fans in one place. Scorebug earns a commission on
          purchases made through the links below, at no extra cost to you.
        </p>

        {/* `grid` WITHOUT `grid-cols-*` is a one-column grid — the default
            `grid-template-columns` is `none`, so this laid four partner cards
            out single-file at every width inside a wide container. It reads as
            a stack that forgot to become a grid, which is what it was. */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Row
            label="Fanatics"
            accent="#F85149"
            blurb={`Authentic ${t.short} jerseys, headwear and sideline apparel, including youth and women's cuts.`}
            cta={`Shop ${t.short} apparel`}
            href={fanaticsTeamUrl(t.name, 'gear', t.league)}
          />
          <Row
            label="eBay · Memorabilia"
            accent="#58A6FF"
            blurb={`${t.short} autographs, game-used pieces and vintage memorabilia, scoped to eBay's sports category.`}
            cta={`Hunt ${t.short} collectibles`}
            href={ebayTeamUrl(t.name)}
          />
          <Row
            label="eBay · Trading cards"
            accent="#3FB950"
            blurb={`Rookie cards and graded singles for ${t.short} players.`}
            cta={`Browse ${t.short} cards`}
            href={ebayPlayerCardUrl(t.name, 'rookie card')}
          />
          <Row
            label="TicketNetwork"
            accent="#E5B53C"
            blurb={`Resale seats for upcoming ${t.short} fixtures, home and away.`}
            cta={`Find ${t.short} tickets`}
            href={ticketNetworkTeamUrl(t.name)}
          />
        </div>

        {/* The point of the page is not the commission — it is the app. */}
        <AppCta
          className="mt-10"
          line={`Add ${t.short} to your Starting Lineup — Scorebug keeps their record, their headlines and every game you rate, in one place.`}
        />
      </div>
      </main>
      <SiteFooter />
    </>
  )
}
