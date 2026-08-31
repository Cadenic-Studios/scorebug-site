import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '../config'
import { MATCHUPS, MATCHUP_COUNT } from '../matchups'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'

/**
 * /matchups — the hub for the rivalry pages.
 *
 * Same reason /leagues exists: without a page linking into them, the rivalry
 * pages are orphans that get crawled late and rank poorly. Grouped by league so
 * the list is scannable rather than 47 undifferentiated links.
 */
export const metadata: Metadata = {
  title: 'Track the biggest rivalries in sport, without gambling ads',
  description:
    `${MATCHUP_COUNT} of the most-watched rivalries across the NHL, NFL, NBA, MLB and MLS. `
    + `Live scores with no odds or sportsbook sponsorships, and a logbook that keeps every game you watch.`,
  alternates: { canonical: `${SITE}/matchups` },
}

export default function MatchupsIndex() {
  const byLeague = MATCHUPS.reduce<Record<string, typeof MATCHUPS>>((acc, m) => {
    (acc[m.league] ||= []).push(m)
    return acc
  }, {})

  return (
    <>
      <SiteHeader />
      <main className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Matchups' }]} />

          <h1 className="headline mt-6 text-3xl text-ink sm:text-4xl">
            Track the biggest rivalries in sport, without gambling ads
          </h1>
          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            {MATCHUP_COUNT} fixtures people plan their week around. Follow them live in Scorebug,
            then grade the game out of 5.0 and keep it forever. No odds, no spreads, no sportsbook
            logos.
          </p>

          <div className="mt-10 space-y-9">
            {Object.entries(byLeague).map(([league, list]) => (
              <section key={league}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{league}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {list.map(m => (
                    <li key={m.slug}>
                      <Link
                        href={`/matchups/${m.slug}`}
                        className="glass-pill inline-flex rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink"
                      >
                        {m.a.short} vs {m.b.short}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-12">
            <AppCta line="Open Scorebug and start your logbook" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
