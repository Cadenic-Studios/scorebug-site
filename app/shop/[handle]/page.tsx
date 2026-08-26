import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { SITE } from '../../config'
import { getProduct, getProductHandles, formatMoney, categoryLabel } from '../../lib/shopify'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav } from '../../components/SiteChrome'
import BuyPanel from './BuyPanel'

/**
 * /shop/[handle] — the native product page.
 *
 * ─── WHAT THIS REPLACED ──────────────────────────────────────────────────────
 * Every product link on this site used to point at
 * `<store>.myshopify.com/products/<handle>`. A visitor browsing a dark,
 * typeset Scorebug page tapped a product and landed on Shopify's default
 * theme — different type, different colours, different header, a domain they
 * had never seen. That is the end of the brand experience, and it happens at
 * the exact moment intent is highest.
 *
 * It also leaked SEO: the canonical product URL for our own merchandise was on
 * a Shopify subdomain we do not control and cannot rank.
 *
 * ─── ISR + dynamicParams ─────────────────────────────────────────────────────
 * Handles are pre-rendered at build. `dynamicParams` stays at its default
 * (true) so a product published AFTER the last deploy still renders — on first
 * request rather than 404ing until someone redeploys. Paired with revalidate,
 * that is the whole publish-to-live path.
 */

export const revalidate = 60

/**
 * Turn a print-on-demand description into prose + a bullet list.
 *
 * These arrive as ONE unbroken blob — the hoodie's is 1,125 characters with
 * ZERO newlines — because the vendor authored bullets as inline "- " runs:
 *
 *   "...looks deliberate.Product features- Plush 80/20 cotton- Roomy pocket-..."
 *
 * Rendered verbatim that is a wall of text with no space after the full stop,
 * which is what the page did on first build. Splitting on newlines cannot help
 * when there are none, so the delimiters are recovered instead:
 *
 *   • a "- " that FOLLOWS a non-space character is an inline bullet marker
 *     (a real hyphenated word like "medium-heavy" has no space after the dash,
 *     so it is not matched and stays intact);
 *   • a capital letter jammed straight onto a full stop is a missing sentence
 *     break, and gets one.
 *
 * Everything is defensive: if neither pattern is present the whole string comes
 * back as a single paragraph, which is exactly the old behaviour. Vendor copy
 * varies per product and this must never throw or drop text.
 */
function formatDescription(raw: string): { lead: string[]; bullets: string[] } {
  const text = raw.trim()
  if (!text) return { lead: [], bullets: [] }

  const firstBullet = text.search(/\S-\s+\S/)
  const head = firstBullet === -1 ? text : text.slice(0, firstBullet + 1)
  const tail = firstBullet === -1 ? '' : text.slice(firstBullet + 1)

  const lead = head
    // "deliberate.Product" -> "deliberate. Product"
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)

  const bullets = tail
    .split(/-\s+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => s.length > 1)

  return { lead, bullets }
}

export async function generateStaticParams() {
  return (await getProductHandles()).map(handle => ({ handle }))
}

