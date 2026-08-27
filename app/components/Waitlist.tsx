'use client'

/**
 * The Android tester signup.
 *
 * ─── WHY THIS IS A FORM AND NOT A LINK TO GOOGLE ─────────────────────────────
 * Every CTA used to point straight at
 * play.google.com/apps/testing/ca.scorebug.sports. That link only works for an
 * account ALREADY on the tester list in Play Console — a closed test admits
 * nobody else. So an uninvited visitor, which is everyone, tapped "Join the
 * test" and got Google's error page. That is worse than no button: it reads as
 * "this app is broken", and it happened at the exact moment someone decided
 * they wanted it.
 *
 * Open testing would remove the manual step. It needs production access we do
 * not have yet, so the honest flow is: capture the address, add it to the
 * tester list by hand, and let Google send the invite. The copy below says
 * exactly that, because a signup that implies instant access and then goes
 * quiet for a day is how a waiting list loses the person.
 *
 * ─── WHERE THE SIGNUP GOES ───────────────────────────────────────────────────
 * A row in `tester_signups` (database-v48.sql), which is INSERT-only to the
 * anon key — the table is write-only to the browser, because a readable signup
 * table is a harvestable list of names and addresses.
 *
 * If that table does not exist yet the insert 404s, and the submit FALLS BACK
 * to the original Supabase OTP call, which is proven to work on this project
 * today. That fallback is deliberate: the migration is a manual step, and a
 * lead lost because a table was not created yet is not recoverable.
 *
 * ─── NO SUPABASE SDK ─────────────────────────────────────────────────────────
 * One POST does not justify pulling @supabase/supabase-js (and its dependency
 * tree) into a marketing page whose entire JS budget is this form.
 */

import { useState } from 'react'
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  AUTH_CALLBACK,
  CONTACT_EMAIL,
} from '../config'

type Status = 'idle' | 'sending' | 'sent' | 'error'
type Platform = 'android' | 'ios' | 'web'

