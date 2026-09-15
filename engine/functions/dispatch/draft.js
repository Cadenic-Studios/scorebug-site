// Scorebug dispatch — drafting and the linter.
//
// Templates carry the facts in a fixed order so a wrong phrasing can never
// move a number. The voice is a scoreboard that asks you what you thought:
// the scoreline, the one thing the record says made it worth watching, and
// the invitation to grade it. Nothing else.
//
// ── NO NAMES ────────────────────────────────────────────────────────────────
//
// Sports posts name people constantly and this machine never does. A post that
// says "Titans 16, Lions 15. One point." is true forever; a post that says who
// missed the kick is one bad night from a brand account talking about a real
// person's worst day. So every template speaks in teams and scores, every
// record's named athletes are handed to the linter, and a draft that contains
// one of them goes to the owner instead of to a network.

import { tagsFor, tagLine, TAG_BUDGET } from './tags.js';
import { LEAGUE_BY_ID, SPORT_SHAPE, clock, longDate, localParts } from './leagues.js';
import { SITE, WEB_APP, productLines, factNumbers, FALLBACK_FACTS } from './facts.js';
import { features } from './rank.js';
import { bettingHit, namesIn, fold } from './safety.js';

export { SITE, WEB_APP };
export const LIMITS = { bluesky: 300, mastodon: 500, threads: 500, x: 280, xReply: 280, instagram: 2200 };

/* ─────────────────────────────────────────────────────────────── LINKS */

/**
 * A site link, tagged for analytics and short enough to read.
 *
 * Spelled out, the UTM form is ~70 characters of visible machinery on every
 * post. `/r/<path>?s=&c=` rebuilds the identical tagging server-side (see
 * scorebug-site/app/r/[...path]/route.ts) and passes through the two query
 * keys the app's deep links need. Extra keys are whitelisted there, not here.
 */
export function tagged(path, network, campaign, extra = {}) {
  const c = String(campaign || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  const p = String(path || '').replace(/^\/+|\/+$/g, '');
  const q = [`s=${network}`, c ? `c=${c}` : '', ...Object.entries(extra).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)].filter(Boolean).join('&');
  return p ? `${SITE}/r/${p}?${q}` : `${SITE}/?${q}`;
}

/**
 * ── THE STORE LINK ──────────────────────────────────────────────────────────
 *
 * `/get` is the one link that is allowed to be about the app rather than a
 * page. The site's route reads LAUNCH_STAGE: at `testing` it lands on the
 * waitlist with the tags carried into the form's `source`; at `live` it lands
 * on Google Play with the identical tags rebuilt as a Play referrer. So the
 * engine can post the same 40-character link for the life of the product and
 * never advertise a listing that does not admit the reader.
 */
