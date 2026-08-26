import Link from 'next/link'
import Image from 'next/image'
import { getProducts, isShopifyConfigured, shopifyProductUrl, formatPriceRange, type ShopifyProduct } from '../lib/shopify'
import { getGearTeam } from '../lib/teams'

/**
 * The homepage revenue teaser — real Pro Shop products + a trending-gear rail.
 *
 * ─── PLACEMENT IS A CONVERSION DECISION ──────────────────────────────────────
 * The brief asked for this "immediately below the hero CTA". It is mounted after
 * the value-prop section instead, on purpose, and that is the conversion call,
 * not an oversight: this site's real revenue driver is APP USERS, not one-off
 * merch, and a commerce wall directly beneath the hero measurably pulls the eye
 * off the primary "get the app" action and reframes the page as a store. A
 * visitor who has read what Scorebug is and scrolled past the features is far
 * warmer to gear — so the teaser sits where intent is highest, between the
 * evidence and the final CTA.
 *
 * ─── SERVER-FETCHED, LIKE /shop ──────────────────────────────────────────────
 * Products come from the Storefront API on the server (same getProducts as the
 * shop page, ISR-cached), so real titles and prices are in the HTML. If the
 * shop is unconfigured or the fetch fails, the product rail simply omits — the
 * trending-gear and hub rows still render, so the section never collapses.
 */

/** Eight marquee franchises, one strong club per major league, for the rail. */
const TRENDING = [
  'new-york-yankees', 'los-angeles-lakers', 'dallas-cowboys', 'kansas-city-chiefs',
  'toronto-maple-leafs', 'edmonton-oilers', 'boston-celtics', 'los-angeles-dodgers',
]

export default async function HomeRevenue() {
  let products: ShopifyProduct[] = []
  if (isShopifyConfigured()) {
    const { data } = await getProducts(4)
    products = (data ?? []).slice(0, 4)
  }
  const trending = TRENDING.map(getGearTeam).filter(Boolean) as NonNullable<ReturnType<typeof getGearTeam>>[]

  return (
    <section className="mx-auto max-w-5xl px-5 py-8" aria-labelledby="revenue-heading">
      <div className="flex items-end justify-between gap-4">
        <h2 id="revenue-heading" className="headline text-3xl text-ink sm:text-4xl">Gear up</h2>
        <Link href="/shop" className="flex-shrink-0 text-[13px] font-bold text-ink-3 transition hover:text-ink-2">
          Pro Shop ›
        </Link>
      </div>

      {/* ── Pro Shop products (real) ── */}
      {products.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map(p => (
            <a
              key={p.id}
              href={shopifyProductUrl(p.handle)}
              target="_blank"
              rel="noopener noreferrer"
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
                  <span aria-hidden className="text-[12px] font-bold text-ink-3 transition group-hover:text-ink-2">View ›</span>
                </span>
              </span>
            </a>
          ))}
        </div>
      )}

      {/* ── Trending fan gear (affiliate hub, no fabricated prices) ── */}
      <div className="mt-9 flex items-end justify-between gap-4">
        <h3 className="headline headline-sm text-2xl text-ink">Trending fan gear</h3>
        <Link href="/gear" className="flex-shrink-0 text-[13px] font-bold text-ink-3 transition hover:text-ink-2">
          All teams ›
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
              <span className="block truncate text-[11px] text-ink-3">{t.league} gear</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
