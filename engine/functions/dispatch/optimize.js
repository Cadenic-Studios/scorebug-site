// Scorebug dispatch — the decision loop.
//
// The difference between a poster and a growth system is that this file
// exists. Every post the machine sends carries a record of the CHOICES that
// went into it (which hook line, whether a model wrote the second paragraph,
// how often the game is mentioned). metrics.js reads back what each post
// earned. This file turns those pairs into a policy the drafter obeys next
// time, and into a sentence the digest can print about why.
//
// THOMPSON SAMPLING, and why not something cleverer:
//   Volume here is small — tens of posts a week, not millions of impressions.
//   At that scale the honest algorithm is the one that keeps exploring while
//   it is uncertain and stops when it is not. Each arm keeps Beta(1+wins,
//   1+losses); choosing means drawing one sample per arm and taking the max.
//   A new arm starts at Beta(1,1) — a coin — so it gets tried. An arm that
//   has lost twenty times in a row stops being drawn without ever being
//   formally "disabled", which is what you want when a hook that flopped in
//   August might work in November.
//
//   A "win" is a post scoring at or above the trailing median of its own
//   network. Median, not mean: one post that goes wide would otherwise mark
//   every other arm a loser for a month.
//
// WHAT IT MAY NEVER DO:
//   Touch a safety rule. The arms are content variants inside templates that
//   have already passed the linter. There is no arm for "post a failure
//   automatically", no arm for "add a hashtag", no arm for hook frequency
//   for naming a player, no arm for a betting word. Growth pressure does not get
//   a vote on the voice.

import { INVITES } from './draft.js';
import { productLines } from './facts.js';

const PRODUCT_COUNT = productLines().length;
import { engagementScore, median } from './metrics.js';

export const POLICY = 'dispatch/state/meta/policy';
const MET = 'dispatch/state/metrics/';
const EV = 'dispatch/state/events/';
const DAY = 86_400_000;

/** The experiments the machine is allowed to run on itself. */
export const EXPERIMENTS = {
  invite: {
    label: 'which closing line earns a log',
    arms: Object.keys(INVITES).map((k) => `invite:${k}`),
    describe: (arm) => INVITES[arm.split(':')[1]] || 'no closing line, the card alone',
  },
  card: {
    label: 'whether the empty grade dial beats a plain scoreboard',
    arms: ['card:grade', 'card:score'],
    describe: (arm) => (arm === 'card:grade' ? 'the card with the empty 5.0 dial' : 'the plain scoreboard card'),
  },
  product: {
    label: 'which product line earns attention',
    arms: Array.from({ length: PRODUCT_COUNT }, (_, i) => `product:${i}`),
    describe: (arm) => (productLines()[Number(arm.split(':')[1])] || { text: arm }).text,
  },
};

