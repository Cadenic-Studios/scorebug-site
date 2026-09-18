import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { SITE, freeOnPlatforms } from '../../../config'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq, safeJsonLd } from '../../../lib/seo'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../../../components/SiteChrome'
import { loadGame, loadCommunity, parseSlug, leagueFromSlug, shareCardUrl, type GamePage } from '../../../lib/gamepage'

/**
 * /game/[league]/[slug] — one page per game, answering the question no scores
 * site answers: was it worth watching.
 *
 * ─── WHY THIS PAGE CAN EXIST AND A SCORES SITE'S CANNOT ─────────────────────
 *
 * Everyone publishes the result. Nobody publishes whether the game was any
 * good, because answering it needs something ESPN does not have: people who
 * watched, saying so. Scorebug has exactly that, and it accumulates every night
 * on its own. "Was Oilers vs Flames a good game" is a real query with no good
 * answer on the internet today.
 *
 * ─── TWO LAYERS, NEVER BLENDED ──────────────────────────────────────────────
 *
 * THE TAPE is computed from the box score — one-goal game, overtime, comeback,
 * upset — and exists for every game ever played, including one that finished
 * twenty minutes ago and every game in the 2002 archive. It is out of 100.
 *
 * THE STANDS is the fan grade out of 5.0, and appears ONLY when somebody has
 * logged it. It is never estimated, never smoothed toward a prior, and never
 * shown as a zero when it is really an absence.
 *
 * Two different scales on purpose: a number out of 100 can never be mistaken
 * for votes out of 5. That is what lets the page be useful on the night without
 * ever implying a crowd that was not there.
 *
 * ─── WHAT IT DOES NOT PUBLISH ───────────────────────────────────────────────
 *
 * No usernames, no written notes, no individual logs — see engine_game_page in
 * the migration. Those were shared inside the app, and "public in the app" is
 * not the same promise as "indexed under your name". Counts and an average.
 *
 * ─── AND NO aggregateRating ─────────────────────────────────────────────────
 *
 * We hold real grades and could emit one. We do not: this site's rule is that
 * structured data asserts only what it can stand behind, ratings on a
 * SportsEvent are not a supported rich result, and a star rating on a hockey
 * game is the kind of claim that gets a domain's rich results pulled wholesale.
 * The grade is stated in prose and in the FAQ answer, where a reader and an
 * answer engine can both see exactly what it is and how many people it came from.
 */

export const revalidate = 3600
export const dynamicParams = true

type Params = { params: { league: string; slug: string } }

async function load(p: Params['params']): Promise<GamePage | null> {
  const parsed = parseSlug(p.slug)
  if (!parsed) return null
  const game = await loadGame(p.league, parsed.date, parsed.id)
  if (!game) return null
  game.community = await loadCommunity(game.id)
  return game
}

const fixture = (g: GamePage) => `${g.away.name} vs ${g.home.name}`
const scoreline = (g: GamePage) =>
  g.completed && g.away.scoreText != null && g.home.scoreText != null
    ? `${g.away.name} ${g.away.scoreText}, ${g.home.name} ${g.home.scoreText}`
    : fixture(g)

const dateLong = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

