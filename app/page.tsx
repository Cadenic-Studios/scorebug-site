import Image from 'next/image'
import { FAQS } from './faqs'
import { PLAY_URL, PRICING, PRICE_NOTE, APP_LINKS } from './config'
import {
  RateChronicleScreen, VaultScreen, SlateScreen,
  FrontOfficeScreen, BleachersScreen, FranchiseScreen, WireScreen,
} from './components/Screens'

/* Every screen mockup is authored at this logical size and scaled to fit. */
const BASE_W = 316
const BASE_H = 664

/**
 * A phone shell wrapping one of the app-screen mockups.
 *
 * `screenW` is the RENDERED screen width; the mockup inside always draws at
 * BASE_W and is scaled to it, so a 230px bento phone and a 290px feature phone
 * are the same artwork at different sizes rather than two layouts that drift.
 */
function PhoneFrame({
  screenW, gold = false, className = '', children,
}: {
  screenW: number; gold?: boolean; className?: string; children: React.ReactNode
}) {
  const s = screenW / BASE_W
  return (
    <div
      className={`device ${gold ? 'device-gold' : ''} ${className}`}
      style={{ width: screenW + 20, flexShrink: 0 }}
      aria-hidden
    >
      <div className="device-screen" style={{ height: Math.round(BASE_H * s) }}>
        <span
          className="device-island"
          style={{ width: 80 * s, height: 19 * s, top: 8 * s, transform: `translateX(-50%)` }}
        />
        <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${s})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ── Store badges ─────────────────────────────────────────────────────────── */

function PlayGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.6 2.4v19.2c0 .5.3.8.7.6l11-9.6c.4-.3.4-.9 0-1.2l-11-9.6c-.4-.2-.7 0-.7.6Z" fill="#fff" opacity="0.95" />
      <path d="M17.6 9.3 15 11.6l2.6 2.3 3-2.6-3-2Z" fill="#fff" opacity="0.7" />
    </svg>
  )
}

function AppleGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.8ZM14 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  )
}

