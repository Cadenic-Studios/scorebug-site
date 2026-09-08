import Link from 'next/link'
import { SITE } from '../config'
import {
  type SportHub, leaguesFor, clubsFor, rivalriesFor,
} from '../sports'
import { organizationSchema, applicationSchema, faqSchema, graph } from '../lib/seo'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav, AppCta } from './SiteChrome'

/**
 * The shared body of /hockey and /football.
 *
 * Two route files, one implementation: the routes exist as real folders rather
 * than a root-level `[sport]` dynamic segment on purpose. A dynamic segment at
 * the root of a site that already has /pricing, /shop, /gear, /news and four
 * legal pages is a shadowing hazard that a reader has to hold in their head
 * forever, and it buys nothing when the curated list is two entries long.
 *
 * See app/sports.ts for why these pages are directories rather than a second
 * telling of the league page, and app/config.ts VANITY_DOMAINS for what points
 * at them.
 */
export default function SportHubPage({ hub }: { hub: SportHub }) {
  const leagues = leaguesFor(hub)
  const clubs = clubsFor(hub)
  const rivalries = rivalriesFor(hub)
  const jsonLd = graph([
    organizationSchema([
      hub.label,
      ...leagues.map(l => l.full),
      ...leagues.map(l => `${l.full} scores`),
    ]),
    applicationSchema(
      'Scorebug',
      `Track live ${leagues.map(l => l.label).join(', ')} scores and log, grade and keep every `
      + `${hub.label.toLowerCase()} game you watch.`,
    ),
    faqSchema(hub.faqs),
  ])

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

          <h1 className="headline mt-5 text-3xl text-ink sm:text-4xl">{hub.h1}</h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">{hub.lede}</p>

          {/* ── The leagues in this sport ──────────────────────────────────
              First, because it is the answer to "does it cover mine". Each is
              a full card rather than a pill: at one to three leagues there is
              room to say what each one is, and the league page it links to is
              the deeper answer. */}
          <section className="mt-12">
            <h2 className="headline text-2xl text-ink sm:text-3xl">
              {leagues.length === 1
                ? `The ${hub.label.toLowerCase()} league Scorebug covers`
                : `The ${leagues.length} ${hub.label.toLowerCase()} leagues Scorebug covers`}
            </h2>
            {/* The grid is CONDITIONAL. Hockey has one league, and an
                unconditional `sm:grid-cols-2` pins that single card to half
                the width with a column of dead black beside it — the same
                orphaned-cell fault the app's Game Center deck had. One item
                gets a full-width row; two or more get the grid. */}
            <ul className={`mt-5 gap-3 ${leagues.length > 1 ? 'grid sm:grid-cols-2' : 'flex flex-col'}`}>
              {leagues.map(l => (
                <li key={l.id}>
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
                      <span className="text-[15px] font-black text-ink">{l.full}</span>
                    </span>
                    <span className="mt-2 block text-[13.5px] leading-relaxed text-ink-3">
                      Live {l.label} scores, and every finished game loggable back to 2002.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* ── What you can actually do ──────────────────────────────────── */}
          <section className="mt-12">
            <h2 className="headline text-2xl text-ink sm:text-3xl">
              What Scorebug does for {hub.label.toLowerCase()} fans
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {hub.points.map(p => (
                <div key={p.head} className="glass-card rounded-2xl p-5">
                  <h3 className="text-[15px] font-black text-ink">{p.head}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── The honest aside ───────────────────────────────────────────
              Only football carries one: "football" means two different sports
              depending on where the reader is, and a page that quietly assumes
              one of them wastes half the traffic the word brings. */}
          {hub.aside && (
            <aside className="glass-card mt-10 rounded-2xl p-6">
              <h2 className="text-[15.5px] font-black text-ink">{hub.aside.head}</h2>
              <p className="mt-2 max-w-[40rem] text-[14.5px] leading-relaxed text-ink-2">
                {hub.aside.body}
              </p>
              <Link
                href={hub.aside.href}
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-sb-blue hover:text-ink"
              >
                {hub.aside.cta}
                <span aria-hidden>›</span>
              </Link>
            </aside>
          )}

          {/* ── Named rivalries ───────────────────────────────────────────── */}
          {rivalries.length > 0 && (
            <section className="mt-12">
              <h2 className="headline text-2xl text-ink sm:text-3xl">
                The rivalries, game by game
              </h2>
              <p className="mt-3 max-w-[42rem] text-[15px] leading-relaxed text-ink-2">
                {rivalries.length} fixtures with a name of their own. Each has its own page, and
                every meeting is loggable like any other game.
              </p>
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

          {/* ── Club index ─────────────────────────────────────────────────
              Labelled for what it is. These are the gear pages, and calling
              the section "every club" while linking to a shop would be the
              kind of quiet mislabelling the affiliate rules exist to prevent.
              The heading names the destination, so the reader chooses. */}
          {clubs.length > 0 && (
            <section className="mt-12">
              <h2 className="headline text-2xl text-ink sm:text-3xl">
                All {clubs.length} clubs
              </h2>
              <p className="mt-3 max-w-[42rem] text-[15px] leading-relaxed text-ink-2">
                Every club is trackable in the app and can sit in your Starting Lineup. Each name
                below opens its club page here on the site, which carries the club&rsquo;s gear and
                ticket links alongside it.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {clubs.map(t => (
                  <li key={t.slug}>
                    <Link
                      href={`/gear/${t.slug}`}
                      className="glass-pill inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-bold text-ink-2 transition-colors hover:text-ink"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── FAQ, visible and structured ────────────────────────────────
              The same block feeds FAQPage above. Rendering it visibly is not
              decoration: Google will not show an FAQ rich result for markup
              that has no on-page counterpart, and an answer engine quoting a
              page it cannot see the text of is the failure mode to avoid. */}
          <section className="mt-12">
            <h2 className="headline text-2xl text-ink sm:text-3xl">Common questions</h2>
            <div className="mt-5 space-y-3">
              {hub.faqs.map(f => (
                <div key={f.q} className="glass-card rounded-2xl p-5">
                  <h3 className="text-[15px] font-black text-ink">{f.q}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <AppCta
            className="mt-12"
            line={`Start your ${hub.label.toLowerCase()} record with tonight's game.`}
          />

          {/* The vanity address, stated plainly. It is a real way to reach this
              page and printing it is how a short domain gets remembered — a
              domain nobody ever sees written down earns nothing. */}
          {hub.vanityHost && (
            <p className="mt-8 text-[13px] text-ink-3">
              This page is also at <span className="font-bold text-ink-2">{hub.vanityHost}</span>.
            </p>
          )}

          <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-semibold text-ink-3">
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
