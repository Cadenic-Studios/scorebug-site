import Image from 'next/image'
import { FAQS } from './faqs'
import { androidCta, WEB_APP, PRICING, PRICE_NOTE, APP_LINKS } from './config'
import Waitlist from './components/Waitlist'
import Showcase from './components/Showcase'

/* ── Call-to-action cluster ───────────────────────────────────────────────────
   The web app is the primary action everywhere it appears: it is the only one
   that puts a visitor inside the product in one click, with no store, no
   install and no platform gate. The store buttons sit beside it in a visibly
   lower tier — outlined glass rather than enamel — so the hierarchy is legible
   before anyone reads a word. */

function LaunchWebApp({ size = 'lg', className = '' }: { size?: 'lg' | 'md'; className?: string }) {
  const lg = size === 'lg'
  return (
    <a
      href={WEB_APP}
      className={`enamel-red inline-flex items-center gap-3 whitespace-nowrap rounded-2xl font-black text-white transition active:scale-[0.98] ${
        lg ? 'px-7 py-4 text-[17px]' : 'px-5 py-3 text-[14px]'
      } ${className}`}
    >
      <svg width={lg ? 20 : 17} height={lg ? 20 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18" />
      </svg>
      Launch Web App
      <span aria-hidden className="text-[1.1em] leading-none opacity-80">›</span>
    </a>
  )
}

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
  kicker, accent, title, body, bullets, src, alt, flip = false,
}: {
  kicker: string; accent: string; title: string; body: string
  bullets: string[]; src: string; alt: string; flip?: boolean
}) {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? 'lg:order-2' : ''}>
        <Kicker accent={accent}>{kicker}</Kicker>
        <h3 className="headline mt-4 text-4xl text-ink sm:text-5xl">{title}</h3>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">{body}</p>
        <ul className="mt-5 space-y-2.5">
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
        <Showcase src={src} alt={alt} accent={accent} tilt="flat" aspect="4 / 5" sizes="(max-width: 639px) 80vw, (max-width: 1023px) 42vw, 30vw" />
        <p className="mt-8 text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{kicker}</p>
        <h3 className="headline mt-1.5 text-3xl text-ink">{title}</h3>
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
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <a href="/" aria-label="Scorebug home" className="flex min-w-0 items-center gap-2.5">
          <Image src="/app-icon.png" alt="" width={36} height={36} className="rounded-[9px]" priority />
          {/* Icon only below sm. The wordmark and a full-width "Launch Web App"
              cannot both fit a 360px bar, and a truncated "SCORE…" is worse
              than no wordmark beside a logo that already says it. */}
          <span className="headline hidden text-2xl text-ink sm:inline">Scorebug</span>
        </a>
        <nav aria-label="Primary" className="flex flex-shrink-0 items-center gap-2.5">
          <a href={androidCta().href} className="glass-btn hidden rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 transition hover:text-ink sm:inline-block">
            {androidCta().label}
          </a>
          <LaunchWebApp size="md" />
        </nav>
      </header>

      <main>
        {/* ══ Hero ══ */}
        <section className="lit-red floodlights relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-10 lg:grid-cols-[1fr_auto] lg:pb-24 lg:pt-14">
            <div className="relative z-10">
              <Kicker>Chronicle your sports</Kicker>
              <h1 className="headline mt-5 text-[3.6rem] text-white sm:text-[4.6rem] lg:text-[5.2rem]">
                Chronicle
                <br />
                every game.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
                The ultimate fan log. Track live scores, rate matchups, and save your record.
              </p>

              <div className="mt-9">
                <LaunchWebApp />
                <p className="mt-2.5 text-[12.5px] text-ink-3">No install — start logging in your browser.</p>
              </div>

              <div className="mt-6">
                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">
                  Or get it on mobile
                </p>
                <StoreButtons />
              </div>

              <p className="mt-6 text-[13px] text-ink-3">Free to use · 15 leagues · back to 2002</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <Showcase
                src="/shots/hero.png"
                alt="The Scorebug app rating a Dolphins–Commanders final 4.0 out of 5, beside a Vault of previously logged games."
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
                // Cut from the chronicle artwork, below its lockup — the <h1>
                // beside it already says "Chronicle every game." Framed as an
                // aspect box so a future replacement is cropped, not squashed.
                aspect="1440 / 1645"
                objectPosition="50% 50%"
                className="w-full max-w-[380px] sm:max-w-[470px]"
                sizes="(max-width: 1023px) 84vw, 470px"
              />
            </div>
          </div>
        </section>

        {/* ══ The hook ══ */}
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h2 className="headline text-4xl text-ink sm:text-5xl">Your sports. Your record.</h2>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            Welcome to Scorebug, the ultimate journal for the dedicated sports fan. Stop just
            checking the box scores and letting incredible sports moments fade away. Scorebug
            is built to let you track live action, read breaking news, and log every game you
            watch — building a permanent archive of your lifetime in sports.
          </p>
        </section>

        {/* ══ Marquee features ══ */}
        <section className="mx-auto flex max-w-6xl flex-col gap-28 px-5 pb-28" id="features">
          {/* Visually hidden: the rows below are h3s and need an h2 to belong to. */}
          <h2 className="sr-only">What Scorebug does</h2>

          <FeatureRow
            kicker="The core loop"
            accent="#F85149"
            title="Rate & chronicle"
            body="Watched a legendary game? Once it's final, log it. Give the matchup a rating out of 5.0, write your personal takes, and add your own photos to keep the night exactly as you remember it."
            bullets={[
              'A goal-light rating in half-point steps, from 1.0 to 5.0',
              'Record how you watched — broadcast, at the venue, out watching, or a watch party',
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
            body="Your customized schedule. Live scores and game status across 15 leagues, so you can track the action and easily find the games you want to log."
            bullets={[
              'NHL, NFL, NBA, MLB, CFL, college football and men’s college basketball',
              'MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League',
              'Formula 1 race schedules, status and podiums',
              'Scores refresh on their own while games are in progress',
            ]}
            src="/shots/slate.png"
            alt="The Slate: a day of finals across leagues, each matchup card washed in both clubs' colours with a Log this game action."
          />

          <FeatureRow
            kicker="Your lifetime archive"
            accent="#58A6FF"
            title="The Vault"
            body="Your lifetime fan archive. Look back at your entire history of logged games, your average grade, and the notes you wrote — then sort the whole thing to relive the best games, and the ones you'd rather forget."
            bullets={[
              'Every game you have ever logged, with no time limit',
              'Sort by most recent, highest-rated or lowest-rated',
              'The Time Machine reaches back to 2002, so old classics still count',
              'Filter by league, or search your own notes',
            ]}
            src="/shots/vault.png"
            alt="The Vault: lifetime tiles for games logged, average grade and win rate, above a scrollable history of chronicled games."
          />
        </section>

        {/* ══ Three-up ══ */}
        <section className="lit-blue">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <div className="text-center">
              <Kicker accent="#58A6FF">And the rest of the ballpark</Kicker>
              <h2 className="headline mx-auto mt-4 max-w-2xl text-4xl text-ink sm:text-5xl">
                Context, community, and your clubs
              </h2>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                kicker="The news desk"
                accent="#D29922"
                title="The Wire"
                body="A dedicated sports news desk that builds itself around your teams. Pin a club or a league to My Wire, or let it follow your Starting Lineup automatically — with a tab for every league you follow."
                src="/shots/wire.png"
                alt="The Wire: a news feed filtered to the teams you follow, with a tab for each league."
              />
              <FeatureCard
                kicker="The social layer"
                accent="#F85149"
                title="The Bleachers"
                body="Read the room. Browse community reviews, see how other fans rated the game, connect Discord to find fellow fans from the servers you share, and share your own takes."
                src="/shots/bleachers.png"
                alt="The Bleachers: a stadium seat-picker for choosing sport sections, above community takes on a finished game."
              />
              <FeatureCard
                kicker="Your clubs"
                accent="#3FB950"
                title="The Franchise"
                body="Build your Starting Lineup. Pick up to 5 clubs across all fourteen team leagues — 25 with The Front Office — and track their combined win-loss-tie record for the season in one unified dashboard."
                src="/shots/franchise.png"
                alt="The Franchise: your clubs' combined win-loss-tie record for the season, with recent results beneath."
              />
            </div>
          </div>
        </section>

        {/* ══ The Front Office (gold) ══ */}
        <section className="lit-gold floodlights relative overflow-hidden border-y border-white/10">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <Kicker accent="#E5B53C">Membership</Kicker>
              <h2 className="headline mt-4 text-4xl sm:text-5xl" style={{ color: '#F4E3B0' }}>
                Unlock the
                <br />
                Front Office.
              </h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2">
                Go deeper with a Front Office membership — an in-app subscription in the
                Scorebug mobile app. Elevate your fandom with the full Analytics Desk, an
                unlimited Docket and Clippings, twenty accent themes, and no ads.
              </p>

              <ul className="mt-6 space-y-2.5">
                {[
                  ['The Analytics Desk', 'A dozen cuts of your own data, season-over-season trends, rivalry splits by opponent, and your attendance ledger.'],
                  ['Extended Lineup', 'Expand from 5 teams to 25. Every team you love, tracked on your home screen and profile.'],
                  ['Unlimited Docket & Clippings', 'No 25-game Docket cap, no 10-story Clippings limit.'],
                  ['Export Your Vault', 'Every game, rating and note you have written, as CSV or JSON.'],
                  ['Aesthetic Control', '20 accent palettes that recolour the whole app — buttons, highlights and your profile.'],
                  ['Zero Ads', 'Every banner and rewarded prompt disappears the moment you join.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <span aria-hidden className="mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black" style={{ background: 'rgba(229,181,60,0.18)', color: '#E5B53C', border: '1px solid rgba(229,181,60,0.42)' }}>◆</span>
                    <span className="text-[14.5px] leading-snug text-ink-2">
                      <span className="font-bold" style={{ color: '#F4E3B0' }}>{t}</span> — {d}
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
                or {PRICING.ca.yearly} {PRICING.ca.currency}/year — about{' '}
                {PRICING.perMonthEquivalent} a month either way. {PRICE_NOTE} Android at launch.
              </p>
            </div>

            <div className="flex justify-center">
              <Showcase
                src="/shots/front-office.png"
                alt="The Front Office: a gold-framed membership screen listing the Analytics Desk, extended lineup, unlimited Docket and Clippings, and an ad-free app."
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
          <Kicker accent="#58A6FF">Questions</Kicker>
          <h2 className="headline mt-4 text-4xl text-ink sm:text-5xl">Frequently asked</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map(f => (
              <details key={f.q} className="faq glass-card group rounded-2xl">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-ink">
                  {f.q}
                  <span className="faq-chevron text-sb-red transition-transform" aria-hidden>›</span>
                </summary>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ══ Final CTA — mirrors the hero's hierarchy for anyone who scrolled ══ */}
        <section className="lit-red floodlights relative overflow-hidden px-5 pb-28 pt-4">
          <div className="glass-card relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-16 text-center">
            <span aria-hidden className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(80% 90% at 50% -30%, rgba(248,81,73,0.22) 0%, transparent 65%)' }} />
            <div className="relative">
              <h2 className="headline mx-auto max-w-2xl text-4xl text-ink sm:text-5xl">
                Stop just watching the game.
                <br />
                Start building your record.
              </h2>
              <div className="mt-9 flex justify-center">
                <LaunchWebApp />
              </div>
              <p className="mt-2.5 text-[12.5px] text-ink-3">Opens in your browser — nothing to install.</p>
              <StoreButtons className="mt-7 justify-center" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/app-icon.png" alt="" width={26} height={26} className="rounded-[7px]" />
            <span className="text-[13px] font-bold text-ink-2">Scorebug</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-5 text-[13px] font-semibold text-ink-3">
            <a href={APP_LINKS.slate} className="py-2 -my-2 hover:text-ink-2">The Slate</a>
            <a href={APP_LINKS.privacy} className="py-2 -my-2 hover:text-ink-2">Privacy</a>
            <a href={APP_LINKS.terms} className="py-2 -my-2 hover:text-ink-2">Terms</a>
            <a href={androidCta().href} className="py-2 -my-2 hover:text-ink-2">{androidCta().label}</a>
          </nav>
          <p className="text-[12px] text-ink-3">© {new Date().getFullYear()} Scorebug™ · Made in Canada</p>
        </div>
      </footer>
    </>
  )
}
