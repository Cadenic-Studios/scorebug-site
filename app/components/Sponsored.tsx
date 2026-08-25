/**
 * The FTC disclosure. One component, one word, no props.
 *
 * ─── WHY IT TAKES NO PROPS ───────────────────────────────────────────────────
 * The app's equivalent used to accept a `text` override, and four units had
 * quietly set it to "Partner". The FTC's endorsement guidance names "Sponsored"
 * and "Ad" as adequate and singles out vaguer words — "Partner", "Affiliate",
 * "Collab", "Spon" — as inadequate, because they do not tell a reader that money
 * changed hands. The override has been removed in both repos: a disclosure that
 * can be softened per-callsite eventually is.
 *
 * Uppercase is applied in CSS, so the rendered badge reads SPONSORED.
 *
 * `whitespace-nowrap` and `flex-shrink-0` are a PRIORITY CLAIM, not styling.
 * The app measured this exact label being pushed off the edge of a card at
 * 320px by the advertiser name beside it, inside an `overflow-hidden` shell —
 * so the one legally load-bearing element on the unit was the first thing to
 * disappear when space ran out. Here it refuses to shrink and the name beside it
 * truncates instead.
 */
export default function Sponsored({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded text-[10px] font-black uppercase tracking-[0.16em] text-ink-3 ${className}`}
    >
      Sponsored
    </span>
  )
}

/**
 * The one way an affiliate destination should be rendered on this site.
 *
 * `rel="sponsored"` is Google's documented annotation for a paid or affiliate
 * link and is a separate obligation from the visible badge above: the badge is
 * for the reader, the rel is for the crawler. Shipping monetised links without
 * it is a real, quiet policy gap — and on a page whose entire purpose is organic
 * search, an undeclared affiliate link is the one thing most likely to cost the
 * domain its ranking.
 *
 * `noopener noreferrer` is the standard tabnabbing guard for any _blank target.
 */
export function AffiliateLink({
  href, children, className = '', ariaLabel,
}: {
  href: string | null
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  )
}
