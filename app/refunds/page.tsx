import Image from 'next/image'
import type { Metadata } from 'next'
import {
  SITE, CONTACT_EMAIL, COMPANY, COMPANY_LOCATION,
  LEGAL_PATHS, LEGAL_UPDATED, LEGAL_UPDATED_ISO,
} from '../config'

/* ── Served here, not redirected ──────────────────────────────────────────────
 * Same rule as /privacy and /terms: a payment provider fetches this URL itself,
 * out of band, with no browser and no patience, and a cross-host 307 reads as
 * "policy URL unreachable". /refunds is therefore absent from the APP_ROUTES
 * allow-list in next.config.js and is a real page in this deployment.
 *
 * ── WHY THIS DOCUMENT EXISTS ────────────────────────────────────────────────
 * Paddle requires a published refund policy before it will verify a domain for
 * checkout. It is also the document a cardholder's bank reads during a
 * chargeback, which is the practical reason to be specific about windows and
 * method rather than writing something warm and vague.
 *
 * ── IT COVERS TWO STOREFRONTS, AND THEY HAVE DIFFERENT RULES ────────────────
 * A Google Play subscription is a contract with Google, refunded under Google's
 * policy through Google's flow — we cannot issue that refund ourselves, and
 * saying otherwise sends people to the wrong place. A web subscription is sold
 * by Paddle as merchant of record. Both paths are described because a member
 * reading this does not necessarily know which one they used.
 *
 * Keep in step with the Terms' "Front Office subscription" section. */

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'How refunds, cancellations and billing work for The Front Office — the windows, how to ask, '
    + 'and what happens on Google Play versus a web subscription.',
  alternates: { canonical: `${SITE}${LEGAL_PATHS.refunds}` },
}

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
          <a href={LEGAL_PATHS.terms} className="-my-2 py-2 hover:text-ink-2">Terms of Service</a>
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
      <span aria-hidden className="mt-[9px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sb-gold" />
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
  { id: 'summary', label: 'The short version' },
  { id: 'free', label: 'Scorebug is free to use' },
  { id: 'billing', label: 'How billing works' },
  { id: 'cancel', label: 'Cancelling' },
  { id: 'refunds-web', label: 'Refunds on a web subscription' },
  { id: 'refunds-play', label: 'Refunds on Google Play' },
  { id: 'statutory', label: 'Your statutory rights' },
  { id: 'exceptions', label: 'When we may decline' },
  { id: 'how', label: 'How to ask for a refund' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact' },
]

