import type { CSSProperties } from 'react'
import { ImageResponse } from 'next/og'
import { LEAGUES } from '../../leagues'
import { shieldDataUri, monogramOf, shieldAccent, shieldPrimary } from './shield'
import { bytes, ANTON_400, OSWALD_700, OSWALD_500, INTER_400, INTER_600, ICON_PNG } from './brand'

/**
 * SCOREBUG // THE CARD PRESS
 *
 * Every image the marketing engine posts is rendered here, on request, from a
 * query string: a final, a pregame, an anniversary, the day's slate, a product
 * line, the week ahead, the week in numbers. Satori on the edge, and the same
 * things the site and the app are made of: the app icon, Anton for the
 * headline, Oswald for the display tier, Inter for the body, the stadium
 * floodlight glows, the enamelled dark glass, the enamel-red pill, and the
 * app's Broadcast Shields — original geometric crests drawn from each club's
 * colours, never a trademarked logo, which is the only reason a sports card
 * can be generated at all.
 *
 * ── WHY THE SITE RENDERS THESE AND NOT THE ENGINE ───────────────────────────
 *
 * The engine runs in Cloud Functions. A rasteriser there means a native
 * binary, a font bundle and a second copy of the palette. Satori already runs
 * here with no native dependency. And Threads and Instagram will not accept
 * uploaded bytes at all — they fetch a PUBLIC IMAGE URL — so a card that is
 * already a URL is the one shape that works for every network.
 *
 * ── EVERY PARAMETER IS CLAMPED ──────────────────────────────────────────────
 *
 * This endpoint is public and quoted in post bodies. Strings are stripped of
 * control characters and cut, numbers are bounded, unknown kinds fall back to
 * the product card, and nothing is ever fetched from a caller-supplied URL.
 */

export const runtime = 'edge'
/* Every sibling route declares this. The card handler is dynamic in practice
   because it reads req.url, but that is Next's heuristic rather than our
   intent — and if it were ever pre-rendered, one build-time default card would
   be served for every query. */
export const dynamic = 'force-dynamic'

// tailwind.config.ts, verbatim — the site and the cards must read as one object.
const CANVAS = '#0A0B0E'
const RED = '#F85149'
const BLUE = '#58A6FF'
const TEAL = '#2DD4BF'
const GOLD = '#E5B53C'
const INK = '#E6EDF3'
const INK_2 = '#A8B3BF'
const INK_3 = '#7D8590'

const SIZES = {
  wide: { w: 1200, h: 675 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 }, // TikTok, Instagram and Threads stories — posted by hand, never by the engine
} as const
type SizeKey = keyof typeof SIZES

const LEAGUE_COLOR: Record<string, string> = Object.fromEntries(LEAGUES.map(l => [l.id, l.color]))
const LEAGUE_NAME: Record<string, string> = Object.fromEntries(LEAGUES.map(l => [l.id, l.label]))

/** Strip control characters and clamp. A hostile query must not break layout. */
function clean(value: string | null, max: number): string {
  if (!value) return ''
  let out = ''
  for (const ch of value) { const c = ch.codePointAt(0) ?? 0; if (c >= 32 && c !== 127) out += ch }
  out = out.trim().replace(/\s+/g, ' ')
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out
}
/**
 * A bounded number, or the fallback.
 *
 * `Number(null)` is 0 and 0 is finite, so a MISSING parameter never reached
 * the fallback — it reached `clamp(0)`. Invisible everywhere `min` is 0, and
 * wrong in the one place it is not: `?k=archive` with no `years` rendered
 * "THIS DAY, 1 YEARS AGO" instead of "FROM THE ARCHIVE", which is a false
 * factual claim on a branded card from a codebase whose entire facts endpoint
 * exists to stop exactly that. An absent or empty value is now absent.
 */
