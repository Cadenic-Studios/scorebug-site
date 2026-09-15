import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMeta } from '../lib/meta'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'
import { listSlates, engineConfigured } from '../lib/dispatch'
import { LEAGUE_COUNT } from '../leagues'

/**
 * /slate — the archive of weekly slates the marketing engine publishes.
 *
 * ─── WHY A WEEKLY PAGE AND NOT A PAGE PER GAME ──────────────────────────────
 * A page per fixture is two thousand near-identical documents a season, which
 * is the doorway pattern app/matchups.ts already refuses at page level. One
 * page per week, every fixture across every in-season league with local times
 * and a grade-it link, answers the question people type on a Monday and does
 * it fifty-two times a year. Real data, a real action per row, one canonical
 * per week.
 *
 * The engine writes the document; this page only renders it. If the engine
 * has not published yet the page says so rather than inventing a week.
 */
export const metadata: Metadata = pageMeta({
  path: '/slate',
  title: 'Every game this week, across 19 leagues',
  description: `The week's slate on Scorebug: every fixture across ${LEAGUE_COUNT} leagues with Mountain times, and a grade-it link for each. No odds, no sportsbook.`,
})

export const revalidate = 3600

export default async function SlateIndex() {
  const weeks = engineConfigured ? await listSlates() : []
  return (
    <>
      <SiteHeader />
      <main id="main" className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'The week\'s slate' }]} />
          <h1 className="headline mt-6 text-3xl text-ink sm:text-4xl">Every game this week</h1>
          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            One page a week: every fixture across {LEAGUE_COUNT} leagues, in Mountain time, with a link to log and grade
            each one. Published every Monday morning. No odds, no spreads, no sportsbook anywhere on it.
          </p>

          {weeks.length ? (
            <ul className="mt-10 space-y-3">
              {weeks.map(w => (
                <li key={w.slug}>
                  <Link href={`/slate/${w.slug}`} className="glass-card block rounded-xl px-5 py-4 transition-colors hover:text-ink">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{w.slug}</div>
                    <div className="mt-1 text-lg font-bold text-ink">{w.range}</div>
                    <div className="mt-1 text-sm text-ink-2">{w.count} games across {w.leagues} leagues</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="glass-card mt-10 rounded-xl px-5 py-4 text-ink-2">The first week&rsquo;s slate publishes on Monday morning. Until then, The Slate in the app has today.</p>
          )}

          <div className="mt-12">
            <AppCta line="Open The Slate and log the ones you watch" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
