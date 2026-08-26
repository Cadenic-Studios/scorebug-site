import Link from 'next/link'
import Image from 'next/image'
import { getProducts, isShopifyConfigured, formatPriceRange, type ShopifyProduct } from '../lib/shopify'
import { getGearTeam, GEAR_TEAM_COUNT } from '../lib/teams'
import { LEAGUE_COUNT } from '../leagues'

/**
 * The Scorebug Network — the homepage's commerce section.
 *
 * ─── THIS ABSORBED "ALSO ON SCOREBUG" ───────────────────────────────────────
 * Two adjacent blocks used to do this job: a "Gear up" product teaser and, right
 * underneath it, a three-card "Also on Scorebug" hub-link row. Both sat below
 * the FAQ, and both were pitching the same three destinations — so the page
 * closed with two weak, near-duplicate sections instead of one strong one.
 * They are merged here, and the passive "Also on Scorebug" heading is gone:
 * "also" frames the whole thing as an afterthought, which is exactly how it
 * performed.
 *
 * ─── PLACEMENT ──────────────────────────────────────────────────────────────
 * Moved from position 8 (after the FAQ, where most sessions never reach) to
 * directly after the product features. It is NOT under the hero: this site's
 * primary conversion is app users, not merch, and a commerce wall above the
 * value props reframes the page as a store and pulls the eye off "get the app".
 * Sitting it after the feature rows is also what makes the subdeck true — you
 * can only say "more than an app" to someone who has just been shown the app.
 *
 * ─── SERVER-FETCHED ─────────────────────────────────────────────────────────
 * Products come from the Storefront API on the server (same getProducts as
 * /shop, ISR-cached), so real titles and prices are in the HTML. If the shop is
 * unconfigured or the fetch fails, the product rail simply omits and the gear
 * rail and hub cards still render — the section can never collapse to nothing.
 */

/** Eight marquee franchises, one strong club per major league, for the rail. */
const TRENDING = [
  'new-york-yankees', 'los-angeles-lakers', 'dallas-cowboys', 'kansas-city-chiefs',
  'toronto-maple-leafs', 'edmonton-oilers', 'boston-celtics', 'los-angeles-dodgers',
]

/* Every CTA names its destination and the action. "Open ›" and "View ›" tell a
   reader nothing about where they land or why they would want to, which is the
   single most common reason a hub card gets skipped. */
const HUBS = [
  {
    href: '/shop',
    kicker: 'Pro Shop',
    accent: '#F85149',
    title: 'Wear it',
    blurb: 'Scorebug tees and hoodies, printed to order and shipped worldwide.',
    cta: 'Shop official gear',
  },
  {
    href: '/gear',
    kicker: 'Fan Gear',
    accent: '#58A6FF',
    title: 'Rep your club',
    blurb: `Jerseys, cards and collectibles for ${GEAR_TEAM_COUNT} clubs across five leagues.`,
    cta: 'Browse team shops',
  },
  {
    href: '/news',
    kicker: 'The Wire',
    accent: '#E5B53C',
    title: 'Know first',
    blurb: `Today's headlines from around the leagues, straight from the outlets that wrote them.`,
    cta: 'Read The Wire',
  },
]

export default async function HomeRevenue() {
  let products: ShopifyProduct[] = []
  if (isShopifyConfigured()) {
    const { data } = await getProducts(4)
    products = (data ?? []).slice(0, 4)
  }
  const trending = TRENDING.map(getGearTeam).filter(Boolean) as NonNullable<ReturnType<typeof getGearTeam>>[]

  return (
    <section className="mx-auto max-w-5xl px-5 py-20" aria-labelledby="network-heading">
      <div className="text-center">
        <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase" style={{ color: '#F85149' }}>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#F85149', boxShadow: '0 0 8px #F85149' }} />
          Beyond the app
        </p>
        <h2 id="network-heading" className="headline mt-5 text-4xl text-ink sm:text-5xl">
          The Scorebug Network
        </h2>
        <p className="mx-auto mt-5 max-w-[36rem] text-[17px] leading-relaxed text-ink-2">
          Scorebug is more than an app. Shop official apparel, browse gear for
          {' '}{GEAR_TEAM_COUNT} teams, and catch the headlines across {LEAGUE_COUNT} leagues.
        </p>
      </div>

      {/* ── Pro Shop products (real, priced, server-rendered) ── */}
      {products.length > 0 && (
        <>
          <div className="mt-14 flex items-end justify-between gap-4">
            <h3 className="headline headline-sm text-2xl text-ink">Straight from the Pro Shop</h3>
            <Link href="/shop" className="flex-shrink-0 text-[13px] font-bold text-ink-3 transition hover:text-ink-2">
              See everything ›
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.map(p => (
              /* Internal route, not the myshopify.com product page — see the
                 note on the same link in app/shop/page.tsx. */
              <Link
                key={p.id}
                href={`/shop/${p.handle}`}
                className="sb-product glass-card group flex flex-col overflow-hidden rounded-2xl"
              >
                <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}>
                  {p.featuredImage?.url ? (
                    <Image
                      src={p.featuredImage.url}
                      alt={p.featuredImage.altText || p.title}
                      fill
                      sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 22vw"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3.5">
                  <span className="line-clamp-2 text-[13.5px] font-bold leading-snug text-ink">{p.title}</span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="text-[13.5px] font-black tabular-nums text-ink">{formatPriceRange(p)}</span>
                    <span aria-hidden className="text-[12px] font-bold text-ink-3 transition group-hover:text-ink-2">Shop ›</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── Trending fan gear (affiliate hub, no fabricated prices) ── */}
      <div className="mt-12 flex items-end justify-between gap-4">
        <h3 className="headline headline-sm text-2xl text-ink">Rep your colours</h3>
        <Link href="/gear" className="flex-shrink-0 text-[13px] font-bold text-ink-3 transition hover:text-ink-2">
          All {GEAR_TEAM_COUNT} teams ›
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {trending.map(t => (
          <Link
            key={t.slug}
            href={`/gear/${t.slug}`}
            className="glass-card group flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/20"
          >
            <span aria-hidden className="h-8 w-1.5 flex-shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}66` }} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold text-ink">{t.short}</span>
              <span className="block truncate text-[11px] text-ink-3">Shop {t.league} gear ›</span>
            </span>
          </Link>
        ))}
      </div>

      {/* ── The three hubs, with CTAs that name the destination ── */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {HUBS.map(h => (
          <Link
            key={h.href}
            href={h.href}
            className="glass-card group flex flex-col rounded-2xl p-6 transition hover:border-white/20"
          >
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: h.accent }}>
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: h.accent, boxShadow: `0 0 8px ${h.accent}` }} />
              {h.kicker}
            </span>
            <span className="mt-3 text-[17px] font-bold leading-snug text-ink">{h.title}</span>
            <span className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-2">{h.blurb}</span>
            <span
              aria-hidden
              className="mt-5 text-[13px] font-black transition group-hover:translate-x-0.5"
              style={{ color: h.accent, display: 'inline-block' }}
            >
              {h.cta} ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