/** Deterministic Beta sample via two Gammas (Marsaglia-Tsang), seedable for tests. */
export function betaSample(a, b, rand = Math.random) {
  const g = (k) => {
    if (k < 1) return g(k + 1) * Math.pow(rand() || 1e-12, 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = gauss(rand); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rand() || 1e-12;
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const x = g(a), y = g(b);
  return x / (x + y);
}
function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Attribute measured engagement back to the arms each post used.
 * @returns {object} experiment -> arm -> {wins, losses, n, total}
 */
export function tally({ posts = [], events = [] }) {
  const byId = new Map(events.map((e) => [e.id, e]));
  const perNetwork = {};
  for (const p of posts) (perNetwork[p.network] ||= []).push(engagementScore(p));
  const bar = Object.fromEntries(Object.entries(perNetwork).map(([n, xs]) => [n, median(xs) ?? 0]));

  const out = {};
  for (const p of posts) {
    const e = byId.get(p.eventId);
    if (!e || !e.variants) continue;
    const win = engagementScore(p) >= (bar[p.network] ?? 0);
    for (const [experiment, arm] of Object.entries(e.variants)) {
      if (!EXPERIMENTS[experiment] || !arm) continue;
      const slot = ((out[experiment] ||= {})[arm] ||= { wins: 0, losses: 0, n: 0, total: 0 });
      slot.n++; slot.total += engagementScore(p);
      if (win) slot.wins++; else slot.losses++;
    }
  }
  return out;
}

/** Choose one arm per experiment by Thompson sampling over the tally. */
export function choose(tallies, rand = Math.random) {
  const chosen = {};
  for (const [experiment, spec] of Object.entries(EXPERIMENTS)) {
    let best = null, bestDraw = -1;
    for (const arm of spec.arms) {
      const t = (tallies[experiment] || {})[arm] || { wins: 0, losses: 0 };
      const draw = betaSample(1 + t.wins, 1 + t.losses, rand);
      if (draw > bestDraw) { bestDraw = draw; best = arm; }
    }
    chosen[experiment] = best;
  }
  return chosen;
}

/** Plain-language findings for the digest. Only speaks when the data earns it. */
export function findings(tallies) {
  const out = [];
  for (const [experiment, spec] of Object.entries(EXPERIMENTS)) {
    const arms = Object.entries(tallies[experiment] || {}).filter(([, t]) => t.n >= 4);
    if (arms.length < 2) continue;
    const ranked = arms.map(([arm, t]) => ({ arm, rate: t.wins / t.n, mean: t.total / t.n, n: t.n })).sort((a, b) => b.mean - a.mean);
    const top = ranked[0], bottom = ranked[ranked.length - 1];
    if (top.n < 5 || bottom.n < 5) continue;
    if (top.mean <= bottom.mean * 1.25) continue; // not a difference worth a sentence
    out.push({
      experiment,
      text: `${spec.label}: "${spec.describe(top.arm)}" is averaging ${top.mean.toFixed(1)} engagement over ${top.n} posts against ${bottom.mean.toFixed(1)} for "${spec.describe(bottom.arm)}" over ${bottom.n}. Leaning toward the first.`,
    });
  }
  return out;
}

/**
 * Read the last 30 days of measurement, re-tally, choose, and store the policy
 * the drafter reads. Idempotent; safe to run daily.
 */
export async function optimizeTick({ store, now = Date.now(), rand = Math.random, windowDays = 30 }) {
  const metricDocs = (await store.list(MET)).map((d) => d.data).filter((m) => m.day && now - Date.parse(m.day) <= windowDays * DAY);
  const posts = metricDocs.flatMap((m) => (Array.isArray(m.posts) ? m.posts : []));
  // One row per (eventId, network): the newest measurement of each post wins.
  const latest = new Map();
  for (const p of posts) {
    const k = `${p.eventId}:${p.network}`;
    const prev = latest.get(k);
    if (!prev || Date.parse(p.at || 0) >= Date.parse(prev.at || 0)) latest.set(k, p);
  }
  const events = (await store.list(EV)).map((d) => d.data);
  const tallies = tally({ posts: [...latest.values()], events });
  const chosen = choose(tallies, rand);
  const policy = {
    updatedAt: new Date(now).toISOString(),
    chosen,
    tallies,
    findings: findings(tallies),
    sampleSize: latest.size,
  };
  await store.set(POLICY, policy);
  return policy;
}

/** What the drafter needs from the policy, with safe defaults before any data exists. */
export function policyFor(policy) {
  const chosen = (policy && policy.chosen) || {};
  const invite = String(chosen.invite || 'invite:statement').split(':')[1];
  const card = String(chosen.card || 'card:grade').split(':')[1];
  const productIndex = Number(String(chosen.product || 'product:0').split(':')[1]) || 0;
  return {
    invite: INVITES[invite] != null ? invite : 'statement',
    card: card === 'score' ? 'score' : 'grade',
    productIndex: Math.max(0, Math.min(PRODUCT_COUNT - 1, productIndex)),
    productId: (productLines()[Math.max(0, Math.min(PRODUCT_COUNT - 1, productIndex))] || {}).id || null,
    variants: { invite: `invite:${INVITES[invite] != null ? invite : 'statement'}`, card: `card:${card === 'score' ? 'score' : 'grade'}`, product: `product:${Math.max(0, Math.min(PRODUCT_COUNT - 1, productIndex))}` },
  };
}
