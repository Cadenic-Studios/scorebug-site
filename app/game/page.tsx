import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '../config'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq } from '../lib/seo'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'
import { loadRecent } from '../lib/gamepage'

/**
 * /game — the games fans have actually graded.
 *
 * Deliberately NOT a list of every fixture ever played. A page per game only
 * earns its place once there is something on it worth reading, and an index of
 * thousands of empty pages is the doorway-page pattern this site refuses
 * everywhere else (see app/matchups.ts for the same reasoning about rivalries).
 * This lists what has been logged, newest first, and grows on its own.
 */

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Was it a good game? Fan-graded results across 19 leagues',
  description:
    'Every scores site tells you who won. Scorebug tells you whether the game was worth watching — '
    + 'rated from the box score, and graded out of 5.0 by the fans who actually watched it.',
  alternates: { canonical: `${SITE}/game` },
}

const faqs: Faq[] = [
  {
    q: 'How do you know whether a game was good?',
    a: 'Two ways, kept separate. Every finished game gets a rating out of 100 worked out from the box '
      + 'score alone — how close it was, overtime, comebacks, lead changes, what was at stake. On top of '
      + 'that, fans who logged the game on Scorebug grade it out of 5.0, and that grade appears only once '
      + 'somebody has actually given one.',
  },
  {
    q: 'Can I rate a game myself?',
    a: 'Yes. Log it on Scorebug, grade it out of 5.0 and write what it meant. It stays in your logbook '
      + 'for good, and it counts towards the grade shown on that game’s page. Free on web and Android.',
  },
]

export default async function Page() {
  const games = await loadRecent(60)
  const jsonLd = graph([
    organizationSchema(['sports game ratings', 'was it a good game', 'fan game grades']),
    applicationSchema(),
    faqSchema(faqs),
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main id="main" className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Games' }]} />

          <h1 className="headline mt-6 text-3xl text-ink sm:text-4xl">Was it a good game?</h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            Every scores site tells you who won. None of them tell you whether it was worth two hours
            of your evening — because answering that needs people who watched it, saying so. These are
            the games fans have graded on Scorebug, newest first.
          </p>

          <div className="mt-8">
            <AppCta line="Grade the games you watch" />
          </div>

          {games.length ? (
            <ul className="mt-12 divide-y divide-white/10 border-y border-white/10">
              {games.map(g => (
                <li key={g.id}>
                  <Link href={g.href} className="group flex items-center gap-4 py-4 transition-colors hover:bg-white/[0.02]">
                    <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-ink-3">{g.leagueId}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ink group-hover:underline">
                        {g.awayTeam} {g.awayScore ?? ''} &middot; {g.homeTeam} {g.homeScore ?? ''}
                      </span>
                      <span className="block text-[12px] text-ink-3">
                        {g.logs} {g.logs === 1 ? 'grade' : 'grades'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="headline text-xl text-sb-teal">{g.avg.toFixed(1)}</span>
                      <span className="text-[12px] text-ink-3"> / 5</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[15px] text-ink-2">
              No games have been graded yet. Log the next one you watch and it will be the first.
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
