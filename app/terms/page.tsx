import Image from 'next/image'
import type { Metadata } from 'next'
import {
  SITE, CONTACT_EMAIL, COMPANY, COMPANY_LOCATION, COMPANY_JURISDICTION,
  LEGAL_PATHS, LEGAL_UPDATED, LEGAL_UPDATED_ISO, WEB_APP,
} from '../config'

/* ── Served here, not redirected ──────────────────────────────────────────────
 * /terms was pulled out of the APP_ROUTES allow-list in next.config.js along
 * with /privacy — the stores fetch both URLs out of band and a cross-host 307
 * is a fragile answer to that fetch. The long note lives in next.config.js.
 *
 * Keep this document in step with the app it describes. Every paragraph that
 * names a mechanism — Play Billing, the ad tiers, the affiliate links — matches
 * the Privacy Policy's account of the same mechanism; if one moves, both move. */

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The agreement between you and Cadenic Studios for using Scorebug — your account, your content, the community rules, The Front Office subscription, and the limits on our liability.',
  alternates: { canonical: `${SITE}${LEGAL_PATHS.terms}` },
}

/* Page furniture is intentionally duplicated across the three legal pages
   rather than shared — see the note in app/privacy/page.tsx. */

function LegalHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
      <a href="/" aria-label="Scorebug home" className="flex min-w-0 items-center gap-2.5">
        <Image src="/app-icon.png" alt="" width={36} height={36} className="rounded-[9px]" priority />
        <span className="headline hidden text-2xl text-ink sm:inline">Scorebug</span>
      </a>
      <a
        href="/"
        className="glass-btn rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 transition hover:text-ink"
      >
        Back to site
      </a>
    </header>
  )
}

function LegalFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-[12px] text-ink-3">
          © {new Date().getFullYear()} Scorebug™ · {COMPANY} · Made in Canada
        </p>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-5 text-[13px] font-semibold text-ink-3">
          <a href={LEGAL_PATHS.privacy} className="-my-2 py-2 hover:text-ink-2">Privacy Policy</a>
          <a href={LEGAL_PATHS.accountDeletion} className="-my-2 py-2 hover:text-ink-2">Delete your account</a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="-my-2 py-2 hover:text-ink-2">{CONTACT_EMAIL}</a>
        </nav>
      </div>
    </footer>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-white/10 pt-10">
      <h2 className="headline text-2xl text-ink sm:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15.5px] leading-relaxed text-ink-2">{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2.5">{children}</ul>
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2">
      <span
        aria-hidden
        className="mt-[9px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sb-gold"
      />
      <span>{children}</span>
    </li>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="font-semibold text-sb-blue underline underline-offset-2 hover:text-ink">
      {children}
    </a>
  )
}

function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

const CONTENTS: { id: string; label: string }[] = [
  { id: 'agreement', label: 'The agreement' },
  { id: 'eligibility', label: 'Who can use Scorebug' },
  { id: 'account', label: 'Your account' },
  { id: 'what-scorebug-is', label: 'What Scorebug is — and is not' },
  { id: 'your-content', label: 'Your content' },
  { id: 'community', label: 'Community rules' },
  { id: 'front-office', label: 'The Front Office subscription' },
  { id: 'ads-affiliates', label: 'Ads and affiliate links' },
  { id: 'third-party', label: 'Leagues, teams and third parties' },
  { id: 'availability', label: 'Availability and changes' },
  { id: 'disclaimer', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'termination', label: 'Ending the agreement' },
  { id: 'law', label: 'Governing law' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'contact', label: 'Contact' },
]