export default function RefundsPage() {
  return (
    <div className="lit-blue floodlights relative min-h-screen overflow-hidden">
      <div className="relative z-10">
        <LegalHeader />

        <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
          <h1 className="headline text-4xl text-ink sm:text-5xl">Refund Policy</h1>
          <p className="mt-4 text-[15px] text-ink-3">
            Last updated <time dateTime={LEGAL_UPDATED_ISO}>{LEGAL_UPDATED}</time> · {COMPANY}, {COMPANY_LOCATION}
          </p>

          <nav aria-label="Contents" className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">Contents</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {CONTENTS.map(c => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="text-[14px] font-semibold text-ink-2 hover:text-ink">
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 space-y-12">
            <Section id="summary" title="The short version">
              <P>
                Scorebug is free. The only thing you can pay for is <Term>The Front Office</Term>, an
                optional membership. You can cancel it at any time, and if a charge was a mistake or
                the product did not do what we said it does, write to us and we will sort it out.
              </P>
              <P>
                The detail below matters mostly for one reason: where you bought the membership
                decides who processes the refund. We can refund a web subscription directly. We
                cannot refund a Google Play subscription ourselves, because that money never passes
                through us.
              </P>
            </Section>

            <Section id="free" title="Scorebug is free to use">
              <P>
                Tracking live scores, logging games, grading them out of 5.0, writing your notes and
                keeping them is free and always has been. There is no trial that expires and no
                paywall in front of the core product, so in most cases there is nothing to refund
                because there was nothing to pay.
              </P>
            </Section>

            <Section id="billing" title="How billing works">
              <UL>
                <LI>
                  The Front Office is a <Term>recurring subscription</Term>, billed monthly or
                  annually depending on the plan you choose. See the{' '}
                  <A href="/pricing">pricing page</A> for current rates.
                </LI>
                <LI>
                  It <Term>renews automatically</Term> at the end of each billing period until you
                  cancel. You are told the price and the cadence before you pay.
                </LI>
                <LI>
                  Prices are shown in your local currency where the storefront supports it, and the
                  final amount, including any tax, is confirmed at checkout before you are charged.
                </LI>
                <LI>
                  On the web, subscriptions are sold and processed by <Term>Paddle</Term>, which acts
                  as the merchant of record. Paddle&rsquo;s name is what appears on your statement.
                </LI>
                <LI>
                  In the Android app, subscriptions are sold through <Term>Google Play</Term> and
                  billed to your Google account.
                </LI>
              </UL>
            </Section>

            <Section id="cancel" title="Cancelling">
              <P>
                You can cancel whenever you like, and you do not have to tell us why.
              </P>
              <UL>
                <LI>
                  <Term>Web subscription:</Term> use the manage-subscription link in the receipt
                  email, or write to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> and we
                  will cancel it for you.
                </LI>
                <LI>
                  <Term>Google Play:</Term> cancel in the Play Store under Payments &amp;
                  subscriptions. We cannot cancel a Play subscription on your behalf.
                </LI>
              </UL>
              <P>
                Cancelling stops the next charge. It does not end your current period: your
                membership stays active until the period you have already paid for runs out, and
                then reverts to the free tier. <Term>Nothing you have logged is ever deleted when a
                membership ends</Term> — your games, ratings and notes stay in your account.
              </P>
            </Section>

            <Section id="refunds-web" title="Refunds on a web subscription">
              <P>
                If you bought The Front Office on the web, we will refund your most recent payment in
                full if you ask within <Term>14 days</Term> of that charge. No conditions attached to
                how much of the membership you used.
              </P>
              <P>
                After 14 days we look at it case by case. If the product was broken, was charged
                twice, was charged after you cancelled, or plainly did not do what this site says it
                does, we will refund it. If you simply forgot to cancel an annual renewal and have
                not used the membership since, tell us — in practice we would rather refund it than
                keep money from someone who does not want the product.
              </P>
              <P>
                Approved refunds are returned to the original payment method by Paddle. Paddle
                normally processes them within a few business days; how quickly it then appears is up
                to your bank or card issuer, and is usually a further five to ten business days.
              </P>
            </Section>

            <Section id="refunds-play" title="Refunds on Google Play">
              <P>
                A subscription bought inside the Android app is a transaction between you and Google.
                The money does not pass through us, and we have no ability to reverse the charge.
              </P>
              <UL>
                <LI>
                  Request it through <A href="https://play.google.com/store/account/subscriptions">
                  Google Play</A>, or at <A href="https://support.google.com/googleplay/answer/2479637">
                  Google&rsquo;s refund request page</A>. Google&rsquo;s own policy applies.
                </LI>
                <LI>
                  Google generally handles requests made within 48 hours of purchase automatically,
                  and considers later ones case by case.
                </LI>
                <LI>
                  If Google declines and you believe the charge was genuinely wrong, write to us
                  anyway at <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. We cannot issue
                  the refund, but we can look at the account, confirm what happened, and support your
                  case with Google.
                </LI>
              </UL>
            </Section>

            <Section id="statutory" title="Your statutory rights">
              <P>
                Nothing in this policy takes away a right you have by law, and where the law gives
                you more than this policy does, the law wins.
              </P>
              <UL>
                <LI>
                  <Term>UK and EU:</Term> you generally have a 14-day right to withdraw from a
                  distance contract. Our 14-day web refund window above is written to meet it. Where
                  you asked for the service to start immediately, a provider may reduce a refund in
                  proportion to what you used; we do not do that within the 14 days.
                </LI>
                <LI>
                  <Term>Canada and the United States:</Term> consumer protection legislation in your
                  province or state may give you additional rights, including in respect of
                  automatically renewing subscriptions. Those rights apply regardless of this
                  document.
                </LI>
                <LI>
                  <Term>Australia:</Term> our services come with guarantees that cannot be excluded
                  under the Australian Consumer Law.
                </LI>
              </UL>
            </Section>

            <Section id="exceptions" title="When we may decline">
              <P>We may refuse a refund where:</P>
              <UL>
                <LI>the request is outside the 14-day window and none of the circumstances in the web
                  refunds section above apply;</LI>
                <LI>the account was terminated for a breach of the{' '}
                  <A href={LEGAL_PATHS.terms}>Terms of Service</A>;</LI>
                <LI>there is clear evidence of fraud, or of repeated purchase-and-refund of the same
                  membership.</LI>
              </UL>
              <P>
                If we decline, we will tell you why in plain language, and you keep every statutory
                right described above.
              </P>
            </Section>

            <Section id="how" title="How to ask for a refund">
              <P>
                Email <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> from the address on
                your Scorebug account, or reply directly to your receipt. Include:
              </P>
              <UL>
                <LI>the email address on the account;</LI>
                <LI>whether you bought on the web or in the Android app;</LI>
                <LI>the order or transaction reference from your receipt, if you have it;</LI>
                <LI>one line on what went wrong — it helps, but it is not a condition.</LI>
              </UL>
              <P>
                We aim to answer within two business days. We are a small independent studio, not a
                queue.
              </P>
            </Section>

            <Section id="changes" title="Changes to this policy">
              <P>
                We may update this policy as the product and its storefronts change. The version that
                applies to a purchase is the one published when you made it, and the date at the top
                of this page tells you when the wording last changed.
              </P>
            </Section>

            <Section id="contact" title="Contact">
              <P>
                Scorebug is operated by {COMPANY}, {COMPANY_LOCATION}. For anything about billing,
                cancellations or refunds, write to{' '}
                <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>.
              </P>
              <P>
                See also the <A href={LEGAL_PATHS.terms}>Terms of Service</A>, the{' '}
                <A href={LEGAL_PATHS.privacy}>Privacy Policy</A> and the{' '}
                <A href="/pricing">pricing page</A>.
              </P>
            </Section>
          </div>
        </main>

        <LegalFooter />
      </div>
    </div>
  )
}