function num(value: string | null, min: number, max: number, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
/** A score is shown as given — "4", "185/6 (20 ov)" — but never longer than a scoreline. */
const score = (v: string | null) => clean(v, 16)
const abbr = (v: string | null) => clean(v, 6).toUpperCase().replace(/[^A-Z0-9&.-]/g, '')

/* ──────────────────────────────────────────────────── CLAIMS NEED A SIGNATURE */

/**
 * ── WHAT IS OPEN AND WHAT IS SIGNED ─────────────────────────────────────────
 *
 * This endpoint is public by necessity: Threads and Instagram fetch media by
 * URL, and the URL appears in post bodies. So anyone can compose one, and the
 * frame always stamps the app icon, SCOREBUG and getscorebug.app on the result
 * — a fully branded image, authored by a stranger, served from our domain, and
 * pinned in the CDN for a day.
 *
 * Clamping the strings stops the layout breaking. It does not stop authorship,
 * and no amount of clamping will. But not everything is equally dangerous:
 *
 *   • A SCORELINE is a public fact. A fake one is a lie anybody could tell in
 *     an image editor, and the card says "grade it", not "official result".
 *     These stay open, because the engine, the owner and anyone making a story
 *     graphic by hand all need to compose them freely.
 *
 *   • A CLAIM ABOUT SCOREBUG is different. "COMMUNITY GRADE 1.0 from 48,211
 *     logs", "9,999,999 GAMES LOGGED", and an arbitrary two-line headline in
 *     the site's own hero voice are statements about the product that only the
 *     product can honestly make. Those parameters require a signature.
 *
 * An unsigned or wrongly-signed claim is DROPPED, not rejected: the card still
 * renders, just without the part nobody could vouch for. Degrading beats a 500
 * on an endpoint whose output is embedded in other people's timelines.
 */
const CLAIM_PARAMS = ['hl', 'g', 'n', 'logs', 'top', 'band'] as const

const CARD_KEY = process.env.DISPATCH_KEY ?? ''

/** Every parameter except the signature, ordered, so both sides build the same string. */
function canonical(q: URLSearchParams): string {
  // forEach, not for..of: this project's tsconfig target predates downlevel
  // iteration of URLSearchParams, and the engine builds the identical string.
  const pairs: string[] = []
  q.forEach((v, k) => { if (k !== 'sig') pairs.push(`${k}=${v}`) })
  return pairs.sort().join('&')
}

async function signatureOk(q: URLSearchParams): Promise<boolean> {
  const given = q.get('sig')
  if (!CARD_KEY || !given) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(CARD_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical(q)))
    const want = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
    if (want.length !== given.length) return false
    let diff = 0
    for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ given.charCodeAt(i)
    return diff === 0
  } catch { return false }
}

/** Strip the claim parameters unless this URL was signed by the engine. */
async function verifiedParams(q: URLSearchParams): Promise<URLSearchParams> {
  const claims = CLAIM_PARAMS.filter(k => q.has(k))
  if (!claims.length) return q
  if (await signatureOk(q)) return q
  const out = new URLSearchParams(q)
  for (const k of claims) out.delete(k)
  return out
}

/* ───────────────────────────────────────────────────────── FONTS + BRAND */

type Face = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 }

/**
 * Decoded once per isolate. There is no fetch and no file read: see brand.ts
 * for why. The pattern next/og documents —
 * `fetch(new URL('./Inter.ttf', import.meta.url))` — cannot be exercised
 * outside production, because Next's local edge sandbox answers
 * "not implemented... yet..." for a bundled asset URL and the route 500s in
 * both `next dev` and `next start`. Every marketing post embeds this endpoint,
 * so it needed to be provable before it shipped, not after.
 */
let fontCache: Face[] | null = null
function fonts(): Face[] {
  if (!fontCache) {
    fontCache = [
      { name: 'Anton', data: bytes(ANTON_400), weight: 400 },
      { name: 'Oswald', data: bytes(OSWALD_700), weight: 700 },
      { name: 'Oswald', data: bytes(OSWALD_500), weight: 500 },
      { name: 'Inter', data: bytes(INTER_400), weight: 400 },
      { name: 'Inter', data: bytes(INTER_600), weight: 600 },
    ]
  }
  return fontCache
}

/** The app icon — public/app-icon.png, the same mark the site header and every store listing use. */
const APP_ICON = `data:image/png;base64,${ICON_PNG}`

/* ───────────────────────────────────────────────────────────── TYPE */

// .headline: Anton, uppercase, line-height 1, one weight. The site's hero tier.
const headline: CSSProperties = { fontFamily: 'Anton', fontWeight: 400, textTransform: 'uppercase', lineHeight: 1, letterSpacing: 0 }
// font-display: Oswald. Team names, times, the middle tier.
const display: CSSProperties = { fontFamily: 'Oswald', fontWeight: 700, letterSpacing: 1 }
// .glass-pill kickers: Inter 600, uppercase, 0.18em tracking.
const kicker: CSSProperties = { fontFamily: 'Inter', fontWeight: 600, textTransform: 'uppercase', color: INK_2 }
const body: CSSProperties = { fontFamily: 'Inter', fontWeight: 400, color: INK_2 }