/** The one-paragraph answer, written the way somebody would say it out loud. */
function verdictSentence(g: GamePage): string {
  if (!g.completed) return `${fixture(g)} has not been played yet, so there is nothing to rate.`
  if (!g.watch.rated) return `${scoreline(g)}. Not enough of the record to rate this one.`
  const tape = `${g.watch.summary}`
  if (!g.community) return `${tape} No one has graded it on Scorebug yet.`
  return `${tape} ${g.community.logs} ${g.community.logs === 1 ? 'fan who logged it gave it' : 'fans who logged it average'} ${g.community.avg.toFixed(1)} out of 5.`
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const g = await load(params)
  if (!g) return {}
  const title = g.completed
    ? `Was ${fixture(g)} a good game? ${g.away.scoreText}-${g.home.scoreText}, ${dateLong(g.startISO)}`
    : `${fixture(g)} — ${dateLong(g.startISO)}`
  const description = verdictSentence(g).slice(0, 300)
  const url = `${SITE}/game/${g.leagueId.toLowerCase()}/${g.slug}`
  /* The scoreboard itself, rendered by the card press, as the share image —
     so a link to this game unfurls as the actual result rather than the same
     generic logo every other page on the domain shares as. */
  const image = shareCardUrl(g)
  const alt = g.completed
    ? `${scoreline(g)} — rated ${g.watch.rated ? `${g.watch.score} out of 100` : 'by Scorebug'}`
    : `${fixture(g)}, ${dateLong(g.startISO)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type: 'article',
      images: [{ url: image, width: 1200, height: 675, alt }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function Page({ params }: Params) {
  const lg = leagueFromSlug(params.league)
  if (!lg) notFound()
  const g = await load(params)
  if (!g) notFound()

  /* One game, one URL. A link with a stale or hand-typed slug redirects to the
     canonical one rather than serving the same content at two addresses. */
  if (g.slug !== params.slug) redirect(`/game/${g.leagueId.toLowerCase()}/${g.slug}`)

  const answer = verdictSentence(g)
  const faqs: Faq[] = [
    { q: `Was ${fixture(g)} a good game?`, a: answer },
    {
      q: `What was the final score of ${fixture(g)}?`,
      a: g.completed
        ? `${scoreline(g)}${g.detail ? ` (${g.detail})` : ''}, played ${dateLong(g.startISO)}.`
        : `${fixture(g)} is scheduled for ${dateLong(g.startISO)} and has not been played yet.`,
    },
    {
      q: `Where can I rate ${fixture(g)}?`,
      a: 'On Scorebug. Log the game, grade it out of 5.0, write what it meant, and it stays in your '
        + `logbook for good. ${freeOnPlatforms()} No odds, spreads or sportsbook ads anywhere in it.`,
    },
  ]

  const event: Record<string, unknown> = {
    '@type': 'SportsEvent',
    name: fixture(g),
    sport: g.leagueName,
    ...(g.startISO ? { startDate: g.startISO } : {}),
    ...(g.venue ? { location: { '@type': 'Place', name: g.venue } } : {}),
    homeTeam: { '@type': 'SportsTeam', name: g.home.name },
    awayTeam: { '@type': 'SportsTeam', name: g.away.name },
    /* schema.org's EventStatusType has no "finished" member — the vocabulary
       only distinguishes scheduled from cancelled, postponed, rescheduled and
       moved online. A played game is one that happened as scheduled, so this is
       unconditional; the ternary that used to sit here returned the same value
       on both branches, which reads like a decision and is not one. */
    eventStatus: 'https://schema.org/EventScheduled',
    url: `${SITE}/game/${g.leagueId.toLowerCase()}/${g.slug}`,
  }

  const jsonLd = graph([
    organizationSchema([g.leagueName, `${g.leagueName} results`, 'sports game ratings']),
    applicationSchema(),
    event,
    faqSchema(faqs),
  ])

  const total = g.community ? g.community.dist.reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <SiteHeader />

      <main id="main" className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[
            { name: 'Scorebug', href: '/' },
            { name: 'Games', href: '/game' },
            { name: `${g.away.abbr} vs ${g.home.abbr}` },
          ]} />

          <p className="glass-pill mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase text-sb-red">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-sb-red shadow-[0_0_8px_#F85149]" />
            {g.leagueName}
            {g.startISO ? <span className="text-ink-3"> · {dateLong(g.startISO)}</span> : null}
          </p>

          <h1 className="headline mt-5 text-3xl text-ink sm:text-4xl">
            {g.completed ? <>Was {fixture(g)} a good game?</> : <>{fixture(g)}</>}
          </h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">{answer}</p>

          {/* ── the scoreline ─────────────────────────────────────────── */}
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              {[g.away, g.home].map((t, i) => (
                <div key={t.abbr + i} className={`flex-1 ${i === 1 ? 'text-right' : ''}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{i === 0 ? 'Away' : 'Home'}</p>
                  <p className="headline mt-1 text-xl text-ink sm:text-2xl">{t.name}</p>
                  {t.record ? <p className="mt-0.5 text-[13px] text-ink-3">{t.record}</p> : null}
                  <p className={`headline mt-2 text-4xl sm:text-5xl ${t.winner ? 'text-ink' : 'text-ink-3'}`}>
                    {g.completed ? (t.scoreText ?? '—') : '—'}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 text-center text-[12px] font-black uppercase tracking-[0.18em] text-ink-3">
              {g.completed ? (g.detail || 'Final') : (g.detail || 'Scheduled')}
              {g.venue ? <span className="font-semibold normal-case tracking-normal text-ink-3"> · {g.venue}</span> : null}
            </p>
          </section>

          {/* ── the tape ──────────────────────────────────────────────── */}
          {g.watch.rated ? (
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">The tape</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="headline text-4xl text-sb-red">{g.watch.score}</span>
                <span className="text-[15px] text-ink-3">/ 100</span>
                <span className="headline text-xl text-ink">{g.watch.verdict}</span>
              </div>
              {g.watch.reasons.length ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {g.watch.reasons.map(r => (
                    <li key={r} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[13px] text-ink-2">{r}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
                Worked out from the box score alone — margin, overtime, comebacks, lead changes and
                what was at stake. No opinions in it, which is why it is there for every game, the
                minute it ends.
              </p>
            </section>
          ) : null}

          {/* ── the stands ────────────────────────────────────────────── */}
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">The stands</p>
            {g.community ? (
              <>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="headline text-4xl text-sb-teal">{g.community.avg.toFixed(1)}</span>
                  <span className="text-[15px] text-ink-3">/ 5.0</span>
                  <span className="text-[14px] text-ink-2">
                    from {g.community.logs} {g.community.logs === 1 ? 'fan' : 'fans'} who logged it
                  </span>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => {
                    const n = g.community!.dist[star - 1]
                    const pct = total ? Math.round((n / total) * 100) : 0
                    return (
                      <li key={star} className="flex items-center gap-3 text-[13px] text-ink-3">
                        <span className="w-6 tabular-nums">{star}★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <span className="block h-full rounded-full bg-sb-teal/70" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-8 text-right tabular-nums">{n}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                Nobody has graded this one on Scorebug yet. If you watched it, you can be the first —
                and the grade on this page will be yours.
              </p>
            )}
          </section>

          <div className="mt-10">
            <AppCta line={g.completed ? `Grade ${g.away.abbr} vs ${g.home.abbr} out of 5.0` : `Follow ${g.away.abbr} vs ${g.home.abbr} in Scorebug`} />
          </div>

          <p className="mt-10 text-[13px] text-ink-3">
            <Link href="/game" className="underline decoration-white/25 underline-offset-2 hover:decoration-white/60">
              More games fans have graded
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
