/**
 * Shopify Storefront API — the marketing site's copy.
 *
 * ─── WHY THIS IS SPLIT FROM THE APP'S VERSION ────────────────────────────────
 * The app (`scorebug-app`) has a near-identical file, and it is deliberately NOT
 * shared: the two deployments have no common package, and more importantly they
 * need different rendering models.
 *
 *   • The APP is `output: 'export'` — no server, so its storefront must fetch on
 *     the client. That is correct there and useless for search: a crawler sees
 *     an empty grid.
 *   • This SITE has no `output: 'export'`. It renders on the server, so the
 *     product list can be fetched at request time and shipped as HTML. That is
 *     the entire reason the shop is being ported here, so this module has NO
 *     'use client' directive and touches no browser API.
 *
 * Cart state (localStorage, checkout hand-off) lives in ./shopify-cart.ts, which
 * IS client-only. Keeping them apart is what lets the catalogue server-render.
 *
 * ─── THE TOKEN ───────────────────────────────────────────────────────────────
 * The Storefront token is public by design — scoped to unauthenticated
 * catalogue reads and cart mutations, it cannot read orders or customers. It is
 * the one Shopify credential that belongs in a client bundle. A `shpat_` Admin
 * token must never appear in either repo.
 */

export const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? ''
export const SHOPIFY_API_VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION || '2026-07'
const SHOPIFY_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? ''

/** False ⇒ /shop renders its "opening soon" state instead of an empty grid. */
export function isShopifyConfigured(): boolean {
  return Boolean(SHOPIFY_DOMAIN && SHOPIFY_TOKEN)
}

/** The storefront's own product page — used as the canonical URL in JSON-LD and
 *  as the buy-now destination, so we never duplicate Shopify's cart. */
export function shopifyProductUrl(handle: string): string {
  return `https://${SHOPIFY_DOMAIN}/products/${handle}`
}

export type Money = { amount: string; currencyCode: string }
export type ShopifyImage = { url: string; altText: string | null } | null

export type ShopifyVariant = {
  id: string
  title: string
  availableForSale: boolean
  price: Money
  compareAtPrice: Money | null
  selectedOptions: { name: string; value: string }[]
  image: ShopifyImage
}

export type ShopifyProduct = {
  id: string
  title: string
  handle: string
  description: string
  productType: string
  tags: string[]
  availableForSale: boolean
  featuredImage: ShopifyImage
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money }
  options: { name: string; values: string[] }[]
  variants: { nodes: ShopifyVariant[] }
}

export type GqlResult<T> = { data: T | null; error: string | null }

/**
 * GraphQL answers a FAILED query with HTTP 200 and an `errors` array. Checking
 * `res.ok` alone yields `undefined` data and renders an empty shop with no error
 * state — which looks exactly like "nothing in stock". Both layers checked here.
 */
async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { revalidate?: number } = {},
): Promise<GqlResult<T>> {
  if (!isShopifyConfigured()) return { data: null, error: 'not-configured' }
  try {
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
        /**
         * ISR rather than `no-store`. The catalogue is the page's SEO payload,
         * so it must be in the HTML — but re-querying Shopify on every crawl hit
         * would burn the Storefront API's cost budget and slow first paint.
         * Ten minutes is well inside how often a two-product shop changes, and
         * a deploy busts it anyway.
         */
        next: { revalidate: opts.revalidate ?? 600 },
      },
    )
    if (!res.ok) return { data: null, error: `http-${res.status}` }
    const json = (await res.json().catch(() => null)) as
      | { data?: T; errors?: { message: string }[] }
      | null
    if (!json) return { data: null, error: 'bad-json' }
    if (json.errors?.length) {
      return { data: null, error: json.errors.map(e => e.message).join('; ') || 'graphql-error' }
    }
    if (!json.data) return { data: null, error: 'empty-response' }
    return { data: json.data, error: null }
  } catch (e: any) {
    return { data: null, error: e?.name === 'AbortError' ? 'aborted' : 'network' }
  }
}