export function getUrl(network, campaign) {
  const c = String(campaign || 'dispatch').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${SITE}/get?s=${network}&c=${c}`;
}

/** Deep link into The Log for a specific game, through the site's tagged redirect. */
export function logUrl(game, network, campaign) {
  const extra = game && game.espnId && game.source === 'espn' ? { gameId: game.espnId, gameTime: game.start ? new Date(game.start).toISOString() : undefined } : {};
  return tagged('the-log', network, campaign, extra);
}

/* ─────────────────────────────────────────────────────────── WORDING */

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const word = (n) => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

const UNIT = Object.freeze({ hockey: 'goal', soccer: 'goal', basketball: 'point', football: 'point', baseball: 'run', cricket: 'run', racing: '' });

/** Team as a person says it: "Chiefs", "Arsenal", "Blue Jays". */
export function teamName(side) {
  if (!side) return '';
  return side.short || side.nickname || side.name || side.abbr || '';
}

/** "Titans 16, Lions 15" — winner first; a draw is home first. Cricket keeps its own scoreline strings. */
export function scoreline(game) {
  const h = game.home, a = game.away;
  if (game.sport === 'cricket') {
    const w = h.winner ? h : a.winner ? a : null;
    const l = w === h ? a : h;
    if (w && w.scoreText && l.scoreText) return `${teamName(w)} ${w.scoreText}, ${teamName(l)} ${l.scoreText}`;
    return `${teamName(h)} ${h.scoreText || ''}, ${teamName(a)} ${a.scoreText || ''}`.replace(/\s+,/g, ',');
  }
  if (h.score == null || a.score == null) return `${teamName(a)} at ${teamName(h)}`;
  if (h.score === a.score) return `${teamName(h)} ${h.score}, ${teamName(a)} ${a.score}`;
  const w = h.score > a.score ? h : a;
  const l = w === h ? a : h;
  return `${teamName(w)} ${w.score}, ${teamName(l)} ${l.score}`;
}

/** The suffix that says how it ended, from the record only. */
export function endingClause(game) {
  const d = String(game.detail || '');
  const shape = SPORT_SHAPE[game.sport] || SPORT_SHAPE.soccer;
  if (game.sport === 'soccer') {
    if (/pen|shootout/i.test(d)) return 'On penalties.';
    if (/AET|extra/i.test(d) || (game.period != null && game.period > 2)) return 'After extra time.';
    if (game.home.score != null && game.home.score === game.away.score) return 'A draw.';
    return '';
  }
  if (game.sport === 'hockey') {
    if (/\bSO\b|shootout/i.test(d)) return 'Shootout.';
    if (/\bOT\b/i.test(d)) return 'Overtime.';
    return '';
  }
  if (game.sport === 'baseball') {
    if (game.period != null && game.period > 9) return `${game.period} innings.`;
    if (/\/(\d\d)/.test(d)) return `${d.match(/\/(\d\d)/)[1]} innings.`;
    return '';
  }
  if (game.sport === 'basketball' || game.sport === 'football') {
    const m = /(\d)OT/i.exec(d);
    if (m) return `${cap(word(Number(m[1])))} overtimes.`;
    if (/\bOT\b/i.test(d)) return 'Overtime.';
    return '';
  }
  return shape.ot && /\bOT\b/i.test(d) ? 'Overtime.' : '';
}

/** One clause about what the record says made it a game. Never more than one. */
export function featureClause(game, f) {
  const unit = UNIT[game.sport] || '';
  if (f.tight && f.margin === 1 && unit) return `One ${unit}.`;
  if (f.tight && f.margin != null && f.margin > 1 && unit) return `By ${word(f.margin)}.`;
  if (f.comeback) {
    const after = comebackAfter(game);
    if (after) return `${teamName(winnerOf(game))} trailed after the ${ORD[after] || `${after}th`}.`;
    return `${teamName(winnerOf(game))} came from behind.`;
  }
  if (f.upset && winnerOf(game)) return `${teamName(winnerOf(game))} came in with the worse record.`;
  if (f.playoff) return 'A playoff game.';
  if (f.highTotal && f.total != null) return `${f.total} ${unit}s between them.`;
  if (f.rivalry) return 'A rivalry game.';
  if (f.close && f.margin != null && unit) return `By ${word(f.margin)}.`;
  return '';
}

function winnerOf(game) {
  const h = game.home, a = game.away;
  if (h.score == null || a.score == null || h.score === a.score) return h.winner ? h : a.winner ? a : null;
  return h.score > a.score ? h : a;
}

/** The last period after which the eventual winner still trailed. */
export function comebackAfter(game) {
  const h = game.home, a = game.away;
  if (!h.linescores.length || h.linescores.length !== a.linescores.length || h.score == null || a.score == null || h.score === a.score) return 0;
  const winnerHome = h.score > a.score;
  let hs = 0, as = 0, last = 0;
  for (let i = 0; i < h.linescores.length - 1; i += 1) {
    hs += h.linescores[i]; as += a.linescores[i];
    if ((winnerHome ? as - hs : hs - as) > 0) last = i + 1;
  }
  return last;
}

/** The invitation to grade. The bandit chooses the form; none of them can be wrong. */
export const INVITES = Object.freeze({
  question: 'What was it out of 5.0?',
  statement: 'Grade it out of 5.0 and keep it.',
  log: 'Log it. Grade it out of 5.0.',
  none: '',
});

/* ──────────────────────────────────────────────────────────── TEMPLATES */

function leagueName(game) { const l = LEAGUE_BY_ID[game.league]; return l ? l.name : game.league; }

/**
 * Build the per-network texts for an event.
 * @param {object} ev  from events.detect, after rank.select (carries networks, features, link)
 * @param {object} o   { now, tz, facts, invite: 'question'|'statement'|'log'|'none', productIndex }
 */
export function draft(ev, o = {}) {
  const { now = Date.now(), tz = 'America/Edmonton', facts = FALLBACK_FACTS, invite = 'statement', productIndex } = o;
  const g = ev.game;
  const f = ev.features || (g ? features(g, { tz }) : null);
  const inviteLine = INVITES[invite] ?? INVITES.statement;
  /* ── THE INVITE VARIANT RIDES IN THE CAMPAIGN TAG ─────────────────────────
     The bandit chooses between four closing lines and then measures them by
     LIKES, because likes are all it could see. Likes are a proxy for a proxy.
     Putting the variant in the campaign means the tag that reaches
     `tester_signups.source` reads `dispatch:bluesky:final-q`, and the engine
     can finally answer the only question that matters about a closing line:
     which one brings someone to the waitlist. One letter, so the tag stays
     short and the source values still group cleanly by beat. */
  const iv = { question: 'q', statement: 's', log: 'l', none: 'n' }[INVITES[invite] != null ? invite : 'statement'];
  const camp = (beat) => `${beat}-${iv}`;

  if (ev.type === 'FINAL' || ev.type === 'MORNING') {
    const lead = [ev.type === 'MORNING' ? 'Last night.' : '', `${scoreline(g)}.`, endingClause(g)].filter(Boolean).join(' ');
    const second = [featureClause(g, f), leagueName(g) && g.seasonType === 1 ? 'Preseason.' : ''].filter(Boolean).join(' ');
    return compose({ lead, second, close: inviteLine, url: logUrl(g, 'NET', camp(ev.type.toLowerCase())), campaign: camp(ev.type.toLowerCase()), type: ev.type, game: g, networks: ev.networks, link: ev.link });
  }

  if (ev.type === 'PREGAME') {
    const when = `${clock(g.start, tz)} MT`;
    const lead = `${teamName(g.away)} at ${teamName(g.home)} in an hour, ${when}${g.broadcast ? `, on ${g.broadcast}` : ''}.`;
    const bits = [];
    if (g.week != null && (g.league === 'NFL' || g.league === 'CFL' || g.league === 'NCAAF')) bits.push(`Week ${g.week}.`);
    if (g.note) bits.push(`${g.note}.`.replace(/\.\.$/, '.'));
    if (f.rivalry) bits.push('A rivalry game.');
    if (f.playoff) bits.push('A playoff game.');
    if (g.seasonType === 1) bits.push('Preseason.');
    return compose({ lead, second: bits.join(' '), close: 'Grade it when it is over.', url: logUrl(g, 'NET', camp('pregame')), campaign: camp('pregame'), type: 'PREGAME', game: g, networks: ev.networks, link: false });
  }

  if (ev.type === 'SLATE') {
    const p = localParts(now, tz);
    const day = ({ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' })[p.weekday] || 'Today';
    const games = ev.pick || ev.games.slice(0, 5);
    const items = games.map((x) => (x.sport === 'racing' ? `${x.name || 'the race'} ${clock(x.start, tz)}` : `${teamName(x.away)} at ${teamName(x.home)} ${clock(x.start, tz)}`));
    const lead = `${day} on The Slate. ${items.join(', ')} MT.`;
    const more = ev.games.length > games.length ? `${ev.games.length} games across ${new Set(ev.games.map((x) => x.league)).size} leagues today.` : '';
    return compose({ lead, second: more, close: 'Log the ones you watch.', url: tagged('the-slate', 'NET', camp('slate')), campaign: camp('slate'), type: 'SLATE', game: null, networks: ev.networks, link: false, extraTags: [] });
  }

  if (ev.type === 'ANNIVERSARY') {
    const lead = `${longDate(g.start, tz)}. ${scoreline(g)}. ${endingClause(g)}`.replace(/\s+$/, '');
    const second = [featureClause(g, f), `${ev.years} years ago today, in the ${leagueName(g)}.`].filter(Boolean).join(' ');
    return compose({ lead, second, close: 'It is in the archive if you were there.', url: getUrl('NET', camp('archive')), campaign: camp('archive'), type: 'ANNIVERSARY', game: g, networks: ev.networks, link: ev.link, store: true });
  }

  if (ev.type === 'PRODUCT') {
    const lines = productLines(facts);
    let h = 0;
    for (const ch of String(ev.day || ev.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const line = lines[Number.isInteger(productIndex) && productIndex >= 0 && productIndex < lines.length ? productIndex : h % lines.length];
    const url = line.store ? getUrl('NET', line.campaign) : tagged(String(line.url || SITE).replace(SITE, ''), 'NET', line.campaign);
    return compose({ lead: line.text, second: '', close: '', url, campaign: line.campaign, type: 'PRODUCT', game: null, networks: ev.networks, link: true, store: line.store });
  }

  if (ev.type === 'WEEKAHEAD') {
    const w = ev.week;
    const lead = `${w.count} games across ${w.leagues} leagues on The Slate this week, ${w.range}.`;
    const second = w.highlights && w.highlights.length ? `${w.highlights.join('. ')}.` : '';
    return compose({ lead, second, close: 'The week, on one page.', url: tagged(`slate/${w.slug}`, 'NET', camp('weekahead')), campaign: camp('weekahead'), type: 'WEEKAHEAD', game: null, networks: ev.networks, link: true });
  }

  if (ev.type === 'WEEKNUMBERS') {
    const c = ev.community;
    const lead = `${c.logs} games logged on Scorebug this week across ${c.leagues} leagues.`;
    const second = c.top ? `Highest community grade: ${c.top.scoreline}, ${c.top.grade} from ${c.top.logs} logs.` : '';
    return compose({ lead, second, close: 'Yours are in the Vault.', url: getUrl('NET', camp('weeknumbers')), campaign: camp('weeknumbers'), type: 'WEEKNUMBERS', game: null, networks: ev.networks, link: ev.link, store: true });
  }

  throw new Error(`no template for ${ev.type}`);
}

/**
 * Fit lead + second + close + link into each network's limit, dropping from
 * the end. Only the networks the event carries get a text.
 */
export function compose({ lead, second = '', close = '', url, campaign, type, game = null, networks = ['bluesky', 'mastodon', 'threads', 'x'], link = false, store = false, extraTags = [] }) {
  const out = {};
  const dest = (network) => String(url).replace('s=NET', `s=${network}`);
  const build = (network, limit, withLink) => {
    const l = withLink ? dest(network) : '';
    const tags = tagLine(tagsFor(network, type, game, extraTags));
    const parts = [lead, second, close].filter(Boolean);
    while (parts.length) {
      const body = parts.join('\n\n');
      const core = l ? `${body}\n\n${l}` : body;
      if (graphemes(core) <= limit) {
        const withTags = tags ? `${core}\n\n${tags}` : core;
        return graphemes(withTags) <= limit ? withTags : core;
      }
      parts.pop();
    }
    return l ? `${lead.slice(0, Math.max(0, limit - l.length - 3))}…\n\n${l}` : lead.slice(0, limit);
  };
  for (const n of networks) {
    if (n === 'x') out.x = build('x', LIMITS.x, false);
    else if (n === 'instagram') out.instagram = build('instagram', LIMITS.instagram, false);
    else if (LIMITS[n]) out[n] = build(n, LIMITS[n], true);
  }
  if (networks.includes('x') && link) {
    out.xReply = store
      ? `Scorebug is free. ${dest('x')}`
      : type === 'FINAL' || type === 'MORNING' ? `Log it and grade it: ${dest('x')}` : `${dest('x')}`;
  }
  return out;
}

export function graphemes(s) {
  try {
    return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).length;
  } catch {
    return s.length;
  }
}

/* ────────────────────────────────────────────────────────────── LINTER */

const ACRONYMS = new Set(['OT', 'SO', 'ET', 'AET', 'FT', 'MT', 'PT', 'CT', 'UTC', 'NHL', 'NFL', 'NBA', 'MLB', 'CFL', 'MLS', 'EPL', 'UCL', 'IPL', 'ISL', 'CSL', 'NCAA', 'NCAAF', 'NCAAB', 'CFB', 'USA', 'UK', 'CA', 'TV', 'ESPN', 'TSN', 'CBS', 'NBC', 'FOX', 'ABC', 'TNT', 'PSG', 'LAFC', 'MNF', 'TNF', 'SNF', 'BC', 'BVB', 'FC', 'SC', 'AC', 'CF', 'UEFA']);
const BANNED = /\b(epic|huge|insane|crazy|amazing|awesome|mind[- ]blowing|game[- ]changer|unbelievable|must[- ]watch|goat|legendary|clutch|instant classic)\b/i;
/**
 * ── THE BETTING BLOCKLIST ───────────────────────────────────────────────────
 *
 * "Zero gambling. Zero sports betting. Ever." is a promise the site makes in
 * its own voice, and sports automation is saturated with the vocabulary of the
 * other thing. This is a HARD reject, not a hold: a draft that mentions odds
 * is not a judgement call for the owner, it is a bug in whatever wrote it.
 *
 * The vocabulary itself now lives in safety.js, shared with the mention gate
 * and the Reddit reader, because three private copies had drifted into three
 * different sets of holes — the worst of them being that every one of them
 * missed the plural. See that file for how matching works and why.
 */
export { bettingHit };
/** Kept as a predicate for the tests and for anything that only wants a yes/no. */
export const BETTING = { test: (t) => bettingHit(t) != null };

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * The allow-list is the whole point of the link check: a post may point at the
 * site (which forwards to the app, the waitlist or the store as the site sees
 * fit) and nowhere else. Never an affiliate, never a network, never Play
 * directly — /get decides that.
 */
export const ALLOWED_LINKS = Object.freeze([SITE, WEB_APP]);

/**
 * Compared as ORIGINS, never as string prefixes.
 *
 * `m.startsWith('https://getscorebug.app')` was the old test, and it is true of
 * `https://getscorebug.app.evil.example/parlay` — an attacker who registers any
 * `getscorebug.app<anything>.tld` had a permanently allow-listed destination on
 * every surface, including the auto-reply path. Parsing the URL and comparing
 * `host` exactly is the only form of this check that means what it says.
 */
function hostsOf(allowLinks) {
  const out = new Set();
  for (const a of allowLinks) { try { out.add(new URL(a).host.toLowerCase()); } catch { /* not a URL */ } }
  return out;
}
function linkAllowed(raw, hosts) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return hosts.has(u.host.toLowerCase());
}

