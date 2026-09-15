/**
 * SCOREBUG // X SPEND METER
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * X is the only network here that charges per request, and it charges unevenly:
 * a post carrying a link costs THIRTEEN TIMES a post without one. Here a final
 * on X carries a card and no link ($0.02 with media metadata) and the link rides
 * in ONE reply a day, for the game that earned it ($0.20) — rank.js decides
 * which. A bug that doubles the posting rate still doubles a real bill rather
 * than a log line, which is why the meter charges itself before the call.
 *
 * `settings.xMonthlyCapUsd` has existed since the settings document was first
 * written, and until now nothing read it. A cap nobody enforces is worse than
 * no cap, because it is visible in the console and reads as protection.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * This is a local estimate, not a bill. It counts what we asked for using X's
 * published rates; it cannot see deduplication, promotional credit, or a price
 * change. So it is deliberately set BELOW the spending limit configured in X's
 * own console — two independent walls, ours soft and theirs hard, and neither
 * trusting the other. If they ever disagree, the console is right.
 *
 * Running out mid-month is a good failure: X stops, the other three networks
 * carry on, and the digest says so. Nothing silently escalates.
 */

/** Published rates, https://docs.x.com/x-api/getting-started/pricing (Sept 2026). */
import { localParts } from './leagues.js';

export const X_RATES = Object.freeze({
  postWithUrl: 0.200,
  post: 0.015,
  mediaMetadata: 0.005,
});

const URL_IN_TEXT = /https?:\/\/\S+/i;

/** What one send is about to cost, given the text and whether media rides along. */
export function costOf(text, hasMedia = false) {
  const base = URL_IN_TEXT.test(String(text || '')) ? X_RATES.postWithUrl : X_RATES.post;
  return Number((base + (hasMedia ? X_RATES.mediaMetadata : 0)).toFixed(3));
}

/**
 * The billing month, in Mountain time — the same clock every other date in the
 * engine uses. On UTC the key rolled over at 18:00 MT on the last day of the
 * month, i.e. in the middle of the window rank.js says North American finals
 * land in: the last evening of every month quietly drew on next month's fresh
 * allowance while the digest still reported the old month as open.
 */
export const monthKey = (now = new Date(), tz = 'America/Edmonton') => {
  const p = localParts(typeof now === 'number' ? now : now.getTime(), tz);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`;
};

/**
 * Decide whether this X post may go out, and record it if it does.
 *
 * Reserving BEFORE the post rather than recording after is the safe direction
 * to be wrong in: a post that fails after we charged ourselves for it leaves
 * the meter a few cents pessimistic, which costs nothing. Recording after would
 * mean a crash between send and write buys an unmetered post every time.
 */
export async function reserve({ store, text, reply = '', hasMedia = false, settings = {}, now = new Date() }) {
  const cap = Number(settings.xMonthlyCapUsd);
  // THE REPLY IS A SECOND BILLABLE REQUEST. On X the main post has no room for
  // a link inside 280 characters, so the link rides in a reply — which means
  // the cheap post ($0.015, no URL) is followed by an expensive one ($0.20,
  // with URL). Pricing only the main post undercounts the real spend by about
  // ninety per cent, and the meter would happily wave through five times the
  // cap. Both requests are charged here, together, before either is sent.
  const cost = Number((costOf(text, hasMedia) + (reply ? costOf(reply, false) : 0)).toFixed(3));
  // A cap of 0 is a deliberate "no X spend". Only a missing or unparseable cap
  // means unmetered, and that is a configuration mistake worth being loud about
  // rather than a mode — so it still records, it just cannot refuse.
  const key = monthKey(now);
  const path = `dispatch/state/xspend/${key}`;
  /* ── THE METER FAILS CLOSED ────────────────────────────────────────────
     Both of these used to swallow their errors and carry on to `allowed:
     true`. A meter that cannot read or write its own document is a meter that
     is not metering, and the header above promises that running out mid-month
     is the failure mode. With the old code a store that refused writes waved
     through every send for the rest of the month: measured at 500 consecutive
     posts against a $10 cap. X is the one network that bills, so the only
     honest answer when the meter is broken is "not until it is fixed". */
  let rec;
  try {
    rec = (await store.get(path)) || { month: key, spentUsd: 0, posts: 0 };
  } catch (e) {
    return { allowed: false, spent: 0, cap, cost, reason: `X spend meter unreadable (${e.message}) — refusing to post unmetered` };
  }
  const spent = Number(rec.spentUsd) || 0;

  if (Number.isFinite(cap) && spent + cost > cap) {
    return { allowed: false, spent, cap, cost, reason: `X monthly cap reached — $${spent.toFixed(2)} of $${cap.toFixed(2)}` };
  }

  try {
    await store.update(path, {
      month: key,
      spentUsd: Number((spent + cost).toFixed(3)),
      posts: (Number(rec.posts) || 0) + 1,
      lastAt: now.toISOString(),
    });
  } catch (e) {
    return { allowed: false, spent, cap, cost, reason: `X spend meter unwritable (${e.message}) — refusing to post unmetered` };
  }
  return { allowed: true, spent: Number((spent + cost).toFixed(3)), cap, cost, reason: null };
}

/** For the digest: where the month stands, without touching the ledger. */
export async function spendStatus({ store, settings = {}, now = new Date() }) {
  const key = monthKey(now);
  const rec = (await store.get(`dispatch/state/xspend/${key}`).catch(() => null)) || { spentUsd: 0, posts: 0 };
  const cap = Number(settings.xMonthlyCapUsd);
  const spent = Number(rec.spentUsd) || 0;
  return {
    month: key,
    spent,
    posts: Number(rec.posts) || 0,
    cap: Number.isFinite(cap) ? cap : null,
    remaining: Number.isFinite(cap) ? Number((cap - spent).toFixed(3)) : null,
    exhausted: Number.isFinite(cap) && spent >= cap,
  };
}
