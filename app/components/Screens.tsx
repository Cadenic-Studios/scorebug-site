/**
 * Faithful CSS recreations of the real Scorebug screens.
 *
 * WHY NOT SCREENSHOTS. Raster screenshots of a 412×915 handset are heavy,
 * go stale the moment the app ships a change, and blur on a 3× display.
 * These are drawn in the same primitives the app itself uses (see globals.css:
 * .app-card mirrors lib/design/enamel.ts's frostedPanel, the enamel gradients
 * are the real stops), so they stay crisp at any density and can be corrected
 * in a diff rather than a re-shoot.
 *
 * Authored at 316x664 and rendered between 210px and 286px wide (66%-91% of
 * natural size) by PhoneFrame. Every string here is verbatim from the product.
 */

const OSWALD = "var(--font-oswald), 'Arial Narrow', sans-serif"

/* ── shared atoms ───────────────────────────────────────────────────────── */

function StatusBar({ tint = '#7D8590' }: { tint?: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 pb-1 pt-2.5 text-[8.5px] font-bold" style={{ color: tint }}>
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span aria-hidden className="inline-block h-[7px] w-[11px] rounded-[1.5px]" style={{ background: 'currentColor', opacity: 0.75 }} />
        <span aria-hidden className="inline-block h-[7px] w-[9px] rounded-[1.5px]" style={{ background: 'currentColor', opacity: 0.6 }} />
        <span aria-hidden className="inline-block h-[7px] w-[15px] rounded-[2px]" style={{ background: 'currentColor', opacity: 0.85 }} />
      </span>
    </div>
  )
}

/** The app's circular crest plate — dark ground, club-coloured ring. */
function Crest({ abbr, color, size = 40 }: { abbr: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        fontFamily: OSWALD,
        background: `radial-gradient(circle at 46% 40%, #171B22 0%, #171B22 52%, ${color} 78%, #05070A 100%)`,
        border: `2px solid ${color}`,
        boxShadow: `0 0 10px ${color}55, inset 0 0 0 1px rgba(255,255,255,0.18)`,
      }}
    >
      {abbr}
    </span>
  )
}

function LeagueChip({ league, color }: { league: string; color: string }) {
  return (
    <span
      className="app-chip inline-block px-1.5 py-[2px] text-[7.5px]"
      style={{ color, background: `${color}1F`, border: `1px solid ${color}4D` }}
    >
      {league}
    </span>
  )
}

function BottomBar({ active = 'Home' }: { active?: string }) {
  const items = ['Home', 'Log', '', 'Vault', 'You']
  return (
    <div
      className="mt-auto flex items-end justify-around px-2 pb-2.5 pt-1.5"
      style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,8,12,0.9)' }}
    >
      {items.map((label, i) =>
        i === 2 ? (
          <span
            key="fab"
            aria-hidden
            className="enamel-red -mt-3 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold text-white"
          >
            +
          </span>
        ) : (
          <span key={label} className="flex flex-col items-center gap-[3px]">
            <span
              aria-hidden
              className="block h-[11px] w-[11px] rounded-[3px]"
              style={{ background: label === active ? '#F85149' : 'rgba(255,255,255,0.28)' }}
            />
            <span className="text-[7px] font-semibold" style={{ color: label === active ? '#E6EDF3' : '#7D8590' }}>
              {label}
            </span>
          </span>
        ),
      )}
    </div>
  )
}

/* ── 1. Rate & Chronicle ───────────────────────────────────────────────── */