/** Deliberately permissive. Client-side email validation exists to catch typos
 *  like a missing @, not to enforce RFC 5322 — over-strict patterns reject real
 *  addresses (plus-tags, new TLDs) and the server validates anyway. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const PLATFORMS: { id: Platform; label: string; hint: string }[] = [
  { id: 'android', label: 'Android', hint: 'Join the closed test' },
  { id: 'ios', label: 'iPhone', hint: 'Be first when iOS lands' },
  { id: 'web', label: 'Just the web app', hint: 'No install needed' },
]

export default function Waitlist() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [platform, setPlatform] = useState<Platform>('android')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }

  /** The original OTP path, kept as a safety net — see the header note. */
  async function otpFallback(value: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(AUTH_CALLBACK)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: value,
            create_user: true,
            data: { source: 'waitlist', wants_android: platform === 'android', full_name: name.trim() },
          }),
        },
      )
      return res.ok
    } catch { return false }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    const who = name.trim()

    if (who.length < 2) {
      setStatus('error'); setMessage('Tell us your name so we know who to invite.'); return
    }
    if (!LOOKS_LIKE_EMAIL.test(value)) {
      setStatus('error'); setMessage('That does not look like an email address — check it and try again.'); return
    }

    setStatus('sending'); setMessage('')

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tester_signups`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ name: who, email: value, platform, source: 'site-waitlist' }),
      })

      if (res.ok) { setStatus('sent'); return }

      /* 23505 is Postgres' unique-violation. Someone signing up twice has done
         nothing wrong and is already on the list, so it is a SUCCESS to them —
         showing an error would make a correctly-registered fan try again. */
      if (res.status === 409) { setStatus('sent'); return }

      /* 404 = the migration has not been run. 401/403 = RLS is not in place
         yet. Either way the lead is real, so fall back rather than lose it. */
      if (res.status === 404 || res.status === 401 || res.status === 403) {
        if (await otpFallback(value)) { setStatus('sent'); return }
      }

      const body = await res.json().catch(() => null)
      setStatus('error')
      setMessage(body?.message || 'Something went wrong on our end. Try again shortly.')
    } catch {
      if (await otpFallback(value)) { setStatus('sent'); return }
      setStatus('error')
      setMessage('We could not reach the server. Check your connection and try again.')
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === 'sent') {
    const android = platform === 'android'
    return (
      <div className="glass-card mx-auto max-w-lg rounded-2xl px-7 py-9 text-center">
        <div
          aria-hidden
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'rgba(63,208,122,0.14)', border: '1px solid rgba(63,208,122,0.42)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3FD07A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </div>
        <h3 className="headline text-3xl text-white">You&apos;re on the list</h3>
        {/* Says what actually happens next, including that a person does it and
            it is not instant. A signup that implies immediate access and then
            goes quiet for a day is how a waiting list loses someone. */}
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
          {android ? (
            <>
              Thanks, {name.trim().split(' ')[0]}. We add testers to the Google Play list in
              batches, then Google emails your invite to{' '}
              <span className="font-bold text-ink">{email.trim()}</span>. It is a closed test,
              so the invite has to come from us — usually within a day.
            </>
          ) : (
            <>
              Thanks, {name.trim().split(' ')[0]}. We will email{' '}
              <span className="font-bold text-ink">{email.trim()}</span> the moment there is
              something to install on your platform.
            </>
          )}
        </p>
        <p className="mx-auto mt-5 max-w-sm text-[14px] leading-relaxed text-ink-2">
          You do not have to wait, though — the full app runs in your browser right now.
        </p>
        <a
          href="https://app.getscorebug.app"
          className="sb-cta enamel-red mt-5 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white"
        >
          Launch the web app
        </a>
        <p className="mt-4 text-[12.5px] text-ink-3">
          Questions?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink-2">{CONTACT_EMAIL}</a>
        </p>
      </div>
    )
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  // A section that renders nothing would leave the page's CTAs pointing at an
  // anchor that scrolls to empty space.
  if (!configured) {
    return (
      <div className="glass-card mx-auto max-w-lg rounded-2xl px-7 py-9 text-center">
        <h3 className="headline text-3xl text-white">Want in early?</h3>
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
          Email us and we will add you to the Android test list the moment it opens.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Scorebug Android test')}`}
          className="sb-cta enamel-red mt-6 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white"
        >
          Email {CONTACT_EMAIL}
        </a>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const busy = status === 'sending'
  return (
    <div className="glass-card mx-auto max-w-lg rounded-2xl px-7 py-9">
      <h3 className="headline text-center text-3xl text-white sm:text-4xl">
        Join the Android test
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-center text-[14.5px] leading-relaxed text-ink-2">
        Scorebug for Android is in closed testing, so invites go out from Google once we
        add you to the list. Tell us where to send yours — the web app works in the
        meantime.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="tester-name" className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
            Name
          </label>
          <input
            id="tester-name"
            type="text"
            required
            autoComplete="name"
            maxLength={80}
            placeholder="Alex Fontaine"
            value={name}
            onChange={e => { setName(e.target.value); if (status === 'error') setStatus('idle') }}
            disabled={busy}
            className="w-full rounded-xl bg-black/40 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition disabled:opacity-60"
            style={{ border: '1px solid rgba(255,255,255,0.14)' }}
          />
        </div>

        <div>
          <label htmlFor="tester-email" className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
            Email
          </label>
          {/* The address matters more here than on a normal signup: a Play
              closed test admits the GOOGLE ACCOUNT, so an address that is not
              the one on their phone gets an invite they cannot redeem. */}
          <input
            id="tester-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
            aria-invalid={status === 'error'}
            aria-describedby={status === 'error' ? 'waitlist-error' : 'tester-email-hint'}
            disabled={busy}
            className="w-full rounded-xl bg-black/40 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition disabled:opacity-60"
            style={{ border: '1px solid rgba(255,255,255,0.14)' }}
          />
          {platform === 'android' && (
            <p id="tester-email-hint" className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
              Use the Google account on your phone — Play sends the invite to that address.
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-ink-3">
            Platform
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLATFORMS.map(p => {
              const active = platform === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPlatform(p.id)}
                  disabled={busy}
                  className={`sb-cta min-h-[44px] rounded-xl px-3 py-2.5 text-left transition ${
                    active ? 'bg-white text-[#0a0b0e]' : 'glass-btn text-ink-2 hover:text-ink'
                  }`}
                >
                  <span className="block text-[13.5px] font-black">{p.label}</span>
                  <span className={`block text-[11px] ${active ? 'opacity-70' : 'text-ink-3'}`}>{p.hint}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="sb-cta enamel-red w-full rounded-xl px-6 py-3.5 text-[15px] font-black text-white disabled:opacity-60"
        >
          {busy ? 'Adding you…' : platform === 'android' ? 'Request my invite' : 'Keep me posted'}
        </button>

        {status === 'error' && (
          <p id="waitlist-error" role="alert" className="text-[13px] font-semibold" style={{ color: '#F87171' }}>
            {message}
          </p>
        )}

        <p className="text-center text-[12px] leading-relaxed text-ink-3">
          We email you about access, and nothing else. No marketing blasts, and we never
          sell your address.
        </p>
      </form>
    </div>
  )
}
