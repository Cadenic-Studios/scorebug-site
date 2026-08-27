'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  createCartCheckout, formatMoney, categoryLabel,
  type ShopifyProductDetail, type ShopifyVariant,
} from '../../lib/shopify'

/**
 * The product page's interactive half: gallery + options + checkout.
 *
 * ─── WHY THE GALLERY MOVED IN HERE ───────────────────────────────────────────
 * It used to live in the server page, beside a separate BuyPanel. That made the
 * two mute to each other, which is exactly what was broken:
 *   • clicking a thumbnail did nothing (the hero was a fixed `gallery[0]`);
 *   • changing the colour did nothing to the picture, so a fan picking
 *     "Asphalt" was still looking at "Deep Heather".
 * Both are one piece of state — "which image is showing" — so the gallery and
 * the selector have to be the same component.
 *
 * ─── HOW COLOUR DRIVES THE IMAGE ─────────────────────────────────────────────
 * Every variant on this store carries its own `image` (verified against the
 * live catalogue: 7/7, 15/15 and 10/10 variants across the three products). So
 * selecting a colour resolves a variant, and that variant names its own shot.
 *
 * What we deliberately do NOT do is guess which of the OTHER product images
 * belong to that colour. The V-Neck has 12 images and 3 colours, so four
 * apiece, but nothing in the API says which four: `altText` is null on every
 * image and no metafield maps them. Slicing the array by position would be a
 * guess that silently shows the wrong garment the day the vendor reorders
 * uploads. Instead the full gallery stays browsable and the colour choice jumps
 * the hero to the shot Shopify actually attached to that variant — which is
 * true at every moment, without inventing a mapping.
 */
