import Sponsored from './Sponsored'

/**
 * The NordVPN unit for The Wire.
 *
 * ─── THE COPY IS THE COMPLIANCE CONTROL ─────────────────────────────────────
 * Every claim here is one the advertiser's own published spec substantiates,
 * framed around privacy and travel. Nothing on this card promises access to a
 * broadcast, and that constraint is deliberate rather than cautious:
 *
 *   • "Blackout bypass" style copy is an unsubstantiable performance claim.
 *     Sports blackouts are enforced on billing address, payment geo and device
 *     GPS — not on IP alone — so promising the fan will get the game is
 *     promising an outcome the product cannot reliably deliver. That is a
 *     deceptive claim under the FTC endorsement guides, and it would sit on the
 *     same page as our own disclosure badges.
 *   • CJ advertiser agreements (NordVPN's included) prohibit marketing the
 *     product as a tool for circumventing geographic content restrictions.
 *     Publishing that copy risks reversed commissions and removal from the
 *     programme — the exact revenue this unit exists to earn.
 *
 * The test for any future edit: could this sentence be substantiated in front
 * of the FTC using only the advertiser's published spec? If not, it does not
 * ship. The app-side twin (StreamSecurityCard) carries the same rule.
 *
 * ─── DISCLOSURE ─────────────────────────────────────────────────────────────
 * A visible SPONSORED badge (the shared <Sponsored/>, which takes no props so
 * it cannot be softened per-callsite) plus rel="sponsored noopener noreferrer".
 * The badge is for the reader, the rel is for the crawler; both are required
 * and neither substitutes for the other.
 *
 * ─── THE PIXEL ──────────────────────────────────────────────────────────────
 * CJ's impression pixel, rendered verbatim as a real 1x1 <img>. It must be an
 * actual element — CJ counts the request, and a CSS background or a
 * `new Image()` is easier for a browser to defer or drop. It is decorative and
 * kept out of the accessibility tree. Ad blockers will eat some; that costs an
 * impression count and nothing else, because the card and its click are
 * independent of it.
 *
 * Note the pixel host (tqlkg.com) differs from the click host (tkqlhce.com) —
 * that is how CJ issues this creative, and both carry the same publisher
 * (101840629) and link (12814518) ids, which is what actually pairs them.
 */

/** Exactly as issued by CJ. Publisher 101840629, link 12814518. */
const NORDVPN_CLICK = 'https://www.tkqlhce.com/click-101840629-12814518'
const NORDVPN_PIXEL = 'https://www.tqlkg.com/image-101840629-12814518'
const ACCENT = '#4687FF'

export default function VpnBanner({ className = '' }: { className?: string }) {
  return (
    <aside
      className={`glass-card relative overflow-hidden rounded-2xl p-6 ${className}`}
      aria-label="Sponsored: NordVPN"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(80% 60% at 10% 0%, ${ACCENT}1F 0%, transparent 62%)` }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {/* Shield + padlock: reads as "connection security" before a word of
              it is read. Inline SVG so it costs no request and inherits colour. */}
          <span
            aria-hidden
            className="flex flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 42, height: 42,
              background: `linear-gradient(180deg, ${ACCENT}30 0%, rgba(6,10,17,0.72) 100%)`,
              border: `1px solid ${ACCENT}66`,
              color: ACCENT,
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5 4.5 5.6v5.9c0 4.6 3.1 8.2 7.5 9.9 4.4-1.7 7.5-5.3 7.5-9.9V5.6L12 2.5Z" />
              <rect x="9" y="11" width="6" height="5" rx="1.2" />
              <path d="M10.4 11V9.7a1.6 1.6 0 0 1 3.2 0V11" />
            </svg>
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                NordVPN
              </p>
              <Sponsored />
            </div>
            <p className="mt-1.5 text-[15.5px] font-bold leading-snug text-ink">
              Watching on public Wi-Fi? Encrypt it.
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
              Secure your connection on hotel, airport and arena networks while you
              follow the team on the road. Servers in 110+ countries, no activity logs.
            </p>
          </div>
        </div>

        <a
          href={NORDVPN_CLICK}
          target="_blank"
          rel="sponsored noopener noreferrer"
          aria-label="Get NordVPN (sponsored, opens in a new tab)"
          className="sb-cta inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-5 py-3 text-[14px] font-black"
          style={{
            background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT}C4 100%)`,
            color: '#FFFFFF',
            border: `1px solid ${ACCENT}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.34), 0 6px 16px -7px ${ACCENT}`,
          }}
        >
          Get NordVPN
        </a>
      </div>

      {/* CJ impression pixel — verbatim, invisible, out of the a11y tree. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={NORDVPN_PIXEL}
        width={1}
        height={1}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </aside>
  )
}
