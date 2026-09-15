import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { OPS_COOKIE, opsConfigured, readStatus, sessionValid, type OpsEvent, type OpsMetrics } from '../lib/ops'

/**
 * SCOREBUG // ENGINE CONSOLE
 *
 * The marketing engine's control surface. The daily digest is the surface for
 * ordinary days — this is where you come when something in it needs looking
 * at, or when you want to change how the machine behaves.
 *
 * Everything here is a server-rendered form. There is no client JavaScript on
 * this route at all: no fetch, no state, no hydration. A control either
 * submitted or it did not, and the page you get back is the engine's actual
 * state rather than an optimistic guess at it.
 *
 * noindex, behind a password. See lib/ops.ts for why the auth is what it is.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Engine console',
  robots: { index: false, follow: false, nocache: true },
}

const NETWORKS = ['bluesky', 'mastodon', 'threads', 'x', 'instagram'] as const

function Button({ action, id, label, tone = 'blue', extra }: { action: string; id: string; label: string; tone?: 'blue' | 'teal' | 'gold' | 'red' | 'dim'; extra?: Record<string, string> }) {
  const colour = { blue: 'text-sb-blue border-sb-blue', teal: 'text-sb-teal border-sb-teal', gold: 'text-sb-gold border-sb-gold', red: 'text-sb-red border-sb-red', dim: 'text-ink-3 border-white/15' }[tone]
  return (
    <form action="/ops/act" method="post" className="inline">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={`mr-2 mt-2 inline-block rounded-md border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${colour}`}>{label}</button>
    </form>
  )
}

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-xl px-5 py-4">
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">{title}{count != null ? <span className="ml-2 text-ink-2">· {count}</span> : null}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <span className="text-[12px] uppercase tracking-wider text-ink-3">{label}</span>
      <span className="font-mono text-sm tabular-nums text-ink">{value}</span>
    </div>
  )
}

function why(e: OpsEvent): string {
  const g = e.game ?? {}
  if (g.postponed || g.canceled) return 'the game was called off — a person decides whether to mention it'
  if (/names a person/.test(e.note ?? '')) return 'a draft named a person — never automatic'
  if (/betting/.test(e.note ?? '')) return 'betting language in a draft — a bug, not a decision'
  if (g.headline) return 'the record carries a headline about a person'
  if (g.sport === 'racing') return 'a race: the winner is a named driver'
  if (e.note) return 'the linter stopped it'
  return 'autopilot is off'
}

const n = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? 'n/a' : String(v))

/**
 * React does not sanitise `href` or `src`. Everything below comes from engine
 * state — card URLs it built, publisher responses it stored — not from a
 * visitor, so this is defence in depth. But it is two lines on a page that is
 * one click away from "post to five networks", and on React 18 a `javascript:`
 * href renders with nothing but a console warning and runs on click.
 */
const httpsOnly = (u: unknown): string | null => {
  try { const p = new URL(String(u)); return p.protocol === 'https:' ? p.toString() : null } catch { return null }
}

