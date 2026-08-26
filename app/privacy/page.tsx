import Image from 'next/image'
import type { Metadata } from 'next'
import {
  SITE, CONTACT_EMAIL, COMPANY, COMPANY_LOCATION,
  LEGAL_PATHS, LEGAL_UPDATED, LEGAL_UPDATED_ISO,
} from '../config'

/* ── Why this page lives on the marketing domain ──────────────────────────────
 *
 * Google Play takes the privacy-policy URL as a typed field and fetches it
 * itself. It has to answer 200 on getscorebug.app, without an app shell,
 * without JavaScript and without a sign-in. That is why /privacy was pulled out
 * of the APP_ROUTES redirect allow-list in next.config.js — see the long note
 * there before adding it back.
 *
 * EVERY CLAIM BELOW IS A CLAIM ABOUT THE SHIPPING APP. Boilerplate is not free
 * here: naming a vendor we do not use, or a sign-in method we have not built,
 * is a false statement in a binding document. Nothing goes in this file that
 * cannot be pointed at in the app's code.
 */

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Scorebug handles your account, your game logs, your photos and your notifications — what we collect, who processes it, and the rights you have over it.',
  alternates: { canonical: `${SITE}${LEGAL_PATHS.privacy}` },
}

/* ── Shared page furniture ───────────────────────────────────────────────────
 * Deliberately local to this file rather than a shared component. The three
 * legal pages are the only pages on the site with this layout, they are edited
 * one at a time and rarely, and a shared wrapper would put a build-breaking
 * dependency between two documents that a lawyer may want to change
 * independently. The duplication is the cheaper mistake. */

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
        className="mt-[9px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sb-blue"
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

/** The one term that has to survive skimming: what we do NOT do. */
function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

