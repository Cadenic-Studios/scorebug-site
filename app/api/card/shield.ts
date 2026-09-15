/**
 * SCOREBUG // THE BROADCAST SHIELD, AS AN SVG STRING
 *
 * The app draws an original geometric crest for every club from its published
 * colours and one of five geometry archetypes (app/components/GenericTeamBadge
 * in scorebug-app) precisely so that no trademarked logo ever renders. The
 * card press needs the same crest as a self-contained SVG it can hand to Satori
 * as an image, so this is that component's geometry re-stated as a string:
 * shape, bands, monogram, rim. Nothing here fetches anything.
 *
 * Colours come from app/lib/shields.gen.ts, which is generated from the app's
 * dictionaries by scripts/gen-shields.mjs — re-run it when a club is added.
 */

import { SHIELDS, ALIASES, SOCCER_FALLBACKS, type ShieldRow } from '../../lib/shields.gen'

// The "Broadcast Pod": a continuous-curvature squircle-hybrid shield.
const SHIELD_PATH = 'M20 6 Q50 1 80 6 Q96 9 96 24 Q99 42 96 58 Q94 78 50 93 Q6 78 4 58 Q1 42 4 24 Q4 9 20 6 Z'

function luminance(hex: string): number {
  const v = hex.replace('#', '')
  if (v.length < 6) return 0.5
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
function rgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b)
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
const lighten = (c: string, t: number) => mix(c, '#FFFFFF', t)
const darken = (c: string, t: number) => mix(c, '#04060A', t)
function vivid(c: string, floor = 0.24, mult = 1.6): string {
  const l = luminance(c)
  return l >= floor ? c : lighten(c, (floor - l) * mult)
}
/** A usable accent: skips near-black and near-white placeholder slots. */
function pickAccent(p: string, s: string, a: string): string {
  for (const c of [a, s, p]) {
    const l = luminance(c)
    if (l > 0.14 && l < 0.86) return vivid(c)
  }
  return vivid(p)
}

/** Resolve a league + abbreviation to a shield row, through the app's aliases and soccer cross-fill. */
export function findShield(league: string, abbr: string): ShieldRow | null {
  const lg = String(league || '').toUpperCase()
  const raw = String(abbr || '').toUpperCase()
  const tryLeague = (l: string): ShieldRow | null => {
    const dict = SHIELDS[l]
    if (!dict) return null
    const key = (ALIASES[l] && ALIASES[l][raw]) || raw
    return dict[key] || dict[raw] || null
  }
  const direct = tryLeague(lg)
  if (direct) return direct
  for (const alt of SOCCER_FALLBACKS[lg] || []) { const hit = tryLeague(alt); if (hit) return hit }
  return null
}

/** The geometry bands, clipped to the shape. Mirrors GenericTeamBadge's `inner`. */
function bands(g: string, p: string, s: string, a: string): string {
  const seam = (f: string) => `stroke="${f}" stroke-width="0.75" stroke-linejoin="round"`
  switch (g) {
    case 'solid-band':
      return `<rect x="0" y="34" width="100" height="40" fill="${p}" ${seam(p)}/><rect x="0" y="31" width="100" height="4" fill="${a}" ${seam(a)}/><rect x="0" y="74" width="100" height="4" fill="${a}" ${seam(a)}/><rect x="0" y="60" width="100" height="40" fill="${s}" opacity="0.9" ${seam(s)}/>`
    case 'triple-band':
      return `<rect x="0" y="20" width="100" height="18" fill="${p}" ${seam(p)}/><rect x="0" y="42" width="100" height="16" fill="${s}" ${seam(s)}/><rect x="0" y="62" width="100" height="18" fill="${p}" ${seam(p)}/><rect x="0" y="38" width="100" height="4" fill="${a}" ${seam(a)}/><rect x="0" y="58" width="100" height="4" fill="${a}" ${seam(a)}/>`
    case 'chevron':
      return `<polygon points="0,18 50,46 100,18 100,42 50,70 0,42" fill="${p}" ${seam(p)}/><polygon points="0,46 50,74 100,46 100,60 50,88 0,60" fill="${s}" ${seam(s)}/><polygon points="0,18 50,46 100,18 100,24 50,52 0,24" fill="${a}" opacity="0.85" ${seam(a)}/>`
    case 'diagonal':
      return `<polygon points="-10,58 48,-6 84,-6 -10,102" fill="${p}" ${seam(p)}/><polygon points="30,106 100,20 100,58 66,106" fill="${s}" ${seam(s)}/><polygon points="42,-6 60,-6 -10,78 -10,60" fill="${a}" opacity="0.9" ${seam(a)}/>`
    default: // yoke
      return `<path d="M-6 16 Q50 44 106 16 L106 42 Q50 70 -6 42 Z" fill="${p}" ${seam(p)}/><path d="M-6 42 Q50 70 106 42 L106 58 Q50 86 -6 58 Z" fill="${s}" ${seam(s)}/><path d="M-6 16 Q50 44 106 16 L106 21 Q50 49 -6 21 Z" fill="${a}" opacity="0.85" ${seam(a)}/>`
  }
}

