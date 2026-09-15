import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageMeta } from '../../lib/meta'
import { SITE, WEB_APP } from '../../config'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../../components/SiteChrome'
import { readSlate, engineConfigured, type SlateGame } from '../../lib/dispatch'
import { LEAGUES } from '../../leagues'

/**
 * /slate/[week] — one week, every fixture, a grade-it link per row.
 *
 * The document comes from the engine (dispatch/public/articles/{week}) and is
 * rendered as data: a table per league, times already in Mountain time, and a
 * deep link into The Log for every ESPN-sourced game. JSON-LD lists the games
 * as SportsEvents with the site as the organiser of nothing — it describes the
 * fixtures, not us — and never a price or an offer.
 */
export const revalidate = 3600
export const dynamicParams = true

type Props = { params: { week: string } }

const LEAGUE_COLOR: Record<string, string> = Object.fromEntries(LEAGUES.map(l => [l.id, l.color]))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slate = engineConfigured ? await readSlate(params.week) : null
  if (!slate) return { robots: { index: false } }
  return pageMeta({
    path: `/slate/${slate.slug}`,
    title: slate.title,
    description: `${slate.count} games across ${slate.leagues} leagues on The Slate, ${slate.range}. Mountain times, and a grade-it link for every one. No odds, no sportsbook.`,
  })
}

function logHref(g: SlateGame): string {
  if (g.espnId && g.source === 'espn') return `${WEB_APP}/the-log/?gameId=${encodeURIComponent(g.espnId)}&gameTime=${encodeURIComponent(g.start)}&utm_source=site&utm_medium=slate`
  return `${WEB_APP}/the-slate/?utm_source=site&utm_medium=slate`
}

/** JSON that is safe to sit inside a <script> element. */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default async function SlateWeek({ params }: Props) {
  const slate = engineConfigured ? await readSlate(params.week) : null
  if (!slate) notFound()

  const events = slate.byLeague.flatMap(l => l.games.slice(0, 40).map(g => ({
    '@type': 'SportsEvent',
    name: g.name || `${g.away} at ${g.home}`,
    startDate: g.start,
    eventStatus: g.postponed ? 'https://schema.org/EventPostponed' : 'https://schema.org/EventScheduled',
    ...(g.venue ? { location: { '@type': 'Place', name: g.venue, ...(g.city ? { address: g.city } : {}) } } : {}),
    ...(g.home && g.away ? { homeTeam: { '@type': 'SportsTeam', name: g.home }, awayTeam: { '@type': 'SportsTeam', name: g.away } } : {}),
  })))
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: slate.title,
    url: `${SITE}/slate/${slate.slug}`,
    numberOfItems: slate.count,
    itemListElement: events.slice(0, 200).map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: e })),
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'The week\'s slate', href: '/slate' }, { name: slate.range }]} />
          <div className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{slate.slug} · Mountain time</div>
          <h1 className="headline mt-2 text-3xl text-ink sm:text-4xl">{slate.title}</h1>
          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            {slate.count} games across {slate.leagues} leagues. Tap any row to log it in Scorebug and grade it out of 5.0 when it is over.
          </p>
          {slate.highlights.length ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {slate.highlights.map(h => (
                <li key={h} className="glass-pill rounded-lg px-3 py-1.5 text-[13px] font-bold text-ink-2">{h}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-10 space-y-10">
            {slate.byLeague.map(l => (
              <section key={l.league} id={l.league.toLowerCase()}>
                <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: LEAGUE_COLOR[l.league] || '#58A6FF' }} />
                  <Link href={`/leagues/${l.league.toLowerCase()}`} className="hover:text-ink-2">{l.name}</Link>
                  <span className="text-ink-3">· {l.count}</span>
                </h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <tbody>
                      {l.games.map(g => (
                        <tr key={g.id} className="border-b border-white/5 last:border-0">
                          <td className="whitespace-nowrap py-2.5 pr-4 text-ink-3">{g.day.slice(0, 3)} {g.time}</td>
                          <td className="py-2.5 pr-4 font-semibold text-ink">
                            {g.name || <>{g.away} <span className="text-ink-3">at</span> {g.home}</>}
                            {g.postponed ? <span className="ml-2 text-[11px] uppercase tracking-wider text-sb-gold">postponed</span> : null}
                          </td>
                          <td className="hidden py-2.5 pr-4 text-ink-3 sm:table-cell">{g.venue || ''}{g.broadcast ? ` · ${g.broadcast}` : ''}</td>
                          <td className="whitespace-nowrap py-2.5 text-right">
                            <a href={logHref(g)} className="text-sb-blue hover:text-ink">Log it ›</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <p className="mt-10 text-[13px] text-ink-3">
            Fixtures from the public scoreboards Scorebug reads; times may move. Published {slate.publishedAt.slice(0, 10)}.
            There are no odds, spreads or sportsbook links on this page, and there never will be.
          </p>
          <div className="mt-8">
            <AppCta line="Open The Slate and log the ones you watch" />
          </div>
        </div>
      </main>
      <SiteFooter />
      {/* ── WHY THIS IS NOT PLAIN JSON.stringify ────────────────────────────
          `JSON.stringify` escapes quotes and backslashes. It does NOT escape
          "<", so a fixture whose venue or team name contained "</script>"
          closed this tag and everything after it ran as script in the
          getscorebug.app origin — baked into the ISR cache and served to every
          visitor for the next hour. The strings here come from ESPN by way of
          feed.js, whose entire sanitiser is `String(v)`, and land in Firestore
          untouched, so the first place anyone could have caught it is here.

          U+2028 and U+2029 survive JSON.stringify too and are line terminators
          to a JavaScript parser, so they go as well. This is the only
          dangerouslySetInnerHTML in the app; everything else is JSX text and
          React escapes it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
    </>
  )
}
