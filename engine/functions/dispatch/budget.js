// Scorebug dispatch — the money controller.
//
// A marketing budget with no controller is a wish. This file holds the plan,
// the ledger of what has actually been spent, and — the part that matters —
// the GATES: the conditions that must be true before each line may be spent
// against. The machine cannot spend money (no automated system should hold a
// card), but it can refuse to recommend a spend, and it can say precisely
// what is still missing. That is the difference between a budget and a hope.
//
// ── WHY THE PLAN LOOKS LIKE THIS ────────────────────────────────────────────
//
//   CA$1,000 for the initial rollout. Android is in closed testing, so there
//   is no install campaign to run — a Play ad that lands on a closed test is
//   the exact dead-end LAUNCH_STAGE exists to prevent. The web app is live,
//   and the product's calendar has one obvious moment: NHL opening night in
//   early October, in Canada, where the first market is. So the money buys:
//     - one concentrated Meta campaign to the web app across opening week,
//       with the card as the creative and a measured signup as the goal;
//     - other people's audiences: three small sports creators or podcasters
//       in Canada, paid a flat fee to log a week of games in public;
//     - the X API line, which is the only network that bills;
//     - a reserve, held until there is a measured cost per new fan to spend
//       it against — most likely the NBA tip-off or the World Series, or an
//       App Store launch push if iOS lands.
//   Every line has a gate, and the gates are what make it a controller.

export const LEDGER = 'dispatch/state/meta/budget';

/** CA$1,000, September 2026. Amounts in CAD. */
export const PLAN = Object.freeze({
  currency: 'CAD',
  month: '2026-10',
  window: '2026-09-15 to 2026-11-30',
  total: 1000,
  lines: [
    {
      id: 'opening',
      label: 'NHL opening week on Meta',
      cap: 350,
      perSpend: [50, 100],
      earliest: '2026-10-05',
      gate: 'The engine has posted organically for at least seven days, GA4 records a web signup as a key event, and the card press renders. Then CA$50–100 a day for four days, Canada, 21–44, hockey interest, sending to app.getscorebug.app with a card that says "grade opening night out of 5.0". Stop the moment the measured cost per new fan passes CA$4.',
      needs: ['seven days of organic posts', 'GA4 signup key event', 'Meta ad account with a card as the creative'],
    },
    {
      id: 'creators',
      label: 'Creator seeding',
      cap: 300,
      perSpend: [75, 100],
      earliest: '2026-09-22',
      gate: 'Three sports creators or podcasters in Canada, 5k–50k followers, paid a flat fee to log a week of games on Scorebug in public and post their own card once, disclosed as paid, no script and no approval step. Never pay for a positive opinion; pay for the week of logs.',
      needs: ['public fan pages rendering', 'the card press live', 'creators chosen by the owner'],
    },
    {
      id: 'x-api',
      label: 'X API credits',
      cap: 50,
      perSpend: [15, 25],
      earliest: '2026-09-10',
      gate: 'Pay-per-use, US$0.015 a post and US$0.20 for a linked one. Finals carry a card and no link; one link reply a day. The meter in xspend.js keeps this under US$10 a month, which is CA$50 for the season.',
      needs: ['X developer account on pay-per-use with a US$15 spending limit'],
    },
    {
      id: 'reserve',
      label: 'Reserve',
      cap: 300,
      perSpend: [0, 300],
      earliest: '2026-10-19',
      gate: 'Untouched until there are two weeks of measured cost per new fan, then spent on whichever of the two lines above produced the lower figure — timed to NBA tip-off or the World Series — or held for an App Store launch push if iOS lands first.',
      needs: ['two weeks of measured cost per new fan'],
    },
  ],
  // Things that are NOT marketing spend and must not come out of this envelope.
  excluded: ['Apple Developer Program (US$99, an engineering cost)', 'Anthropic API (under US$5/mo, infrastructure)', 'Resend (free tier)', 'a scheduling tool (the engine is the scheduling tool)', 'affiliate network fees (none)'],
});