function StoreButtons({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={PLAY_URL}
        className="enamel-red flex items-center gap-3 rounded-2xl px-5 py-3 text-white transition active:scale-[0.98]"
      >
        <PlayGlyph size={22} />
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-white">Get it on</span>
          <span className="block text-[17px] font-bold">Google Play</span>
        </span>
      </a>
      {/* Not a link: there is no iOS build to send anyone to yet. A dead App
          Store button is the single most common lie on an app landing page.
          Dimmed with COLOUR, not opacity — `opacity-60` composited the label
          and its own fill toward the page and measured 2.4:1. */}
      <span className="glass-btn flex cursor-default items-center gap-3 rounded-2xl px-5 py-3">
        <span className="text-ink-3"><AppleGlyph size={20} /></span>
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-3">Coming to</span>
          <span className="block text-[17px] font-bold text-ink-2">iOS</span>
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

/** One marquee feature: copy on one side, a real screen on the other. */
function FeatureRow({
  kicker, accent, title, body, bullets, screen, flip = false,
}: {
  kicker: string; accent: string; title: string; body: string
  bullets: string[]; screen: React.ReactNode; flip?: boolean
}) {
  return (
    <div className={`grid items-center gap-10 md:grid-cols-2 md:gap-14 ${flip ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div>
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
      <div className="flex justify-center">
        <div className="relative">
          {screen}
          <span aria-hidden className="device-floor absolute inset-x-0 top-full h-24 rounded-[50%]" />
        </div>
      </div>
    </div>
  )
}

/** A smaller feature: one screen above its copy, for the closing three-up. */
function FeatureCard({
  kicker, accent, title, body, screen,
}: {
  kicker: string; accent: string; title: string; body: string; screen: React.ReactNode
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-6 pb-7">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(85% 45% at 50% 0%, ${accent}1F 0%, transparent 62%)` }}
      />
      <div className="relative">
        {/* items-start: the default `stretch` pulled the device shell to the
            wrapper height and squared off its rounded corners. */}
        <div className="flex items-start justify-center overflow-hidden" style={{ height: 210 }}>
          {screen}
        </div>
        <p className="mt-5 text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{kicker}</p>
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
    // generic rather than role="contentinfo", so the page exposes no banner or
    // contentinfo landmark at all and skip-to-content never lands anywhere.
    <>
    {/* ══ Nav ══ */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <a href="/" className="flex items-center gap-2.5">
        <Image src="/app-icon.png" alt="" width={36} height={36} className="rounded-[9px]" priority />
        <span className="headline text-2xl text-ink">Scorebug</span>
      </a>
      <nav aria-label="Primary" className="flex items-center gap-2.5">
        <a href={APP_LINKS.slate} className="glass-btn hidden rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 transition hover:text-ink sm:inline-block">
          Open the web app
        </a>
        <a href={PLAY_URL} className="enamel-red rounded-full px-4 py-2 text-[13px] font-black text-white transition active:scale-95">
          Get the app
        </a>
      </nav>
      </header>

      <main>

      {/* ══ Hero ══ */}
      <section className="lit-red floodlights relative overflow-hidden">
        {/* TWO COLUMNS ONLY FROM lg. The `[1fr_auto]` track list resolves the
              1fr to minmax(auto, 1fr) — an auto MINIMUM — so the text column
              can never shrink below the word "CHRONICLE", and the phone stack
              is flexShrink:0 at 470px. Below ~853px the pair simply did not
              fit and the Vault phone was sliced off at the viewport edge
              (body's overflow-x:hidden hid the scrollbar, not the damage).
              768-1023px now gets the stacked hero that already works. */}
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1fr_auto] lg:pb-20 lg:pt-12">
          <div className="relative z-10">
            <Kicker>Chronicle your sports</Kicker>
            <h1 className="headline mt-5 text-[3.6rem] text-white sm:text-[4.6rem] lg:text-[5.4rem]">
              Chronicle
              <br />
              every game.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
              The ultimate fan log. Track live scores, rate matchups, and save your record.
            </p>
            <StoreButtons className="mt-8" />
            <p className="mt-5 text-[13px] text-ink-3">
              Free to download · 15 leagues · or{' '}
              <a href={APP_LINKS.slate} className="whitespace-nowrap font-bold text-sb-teal underline underline-offset-2">use it in your browser →</a>
            </p>
          </div>

          {/* Dual device: the log flow, and the archive it feeds.
              The front phone overlaps the back one by a fixed 34px — enough to
              read as a stack, little enough that the Vault's stat row and its
              first two entries stay legible, which is the whole reason the
              second phone is there. */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative flex items-start">
              <PhoneFrame screenW={238} className="relative z-10 rotate-[-3deg] sm:mt-6 sm:-mr-[34px]">
                <RateChronicleScreen />
              </PhoneFrame>
              {/* One phone below `sm`: the pair is 490px wide and a 390px
                  handset would show the Vault sliced off at the bezel, which
                  reads as a broken layout rather than a stack. */}
              <PhoneFrame screenW={226} className="hidden rotate-[5deg] opacity-95 sm:block">
                <VaultScreen />
              </PhoneFrame>
              <span aria-hidden className="device-floor absolute inset-x-0 top-full h-24 rounded-[50%]" />
            </div>
          </div>
        </div>
      </section>

      {/* ══ The hook ══ */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="headline text-4xl text-ink sm:text-5xl">
          Your sports. Your record.
        </h2>
        <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
          Welcome to Scorebug, the ultimate journal for the dedicated sports fan. Stop just
          checking the box scores and letting incredible sports moments fade away. Scorebug
          is built to let you track live action, read breaking news, and log every game you
          watch — building a permanent archive of your lifetime in sports.
        </p>
      </section>

      {/* ══ Marquee features ══ */}
      <section className="mx-auto flex max-w-6xl flex-col gap-28 px-5 pb-28" id="features">
        {/* Visually hidden: the three feature rows below are h3s and need an
            h2 to belong to. The hook section above reads as their heading to a
            sighted visitor, but it lives in a different <section>. */}
        <h2 className="sr-only">What Scorebug does</h2>

        <FeatureRow
          kicker="The core loop"
          accent="#F85149"
          title="Rate & chronicle"
          body="Watched a legendary game? Once it's final, log it. Give the matchup a rating out of 5.0, write your personal takes, and add your own photos to keep the night exactly as you remember it."
          bullets={[
            'A goal-light rating in half-point steps, from 1.0 to 5.0',
            'Record how you watched it — broadcast, at the venue, out watching, or a watch party',
            'Photos and ticket stubs stay private to your Vault, always',
            'Choose per game whether your rating and review go public',
          ]}
          screen={<PhoneFrame screenW={286}><RateChronicleScreen /></PhoneFrame>}
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
          screen={<PhoneFrame screenW={286}><SlateScreen /></PhoneFrame>}
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
          screen={<PhoneFrame screenW={286}><VaultScreen /></PhoneFrame>}
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

          {/* Each card needs 230px of phone + 48px padding = 278px of column,
              so three abreast needs ~914px. At md the column shrank to ~247px
              and the phones were chopped through their bezels on both flanks.
              Two-up in the middle band, three-up only when it genuinely fits. */}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              kicker="The news desk"
              accent="#D29922"
              title="The Wire"
              body="A dedicated sports news desk that builds itself around your teams. Pin a club or a league to My Wire, or let it follow your Starting Lineup automatically — with a tab for every league you follow."
              screen={<PhoneFrame screenW={210}><WireScreen /></PhoneFrame>}
            />
            <FeatureCard
              kicker="The social layer"
              accent="#F85149"
              title="The Bleachers"
              body="Read the room. Browse community reviews, see how other fans rated the game, connect Discord to find fellow fans from the servers you share, and share your own takes."
              screen={<PhoneFrame screenW={210}><BleachersScreen /></PhoneFrame>}
            />
            <FeatureCard
              kicker="Your clubs"
              accent="#3FB950"
              title="The Franchise"
              body="Build your Starting Lineup. Pick up to 5 clubs across all fourteen team leagues — 25 with The Front Office — and track their combined win-loss-tie record for the season in one unified dashboard."
              screen={<PhoneFrame screenW={210}><FranchiseScreen /></PhoneFrame>}
            />
          </div>
        </div>
      </section>

      {/* ══ The Front Office (gold) ══ */}
      <section className="lit-gold floodlights relative overflow-hidden border-y border-white/10">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 md:grid-cols-2">
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

            <a href={PLAY_URL} className="enamel-gold mt-8 inline-block rounded-full px-7 py-3 text-[15px] font-black transition active:scale-95">
              Get Scorebug and see the plans →
            </a>
            <p className="mt-3 max-w-md text-[12px] leading-relaxed text-ink-3">
              {PRICING.monthly}/month, or {PRICING.yearly}/year — about{' '}
              {PRICING.perMonthEquivalent} a month. Cancel any time. {PRICE_NOTE} Android at launch.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="relative">
              <PhoneFrame screenW={286} gold>
                <FrontOfficeScreen price={PRICING.monthly} cadence={PRICING.monthlyCadence} yearly={PRICING.yearly} />
              </PhoneFrame>
              <span aria-hidden className="device-floor absolute inset-x-0 top-full h-24 rounded-[50%]" />
            </div>
          </div>
        </div>
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

      {/* ══ Final CTA ══ */}
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
            <StoreButtons className="mt-9 justify-center" />
            <p className="mt-5 text-[12.5px] text-ink-3">
              Also on the web — <a href={APP_LINKS.slate} className="font-bold text-sb-teal underline underline-offset-2">open The Slate</a>
            </p>
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
          <nav aria-label="Footer" className="flex items-center gap-5 text-[13px] font-semibold text-ink-3">
            <a href={APP_LINKS.privacy} className="py-2 -my-2 hover:text-ink-2">Privacy</a>
            <a href={APP_LINKS.terms} className="py-2 -my-2 hover:text-ink-2">Terms</a>
            <a href={PLAY_URL} className="py-2 -my-2 hover:text-ink-2">Google Play</a>
          </nav>
          <p className="text-[12px] text-ink-3">© {new Date().getFullYear()} Scorebug™ · Made in Canada</p>
        </div>
      </footer>
    </>
  )
}