export default function TermsOfService() {
  return (
    <>
      <LegalHeader />

      <main>
        <section className="lit-gold relative overflow-hidden">
          <div className="mx-auto max-w-2xl px-5 pb-12 pt-10">
            <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase text-sb-gold">
              {/* theme(), not the literal hex: the palette lives in
                  tailwind.config.ts and is mirrored from the app. */}
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-sb-gold shadow-[0_0_8px_theme(colors.sb-gold)]" />
              Legal
            </p>
            <h1 className="headline mt-5 text-[3rem] text-white sm:text-[3.6rem]">Terms of Service</h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              The rules for using Scorebug, in plain language. Using the app means you agree to
              them, so they are worth the five minutes.
            </p>
            <p className="mt-4 text-[13px] text-ink-3">
              Last updated <time dateTime={LEGAL_UPDATED_ISO}>{LEGAL_UPDATED}</time>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-5 pb-24">
          <nav aria-label="Contents" className="glass-card rounded-2xl px-5 py-5">
            <h2 className="text-[10.5px] font-black uppercase tracking-[0.22em] text-ink-3">Contents</h2>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {CONTENTS.map((c, i) => (
                <li key={c.id} className="text-[14px] leading-snug">
                  <a href={`#${c.id}`} className="-my-1 inline-block py-1 text-ink-2 hover:text-ink">
                    <span className="mr-2 tabular-nums text-ink-3">{i + 1}.</span>
                    {c.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-10">
            <Section id="agreement" title="The agreement">
              <P>
                Scorebug is operated by {COMPANY}, {COMPANY_LOCATION}. These Terms are an agreement
                between you and {COMPANY} covering the Scorebug web app at{' '}
                <A href={WEB_APP}>app.getscorebug.app</A>, the Scorebug Android app, and this site.
              </P>
              <P>
                By creating an account or using Scorebug, you accept these Terms and our{' '}
                <A href={LEGAL_PATHS.privacy}>Privacy Policy</A>. If you do not accept them, do not
                use the app.
              </P>
            </Section>

            <Section id="eligibility" title="Who can use Scorebug">
              <P>
                You must be at least 13 years old. If you are under the age of majority where you
                live, you may only use Scorebug with the involvement of a parent or guardian. If
                you are using Scorebug on behalf of an organisation, you are confirming you have
                the authority to accept these Terms for it.
              </P>
            </Section>

            <Section id="account" title="Your account">
              <UL>
                <LI>Give us an email address that actually reaches you — it is how we reach you about your account.</LI>
                <LI>Keep your credentials to yourself. Activity under your account is your responsibility.</LI>
                <LI>Tell us at <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> if you think someone else has access.</LI>
                <LI>One person per account. Do not impersonate someone else, and do not sell or transfer your account.</LI>
              </UL>
            </Section>

            <Section id="what-scorebug-is" title="What Scorebug is — and is not">
              <P>
                Scorebug is a personal record of the games you watch, plus a community of fans doing
                the same thing. Scores, schedules, standings and news come from third-party data
                providers.
              </P>
              <P>
                That data is provided <Term>as-is</Term>. It can be delayed, incomplete, corrected
                after the fact, or simply wrong, and we do not control it. Scorebug is{' '}
                <Term>not an official source</Term> and must not be relied on for wagering,
                officiating, fantasy settlement, or any other decision where being wrong costs you
                something. Check the league.
              </P>
            </Section>

            <Section id="your-content" title="Your content">
              <P>
                <Term>Your logs, ratings, notes and photos are yours.</Term> We claim no ownership
                of them.
              </P>
              <P>
                To run the service we need a limited licence: you grant {COMPANY} a non-exclusive,
                worldwide, royalty-free licence to host, store, back up, reproduce and display your
                content <Term>for the purpose of operating Scorebug for you</Term> — and, for
                content you post into community areas, to display it to the other fans you posted
                it to. That is the whole scope. We do not use your content to advertise, we do not
                license it to anyone else, and it ends when you delete the content or your account.
              </P>
              <P>
                You are responsible for what you post: that you have the right to post it, and that
                it does not break the law or someone else&apos;s rights.
              </P>
            </Section>

            <Section id="community" title="Community rules">
              <P>Short list, strictly enforced. In community areas of Scorebug, do not:</P>
              <UL>
                <LI>Harass, threaten or abuse other fans, or post hate speech.</LI>
                <LI>Post illegal content, or anything that infringes someone else&apos;s copyright or trademark.</LI>
                <LI>Impersonate another person, a team, a league or Scorebug itself.</LI>
                <LI>Spam, advertise, or run promotions and giveaways.</LI>
                <LI>Scrape the service, hammer it with automated requests, or attempt to break its security or access other accounts&apos; data.</LI>
                <LI>Resell, redistribute or bulk-export the sports data that appears in the app.</LI>
              </UL>
              <P>
                We may remove content, limit features, or suspend or terminate an account that
                breaks these rules. Where it is reasonable to do so we will tell you why.
              </P>
            </Section>

            <Section id="front-office" title="The Front Office subscription">
              <P>
                The Front Office is Scorebug&apos;s paid tier. It is sold as an auto-renewing
                subscription through <Term>Google Play Billing</Term>, and managed with RevenueCat.
              </P>
              <UL>
                <LI>Your price is confirmed by Google Play at checkout in your local currency.</LI>
                <LI>
                  It renews automatically at the end of each period until you cancel. Cancel any
                  time in the Google Play app under Payments &amp; subscriptions — cancelling stops
                  the next renewal and you keep the benefits until the current period ends.
                </LI>
                <LI>
                  <Term>Refunds are handled by Google Play</Term> under its refund policy, not by
                  us, because Google is the merchant of record.
                </LI>
                <LI>
                  If we change the price, we will tell you before it takes effect and Google will
                  ask you to accept it. You can cancel instead.
                </LI>
                <LI>
                  Deleting your Scorebug account does <Term>not</Term> cancel a Play subscription.
                  Cancel it in Google Play first — see{' '}
                  <A href={LEGAL_PATHS.accountDeletion}>deleting your account</A>.
                </LI>
              </UL>
            </Section>

            <Section id="ads-and-affiliate-links" title="Ads and affiliate links">
            {/* id renamed from the bare word: EasyList's generic cosmetic
                rules hide elements by common ad-ish ids, and a hidden section
                of the privacy policy/terms is invisible precisely to the
                ad-block users it most concerns — including a Play reviewer
                running one. Nothing linked to the old anchor. */}
              <P>
                Free accounts see ads, served by Google AdMob on Android and AdSense on the web.
                Front Office members do not.
              </P>
              <P>
                Some outbound links — tickets, merchandise, memorabilia — are affiliate links
                through CJ, the eBay Partner Network, Impact and TicketNetwork. If you buy
                something after following one, we may earn a commission,{' '}
                <Term>at no extra cost to you</Term>. We are not a party to that purchase: the
                merchant&apos;s own terms, pricing, delivery and returns apply, and any dispute is
                between you and them.
              </P>
            </Section>

            <Section id="third-party" title="Leagues, teams and third parties">
              <P>
                Team names, league names, logos and other marks belong to their respective owners
                and are used descriptively, to identify the games you are logging.{' '}
                <Term>
                  Scorebug is an independent fan application and is not affiliated with,
                  endorsed by, or sponsored by any league, team, broadcaster or governing body.
                </Term>
              </P>
              <P>
                Scorebug links to and depends on third-party services. We are not responsible for
                their content or their availability, and your use of them is governed by their
                terms.
              </P>
            </Section>

            <Section id="availability" title="Availability and changes">
              <P>
                We are a small studio and Scorebug is under active development. Features may be
                added, changed or withdrawn, and the service may be unavailable for maintenance or
                for reasons outside our control. We do not promise uptime.
              </P>
              <P>
                If we ever discontinue the service, we will give reasonable notice and a way to
                export your logs before it goes.
              </P>
            </Section>

            <Section id="disclaimer" title="Disclaimers">
              <P>
                Scorebug is provided <Term>“as is” and “as available”</Term>, without warranties of
                any kind, whether express or implied, including implied warranties of
                merchantability, fitness for a particular purpose, and non-infringement. We do not
                warrant that the service will be uninterrupted, error-free, or that the sports data
                in it is accurate or complete.
              </P>
              <P>
                Some jurisdictions do not allow the exclusion of certain warranties, so parts of
                this section may not apply to you. Nothing here limits consumer rights that cannot
                be limited by law.
              </P>
            </Section>

            <Section id="liability" title="Limitation of liability">
              <P>
                To the fullest extent the law allows, {COMPANY} is not liable for indirect,
                incidental, special, consequential or punitive damages, or for lost profits, lost
                data or lost goodwill, arising out of your use of Scorebug.
              </P>
              <P>
                Our total liability for any claim relating to Scorebug is limited to the greater of
                the amount you paid us in the twelve months before the claim, or CAD $100.
              </P>
              <P>
                <Term>Keep your own copies of anything you cannot lose.</Term> We back up in good
                faith, but a log you would grieve deserves a second home.
              </P>
            </Section>

            <Section id="termination" title="Ending the agreement">
              <P>
                You can stop at any time by deleting your account — see{' '}
                <A href={LEGAL_PATHS.accountDeletion}>deleting your account</A> for what that
                removes and how long it takes.
              </P>
              <P>
                We may suspend or terminate an account that breaks these Terms, or where we are
                required to by law. The sections that by their nature should survive termination —
                your content licence for content you left up, disclaimers, liability limits and
                governing law — survive it.
              </P>
            </Section>

            <Section id="law" title="Governing law">
              <P>
                These Terms are governed by the laws of {COMPANY_JURISDICTION}, without regard to
                conflict-of-law rules, and the courts of that province have jurisdiction. If you
                are a consumer, this does not deprive you of the protection of the mandatory laws
                of the country you live in.
              </P>
            </Section>

            <Section id="changes" title="Changes to these terms">
              <P>
                We update the date at the top when these Terms change. For material changes we will
                give notice in the app before they take effect. Continuing to use Scorebug after
                that means you accept the new version; if you do not, delete your account.
              </P>
            </Section>

            <Section id="contact" title="Contact">
              <P>
                {COMPANY}
                <br />
                {COMPANY_LOCATION}
                <br />
                <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>
              </P>
              <P>
                See also our <A href={LEGAL_PATHS.privacy}>Privacy Policy</A> and{' '}
                <A href={LEGAL_PATHS.accountDeletion}>account deletion instructions</A>.
              </P>
            </Section>
          </div>
        </div>
      </main>

      <LegalFooter />
    </>
  )
}
