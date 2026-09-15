import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITE, WEB_APP, appPlatforms } from '../../config'
import { LEAGUES, LEAGUE_COUNT, type SiteLeague } from '../../leagues'
import { GEAR_TEAMS } from '../../lib/teams'
import { clubsInLeague } from '../../clubs'
import { leagueGearLink, advertiserName } from '../../lib/affiliates'
import Sponsored, { AffiliateLink } from '../../components/Sponsored'
import { MATCHUPS } from '../../matchups'
import { hubForSport } from '../../sports'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq } from '../../lib/seo'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav, AppCta } from '../../components/SiteChrome'
import Link from 'next/link'

/**
 * /leagues/[league] — one static page per supported league.
 *
 * ─── WRITTEN AS AN ANSWER, NOT AS A BROCHURE ────────────────────────────────
 * The title and the H1 are the QUESTION a person types, answered. An answer
 * engine quoting this page needs a sentence it can lift whole, so the first
 * paragraph states what Scorebug does for this league in one self-contained
 * claim rather than opening with a brand line. That is the difference between
 * being cited and being skipped.
 *
 * ─── dynamicParams = false ──────────────────────────────────────────────────
 * Same guard `app/gear/[team]` documents: an open param on a programmatic
 * route is how a site accidentally ships infinite thin pages, which is a named
 * Google spam pattern. Only the leagues that genuinely exist in the product
 * resolve; anything else is a real 404.
 */
export const dynamicParams = false

const slugOf = (l: SiteLeague) => l.id.toLowerCase()

export function generateStaticParams() {
  return LEAGUES.map(l => ({ league: slugOf(l) }))
}

function getLeague(slug: string): SiteLeague | undefined {
  return LEAGUES.find(l => slugOf(l) === slug.toLowerCase())
}

/**
 * The platform claim, DERIVED from LAUNCH_STAGE through appPlatforms() and
 * never typed. This page said "free to use on web and Android" in its meta
 * description and its body on all nineteen league pages while the Android
 * test was closed — exactly the claim appPlatforms() exists to prevent.
 */
function platformsSentence(): string {
  return appPlatforms().includes('Android')
    ? 'Free to use in any browser and on Android.'
    : 'Free to use in any browser, with Android early access open.'
}

