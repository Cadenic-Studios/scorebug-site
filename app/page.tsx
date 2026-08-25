import Image from 'next/image'
import { FAQS } from './faqs'
import { androidCta, WEB_APP, PRICING, PRICE_NOTE, APP_LINKS } from './config'
import { LEAGUE_COUNT, TEAM_LEAGUE_COUNT } from './leagues'
import Waitlist from './components/Waitlist'
import { SiteHeader, SiteFooter, LaunchWebApp } from './components/SiteChrome'
import LeagueBar from './components/LeagueBar'
import Showcase from './components/Showcase'

/* ── Call-to-action cluster ───────────────────────────────────────────────────
   The web app is the primary action everywhere it appears: it is the only one
   that puts a visitor inside the product in one click, with no store, no
   install and no platform gate. The store buttons sit beside it in a visibly
   lower tier — outlined glass rather than enamel — so the hierarchy is legible
   before anyone reads a word. */

function PlayGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.6 2.4v19.2c0 .5.3.8.7.6l11-9.6c.4-.3.4-.9 0-1.2l-11-9.6c-.4-.2-.7 0-.7.6Z" fill="currentColor" opacity="0.95" />
      <path d="M17.6 9.3 15 11.6l2.6 2.3 3-2.6-3-2Z" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

function AppleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.8ZM14 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  )
}

/**
 * Secondary tier: the two native platforms.
 *
 * The Android button is NOT a store link while LAUNCH_STAGE is 'waitlist' —
 * see the note on `androidCta` in config.ts. It scrolls to the signup form
 * instead, because the listing it used to point at returns Google's 404 page.
 */
function StoreButtons({ className = '' }: { className?: string }) {
  const android = androidCta()
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <a
        href={android.href}
        className="glass-btn flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-ink-2 transition hover:text-ink active:scale-[0.98]"
      >
        <PlayGlyph />
        <span className="text-left leading-tight">
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-ink-3">{android.caption}</span>
          <span className="block text-[14px] font-bold">{android.label}</span>
        </span>
      </a>
      {/* Not a link: there is no iOS build to send anyone to yet. A dead App
          Store button is the single most common lie on an app landing page. */}
      <span className="glass-btn flex cursor-default items-center gap-2.5 rounded-xl px-4 py-2.5">
        <span className="text-ink-3"><AppleGlyph /></span>
        <span className="text-left leading-tight">
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-ink-3">Coming to</span>
          <span className="block text-[14px] font-bold text-ink-2">iOS</span>
        </span>
      </span>
    </div>
  )
}

/* ── Section furniture ────────────────────────────────────────────────────── */

function Kicker({ children, accent = '#F85149' }: { children: React.ReactNode; accent?: string }) {
  return (
    <p
      className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase"
      style={{ color: accent }}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      {children}
    </p>
  )
}

/**
 * One marquee feature: copy on one side, a showcased poster on the other.
 *
 * `items-center` keeps the copy vertically centred against a plate roughly
 * 1.4x its height on desktop. Below `lg` the two stack, copy first, so a phone
 * reads the promise before it sees the picture of it — and so the 3D tilt
 * never has to survive a narrow column.
 */
function FeatureRow({
  kicker, accent, title, body, bullets, src, alt, flip = false, aspect, objectPosition,
}: {
  kicker: string; accent: string; title: string; body: string
  bullets: string[]; src: string; alt: string; flip?: boolean
  /** Only set where the poster's baked headline duplicates the <h3> beside it.
   *  Left undefined the plate shows the full artwork, which is the default and
   *  the right answer for a poster whose headline differs from the heading. */
  aspect?: string; objectPosition?: string
}) {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : ''}>
        <Kicker accent={accent}>{kicker}</Kicker>
        {/* One rhythm for the whole page: kicker→heading 20px, heading→body
            20px, body→bullets 24px. These three pairs used to be mt-4/mt-4/mt-5
            here and different numbers again in the gold and FAQ blocks, which
            is why the headings read as clotted no matter the type size. */}
        <h3 className="headline mt-5 text-4xl text-ink sm:text-5xl">{title}</h3>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2">{body}</p>
        {/* max-w-md matches the paragraph above it. Without it the bullets set
            to the column width and rag past the paragraph's right edge, which
            reads as two different text blocks rather than one. */}
        <ul className="mt-6 max-w-md space-y-2.5">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ink-2">
              <span aria-hidden className="mt-[7px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 7px ${accent}` }} />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={`flex justify-center ${flip ? 'lg:order-1' : ''}`}>
        <Showcase
          src={src}
          alt={alt}
          accent={accent}
          tilt={flip ? 'left' : 'right'}
          aspect={aspect}
          objectPosition={objectPosition}
          className="w-full max-w-[300px] sm:max-w-[360px]"
          sizes="(max-width: 1023px) 78vw, 360px"
        />
      </div>
    </div>
  )
}

