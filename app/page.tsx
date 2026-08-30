import Image from 'next/image'
import Link from 'next/link'
import { FAQS } from './faqs'
import { androidCta, WEB_APP, PRICING, PRICE_NOTE, APP_LINKS } from './config'
import { LEAGUE_COUNT, TEAM_LEAGUE_COUNT } from './leagues'
import { GEAR_TEAM_COUNT } from './lib/teams'
import HomeRevenue from './components/HomeRevenue'
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
  kicker, accent, title, body, src, alt, objectPosition = '50% 100%',
}: {
  kicker: string; accent: string; title: string; body: string; src: string; alt: string
  /** Where the 4:5 crop sits on the poster. Defaults to the BOTTOM, which is
   *  right for the AI campaign plates (lockup on top, product UI underneath).
   *  A real screenshot plate has the phone centred with dark margin above and
   *  below instead, so pinning it to the bottom cuts the top third of the
   *  handset off — those slots pass '50% 50%'. */
  objectPosition?: string
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
        <Showcase src={src} alt={alt} accent={accent} tilt="flat" aspect="4 / 5" objectPosition={objectPosition} sizes="(max-width: 639px) 80vw, (max-width: 1023px) 42vw, 30vw" />
        <p className="mt-8 text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{kicker}</p>
        <h3 className="headline headline-sm mt-1.5 text-3xl text-ink">{title}</h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function Home() {
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
          {/* ── THE SPLIT IS `xl`, NOT `lg`. ───────────────────────────────
              It was `lg`, so the two-column hero engaged at 1024px — which is
              exactly an iPad Pro in portrait, and the inner screen of a folded
              phone. At that width the artwork column takes its ~500px and the
              copy column is left with ~428px, while the headline is still being
              set at lg:text-[5.2rem]. Anton at 83px in a 428px column wraps
              "Your life as a fan. On the record." onto FOUR ragged lines
              ("YOUR LIFE AS / A FAN. / ON THE / RECORD.") and pushes the CTA
              most of a screen down. Nothing overflowed, which is why it never
              tripped an overflow check — it just looked broken.

              Holding one column until 1280 gives those viewports the full-width
              headline they already get at 900px, where the same copy sets
              cleanly. The trade is a taller hero on a portrait tablet, which is
              the correct trade on a screen that is mostly height. */}
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-10 xl:grid-cols-[1fr_auto] xl:pt-14">
            <div className="relative z-10">
              {/* The kicker used to read "Chronicle your sports", which is the
                  <h1> again in different clothes. A kicker sitting two lines
                  above the headline has to earn its space with a fact. */}
              <Kicker>Now live on the web</Kicker>
              {/* headline-display only here: the negative tracking is an optical
                  correction that is real at 83px and closes Anton's counters at
                  anything smaller. 28px of air under the kicker, not 20, because
                  the cap height below it is three times taller. */}
              {/* ── NO HARD <br/>, AND `text-balance` INSTEAD. ───────────────
                  The hard break used to sit after "fan." That worked for the old
                  two-word headline and breaks this one: the copy column is
                  556px at desktop (max-w-6xl minus the 500px artwork and the
                  gap), and "YOUR LIFE AS A FAN." needs ~984px at 83px Anton. So
                  it wrapped on its own and left "FAN." orphaned on a line by
                  itself, with "ON THE RECORD." under it.

                  Hand-tuning breaks per width does not survive: a break that
                  fixes 1440 orphans something else at 1024 or 390, because the
                  type steps three times and the column width changes twice.
                  `text-wrap: balance` lets the browser even out the lines at
                  whatever width it actually gets, which is the one rule that
                  holds at every breakpoint. Where it is unsupported the text
                  simply wraps normally, which is where we already were. */}
              <h1 className="headline headline-display mt-7 text-balance text-[3.6rem] text-white sm:text-[4.6rem] lg:text-[5.2rem]">
                Your life as a fan. On the record.
              </h1>
              {/* CONCRETE, not grand. The temptation in a hero like this is
                  "immortalise your legacy" — abstract, interchangeable, and the
                  exact register that got stripped from this page once already
                  for reading as machine-written. Three specific nights a real
                  fan recognises do the emotional work that adjectives cannot,
                  and the promise underneath them stays factual. */}
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
                The overtime winner. The one you drove six hours for. The collapse you
                still will not talk about. Grade every game out of 5.0, say what it meant,
                and keep it for good.
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

              {/* ── WHO BUILT IT, SAID EARLY ────────────────────────────────
                  The footer already carries "Made in Canada", but a line at the
                  bottom of a long page is a legal detail, not a reason to
                  trust the thing. Said here — in the hero, under the CTAs — it
                  is part of the pitch. The maple leaf is the only emoji on this
                  page and it earns its place: it is the fastest way to say
                  "Canadian" at 13px without a sentence.

                  Kept to one line on purpose. This is a sports logbook, not a
                  heritage brand, and a paragraph about provenance above the
                  fold would push the product below it. */}
              {/* IT IS A PANEL, NOT A LINE. The first version set this at 13px/ink-3,
                  which is character-for-character the same treatment as the
                  "Free to use · 19 leagues" fine print directly above it — so it
                  read as a second line of legal small print rather than as a
                  statement. Provenance either earns its own surface or it is not
                  worth saying. The border and tint are the whole treatment, and
                  it stays ONE sentence: this is a sports logbook, not a heritage
                  brand, and a paragraph about provenance above the fold pushes
                  the product below it. */}
              <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3">
                <span aria-hidden className="text-[20px] leading-none">🇨🇦</span>
                <p className="text-[14.5px] font-semibold leading-snug text-ink">
                  Built with a love of the game in Canada, by Canadians.
                </p>
              </div>
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
            <div className="relative z-10 min-w-0 xl:col-span-2 xl:col-start-1 xl:row-start-2">
              <LeagueBar />
            </div>

            <div className="flex justify-center xl:col-start-2 xl:row-start-1 xl:justify-end">
              <Showcase
                src="/shots/hero.png"
                alt="Two phones running Scorebug: Home with The Docket of upcoming games, and The Slate showing live scores across the leagues."
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
                // ── THE CROP THAT USED TO BE HERE IS GONE ────────────────────
                // This slot carried aspect="1440 / 1030" + objectPosition
                // "50% 100%" for one reason: the old AI-rendered hero.png had
                // "Weshington Commanders" misspelled into the pixels of the
                // left phone's matchup card, above the fold, and the crop
                // started the frame below it.
                //
                // hero.png is now a real screenshot of the running app
                // (scripts/capture-shots.mjs), so every word in it is rendered
                // by the product and cannot be misspelled. The full plate shows
                // again — both handsets, complete with bezels and reflection.
                className="w-full max-w-[420px] sm:max-w-[500px]"
                sizes="(max-width: 1023px) 86vw, 520px"
              />
            </div>
          </div>
        </section>

        {/* ══ The hook ══ */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h2 className="headline text-4xl text-ink sm:text-5xl">You were there. Prove it.</h2>
          {/* max-w-[36rem], NOT the section's max-w-3xl. Centred 17px copy across
              48rem sets ~90 characters a line; the eye loses the return sweep
              past about 75. The section stays 3xl so the heading can run wider
              than the paragraph under it. */}
          <p className="mx-auto mt-5 max-w-[36rem] text-[17px] leading-relaxed text-ink-2">
            You have watched thousands of games and remember a handful. Scorebug keeps the
            rest. The final whistle goes, you grade it out of 5.0 and write what you thought,
            and it stays in your vault for good. Live scores run across {LEAGUE_COUNT} leagues,
            and you can go back and log finals as far as the 2002 season.
          </p>
        </section>

        {/* ══ The line in the sand ══
            Placed HERE — directly after "You were there. Prove it." and before
            the feature rows — because it is a promise about the product, not a
            feature of it. Below the features it would read as one more bullet;
            above them it frames everything that follows.

            Deliberately plain: no icon, no card grid, no gradient. Every other
            block on this page is selling something. This one is a statement,
            and dressing it up in the same marketing furniture as the rest would
            make it sound like marketing. The border and the flat panel are the
            whole treatment.

            The wording is absolute on purpose. "We don't currently show
            gambling ads" is a position that can quietly change; "there isn't
            any, and there never will be" is a commitment a visitor can hold us
            to — which is the entire point of saying it. */}
        <section className="mx-auto max-w-3xl px-5 pb-24">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center sm:px-10">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-ink-3">
              Where we stand
            </p>
            <h2 className="headline mt-4 text-3xl text-ink sm:text-4xl">
              Zero gambling ads. Zero sports betting.
            </h2>
            <p className="mx-auto mt-5 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
              There isn&rsquo;t any, and there never will be. No odds, no spreads, no
              &ldquo;get $200 in bonus bets&rdquo;, no sportsbook logo in the corner of a
              scoreboard. Just you and the game.
            </p>
          </div>
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
            body="The whistle goes and the feeling starts fading. Grade it while it is still raw, write what you actually thought, and pin the ticket stub to it. Years later that is the difference between a score you can look up and a night you can relive."
            bullets={[
              'A goal-light dial, 1.0 to 5.0, in half-points, because a 4 and a 4.5 were not the same night',
              'Say how you were there: on the couch, in the building, out watching, or hosting the watch party',
              'Ticket stubs and photos stay private to your Vault. Always, and by default',
              'Ratings and reviews start public so other fans can find them, with a per-game switch to keep any one to yourself',
            ]}
            src="/shots/chronicle.png"
            alt="The Log in Scorebug: finished games ready to chronicle, each with its final score and a Log this game button."
          />

          <FeatureRow
            flip
            kicker="Your command centre"
            accent="#2DD4BF"
            title="The Slate"
            body="Stop running four apps and a group chat on game night. Every match on today's card, across every league you care about, on one screen. The second one goes final, you log it from the same card you were watching it on."
            /* THE WHOLE CATALOGUE. These bullets were written before the
               Chinese Super League, the Indian Super League, J.League and the
               IPL were added and never updated, so the one place on the page
               that enumerates coverage told a fan in Mumbai or Shanghai that
               their league was not here. Soccer and cricket now get their own
               line rather than being appended to an already-long one. */
            bullets={[
              'NHL, NFL, NBA, MLB, CFL, college football and men’s college basketball',
              'MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League',
              'The Chinese Super League, the Indian Super League and Japan’s J1 League',
              'Cricket: the Indian Premier League, with full scorelines',
              'Formula 1 race schedules, status and podiums',
              'Scores move on their own while the game is live. No pull to refresh, no reload',
            ]}
            src="/shots/slate.png"
            alt="The Slate: a day of finals across leagues, each matchup card washed in both teams' colours with a Log this game action."
          />

          <FeatureRow
            kicker="Your trophy room"
            accent="#58A6FF"
            title="The Vault"
            body="The shoebox of ticket stubs, except you can actually find things in it. Every game you have graded, every note you wrote, every stub you photographed, in one room with your running average over the door."
            bullets={[
              'Every game you have ever logged. No time limit, no archiving, nothing expires',
              'Sort by most recent, highest-rated or lowest-rated, so your best night is one tap away',
              'The Time Machine reaches back to the 2002 season, so your history starts long before the app did',
              'Filter by league, or search your own notes for the game you half-remember',
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
                // Centre, not the default bottom: wire.png is now a real
                // screenshot of The Wire framed in a handset, not a campaign
                // poster with a lockup on top.
                objectPosition="50% 50%"
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

        {/* == The Scorebug Network -- commerce, elevated ====================
            Moved up from position 8 (below the FAQ, where most sessions never
            reach). It sits AFTER the product features and not under the hero
            on purpose: this site converts on app users, not merch, and a
            commerce wall above the value props reframes the page as a store.
            It is also what makes the subdeck honest -- "more than an app"
            only lands for someone who has just been shown the app.
            Absorbed the old "Also on Scorebug" block; see HomeRevenue.tsx. */}
        <HomeRevenue />

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
        {/* LIT, like every other full-bleed band on this page. A sign-up form
            is a 512px card by nature, so at desktop width this section was a
            ~1700px-wide stripe of flat ground with a small object floating in
            the middle of it — the single largest patch of dead black on the
            page. It does not need more content; it needs to look like part of
            the same room as the sections above and below it, which is exactly
            what `.lit-*` is for. */}
        <section id="waitlist" className="lit-blue scroll-mt-8 px-5 py-24">
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
