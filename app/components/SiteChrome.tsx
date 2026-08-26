import Image from 'next/image'
import { androidCta, WEB_APP, APP_LINKS } from '../config'

/**
 * The in-feed conversion banner — "chronicle this on Scorebug", dropped inside
 * the /news stream and the /gear/[team] pages.
 *
 * ─── WHY IT TAKES A `line` ───────────────────────────────────────────────────
 * The banner is contextual: on a team page it says "log the Oilers games", on
 * the news feed it says "log the game you just read about". Generic app CTAs
 * are ignored; a line that names what the reader is already looking at converts.
 * Both actions are offered — the web app (one click, no install) as the primary
 * enamel button, and the Android test as the secondary — because the two
 * surfaces convert different visitors and neither should be buried.
 */
export function AppCta({ line, className = '' }: { line: string; className?: string }) {
  const android = androidCta()
  return (
    <aside
      className={`glass-card relative overflow-hidden rounded-2xl p-6 ${className}`}
      aria-label="Get Scorebug"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(80% 60% at 12% 0%, rgba(248,81,73,0.16) 0%, transparent 60%)' }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sb-red">On Scorebug</p>
          <p className="mt-1.5 text-[15.5px] font-bold leading-snug text-ink">{line}</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
          <a
            href={WEB_APP}
            className="enamel-red inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-[14px] font-black text-white transition active:scale-[0.98]"
          >
            Launch web app
            <span aria-hidden className="opacity-80">›</span>
          </a>
          <a
            href={android.href}
            className="glass-btn inline-flex items-center whitespace-nowrap rounded-xl px-4 py-3 text-[13px] font-bold text-ink-2 transition hover:text-ink"
          >
            {android.label}
          </a>
        </div>
      </div>
    </aside>
  )
}

/**
 * The site header and footer, shared.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * These lived inline in app/page.tsx, so the landing page was the only route
 * that had them. When /shop, /gear, /gear/[team] and /news shipped, they went
 * out with NO header, NO footer, NO logo and NO navigation — verified on the
 * live HTML, not assumed.
 *
 * That is worst exactly where it matters most: those pages exist to be entered
 * from a search result, so the visitor arriving on /gear/edmonton-oilers had no
 * branding, no way to reach the product, and no link to anything else on the
 * domain. It also starves the site of internal links, which is one of the
 * signals telling a crawler these pages belong to the same site as the root.
 *
 * ─── WHY NOT IN layout.tsx ───────────────────────────────────────────────────
 * The obvious move is to put chrome in the root layout, and it is wrong here:
 * the three legal pages carry their own deliberately minimal shell ("Back to
 * site", legal-only footer nav) with a documented reason — a store reviewer
 * reading a policy should not be handed a shop nav. Putting this in the layout
 * would double their headers. Composed per-route instead, so a page opts in.
 */

export function LaunchWebApp({ size = 'lg', className = '' }: { size?: 'lg' | 'md'; className?: string }) {
  const lg = size === 'lg'
  return (
    <a
      href={WEB_APP}
      className={`enamel-red inline-flex items-center gap-3 whitespace-nowrap rounded-2xl font-black text-white transition active:scale-[0.98] ${
        lg ? 'px-7 py-4 text-[17px]' : 'px-5 py-3 text-[14px]'
      } ${className}`}
    >
      <svg width={lg ? 20 : 17} height={lg ? 20 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18" />
      </svg>
      Launch Web App
      <span aria-hidden className="text-[1.1em] leading-none opacity-80">›</span>
    </a>
  )
}

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
      <a href="/" aria-label="Scorebug home" className="flex min-w-0 items-center gap-2.5">
        <Image src="/app-icon.png" alt="" width={36} height={36} className="rounded-[9px]" priority />
        {/* Icon only below sm. The wordmark and a full-width "Launch Web App"
            cannot both fit a 360px bar, and a truncated "SCORE…" is worse than
            no wordmark beside a logo that already says it. */}
        <span className="headline headline-sm hidden text-2xl text-ink sm:inline">Scorebug</span>
      </a>
      <nav aria-label="Primary" className="flex flex-shrink-0 items-center gap-2.5">
        {/* Pro Shop is `md:` while the test link is `sm:` — at 640px the bar
            already carries a wordmark, a CTA pill and the enamel button, and a
            third link there pushes "Launch Web App" off a 360px phone. */}
        <a href={APP_LINKS.proShop} className="glass-btn hidden rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 transition hover:text-ink md:inline-block">
          Pro Shop
        </a>
        <a href={androidCta().href} className="glass-btn hidden rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 transition hover:text-ink sm:inline-block">
          {androidCta().label}
        </a>
        <LaunchWebApp size="md" />
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Image src="/app-icon.png" alt="" width={26} height={26} className="rounded-[7px]" />
          <span className="text-[13px] font-bold text-ink-2">Scorebug</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-5 text-[13px] font-semibold text-ink-3">
          <a href={APP_LINKS.slate} className="py-2 -my-2 hover:text-ink-2">The Slate</a>
          <a href={APP_LINKS.proShop} className="py-2 -my-2 hover:text-ink-2">Pro Shop</a>
          <a href="/gear" className="py-2 -my-2 hover:text-ink-2">Gear</a>
          <a href="/news" className="py-2 -my-2 hover:text-ink-2">News</a>
          <a href={APP_LINKS.privacy} className="py-2 -my-2 hover:text-ink-2">Privacy</a>
          <a href={APP_LINKS.terms} className="py-2 -my-2 hover:text-ink-2">Terms</a>
          <a href={androidCta().href} className="py-2 -my-2 hover:text-ink-2">{androidCta().label}</a>
        </nav>
        <p className="text-[12px] text-ink-3">© {new Date().getFullYear()} Scorebug™ · Made in Canada</p>
      </div>
    </footer>
  )
}

/**
 * BreadcrumbList structured data.
 *
 * Google uses this to render the breadcrumb trail in place of the raw URL in a
 * result, which is worth real click-through on a deep page like
 * /gear/edmonton-oilers — "Scorebug › Gear › Edmonton Oilers" reads as a place
 * in a site, where the URL reads as a string. It also tells a crawler the
 * hierarchy, which a flat set of affiliate pages otherwise does not express.
 *
 * `item` is omitted on the LAST crumb on purpose: schema.org's guidance is that
 * the final element is the current page and should not link to itself.
 */
export function Breadcrumbs({ trail }: { trail: { name: string; url?: string }[] }) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  )
}

/** The visible trail. Paired with <Breadcrumbs> so the markup and the
 *  structured data always describe the same path. */
export function BreadcrumbNav({ trail }: { trail: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-[13px] font-semibold text-ink-3">
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((c, i) => (
          <li key={c.name} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-ink-3/60">›</span>}
            {c.href ? (
              <a href={c.href} className="transition hover:text-ink-2">{c.name}</a>
            ) : (
              <span aria-current="page" className="text-ink-2">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
