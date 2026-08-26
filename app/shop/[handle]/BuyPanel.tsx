'use client'

import { useMemo, useState } from 'react'
import {
  createCartCheckout, formatMoney,
  type ShopifyProductDetail, type ShopifyVariant,
} from '../../lib/shopify'

/**
 * Variant selection + direct-to-checkout.
 *
 * ─── THE FLOW ────────────────────────────────────────────────────────────────
 * Pick options -> resolve the matching variant -> `cartCreate` in the
 * background -> navigate straight to Shopify's hosted payment screen. There is
 * no interstitial cart page, and this site never renders one: a second cart on
 * a second origin cannot share state with Shopify's, so the two would drift.
 *
 * We stop at the payment screen deliberately. Owning the browsing and the
 * product page is what "headless" means; taking card details ourselves would
 * put this site in PCI scope and throw away Shop Pay, wallets, tax and shipping
 * calculation, and Shopify's fraud screening.
 *
 * ─── VARIANT MATCHING IS EXACT, NOT POSITIONAL ───────────────────────────────
 * A variant is found by comparing every one of its `selectedOptions` against the
 * chosen values. Shopify does not guarantee option order between `product.options`
 * and `variant.selectedOptions`, so index-based matching silently pairs "Size:
 * Large" with a colour on any product where the orders differ.
 */
export default function BuyPanel({ product }: { product: ShopifyProductDetail }) {
  const variants = product.variants.nodes

  /* Default to the first PURCHASABLE variant, not simply the first. Landing on a
     sold-out selection greets the fan with a dead button on a product that is
     actually available in another size. */
  const initial = useMemo(() => {
    const v = variants.find(x => x.availableForSale) ?? variants[0]
    const sel: Record<string, string> = {}
    for (const o of v?.selectedOptions ?? []) sel[o.name] = o.value
    return sel
  }, [variants])

  const [selected, setSelected] = useState<Record<string, string>>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const variant: ShopifyVariant | undefined = useMemo(
    () => variants.find(v =>
      v.selectedOptions.every(o => selected[o.name] === o.value)
      && v.selectedOptions.length === Object.keys(selected).length),
    [variants, selected],
  )

  /* Which option values can actually be bought given the rest of the current
     selection. A value with no purchasable variant is shown struck through
     rather than hidden — a size that vanishes reads as a rendering bug, a size
     visibly marked sold out reads as information. */
  const soldOut = useMemo(() => {
    const out = new Set<string>()
    for (const opt of product.options) {
      for (const value of opt.values) {
        const probe = { ...selected, [opt.name]: value }
        const match = variants.find(v =>
          v.selectedOptions.every(o => probe[o.name] === o.value))
        if (!match?.availableForSale) out.add(`${opt.name}::${value}`)
      }
    }
    return out
  }, [product.options, variants, selected])

  async function buy() {
    if (!variant || busy) return
    setBusy(true)
    setError(null)
    const { data: checkoutUrl, error } = await createCartCheckout(variant.id, 1)
    if (checkoutUrl) {
      // `assign`, not `replace`: Back should return to the product page.
      window.location.assign(checkoutUrl)
      return // stay busy — the navigation is in flight
    }
    setBusy(false)
    setError(
      error === 'network'
        ? 'We could not reach the store. Check your connection and try again.'
        : 'We could not start checkout just now. Try again in a moment.',
    )
  }

  const price = variant?.price ?? product.priceRange.minVariantPrice
  const compareAt = variant?.compareAtPrice
  const onSale = compareAt && Number(compareAt.amount) > Number(price.amount)
  const purchasable = !!variant?.availableForSale

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-[28px] font-black tabular-nums text-ink">{formatMoney(price)}</span>
        {onSale && (
          <span className="text-[16px] font-bold text-ink-3 line-through tabular-nums">
            {formatMoney(compareAt)}
          </span>
        )}
      </div>

      {/* Option selectors. Skipped entirely when Shopify reports the single
          synthetic "Title / Default Title" option a one-variant product carries —
          rendering a control with one choice is noise. */}
      {product.options
        .filter(o => !(o.values.length === 1 && /^default title$/i.test(o.values[0])))
        .map(opt => (
          <fieldset key={opt.name} className="mt-7">
            <legend className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
              {opt.name}
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
                    onClick={() => setSelected(s => ({ ...s, [opt.name]: value }))}
                    className={`sb-cta min-h-[44px] rounded-xl px-4 text-[13.5px] font-bold ${
                      active
                        ? 'bg-white text-[#0a0b0e]'
                        : 'glass-btn text-ink-2 hover:text-ink'
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

      {/* role=alert so a failure is announced, not just coloured. */}
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] font-semibold" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}

      <p className="mt-3 text-center text-[12.5px] text-ink-3">
        Secure checkout by Shopify. Shipping and tax calculated there.
      </p>
    </div>
  )
}