export function RateChronicleScreen() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-3.5 pb-2 pt-1">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold text-white" style={{ background: '#161B24', border: '1px solid rgba(255,255,255,0.14)', fontFamily: OSWALD }}>SB</span>
        <span className="glass-btn rounded-full px-2.5 py-1 text-[8px] font-bold" style={{ color: '#A8B3BF' }}>← Back</span>
      </div>

      <div className="px-3.5">
        <p className="flex items-center gap-1.5 text-[7.5px] font-black uppercase tracking-[0.2em]" style={{ color: '#F85149' }}>
          <span aria-hidden className="inline-block h-[2px] w-3 rounded-full" style={{ background: '#F85149', boxShadow: '0 0 6px #F85149' }} />
          Log Entry
        </p>
        <p className="mt-1 text-[19px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>Rate &amp; Chronicle</p>
        <p className="mt-[3px] text-[8.5px]" style={{ color: '#7D8590' }}>Miami Dolphins @ Washington Commanders</p>

        {/* Matchup card — real club colours, dark scrim at the edges. */}
        <div
          className="mt-2.5 rounded-xl px-3 py-2.5"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,142,151,0.55) 0%, rgba(10,12,17,0.9) 42%, rgba(10,12,17,0.9) 58%, rgba(90,17,29,0.6) 100%)',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <span className="flex flex-col items-center gap-1">
              <Crest abbr="MIA" color="#008E97" size={34} />
              <span className="text-[7.5px] font-bold text-white">Miami Dolphins</span>
            </span>
            <span className="flex flex-col items-center px-1.5">
              <span className="app-chip px-1.5 py-[1px] text-[6.5px] text-white" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}>NFL</span>
              <span className="mt-[3px] text-[7px] font-bold tracking-[0.18em] text-white/50">VS</span>
              <span className="mt-[2px] text-[15px] font-bold tabular-nums text-white" style={{ fontFamily: OSWALD }}>7 – 20</span>
              <span className="text-[6.5px] text-white/70">Aug 14 · 5:00 PM</span>
              <span className="text-[6.5px] font-bold" style={{ color: '#3FB950' }}>Final</span>
            </span>
            <span className="flex flex-col items-center gap-1">
              <Crest abbr="WSH" color="#5A1414" size={34} />
              <span className="text-[7.5px] font-bold text-white">Commanders</span>
            </span>
          </div>
        </div>

        {/* Goal-light rating */}
        <div className="app-card mt-2.5 p-3">
          <p className="flex items-center gap-1.5 text-[7.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8B3BF' }}>
            <span aria-hidden className="inline-block h-[9px] w-[2px] rounded-full" style={{ background: '#F85149' }} />
            Game Rating
          </p>
          <div className="mt-2 flex items-center gap-3">
            {/* the goal light */}
            <span aria-hidden className="relative flex flex-col items-center">
              <span className="h-[7px] w-[3px] rounded-t" style={{ background: '#4A515C' }} />
              <span className="h-[9px] w-[22px] rounded-[3px]" style={{ background: 'linear-gradient(180deg,#5A616C,#2A2F38)' }} />
              <span
                className="h-[19px] w-[26px] rounded-b-full"
                style={{
                  background: 'radial-gradient(circle at 40% 28%, #FF8A80 0%, #F0413C 42%, #8E0300 100%)',
                  boxShadow: '0 0 16px rgba(240,65,60,0.85), inset 0 -2px 4px rgba(0,0,0,0.4)',
                }}
              />
            </span>
            <span>
              <span className="text-[30px] font-bold leading-none" style={{ color: '#F85149', fontFamily: OSWALD }}>
                4.0
                <span className="ml-1 text-[11px]" style={{ color: '#7D8590' }}>/ 5.0</span>
              </span>
              <span className="mt-[2px] block text-[8.5px]" style={{ color: '#A8B3BF' }}>Could not look away.</span>
            </span>
          </div>
          {/* slider */}
          <div className="mt-2.5 flex items-center">
            <span className="h-[5px] flex-1 rounded-full" style={{ background: 'linear-gradient(90deg,#F0413C,#B00500)', boxShadow: '0 0 8px rgba(240,65,60,0.6)' }} />
            <span
              aria-hidden
              className="-ml-[6px] h-[13px] w-[13px] rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #FF8A80, #C1120C)', border: '2px solid #2A2F38', boxShadow: '0 0 10px rgba(240,65,60,0.9)' }}
            />
            <span className="h-[5px] w-[16%] rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
          {/* half-step chips */}
          <div className="mt-2 flex gap-[3px]">
            {['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(n => {
              const on = n === '4'
              const dim = Number(n) > 4
              return (
                <span
                  key={n}
                  className="flex-1 rounded-[5px] py-[3px] text-center text-[7px] font-bold"
                  style={{
                    background: on ? 'linear-gradient(180deg,#F0413C,#B00500)' : 'rgba(255,255,255,0.04)',
                    color: on ? '#fff' : dim ? '#4A515C' : '#C1443F',
                    border: `1px solid ${on ? '#F0413C' : 'rgba(255,255,255,0.09)'}`,
                  }}
                >
                  {n}
                </span>
              )
            })}
          </div>
        </div>

        {/* Perspective */}
        <div className="app-card mt-2 p-3">
          <p className="text-[7.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8B3BF' }}>How did you watch?</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <span className="rounded-lg py-2 text-center text-[8px] font-bold text-white" style={{ background: 'linear-gradient(180deg,#F0413C,#B00500)', border: '1px solid #F0413C' }}>Broadcast</span>
            <span className="rounded-lg py-2 text-center text-[8px] font-bold" style={{ color: '#A8B3BF', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>At the Game!</span>
          </div>
        </div>

        {/* Your photos — private */}
        <div className="app-card mt-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[7.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8B3BF' }}>Your Photos</p>
            <span className="app-chip inline-flex items-center gap-1 px-1.5 py-[2px] text-[6px]" style={{ background: 'rgba(163,113,247,0.12)', color: '#A371F7', border: '1px solid rgba(163,113,247,0.3)' }}>
              ⬤ Private
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {['#1E3A5F', '#3A1E28'].map(c => (
              <span key={c} className="h-[26px] w-[26px] rounded-md" style={{ background: `linear-gradient(140deg, ${c}, rgba(10,12,17,0.9))`, border: '1px solid rgba(255,255,255,0.12)' }} />
            ))}
            <span className="flex h-[26px] flex-1 items-center justify-center rounded-md text-[7px] font-bold" style={{ color: '#7D8590', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
              + Add photo
            </span>
          </div>
        </div>

        {/* Chronicle */}
        <div className="app-card mt-2 p-3">
          <p className="text-[7.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8B3BF' }}>Chronicle</p>
          <p className="mt-1.5 text-[7.5px] leading-snug" style={{ color: '#C9D1D9' }}>
            Backyard bowl went to the wire again — that fourth-quarter drive was the whole game.
          </p>
        </div>

        <div className="enamel-red mt-2 rounded-xl py-2 text-center text-[9px] font-black text-white">
          ✓ Log This Game
        </div>
      </div>
    </div>
  )
}

/* ── 2. The Vault ──────────────────────────────────────────────────────── */

const VAULT_STATS = [
  { n: '8', l: 'Logged', c: '#E5B53C' },
  { n: '3.1', l: 'Avg grade', c: '#E6EDF3' },
  { n: '0', l: '5-stars', c: '#E6EDF3' },
  { n: '0', l: 'In person', c: '#E6EDF3' },
  { n: '60%', l: 'Win %', c: '#3FB950' },
]

export function VaultScreen() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-3.5 pb-2 pt-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden style={{ color: '#E5B53C' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4h8v3a4 4 0 0 1-8 0z" /><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 11v3M8.5 20h7M10 17h4v3h-4z" />
            </svg>
          </span>
          <span>
            <span className="block text-[13px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>The Vault</span>
            <span className="block text-[7px]" style={{ color: '#7D8590' }}>Your personal game chronicle</span>
          </span>
        </span>
        <span className="glass-btn rounded-full px-2 py-1 text-[7.5px] font-bold" style={{ color: '#A8B3BF' }}>Devotion →</span>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {VAULT_STATS.map(s => (
          <span key={s.l} className="app-card flex-1 px-1 py-1.5 text-center">
            <span className="block text-[13px] font-bold leading-none" style={{ color: s.c, fontFamily: OSWALD }}>{s.n}</span>
            <span className="mt-[2px] block text-[5.5px] font-bold uppercase tracking-wide" style={{ color: '#7D8590' }}>{s.l}</span>
          </span>
        ))}
      </div>

      <div className="px-3">
        <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(6,9,14,0.7)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <span aria-hidden style={{ color: '#7D8590' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </span>
          <span className="text-[7.5px]" style={{ color: '#5C6470' }}>Search by team, notes…</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          {['All', 'CFL', 'MLB', 'NHL'].map(f => (
            <span
              key={f}
              className="app-chip px-2 py-[3px] text-[7px]"
              style={
                f === 'All'
                  ? { background: '#F85149', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#A8B3BF', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {f}
            </span>
          ))}
          <span className="ml-auto text-[7px] font-bold" style={{ color: '#7D8590' }}>⇅ Sort &amp; Filter</span>
        </div>
      </div>

      {/* entries */}
      <div className="mt-2 space-y-1.5 px-3">
        {[
          { lg: 'CFL', c: '#10B981', a: 'SSK', ac: '#006747', h: 'EDM', hc: '#DA291C', s: '28-26', d: 'Sat, Aug 23, 2026', note: 'Down to the wire yet again. A fun one to watch.', g: '4.0', gl: 'A real barnburner.' },
          { lg: 'MLB', c: '#D29922', a: 'ATL', ac: '#CE1141', h: 'STL', hc: '#C41E3A', s: '1-4', d: 'Fri, Jul 17, 2026', note: 'Big fan of the Falcons so I figured I’d give another Atlanta team a go…', g: '3.0', gl: 'Perfectly watchable.' },
          { lg: 'NHL', c: '#58A6FF', a: 'EDM', ac: '#FC7C39', h: 'FLA', hc: '#C8102E', s: '4-3', d: 'Tue, Jun 9, 2026', note: 'Overtime. Again. I have never been this tired and this happy at once.', g: '5.0', gl: 'An instant classic.' },
        ].map(e => (
          <div key={`${e.lg}-${e.a}-${e.h}-${e.d}`} className="app-card p-2">
            <div className="flex items-center gap-1.5">
              <LeagueChip league={e.lg} color={e.c} />
              <span className="text-[6.5px]" style={{ color: '#7D8590' }}>⊙ Broadcast</span>
              <span className="ml-auto text-[6.5px]" style={{ color: '#7D8590' }}>{e.d}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Crest abbr={e.a} color={e.ac} size={19} />
              <span className="text-[8px] font-bold" style={{ color: '#A8B3BF' }}>{e.a}</span>
              <span className="text-[10px] font-bold tabular-nums text-white" style={{ fontFamily: OSWALD }}>{e.s}</span>
              <Crest abbr={e.h} color={e.hc} size={19} />
              <span className="text-[8px] font-bold" style={{ color: '#A8B3BF' }}>{e.h}</span>
              <span className="ml-auto text-[6px] font-bold" style={{ color: '#3FB950' }}>◉ Public</span>
            </div>
            <p className="mt-1.5 text-[7.5px] leading-snug" style={{ color: '#A8B3BF' }}>{e.note}</p>
            <div className="mt-1.5 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 5 }}>
              <span className="text-[13px] font-bold leading-none" style={{ color: '#3FB950', fontFamily: OSWALD }}>{e.g}</span>
              <span className="text-[6.5px]" style={{ color: '#7D8590' }}>{e.gl}</span>
              <span className="ml-auto flex gap-1">
                <span className="rounded px-1.5 py-[2px] text-[6.5px] font-bold" style={{ color: '#A8B3BF', background: 'rgba(255,255,255,0.06)' }}>Edit</span>
                <span className="rounded px-1.5 py-[2px] text-[6.5px] font-bold" style={{ color: '#E5B53C', background: 'rgba(229,181,60,0.12)' }}>Share</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      <BottomBar active="Vault" />
    </div>
  )
}

/* ── 3. The Slate ──────────────────────────────────────────────────────── */

export function SlateScreen() {
  const days = [
    { d: 'Tue', n: '11' }, { d: 'Wed', n: '12' }, { d: 'Thu', n: '13' },
    { d: 'Fri', n: '14' }, { d: 'Today', n: '15', on: true }, { d: 'Sun', n: '16' },
    { d: 'Mon', n: '17' }, { d: 'Tue', n: '18' },
  ]
  const games = [
    { lg: 'MLB', a: 'ATL', ac: '#CE1141', an: 'Braves', h: 'NYY', hc: '#0C2340', hn: 'Yankees', as: 2, hs: 1 },
    { lg: 'MLB', a: 'NYM', ac: '#FF5910', an: 'Mets', h: 'PIT', hc: '#FDB827', hn: 'Pirates', as: 11, hs: 1 },
    { lg: 'MLB', a: 'TOR', ac: '#134A8E', an: 'Blue Jays', h: 'PHI', hc: '#E81828', hn: 'Phillies', as: 6, hs: 7 },
    { lg: 'MLB', a: 'COL', ac: '#33006F', an: 'Rockies', h: 'SF', hc: '#FD5A1E', hn: 'Giants', as: 5, hs: 2 },
  ]
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-3.5 pb-2 pt-1">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold text-white" style={{ background: '#161B24', border: '1px solid rgba(255,255,255,0.14)', fontFamily: OSWALD }}>SB</span>
        <span className="glass-btn rounded-full px-2.5 py-1 text-[8px] font-bold text-white">122 games</span>
      </div>

      <div className="flex gap-[3px] px-2.5 pb-2">
        {days.map(d => (
          <span
            key={d.n}
            className="flex-1 rounded-md py-1 text-center"
            style={{
              background: d.on ? 'linear-gradient(180deg,#F0413C,#B00500)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${d.on ? '#F0413C' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span className="block text-[5.5px] font-bold uppercase" style={{ color: d.on ? '#fff' : '#7D8590' }}>{d.d}</span>
            <span className="block text-[10px] font-bold leading-none" style={{ color: d.on ? '#fff' : '#E6EDF3', fontFamily: OSWALD }}>{d.n}</span>
          </span>
        ))}
      </div>

      <div className="space-y-1.5 px-3">
        {games.map(g => (
          <div
            key={g.a}
            className="rounded-xl p-2"
            style={{
              background: `linear-gradient(90deg, ${g.ac}CC 0%, rgba(10,12,17,0.92) 42%, rgba(10,12,17,0.92) 58%, ${g.hc}CC 100%)`,
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="app-chip px-1.5 py-[1px] text-[6.5px] text-white" style={{ background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(255,255,255,0.18)' }}>{g.lg}</span>
              <span className="text-right text-[6px] leading-tight text-white/80">
                <span className="block font-bold">Final</span>
                <span className="block">Sun, Aug 9</span>
              </span>
            </div>
            <div className="mt-1.5 grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
              <span className="flex flex-col items-center gap-[3px]">
                <span className="text-[5.5px] font-black uppercase tracking-widest text-white/55">Away</span>
                <Crest abbr={g.a} color={g.ac} size={26} />
                <span className="text-[7px] font-bold text-white">{g.an}</span>
              </span>
              <span className="flex items-center gap-1.5 px-1">
                <span className="text-[17px] font-bold tabular-nums text-white" style={{ fontFamily: OSWALD }}>{g.as}</span>
                <span className="text-[6.5px] font-bold tracking-[0.18em] text-white/45">VS</span>
                <span className="text-[17px] font-bold tabular-nums text-white" style={{ fontFamily: OSWALD }}>{g.hs}</span>
              </span>
              <span className="flex flex-col items-center gap-[3px]">
                <span className="text-[5.5px] font-black uppercase tracking-widest text-white/55">Home</span>
                <Crest abbr={g.h} color={g.hc} size={26} />
                <span className="text-[7px] font-bold text-white">{g.hn}</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1 rounded-full py-[3px]" style={{ background: 'rgba(6,8,12,0.55)', border: '1px solid rgba(255,255,255,0.14)' }}>
              <span aria-hidden className="text-[7px]" style={{ color: '#F85149' }}>✎</span>
              <span className="text-[7px] font-bold text-white">Log this game →</span>
            </div>
          </div>
        ))}
      </div>
      <BottomBar active="Home" />
    </div>
  )
}

/* ── 4. The Front Office ───────────────────────────────────────────────── */

export function FrontOfficeScreen({ price, cadence, yearly }: { price: string; cadence: string; yearly: string }) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar tint="#B39544" />
      <div className="px-3.5 pt-1">
        <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: '#B39544' }}>The Front Office</p>
        <p className="mt-1 text-[17px] font-bold leading-[1.05] text-white" style={{ fontFamily: OSWALD }}>
          Get the keys to<br />the franchise.
        </p>
        <p className="mt-1.5 text-[7.5px] leading-snug" style={{ color: '#8A8578' }}>
          Free covers the basics. The Front Office unlocks the deep cuts of your data and the tools to make Scorebug yours.
        </p>

        <div className="mt-2.5 flex gap-1">
          {[{ n: '8', l: 'Logged' }, { n: '3.1', l: 'Avg' }, { n: '0', l: '5-stars' }, { n: '0', l: 'In person' }].map(s => (
            <span key={s.l} className="flex-1 rounded-lg py-1.5 text-center" style={{ background: 'rgba(229,181,60,0.06)', border: '1px solid rgba(229,181,60,0.18)' }}>
              <span className="block text-[13px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>{s.n}</span>
              <span className="mt-[2px] block text-[5.5px] font-bold uppercase" style={{ color: '#8A8578' }}>{s.l}</span>
            </span>
          ))}
        </div>

        {/* Locked analytics desk — the real screen blurs the content behind a gate. */}
        <div className="relative mt-2 overflow-hidden rounded-xl p-2.5" style={{ background: 'rgba(18,16,11,0.9)', border: '1px solid rgba(229,181,60,0.22)' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[7.5px] font-bold text-white">The Analytics Desk</span>
            <span className="app-chip px-1.5 py-[1px] text-[5.5px]" style={{ background: '#E5B53C', color: '#1A1206' }}>Front Office</span>
          </div>
          <div className="mt-1.5 space-y-1" aria-hidden style={{ filter: 'blur(3.5px)', opacity: 0.5 }}>
            <span className="block h-[5px] w-[85%] rounded-full" style={{ background: 'rgba(229,181,60,0.5)' }} />
            <span className="block h-[5px] w-[65%] rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
            <span className="block h-[5px] w-[74%] rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }} />
          </div>
          <div className="mt-2 rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(8,7,5,0.8)', border: '1px solid rgba(229,181,60,0.3)' }}>
            <span className="text-[8px] font-bold" style={{ color: '#E5B53C' }}>◆ 7 insights waiting</span>
            <span className="mt-[2px] block text-[6px]" style={{ color: '#8A8578' }}>Unlock The Front Office to read the deep cuts of your data.</span>
          </div>
        </div>

        {/* The perks, verbatim from the in-app list */}
        <div className="mt-2 space-y-[5px]">
          {[
            ['The Analytics Desk', 'A dozen cuts of your own data.'],
            ['Extended Lineup', 'Expand from 5 teams to 25.'],
            ['Unlimited Docket & Clippings', 'No caps, no ceiling.'],
            ['Export Your Vault', 'CSV or JSON — yours to keep.'],
            ['Zero Ads', 'Every banner disappears.'],
          ].map(([t, d]) => (
            <div key={t} className="flex items-start gap-1.5">
              <span aria-hidden className="mt-[1px] text-[7px]" style={{ color: '#E5B53C' }}>◆</span>
              <span className="min-w-0">
                <span className="block text-[7px] font-bold text-white">{t}</span>
                <span className="block text-[6px]" style={{ color: '#8A8578' }}>{d}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Price plate */}
        <div className="mt-2.5 text-center">
          <p className="text-[24px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>
            {price}
            <span className="ml-1 text-[9px]" style={{ color: '#8A8578' }}>{cadence}</span>
          </p>
          <p className="mt-[2px] text-[6px]" style={{ color: '#8A8578' }}>Planned · cancel anytime · or {yearly}/yr</p>
        </div>
        <div className="enamel-gold mt-2 rounded-full py-2 text-center text-[9px] font-black">
          ✦ Unlock The Front Office
        </div>
        <p className="mt-1.5 text-center text-[5.5px]" style={{ color: '#6E6A5F' }}>
          Planned rates shown · Google Play confirms the live price at checkout
        </p>
      </div>
      <BottomBar active="You" />
    </div>
  )
}

/* ── 5. The Bleachers ──────────────────────────────────────────────────── */

export function BleachersScreen() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="px-3.5 pt-1">
        <p className="flex items-center gap-1.5 text-[13px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>
          <span aria-hidden style={{ color: '#F85149' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20v-4h5v-4h5V8h5V4h5" /><line x1="2" y1="20" x2="22" y2="20" /></svg>
          </span>
          The Bleachers
        </p>
        <p className="mt-[3px] text-[7px]" style={{ color: '#7D8590' }}>The loudest voices in sports. Jump into the conversation.</p>

        <p className="mt-2 text-center text-[6px] font-black uppercase tracking-[0.22em]" style={{ color: '#7D8590' }}>— Find your people —</p>
        <p className="mt-[2px] text-center text-[9px] font-bold text-white">Who are you cheering with?</p>

        {/* The stadium seat-picker: a bowl of sport sections. */}
        <div className="relative mx-auto mt-2 w-full" style={{ height: 96 }}>
          <div className="absolute inset-0 rounded-[26px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }} />
          {/* top row */}
          <div className="absolute left-[9%] right-[9%] top-[6px] flex gap-1">
            <span className="flex-1 rounded-md py-1 text-center text-[5.5px] font-black uppercase tracking-wider" style={{ background: 'rgba(163,113,247,0.16)', border: '1px solid rgba(163,113,247,0.4)', color: '#C6A6FF' }}>
              Basketball<span className="block text-[4.5px] opacity-70">2 leagues</span>
            </span>
            <span className="flex-1 rounded-md py-1 text-center text-[5.5px] font-black uppercase tracking-wider" style={{ background: 'rgba(88,166,255,0.16)', border: '1px solid rgba(88,166,255,0.4)', color: '#8EC5FF' }}>
              Baseball<span className="block text-[4.5px] opacity-70">1 league</span>
            </span>
          </div>
          {/* sides */}
          <span className="absolute left-[3px] top-1/2 -translate-y-1/2 rounded-md px-[3px] py-3 text-[5px] font-black uppercase tracking-wider" style={{ background: 'rgba(248,81,73,0.14)', border: '1px solid rgba(248,81,73,0.38)', color: '#FF9A94', writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}>
            Hockey
          </span>
          <span className="absolute right-[3px] top-1/2 -translate-y-1/2 rounded-md px-[3px] py-3 text-[5px] font-black uppercase tracking-wider" style={{ background: 'rgba(63,185,80,0.14)', border: '1px solid rgba(63,185,80,0.38)', color: '#77E08A', writingMode: 'vertical-rl' }}>
            Football
          </span>
          {/* centre */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-center text-[5.5px] font-black uppercase tracking-[0.16em]" style={{ background: 'rgba(6,8,12,0.9)', border: '1px solid rgba(255,255,255,0.16)', color: '#E6EDF3' }}>
            The<br />Bleachers
          </span>
          {/* bottom */}
          <span className="absolute bottom-[6px] left-[16%] right-[16%] rounded-md py-1 text-center text-[5.5px] font-black uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#A8B3BF' }}>
            Soccer<span className="block text-[4.5px] opacity-70">5 leagues</span>
          </span>
        </div>
        <p className="mt-1 text-center text-[5.5px] font-black uppercase tracking-[0.2em]" style={{ color: '#5C6470' }}>Tap to pick your seats</p>

        {/* take card */}
        <div className="app-card mt-2 p-2">
          <div className="flex items-center gap-1.5">
            <LeagueChip league="MLB" color="#D29922" />
            <span className="ml-auto text-[6px] font-bold" style={{ color: '#7D8590' }}>Final</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Crest abbr="COL" color="#33006F" size={22} />
            <span className="text-[8px] font-bold text-white">Rockies 5</span>
            <span className="text-[6.5px] font-bold tracking-[0.16em] text-white/40">VS</span>
            <span className="text-[8px] font-bold text-white">2 Giants</span>
            <Crest abbr="SF" color="#FD5A1E" size={22} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 5 }}>
            <span className="flex -space-x-1" aria-hidden>
              {['#F85149', '#58A6FF', '#E5B53C'].map(c => (
                <span key={c} className="inline-block h-[11px] w-[11px] rounded-full" style={{ background: c, border: '1.5px solid #0A0B0E' }} />
              ))}
            </span>
            <span className="text-[6.5px]" style={{ color: '#7D8590' }}>5 takes</span>
            <span className="text-[7px] font-bold" style={{ color: '#E5B53C' }}>3.0/5</span>
          </div>
          <p className="mt-1 text-[7px] leading-snug" style={{ color: '#A8B3BF' }}>
            <span className="font-bold" style={{ color: '#58A6FF' }}>@sportsfan22 </span>
            Giants pitching completely wasted by that 7th inning.
          </p>
        </div>
      </div>
      <BottomBar active="Home" />
    </div>
  )
}

/* ── 6. The Franchise ──────────────────────────────────────────────────── */

export function FranchiseScreen() {
  const results = [
    { a: 'TOR', ac: '#134A8E', an: 'Blue Jays', s: '3-1', r: 'W', d: 'Aug 14', h: 'NYY', hc: '#0C2340', hn: 'Yankees' },
    { a: 'ATL', ac: '#A71930', an: 'Falcons', s: '7-27', r: 'L', d: 'Aug 14', h: 'DEN', hc: '#FB4F14', hn: 'Broncos' },
    { a: 'TOR', ac: '#134A8E', an: 'Blue Jays', s: '0-7', r: 'L', d: 'Aug 13', h: 'BOS', hc: '#BD3039', hn: 'Red Sox' },
  ]
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="px-3.5 pt-1">
        <div className="flex items-end justify-between">
          <span>
            <span className="block text-[6px] font-black uppercase tracking-[0.22em]" style={{ color: '#58A6FF' }}>Your season</span>
            <span className="block text-[14px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>The Franchise</span>
          </span>
          <span className="text-[6.5px] font-bold" style={{ color: '#7D8590' }}>2026 Season</span>
        </div>

        <div className="mt-2 flex gap-1">
          {[
            { l: 'All', on: true, c: '#58A6FF' },
            { l: 'EDM Oilers', c: '#FC7C39' },
            { l: 'NJD Devils', c: '#CE1126' },
            { l: 'ATL Falcons', c: '#A71930' },
          ].map(t => (
            <span
              key={t.l}
              className="app-chip whitespace-nowrap px-1.5 py-[3px] text-[6px]"
              style={
                t.on
                  ? { background: '#58A6FF', color: '#04121F' }
                  : { background: `${t.c}22`, color: '#D6DEEB', border: `1px solid ${t.c}66` }
              }
            >
              {t.l}
            </span>
          ))}
        </div>

        {/* official record */}
        <div className="app-card mt-2 p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex flex-col items-center rounded-lg px-1.5 py-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[11px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>48</span>
              <span className="text-[5px] font-bold uppercase" style={{ color: '#7D8590' }}>Win %</span>
            </span>
            <span className="flex-1 text-center">
              <span className="block text-[19px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>61 - 65 - 0</span>
              <span className="mt-[2px] block text-[5.5px] font-black uppercase tracking-[0.16em]" style={{ color: '#7D8590' }}>Official record · W · L · T</span>
            </span>
          </div>
          <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <span className="block h-full" style={{ width: '48%', background: 'linear-gradient(90deg,#3FB950,#C77B72)' }} />
          </div>
          <p className="mt-1 text-[5.5px]" style={{ color: '#7D8590' }}>2026 season to date · 5 teams</p>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[6px] font-black uppercase tracking-[0.2em]" style={{ color: '#7D8590' }}>Recent results</span>
          <span className="text-[6px] font-bold" style={{ color: '#58A6FF' }}>View all →</span>
        </div>

        <div className="mt-1 space-y-1">
          {results.map((r, i) => (
            <div key={i} className="app-card flex items-center gap-1.5 px-2 py-1.5">
              <Crest abbr={r.a} color={r.ac} size={18} />
              <span className="text-[6.5px] font-bold" style={{ color: '#A8B3BF' }}>{r.an}</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-white" style={{ fontFamily: OSWALD }}>{r.s}</span>
                <span
                  className="rounded px-1 text-[6px] font-black"
                  style={{ color: r.r === 'W' ? '#3FB950' : '#C77B72', background: r.r === 'W' ? 'rgba(63,185,80,0.14)' : 'rgba(199,123,114,0.14)' }}
                >
                  {r.r}
                </span>
                <span className="text-[5.5px]" style={{ color: '#7D8590' }}>{r.d}</span>
              </span>
              <span className="text-[6.5px] font-bold" style={{ color: '#A8B3BF' }}>{r.hn}</span>
              <Crest abbr={r.h} color={r.hc} size={18} />
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-1">
          {[{ n: '5', l: 'Total cheers', c: '#2DD4BF' }, { n: '8', l: 'Total chronicles', c: '#58A6FF' }].map(s => (
            <span key={s.l} className="app-card flex-1 py-1.5 text-center">
              <span className="block text-[12px] font-bold leading-none" style={{ color: s.c, fontFamily: OSWALD }}>{s.n}</span>
              <span className="text-[5.5px] font-bold uppercase" style={{ color: '#7D8590' }}>{s.l}</span>
            </span>
          ))}
        </div>
      </div>
      <BottomBar active="Home" />
    </div>
  )
}

/* ── 7. The Wire (news) ────────────────────────────────────────────────── */

export function WireScreen() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="px-3.5 pt-1">
        <p className="flex items-center gap-1.5 text-[13px] font-bold leading-none text-white" style={{ fontFamily: OSWALD }}>
          <span aria-hidden style={{ color: '#D29922' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 13h10M7 16h7" /></svg>
          </span>
          The Wire
        </p>
        <p className="mt-[3px] text-[7px]" style={{ color: '#7D8590' }}>Every headline for the teams you follow.</p>

        <div className="mt-2 flex gap-1">
          {['Your teams', 'NHL', 'NFL', 'MLB'].map(f => (
            <span
              key={f}
              className="app-chip px-2 py-[3px] text-[6.5px]"
              style={
                f === 'Your teams'
                  ? { background: '#D29922', color: '#1A1206' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#A8B3BF', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {f}
            </span>
          ))}
        </div>

        <div className="mt-2 space-y-1.5">
          {[
            { t: 'Oilers place forward on IR ahead of road trip', s: 'ESPN', a: '2h ago', c: '#FC7C39', ab: 'EDM' },
            { t: 'Falcons name starting quarterback for Week 3', s: 'ESPN', a: '5h ago', c: '#A71930', ab: 'ATL' },
            { t: 'Blue Jays clinch series with late rally in Boston', s: 'ESPN', a: '8h ago', c: '#134A8E', ab: 'TOR' },
            { t: 'Devils recall goaltender as injury list grows', s: 'ESPN', a: '11h ago', c: '#CE1126', ab: 'NJD' },
            { t: 'What the trade deadline means for the Pacific', s: 'ESPN', a: '1d ago', c: '#FC7C39', ab: 'EDM' },
          ].map(n => (
            <div key={n.t} className="app-card flex gap-2 p-2">
              <span className="h-[30px] w-[30px] flex-shrink-0 rounded-md" style={{ background: `linear-gradient(140deg, ${n.c}66, rgba(10,12,17,0.9))`, border: '1px solid rgba(255,255,255,0.1)' }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <LeagueChip league={n.ab} color={n.c} />
                </span>
                <span className="mt-1 block text-[7.5px] font-bold leading-snug text-white">{n.t}</span>
                <span className="mt-[2px] block text-[6px]" style={{ color: '#7D8590' }}>{n.s} · {n.a}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <BottomBar active="Home" />
    </div>
  )
}
