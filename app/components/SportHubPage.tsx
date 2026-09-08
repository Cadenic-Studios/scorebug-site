import Link from 'next/link'
import { SITE } from '../config'
import type { SiteLeague } from '../leagues'
import {
  type SportHub, leaguesFor, leaguesInFamily, clubsInLeagues,
  distinctClubCount, rivalriesFor, countriesFor,
} from '../sports'
import { clubCount } from '../clubs'
import {
  leagueGearLink, soccerGarageUrl, soccerGarageCarriesLeague,
  advertiserName, SOCCERGARAGE_PIXEL,
} from '../lib/affiliates'
import Sponsored, { AffiliateLink } from './Sponsored'
import { organizationSchema, applicationSchema, faqSchema, graph } from '../lib/seo'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav, AppCta } from './SiteChrome'

/**
 * The shared body of /football and /hockey.
 *
 * Two route files, one implementation. The routes are real folders rather than
 * a root-level `[sport]` dynamic segment on purpose: a dynamic segment at the
 * root of a site that already has /pricing, /shop, /gear, /news and four legal
 * pages is a shadowing hazard a reader has to hold in their head forever, and
 * it buys nothing while the curated list is two entries long.
 *
 * See app/sports.ts for why these are directories rather than a second telling
 * of the league page, and app/config.ts VANITY_DOMAINS for what points at them.
 *
 * ─── THE COMMERCE ON THIS PAGE IS DELIBERATELY LEAGUE-LEVEL ────────────────
 * One gear link per league, not one per club. Several hundred affiliate links
 * on a single page is the visual and structural signature of a thin affiliate
 * page whatever the content around it says, and this hub's job is to rank.
 * Per-club commerce already exists, one club per page, at /gear/[team].
 */

// ─── Small shared pieces ─────────────────────────────────────────────────────

function SectionHead({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <>
      <h2 className="headline text-2xl text-ink sm:text-3xl">{children}</h2>
      {sub && <p className="mt-3 max-w-[44rem] text-[15px] leading-relaxed text-ink-2">{sub}</p>}
    </>
  )
}

/** One league, as a card. Country and club count are the two facts that make
 *  this more than a link, and both are derived. */
function LeagueCard({ l }: { l: SiteLeague }) {
  const clubs = clubCount(l.id)
  return (
    <Link
      href={`/leagues/${l.id.toLowerCase()}`}
      className="glass-card block h-full rounded-2xl p-5 transition-colors hover:border-white/20"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: l.color }}
        />
        <span className="text-[15px] font-black leading-snug text-ink">{l.full}</span>
      </span>
      <span className="mt-2 block text-[13px] font-semibold text-ink-3">{l.country}</span>
      <span className="mt-2 block text-[13.5px] leading-relaxed text-ink-3">
        {clubs > 0
          ? `${clubs} clubs, live scores, and every finished match loggable back to 2002.`
          : 'Live coverage, and every finished session loggable back to 2002.'}
      </span>
    </Link>
  )
}

/** The club directory for one league. Rendered in full — the whole point of a
 *  directory is that the names are actually in the HTML. */