/* ─────────────────────────────────────────────────────────────── PIECES */

/** .glass-card — enamelled dark glass with the top-edge highlight. */
function Glass({ style, children }: { style?: CSSProperties; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', display: 'flex', borderRadius: 22, border: '1px solid rgba(255,255,255,0.10)', backgroundImage: 'linear-gradient(180deg, rgba(23,29,39,0.94) 0%, rgba(11,14,20,0.97) 100%)', boxShadow: '0 20px 40px -24px rgba(0,0,0,0.85)', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.16)' }} />
      {children}
    </div>
  )
}

/** .glass-pill — the section kicker: 85% dark base, tracked uppercase, a colour dot. */
function Pill({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 999, padding: `${Math.round(size * 0.55)}px ${Math.round(size * 1.1)}px`, backgroundColor: 'rgba(12,15,21,0.85)', border: '1px solid rgba(255,255,255,0.16)' }}>
      <div style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5), borderRadius: 99, backgroundColor: color, marginRight: Math.round(size * 0.65), boxShadow: `0 0 ${size * 0.6}px ${color}` }} />
      <div style={{ ...kicker, fontSize: size, letterSpacing: size * 0.18, color: INK }}>{text}</div>
    </div>
  )
}

/** .enamel-red — the "Log This Game" button, struck as a badge. `gold` for the Front Office. */
function Enamel({ text, size, gold }: { text: string; size: number; gold?: boolean }) {
  const bg = gold ? 'linear-gradient(180deg, #f7d879 0%, #d9a323 55%, #a97a10 100%)' : 'linear-gradient(180deg, #f0413c 0%, #b00500 62%, #8e0300 100%)'
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: `${Math.round(size * 0.5)}px ${Math.round(size * 1.2)}px`, backgroundImage: bg, border: `1px solid ${gold ? '#7d5906' : '#7a0400'}`, boxShadow: gold ? '0 4px 14px rgba(0,0,0,0.5), 0 0 24px -6px rgba(229,181,60,0.6)' : '0 4px 14px rgba(0,0,0,0.5), 0 0 22px -6px rgba(225,6,0,0.65)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: gold ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.55)' }} />
      <div style={{ ...display, fontSize: size, letterSpacing: size * 0.12, textTransform: 'uppercase', color: gold ? '#1a1206' : '#FFFFFF', textShadow: gold ? 'none' : '0 1px 2px rgba(0,0,0,0.45)' }}>{text}</div>
    </div>
  )
}

/** The Broadcast Shield with its monogram drawn by Satori (fonts do not reach a nested SVG on the edge). */
function Shield({ league, abbr: a, size }: { league: string; abbr: string; size: number }) {
  const mono = monogramOf(a)
  const fs = Math.round(size * (mono.length >= 4 ? 0.26 : mono.length === 3 ? 0.32 : 0.4))
  return (
    <div style={{ position: 'relative', display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <img src={shieldDataUri(league, a, size)} width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }} alt="" />
      <div style={{ position: 'relative', display: 'flex', marginTop: -size * 0.04, ...display, fontSize: fs, color: '#F7FAFF', textShadow: `0 ${Math.max(2, size * 0.012)}px 0 #04060A, 0 0 ${size * 0.05}px rgba(4,6,10,0.9)`, letterSpacing: 2 }}>
        {mono}
      </div>
    </div>
  )
}

