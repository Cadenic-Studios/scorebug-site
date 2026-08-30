import Image from 'next/image'
import type { Metadata } from 'next'
import {
  SITE, CONTACT_EMAIL, COMPANY, COMPANY_LOCATION,
  LEGAL_PATHS, LEGAL_UPDATED, LEGAL_UPDATED_ISO,
} from '../config'

/* ── THIS PAGE IS A STORE REQUIREMENT, NOT A COURTESY ─────────────────────────
 *
 * Google Play requires any app that lets people create an account to offer
 * deletion in TWO places: inside the app, and at a publicly reachable web URL
 * that a reviewer can open without installing anything and without signing in.
 * The URL is submitted in the Data safety form, and until the data-deletion
 * questions there are answered with a working link, Play blocks updates.
 *
 * Consequences for this file:
 *   · It must render as static HTML on getscorebug.app. That is why
 *     /account-deletion is not in the APP_ROUTES redirect list in
 *     next.config.js — see the note there.
 *   · It must be readable logged OUT. No auth, no app shell, no gated content.
 *   · It must be specific: what is deleted, what is kept and why, and how long
 *     it takes. A vague "contact us" page fails review.
 *
 * Keep the retention windows here identical to the ones in the Privacy Policy.
 * Two documents quoting different numbers is the version of this that gets
 * flagged. */