/**
 * `quantityAvailable` is deliberately absent — it needs the
 * `unauthenticated_read_product_inventory` scope, and requesting a field the
 * token cannot read fails the WHOLE query rather than nulling one field. That
 * is an empty shop caused by a scope checkbox. `availableForSale` needs no extra
 * scope and answers the only question the page asks.
 *
 * The image `transform` is not cosmetic: print-on-demand mockups are ~2000px
 * squares and the grid renders them at ~380px.
 */
const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  productType
  tags
  availableForSale
  featuredImage { url(transform: { maxWidth: 900, maxHeight: 900 }) altText }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  options { name values }
  variants(first: 100) {
    nodes {
      id
      title
      availableForSale
      price { amount currencyCode }
      compareAtPrice { amount currencyCode }
      selectedOptions { name value }
      image { url(transform: { maxWidth: 900, maxHeight: 900 }) altText }
    }
  }
`

export async function getProducts(first = 24): Promise<GqlResult<ShopifyProduct[]>> {
  const query = `
    query Products($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }
  `
  const r = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(query, {
    first: Math.min(Math.max(first, 1), 250),
  })
  if (r.error) return { data: null, error: r.error }
  return { data: r.data?.products?.nodes ?? [], error: null }
}

/**
 * Money arrives as a DECIMAL STRING ("24.00"), not a number and not minor units.
 * `amount.toFixed(2)` throws; `amount * 2` works by coercion luck.
 *
 * A locale is PINNED rather than left to the visitor, because this page renders
 * on the SERVER and is cached: `undefined` resolves to the build machine's
 * locale and bakes one arbitrary format into HTML served to everyone.
 *
 * And the pinned locale is `en-US`, NOT `en-CA`, which looks backwards until you
 * see the output. The store's primary market is Canada, so Shopify returns CAD.
 * `en-CA` formats CAD as a bare "$65.33" — correct for a Canadian, and read as
 * US dollars by everyone else, on a page that is byte-identical for every
 * visitor. `en-US` formats the same value as "CA$65.33", which is unambiguous to
 * both. When the price is in one currency and the audience is not, the label has
 * to carry the currency.
 */
export function formatMoney(money?: Money | null): string {
  if (!money) return ''
  const n = Number(money.amount)
  if (!Number.isFinite(n)) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (money.currencyCode || 'CAD').toUpperCase(),
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

export function formatPriceRange(p: ShopifyProduct): string {
  const min = p.priceRange?.minVariantPrice
  const max = p.priceRange?.maxVariantPrice
  if (!min) return ''
  if (max && Number(max.amount) > Number(min.amount)) return `From ${formatMoney(min)}`
  return formatMoney(min)
}

/** Apparel vs accessories, from Shopify's own productType/tags plus the TITLE.
 *  Word-bounded: plain substring matching files "canteen" under apparel. */
const APPAREL_RE = new RegExp(
  '\\b(' + [
    'apparel', 'shirt', 'shirts', 't-shirt', 'tee', 'tees', 'hoodie', 'hoodies',
    'sweatshirt', 'crewneck', 'jacket', 'hat', 'hats', 'cap', 'caps', 'beanie',
    'jersey', 'shorts', 'joggers', 'sweatpants', 'socks', 'tank', 'polo',
    'pullover', 'windbreaker', 'leggings', 'long sleeve', 'zip',
  ].join('|') + ')\\b',
  'i',
)

export function isApparel(p: ShopifyProduct): boolean {
  const hay = [p.productType ?? '', p.title ?? '', ...(p.tags ?? [])].join(' ').toLowerCase()
  if (/\baccessor(y|ies)\b/.test(hay)) return false
  return APPAREL_RE.test(hay)
}

/** Shopify does not validate productType — it is free text, and a bad sync can
 *  put a metafield key or a sentence in it. Anything long or machine-looking
 *  falls back to the derived category. */
export function categoryLabel(p: ShopifyProduct): string {
  const t = (p.productType ?? '').trim()
  if (t && t.length <= 22 && !t.includes('=')) return t
  return isApparel(p) ? 'Apparel' : 'Accessories'
}