/** The frame every card shares: the stadium at night, the header, the footer. */
function Frame({ w, h, icon, chip, chipColor, footer, lit, children }: { w: number; h: number; icon: string; chip: string; chipColor: string; footer: string; lit?: string; children: React.ReactNode }) {
  const tall = h > w
  const pad = Math.round(w * (tall ? 0.055 : 0.042))
  const glow = lit || RED
  const iconSize = Math.round(w * 0.048)
  return (
    <div style={{ position: 'relative', display: 'flex', width: w, height: h, backgroundColor: CANVAS, overflow: 'hidden' }}>
      {/* .lit-red / .lit-blue: the floodlit sky, two blooms, a horizon */}
      <div style={{ position: 'absolute', left: w * 0.08, top: -h * 0.55, width: w * 0.84, height: h * 1.1, borderRadius: w, backgroundImage: `radial-gradient(${glow}38 0%, ${glow}00 62%)` }} />
      <div style={{ position: 'absolute', left: -w * 0.18, top: -h * 0.3, width: w * 0.6, height: w * 0.6, borderRadius: w, backgroundImage: 'radial-gradient(rgba(88,166,255,0.13) 0%, rgba(88,166,255,0) 60%)' }} />
      <div style={{ position: 'absolute', right: -w * 0.2, bottom: -h * 0.6, width: w * 0.75, height: w * 0.75, borderRadius: w, backgroundImage: `radial-gradient(${glow}1f 0%, ${glow}00 60%)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundImage: `linear-gradient(90deg, ${glow}00 0%, ${glow}99 50%, ${glow}00 100%)` }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', padding: `${Math.round(pad * 0.85)}px ${pad}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: Math.round(pad * 0.3) }}>
          <img src={icon} width={iconSize} height={iconSize} style={{ borderRadius: Math.round(iconSize * 0.24), boxShadow: '0 6px 18px rgba(0,0,0,0.6)' }} alt="" />
          <div style={{ ...headline, fontSize: Math.round(w * 0.03), color: INK, marginLeft: Math.round(iconSize * 0.32), letterSpacing: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>SCOREBUG</div>
          <div style={{ flex: 1 }} />
          <Pill text={chip} color={chipColor} size={Math.round(w * 0.0135)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, width: '100%' }}>{children}</div>

        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginTop: Math.round(pad * 0.45) }}>
          <div style={{ ...kicker, fontSize: Math.round(w * 0.0135), letterSpacing: 2.5, color: INK_3 }}>{footer}</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: Math.round(w * 0.015), color: INK_2, letterSpacing: 0.5 }}>getscorebug.app</div>
        </div>
      </div>
    </div>
  )
}

/** The 5.0 bar from the app's Game Rating tile: five enamelled segments, filled to the grade. */
function Dial({ grade, w, color }: { grade: number | null; w: number; color: string }) {
  const seg = Math.round(w * 0.07)
  const gap = Math.round(w * 0.008)
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = grade == null ? 0 : Math.max(0, Math.min(1, grade - i))
        return (
          <div key={i} style={{ position: 'relative', display: 'flex', width: seg, height: Math.round(seg * 0.3), marginRight: i < 4 ? gap : 0, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            {fill > 0 ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, backgroundImage: `linear-gradient(180deg, ${color} 0%, ${color}AA 100%)`, boxShadow: `0 0 12px ${color}` }} /> : null}
          </div>
        )
      })}
    </div>
  )
}