export async function generateMetadata(
  { params }: { params: { handle: string } },
): Promise<Metadata> {
  const { data: p } = await getProduct(params.handle)
  if (!p) return {}
  const title = p.title
  const description = (p.description || '').slice(0, 155) || `${p.title} from the Scorebug Pro Shop.`
  const img = p.featuredImage?.url
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/shop/${p.handle}` },
    openGraph: {
      type: 'website',
      url: `${SITE}/shop/${p.handle}`,
      title,
      description,
      images: img ? [{ url: img, alt: p.featuredImage?.altText || p.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const { data: p, error } = await getProduct(params.handle)

  /**
   * A missing product and an unreachable Shopify are NOT the same thing, and
   * `getProduct` keeps them apart: `{data: null, error: null}` is "no such
   * handle" (a real 404), `{data: null, error: '...'}` is the store being down.
   * Rendering "this product does not exist" during an outage would tell a fan
   * their bookmark is dead when the item is fine — and hand a crawler a 404 for
   * a page that should still be indexed.
   */
  if (!p) {
    if (error) {
      return (
        <>
          <SiteHeader />
          <main className="lit-red floodlights relative overflow-hidden">
            <div className="relative z-10 mx-auto max-w-3xl px-5 pb-28 pt-24 text-center">
              <h1 className="headline headline-display text-[2.8rem] text-white sm:text-[3.4rem]">
                The shop is offline
              </h1>
              <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-ink-2">
                We could not reach the store just now. Your order history is unaffected —
                this is only the catalogue. Try again shortly.
              </p>
              <a href="/shop" className="sb-cta enamel-red mt-9 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white">
                Back to the Pro Shop
              </a>
            </div>
          </main>
          <SiteFooter />
        </>
      )
    }
    notFound()
  }

  const gallery = p.images?.nodes?.length ? p.images.nodes : (p.featuredImage ? [p.featuredImage] : [])
  const hero = gallery[0]

  /**
   * Product structured data, on OUR domain at last.
   *
   * This is the payoff of owning the route: `offers.url` now points at a page we
   * control and can rank, with a real server-rendered price. It used to point at
   * the Shopify subdomain, so any rich result we earned sent the click somewhere
   * else. Availability and currency come straight from Shopify rather than being
   * asserted.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: (p.description || '').slice(0, 500) || undefined,
    image: gallery.map(g => g.url),
    sku: p.handle,
    brand: { '@type': 'Brand', name: 'Scorebug' },
    offers: {
      '@type': 'Offer',
      price: p.priceRange.minVariantPrice.amount,
      priceCurrency: p.priceRange.minVariantPrice.currencyCode,
      availability: p.availableForSale
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE}/shop/${p.handle}`,
    },
  }

  return (
    <>
      <Breadcrumbs trail={[
        { name: 'Scorebug', url: SITE },
        { name: 'Pro Shop', url: `${SITE}/shop` },
        { name: p.title },
      ]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />
      <main className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-10">
          <BreadcrumbNav trail={[
            { name: 'Scorebug', href: '/' },
            { name: 'Pro Shop', href: '/shop' },
            { name: p.title },
          ]} />

          <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
            {/* ── Gallery ──────────────────────────────────────────────────
                Every frame is a fixed 1/1 box with `fill`, so the grid's height
                is known before a single byte of image arrives. That is what
                keeps this page at CLS 0 — a product page that reflows when the
                hero decodes is the classic cause. */}
            <div>
              <div
                className="glass-card relative w-full overflow-hidden rounded-2xl"
                style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}
              >
                {hero && (
                  <Image
                    src={hero.url}
                    alt={hero.altText || p.title}
                    fill
                    priority
                    sizes="(max-width: 1023px) 92vw, 44vw"
                    className="object-cover"
                  />
                )}
                <span className="glass-pill absolute left-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-ink-2">
                  {categoryLabel(p)}
                </span>
              </div>

              {gallery.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {gallery.slice(1, 5).map((g, i) => (
                    <div
                      key={g.url}
                      className="glass-card relative overflow-hidden rounded-xl"
                      style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}
                    >
                      <Image
                        src={g.url}
                        alt={g.altText || `${p.title} — view ${i + 2}`}
                        fill
                        sizes="(max-width: 1023px) 22vw, 11vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Detail + buy ─────────────────────────────────────────────── */}
            <div className="lg:pt-2">
              <h1 className="headline headline-sm text-[2.1rem] leading-tight text-white sm:text-[2.6rem]">
                {p.title}
              </h1>

              <div className="mt-7">
                <BuyPanel product={p} />
              </div>

              {p.description && (
                <div className="mt-10 border-t border-white/10 pt-7">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
                    Details
                  </h2>
                  {/* The PLAIN-TEXT description, deliberately, not descriptionHtml.
                      Print-on-demand descriptions arrive as vendor HTML full of
                      inline styles and stray tables that fight this page's type
                      and can inject arbitrary markup into our origin. Plain text
                      renders in our own voice and cannot carry markup at all. */}
                  {(() => {
                    const { lead, bullets } = formatDescription(p.description)
                    return (
                      <div className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
                        <div className="space-y-3">
                          {lead.map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                        {bullets.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {bullets.map((bItem, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span
                                  aria-hidden
                                  className="mt-[8px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                  style={{ background: '#F85149', boxShadow: '0 0 7px #F85149' }}
                                />
                                {bItem}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              <p className="mt-8 text-[12.5px] leading-relaxed text-ink-3">
                Printed to order and shipped worldwide. Every item is made when you
                place the order, so nothing sits in a warehouse.
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
