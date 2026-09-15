// Scorebug dispatch — the safety vocabulary, in exactly one place.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// Three modules used to carry three different, and three differently wrong,
// copies of the same blocklist: draft.js hard-rejected a draft, engage.js
// refused to machine-answer a mention, channels.js skipped a Reddit thread.
// An audit found that all three missed the PLURAL of nearly every word they
// blocked, because each alternative ended `)\b` and the trailing "s" ate the
// boundary. "We never take wagers on spreads or moneylines" linted clean
// through the filter whose entire job is "Zero gambling. Zero sports betting.
// Ever." Two of the three also missed the price shape the moment it was
// wrapped in brackets, and every one of them was blind to a Cyrillic "а".
//
// So the vocabulary lives here, once, and the three callers import it. When a
// sportsbook launches, one line changes and all three surfaces learn it.
//
// ── HOW MATCHING WORKS ──────────────────────────────────────────────────────
//
// Never match against raw text. Always `fold()` first, which:
//   • strips accents, so "Mbappé" and "Mbappe" are the same name;
//   • maps the Cyrillic and Greek look-alikes onto their Latin twins, so
//     "раrlay" (with Cyrillic р and а) is "parlay";
//   • deletes zero-width and bidi control characters, so "p‍a‍r‍l‍a‍y" is
//     "parlay" and U+202E cannot reverse a rendered line;
//   • normalises every dash, including U+2212 MINUS, to ASCII "-", so "−110"
//     is "-110".
//
// Then match WORDS against `words()`, which additionally turns every run of
// non-alphanumerics into a single space. That is what makes a term visible
// inside a URL slug ("/r/parlay-odds-moneyline") or a hashtag ("#Parlay"),
// both of which the old linter stripped out before it ever looked for betting
// language. Match PRICE SHAPES against the folded text, where the punctuation
// still exists to be matched.

/* ─────────────────────────────────────────────────────────── FOLDING */