export async function generateMetadata(
  { params }: { params: { league: string } },
): Promise<Metadata> {
  const l = getLeague(params.league)
  if (!l) return {}
  const title = `Where to track live ${l.full} scores without gambling ads`
  const description =
    `Scorebug tracks live ${l.full} scores and lets you grade every game you watch out of 5.0 `
    + `and keep it forever. No odds, no spreads and no sportsbook sponsorships. ${platformsSentence()}`
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/leagues/${slugOf(l)}` },
    openGraph: {
      type: 'website', siteName: 'Scorebug', url: `${SITE}/leagues/${slugOf(l)}`, title, description,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function LeaguePage({ params }: { params: { league: string } }) {
  const l = getLeague(params.league)
  if (!l) notFound()

  /**
   * TWO club lists, and they are not the same list.
   *
   * `clubs` is every club in the league, from the generated directory — 20 for
   * the Premier League, 136 for NCAA football. This section used to read from
   * GEAR_TEAMS, which only ever held the five leagues Fanatics stocks per-club
   * shops for, so /leagues/epl claimed to be about the Premier League and then
   * listed no clubs at all. Every league page now names its whole field.
   *
   * `gearSlugs` is the subset that has a PAGE at /gear/[team]. Only those get
   * linked; the rest render as plain text. Linking a club to a page that does
   * not exist is a 404, and generating a page for every club so the link works
   * is the thin-affiliate-page trap that app/lib/teams.ts exists to avoid.
   */
  const clubs = clubsInLeague(l.id)
  const gearSlugs = new Set(
    GEAR_TEAMS.filter(t => t.league === (l.id as never)).map(t => t.slug),
  )
  const rivalries = MATCHUPS.filter(m => m.league === l.id)
  /* The sport hub above this page, where one exists. Deliberately NOT in the
     breadcrumb: /hockey is not a parent of /leagues/nhl in the URL tree, and a
     breadcrumb that claims a hierarchy the paths do not have is a structured
     -data assertion that is simply false. It is a sibling link instead. */
  const hub = hubForSport(l.sport)
  /* Resolved once, per league, and it reports the merchant it chose so the
     visible attribution cannot drift from the destination. Null means no shop
     honestly stocks this league, and the unit renders nothing rather than a
     dead button. */
  const gear = leagueGearLink(l, `league_${l.id.toLowerCase()}`)

  /**
   * Written as questions somebody actually types. Each answer is a complete
   * sentence that survives being quoted with no surrounding context, because
   * that is exactly how an AI overview will use it.
   */
  const faqs: Faq[] = [
    {
      q: `Where can I track live ${l.full} scores without gambling ads?`,
      a: `Scorebug shows live ${l.full} scores with no betting odds, no spreads and no sportsbook `
        + `sponsorships anywhere in the product. It is free to use in any browser and on Android.`,
    },
    {
      q: `Can I log and rate ${l.label} games I have watched?`,
      a: `Yes. Scorebug is a logbook first: after a ${l.label} game ends you grade it out of 5.0, write `
        + `what it meant, record how you took it in — at the game, at home, at a bar or catching up `
        + `later — and it stays in `
        + `your vault permanently.`,
    },
    {
      q: `How far back do ${l.label} results go in Scorebug?`,
      a: `You can log finished games as far back as the 2002 season, so a ${l.label} game you watched `
        + `years ago can still be added to your record.`,
    },
    {
      q: `Is Scorebug free for ${l.label} fans?`,
      a: `Yes. Tracking scores and logging games is free. An optional Front Office membership adds a `
        + `bigger Starting Lineup and the Analytics Desk, but nothing about ${l.label} coverage is paywalled.`,
    },
  ]

  const jsonLd = graph([
    organizationSchema([l.full, `${l.sport}`, `${l.full} scores`, `${l.full} standings`]),
    applicationSchema(),
    faqSchema(faqs),
  ])

  return (
    <>
      <Breadcrumbs trail={[
        { name: 'Scorebug', url: SITE },
        { name: 'Leagues', url: `${SITE}/leagues` },
        { name: l.full },
      ]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main id="main" className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[
            { name: 'Scorebug', href: '/' },
            { name: 'Leagues', href: '/leagues' },
            { name: l.label },
          ]} />

          <p
            className="glass-pill mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase"
            style={{ color: l.color }}
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
            {l.sport}
          </p>

          {/* The H1 is the query, answered. It is deliberately a full sentence
              and not a two-word league name: the page has to earn a long-tail
              question, and the heading is the strongest signal of what question
              it answers. */}
          <h1 className="headline mt-5 text-3xl text-ink sm:text-4xl">
            Where to track live {l.full} scores without gambling ads
          </h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            Scorebug tracks live {l.full} scores and lets you grade every game you watch out of
            5.0, write what it meant, and keep it forever. There are no odds, no spreads and no
            sportsbook sponsorships anywhere in it. {platformsSentence()} It covers {LEAGUE_COUNT}{' '}
            leagues in total.
          </p>

          <div className="mt-8">
            <AppCta line={`Open Scorebug and start your ${l.label} logbook`} />
          </div>

          {clubs.length > 0 && (
            <section className="mt-14">
              <h2 className="headline text-2xl text-ink">Every {l.label} club</h2>
              <p className="mt-2 text-[15px] text-ink-2">
                All {clubs.length} clubs are in the app with their crest, colours and season record.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {clubs.map(t => (
                  <li key={t.slug}>
                    {gearSlugs.has(t.slug) ? (
                      <Link
                        href={`/gear/${t.slug}`}
                        className="glass-pill inline-flex rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink"
                      >
                        {t.name}
                      </Link>
                    ) : (
                      <span className="glass-pill inline-flex rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-2">
                        {t.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── ONE GEAR UNIT PER LEAGUE PAGE ────────────────────────────
              These nineteen pages carried no commerce at all, which was a
              gap rather than a principle: somebody reading the La Liga page is
              a person who might want a La Liga shirt, and the merchant is
              resolved per league by `leagueGearLink` so it can only ever point
              at a shop that actually stocks it.

              ONE link, not one per club. The club list above is content and
              stays content — twenty sponsored links interleaved with internal
              ones cannot be disclosed cleanly per item, and a page whose body
              is mostly affiliate links stops being the thing that ranks.

              Placed AFTER the club list and before the rivalries, so it sits
              at the point of highest intent rather than above the content. */}
          {gear && (
            <aside className="glass-card mt-14 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sb-gold">
                    {l.label} kit
                  </p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
                    Shirts and club apparel at {advertiserName(gear.merchant)}.
                  </p>
                </div>
                <Sponsored className="mt-1" />
              </div>
              <AffiliateLink
                href={gear.url}
                ariaLabel={`Shop ${l.full} kit at ${advertiserName(gear.merchant)} — sponsored`}
                className="sb-cta mt-4 inline-block rounded-xl px-5 py-3 text-[14px] font-black"
                style={{
                  background: 'linear-gradient(180deg, #E5B53C 0%, #E5B53CCC 100%)',
                  color: '#1A1206',
                  border: '1px solid #E5B53C',
                }}
              >
                Shop at {advertiserName(gear.merchant)}
              </AffiliateLink>
            </aside>
          )}

          {rivalries.length > 0 && (
            <section className="mt-14">
              <h2 className="headline text-2xl text-ink">{l.label} rivalries</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {rivalries.map(m => (
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
          )}

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

          {hub && (
            <p className="mt-14 text-[15px] leading-relaxed text-ink-2">
              Every {hub.label.toLowerCase()} league, club and rivalry Scorebug covers is indexed on{' '}
              <Link href={`/${hub.slug}`} className="font-semibold text-sb-blue underline decoration-white/25 underline-offset-2 hover:text-ink">
                the {hub.label.toLowerCase()} page
              </Link>
              .
            </p>
          )}

          <p className="mt-6 text-[13px] text-ink-3">
            Prefer the full app?{' '}
            <a href={WEB_APP} className="font-semibold text-ink underline decoration-white/25 underline-offset-2">
              Open Scorebug in your browser
            </a>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