export const HARD_RULES = Object.freeze([
  'No install campaign while Android is in closed testing: an ad that lands on a listing that admits nobody is the dead-end LAUNCH_STAGE exists to prevent.',
  'No broad campaign at this budget: below the platform noise floor it buys nothing measurable. One market, one week, one creative.',
  'Never a gambling-adjacent placement, partner, creator or audience. Not weighed; refused.',
  'No spend on a surface that cannot be attributed — every destination carries a utm_source.',
  'Paid and seeded content is disclosed, above the link, never in a tooltip.',
  'The machine never holds a payment method and never spends. It recommends; the owner clicks.',
]);

export async function loadBudget(store) {
  const doc = (await store.get(LEDGER)) || {};
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  return { plan: PLAN, entries, ...doc };
}

export function spendByLine(entries) {
  const out = {};
  for (const e of entries) out[e.line] = (out[e.line] || 0) + (Number(e.amount) || 0);
  return out;
}

export async function recordSpend({ store, line, amount, note, at = new Date().toISOString() }) {
  const doc = await loadBudget(store);
  const entries = [...doc.entries, { line, amount: Number(amount) || 0, note: note || null, at }];
  await store.set(LEDGER, { entries, updatedAt: at });
  return { entries, spent: spendByLine(entries) };
}

/**
 * What the digest prints: per line, how much is left, whether the gate is
 * open, and — when it is not — the shortest true sentence about why.
 * @param {object} args { entries, now, metrics, organic: { days } }
 */
export function status({ entries = [], now = Date.now(), metrics = null, organic = null }) {
  const spent = spendByLine(entries);
  const today = new Date(now).toISOString().slice(0, 10);
  const lines = PLAN.lines.map((l) => {
    const used = spent[l.id] || 0;
    const remaining = Math.max(0, l.cap - used);
    const dateOk = today >= l.earliest;
    let open = dateOk && remaining > 0;
    let blocker = null;
    if (!dateOk) blocker = `not before ${l.earliest}`;
    else if (remaining <= 0) blocker = 'line is spent';
    else if (l.id === 'opening') {
      const organicDays = Number(organic && organic.days) || 0;
      if (organicDays < 7) { open = false; blocker = `${organicDays} of 7 organic days so far`; }
      else if (!(metrics && metrics.site && Number.isFinite(metrics.site.sessions))) { open = false; blocker = 'GA4 is not answering yet'; }
    } else if (l.id === 'creators') {
      const organicDays = Number(organic && organic.days) || 0;
      if (organicDays < 3) { open = false; blocker = 'the engine has not posted for three days yet'; }
    } else if (l.id === 'reserve') {
      const cpi = costPerInstall({ entries, metrics });
      if (cpi == null) { open = false; blocker = 'no measured cost per new fan yet'; }
    }
    return { ...l, used, remaining, open, blocker };
  });
  const totalUsed = lines.reduce((s, l) => s + l.used, 0);
  return { month: PLAN.month, currency: PLAN.currency, total: PLAN.total, used: totalUsed, remaining: PLAN.total - totalUsed, lines };
}

/**
 * Paid spend divided by NEW FANS measured in the same window — active loggers
 * this week, from the product's own database, because a fan who logs is the
 * unit this product is measured in. Null until both exist.
 */
export function costPerInstall({ entries = [], metrics = null }) {
  const paid = entries.filter((e) => e.line === 'opening' || e.line === 'creators').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const fans = metrics && metrics.product && Number.isFinite(metrics.product.loggers7d) ? metrics.product.loggers7d : null;
  if (!paid || !fans) return null;
  return Number((paid / fans).toFixed(2));
}
export const costPerFan = costPerInstall;

/** One sentence for the digest, or null when there is nothing to say. */
export function recommendation(st, { metrics = null } = {}) {
  const open = st.lines.filter((l) => l.open);
  if (!open.length) {
    const next = st.lines.filter((l) => l.blocker).sort((a, b) => (a.earliest < b.earliest ? -1 : 1))[0];
    return next ? `No spend recommended: ${next.label.toLowerCase()} is waiting on ${next.blocker}.` : null;
  }
  const l = open[0];
  return `${l.label} is unblocked with CA$${l.remaining} left on the line. ${l.gate}`;
}