function ClubList({ leagues }: { leagues: SiteLeague[] }) {
  return (
    <div className="mt-5 space-y-7">
      {leagues.map(l => {
        const clubs = clubsInLeagues([l])
        if (clubs.length === 0) return null
        return (
          <section key={l.id}>
            <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <Link
                href={`/leagues/${l.id.toLowerCase()}`}
                className="text-[14px] font-black text-ink hover:text-sb-blue"
              >
                {l.full}
              </Link>
              <span className="text-[11.5px] font-semibold text-ink-3">
                {l.country} · {clubs.length} clubs
              </span>
            </h3>
            <ul className="mt-2.5 flex flex-wrap gap-x-1.5 gap-y-1.5">
              {clubs.map(c => (
                <li
                  key={c.slug}
                  className="glass-pill inline-flex rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-ink-2"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * The gear rail for a set of leagues.
 *
 * ─── WHY THE COPY NEVER NAMES A CLUB ON THE SOCCER SIDE ────────────────────
 * SoccerGarage cannot be deep-linked — measured, see the note in
 * lib/affiliates.ts — so world-football leagues get an eBay search that really
 * does resolve per league, plus ONE honest shop link that says "shop" rather
 * than pretending to be a club store. Fanatics leagues get a real store search.
 *
 * The whole rail collapses if nothing resolves, rather than rendering a heading
 * over an empty box.
 */
function GearRail({ leagues, heading }: { leagues: SiteLeague[]; heading: string }) {
  /* The merchant comes back FROM the link builder, never from a second lookup
     beside it. An earlier version asked `merchantForLeague` separately and
     every European row rendered "SoccerGarage" over a link to eBay — a false
     disclosure, because SoccerGarage has no per-league URL to build. */
  const rows = leagues.flatMap(l => {
    const link = leagueGearLink(l)
    // flatMap rather than map+filter: it narrows away the null without a type
    // predicate, and a null link means the league genuinely has no honest
    // destination, so it should render nothing rather than a dead button.
    return link ? [{ l, link }] : []
  })
  const anySoccerGarage = leagues.some(l => soccerGarageCarriesLeague(l.id))
  if (rows.length === 0) return null

  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sb-gold">{heading}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
            Kit, shirts and club apparel, by league.
          </p>
        </div>
        <Sponsored className="mt-1" />
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {rows.map(({ l, link }) => (
          <li key={l.id}>
            <AffiliateLink
              href={link.url}
              ariaLabel={`Shop ${l.full} kit at ${advertiserName(link.merchant)} — sponsored`}
              className="glass-pill inline-flex items-baseline gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold text-ink-2 transition-colors hover:text-ink"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 flex-shrink-0 self-center rounded-full"
                style={{ background: l.color }}
              />
              {l.label}
              {/* The merchant is named on every row. A reader is entitled to
                  know where a sponsored link goes before they click it, and
                  the three destinations here are genuinely different shops. */}
              <span className="text-[10.5px] font-semibold text-ink-3">{advertiserName(link.merchant)}</span>
            </AffiliateLink>
          </li>
        ))}
      </ul>

      {anySoccerGarage && (
        <>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
            For boots, keeper gear and training kit rather than a specific club:
          </p>
          <AffiliateLink
            href={soccerGarageUrl()}
            ariaLabel="Shop football boots and kit at SoccerGarage — sponsored"
            className="sb-cta mt-2.5 inline-block rounded-xl px-5 py-2.5 text-[13.5px] font-black"
            style={{
              background: 'linear-gradient(180deg, #E5B53C 0%, #E5B53CCC 100%)',
              color: '#1A1206',
              border: '1px solid #E5B53C',
            }}
          >
            SoccerGarage
          </AffiliateLink>
          {/* The CJ impression pixel that ships with this creative, rendered as
              a real element so the network counts the request. Only on the
              branch that actually shows the creative it belongs to. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SOCCERGARAGE_PIXEL}
            width={1}
            height={1}
            alt=""
            aria-hidden="true"
            className="hidden"
            {...({ border: '0' } as React.ImgHTMLAttributes<HTMLImageElement>)}
          />
        </>
      )}
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function SportHubPage({ hub }: { hub: SportHub }) {
  const leagues = leaguesFor(hub)
  const rivalries = rivalriesFor(hub)
  const countries = countriesFor(hub)
  const clubs = distinctClubCount(leagues)
  const families = hub.families ?? []

  const jsonLd = graph([
    organizationSchema([
      hub.label,
      ...leagues.map(l => l.full),
      ...leagues.map(l => `${l.full} scores`),
      ...countries.map(c => `${hub.label} in ${c}`),
    ]),
    applicationSchema(
      'Scorebug',
      `Track live scores across ${leagues.map(l => l.label).join(', ')} and log, grade and keep `
      + `every ${hub.label.toLowerCase()} match you watch.`,
    ),
    faqSchema(hub.faqs),
  ])

  /** Leagues that belong to no declared family. Hockey has no families, so
   *  this is its whole list; football should leave none behind, and if a new
   *  league ever does, it renders here rather than silently vanishing. */
  const claimed = new Set(families.flatMap(f => leaguesInFamily(hub, f.key).map(l => l.id)))
  const unclaimed = leagues.filter(l => !claimed.has(l.id))

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Scorebug', url: SITE }, { name: hub.label }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: hub.label }]} />

          <p
            className="glass-pill mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase"
            style={{ color: leagues[0]?.color }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: leagues[0]?.color, boxShadow: `0 0 8px ${leagues[0]?.color}` }}
            />
            {hub.label}
          </p>

          <h1 className="headline mt-5 text-3xl leading-[1.08] text-ink sm:text-4xl">{hub.h1}</h1>
          <p className="mt-5 max-w-[44rem] text-[17px] leading-relaxed text-ink-2">{hub.lede}</p>

          {/* ── The coverage figures ──────────────────────────────────────
              Three derived numbers, stated plainly. They are the fastest
              answer to "is my league in this", and because they come from the
              same tables the lists below do, they cannot drift into a claim
              the page itself disproves further down. */}
          <dl className="mt-9 grid grid-cols-3 gap-3">
            {[
              [leagues.length, leagues.length === 1 ? 'League' : 'Leagues'],
              [clubs, 'Clubs'],
              [countries.length, countries.length === 1 ? 'Country' : 'Countries'],
            ].map(([n, label]) => (
              <div key={String(label)} className="glass-card rounded-2xl px-4 py-4 text-center">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="headline block text-3xl text-ink sm:text-4xl">{n}</span>
                  <span className="mt-1 block text-[10.5px] font-black uppercase tracking-[0.18em] text-ink-3">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <AppCta className="mt-8" line={`Start your ${hub.label.toLowerCase()} record with tonight's game.`} />

          {/* ── The families, each with its leagues and its gear rail ────── */}
          {families.map(f => {
            const fl = leaguesInFamily(hub, f.key)
            if (fl.length === 0) return null
            return (
              <section key={f.key} className="mt-14">
                <SectionHead sub={f.blurb}>{f.name}</SectionHead>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {fl.map(l => <li key={l.id}><LeagueCard l={l} /></li>)}
                </ul>
                <div className="mt-4">
                  <GearRail leagues={fl} heading={`${f.name} kit`} />
                </div>
              </section>
            )
          })}

          {/* Hockey's path: no families, one list. The grid is conditional —
              an unconditional two-column grid pins a single league card to
              half the width with dead black beside it. */}
          {families.length === 0 && unclaimed.length > 0 && (
            <section className="mt-14">
              <SectionHead>
                {unclaimed.length === 1
                  ? `The ${hub.label.toLowerCase()} league Scorebug covers`
                  : `The ${unclaimed.length} ${hub.label.toLowerCase()} leagues Scorebug covers`}
              </SectionHead>
              <ul className={`mt-5 gap-3 ${unclaimed.length > 1 ? 'grid sm:grid-cols-2' : 'flex flex-col'}`}>
                {unclaimed.map(l => <li key={l.id}><LeagueCard l={l} /></li>)}
              </ul>
              <div className="mt-4">
                <GearRail leagues={unclaimed} heading={`${hub.label} gear`} />
              </div>
            </section>
          )}

          {/* A league that joined the hub but matched no family. Should be
              empty; rendering it means a new league is visible rather than
              silently missing from a page that claims to be a directory. */}
          {families.length > 0 && unclaimed.length > 0 && (
            <section className="mt-14">
              <SectionHead>Also covered</SectionHead>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {unclaimed.map(l => <li key={l.id}><LeagueCard l={l} /></li>)}
              </ul>
            </section>
          )}

          {/* ── What it does ─────────────────────────────────────────────── */}
          <section className="mt-14">
            <SectionHead>What Scorebug does for {hub.label.toLowerCase()} fans</SectionHead>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {hub.points.map(p => (
                <div key={p.head} className="glass-card rounded-2xl p-5">
                  <h3 className="text-[15px] font-black text-ink">{p.head}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Named rivalries ──────────────────────────────────────────── */}
          {rivalries.length > 0 && (
            <section className="mt-14">
              <SectionHead sub={`${rivalries.length} fixtures with a name of their own. Each has its own page, and every meeting is loggable like any other match.`}>
                The rivalries
              </SectionHead>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {rivalries.map(m => (
                  <li key={m.slug}>
                    <Link
                      href={`/matchups/${m.slug}`}
                      className="glass-pill flex items-baseline justify-between gap-3 rounded-lg px-3.5 py-2.5 transition-colors hover:text-ink"
                    >
                      <span className="text-[13.5px] font-bold text-ink-2">
                        {m.a.short} v {m.b.short}
                      </span>
                      {m.nickname && (
                        <span className="flex-shrink-0 text-[11px] font-semibold text-ink-3">
                          {m.nickname.replace(/^the /, '')}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── The club directory ───────────────────────────────────────── */}
          <section className="mt-14">
            <SectionHead
              sub={`Every club in every ${hub.label.toLowerCase()} league Scorebug covers. All of them are trackable, and any of them can sit in your Starting Lineup so their matches surface first.`}
            >
              {clubs} clubs, league by league
            </SectionHead>
            <ClubList leagues={leagues} />
          </section>

          {/* ── FAQ, visible and structured ──────────────────────────────
              The same block feeds FAQPage above. Rendering it visibly is not
              decoration: Google will not show an FAQ rich result for markup
              with no on-page counterpart, and an answer engine quoting text a
              reader cannot find is the failure mode to avoid. */}
          <section className="mt-14">
            <SectionHead>Common questions</SectionHead>
            <div className="mt-5 space-y-3">
              {hub.faqs.map(f => (
                <div key={f.q} className="glass-card rounded-2xl p-5">
                  <h3 className="text-[15px] font-black text-ink">{f.q}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <AppCta className="mt-14" line={`${clubs} clubs are waiting. Start with the one you actually support.`} />

          {hub.vanityHost && (
            <p className="mt-8 text-[13px] text-ink-3">
              This page is also at <span className="font-bold text-ink-2">{hub.vanityHost}</span>.
            </p>
          )}

          <nav
            aria-label="Related"
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-semibold text-ink-3"
          >
            <Link href="/leagues" className="hover:text-ink-2">All leagues</Link>
            <Link href="/matchups" className="hover:text-ink-2">All rivalries</Link>
            <Link href="/gear" className="hover:text-ink-2">Club pages</Link>
            <Link href="/pricing" className="hover:text-ink-2">Pricing</Link>
          </nav>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
