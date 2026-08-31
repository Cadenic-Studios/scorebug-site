import type { Metadata } from 'next'
import {
  SITE, WEB_APP, CONTACT_EMAIL, COMPANY, COMPANY_LOCATION,
  PRICING, LEGAL_PATHS,
} from '../config'
import { LEAGUE_COUNT, TEAM_LEAGUE_COUNT } from '../leagues'
import { SiteHeader, SiteFooter, BreadcrumbNav, LaunchWebApp } from '../components/SiteChrome'

/**
 * /pricing — what Scorebug costs, on the marketing domain.
 *
 * ── WHY IT LIVES HERE AND NOT IN THE APP ────────────────────────────────────
 * Paddle verifies the DOMAIN submitted during setup (getscorebug.app) and
 * fetches the pricing URL itself, out of band. The app's own /front-office
 * pricing route is on app.getscorebug.app, so submitting it would either fail
 * the check or resolve through a cross-host 307 — the same fragile shape that
 * next.config.js already documents for the Google Play policy URLs, and the
 * reason /privacy, /terms and /refunds are real pages in this deployment.
 *
 * ── EVERY NUMBER COMES FROM config.PRICING ──────────────────────────────────
 * One source of truth, shared with the homepage. A pricing page that disagrees
 * with the price a payment provider sees at checkout is the single fastest way
 * to fail a verification review, and the slowest kind of bug to notice.
 *
 * ── WHAT IT DOES NOT CLAIM ──────────────────────────────────────────────────
 * Not "ad-free". Curated commerce does not collapse for members — COMMERCE_LIMIT
 * is { free: 4, vault: 12 }, so members see MORE, each badged SPONSORED. The one
 * real removal is the Bleachers feed, which is what the table says.
 */

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    `Scorebug is free: track live scores across ${LEAGUE_COUNT} leagues and log, grade and keep every `
    + `game you watch. The Front Office is an optional membership at ${PRICING.us.monthly} `
    + `${PRICING.us.currency} a month or ${PRICING.us.yearly} a year.`,
  alternates: { canonical: `${SITE}/pricing` },
}

/** Every row is a capability that genuinely differs between the two tiers. */
const ROWS: { label: string; free: string | boolean; paid: string | boolean }[] = [
  { label: 'Log, grade and keep every game you watch', free: true, paid: true },
  { label: `Live scores across ${LEAGUE_COUNT} leagues`, free: true, paid: true },
  { label: 'Log finished games back to the 2002 season', free: true, paid: true },
  { label: 'Community takes, replies and Linemates', free: true, paid: true },
  { label: 'Teams in your Starting Lineup', free: '5', paid: '25' },
  { label: 'Games on your Docket at once', free: '5', paid: 'Unlimited' },
  { label: 'Season ledger, rivalry table and attendance history', free: false, paid: true },
  { label: 'Feed ads in The Bleachers', free: 'Shown', paid: 'Removed' },
  { label: 'Profile themes and crest finishes', free: 'Standard', paid: 'Full set' },
]

function Mark({ on }: { on: boolean }) {
  return on
    ? <span aria-label="Included" className="text-[15px] font-black text-emerald-400">✓</span>
    : <span aria-label="Not included" className="text-[15px] font-black text-ink-3">—</span>
}

function Cell({ v }: { v: string | boolean }) {
  if (typeof v === 'boolean') return <Mark on={v} />
  return <span className="text-[13.5px] font-bold text-ink">{v}</span>
}

