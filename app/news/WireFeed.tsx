'use client'

import { useMemo, useState } from 'react'
import { ticketNetworkTeamUrl } from '../lib/affiliates'
import Sponsored, { AffiliateLink } from '../components/Sponsored'
import { AppCta } from '../components/SiteChrome'

/**
 * The Wire's interactive feed: league filter chips + a Latest/By-league sort,
 * over headlines fetched on the server.
 *
 * ─── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * It is NOT a thumbnail grid. news_cache carries an `image_url`, but those are
 * hotlinked, copyrighted publisher images (ESPN, BBC, CFL.ca). Rendering them on
 * a monetised page is straightforward infringement and would force the CSP's
 * img-src open to every publisher host. The visual interest here comes from OUR
 * OWN treatment instead — a league-coloured accent per item — so the feed reads
 * as designed without republishing anyone's artwork. Headline + source + a link
 * out is the aggregator's line; the picture is where it becomes scraping.
 *
 * ─── SSR-SAFE ────────────────────────────────────────────────────────────────
 * The full article set is passed in from the server component, so every headline
 * and outbound credit link is in the initial HTML. The chips and sort only
 * reorder and hide what is already there.
 */

type Article = {
  id: string
  title: string
  source: string | null
  url: string | null
  league: string | null
  team_acronym: string | null
  published_at: string | null
}

/** League accent colours, matching the app's registry palette. Unknown leagues
 *  fall back to the desk's gold. */
const LEAGUE_COLOR: Record<string, string> = {
  NHL: '#58A6FF', NFL: '#A371F7', NBA: '#F78166', MLB: '#D29922', MLS: '#00B2A9',
  CFL: '#E5484D', EPL: '#3FB950', 'PREMIER LEAGUE': '#3FB950', NCAAF: '#DB6D28', NCAAB: '#DB6D28', F1: '#E5484D',
}
const colorFor = (lg: string) => LEAGUE_COLOR[lg.toUpperCase()] ?? '#E5B53C'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

type Sort = 'latest' | 'league'

export default function WireFeed({ articles }: { articles: Article[] }) {
  const [league, setLeague] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('league')

  const leagues = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of articles) {
      const k = (a.league || 'Other').toUpperCase()
      counts[k] = (counts[k] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([lg, n]) => ({ lg, n }))
  }, [articles])

  const filtered = useMemo(
    () => (league ? articles.filter(a => (a.league || 'Other').toUpperCase() === league) : articles),
    [articles, league],
  )

  const latest = useMemo(
    () => [...filtered].sort((a, b) => (Date.parse(b.published_at || '') || 0) - (Date.parse(a.published_at || '') || 0)),
    [filtered],
  )

  const grouped = useMemo(() => {
    const m: Record<string, Article[]> = {}
    for (const a of filtered) (m[(a.league || 'Other').toUpperCase()] ||= []).push(a)
    const order = Object.keys(m).sort((x, y) => m[y].length - m[x].length)
    return { m, order }
  }, [filtered])

  return (
    <>
      {/* ── Sticky control bar ── */}
      <div className="sticky top-0 z-20 -mx-5 mt-8 mb-2 border-b border-white/10 bg-[#0a0b0e]/85 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <Chip active={league === null} onClick={() => setLeague(null)} color="#A8B3BF" label="All" />
            {leagues.map(({ lg, n }) => (
              <Chip key={lg} active={league === lg} onClick={() => setLeague(league === lg ? null : lg)} color={colorFor(lg)} label={`${lg} ${n}`} />
            ))}
          </div>
          {/* Latest / By league. `.sb-seg`-style two-up toggle. */}
          <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-white/10">
            {(['league', 'latest'] as Sort[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                aria-pressed={sort === s}
                className={`px-3 py-2 text-[12px] font-bold transition ${sort === s ? 'bg-white/15 text-ink' : 'text-ink-3 hover:text-ink-2'}`}
              >
                {s === 'league' ? 'By league' : 'Latest'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card mt-8 rounded-2xl px-7 py-12 text-center">
          <p className="text-[15px] font-bold text-ink">Nothing here right now</p>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">Try another league, or check back shortly.</p>
        </div>
      ) : sort === 'latest' ? (
        <>
          <ul className="mt-6 space-y-2.5">
            {latest.slice(0, 40).map(a => <Item key={a.id} a={a} />)}
          </ul>
          <AppCta className="mt-8" line="Read it here, then log the game you watched — your grade and your take, kept for good." />
        </>
      ) : (
        grouped.order.map((lg, i) => (
          <section key={lg} className="mt-10">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="h-5 w-1.5 rounded-full" style={{ background: colorFor(lg), boxShadow: `0 0 10px ${colorFor(lg)}66` }} />
              <h2 className="headline text-2xl text-ink sm:text-3xl">{lg}</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {grouped.m[lg].slice(0, 12).map(a => <Item key={a.id} a={a} />)}
            </ul>
            <TicketRow league={lg} />
            {/* One app CTA, after the most-covered league block. */}
            {i === 0 && <AppCta className="mt-8" line="Following one of these teams? The Wire tracks your Starting Lineup in the app — next to the games you rated." />}
          </section>
        ))
      )}
    </>
  )
}

function Item({ a }: { a: Article }) {
  const c = colorFor((a.league || 'Other').toUpperCase())
  return (
    <li>
      <a
        href={a.url!}
        target="_blank"
        /* Editorial credit link, NOT rel="sponsored" — nobody is paid for these
           and marking them sponsored would be a false declaration. */
        rel="noopener noreferrer"
        className="glass-card group flex items-stretch gap-0 overflow-hidden rounded-xl transition hover:border-white/20"
      >
        <span aria-hidden className="w-1 flex-shrink-0" style={{ background: c }} />
        <span className="min-w-0 px-5 py-4">
          <span className="block text-[15.5px] font-bold leading-snug text-ink">{a.title}</span>
          <span className="mt-1.5 block text-[12px] text-ink-3">
            {a.source || 'Source'}
            {a.published_at ? ` · ${timeAgo(a.published_at)}` : ''}
            {a.team_acronym ? ` · ${a.team_acronym}` : ''}
          </span>
        </span>
      </a>
    </li>
  )
}

function TicketRow({ league }: { league: string }) {
  const href = ticketNetworkTeamUrl(`${league} tickets`)
  if (!href) return null
  return (
    <div className="glass-card mt-4 flex items-center justify-between gap-4 rounded-xl px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#E5B53C' }}>TicketNetwork</p>
          <Sponsored />
        </div>
        <p className="mt-1.5 text-[13.5px] text-ink-2">Resale seats for upcoming {league} fixtures.</p>
      </div>
      <AffiliateLink
        href={href}
        ariaLabel={`Find ${league} tickets on TicketNetwork (opens in a new tab)`}
        className="glass-btn flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold text-ink-2 transition hover:text-ink"
      >
        Find seats
      </AffiliateLink>
    </div>
  )
}

function Chip({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-shrink-0 rounded-full px-3.5 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition"
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