export default function ProductView({ product }: { product: ShopifyProductDetail }) {
  const variants = product.variants.nodes
  const gallery = useMemo(() => {
    const seen = new Set<string>()
    const out: { url: string; altText: string | null }[] = []
    // Product images first (vendor's own order), then any variant shot the
    // gallery is missing, so selecting a colour can always land somewhere real.
    for (const g of product.images?.nodes ?? []) {
      if (g && !seen.has(g.url)) { seen.add(g.url); out.push(g) }
    }
    for (const v of variants) {
      if (v.image && !seen.has(v.image.url)) { seen.add(v.image.url); out.push(v.image) }
    }
    if (!out.length && product.featuredImage) out.push(product.featuredImage)
    return out
  }, [product, variants])

  const initial = useMemo(() => {
    const v = variants.find(x => x.availableForSale) ?? variants[0]
    const sel: Record<string, string> = {}
    for (const o of v?.selectedOptions ?? []) sel[o.name] = o.value
    return sel
  }, [variants])

  const [selected, setSelected] = useState<Record<string, string>>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** null = follow the selected variant; a number = the fan clicked a thumb. */
  const [pinned, setPinned] = useState<number | null>(null)

  /* Matched by NAME on every option, never by index: Shopify does not guarantee
     that product.options and variant.selectedOptions share an order, and these
     products prove it — the hoodie is [Color, Size] while the long-sleeve is
     [Size, Color]. Positional matching would pair a size with a colour. */
  const variant: ShopifyVariant | undefined = useMemo(
    () => variants.find(v =>
      v.selectedOptions.length === Object.keys(selected).length
      && v.selectedOptions.every(o => selected[o.name] === o.value)),
    [variants, selected],
  )

  const variantIdx = useMemo(() => {
    if (!variant?.image) return -1
    return gallery.findIndex(g => g.url === variant.image!.url)
  }, [gallery, variant])

  // The fan's explicit thumbnail click wins until they change a option again.
  const activeIdx = pinned ?? (variantIdx >= 0 ? variantIdx : 0)
  const hero = gallery[activeIdx] ?? gallery[0]

  const soldOut = useMemo(() => {
    const out = new Set<string>()
    for (const opt of product.options) {
      for (const value of opt.values) {
        const probe = { ...selected, [opt.name]: value }
        const match = variants.find(v => v.selectedOptions.every(o => probe[o.name] === o.value))
        if (!match?.availableForSale) out.add(`${opt.name}::${value}`)
      }
    }
    return out
  }, [product.options, variants, selected])

  function choose(name: string, value: string) {
    setSelected(s => ({ ...s, [name]: value }))
    // Release the pin so the picture follows the new choice. Without this, a
    // fan who clicked a thumbnail and then changed colour would keep staring at
    // the old colour's photo — the exact bug this component exists to fix.
    setPinned(null)
  }

  async function buy() {
    if (!variant || busy) return
    setBusy(true); setError(null)
    const { data: checkoutUrl, error } = await createCartCheckout(variant.id, 1)
    if (checkoutUrl) { window.location.assign(checkoutUrl); return }
    setBusy(false)
    setError(error === 'network'
      ? 'We could not reach the store. Check your connection and try again.'
      : 'We could not start checkout just now. Try again in a moment.')
  }

  const price = variant?.price ?? product.priceRange.minVariantPrice
  const compareAt = variant?.compareAtPrice
  const onSale = compareAt && Number(compareAt.amount) > Number(price.amount)
  const purchasable = !!variant?.availableForSale

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
      {/* ── Gallery ── */}
      <div>
        <div
          className="glass-card relative w-full overflow-hidden rounded-2xl"
          style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}
        >
          {hero && (
            <Image
              // Keyed on the url so React swaps the element rather than mutating
              // src on one <img>, which otherwise shows the OLD photo until the
              // new one decodes.
              key={hero.url}
              src={hero.url}
              alt={hero.altText || product.title}
              fill
              priority
              sizes="(max-width: 1023px) 92vw, 44vw"
              className="object-cover"
            />
          )}
          <span className="glass-pill absolute left-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-ink-2">
            {categoryLabel(product)}
          </span>
        </div>

        {gallery.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-2.5">
            {gallery.slice(0, 10).map((g, i) => {
              const active = i === activeIdx
              return (
                <button
                  key={g.url}
                  type="button"
                  onClick={() => setPinned(i)}
                  aria-label={`View image ${i + 1} of ${Math.min(gallery.length, 10)}`}
                  aria-pressed={active}
                  className="sb-cta relative overflow-hidden rounded-xl"
                  style={{
                    aspectRatio: '1 / 1',
                    background: 'rgba(255,255,255,0.04)',
                    outline: active ? '2px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.12)',
                    outlineOffset: active ? '-2px' : '-1px',
                    opacity: active ? 1 : 0.62,
                  }}
                >
                  <Image
                    src={g.url}
                    alt=""
                    fill
                    sizes="(max-width: 1023px) 18vw, 9vw"
                    className="object-cover"
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Detail + buy ── */}
      <div className="lg:pt-2">
        <h1 className="headline headline-sm text-[2.1rem] leading-tight text-white sm:text-[2.6rem]">
          {product.title}
        </h1>

        <div className="mt-7 flex items-baseline gap-3">
          <span className="text-[28px] font-black tabular-nums text-ink">{formatMoney(price)}</span>
          {onSale && (
            <span className="text-[16px] font-bold text-ink-3 line-through tabular-nums">
              {formatMoney(compareAt)}
            </span>
          )}
        </div>

        {product.options
          .filter(o => !(o.values.length === 1 && /^default title$/i.test(o.values[0])))
          .map(opt => (
            <fieldset key={opt.name} className="mt-7">
              <legend className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
                {opt.name}
                {selected[opt.name] && (
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-2">
                    {selected[opt.name]}
                  </span>
                )}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {opt.values.map(value => {
                  const active = selected[opt.name] === value
                  const gone = soldOut.has(`${opt.name}::${value}`)
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose(opt.name, value)}
                      className={`sb-cta min-h-[44px] rounded-xl px-4 text-[13.5px] font-bold ${
                        active ? 'bg-white text-[#0a0b0e]' : 'glass-btn text-ink-2 hover:text-ink'
                      } ${gone ? 'opacity-45 line-through' : ''}`}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}

        <button
          type="button"
          onClick={buy}
          disabled={!purchasable || busy}
          className="sb-cta enamel-red mt-8 flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Taking you to checkout…' : purchasable ? 'Buy now' : 'Sold out'}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-center text-[13px] font-semibold" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}

        <p className="mt-3 text-center text-[12.5px] text-ink-3">
          Secure checkout by Shopify. Shipping and tax calculated there.
        </p>
      </div>
    </div>
  )
}