export const metadata: Metadata = {
  title: 'Delete your account',
  description:
    'How to delete your Scorebug account and data: in the app under Profile then Settings, or by email. What gets removed, what is retained, and how long it takes.',
  alternates: { canonical: `${SITE}${LEGAL_PATHS.accountDeletion}` },
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
          <a href={LEGAL_PATHS.terms} className="-my-2 py-2 hover:text-ink-2">Terms of Service</a>
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

/** `tone` is the whole point of this page's lists: red marks what is destroyed,
 *  blue marks what survives. Two colours, one meaning each. */
function LI({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'blue' }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2">
      <span
        aria-hidden
        className={`mt-[9px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
          tone === 'red' ? 'bg-sb-red' : 'bg-sb-blue'
        }`}
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

/** One of the two ways to start a deletion. Numbered, because a reviewer with
 *  no account has to be able to read the in-app route and believe it exists. */
function Route({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-sb-red">Option {n}</p>
      <h3 className="headline mt-1.5 text-2xl text-ink">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

export default function AccountDeletion() {
  return (
    <>
      <LegalHeader />

      <main>
        <section className="lit-red relative overflow-hidden">
          <div className="mx-auto max-w-2xl px-5 pb-12 pt-10">
            <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase text-sb-red">
              {/* theme(), not the literal hex: the palette lives in
                  tailwind.config.ts and is mirrored from the app. */}
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-sb-red shadow-[0_0_8px_theme(colors.sb-red)]" />
              Account &amp; data
            </p>
            <h1 className="headline mt-5 text-[3rem] text-white sm:text-[3.6rem]">
              Delete your
              <br />
              Scorebug account
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              You can delete your Scorebug account and everything in it at any time — from inside
              the app, or by emailing us. This page is the full account of what that removes, what
              is kept, and how long it takes.
            </p>
            <p className="mt-4 text-[13px] text-ink-3">
              Applies to Scorebug (<span className="tabular-nums">ca.scorebug.sports</span>) and the
              Scorebug app, published by {COMPANY}. Last updated{' '}
              <time dateTime={LEGAL_UPDATED_ISO}>{LEGAL_UPDATED}</time>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-5 pb-24">
          {/* An h2 the two Route cards' h3s can belong to. Without it the page
              jumps h1 → h3 and a screen reader announces the options as
              subheadings of nothing. */}
          <h2 className="headline text-2xl text-ink sm:text-3xl">Two ways to start</h2>

          <div className="mt-4 space-y-4">
            <Route n={1} title="In the app">
              <P>
                Open Scorebug, go to <Term>Profile</Term>, open the{' '}
                <Term>Settings</Term> tab and scroll to the bottom. Choose{' '}
                <Term>Delete account</Term>, then type your email address to confirm. The
                deletion runs immediately and your session ends.
              </P>
              <P>
                This is the fastest route and needs nothing from us. It works in the Android app
                and in Scorebug Online.
              </P>
            </Route>

            <Route n={2} title="By email">
              <P>
                If you cannot reach the app — you have uninstalled it, or you have lost access to
                your sign-in — email{' '}
                <A href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20account`}>{CONTACT_EMAIL}</A>{' '}
                with the subject <Term>Delete my account</Term>.
              </P>
              <P>
                Send it <Term>from the email address on the account</Term>. That is how we confirm
                the request is yours; if you cannot, we will ask you for something else that proves
                it before deleting anything. We will not delete an account on the say-so of an
                address we cannot tie to it.
              </P>
            </Route>
          </div>

          {/* Sits above the fold-out detail on purpose. Deleting the account
              while a Play subscription is still live is the one way a person
              can be charged after leaving, and Play billing genuinely is
              outside our reach — we cannot cancel it for you. */}
          <div className="glass-card mt-4 rounded-2xl border-l-2 border-l-sb-gold px-5 py-5 sm:px-6">
            <h2 className="text-[15px] font-bold text-ink">
              Cancel a Front Office subscription first
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Deleting your Scorebug account does <Term>not</Term> cancel an active Google Play
              subscription — Google is the merchant, and only you can cancel it. Open the Google
              Play app, go to <Term>Payments &amp; subscriptions → Subscriptions</Term>, choose
              Scorebug and cancel. Do that before deleting the account, or the renewal will keep
              charging with no app attached to it.
            </p>
          </div>

          <div className="mt-12 space-y-10">
            <Section id="removed" title="What deletion removes">
              <P>Permanently, from our live systems:</P>
              <UL>
                <LI>Your <Term>account</Term> and the sign-in identities attached to it — email and password, Google, Discord.</LI>
                <LI>Your <Term>profile</Term> — email address, display name and avatar.</LI>
                <LI>Your <Term>game logs</Term>, and everything in them: ratings out of 5, written notes, and the perspective each was logged from.</LI>
                <LI>Your <Term>photos</Term>, deleted from private storage.</LI>
                <LI>Your <Term>on-deck list</Term> and your saved <Term>clippings</Term>.</LI>
                <LI>Your <Term>cheers, comments and accolades</Term>.</LI>
                <LI>Your <Term>follows</Term> — teams and fans — and other accounts&apos; follows of you.</LI>
                <LI>Your <Term>device tokens</Term>, so push notifications stop reaching every device you had signed in.</LI>
              </UL>
              <P>
                <Term>This cannot be undone.</Term> There is no restore, no grace period and no
                archived copy we can hand back. If you want to keep your logs, export them before
                you start — email us and we will send you a copy of your data first.
              </P>
            </Section>

            <Section id="retained" title="What is retained, and why">
              <P>
                Three things outlive the account, and none of them are your logs:
              </P>
              <UL>
                <LI tone="blue">
                  <Term>Purchase and tax records.</Term> If you ever subscribed to The Front Office,
                  the record of that transaction is retained for as long as Canadian tax and
                  accounting law requires. Most of it is held by Google Play and RevenueCat rather
                  than by us, and it is not something we are able to erase on request.
                </LI>
                <LI tone="blue">
                  <Term>Encrypted backups.</Term> Backups are taken on a rolling cycle and
                  overwritten within 90 days. Your data disappears from them as they cycle. They
                  are never used to restore a deleted account.
                </LI>
                <LI tone="blue">
                  <Term>Abuse and security records.</Term> If an account was involved in a security
                  incident or a serious violation of the{' '}
                  <A href={LEGAL_PATHS.terms}>Terms of Service</A>, we may keep the minimum record
                  needed to enforce a ban or to meet a legal obligation. This is rare, and it never
                  includes your logs, notes or photos.
                </LI>
              </UL>
              <P>
                Anything else we hold that has been stripped of every link to you — aggregate
                counts, for example — is no longer personal information and is not restored or
                re-associated with anyone.
              </P>
            </Section>

            <Section id="timing" title="How long it takes">
              <UL>
                <LI tone="blue"><Term>Immediately</Term> — your account is disabled, your sessions end, and you can no longer sign in.</LI>
                <LI tone="blue"><Term>Within 30 days</Term> — your data is purged from our live systems.</LI>
                <LI tone="blue"><Term>Within 90 days</Term> — the last encrypted backups containing it have been overwritten.</LI>
              </UL>
              <P>
                Requests sent by email are verified and then completed on the same schedule, within
                30 days of the request. We will confirm by email when the deletion is done.
              </P>
            </Section>

            <Section id="alternatives" title="If you do not want to delete everything">
              <P>
                Deleting the whole account is not the only lever. You can delete individual game
                logs, notes and photos from inside the app and keep the rest of your archive; turn
                off push notifications in your device settings; or unfollow teams and fans without
                touching anything you have written.
              </P>
              <P>
                If something specific is bothering you, tell us at{' '}
                <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> — a fixable annoyance is a
                bad reason to lose a lifetime archive.
              </P>
            </Section>

            <Section id="contact" title="Questions">
              <P>
                {COMPANY}
                <br />
                {COMPANY_LOCATION}
                <br />
                <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>
              </P>
              <P>
                For the full account of what we store and why, see the{' '}
                <A href={LEGAL_PATHS.privacy}>Privacy Policy</A>. For the rules of the service, see
                the <A href={LEGAL_PATHS.terms}>Terms of Service</A>.
              </P>
            </Section>
          </div>
        </div>
      </main>

      <LegalFooter />
    </>
  )
}
