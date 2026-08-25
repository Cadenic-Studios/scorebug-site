import type { Metadata } from 'next'
import Image from 'next/image'
import { SITE, WEB_APP } from '../config'
import {
  getProducts, isShopifyConfigured, shopifyProductUrl,
  formatPriceRange, formatMoney, categoryLabel, isApparel,
  type ShopifyProduct,
} from '../lib/shopify'

/**
 * /shop — the PUBLIC, crawlable storefront.
 *
 * ─── WHY THIS EXISTS WHEN THE APP ALREADY HAS ONE ────────────────────────────
 * The brief was that the Pro Shop was "locked behind the authenticated web app".
 * It is not — app.getscorebug.app/the-pro-shop has no auth guard and serves the
 * full catalogue to a signed-out browser. The real reason it earns no search
 * traffic is two lines of configuration:
 *
 *   1. getscorebug.app/robots.txt carried `Disallow: /the-`, a PREFIX rule that
 *      blocked /the-pro-shop (and every other app route) from being crawled at
 *      all — so the redirect that would have carried a crawler to the app was
 *      never followed.
 *   2. The app is `output: 'export'` with client-side data fetching and one
 *      app-wide <title>. Even once crawled, a crawler receives an empty grid and
 *      a generic title, which is not a rankable product page.
 *
 * So the fix is not "unlock" — it is to put the catalogue somewhere that can
 * render it as HTML with real per-page metadata. That is here: this site has no
 * `output: 'export'`, so the product list is fetched on the SERVER and shipped
 * in the markup, with Product structured data attached.
 *
 * ─── AND WHY THERE IS NO CART HERE ───────────────────────────────────────────
 * Deliberate. A second cart on a second origin cannot share localStorage with
 * the app's, so a fan who added a hoodie here and then opened the app would find
 * an empty bag — a split-cart bug that is invisible in testing because you rarely
 * cross origins mid-purchase. Every buy button therefore hands off to the
 * canonical Shopify product page, which owns the cart and the checkout for both
 * surfaces. One cart, one checkout, two shop fronts.
 */

const TITLE = 'Scorebug Pro Shop · Official gear'
const DESCRIPTION =
  'Official Scorebug apparel and accessories, printed to order and shipped worldwide. Tees, hoodies and gear for the fan who logs every game.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/shop` },
  openGraph: {
    type: 'website',
    url: `${SITE}/shop`,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

/** Ten minutes, matching the Storefront fetch's own revalidate. */
export const revalidate = 600

function ProductCard({ p }: { p: ShopifyProduct }) {
  const img = p.featuredImage
  const soldOut = !p.availableForSale
  return (
    <a
      href={shopifyProductUrl(p.handle)}
      target="_blank"
      /**
       * `sponsored` is not needed — this is our own store, not an affiliate
       * destination — but `noopener noreferrer` still is, because the link
       * opens a new tab and an un-guarded `_blank` is a tabnabbing vector.
       */
      rel="noopener noreferrer"
      className="glass-card group flex flex-col overflow-hidden rounded-2xl transition active:scale-[0.99]"
    >
      <span
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}
      >
        {img?.url ? (
          <Image
            src={img.url}
            alt={img.altText || p.title}
            fill
            sizes="(max-width: 639px) 90vw, (max-width: 1023px) 44vw, 30vw"
            className="object-cover"
            style={soldOut ? { opacity: 0.45, filter: 'saturate(0.4)' } : undefined}
          />
        ) : null}
        <span className="glass-pill absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-ink-2">
          {categoryLabel(p)}
        </span>
        {soldOut && (
          <span className="glass-pill absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-ink-3">
            Sold out
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[15px] font-bold leading-snug text-ink">{p.title}</span>
        <span className="text-[15px] font-black tabular-nums text-ink">{formatPriceRange(p)}</span>
      </span>
    </a>
  )
}

export default async function ShopPage() {
  const { data: products, error } = await getProducts(48)
  const list = products ?? []

  /**
   * Product structured data, one node per item.
   *
   * This is the whole point of server-rendering the catalogue: `offers.price`
   * has to be a real number in the markup for a rich result, and a client-side
   * fetch cannot put it there. `availability` and `priceCurrency` come straight
   * from Shopify rather than being asserted, and `url` points at the canonical
   * Shopify product page so the structured data agrees with where the buy button
   * actually goes.
   */
  const jsonLd = list.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Scorebug Pro Shop',
        itemListElement: list.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.title,
            description: (p.description || '').slice(0, 300) || undefined,
            image: p.featuredImage?.url ? [p.featuredImage.url] : undefined,
            brand: { '@type': 'Brand', name: 'Scorebug' },
            url: shopifyProductUrl(p.handle),
            offers: {
              '@type': 'Offer',
              price: p.priceRange.minVariantPrice.amount,
              priceCurrency: p.priceRange.minVariantPrice.currencyCode,
              availability: p.availableForSale
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              url: shopifyProductUrl(p.handle),
            },
          },
        })),
      }
    : null

  const apparel = list.filter(isApparel)
  const accessories = list.filter(p => !isApparel(p))

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <main className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-14">
          <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase" style={{ color: '#F85149' }}>
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#F85149', boxShadow: '0 0 8px #F85149' }} />
            Official gear
          </p>

          <h1 className="headline headline-display mt-7 text-[3.2rem] text-white sm:text-[4rem]">
            The Pro Shop
          </h1>
          <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-2">
            Scorebug apparel and accessories, printed to order and shipped worldwide.
            Every order is made when you place it, so nothing sits in a warehouse.
          </p>

          {!isShopifyConfigured() || error ? (
            <div className="glass-card mt-12 rounded-2xl px-7 py-12 text-center">
              <h2 className="headline text-3xl text-white">The shop opens soon</h2>
              <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
                {error
                  ? 'We could not reach the store just now. Try again shortly.'
                  : 'Gear is on the way. Keep chronicling in the meantime.'}
              </p>
              <a href={WEB_APP} className="enamel-red mt-7 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white transition active:scale-[0.98]">
                Open the web app
              </a>
            </div>
          ) : (
            <>
              {[
                { heading: 'Apparel', items: apparel },
                { heading: 'Accessories', items: accessories },
              ]
                .filter(s => s.items.length > 0)
                .map(section => (
                  <section key={section.heading} className="mt-14">
                    {/* A real <h2> per group rather than a filter chip row: this
                        page is read by a crawler before it is read by a person,
                        and a heading is a ranking signal where a button is not. */}
                    <h2 className="headline text-3xl text-ink sm:text-4xl">{section.heading}</h2>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
                      {section.items.map(p => <ProductCard key={p.id} p={p} />)}
                    </div>
                  </section>
                ))}

              <p className="mt-14 text-center text-[13px] text-ink-3">
                Checkout is handled by Shopify. Shipping and tax are calculated there.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}