/** Compact card for the closing three-up. The poster is cropped to 4:5 so
 *  three 9:16 plates do not stack into a 2,400px wall on a phone. */
function FeatureCard({
  kicker, accent, title, body, src, alt,
}: {
  kicker: string; accent: string; title: string; body: string; src: string; alt: string
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-6 pb-7">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(85% 45% at 50% 0%, ${accent}1F 0%, transparent 62%)` }}
      />
      <div className="relative">
        {/* objectPosition pins the 4:5 crop to the BOTTOM of the poster. These
            three plates are campaign artwork: logo lockup and a baked headline
            up top, product UI underneath. Cropping from the top (the default)
            showed the marketing, not the app. */}
        <Showcase src={src} alt={alt} accent={accent} tilt="flat" aspect="4 / 5" objectPosition="50% 100%" sizes="(max-width: 639px) 80vw, (max-width: 1023px) 42vw, 30vw" />
        <p className="mt-8 text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{kicker}</p>
        <h3 className="headline headline-sm mt-1.5 text-3xl text-ink">{title}</h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    // header / main / footer are SIBLINGS. Nested inside <main>, a <header>
    // maps to a generic group rather than role="banner" and a <footer> to
    // generic rather than role="contentinfo", so the page would expose no
    // banner or contentinfo landmark at all.
    <>
      <SiteHeader />

      <main>
        {/* ══ Hero ══ */}
        <section className="lit-red floodlights relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-10 lg:grid-cols-[1fr_auto] lg:pt-14">
            <div className="relative z-10">
              {/* The kicker used to read "Chronicle your sports", which is the
                  <h1> again in different clothes. A kicker sitting two lines
                  above the headline has to earn its space with a fact. */}
              <Kicker>Now live on the web</Kicker>
              {/* headline-display only here: the negative tracking is an optical
                  correction that is real at 83px and closes Anton's counters at
                  anything smaller. 28px of air under the kicker, not 20, because
                  the cap height below it is three times taller. */}
              <h1 className="headline headline-display mt-7 text-[3.6rem] text-white sm:text-[4.6rem] lg:text-[5.2rem]">
                Chronicle
                <br />
                every game.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
                A sports logbook for the games you actually watch. Grade each one out of 5.0,
                write the take, and keep the record for good.
              </p>

              <div className="mt-9">
                <LaunchWebApp />
                <p className="mt-2.5 text-[12.5px] text-ink-3">No install. The full app runs in your browser.</p>
              </div>

              <div className="mt-6">
                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">
                  Or get it on mobile
                </p>
                <StoreButtons />
              </div>

              <p className="mt-6 text-[13px] text-ink-3">Free to use · {LEAGUE_COUNT} leagues · logs back to 2002</p>
            </div>

            {/* ── League bar ──────────────────────────────────────────────
                DOM order is copy -> leagues -> artwork, and the lg placement
                then puts it back under BOTH columns.

                It has to be in this position in the markup because on a phone
                the hero stacks in DOM order, and with the bar after the grid it
                landed 1,105px down — a full screen below the fold, behind the
                artwork. "Which leagues" is the first question a visitor has, so
                it must beat the picture to the reader.

                On lg it is explicitly placed at row 2 spanning both tracks,
                which is why the artwork below carries an explicit row 1 / col 2:
                once one grid item is placed by hand, leaving its siblings on
                auto-placement is how you get items stacked in the same cell. */}
            <div className="relative z-10 min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-2">
              <LeagueBar />
            </div>

            <div className="flex justify-center lg:col-start-2 lg:row-start-1 lg:justify-end">
              <Showcase
                src="/shots/hero.png"
                alt="A game rating dial set to 4.0 out of 5 with half-step buttons and viewing options, beside a Vault of logged games and their grades."
                accent="#F85149"
                tilt="right"
                priority
                // DEVICE-ONLY ARTWORK, deliberately. Every other plate on this
                // page is a campaign poster whose headline differs from the
                // heading beside it, so the two read as caption and title. The
                // hero is the one place they would be the SAME words, so its
                // image carries no lockup at all.
                width={1440}
                height={1645}
                //
                // ── WHY THIS CROP IS NOT NEGOTIABLE ──────────────────────────
                // hero.png has "Weshington Commanders" MISSPELLED, baked into
                // the pixels of the left phone's matchup card, at y≈467-513 of
                // the 1440x1645 source. It cannot be fixed in CSS and it was
                // sitting above the fold. Until the artwork is re-rendered, the
                // frame starts BELOW that card.
                //
                // 1440/1030 is the widest-possible vertical crop: object-cover
                // only crops the axis the container is longer on, so any ratio
                // wider than the source's 1440/1645 trims top and bottom and
                // nothing else. 1030 leaves exactly 615px to cut, and
                // objectPosition 100% spends all 615 off the TOP — landing the
                // cut at y=615, in the gap between the misspelled card (ends
                // y≈612) and the GAME RATING panel (starts y≈648).
                //
                // Both handsets keep their side rails, bottom bezels and floor
                // reflection, so they still read as phones rather than as flat
                // screenshots. Do not raise 1030 without re-checking y=615:
                // 1125 puts the "Weshington" label back on the page.
                aspect="1440 / 1030"
                objectPosition="50% 100%"
                // Wider than the old portrait plate because the frame is now
                // landscape; at max-w-[470px] it rendered only 336px tall and
                // lost the hero.
                className="w-full max-w-[420px] sm:max-w-[520px]"
                sizes="(max-width: 1023px) 86vw, 520px"
              />
            </div>
          </div>
        </section>

        {/* ══ The hook ══ */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h2 className="headline text-4xl text-ink sm:text-5xl">What you watched, on the record.</h2>
          {/* max-w-[36rem], NOT the section's max-w-3xl. Centred 17px copy across
              48rem sets ~90 characters a line; the eye loses the return sweep
              past about 75. The section stays 3xl so the heading can run wider
              than the paragraph under it. */}
          <p className="mx-auto mt-5 max-w-[36rem] text-[17px] leading-relaxed text-ink-2">
            Scorebug is a sports logbook app. A game goes final, you grade it out of 5.0 and
            write what you thought, and it stays in your personal sports vault. Live scores run
            across {LEAGUE_COUNT} leagues, and you can log finals back to the 2002 season.
          </p>
        </section>

        {/* ══ Marquee features ══ */}
        {/* No top padding, on purpose. Every other seam on this page is 192px
            (two py-24 sections meeting); this one is 96px because the hook
            above is the sentence these three rows are the evidence for, and a
            full seam breaks that into two unrelated thoughts. */}
        <section className="mx-auto flex max-w-6xl flex-col gap-28 px-5 pb-24" id="features">
          {/* Visually hidden: the rows below are h3s and need an h2 to belong to. */}
          <h2 className="sr-only">What Scorebug does</h2>

          <FeatureRow
            kicker="The core loop"
            accent="#F85149"
            title="Rate & chronicle"
            body="Once a game is final, you grade it and say why. The rating, the note and the photos all attach to that one game and stay attached."
            bullets={[
              'A goal-light dial, 1.0 to 5.0, in half-point steps',
              'Record how you watched: broadcast, at the venue, out watching, or a watch party',
              'Photos and ticket stubs stay private to your Vault, always',
              'Choose per game whether your rating and review go public',
            ]}
            src="/shots/chronicle.png"
            alt="The Rate & Chronicle screen: a goal-light dial set to 4.0 out of 5, viewing-perspective options, and a private notes field."
          />

          <FeatureRow
            flip
            kicker="Live scores · every league"
            accent="#2DD4BF"
            title="The Slate"
            body="Every game on today's card across your leagues, with scores that update while you watch. When one goes final you log it from the same card, so tracking and logging are the same motion."
            bullets={[
              'NHL, NFL, NBA, MLB, CFL, college football and men’s college basketball',
              'MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League',
              'Formula 1 race schedules, status and podiums',
              'Scores refresh on their own while games are in progress',
            ]}
            src="/shots/slate.png"
            alt="The Slate: a day of finals across leagues, each matchup card washed in both teams' colours with a Log this game action."
          />

          <FeatureRow
            kicker="Everything you've logged"
            accent="#58A6FF"
            title="The Vault"
            body="Your personal sports vault: every game you have logged, the grade you gave it and the note you wrote, with your running average on top. It is the record of what you actually watched, season after season."
            bullets={[
              'Every game you have ever logged, with no time limit',
              'Sort by most recent, highest-rated or lowest-rated',
              'The Time Machine logs finished games back to the 2002 season',
              'Filter by league, or search your own notes',
            ]}
            src="/shots/vault.png"
            alt="The Scorebug home screen with the calendar and an upcoming Docket, beside the Rate and Chronicle screen part-way through a grade."
            // The ONE poster whose baked headline is word for word the copy
            // beside it. 1440/1750 against a 1440x2559 source cuts 809px off
            // the top (objectPosition 100% spends the whole overflow there),
            // which is exactly the lockup and the headline. Same treatment the
            // hero and the Front Office plate already get.
            aspect="1440 / 1750"
            objectPosition="50% 100%"
          />
        </section>

        {/* ══ Three-up ══ */}
        <section className="lit-blue">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <div className="text-center">
              <Kicker accent="#58A6FF">Also in the app</Kicker>
              <h2 className="headline mx-auto mt-5 max-w-2xl text-4xl text-ink sm:text-5xl">
                The rest of the ballpark.
              </h2>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                kicker="The news desk"
                accent="#D29922"
                title="The Wire"
                body="Headlines from the leagues you follow, with a tab for each one. Pin a team to My Wire, or let it track your Starting Lineup on its own."
                src="/shots/wire.png"
                alt="The Wire: a news feed filtered to the teams you follow, with a tab for each league."
              />
              <FeatureCard
                kicker="The social layer"
                accent="#F85149"
                title="The Bleachers"
                // The Discord line that used to live here is gone deliberately.
                // It claimed server-matched fan discovery, which the app does
                // not do. Everything left is on screen in bleachers.png.
                body="Ratings and written takes from everyone else who watched. Pick your sections on the seat map, and post your own review when you want it seen."
                src="/shots/bleachers.png"
                alt="The Bleachers: a stadium seat-picker for choosing sport sections, above community takes on a finished game."
              />
              <FeatureCard
                kicker="Your teams"
                accent="#3FB950"
                title="The Franchise"
                body={`Your Starting Lineup holds up to 5 teams across the ${TEAM_LEAGUE_COUNT} team leagues, or 25 with a Front Office membership. Scorebug keeps their combined win-loss-tie record for the season.`}
                src="/shots/franchise.png"
                alt="The Franchise: your teams' combined win-loss-tie record for the season, with recent results beneath."
              />
            </div>
          </div>
        </section>

        {/* ══ The Front Office (gold) ══ */}
        <section className="lit-gold floodlights relative overflow-hidden border-y border-white/10">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <Kicker accent="#E5B53C">Membership</Kicker>
              <h2 className="headline mt-5 text-4xl sm:text-5xl" style={{ color: '#F4E3B0' }}>
                Inside the
                <br />
                Front Office.
              </h2>
              {/* One statement of what it is, once. This paragraph used to sell
                  the same thing three times in three lines (Unlock / Go deeper /
                  Elevate), which is how you make a real product sound invented. */}
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2">
                The Front Office is a subscription bought inside the Scorebug Android app. It
                lifts the free tier&rsquo;s caps and opens the Analytics Desk.
              </p>

              <ul className="mt-6 max-w-md space-y-2.5">
                {[
                  ['The Analytics Desk', 'Season-over-season trends, rivalry splits by opponent, and your attendance ledger.'],
                  ['Extended lineup', 'Your Starting Lineup goes from 5 teams to 25.'],
                  ['Unlimited Docket and Clippings', 'The 25-game Docket cap and the 10-story Clippings cap both come off.'],
                  ['Vault export', 'Every game, rating and note you have written, as CSV or JSON.'],
                  ['Accent themes', '20 of them, and each one recolours the whole app.'],
                  ['No ads', 'Banners and rewarded prompts stop the moment you subscribe.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black" style={{ background: 'rgba(229,181,60,0.18)', color: '#E5B53C', border: '1px solid rgba(229,181,60,0.42)' }}>◆</span>
                    <span className="text-[14.5px] leading-snug text-ink-2">
                      {/* Colon, not an em dash. "**Term** — definition" six
                          times in a row is the most recognisable machine-written
                          list shape there is; the colon reads as a spec sheet. */}
                      <span className="font-bold" style={{ color: '#F4E3B0' }}>{t}</span>: {d}
                    </span>
                  </li>
                ))}
              </ul>

              <a href={WEB_APP} className="enamel-gold mt-8 inline-block rounded-full px-7 py-3 text-[15px] font-black transition active:scale-95">
                Open Scorebug and see the plans →
              </a>
              <p className="mt-3 max-w-md text-[12px] leading-relaxed text-ink-3">
                {PRICING.us.monthly} {PRICING.us.currency}/month or {PRICING.us.yearly}{' '}
                {PRICING.us.currency}/year. In Canada, {PRICING.ca.monthly} {PRICING.ca.currency}/month
                or {PRICING.ca.yearly} {PRICING.ca.currency}/year. That is about{' '}
                {PRICING.perMonthEquivalent} a month either way. {PRICE_NOTE} Android at launch.
              </p>
            </div>

            <div className="flex justify-center">
              <Showcase
                src="/shots/front-office.png"
                alt="The Front Office: a gold-framed membership screen listing the Analytics Desk, extended lineup, unlimited Docket and Clippings, and an app with no ads."
                accent="#E5B53C"
                tilt="right"
                // Cropped past the lockup: this poster's headline is word for
                // word the <h2> beside it, and the same sentence set twice a
                // few inches apart reads as a mistake rather than emphasis.
                aspect="1080 / 1250"
                objectPosition="50% 93%"
                className="w-full max-w-[320px] sm:max-w-[400px]"
                sizes="(max-width: 1023px) 80vw, 400px"
              />
            </div>
          </div>
        </section>

        {/* ══ Android waitlist ══
            Sits ABOVE the FAQ, not below it. Every Android CTA on the page
            (nav, hero, footer) targets #waitlist, and a scroll target that
            lands past the FAQ makes those buttons feel like they overshot. */}
        <section id="waitlist" className="scroll-mt-8 px-5 py-24">
          <Waitlist />
        </section>

        {/* ══ FAQ ══ */}
        <section className="mx-auto max-w-3xl px-5 py-24" id="faq">
          {/* The kicker used to say "Questions" above a heading that says
              "Frequently asked" — the same word twice. It carries a fact now. */}
          <Kicker accent="#58A6FF">Checked against the app</Kicker>
          <h2 className="headline mt-5 text-4xl text-ink sm:text-5xl">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map(f => (
              <details key={f.q} className="faq glass-card group rounded-2xl">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-ink">
                  {f.q}
                  <span className="faq-chevron text-sb-red transition-transform" aria-hidden>›</span>
                </summary>
                {/* Capped at 33rem: the accordion is 48rem wide and these
                    answers were setting ~96 characters a line, which is well
                    past the point where the eye finds the next line reliably. */}
                <p className="max-w-[33rem] px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ══ Final CTA — mirrors the hero's hierarchy for anyone who scrolled ══ */}
        <section className="lit-red floodlights relative overflow-hidden px-5 pb-28 pt-24">
          <div className="glass-card relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-16 text-center">
            <span aria-hidden className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(80% 90% at 50% -30%, rgba(248,81,73,0.22) 0%, transparent 65%)' }} />
            <div className="relative">
              <h2 className="headline mx-auto max-w-2xl text-4xl text-ink sm:text-5xl">
                The Vault starts empty.
              </h2>
              <div className="mt-9 flex justify-center">
                <LaunchWebApp />
              </div>
              <p className="mt-2.5 text-[12.5px] text-ink-3">Opens in your browser. Nothing to install.</p>
              <StoreButtons className="mt-7 justify-center" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
