import type { Metadata } from 'next'
import { SITE } from '../config'
import { GEAR_TEAMS, GEAR_TEAM_COUNT } from '../lib/teams'
import Sponsored from '../components/Sponsored'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav } from '../components/SiteChrome'
import GearBrowser from './GearBrowser'

const TITLE = 'Team gear and memorabilia'
// Derived. `GEAR_TEAM_COUNT` is imported two lines above and used in the page
// body already — this string was the one place the number was typed by hand,
// which is how it drifts out of step with the page it describes.
const DESCRIPTION =
  `Jerseys, hats and memorabilia for ${GEAR_TEAM_COUNT} clubs across the NHL, NFL, NBA, MLB and MLS. Search your team, then shop apparel or hunt cards and collectibles.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/gear` },
  openGraph: { type: 'website', url: `${SITE}/gear`, title: TITLE, description: DESCRIPTION, images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }], },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

/**
 * /gear — the public affiliate hub index.
 *
 * ─── THE DISCLOSURE SITS ABOVE THE FOLD, NOT IN THE FOOTER ───────────────────
 * FTC guidance is that a disclosure must be where a reader will actually see it
 * before acting, not buried at the end. Every card below leads to a paid link,
 * so the notice is in the header of the page rather than attached to each tile —
 * and each per-team page repeats it beside its own links.
 */
export default function GearIndex() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Scorebug', url: SITE }, { name: 'Gear' }]} />
      <SiteHeader />
      <main className="lit-blue floodlights relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-14">
        <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Gear' }]} />
        <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase" style={{ color: '#58A6FF' }}>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#58A6FF', boxShadow: '0 0 8px #58A6FF' }} />
          Fan gear
        </p>

        <h1 className="headline headline-display mt-7 text-[3.2rem] text-white sm:text-[4rem]">
          Gear and
          <br />
          memorabilia.
        </h1>
        <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-2">
          Jerseys and hats from Fanatics, cards and collectibles from eBay, and tickets
          when your club is on the road — for {GEAR_TEAM_COUNT} clubs across five leagues.
          Search your team.
        </p>

        <p className="mt-5 flex items-center gap-2.5 text-[13px] text-ink-3">
          <Sponsored />
          Scorebug earns a commission on purchases made through these links. It costs you nothing extra.
        </p>

        {/* The interactive index (search + league chips). The full club list is
            passed in from this server component, so all 154 team URLs are in the
            initial HTML for crawlers and no-JS visitors; GearBrowser only
            filters what is already there. */}
        <GearBrowser teams={GEAR_TEAMS} />
      </div>
      </main>
      <SiteFooter />
    </>
  )
}