export default async function OpsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const flashOk = typeof searchParams.ok === 'string' ? searchParams.ok : null
  const flashErr = typeof searchParams.err === 'string' ? searchParams.err : null
  const jar = cookies()
  const signedIn = sessionValid(jar.get(OPS_COOKIE)?.value)

  const shell = (children: React.ReactNode) => (
    <main id="main" className="relative min-h-screen overflow-hidden bg-canvas">
      <div className="relative z-10 mx-auto max-w-4xl px-5 pb-16 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sb-red">Scorebug // engine console</div>
            <h1 className="headline mt-1 text-2xl text-ink">The machine, on one page.</h1>
          </div>
          {signedIn ? (
            <form action="/ops/act" method="post"><input type="hidden" name="intent" value="signout" /><button className="text-[11px] uppercase tracking-wider text-ink-3">sign out</button></form>
          ) : null}
        </div>
        {/* Only for a signed-in owner. Anyone could put 180 characters of their
            own prose in `?err=`, and it rendered in a styled box directly above
            a real password field on the real getscorebug.app/ops over the real
            certificate — a credential-phishing lure served from the genuine
            origin. React escapes it, so it was never XSS; it was worse than
            XSS in the only way that matters, which is that it looked right. */}
        {signedIn && flashOk ? <p className="mt-4 rounded-md border border-sb-teal/40 px-3 py-2 text-sm text-sb-teal">{flashOk}</p> : null}
        {signedIn && flashErr ? <p className="mt-4 rounded-md border border-sb-red/40 px-3 py-2 text-sm text-sb-red">{flashErr}</p> : null}
        <div className="mt-6 space-y-5">{children}</div>
      </div>
    </main>
  )

  /* Order matters: the sign-in check comes FIRST. This branch used to be above
     it, so an anonymous GET to an unconfigured deployment was answered with the
     names of three secret environment variables and the script that writes
     them. The owner still needs to be told; a stranger does not. */
  if (!signedIn) {
    return shell(
      <Panel title="Sign in">
        <form action="/ops/act" method="post" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="intent" value="signin" />
          <input type="password" name="password" autoComplete="current-password" placeholder="console password" className="rounded-md border border-white/15 bg-card px-3 py-2 text-ink" />
          <button type="submit" className="rounded-md border border-sb-blue px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-sb-blue">Open</button>
        </form>
      </Panel>,
    )
  }

  if (!opsConfigured) return shell(<Panel title="Not configured"><p className="text-ink-2">Set DISPATCH_OPS_URL, DISPATCH_OPS_SECRET and OPS_CONSOLE_PASSWORD on this deployment. ignite.mjs writes the first two.</p></Panel>)

  const status = await readStatus()
  if (!status.ok) return shell(<Panel title="The engine did not answer"><p className="text-ink-2">{status.error}</p></Panel>)

  const { settings, policy, budget, health, facts, events, replies, reviews, metrics, newsletters, slots = {}, slotNotes = {} } = status.data
  const waiting = events.filter(e => e.status === 'approval')
  const refused = events.filter(e => e.status === 'refused' || e.status === 'stalled').slice(0, 10)
  const sent = events.filter(e => e.status === 'sent').sort((a, b) => ((a.sentAt ?? '') < (b.sentAt ?? '') ? 1 : -1)).slice(0, 14)
  const dry = events.filter(e => e.status === 'dry').slice(0, 10)
  const openReviews = reviews.filter(r => r.status === 'drafted' || r.status === 'needs-human')
  const openReplies = replies.filter(r => r.status === 'drafted')
  const mode = settings.dryRun ? 'DRY RUN' : settings.autopilot ? 'AUTOPILOT' : 'APPROVAL'
  const m: OpsMetrics = metrics[0] ?? {}
  const spentByLine: Record<string, number> = {}
  for (const e of budget.entries ?? []) spentByLine[e.line] = (spentByLine[e.line] ?? 0) + e.amount
  const spent = Object.values(spentByLine).reduce((s, v) => s + v, 0)
  const letter = newsletters.filter(x => !x.sentAt).sort((a, b) => (a.week < b.week ? 1 : -1))[0]
  const todaySlots = Object.entries(slots).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 10)

  return shell(
    <>
      <Panel title="State">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Row label="mode" value={settings.enabled === false ? 'PAUSED' : mode} />
            <Row label="posting to" value={health.publishers.length ? health.publishers.join(', ') : 'nothing yet'} />
            <Row label="not configured" value={health.missingSecrets.length ? health.missingSecrets.join(', ') : 'nothing'} />
            <Row label="site says" value={facts ? `${facts.stage ?? '?'} · ${facts.platforms ?? '?'}${facts.fallback ? ' (fallback)' : ''}` : 'no facts yet'} />
          </div>
          <div>
            {settings.enabled === false ? <Button action="resume" id="engine" label="Resume" tone="teal" /> : <Button action="pause" id="engine" label="Pause everything" tone="red" />}
            {settings.dryRun ? <Button action="golive" id="engine" label="End dry run" tone="teal" /> : <Button action="dryrun" id="engine" label="Back to dry run" tone="gold" />}
            {!settings.dryRun && !settings.autopilot ? <Button action="autopilot" id="engine" label="Autopilot on" tone="teal" /> : null}
            {settings.autopilot ? <Button action="autopilot-off" id="engine" label="Autopilot off" tone="gold" /> : null}
            <div className="mt-3 text-[11px] uppercase tracking-wider text-ink-3">networks</div>
            {NETWORKS.map(net => {
              const on = settings.networks?.[net] !== false
              return <Button key={net} action="network" id={net} label={`${net} ${on ? 'on' : 'off'}`} tone={on ? 'blue' : 'dim'} extra={{ on: on ? '0' : '1' }} />
            })}
          </div>
        </div>
      </Panel>

      <Panel title="The numbers">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Row label="games logged, 7d" value={n(m.product?.logs7d)} />
            <Row label="fans who logged, 7d" value={n(m.product?.loggers7d)} />
            <Row label="accounts" value={n(m.product?.fans)} />
            <Row label="front office" value={n(m.product?.premium)} />
          </div>
          <div>
            <Row label="android waitlist" value={`${n(m.product?.signups?.android)} · ${n(m.product?.signups?.invited)} invited`} />
            <Row label="slate list" value={n(m.product?.signups?.newsletter)} />
            <Row label="site sessions, 7d" value={n(m.site?.sessions)} />
            <Row label="followers" value={Object.entries(m.followers ?? {}).map(([k, v]) => `${k} ${v ?? 'n/a'}`).join(' · ') || 'n/a'} />
          </div>
        </div>
        {m.product?.error || m.site?.error ? <p className="mt-2 text-[12px] text-sb-gold">{[m.product?.error && `product: ${m.product.error}`, m.site?.error && `site: ${m.site.error}`].filter(Boolean).join(' · ')}</p> : null}
      </Panel>

      {/* Above the queue, and with no controls at all. A betting hit is a bug in
          a template, not a decision to take at breakfast — the engine marks it
          `refused` and nothing can approve it. A `stalled` send was interrupted
          and may or may not already be public, which is a thing to go and look
          at rather than a thing to click. */}
      {refused.length ? (
        <Panel title="Needs a fix, not a decision" count={refused.length}>
          {refused.map(e => (
            <div key={e.id} className="border-t border-white/5 py-3 first:border-0">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sb-red">{e.status} · {e.type}</div>
              <div className="mt-1 text-ink">{e.title}</div>
              <p className="mt-1 text-[13px] text-ink-2">
                {e.status === 'stalled'
                  ? 'A send was interrupted. Check the networks before doing anything with this one.'
                  : 'The linter refused this draft. Betting language is never approvable — fix the template that wrote it.'}
              </p>
              {e.note ? <p className="mt-1 font-mono text-[11px] text-sb-red">{e.note.slice(0, 300)}</p> : null}
            </div>
          ))}
        </Panel>
      ) : null}

      <Panel title="Waiting on you" count={waiting.length}>
        {waiting.length ? waiting.map(e => (
          <div key={e.id} className="border-b border-white/5 py-3 last:border-0">
            <div className="text-[11px] uppercase tracking-wider text-sb-gold">{e.type} · {why(e)}{e.networks?.length ? ` · → ${e.networks.join(', ')}` : ''}</div>
            <div className="mt-1 font-semibold text-ink">{e.title ?? e.id}</div>
            {httpsOnly(e.media?.publicUrl) ? <img src={httpsOnly(e.media?.publicUrl)!} alt={e.media?.alt ?? ''} width={320} className="mt-2 rounded-md border border-white/10" /> : null}
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-2">{e.texts?.bluesky ?? e.texts?.threads ?? e.texts?.x ?? ''}</pre>
            {e.note ? <div className="mt-1 font-mono text-[12px] text-sb-red">{e.note}</div> : null}
            <Button action="approve" id={e.id} label="Approve and send" tone="teal" />
            <Button action="skip" id={e.id} label="Skip" tone="dim" />
          </div>
        )) : <p className="text-ink-2">Nothing. The machine has no questions.</p>}
      </Panel>

      {openReplies.length ? (
        <Panel title="Mentions" count={openReplies.length}>
          {openReplies.map(r => (
            <div key={r.id} className="border-b border-white/5 py-3 last:border-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-3">{r.network} · @{r.author}{r.hostile ? <span className="ml-2 text-sb-red">flagged — the machine will not answer</span> : null}</div>
              <div className="mt-1 text-ink">{r.comment}</div>
              <ol className="mt-2 list-decimal pl-5 text-[14px] text-ink-2">{(r.candidates ?? []).map((c, i) => <li key={i}>{c}</li>)}</ol>
              {(r.candidates ?? []).map((_, i) => <Button key={i} action={`reply${i + 1}`} id={r.id} label={`Send ${i + 1}`} />)}
              <Button action="dismiss" id={r.id} label="Ignore" tone="dim" />
            </div>
          ))}
        </Panel>
      ) : null}

      {openReviews.length ? (
        <Panel title="Play reviews" count={openReviews.length}>
          {openReviews.map(r => (
            <div key={r.id} className="border-b border-white/5 py-3 last:border-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-3">{'★'.repeat(r.stars ?? 0)} · {r.author}</div>
              <div className="mt-1 text-ink">{r.text}</div>
              <div className="mt-2 border-l-2 border-white/10 pl-3 text-[14px] text-ink-2">{r.draft ?? 'no draft'}</div>
              {r.draft && !(r.problems ?? []).length ? <Button action="review" id={r.id} label="Send this reply" tone="teal" /> : null}
              <Button action="dismiss-review" id={r.id} label="Leave it" tone="dim" />
            </div>
          ))}
        </Panel>
      ) : null}

      <Panel title="What the machine decided">
        {(policy?.findings ?? []).length ? (policy!.findings!.map((f, i) => <p key={i} className="text-ink">{f.text}</p>)) : (
          <p className="text-ink-2">Still learning: {policy?.sampleSize ?? 0} measured posts. Chosen right now: {Object.values(policy?.chosen ?? {}).join(', ') || 'defaults'}. Below about two hundred posts this is noise wearing a graph.</p>
        )}
      </Panel>

      <Panel title="What went out" count={sent.length}>
        {sent.length ? sent.map(e => (
          <div key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-white/5 py-2 last:border-0">
            <span className="text-[11px] uppercase tracking-wider text-ink-3">{(e.sentAt ?? '').slice(0, 16).replace('T', ' ')}</span>
            <span className="font-semibold text-ink">{e.title ?? e.id}</span>
            <span className="text-[12px] text-ink-3">{Object.entries(e.postedUrls ?? {}).filter(([k, u]) => k !== 'blueskyUri' && !!httpsOnly(u)).map(([k, u]) => <a key={k} href={httpsOnly(u)!} target="_blank" rel="noopener noreferrer" className="mr-2 text-sb-blue">{k}</a>)}{(e.pending ?? []).length ? <span className="text-sb-gold">retrying {e.pending!.join(',')}</span> : null}</span>
          </div>
        )) : <p className="text-ink-2">Nothing yet.</p>}
      </Panel>

      {dry.length ? (
        <Panel title="Dry run — what it would have done" count={dry.length}>
          {dry.map(e => (
            <div key={e.id} className="border-b border-white/5 py-3 last:border-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-3">{e.type} → would have {e.route}{e.networks?.length ? ` on ${e.networks.join(', ')}` : ''}{e.score != null ? ` · score ${e.score}` : ''}</div>
              <div className="mt-1 font-semibold text-ink">{e.title ?? e.id}</div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-2">{e.texts?.bluesky ?? e.texts?.threads ?? e.texts?.x ?? ''}</pre>
            </div>
          ))}
        </Panel>
      ) : null}

      <Panel title="Slots fired" count={todaySlots.length}>
        {todaySlots.length ? todaySlots.map(([k, at]) => <Row key={k} label={k} value={`${String(at).slice(5, 16).replace('T', ' ')}${slotNotes[k] ? ` · ${slotNotes[k]}` : ''}`} />) : <p className="text-ink-2">No slot has fired yet.</p>}
      </Panel>

      <Panel title="Money">
        <Row label="spent" value={`CA$${spent} of CA$${budget.plan.total}`} />
        {budget.plan.lines.map(l => <Row key={l.id} label={l.label} value={`CA$${spentByLine[l.id] ?? 0} / ${l.cap} · from ${l.earliest}`} />)}
        <form action="/ops/act" method="post" className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="action" value="spend" /><input type="hidden" name="id" value="ledger" />
          <select name="line" className="rounded-md border border-white/15 bg-card px-2 py-1.5 text-ink">{budget.plan.lines.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          <input name="amount" type="number" min="1" step="1" placeholder="CA$" className="w-24 rounded-md border border-white/15 bg-card px-2 py-1.5 text-ink" />
          <input name="note" placeholder="what it bought" className="rounded-md border border-white/15 bg-card px-2 py-1.5 text-ink" />
          <button type="submit" className="rounded-md border border-sb-gold px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-sb-gold">Log a spend</button>
        </form>
        <p className="mt-2 text-[12px] text-ink-3">The machine never holds a card. You spend; you log it here; the digest does the arithmetic.</p>
      </Panel>

      {letter ? (
        <Panel title="The weekly slate email">
          <div className="text-[11px] uppercase tracking-wider text-ink-3">{letter.week} · {letter.approved ? 'approved — sends Monday 09:00' : 'draft'}</div>
          <div className="mt-1 font-semibold text-ink">{letter.subject}</div>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-2">{letter.body}</pre>
          {!letter.approved ? <Button action="newsletter" id={letter.week} label="Approve for Monday" tone="teal" /> : null}
        </Panel>
      ) : null}
    </>,
  )
}
