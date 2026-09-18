import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE } from '../config'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq } from '../lib/seo'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'
import { loadRecent } from '../lib/gamepage'
import { harvestRecent } from '../lib/harvest'

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
  /* TWO SOURCES, ONE LIST.
     `graded` is what fans have actually rated — richer, rarer, and strictly
     better when it exists. `rated` is every finished game of the last few days
     scored from the box score alone, which needs no users at all.
     Before there is an audience the second is the entire page; after there is
     one the first rises to the top of it and the second keeps the long tail
     from being empty. Neither is ever the whole answer on its own. */
  const [graded, rated] = await Promise.all([
    loadRecent(60),
    harvestRecent({ days: 3, limit: 60 }),
  ])
  const gradedIds = new Set(graded.map((g) => g.id))
  const games = graded
  const alsoRated = rated.filter((g) => !gradedIds.has(g.id))
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
            of your evening. Every finished game here carries a rating out of 100 worked out from the
            result alone, and a grade out of 5.0 from the fans who actually watched it — kept separate,
            because they are not the same claim.
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
          ) : null}

          {/* ── RATED FROM THE BOX SCORE ────────────────────────────────────
              Separated from the fan grades and labelled as what it is. The two
              numbers measure different things — one is a machine reading a
              result, the other is people who sat through it — and blending them
              into a single figure would make both untrustworthy. The page has
              always kept them apart; this section is where the second one lives
              until somebody grades the game and it moves up. */}
          {alsoRated.length ? (
            <>
              <h2 className="headline mt-14 text-2xl text-ink">Rated from the box score</h2>
              <p className="mt-3 max-w-[42rem] text-[15px] leading-relaxed text-ink-2">
                No one has graded these yet. Every finished game still gets a rating out of 100 worked
                out from the result alone — how close it was, whether it went to overtime, how big a
                comeback it took, what was at stake. Be the first to say what it was actually like.
              </p>
              <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {alsoRated.map(g => (
                  <li key={`${g.leagueId}-${g.id}`}>
                    <Link href={g.href} className="group flex items-center gap-4 py-4 transition-colors hover:bg-white/[0.02]">
                      <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-ink-3">{g.leagueId}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink group-hover:underline">
                          {g.awayName} {g.awayScore ?? ''} &middot; {g.homeName} {g.homeScore ?? ''}
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">{g.verdict}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="headline text-xl text-ink-2">{g.watch}</span>
                        <span className="text-[12px] text-ink-3"> / 100</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* ── THE ANSWERS, IN VISIBLE TEXT ────────────────────────────────
              These two answers already shipped inside the FAQPage JSON-LD and
              nowhere else, so the page rendered 223 words and no H2s. Answer
              engines weight text they can read on the page above structured
              data they have to be told about, and this is the page whose whole
              job is being quoted for "was the game any good". Same words, same
              source array, now actually on the page. */}
          <section className="mt-16 border-t border-white/10 pt-10">
            {faqs.map(f => (
              <div key={f.q} className="mt-8 first:mt-0">
                <h2 className="headline text-xl text-ink">{f.q}</h2>
                <p className="mt-3 max-w-[42rem] text-[15px] leading-relaxed text-ink-2">{f.a}</p>
              </div>
            ))}
          </section>

          {!games.length && !alsoRated.length ? (
            <p className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[15px] text-ink-2">
              No finished games in the last few days. Check back after tonight&rsquo;s card.
            </p>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