/**
 * A domain written without a scheme. Bluesky and Mastodon both autolink these,
 * so `bestparlaypicks.co` is a live outbound link that the `https?://` matcher
 * never saw. The TLD list is the ones a spammer actually buys plus the common
 * country codes; a bare `5.0` cannot match because a TLD is letters.
 */
const BARE_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|app|dev|xyz|info|biz|club|site|online|live|bet|casino|vip|top|win|link|gg|tv|me|ly|to|cc|ru|cn|in|uk|ca|de|fr|es|it|nl|au|nz|jp|kr|br|mx|ar|za|ie|pl|se|no|fi|dk|ch|at|be|pt|gr|cz|hu|ro|tr|il|ae|sa|sg|hk|tw|th|vn|ph|id|my)\b/gi;

/**
 * Every number in a draft must be traceable to the record. The old test was
 * `sources.includes(n)` — a SUBSTRING test against a blob that is mostly
 * `JSON.stringify(game)`, i.e. mostly millisecond timestamps. "Oilers 74,
 * Flames 62" passed, because "74" and "62" both appear inside 1757462400000.
 * Tokenising both sides and comparing membership is the same check, done
 * correctly: a timestamp is one token, and it contains no others.
 */
function numberTokens(s) {
  const out = new Set();
  for (const t of String(s == null ? '' : s).match(/\d[\d.,:/-]*/g) || []) {
    const c = t.replace(/[.,:/-]+$/, '');
    if (!c) continue;
    out.add(c);
    for (const part of c.split(/[.,:/-]+/)) if (part) out.add(part);
  }
  return out;
}

