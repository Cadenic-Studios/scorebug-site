import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '../config'
import { GEAR_TEAMS, GEAR_LEAGUES } from '../lib/teams'
import Sponsored from '../components/Sponsored'

const TITLE = 'Team gear and memorabilia'
const DESCRIPTION =
  'Jerseys, hats and memorabilia for 32 clubs across the NHL, NFL, NBA and MLB. Pick your team, then shop apparel or hunt cards and collectibles.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/gear` },
  openGraph: { type: 'website', url: `${SITE}/gear`, title: TITLE, description: DESCRIPTION },
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
    <main className="lit-blue floodlights relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-14">
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
          when your club is on the road. Pick a team.
        </p>

        <p className="mt-5 flex items-center gap-2.5 text-[13px] text-ink-3">
          <Sponsored />
          Scorebug earns a commission on purchases made through these links. It costs you nothing extra.
        </p>

        {GEAR_LEAGUES.map(lg => {
          const teams = GEAR_TEAMS.filter(t => t.league === lg)
          if (!teams.length) return null
          return (
            <section key={lg} className="mt-14">
              <h2 className="headline text-3xl text-ink sm:text-4xl">{lg}</h2>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {teams.map(t => (
                  <Link
                    key={t.slug}
                    href={`/gear/${t.slug}`}
                    className="glass-card group flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/20"
                  >
                    <span
                      aria-hidden
                      className="h-8 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: t.color, boxShadow: `0 0 10px ${t.color}66` }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-ink">{t.short}</span>
                      <span className="block truncate text-[11px] text-ink-3">{t.name}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