/**
 * One shield as a self-contained SVG string — shape, bands, sheen, rim. The
 * MONOGRAM is deliberately not in here: resvg renders a nested SVG image with
 * no font available on the edge, so the letters are drawn by Satori on top
 * (route.tsx `Shield`), in Oswald, where the font is loaded. A club with no
 * dictionary entry gets a neutral carbon shield, which is the one fallback
 * that can never accidentally become a real crest.
 */
export function shieldSvg(league: string, abbr: string, size = 220): string {
  const row = findShield(league, abbr)
  const [p, s, a, g] = row ? [row[0], row[1], row[2], row[3]] : ['#2A3140', '#1B2029', '#9AA4B2', 'solid-band']
  const accent = pickAccent(p, s, a)
  const base = darken(p, 0.55)
  const uid = `s${Math.abs(hash(`${league}${abbr}`)).toString(36)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
<defs>
  <clipPath id="${uid}c"><path d="${SHIELD_PATH}"/></clipPath>
  <linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(base, 0.12)}"/><stop offset="1" stop-color="${darken(base, 0.35)}"/></linearGradient>
  <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
</defs>
<path d="${SHIELD_PATH}" fill="url(#${uid}g)"/>
<g clip-path="url(#${uid}c)">${bands(g, p, s, a)}</g>
<path d="${SHIELD_PATH}" fill="url(#${uid}s)"/>
<path d="${SHIELD_PATH}" fill="none" stroke="${accent}" stroke-width="2.6"/>
<path d="${SHIELD_PATH}" fill="none" stroke="#04060A" stroke-width="0.9" opacity="0.6"/>
</svg>`
}

export function shieldDataUri(league: string, abbr: string, size = 220): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shieldSvg(league, abbr, size))}`
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
/** The monogram the route draws over the shield: letters only, four at most. */
export function monogramOf(abbr: string): string {
  return String(abbr || '').toUpperCase().replace(/[^A-Z0-9&.-]/g, '').slice(0, 4) || '·'
}

/** The accent the route uses for the monogram tint, so text and rim agree. */
export function shieldAccent(league: string, abbr: string): string {
  const row = findShield(league, abbr)
  return row ? pickAccent(row[0], row[1], row[2]) : '#9AA4B2'
}

/**
 * The club's primary colour, lifted out of near-black so it reads as a wash —
 * the matchup tile in the app fades away-colour to home-colour behind the
 * score, and the card does the same. Unknown clubs wash in the site's blue.
 */
export function shieldPrimary(league: string, abbr: string): string {
  const row = findShield(league, abbr)
  if (!row) return '#58A6FF'
  const l = luminance(row[0])
  const c = l > 0.1 && l < 0.9 ? row[0] : luminance(row[1]) > 0.1 && luminance(row[1]) < 0.9 ? row[1] : row[2]
  return vivid(c, 0.3, 1.4)
}