/** Cyrillic and Greek characters that render as Latin letters. */
const CONFUSABLE = {
  а: 'a', в: 'b', с: 'c', ԁ: 'd', е: 'e', ѕ: 's', і: 'i', ј: 'j', к: 'k', м: 'm',
  н: 'h', о: 'o', р: 'p', т: 't', у: 'y', х: 'x', ѵ: 'v', ԛ: 'q', ԝ: 'w',
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  Α: 'A', Β: 'B', Ε: 'E', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Χ: 'X',
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join('')}]`, 'g');

/** Zero-width, bidi controls, soft hyphen, and the other invisibles. */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
/** Every dash-like character, including the true MINUS SIGN. */
const DASHES = /[\u2010-\u2015\u2043\u2212\ufe58\ufe63\uff0d]/g;

/**
 * Canonical form for matching. Never store this — it is lossy on purpose.
 * Display always uses the original string.
 */
export function fold(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(INVISIBLE, '')
    .replace(CONFUSABLE_RE, (c) => CONFUSABLE[c] || c)
    .replace(DASHES, '-')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

/**
 * The same clean-up minus the Latin-isation. `fold()` maps a Cyrillic "а" onto
 * a Latin "a" so that "раrlay" is caught — which also shreds a term that is
 * genuinely Cyrillic, turning "ставки" into "ст a вки". Non-Latin scripts are
 * therefore matched on this instead: invisibles gone, composed, nothing else.
 */
export function foldScripts(s) {
  return String(s == null ? '' : s).normalize('NFC').replace(INVISIBLE, '');
}

/**
 * Folded, with every run of non-alphanumerics collapsed to one space, padded
 * at both ends so `\b`-anchored patterns behave at the edges. This is the
 * surface a word must be hunted on: it sees through slugs, hashtags,
 * camelCase-free joins, and "p a r l a y"-style spacing is NOT collapsed
 * (that would create false positives on ordinary prose).
 */
export function words(s) {
  return ` ${fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

/* ──────────────────────────────────────────────────────── THE BETTING WALL */

/**
 * The vocabulary, as source strings so the plural rule is applied uniformly
 * and visibly. `s?` on anything a person would pluralise; the trailing `\b`
 * is added once, at the end, by the assembled pattern.
 *
 * Two deliberate omissions, both because the false positive is worse than the
 * miss on a sports account: bare "total" (total yards) and bare "picks"
 * (draft picks). "picks" is caught in its betting collocations below, and the
 * mention gate — where refusing costs nothing — blocks it outright.
 */
const BETTING_TERMS = [
  // the core market vocabulary
  'odds', 'money ?lines?', 'parlays?', 'teasers?', 'pleasers?', 'round robins?',
  'took the (over|under)', 'bet the (over|under)', 'puck lines?', 'run lines?', 'goal lines?',
  'point spreads?', 'against the spread', 'ats',
  'asian handicaps?', 'handicaps?',
  // "spread" on its own, minus the football formation and the ordinary verb
  'spreads?(?! ?(offen[cs]e|formation|attack|the (field|ball|game)|out|across|through))',
  'cover(s|ed|ing)? the spread', 'beat the spread', 'favou?rites? to cover',
  'underdogs?', 'chalk', 'juice', 'vig', 'vigorish',
  'closing lines?', 'closing line value', 'clv', 'steam moves?', 'reverse line movement',
  'sharp money', 'sharps', 'bankrolls?', 'tail(s|ed|ing)? the play',
  'lay(ing)? the points', 'tak(e|ing) the points',
  'cash ?outs?', 'live bett?ing', 'in ?play bett?ing', 'futures bets?',
  'same game parlays?', 'sgp', 'accumulators?', 'accas?', 'bet ?slips?',
  // the act itself
  'bets?', 'bett?ing', 'bett?ors?', 'wagers?', 'wagered', 'wagering',
  'gambl(e|es|ed|ing|ers?)', 'casinos?', 'bookmakers?', 'book ?ies?', 'sportsbooks?',
  'prop bets?', 'player props?', 'props?(?! to\\b)',
  'bonus bets?', 'free bets?', 'risk ?free bets?', 'no sweat bets?',
  'locks? of the (day|week)', 'picks? of the (day|week)',
  '(free|expert|best|top|daily|winning|bett?ing|todays?|tonights?|your|my|our) picks?',
  'touts?', 'daily fantasy', 'dfs',
  // sportsbooks and DFS operators, by name
  'draft ?kings', 'fan ?duel', 'bet ?365', 'bet ?mgm', 'caesars', 'points ?bet',
  'bet ?rivers', 'bally ?bet', 'espn ?bet', 'hard rock bet', 'fanatics sportsbook',
  'bet ?way', 'uni ?bet', 'bwin', 'ladbrokes', 'william hill', 'paddy power',
  'bet ?fair', 'bet ?fred', 'sky ?bet', 'tipico', 'bovada', 'my ?bookie',
  'bet ?online', 'prize ?picks', 'underdog fantasy', 'the ?score bet',
  'pinnacle sports', 'circa sports', 'super ?book', '888 ?sport', 'stake ?com',
  'roobet', 'novibet', 'thunder ?pick',
  // the same promise, in the other languages the product ships in
  'apuestas?', 'casas? de apuestas', 'cuotas?', 'apostas?',
  'scommess(a|e)', 'quote scommesse', 'wetten', 'wettquoten?', 'buchmacher',
  'paris sportifs', 'kansspel', 'weddenschap(pen)?',
];

/**
 * CJK, Hangul and Cyrillic get their own pattern with NO `\b`. JavaScript's word
 * boundary is defined on ASCII [A-Za-z0-9_], so `\b赔率\b` can never match —
 * the character either side of a Han glyph is always a "non-word" character,
 * so there is no boundary to find. These scripts do not space their words
 * anyway, so a plain substring test is both correct and what a reader means.
 */
/** Forms that only mean what they mean WITH their punctuation, so they run on fold(). */
const BETTING_PUNCT = /over ?\/ ?under|(?<![a-z])o ?\/ ?u(?![a-z])/i;

const BETTING_SCRIPTS = /赔率|博彩|投注|下注|베팅|도박|賭け|賭博|オッズ|ставк[аи]|букмекер|коэффициент/;

export const BETTING_WORDS = new RegExp(`\\b(?:${BETTING_TERMS.join('|')})\\b`, 'iu');

/**
 * The price shapes, matched on folded text where the punctuation survives.
 *   -110  +150  (-110)  [-110]  :-110   → American odds (a trailing full stop is
 *                                          fine: "They were +150." must match)
 *   -7.5  +3.5  -7.0                    → a spread
 *   o47.5 u220.5                        → a total
 *   +EV                                 → the tell of a tipster
 * The lookarounds are what let a bracketed or colon-prefixed price match while
 * a season label ("2026-27") and a scoreline ("Titans 16, Lions 15") do not.
 */
export const BETTING_PRICE = /(?<![\w.])[+-]\d{3}(?!\d)|(?<![\w.])[+-]\d{1,2}\.[05](?!\d)|(?<![a-z\d])[ou] ?\d{1,3}\.5(?!\d)|\+ ?ev\b/i;

/**
 * The one call the rest of the engine makes. Returns the offending fragment
 * (for the ledger and the digest, so a human can see WHAT tripped it) or null.
 *
 * `exempt` are strings to remove before looking — the hand-checked product
 * lines, which say "Zero sports betting" and "no odds anywhere in it" in the
 * brand's own voice and must not convict themselves.
 */
export function bettingHit(text, exempt = []) {
  let t = String(text == null ? '' : text);
  for (const line of exempt) if (line) t = t.split(line).join(' ');
  const w = BETTING_WORDS.exec(words(t));
  if (w) return w[0].trim();
  // foldScripts, not fold: NFKD would decompose Hangul into its jamo and the
  // confusable map would Latin-ise Cyrillic, so neither could meet its pattern.
  const punct = BETTING_PUNCT.exec(fold(t));
  if (punct) return punct[0].trim();
  const script = BETTING_SCRIPTS.exec(foldScripts(t));
  if (script) return script[0];
  const p = BETTING_PRICE.exec(fold(t));
  return p ? p[0].trim() : null;
}

/* ───────────────────────────────────────────────── THE MENTION / THREAD GATE */

/**
 * Broader than the drafting wall, and deliberately so. This decides whether a
 * stranger's message is machine-answerable at all; a false positive costs one
 * unanswered mention that a human still sees in the digest, while a false
 * negative is the brand account discussing a parlay. Everything the drafting
 * wall blocks, plus bare "pick(s)", plus hostility and legal trouble.
 */
const HOSTILE_TERMS = [
  'scams?', 'fakes?', 'stolen', 'steal(s|ing)?', 'lawsuits?', 'sue(s|d|ing)?', 'frauds?',
  'bots?', 'spam(s|ming)?', 'scammers?', 'ripp?ed off', 'refunds?', 'chargebacks?',
  'picks?', 'lines? tonight', 'whats? the line', 'who do you (like|have)',
  'lock', 'locks', 'best bets?', 'sure thing',
  'idiots?', 'stupid', 'trash', 'garbage', 'sucks?', 'shill(s|ing)?',
];
const HOSTILE_EXTRA = new RegExp(`\\b(?:${HOSTILE_TERMS.join('|')})\\b`, 'iu');

/** True when a mention, comment or thread must never be answered by machine. */
export function isHostile(text) {
  if (bettingHit(text)) return true;
  return HOSTILE_EXTRA.test(words(text));
}

/* ─────────────────────────────────────────────────────────── REAL PEOPLE */

/**
 * The forms of a person's name a post could plausibly contain. Folded, so an
 * accent cannot smuggle one past: the record says "Kylian Mbappé", the draft
 * says "Mbappe", and the two must collide.
 *
 * `safe` is the game's own team and venue vocabulary. It exists because first
 * names collide with club names — Austin FC, Orlando City, a player called
 * Brooklyn — and holding a legitimate post every night is its own kind of
 * failure. A form that is part of a team name in THIS record is dropped.
 */
export function nameForms(person, safe = '', { minLen = 4 } = {}) {
  const folded = fold(person).trim();
  const parts = folded.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const safeWords = words(safe).toLowerCase();
  const out = new Set();
  const add = (f) => {
    const v = String(f || '').trim();
    if (v.length >= minLen) out.add(v);
  };
  /* The club exemption applies to FIRST names only. A first name that is also
     a club — Austin FC, Orlando City — would otherwise hold a good post every
     night. A surname is the high-signal form and is never exempted: if a club
     genuinely shares it, holding the post for a human is the safe direction. */
  const addUnlessClub = (f) => {
    const v = String(f || '').trim();
    if (v.length < minLen) return;
    if (safeWords.includes(` ${fold(v).toLowerCase()} `)) return;
    out.add(v);
  };
  if (parts.length >= 2) out.add(parts.join(' '));               // the full name always, whatever its length
  add(parts[parts.length - 1]);                                   // surname
  if (parts.length >= 2) addUnlessClub(parts[0]);                 // first name
  for (const p of parts) if (p.includes('-')) for (const bit of p.split('-')) add(bit);
  return Array.from(out);
}

/** The names in `people` that appear in `text`. Matched on `words()`, so a hashtag or a URL slug counts. */
export function namesIn(text, people = [], safe = '', opts = {}) {
  const hay = words(text).toLowerCase();
  const hits = [];
  for (const person of people) {
    for (const form of nameForms(person, safe, opts)) {
      const needle = ` ${fold(form).toLowerCase()} `;
      if (hay.includes(needle)) { hits.push(person); break; }
    }
  }
  return hits;
}
