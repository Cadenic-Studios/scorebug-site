// Scorebug dispatch — the product facts, and who is allowed to state them.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// The engine never hard-codes a claim about the product. Not the price, not the
// platforms, not the store link. Every one of those has already been wrong once
// on the marketing site — a Play button that pointed at a listing that did not
// exist, two pages that disagreed about the price, a schema claim of "Android"
// while the test was closed — and the site fixed each by declaring ONE source
// of truth in `app/config.ts` (`LAUNCH_STAGE`, `appPlatforms()`, `PRICING`).
//
// So the engine asks the site. `/api/dispatch/facts` serialises exactly those
// exports, signed with DISPATCH_KEY, and this module caches the answer for a
// tick. If the site is unreachable the fallback below is deliberately the MOST
// CONSERVATIVE claim — web only, waitlist for Android — because an engine that
// cannot verify a claim must make the smaller one.
//
// ── THE VERIFIED LINES ──────────────────────────────────────────────────────
//
// Every sentence in PRODUCT_LINES is true of the shipped product and contains
// no number that is not in FACT_NUMBERS. The linter strips these lines before
// checking a post, the same way Delta-V's GAME_LINES were exempted, so a "5.0"
// inside a hand-checked sentence is never flagged as unsourced. Add to the
// list; never generate one at run time.

export const SITE = 'https://getscorebug.app';
export const WEB_APP = 'https://app.getscorebug.app';

export const FALLBACK_FACTS = Object.freeze({
  stage: 'testing',
  platforms: 'Web',
  androidCta: { href: `${SITE}/#waitlist`, label: 'Join the test' },
  pricing: { monthly: '$3.99', yearly: '$19.99', perMonthEquivalent: '$1.67', annualSavingsPct: 58 },
  leagueCount: 19,
  firstSeason: 2002,
  gradeScale: '5.0',
  rivalries: {},
  vanity: [],
  fetchedAt: null,
  fallback: true,
});

/** Ask the site. Returns the facts, or the fallback with `fallback: true`. */
export async function fetchFacts({ base = SITE, key, fetchImpl = fetch, timeoutMs = 8_000, log = () => {} } = {}) {
  if (!key) return { ...FALLBACK_FACTS };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}/api/dispatch/facts`, { headers: { 'x-dispatch-key': key, accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`facts ${res.status}`);
    const body = await res.json();
    if (!body || !body.stage) throw new Error('facts: malformed');
    return { ...FALLBACK_FACTS, ...body, fetchedAt: new Date().toISOString(), fallback: false };
  } catch (e) {
    log('facts unavailable, using the conservative fallback', String(e.message));
    return { ...FALLBACK_FACTS };
  } finally {
    clearTimeout(t);
  }
}

/** The platform sentence, derived — never typed — from the stage. */
export function platformLine(facts) {
  return facts.stage === 'live'
    ? 'Free on the web and on Google Play.'
    : 'Free on the web. Android early access is open.';
}

/**
 * Sentences about the product that are true of the shipped build. Each has a
 * campaign tag so attribution can tell them apart, and a `store` flag that
 * sends the click through /get (which itself reads LAUNCH_STAGE).
 */
export function productLines(facts = FALLBACK_FACTS) {
  const n = facts.leagueCount || 19;
  const first = facts.firstSeason || 2002;
  return Object.freeze([
    { id: 'vault', campaign: 'vault', store: true, text: `Every game you watch, graded out of 5.0 and kept for good. That is The Vault. ${platformLine(facts)}` },
    { id: 'leagues', campaign: 'leagues', store: false, url: `${SITE}/leagues`, text: `Scorebug covers ${n} leagues, from the NHL to the J.League, with live scores and no odds anywhere in it.` },
    { id: 'archive', campaign: 'archive', store: true, text: `You can back-log a game from as far back as the ${first} season. The one you drove six hours for counts.` },
    { id: 'slate', campaign: 'slate', store: true, text: `The Slate is every game today across ${n} leagues. Log the ones you watch, grade them out of 5.0, keep them.` },
    { id: 'promise', campaign: 'promise', store: false, url: SITE, text: 'Zero gambling ads. Zero sports betting. There is none in Scorebug, and there never will be.' },
    { id: 'bleachers', campaign: 'bleachers', store: true, text: 'The Bleachers are where fans say what a game meant. Grade it out of 5.0, write it down, keep it.' },
    { id: 'frontoffice', campaign: 'front-office', store: false, url: `${SITE}/pricing`, text: 'The Front Office turns your Vault into a season in numbers and removes every ad. Optional, and the price is on the pricing page.' },
  ]);
}

/** Every number a verified line may contain, so the linter can trace it. */
export function factNumbers(facts = FALLBACK_FACTS) {
  return [String(facts.gradeScale || '5.0'), String(facts.leagueCount || 19), String(facts.firstSeason || 2002)];
}