const CONTENTS: { id: string; label: string }[] = [
  { id: 'who-we-are', label: 'Who we are' },
  { id: 'accounts', label: 'Accounts and sign-in' },
  { id: 'your-content', label: 'What you create in Scorebug' },
  { id: 'photos', label: 'Photos' },
  { id: 'notifications', label: 'Push notifications' },
  { id: 'advertising', label: 'Advertising' },
  { id: 'subscriptions', label: 'Subscriptions and payments' },
  { id: 'affiliate-links', label: 'Affiliate links' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'processors', label: 'Who else touches your data' },
  { id: 'legal-bases', label: 'Why we are allowed to use it' },
  { id: 'rights', label: 'Your rights and choices' },
  { id: 'deletion', label: 'Deleting your account' },
  { id: 'retention', label: 'How long we keep things' },
  { id: 'security', label: 'Security' },
  { id: 'children', label: "Children's privacy" },
  { id: 'transfers', label: 'Where your data is processed' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact' },
]

export default function PrivacyPolicy() {
  return (
    <>
      <LegalHeader />

      <main>
        <section className="lit-blue relative overflow-hidden">
          {/* The measure is set on the prose column, not the page. Legal copy
              read left-aligned at ~75 characters is the whole difference
              between a policy someone skims and a wall nobody opens. */}
          <div className="mx-auto max-w-2xl px-5 pb-12 pt-10">
            <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase text-sb-blue">
              {/* theme(), not the literal hex: the palette lives in
                  tailwind.config.ts and is mirrored from the app. */}
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-sb-blue shadow-[0_0_8px_theme(colors.sb-blue)]" />
              Legal
            </p>
            <h1 className="headline mt-5 text-[3rem] text-white sm:text-[3.6rem]">Privacy Policy</h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              Scorebug is a log of the games you watch. This page says exactly what that means for
              your data: what we store, who processes it, and how to get it back or get rid of it.
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
            <Section id="who-we-are" title="Who we are">
              <P>
                Scorebug is built and operated by {COMPANY}, {COMPANY_LOCATION}. In this policy,
                “we” and “us” mean {COMPANY}; “Scorebug” means the Scorebug web app at
                app.getscorebug.app and the Scorebug Android app.
              </P>
              <P>
                We are the controller of the personal information described here. You can reach a
                human at <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> about anything on
                this page.
              </P>
            </Section>

            <Section id="accounts" title="Accounts and sign-in">
              <P>
                Accounts are handled by <Term>Supabase</Term>, which stores your credentials and
                issues your session. You can sign in three ways: an email address and password, a{' '}
                <Term>Google</Term> account, or a <Term>Discord</Term> account.
              </P>
              <P>
                When you use Google or Discord, that provider tells us your email address and, if
                you have one set with them, a display name and avatar image. We never see your
                Google or Discord password. When you use email and password, Supabase stores the
                password as a salted hash — we cannot read it, and neither can support.
              </P>
              <P>The account record itself holds your email address, your display name and your avatar.</P>
            </Section>

            <Section id="your-content" title="What you create in Scorebug">
              <P>
                Almost everything else we store is something you deliberately made. That includes:
              </P>
              <UL>
                <LI>
                  <Term>Game logs</Term> — the game, your rating out of 5, your written notes, and
                  the perspective you logged it from.
                </LI>
                <LI><Term>Your on-deck list</Term> — games you have lined up to watch.</LI>
                <LI><Term>Clippings</Term> — news items and pages you saved.</LI>
                <LI><Term>Cheers and comments</Term> — the reactions and replies you leave on entries.</LI>
                <LI><Term>Follows</Term> — the teams and the fans you follow.</LI>
                <LI><Term>Accolades</Term> — the milestones your logging history has earned.</LI>
              </UL>
              <P>
                Where an entry is visible depends on where you put it. Anything you post into a
                community area of the app — a comment, a cheer — is visible to other fans by
                design. Your photos are never part of that; see the next section.
              </P>
            </Section>

            <Section id="photos" title="Photos">
              <P>
                Photos you attach to a game log are stored in <Term>Supabase Storage</Term> in a
                private bucket. They are not public files with hard-to-guess names — the bucket
                refuses anonymous reads outright.
              </P>
              <P>
                When the app needs to show you one of your photos, it asks the server for a{' '}
                <Term>short-lived signed URL</Term> that expires shortly after it is issued. Your
                photos are never posted publicly, never attached to community entries, and never
                used in marketing.
              </P>
            </Section>

            <Section id="notifications" title="Push notifications">
              <P>
                Push is <Term>opt-in</Term>. If you turn it on, <Term>Firebase Cloud Messaging</Term>{' '}
                issues a token that identifies that one device, and we store the token against your
                account so we know where to deliver. One token per device you enable.
              </P>
              <P>
                Turning notifications off in your device settings, or deleting your account, ends
                this. Device tokens are deleted with the account.
              </P>
            </Section>

            <Section id="advertising-practices" title="Advertising">
            {/* id renamed from the bare word: EasyList's generic cosmetic
                rules hide elements by common ad-ish ids, and a hidden section
                of the privacy policy/terms is invisible precisely to the
                ad-block users it most concerns — including a Play reviewer
                running one. Nothing linked to the old anchor. */}
              <P>
                Free accounts see ads. On Android they are served by <Term>Google AdMob</Term>, and
                on the web by <Term>Google AdSense</Term>. Members of The Front Office, our paid
                tier, do not see ads.
              </P>
              <P>
                Those ad services may use an <Term>advertising identifier</Term> — a resettable ID
                held by your device or browser, not by us — to limit repeats and to measure whether
                an ad worked. We do not send your email address, your logs, your notes or your
                photos to any ad network.
              </P>
              <P>
                We do not <Term>sell</Term> your personal information for money. Serving ads through
                AdMob and AdSense can count as “sharing” for cross-context behavioural advertising
                under California law. You can limit it at the source: reset or delete the
                advertising ID in your Android settings under Privacy → Ads, or use{' '}
                <A href="https://adssettings.google.com">Google&apos;s ad settings</A> on the web.
                Subscribing removes the ads entirely.
              </P>
            </Section>

            <Section id="subscriptions" title="Subscriptions and payments">
              <P>
                The Front Office is billed through <Term>Google Play Billing</Term> and managed with{' '}
                <Term>RevenueCat</Term>. Google takes the payment and holds the payment
                instrument — <Term>we never see your card number</Term>. What comes back to us is
                whether an account has an active entitlement, and the receipt behind it.
              </P>
              <P>
                RevenueCat receives an app user ID and the store receipt so it can tell the app
                whether your subscription is live. Refunds, cancellations and billing history stay
                with Google Play.
              </P>
            </Section>

            <Section id="affiliate-links" title="Affiliate links">
              <P>
                Some outbound links in Scorebug — tickets, merchandise, memorabilia — are affiliate
                links, which means we may earn a commission if you buy something. They go to{' '}
                <Term>CJ</Term>, the <Term>eBay Partner Network</Term>, <Term>Impact</Term> and{' '}
                <Term>TicketNetwork</Term>.
              </P>
              <P>
                Once you tap one you are on that company&apos;s site, and they set their own cookies
                and identifiers to attribute the click. What happens there is governed by their
                privacy policies, not this one. We do not send them your account, your email or
                anything you have logged.
              </P>
            </Section>

            <Section id="analytics" title="Analytics">
              <P>
                Our analytics are <Term>minimal and first-party</Term>: counts of what got used, so
                we know which parts of the app are worth improving. We do not embed a third-party
                analytics vendor, and there is no cross-site tracking pixel in Scorebug.
              </P>
            </Section>

            <Section id="processors" title="Who else touches your data">
              <P>
                We use a small number of service providers, each for one job, and each bound to use
                the data only to do that job:
              </P>
              <UL>
                <LI><Term>Supabase</Term> — the database, authentication and photo storage.</LI>
                <LI><Term>Google Firebase</Term> — push notification delivery.</LI>
                <LI><Term>Google AdMob and AdSense</Term> — ads for free accounts.</LI>
                <LI><Term>Google Play Billing and RevenueCat</Term> — subscription payments and entitlements.</LI>
                <LI><Term>Vercel</Term> — hosting for the web app and this site.</LI>
                <LI>
                  Sports scores, schedules and news come from third-party data providers. Those are
                  requests for public sports data — no account information travels with them.
                </LI>
              </UL>
              <P>
                Beyond that, we disclose personal information only when the law requires it, or
                where it is necessary to investigate abuse or protect someone&apos;s safety.
              </P>
            </Section>

            <Section id="legal-bases" title="Why we are allowed to use it">
              <P>If you are in the UK, the EU or Switzerland, our legal bases under the GDPR are:</P>
              <UL>
                <LI>
                  <Term>Performance of a contract</Term> — your account, your logs, your
                  subscription. Without this data there is no app to provide.
                </LI>
                <LI>
                  <Term>Consent</Term> — push notifications, and personalised advertising where
                  consent is required. You can withdraw it at any time.
                </LI>
                <LI>
                  <Term>Legitimate interests</Term> — keeping the service secure, preventing abuse,
                  and understanding which features are used.
                </LI>
                <LI><Term>Legal obligation</Term> — tax and accounting records for purchases.</LI>
              </UL>
            </Section>

            <Section id="rights" title="Your rights and choices">
              <P>
                Depending on where you live, PIPEDA (Canada), the GDPR (UK/EU) or the CCPA/CPRA
                (California) give you rights over this data. We extend the same handling to
                everyone rather than checking your address first:
              </P>
              <UL>
                <LI><Term>Access</Term> — ask what we hold about you and get a copy.</LI>
                <LI><Term>Correction</Term> — fix anything inaccurate. Most of it you can edit in the app directly.</LI>
                <LI><Term>Deletion</Term> — remove your account and its data. See below.</LI>
                <LI><Term>Portability</Term> — receive your logs in a machine-readable format.</LI>
                <LI><Term>Objection and restriction</Term> — object to a particular use, or ask us to pause it.</LI>
                <LI><Term>Withdraw consent</Term> — turn off notifications, or reset your advertising ID.</LI>
                <LI><Term>Opt out of “sharing”</Term> for cross-context behavioural advertising, as described above.</LI>
                <LI><Term>Non-discrimination</Term> — exercising any of these never costs you access or features.</LI>
              </UL>
              <P>
                Email <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> from the address on
                your account and we will answer within 30 days. If you are not satisfied, you can
                complain to your data protection authority — in Canada, the Office of the Privacy
                Commissioner; in the EU or UK, your local supervisory authority.
              </P>
            </Section>

            <Section id="deletion" title="Deleting your account">
              <P>
                You can delete your account yourself, from inside the app or from the web, without
                asking us. The full list of what goes, what is kept and how long it takes has its
                own page:
              </P>
              <P>
                <A href={LEGAL_PATHS.accountDeletion}>How to delete your Scorebug account →</A>
              </P>
            </Section>

            <Section id="retention" title="How long we keep things">
              <P>
                We keep your account and everything in it for as long as your account exists —
                that is the point of a lifetime archive.
              </P>
              <UL>
                <LI>
                  When you delete your account, your data is purged from our live systems{' '}
                  <Term>within 30 days</Term>.
                </LI>
                <LI>
                  Encrypted backups roll off on their own cycle and are overwritten{' '}
                  <Term>within 90 days</Term>. They are never used to restore a deleted account.
                </LI>
                <LI>
                  Purchase and tax records are retained as long as Canadian law requires, and are
                  held by Google Play and RevenueCat as much as by us.
                </LI>
              </UL>
            </Section>

            <Section id="security" title="Security">
              <UL>
                <LI>Everything moves over <Term>TLS</Term>. There is no unencrypted endpoint.</LI>
                <LI>
                  The database enforces <Term>row-level security</Term>: the rules that decide who
                  can read a row live in the database itself, not in app code, so one account
                  cannot read another&apos;s rows even if a client is tampered with.
                </LI>
                <LI>
                  Keys are <Term>scoped</Term>. The key the browser and the app carry can only do
                  what a signed-in user is allowed to do; privileged keys stay server-side and are
                  never shipped to a client.
                </LI>
                <LI>Photo buckets are private, and are read only through expiring signed URLs.</LI>
              </UL>
              <P>
                No system is perfect. If we ever discover a breach affecting your personal
                information, we will notify you and the relevant regulator as the law requires.
              </P>
            </Section>

            <Section id="children" title="Children's privacy">
              <P>
                Scorebug is not directed to children under 13, and we do not knowingly collect
                personal information from them. If you believe a child has created an account,
                write to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> and we will remove
                the account and its data.
              </P>
            </Section>

            <Section id="transfers" title="Where your data is processed">
              <P>
                We are based in Canada. Our providers — Supabase, Google, RevenueCat and Vercel —
                operate infrastructure in the United States and other countries, so your data may
                be processed outside the country you live in, and may be accessible to courts and
                authorities there under local law.
              </P>
              <P>
                For transfers out of the UK, EU or Switzerland we rely on the European Commission&apos;s
                Standard Contractual Clauses in our agreements with those providers.
              </P>
            </Section>

            <Section id="changes" title="Changes to this policy">
              <P>
                If we change this policy we update the date at the top of the page. If the change
                is material — a new category of data, a new processor, a new purpose — we will say
                so in the app before it takes effect, and we will not apply it retroactively to
                data you gave us under an older version.
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
                See also our <A href={LEGAL_PATHS.terms}>Terms of Service</A> and{' '}
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