/** The matchup tile from the app's Log Entry: away colour to the left, home colour to the right, the score across the middle. */
function Scoreboard({ w, league, a, an, as_, h, hn, hs, detail, square, pregame, compact }: { w: number; league: string; a: string; an: string; as_: string; h: string; hn: string; hs: string; detail: string; square: boolean; pregame: boolean; compact: boolean }) {
  const shield = Math.round(w * (square ? 0.22 : compact ? 0.115 : 0.15))
  const scoreSize = Math.round(w * (square ? 0.15 : compact ? 0.085 : 0.11))
  const nameSize = Math.round(w * (square ? 0.03 : 0.021))
  const long = as_.length > 3 || hs.length > 3
  const awayC = shieldPrimary(league, a), homeC = shieldPrimary(league, h)
  const side = (ab: string, name: string, sc: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36%' }}>
      <Shield league={league} abbr={ab} size={shield} />
      <div style={{ display: 'flex', ...display, fontWeight: 500, fontSize: nameSize, color: INK, marginTop: Math.round(w * 0.006), letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{name || ab}</div>
      {pregame ? null : <div style={{ display: 'flex', ...headline, fontSize: long ? Math.round(scoreSize * 0.42) : scoreSize, color: INK, marginTop: Math.round(w * 0.004), textShadow: '0 2px 0 #04060A, 0 6px 24px rgba(0,0,0,0.6)' }}>{sc}</div>}
    </div>
  )
  return (
    <Glass style={{ width: '100%', padding: `${Math.round(w * (square ? 0.03 : compact ? 0.012 : 0.018))}px ${Math.round(w * 0.02)}px` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', backgroundImage: `linear-gradient(90deg, ${awayC}40 0%, ${awayC}00 100%)` }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundImage: `linear-gradient(270deg, ${homeC}40 0%, ${homeC}00 100%)` }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {side(a, an, as_)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28%' }}>
          <div style={{ ...kicker, fontSize: Math.round(w * 0.016), letterSpacing: 5, color: INK_3 }}>{pregame ? 'AT' : 'VS'}</div>
          <div style={{ display: 'flex', marginTop: Math.round(w * 0.012) }}><Enamel text={detail} size={Math.round(w * 0.02)} /></div>
        </div>
        {side(h, hn, hs)}
      </div>
    </Glass>
  )
}

/** The two-tone hero: white line, red line — CHRONICLE / EVERY GAME. */
function Hero({ w, top, bottom, size, row }: { w: number; top: string; bottom: string; size: number; row?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', alignItems: row ? 'baseline' : 'flex-start' }}>
      <div style={{ ...headline, fontSize: size, color: INK, letterSpacing: -size * 0.018, textShadow: '0 4px 30px rgba(0,0,0,0.5)', marginRight: row ? size * 0.25 : 0 }}>{top}</div>
      <div style={{ ...headline, fontSize: size, color: RED, letterSpacing: -size * 0.018, textShadow: `0 0 ${Math.round(w * 0.04)}px rgba(248,81,73,0.45)` }}>{bottom}</div>
    </div>
  )
}

/** The league chips from the site's OG image: NHL · NFL · NBA … · N LEAGUES. Derived from the site's own registry, never typed. */
function LeagueChips({ w, max, tail }: { w: number; max: number; tail?: string }) {
  const fs = Math.round(w * 0.0135)
  const chips = LEAGUES.slice(0, max).map(l => l.label.length > 5 ? l.id : l.label)
  chips.push(tail || `${LEAGUES.length} LEAGUES`)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
      {chips.map((c, i) => (
        <div key={i} style={{ display: 'flex', marginRight: Math.round(fs * 0.7), marginBottom: Math.round(fs * 0.7), borderRadius: 999, padding: `${Math.round(fs * 0.55)}px ${Math.round(fs * 1.1)}px`, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ ...kicker, fontSize: fs, letterSpacing: fs * 0.16, color: INK }}>{c}</div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────── ROUTE */

export async function GET(req: Request) {
  const q = await verifiedParams(new URL(req.url).searchParams)
  const kind = clean(q.get('k'), 12).toLowerCase()
  const sizeKey: SizeKey = (['wide', 'square', 'portrait', 'story'] as const).includes(q.get('size') as SizeKey) ? (q.get('size') as SizeKey) : 'wide'
  const { w, h } = SIZES[sizeKey]
  const square = sizeKey !== 'wide'
  const fontList = fonts()
  const icon = APP_ICON
  /*
   * ─── A YEAR, NOT A DAY ──────────────────────────────────────────────────
   * A card is a pure function of its query string: the same parameters can
   * only ever draw the same pixels, and a card whose numbers changed would
   * arrive at a different URL. So the only thing a 24-hour expiry bought was
   * re-rendering every card once a day for nobody, and rendering a PNG is the
   * most CPU-expensive thing this deployment does. `immutable` already
   * promised the file would never change; the max-age now says so too.
   */
  const opts = { width: w, height: h, fonts: fontList, headers: { 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable' } }

  const league = clean(q.get('l'), 10).toUpperCase()
  const chipColor = LEAGUE_COLOR[league] || BLUE
  const leagueName = LEAGUE_NAME[league] || (league || 'SCOREBUG')

  if (kind === 'final' || kind === 'pregame' || kind === 'archive') {
    const a = abbr(q.get('a')), hh = abbr(q.get('h'))
    const an = clean(q.get('an'), 22), hn = clean(q.get('hn'), 22)
    const as_ = kind === 'pregame' ? '' : score(q.get('as')), hs = kind === 'pregame' ? '' : score(q.get('hs'))
    const detail = clean(q.get('d'), 18) || (kind === 'pregame' ? 'TONIGHT' : 'FINAL')
    const date = clean(q.get('date'), 24)
    const season = clean(q.get('season'), 9)
    const st = clean(q.get('st'), 10).toLowerCase()
    const years = num(q.get('years'), 1, 60, 0)
    const band = clean(q.get('band'), 10).toLowerCase()
    const grade = q.get('g') != null ? num(q.get('g'), 0, 5, 0) : null
    const n = num(q.get('n'), 0, 1_000_000, 0)
    const chip = `${leagueName}${st === 'preseason' ? ' · PRESEASON' : st === 'playoffs' ? ' · PLAYOFFS' : ''}${season ? ` · ${season}` : ''}`
    const footer = kind === 'archive' && years ? `${date} · ${years} YEARS AGO TODAY` : date || (kind === 'pregame' ? 'TONIGHT' : 'FINAL')
    const community = band === 'community' && n > 0 && grade != null
    const pregame = kind === 'pregame'
    const bandGap = Math.round(w * (square ? 0.035 : 0.018))
    // The two-tone line above the tile. Square and portrait always carry one
    // (the tall shapes have the room); wide carries it only for the beats that
    // need it. The engine may pass its own as `hl=TOP|BOTTOM`, clamped.
    const hero = kind === 'archive' || pregame || square
    const heroSize = Math.round(w * (square ? 0.07 : 0.046))
    const [hlTop, hlBottom] = (() => {
      const given = clean(q.get('hl'), 40).split('|').map(x => clean(x, 18)).filter(Boolean)
      if (given.length === 2) return given
      if (kind === 'archive') return ['THIS DAY,', years ? `${years} YEARS AGO.` : 'FROM THE ARCHIVE.']
      if (pregame) return ['TONIGHT.', 'LINE IT UP.']
      if (community) return ['THE FANS', 'HAVE GRADED IT.']
      return ['FINAL.', 'GRADE IT.']
    })()
    return new ImageResponse(
      (
        <Frame w={w} h={h} icon={icon} chip={chip} chipColor={chipColor} footer={footer} lit={kind === 'archive' ? GOLD : pregame ? BLUE : RED}>
          {hero ? <div style={{ display: 'flex', marginBottom: bandGap }}><Hero w={w} top={hlTop} bottom={hlBottom} size={heroSize} row={!square} /></div> : null}
          <Scoreboard w={w} league={league} a={a} an={an} as_={as_} h={hh} hn={hn} hs={hs} detail={detail} square={square} pregame={pregame} compact={hero && !square} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: bandGap }}>
            {pregame ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...kicker, fontSize: Math.round(w * 0.015), letterSpacing: 3, color: INK }}>ADD IT TO YOUR DOCKET</div>
                <div style={{ ...body, fontSize: Math.round(w * 0.018), marginTop: 6 }}>Grade it when it is over. Keep it for good.</div>
              </div>
            ) : community ? (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ ...headline, fontSize: Math.round(w * 0.06), color: INK, textShadow: '0 2px 0 #04060A' }}>{grade!.toFixed(1)}</div>
                <div style={{ ...display, fontWeight: 500, fontSize: Math.round(w * 0.022), color: INK_3, marginLeft: 10, marginBottom: Math.round(w * 0.008) }}>/ 5.0</div>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: Math.round(w * 0.024), marginBottom: Math.round(w * 0.006) }}>
                  <div style={{ ...kicker, fontSize: Math.round(w * 0.013), letterSpacing: 3, color: RED }}>COMMUNITY GRADE</div>
                  <div style={{ ...body, fontSize: Math.round(w * 0.017), marginTop: 4 }}>{`from ${n} log${n === 1 ? '' : 's'} on Scorebug`}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...kicker, fontSize: Math.round(w * 0.015), letterSpacing: 3, color: INK }}>{band === 'score' ? 'ON THE RECORD' : 'GRADE IT OUT OF 5.0'}</div>
                <div style={{ ...body, fontSize: Math.round(w * 0.018), marginTop: 6 }}>{band === 'score' ? 'Log it, and it is yours for good.' : 'Log it, say what it meant, keep it for good.'}</div>
              </div>
            )}
            {pregame ? <Enamel text="LOG THIS GAME" size={Math.round(w * 0.016)} /> : <Dial grade={community ? grade : null} w={w} color={RED} />}
          </div>
        </Frame>
      ),
      opts,
    )
  }

  if (kind === 'slate') {
    const rows = q.getAll('g').slice(0, 5).map(r => clean(r, 120).split('|')).map(([lg, aw, hm, time, awn, hmn]) => ({ league: (lg || '').toUpperCase(), away: abbr(aw), home: abbr(hm), time: clean(time || '', 10), awayName: clean(awn || '', 20), homeName: clean(hmn || '', 20) }))
    const day = clean(q.get('day'), 24)
    const gap = Math.round(w * 0.01)
    const rowH = Math.round((h - w * (square ? 0.36 : 0.28)) / Math.max(3, rows.length)) - gap
    const shield = Math.round(Math.min(rowH * 0.78, w * 0.085))
    return new ImageResponse(
      (
        <Frame w={w} h={h} icon={icon} chip="THE SLATE" chipColor={TEAL} footer={day ? `${day} · LOG THE ONES YOU WATCH` : 'LOG THE ONES YOU WATCH'} lit={BLUE}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {rows.map((r, i) => {
              const awayC = shieldPrimary(r.league, r.away), homeC = shieldPrimary(r.league, r.home)
              return (
                <Glass key={i} style={{ width: '100%', height: rowH, marginBottom: i < rows.length - 1 ? gap : 0, alignItems: 'center', padding: `0 ${Math.round(w * 0.018)}px` }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '45%', backgroundImage: `linear-gradient(90deg, ${awayC}33 0%, ${awayC}00 100%)` }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%', backgroundImage: `linear-gradient(270deg, ${homeC}33 0%, ${homeC}00 100%)` }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', width: Math.round(w * 0.1), alignItems: 'center' }}>
                      <Pill text={(LEAGUE_NAME[r.league] || r.league).length > 6 ? r.league : (LEAGUE_NAME[r.league] || r.league)} color={LEAGUE_COLOR[r.league] || BLUE} size={Math.round(w * 0.011)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      {r.away ? <Shield league={r.league} abbr={r.away} size={shield} /> : null}
                      <div style={{ display: 'flex', alignItems: 'center', ...display, fontWeight: 500, fontSize: Math.round(w * 0.026), color: INK, margin: `0 ${Math.round(w * 0.014)}px`, letterSpacing: 1, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex' }}>{r.awayName || r.away}</div>
                        <div style={{ display: 'flex', ...kicker, fontSize: Math.round(w * 0.012), color: INK_3, margin: `0 ${Math.round(w * 0.012)}px`, letterSpacing: 3 }}>{r.away ? 'AT' : ''}</div>
                        <div style={{ display: 'flex' }}>{r.homeName || r.home}</div>
                      </div>
                      {r.home ? <Shield league={r.league} abbr={r.home} size={shield} /> : null}
                    </div>
                    <div style={{ display: 'flex', width: Math.round(w * 0.1), justifyContent: 'flex-end' }}>
                      <div style={{ ...display, fontWeight: 500, fontSize: Math.round(w * 0.024), color: GOLD, letterSpacing: 1 }}>{r.time}</div>
                    </div>
                  </div>
                </Glass>
              )
            })}
          </div>
        </Frame>
      ),
      opts,
    )
  }

  if (kind === 'week') {
    const count = num(q.get('count'), 0, 9999, 0)
    const leagues = num(q.get('leagues'), 0, 30, 0)
    const range = clean(q.get('range'), 40)
    return new ImageResponse(
      (
        <Frame w={w} h={h} icon={icon} chip="THE WEEK AHEAD" chipColor={BLUE} footer={range.toUpperCase()} lit={BLUE}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ ...headline, fontSize: Math.round(w * (square ? 0.3 : 0.24)), color: INK, textShadow: '0 4px 0 #04060A, 0 12px 40px rgba(0,0,0,0.6)' }}>{String(count)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: Math.round(w * 0.03), marginBottom: Math.round(w * 0.03) }}>
                <Hero w={w} top="GAMES" bottom="THIS WEEK." size={Math.round(w * (square ? 0.075 : 0.06))} />
              </div>
            </div>
            <div style={{ ...body, fontSize: Math.round(w * 0.022), marginTop: Math.round(w * 0.02), maxWidth: w * 0.8 }}>{`Across ${leagues} leagues, on The Slate. Line up the ones you will watch.`}</div>
            <div style={{ display: 'flex', marginTop: Math.round(w * 0.025) }}><LeagueChips w={w} max={7} tail={`${leagues} IN SEASON`} /></div>
          </div>
        </Frame>
      ),
      opts,
    )
  }

  if (kind === 'numbers') {
    const logs = num(q.get('logs'), 0, 9_999_999, 0)
    const leagues = num(q.get('leagues'), 0, 30, 0)
    const top = clean(q.get('top'), 60)
    const g = q.get('g') != null ? num(q.get('g'), 0, 5, 0) : null
    const n = num(q.get('n'), 0, 9_999_999, 0)
    return new ImageResponse(
      (
        <Frame w={w} h={h} icon={icon} chip="THIS WEEK ON SCOREBUG" chipColor={TEAL} footer="YOURS ARE IN THE VAULT" lit={TEAL}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ ...headline, fontSize: Math.round(w * (square ? 0.24 : 0.19)), color: INK, textShadow: '0 4px 0 #04060A, 0 12px 40px rgba(0,0,0,0.6)' }}>{String(logs)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: Math.round(w * 0.028), marginBottom: Math.round(w * 0.024) }}>
                <Hero w={w} top="GAMES" bottom="LOGGED." size={Math.round(w * (square ? 0.07 : 0.055))} />
                <div style={{ ...kicker, fontSize: Math.round(w * 0.014), letterSpacing: 3, color: INK_2, marginTop: Math.round(w * 0.01) }}>{`ACROSS ${leagues} LEAGUES`}</div>
              </div>
            </div>
            {top ? (
              <Glass style={{ width: '100%', marginTop: Math.round(w * 0.03), padding: `${Math.round(w * 0.02)}px ${Math.round(w * 0.025)}px`, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ ...kicker, fontSize: Math.round(w * 0.013), letterSpacing: 3, color: RED }}>HIGHEST COMMUNITY GRADE</div>
                  <div style={{ ...display, fontWeight: 500, fontSize: Math.round(w * 0.038), color: INK, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{top}</div>
                  {n ? <div style={{ ...body, fontSize: Math.round(w * 0.016), marginTop: 6 }}>{`from ${n} logs`}</div> : null}
                </div>
                {g != null ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ ...headline, fontSize: Math.round(w * 0.06), color: INK, marginRight: Math.round(w * 0.02) }}>{g.toFixed(1)}</div>
                    <Dial grade={g} w={w} color={RED} />
                  </div>
                ) : null}
              </Glass>
            ) : null}
          </div>
        </Frame>
      ),
      opts,
    )
  }

  // product (and anything unknown): the promise, in the site's own two-tone voice.
  const t = clean(q.get('t'), 16).toLowerCase()
  const LINES: Record<string, [string, string, string, string?]> = {
    vault: ['CHRONICLE', 'EVERY GAME.', 'The ultimate fan log. Every game you watch, graded out of 5.0 and kept for good in your Vault.'],
    leagues: [`${LEAGUES.length} LEAGUES.`, 'ZERO ODDS.', 'From the NHL to the J.League — live scores, and no odds anywhere in it.'],
    archive: ['BACK TO', '2002.', 'The one you drove six hours for counts. Log it from the season it happened.'],
    slate: ['EVERY GAME', 'TODAY.', 'The Slate: one timeline for every league. Log the ones you watch, grade them, keep them.'],
    promise: ['ZERO GAMBLING.', 'ZERO BETTING.', 'There is none in Scorebug, and there never will be.'],
    bleachers: ['SAY WHAT', 'IT MEANT.', 'The Bleachers, where fans grade a game and write down why.'],
    'front-office': ['YOUR SEASON', 'IN NUMBERS.', 'The Front Office: your Vault as a season in numbers, and not a single ad.', 'gold'],
  }
  /* Object.hasOwn, not `LINES[t] || LINES.vault`. `t` is lowercased, and
     "constructor" and "__proto__" are already lowercase — both survive clean()
     intact, both resolve on Object.prototype to something truthy and
     non-iterable, so `|| LINES.vault` never fired and the array destructuring
     threw. `GET /api/card?t=constructor` was a one-request unauthenticated 500
     on the public image endpoint. */
  const [top, bottom, small, tone] = Object.hasOwn(LINES, t) ? LINES[t] : LINES.vault
  const gold = tone === 'gold'
  const longest = Math.max(top.length, bottom.length)
  const heroSize = Math.round(w * (square ? (longest > 12 ? 0.125 : 0.15) : (longest > 12 ? 0.085 : 0.105)))
  return new ImageResponse(
    (
      <Frame w={w} h={h} icon={icon} chip="THE LOGBOOK FOR EVERY GAME YOU WATCH" chipColor={gold ? GOLD : RED} footer="FREE ON THE WEB" lit={gold ? GOLD : RED}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...headline, fontSize: heroSize, color: INK, letterSpacing: -heroSize * 0.018, textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>{top}</div>
            <div style={{ ...headline, fontSize: heroSize, color: gold ? GOLD : RED, letterSpacing: -heroSize * 0.018, textShadow: gold ? `0 0 ${Math.round(w * 0.04)}px rgba(229,181,60,0.4)` : `0 0 ${Math.round(w * 0.04)}px rgba(248,81,73,0.45)` }}>{bottom}</div>
          </div>
          <div style={{ ...body, fontSize: Math.round(w * 0.026), marginTop: Math.round(w * 0.022), lineHeight: 1.4, maxWidth: w * 0.78 }}>{small}</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: Math.round(w * 0.028) }}>
            <Enamel text={gold ? 'THE FRONT OFFICE' : 'LOG THIS GAME'} size={Math.round(w * 0.016)} gold={gold} />
            <div style={{ display: 'flex', marginLeft: Math.round(w * 0.025) }}><LeagueChips w={w} max={square ? 5 : 7} /></div>
          </div>
        </div>
      </Frame>
    ),
    opts,
  )
}
