import type { Metadata } from 'next'
import Link from 'next/link'
import { WEB_APP } from './config'
import { SiteHeader, SiteFooter } from './components/SiteChrome'

/**
 * The 404. Until this file existed the site served Next's unstyled default —
 * white page, system font, "This page could not be found." — which is the one
 * page on the domain that looked like an outage rather than a product.
 *
 * A marketing site's 404 is a recovery surface: the visitor arrived from a
 * stale link, a typo, or a moved page, and every one of them was interested
 * enough to click something. The page's job is to keep them, so it offers the
 * four destinations the site actually monetises or converts on, styled like
 * everything else.
 *
 * Next serves this with a real 404 status, so crawlers still drop the URL —
 * this changes what a person sees, not what a robot records.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  // Belt and braces: the status code already says it, but a 404 that somehow
  // got linked should never accrue index entries.
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-3xl px-5 pb-28 pt-24 text-center">
          <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase" style={{ color: '#F85149' }}>
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#F85149', boxShadow: '0 0 8px #F85149' }} />
            Out of bounds
          </p>

          <h1 className="headline headline-display mt-7 text-[3.4rem] text-white sm:text-[4.4rem]">
            No game here.
          </h1>
          <p className="mx-auto mt-6 max-w-[30rem] text-[16.5px] leading-relaxed text-ink-2">
            This page moved, retired, or never made the roster. Everything worth
            watching is one click back.
          </p>

          <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
            {[
              { href: '/', title: 'Home', blurb: 'What Scorebug is, in one page.' },
              { href: WEB_APP, title: 'Launch the web app', blurb: 'Straight into the product.' },
              { href: '/shop', title: 'Pro Shop', blurb: 'Scorebug tees, hoodies and gear.' },
              { href: '/gear', title: 'Team gear', blurb: 'Jerseys, cards and collectibles.' },
            ].map(c => (
              <Link
                key={c.href}
                href={c.href}
                className="glass-card group rounded-2xl p-5 text-left transition hover:border-white/20"
              >
                <span className="block text-[15px] font-bold text-ink">{c.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{c.blurb}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
