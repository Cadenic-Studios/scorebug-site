'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { GearTeam } from '../lib/teams'

/**
 * The interactive gear index: live search + league chips over the full 154-club
 * list.
 *
 * ─── WHY A CLIENT COMPONENT OVER 154 STATIC CARDS ────────────────────────────
 * At 32 clubs the server-rendered grouped list was enough to scan. At 154 it is
 * not — a fan wants their team in one keystroke, not a scroll through five
 * leagues. Search + chips is the difference between "browse" and "find".
 *
 * ─── BUT THE LINKS ARE STILL REAL, CRAWLABLE ANCHORS ─────────────────────────
 * Every card is a plain <Link href="/gear/slug">. The filtering is presentation
 * only — the full set is in the initial HTML, so a crawler sees all 154 team
 * URLs whether or not JavaScript runs, and a fan with a slow connection can
 * still tap through before hydration. Nothing here is fetched; the list is
 * passed in from the server component as a prop.
 */
export default function GearBrowser({ teams }: { teams: GearTeam[] }) {
  const [q, setQ] = useState('')
  const [league, setLeague] = useState<string | null>(null)

  const leagues = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of teams) counts[t.league] = (counts[t.league] || 0) + 1
    // Keep the canonical league order, not insertion order.
    return (['NHL', 'NFL', 'NBA', 'MLB', 'MLS'] as const)
      .filter(l => counts[l])
      .map(l => ({ league: l, count: counts[l], color: teams.find(t => t.league === l)!.color }))
  }, [teams])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return teams.filter(t => {
      if (league && t.league !== league) return false
      if (!needle) return true
      // Match name, short and city fragment (slug carries the city).
      return (
        t.name.toLowerCase().includes(needle) ||
        t.short.toLowerCase().includes(needle) ||
        t.slug.replace(/-/g, ' ').includes(needle)
      )
    })
  }, [teams, q, league])

  const byLeague = useMemo(() => {
    const m: Record<string, GearTeam[]> = {}
    for (const t of shown) (m[t.league] ||= []).push(t)
    return m
  }, [shown])

  const order = (['NHL', 'NFL', 'NBA', 'MLB', 'MLS'] as const).filter(l => byLeague[l]?.length)

  return (
    <div className="mt-10">
      {/* ── Search + chips: sticky so they stay reachable down a long list ──
          top-0 because the page has no sticky header of its own to offset. The
          negative margin + padding bleeds the sticky bar's dark backing to the
          container edges so cards don't show through above it. */}
      <div className="sticky top-0 z-20 -mx-5 mb-8 border-b border-white/10 bg-[#0a0b0e]/85 px-5 py-4 backdrop-blur-md">
        <label className="sr-only" htmlFor="gear-search">Search teams</label>
        <input
          id="gear-search"
          type="search"
          inputMode="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search your team…"
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none ring-1 ring-white/10 transition focus:ring-white/25"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={league === null} onClick={() => setLeague(null)} color="#A8B3BF" label={`All ${teams.length}`} />
          {leagues.map(l => (
            <Chip
              key={l.league}
              active={league === l.league}
              onClick={() => setLeague(league === l.league ? null : l.league)}
              color={l.color}
              label={`${l.league} ${l.count}`}
            />
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="glass-card rounded-2xl px-7 py-14 text-center">
          <p className="text-[15px] font-bold text-ink">No club by that name here</p>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
            This hub covers the NHL, NFL, NBA, MLB and MLS. Your team may still be
            in the app — it tracks {'>'}790 clubs across every league.
          </p>
        </div>
      ) : (
        order.map(lg => (
          <section key={lg} className="mb-12">
            <h2 className="headline text-2xl text-ink sm:text-3xl">{lg}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {byLeague[lg].map(t => (
                <Link
                  key={t.slug}
                  href={`/gear/${t.slug}`}
                  className="glass-card group flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/20"
                >
                  <span
                    aria-hidden
                    className="h-8 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: t.color, boxShadow: `0 0 10px ${t.color}66` }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold text-ink">{t.short}</span>
                    <span className="block truncate text-[11px] text-ink-3">{t.name}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function Chip({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // py-2 gets the control to a 40px+ tap target; the chip row is the primary
      // filter affordance and must be comfortably tappable on a phone.
      className="rounded-full px-3.5 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition"
      style={
        active
          ? { background: color, color: '#0a0b0e', boxShadow: `0 0 16px -4px ${color}` }
          : { background: 'rgba(255,255,255,0.04)', color: '#A8B3BF', border: '1px solid rgba(255,255,255,0.1)' }
      }
    >
      {label}
    </button>
  )
}
