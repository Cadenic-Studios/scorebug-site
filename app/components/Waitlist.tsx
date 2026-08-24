'use client'

/**
 * Waitlist — the Android early-access signup.
 *
 * ─── IT IS A REAL ACCOUNT SIGNUP, NOT A MAILING LIST ─────────────────────────
 * Submitting calls Supabase's passwordless OTP endpoint with `create_user`,
 * which does three useful things at once:
 *
 *   1. Creates a genuine Scorebug account, so when the Play closed test opens
 *      the tester list is already a table of confirmed email addresses — no
 *      export-and-import step, no reconciling a separate waitlist table against
 *      real users.
 *   2. Sends the branded "Confirm signup" email (Supabase picks that template
 *      for an address it has not seen; existing addresses get "Magic Link"
 *      instead), so the acknowledgement uses the same design system as every
 *      other transactional mail rather than a second one that drifts.
 *   3. Hands them the WEB APP immediately. That is the honest version of this
 *      page: Android is not ready, the browser build is, and a waitlist email
 *      that ends in a working product beats one that ends in "we'll be in
 *      touch."
 *
 * `source: 'waitlist'` in user metadata is what makes the list queryable later:
 *   select email from auth.users where raw_user_meta_data->>'source' = 'waitlist';
 *
 * ─── NO SUPABASE SDK ─────────────────────────────────────────────────────────
 * One POST does not justify pulling @supabase/supabase-js (and its dependency
 * tree) into a marketing page whose entire JS budget is this form. The request
 * below is exactly what `signInWithOtp` serialises to.
 */

import { useState } from 'react'
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  AUTH_CALLBACK,
  CONTACT_EMAIL,
  LAUNCH_STAGE,
} from '../config'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/** Deliberately permissive. Client-side email validation exists to catch typos
 *  like a missing @, not to enforce RFC 5322 — over-strict patterns reject real
 *  addresses (plus-tags, new TLDs) and the server validates anyway. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Waitlist() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!LOOKS_LIKE_EMAIL.test(value)) {
      setStatus('error')
      setMessage('That does not look like an email address — check it and try again.')
      return
    }

    setStatus('sending')
    setMessage('')

    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(AUTH_CALLBACK)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: value,
            create_user: true,
            data: { source: 'waitlist', wants_android: true },
          }),
        },
      )

      if (res.ok) {
        setStatus('sent')
        return
      }

      // Supabase answers a throttled sender with 429. Saying "try again" without
      // saying WHY reads as a broken form; naming the wait makes it a queue.
      if (res.status === 429) {
        setStatus('error')
        setMessage('We are sending a lot of mail right now. Give it a minute and try again.')
        return
      }

      const body = await res.json().catch(() => null)
      setStatus('error')
      setMessage(
        (body?.error_description || body?.msg || body?.message) ??
          'Something went wrong on our end. Try again shortly.',
      )
    } catch {
      setStatus('error')
      setMessage('We could not reach the server. Check your connection and try again.')
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  //
  // The SAME copy regardless of whether the address was new or already had an
  // account. Distinguishing them would turn this form into an account-existence
  // oracle: anyone could type an address and learn whether that person uses
  // Scorebug. The email itself is correct either way.
  if (status === 'sent') {
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
        <h3 className="headline text-3xl text-white">Check your inbox</h3>
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
          We sent a confirmation link to <span className="font-bold text-ink">{email.trim()}</span>.
          Open it and you are on the Android list — and signed straight into the web app,
          which works right now.
        </p>
        <p className="mt-4 text-[12.5px] text-ink-3">
          Nothing after a few minutes? Check spam, or write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink-2">{CONTACT_EMAIL}</a>.
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
          className="enamel-red mt-6 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white transition active:scale-[0.98]"
        >
          Email {CONTACT_EMAIL}
        </a>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="glass-card mx-auto max-w-lg rounded-2xl px-7 py-9">
      <h3 className="headline text-center text-3xl text-white sm:text-4xl">
        {LAUNCH_STAGE === 'testing' ? 'Become a tester' : 'Get the Android build first'}
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-center text-[14.5px] leading-relaxed text-ink-2">
        Scorebug for Android is in testing. Leave your email and we will send your invite
        the moment a spot opens — plus instant access to the web app in the meantime.
      </p>

      <form onSubmit={submit} className="mt-7">
        <label htmlFor="waitlist-email" className="sr-only">Email address</label>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            id="waitlist-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
            aria-invalid={status === 'error'}
            aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
            disabled={status === 'sending'}
            className="min-w-0 flex-1 rounded-xl bg-black/40 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition disabled:opacity-60"
            style={{ border: '1px solid rgba(255,255,255,0.14)' }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="enamel-red flex-shrink-0 rounded-xl px-6 py-3.5 text-[15px] font-black text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Join the test'}
          </button>
        </div>

        {status === 'error' && (
          <p id="waitlist-error" role="alert" className="mt-3 text-[13px] font-semibold" style={{ color: '#F87171' }}>
            {message}
          </p>
        )}

        <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-3">
          One email to confirm, then only when Android access is ready. No marketing blasts,
          and we never sell your address.
        </p>
      </form>
    </div>
  )
}