/**
 * ── THE REPLY PATHS HAVE NO `people` LIST ───────────────────────────────────
 *
 * When the engine drafts a post about a game it knows exactly which athletes
 * the record names, and the linter checks for those. A reply to a mention or a
 * Play review has no such list — the model can name anyone alive, and both
 * auto-reply paths were calling `lint()` with `people` empty, so "Mahomes had
 * a rough night" and "I have written down the request for McDavid shift
 * charts" both linted perfectly clean and, with autoReply on, posted
 * themselves. The owner's rule is that anything involving a real person waits
 * for him, and a blocklist cannot enforce that against an open set.
 *
 * So the reply paths invert it: nothing may name anything the engine does not
 * already know. A capitalised word that is not sentence-initial and not in the
 * vocabulary below is an unknown proper noun, and the reply is held. Replies
 * are short and mechanical and about the product, so the vocabulary is small
 * and the cost of a hold is one unanswered mention that the owner still sees.
 */
const SAFE_CAPS = new Set([
  ...[...ACRONYMS].map((a) => a.toLowerCase()),
  ...LEAGUES_VOCAB(),
  // the product, in its own words
  'scorebug', 'log', 'slate', 'vault', 'bleachers', 'front', 'office', 'wire', 'almanac',
  'docket', 'player', 'card', 'analytics', 'desk', 'linemates', 'chronicle', 'the',
  // platforms and places we may legitimately name
  'android', 'ios', 'google', 'play', 'app', 'store', 'web', 'apple',
  'canada', 'canadian', 'cadenic', 'studios', 'edmonton',
  // calendar
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  /* Ordinary English words that turn up capitalised in a reply — almost always
     because they start a sentence. There is NO positional exemption: "Mahomes
     had a rough night" is one sentence beginning with a surname, so exempting
     the first word of a sentence exempts exactly the shape being hunted. A
     capitalised word is either in this vocabulary or it is unknown. */
  'i', 'it', 'we', 'you', 'your', 'yours', 'our', 'ours', 'they', 'them', 'their',
  'that', 'this', 'these', 'those', 'there', 'here', 'thanks', 'thank', 'cheers',
  'yes', 'no', 'not', 'never', 'always', 'and', 'but', 'if', 'so', 'or', 'a', 'an',
  'for', 'from', 'with', 'without', 'about', 'after', 'before', 'once', 'only',
  'just', 'still', 'also', 'when', 'where', 'what', 'who', 'whom', 'how', 'why',
  'every', 'each', 'all', 'both', 'some', 'any', 'most', 'more', 'less', 'none',
  'nothing', 'something', 'anything', 'everything', 'one', 'two', 'three', 'first',
  'last', 'next', 'now', 'today', 'tonight', 'tomorrow', 'yesterday', 'soon',
  'fair', 'good', 'great', 'nice', 'sure', 'right', 'agreed', 'noted', 'understood',
  'sorry', 'happy', 'glad', 'welcome', 'hello', 'hi', 'hey', 'absolutely',
  'definitely', 'certainly', 'unfortunately', 'currently', 'coming', 'done',
  'grade', 'graded', 'log', 'logged', 'logging', 'keep', 'kept', 'add', 'added',
  'open', 'try', 'use', 'check', 'send', 'tell', 'let', 'give', 'take', 'make',
  'made', 'get', 'got', 'put', 'see', 'seen', 'look', 'looks', 'sounds', 'makes',
  'fix', 'fixed', 'fixing', 'work', 'working', 'works', 'appreciate', 'live',
  'will', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'have',
  'has', 'had', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did',
  'free', 'new', 'good', 'best', 'real', 'same', 'own', 'sports', 'sport', 'game',
  'games', 'score', 'scores', 'team', 'teams', 'season', 'seasons', 'fans', 'fan',
]);
function LEAGUES_VOCAB() {
  const out = [];
  for (const l of Object.values(LEAGUE_BY_ID)) {
    for (const bit of [l.id, l.name, l.label, l.full]) {
      for (const w of String(bit || '').split(/[^A-Za-z]+/)) if (w) out.push(w.toLowerCase());
    }
  }
  return out;
}

