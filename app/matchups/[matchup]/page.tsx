import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SITE, WEB_APP } from '../../config'
import { MATCHUPS, getMatchup } from '../../matchups'
import { LEAGUES } from '../../leagues'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq } from '../../lib/seo'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav, AppCta } from '../../components/SiteChrome'

/**
 * /matchups/[matchup] — one static page per curated rivalry.
 *
 * ─── WHY THE LIST IS CURATED ────────────────────────────────────────────────
 * See app/matchups.ts: every pair in the five club leagues is ~2,300
 * combinations, and generating them would be a doorway-page farm. These are
 * fixtures people search by name, so each page answers a query that exists.
 *
 * ─── WHAT THIS PAGE DOES NOT CLAIM ──────────────────────────────────────────
 * No score, no date, no "next game". This is a statically generated marketing
 * page with no live data source behind it, and a stale fixture date is worse
 * than none — it is a factual error a visitor catches immediately and an answer
 * engine may quote. The page answers "where do I follow this rivalry without
 * gambling ads", which is true whenever it is read. Live scores are the app's
 * job, and the CTA is how you get there.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return MATCHUPS.map(m => ({ matchup: m.slug }))
}

const leagueFull = (id: string) => LEAGUES.find(l => l.id === id)?.full ?? id

export async function generateMetadata(
  { params }: { params: { matchup: string } },
): Promise<Metadata> {
  const m = getMatchup(params.matchup)
  if (!m) return {}
  const title = `Where to track ${m.a.name} vs ${m.b.name} live scores without gambling ads`
  const description =
    `Follow ${m.a.name} vs ${m.b.name} live on Scorebug, then grade the game out of 5.0 and keep `
    + `it in your logbook forever. No odds, no spreads, no sportsbook ads. Free on web and Android.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/matchups/${m.slug}` },
    openGraph: {
      type: 'website', url: `${SITE}/matchups/${m.slug}`, title, description,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function MatchupPage({ params }: { params: { matchup: string } }) {
  const m = getMatchup(params.matchup)
  if (!m) notFound()

  const full = leagueFull(m.league)
  const named = m.nickname ? `, known as ${m.nickname},` : ''

  const faqs: Faq[] = [
    {
      q: `Where can I watch the ${m.a.name} vs ${m.b.name} score live without betting ads?`,
      a: `Scorebug carries live ${full} scores including ${m.a.name} vs ${m.b.name}, with no odds, `
        + `no spreads and no sportsbook sponsorships. It is free in any browser and on Android.`,
    },
    {
      q: `Can I rate and save a ${m.a.short} vs ${m.b.short} game?`,
      a: `Yes. When the game ends you grade it out of 5.0, write what it meant, note whether you `
        + `watched at home or were in the building, and it stays in your Scorebug vault permanently.`,
    },
    {
      q: `Can I log an older ${m.a.short} vs ${m.b.short} game I watched years ago?`,
      a: `Yes. Scorebug lets you log finished games back to the 2002 season, so a past meeting `
        + `between ${m.a.name} and ${m.b.name} can still be added to your record.`,
    },
  ]

  const jsonLd = graph([
    organizationSchema([
      full, `${m.a.name}`, `${m.b.name}`, `${m.a.name} vs ${m.b.name}`,
    ]),
    applicationSchema(
      'Scorebug',
      `Track ${m.a.name} vs ${m.b.name} live, then log and grade the game.`,
    ),
    faqSchema(faqs),
  ])

  return (
    <>
      <Breadcrumbs trail={[
        { name: 'Scorebug', url: SITE },
        { name: 'Matchups', url: `${SITE}/matchups` },
        { name: `${m.a.name} vs ${m.b.name}` },
      ]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[
            { name: 'Scorebug', href: '/' },
            { name: 'Matchups', href: '/matchups' },
            { name: `${m.a.short} vs ${m.b.short}` },
          ]} />

          <p
            className="glass-pill mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase"
            style={{ color: m.a.color }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: m.a.color, boxShadow: `0 0 8px ${m.a.color}` }} />
            {m.league}
          </p>

          <h1 className="headline mt-5 text-3xl text-ink sm:text-4xl">
            Where to track {m.a.name} vs {m.b.name} live scores without gambling ads
          </h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            Scorebug carries live {full} scores, including {m.a.name} vs {m.b.name}{named} with no
            odds, no spreads and no sportsbook logos anywhere in it. When the final whistle goes you
            grade the game out of 5.0, write what it meant, and keep it in your logbook for good.
          </p>

          <div className="mt-8">
            <AppCta line={`Follow ${m.a.short} vs ${m.b.short} in Scorebug`} />
          </div>

          <section className="mt-14 grid gap-4 sm:grid-cols-2">
            {[m.a, m.b].map(t => (
              <div key={t.slug} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{t.league}</p>
                <p className="headline mt-2 text-2xl text-ink">{t.name}</p>
                <Link
                  href={`/gear/${t.slug}`}
                  className="mt-4 inline-flex text-[14px] font-semibold text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:decoration-white/60"
                >
                  {t.short} gear and tickets
                </Link>
              </div>
            ))}
          </section>

          <section className="mt-14">
            <h2 className="headline text-2xl text-ink">Common questions</h2>
            <dl className="mt-6 space-y-6">
              {faqs.map(f => (
                <div key={f.q}>
                  <dt className="text-[16px] font-bold text-ink">{f.q}</dt>
                  <dd className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="mt-14 text-[13px] text-ink-3">
            More {full}:{' '}
            <Link
              href={`/leagues/${m.league.toLowerCase()}`}
              className="font-semibold text-ink underline decoration-white/25 underline-offset-2"
            >
              every club and rivalry we cover
            </Link>
            , or{' '}
            <a href={WEB_APP} className="font-semibold text-ink underline decoration-white/25 underline-offset-2">
              open the app
            </a>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