export default function PricingPage() {
  return (
    <>
      <SiteHeader />

      <main className="lit-blue floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-3xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Pricing' }]} />

          <h1 className="headline mt-6 text-4xl text-ink sm:text-5xl">Pricing</h1>
          <p className="mt-5 max-w-[40rem] text-[17px] leading-relaxed text-ink-2">
            Scorebug is free, and the part that matters most stays free: tracking live scores,
            logging every game you watch, grading it out of 5.0 and keeping it forever.
            The Front Office is an optional membership for people who want the whole record.
          </p>

          {/* ── The two tiers ──────────────────────────────────────────── */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">Free</p>
              <p className="headline mt-3 text-4xl text-ink">$0</p>
              <p className="mt-2 text-[13.5px] text-ink-3">Forever. No trial, no card.</p>
              <p className="mt-5 text-[14.5px] leading-relaxed text-ink-2">
                The full logbook: live scores, ratings, notes, your vault and the community.
              </p>
              <div className="mt-6">
                <LaunchWebApp size="md" />
              </div>
            </div>

            <div className="rounded-2xl border border-sb-gold/40 bg-sb-gold/[0.06] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sb-gold">The Front Office</p>
              <p className="headline mt-3 text-4xl text-ink">
                {PRICING.us.monthly}
                <span className="text-[15px] font-bold text-ink-3"> {PRICING.monthlyCadence}</span>
              </p>
              <p className="mt-2 text-[13.5px] text-ink-3">
                or {PRICING.us.yearly} a year, about {PRICING.perMonthEquivalent} a month
              </p>
              <p className="mt-5 text-[14.5px] leading-relaxed text-ink-2">
                Everything in Free, plus the full Analytics Desk, a Starting Lineup of up to 25 teams
                across the {TEAM_LEAGUE_COUNT} team leagues, and an unlimited Docket.
              </p>
              <p className="mt-6 text-[13px] text-ink-3">
                Available in the Android app today. Web checkout is coming shortly.
              </p>
            </div>
          </div>

          {/* Prices in both storefront currencies. A verification reviewer and a
              Canadian visitor both look for the number that applies to them. */}
          <p className="mt-5 text-[13.5px] leading-relaxed text-ink-3">
            Shown in {PRICING.us.currency}. In Canada, {PRICING.ca.monthly} {PRICING.ca.currency} a
            month or {PRICING.ca.yearly} {PRICING.ca.currency} a year. Your local price, including
            any applicable tax, is confirmed at checkout before you are charged. Prices in other
            countries are set by the storefront and may differ.
          </p>

          {/* ── What differs ───────────────────────────────────────────── */}
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b border-white/10 px-5 py-3.5">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-ink-3">What you get</span>
              <span className="w-16 text-center text-[10px] font-black uppercase tracking-[0.14em] text-ink-3">Free</span>
              <span className="w-20 text-center text-[10px] font-black uppercase tracking-[0.14em] text-sb-gold">Front Office</span>
            </div>
            {ROWS.map(r => (
              <div key={r.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b border-white/[0.06] px-5 py-3.5 last:border-b-0">
                <span className="text-[14px] leading-snug text-ink-2">{r.label}</span>
                <span className="w-16 text-center"><Cell v={r.free} /></span>
                <span className="w-20 text-center"><Cell v={r.paid} /></span>
              </div>
            ))}
          </div>

          {/* ── Billing terms, stated plainly ──────────────────────────── */}
          <section className="mt-12">
            <h2 className="headline text-2xl text-ink">Billing, in plain terms</h2>
            <ul className="mt-5 space-y-3">
              {[
                'The Front Office is a recurring subscription. It renews automatically at the end of each billing period until you cancel.',
                'You can cancel at any time. Cancelling stops the next charge; your membership runs to the end of the period you have already paid for.',
                'Nothing you have logged is ever deleted when a membership ends. Your games, ratings and notes stay in your account on the free tier.',
                'Web subscriptions are sold and processed by Paddle, which acts as the merchant of record and appears on your statement. In the Android app, subscriptions are billed through Google Play.',
                'Full refund on a web subscription within 14 days of a charge, and case by case after that.',
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-[9px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sb-gold" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[14.5px] leading-relaxed text-ink-2">
              The full detail is in the <a href={LEGAL_PATHS.refunds} className="font-semibold text-sb-blue underline underline-offset-2 hover:text-ink">Refund Policy</a>,
              the <a href={LEGAL_PATHS.terms} className="font-semibold text-sb-blue underline underline-offset-2 hover:text-ink">Terms of Service</a> and
              the <a href={LEGAL_PATHS.privacy} className="font-semibold text-sb-blue underline underline-offset-2 hover:text-ink">Privacy Policy</a>.
            </p>
          </section>

          <p className="mt-12 text-[13px] text-ink-3">
            Scorebug is operated by {COMPANY}, {COMPANY_LOCATION}. Questions about billing?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            . Or{' '}
            <a href={WEB_APP} className="font-semibold text-ink underline underline-offset-2">
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
