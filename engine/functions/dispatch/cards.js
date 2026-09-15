// Scorebug dispatch — the card press, from the engine's side.
//
// The site renders every card (scorebug-site/app/api/card/route.tsx) with
// Satori, in the brand's palette, with the app's Broadcast Shields — original
// geometric crests drawn from each team's colours, never a trademarked logo.
// The engine only builds the URL. That split is deliberate and it is the same
// one Delta-V settled on: Threads and Instagram will only take media as a
// PUBLIC URL, so a card that is already a URL is the one shape that works for
// every network, and a rasteriser in the functions package is a deploy risk
// this function does not need.
//
// Every parameter is clamped and sanitised again on the site side. This file
// keeps the URL short and stable so the same card is fetched once per post.

import { SITE } from './facts.js';
import { LEAGUE_BY_ID, clock, localParts, seasonLabel } from './leagues.js';
import { teamName } from './draft.js';
import { createHmac } from 'node:crypto';

/** The three shapes the site renders. `wide` is the link-preview shape; `square` is Threads and Instagram. */
export const SIZES = Object.freeze({ wide: { w: 1200, h: 675 }, square: { w: 1080, h: 1080 }, portrait: { w: 1080, h: 1350 } });

/**
 * ── SIGNING THE CLAIMS ──────────────────────────────────────────────────────
 *
 * The card press is public — Threads and Instagram fetch media by URL, so it
 * has to be. Most parameters are harmless: a scoreline is a public fact and a
 * faked one is a lie anyone could tell in an image editor. But a COMMUNITY
 * GRADE, a "games logged" total and a free-text headline are claims about
 * Scorebug in Scorebug's own voice, on Scorebug's own domain, and only this
 * engine can honestly make them. Those are signed; the site drops them if the
 * signature is missing or wrong, and renders the rest.
 *
 * Same key as the facts endpoint (DISPATCH_KEY), because it is the same trust
 * relationship: "this really did come from the engine".
 */
const CLAIM_PARAMS = ['hl', 'g', 'n', 'logs', 'top', 'band'];
let CARD_KEY = process.env.DISPATCH_KEY || '';
/** ignite writes the secret into the function env; run.js can also set it explicitly. */
export function setCardKey(k) { CARD_KEY = String(k || ''); }

/** Append `sig` when the URL carries a claim and we hold the key. */
function signed(url) {
  const u = new URL(url);
  if (!CARD_KEY) return url;
  if (!CLAIM_PARAMS.some((k) => u.searchParams.has(k))) return url;
  const pairs = [];
  for (const [k, v] of u.searchParams) if (k !== 'sig') pairs.push(`${k}=${v}`);
  const mac = createHmac('sha256', CARD_KEY).update(pairs.sort().join('&')).digest('hex').slice(0, 24);
  u.searchParams.set('sig', mac);
  return u.toString();
}

const q = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

function sizeFor(networks = []) {
  const set = new Set(networks);
  if (set.has('bluesky') || set.has('x') || set.has('mastodon')) return 'wide';
  if (set.has('instagram') || set.has('threads')) return 'square';
  return 'wide';
}

function sideParams(prefix, side) {
  if (!side) return {};
  return { [`${prefix}`]: side.abbr, [`${prefix}n`]: teamName(side), [`${prefix}s`]: side.scoreText != null ? side.scoreText : side.score };
}

/** The card for a game beat. `band` is what sits under the score: grade (empty dial), score (nothing), community (dial + n). */
export function gameCard(ev, { tz = 'America/Edmonton', band = 'grade', community = null } = {}) {
  const g = ev.game;
  const size = sizeFor(ev.networks);
  const p = localParts(g.start || Date.now(), tz);
  const params = {
    k: ev.type === 'ANNIVERSARY' ? 'archive' : ev.type === 'PREGAME' ? 'pregame' : 'final',
    l: g.league,
    ...sideParams('a', g.away),
    ...sideParams('h', g.home),
    d: ev.type === 'PREGAME' ? `${clock(g.start, tz)} MT` : g.detail || 'Final',
    date: `${p.date} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.month]} ${p.year}`,
    season: g.seasonYear ? seasonLabel(g.league, g.seasonYear) : null,
    st: g.seasonType === 1 ? 'preseason' : g.seasonType === 3 ? 'playoffs' : null,
    years: ev.type === 'ANNIVERSARY' ? ev.years : null,
    band: community && community.logs ? 'community' : band,
    g: community && community.grade != null ? community.grade : null,
    n: community && community.logs ? community.logs : null,
    // The two-tone line above the tile on the tall shapes. The site has a
    // default per kind; the morning-after beat is the one that reads better
    // with its own, because on Threads and Instagram the game was last night.
    hl: ev.type === 'MORNING' && !(community && community.logs) ? 'LAST NIGHT.|GRADE IT.' : null,
    size,
  };
  return { url: signed(`${SITE}/api/card?${q(params)}`), ...SIZES[size] };
}

/** The slate card: up to five fixtures with local times. */
export function slateCard(ev, { tz = 'America/Edmonton' } = {}) {
  const size = sizeFor(ev.networks);
  const games = (ev.pick || ev.games || []).slice(0, 5);
  const rows = games.map((x) => [x.league, x.away ? x.away.abbr : '', x.home ? x.home.abbr : '', clock(x.start, tz), x.away ? teamName(x.away) : (x.name || ''), x.home ? teamName(x.home) : ''].map((v) => String(v || '').replace(/\|/g, ' ')).join('|'));
  const p = localParts(Date.now(), tz);
  const params = { k: 'slate', day: ev.day || p.day, size };
  const base = `${SITE}/api/card?${q(params)}`;
  const rowsQ = rows.map((r) => `g=${encodeURIComponent(r)}`).join('&');
  return { url: signed(`${base}&${rowsQ}`), ...SIZES[size] };
}

/** A product line card, a week card, a numbers card — text-led cards the site knows by kind. */
export function textCard(ev, extra = {}) {
  const size = sizeFor(ev.networks);
  const kind = ev.type === 'PRODUCT' ? 'product' : ev.type === 'WEEKAHEAD' ? 'week' : ev.type === 'WEEKNUMBERS' ? 'numbers' : 'product';
  return { url: signed(`${SITE}/api/card?${q({ k: kind, size, ...extra })}`), ...SIZES[size] };
}

/** The attachment spec run.js hands to media.js. */
export function cardFor(ev, o = {}) {
  let card;
  if (ev.type === 'SLATE') card = slateCard(ev, o);
  else if (ev.type === 'PRODUCT') card = textCard(ev, { t: o.productId || '' });
  else if (ev.type === 'WEEKAHEAD') card = textCard(ev, { count: ev.week.count, leagues: ev.week.leagues, range: ev.week.range });
  else if (ev.type === 'WEEKNUMBERS') card = textCard(ev, { logs: ev.community.logs, leagues: ev.community.leagues, top: ev.community.top ? ev.community.top.scoreline : '', g: ev.community.top ? ev.community.top.grade : '', n: ev.community.top ? ev.community.top.logs : '' });
  else if (ev.game) card = gameCard(ev, o);
  else return null;
  return { url: card.url, publicUrl: card.url, kind: 'image', width: card.w, height: card.h, alt: o.alt || 'A Scorebug card.' };
}

export function leagueLabel(id) { const l = LEAGUE_BY_ID[id]; return l ? l.name : id; }
