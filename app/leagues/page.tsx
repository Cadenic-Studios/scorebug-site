import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '../config'
import { LEAGUES, LEAGUE_COUNT } from '../leagues'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'

/**
 * /leagues — the hub the per-league pages hang off.
 *
 * ─── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
 * A dynamic route with no page linking into it is an orphan: the sitemap may
 * list it, but nothing on the site points at it, and orphaned pages are crawled
 * late and ranked poorly. This hub is the internal link graph for the whole
 * programmatic set, which is most of what makes it work.
 */
export const metadata: Metadata = {
  title: `Which leagues can you track and log in Scorebug?`,
  description:
    `Scorebug covers ${LEAGUE_COUNT} leagues across hockey, football, basketball, baseball, soccer, `
    + `racing and cricket. Live scores with no gambling ads, and a permanent logbook for every game you watch.`,
  alternates: { canonical: `${SITE}/leagues` },
}

export default function LeaguesIndex() {
  const bySport = LEAGUES.reduce<Record<string, typeof LEAGUES>>((acc, l) => {
    (acc[l.sport] ||= []).push(l)
    return acc
  }, {})

  return (
    <>
      <SiteHeader />
      <main className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Leagues' }]} />

          <h1 className="headline mt-6 text-3xl text-ink sm:text-4xl">
            Which leagues can you track and log in Scorebug?
          </h1>
          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            {LEAGUE_COUNT} leagues, across seven sports. Live scores with no odds and no sportsbook
            sponsorships, and a permanent logbook for every game you watch.
          </p>

          <div className="mt-10 space-y-9">
            {Object.entries(bySport).map(([sport, list]) => (
              <section key={sport}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{sport}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {list.map(l => (
                    <li key={l.id}>
                      <Link
                        href={`/leagues/${l.id.toLowerCase()}`}
                        className="glass-pill inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold text-ink-2 transition-colors hover:text-ink"
                        style={{ ['--league' as string]: l.color }}
                      >
                        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                        {l.full}
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