/** Capitalised words the vocabulary above does not account for. */
export function unknownProperNouns(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/[A-Za-z][A-Za-z'\u2019-]*/g)) {
    const w = m[0];
    if (!/^[A-Z]/.test(w) || w.length < 3) continue;
    if (SAFE_CAPS.has(w.toLowerCase().replace(/['\u2019]s$/, ''))) continue;
    out.add(w);
  }
  return Array.from(out);
}

/**
 * Lint a post against the house rules. `sources` is the text every number must
 * appear in; `people` are the names the record mentions. Returns [] when clean.
 *
 * ── WHAT RUNS ON WHAT, AND WHY IT MATTERS ───────────────────────────────────
 *
 * There are two surfaces here and picking the wrong one is how the old linter
 * leaked. `body` has the links, the hashtags and the hand-checked product
 * lines removed, because a URL is full of stray digits and the promise line
 * legitimately contains the word "betting" — so the NUMBER, SHOUTING and HYPE
 * checks run there. But betting language and a real person's name are exactly
 * the things an attacker hides IN a link or a hashtag: `#Parlay` and
 * `/r/connor-mcdavid` both linted clean before this change. So those two
 * checks run on the whole post, with only the verified lines removed, and they
 * run through safety.js's `words()`, which sees into a slug.
 *
 * `safeWords` is the game's own team vocabulary, handed to the name check so
 * that "Austin FC" is not read as the first name of a basketball player.
 * `strictNames` lowers the name-length floor for the paths that echo a
 * stranger's text, where a false positive costs one unsent reply.
 */
export function lint(text, { sources = '', allowLinks = ALLOWED_LINKS, network = 'bluesky', people = [], facts = FALLBACK_FACTS, safeWords = '', strictNames = false, knownVocabularyOnly = false } = {}) {
  const problems = [];
  if (/!/.test(text)) problems.push('exclamation mark');
  if (EMOJI.test(text)) problems.push('emoji');
  const hashCount = (text.match(/(^|\s)#[A-Za-z]\w*/g) || []).length;
  const allowed = TAG_BUDGET[network] ?? 0;
  if (hashCount > allowed) problems.push(`too many hashtags for ${network} (${hashCount} > ${allowed})`);

  const hosts = hostsOf(allowLinks);
  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  for (const m of urls) if (!linkAllowed(m, hosts)) problems.push(`foreign link ${m}`);
  for (const m of fold(text.replace(/https?:\/\/[^\s)]+/g, ' ')).match(BARE_DOMAIN) || []) {
    if (!hosts.has(m.toLowerCase())) problems.push(`bare domain ${m}`);
  }

  /* The verified lines are hand-checked sentences about the product. "Zero
     sports betting" and "no odds anywhere in it" are the brand promise stated
     in its own words, so every check below runs with those lines removed. */
  const VERIFIED = productLines(facts).map((l) => l.text).concat(Object.values(INVITES).filter(Boolean));

  /* The betting probe keeps our own links as their PATH WORDS and nothing else:
     "/r/parlay-odds" stays visible to the word check, while the query string's
     ids and epoch timestamps cannot be mistaken for a price. A foreign link is
     left whole — it is already a problem, and its words should convict it too. */
  const probe = text.replace(/https?:\/\/[^\s)]+/g, (m) => {
    if (!linkAllowed(m, hosts)) return ` ${m} `;
    try { return ` ${new URL(m).pathname.replace(/[^A-Za-z]+/g, ' ')} `; } catch { return ' '; }
  });
  const bet = bettingHit(probe, VERIFIED);
  if (bet) problems.push(`betting language: ${bet}`);
  for (const person of namesIn(probe, people, safeWords, strictNames ? { minLen: 3 } : {})) {
    problems.push(`names a person: ${person}`);
  }
  if (knownVocabularyOnly) {
    for (const w of unknownProperNouns(text)) problems.push(`unknown proper noun: ${w}`);
  }

  let body = text.replace(/https?:\/\/[^\s)]+/g, '');
  for (const line of VERIFIED) body = body.split(line).join(' ');
  body = body.replace(/(^|\s)#[A-Za-z]\w*/g, ' ');
  if (BANNED.test(fold(body))) problems.push('hype word');

  const src = `${String(sources)}\n${factNumbers(facts).join('\n')}`;
  for (const w of body.match(/\b[A-Z]{3,}\b/g) || []) {
    if (ACRONYMS.has(w) || /^\d+$/.test(w) || src.includes(w)) continue;
    problems.push(`shouting: ${w}`);
  }
  const srcTokens = numberTokens(src);
  for (const n of body.match(/\d[\d,.:/-]*/g) || []) {
    const clean = n.replace(/[.,:/-]+$/, '');
    if (!srcTokens.has(clean)) problems.push(`unsourced number ${clean}`);
  }
  const limit = LIMITS[network];
  if (limit && graphemes(text) > limit) problems.push(`over ${limit}`);
  return problems;
}

/** Everything a number in a draft may be traced to. */
export function sourcesFor(ev, { now = Date.now(), tz = 'America/Edmonton' } = {}) {
  const bits = [];
  const g = ev.game;
  if (g) {
    bits.push(JSON.stringify(g));
    if (g.start != null) bits.push(clock(g.start, tz), longDate(g.start, tz), String(localParts(g.start, tz).year));
    const f = ev.features || features(g, { tz });
    if (f.margin != null) bits.push(String(f.margin));
    if (f.total != null) bits.push(String(f.total));
    if (g.period != null) bits.push(String(g.period));
  }
  for (const x of ev.games || []) { bits.push(JSON.stringify(x)); if (x.start != null) bits.push(clock(x.start, tz)); }
  if (ev.games) bits.push(String(ev.games.length), String(new Set(ev.games.map((x) => x.league)).size));
  if (ev.years != null) bits.push(String(ev.years));
  if (ev.week) bits.push(JSON.stringify(ev.week));
  if (ev.community) bits.push(JSON.stringify(ev.community));
  return bits.join('\n');
}

/** Alt text for the card, from the record only. */
export function altFor(ev) {
  const g = ev.game;
  if (ev.type === 'SLATE') return `Today's slate on Scorebug: ${(ev.pick || ev.games || []).map((x) => (x.sport === 'racing' ? x.name : `${teamName(x.away)} at ${teamName(x.home)}`)).join(', ')}.`;
  if (ev.type === 'PRODUCT') return 'A Scorebug card.';
  if (ev.type === 'WEEKAHEAD') return `The week ahead on Scorebug: ${ev.week.count} games across ${ev.week.leagues} leagues.`;
  if (ev.type === 'WEEKNUMBERS') return `This week on Scorebug: ${ev.community.logs} games logged.`;
  if (!g) return 'A Scorebug card.';
  return `${scoreline(g)}. ${endingClause(g)} ${leagueName(g)}. Grade it out of 5.0 on Scorebug.`.replace(/\s+/g, ' ').trim();
}
