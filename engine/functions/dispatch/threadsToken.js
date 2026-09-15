/**
 * DELTA-V // THREADS TOKEN LIFECYCLE
 *
 * ── THE PROBLEM THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * A Threads long-lived token is valid for 60 days. It can be refreshed any time
 * after it is 24 hours old, and each refresh buys another 60 days. A token that
 * goes 60 days without a refresh is dead permanently — there is no recovery
 * path except walking the whole OAuth window again by hand.
 *
 * So a static THREADS_TOKEN secret is a time bomb with a two-month fuse. It
 * would work perfectly through every test, ship, run for eight weeks, and then
 * stop — silently, on a Tuesday, with the only symptom being that one network
 * quietly drops out of the digest.
 *
 * ── WHY FIRESTORE AND NOT SECRET MANAGER ────────────────────────────────────
 *
 * The refreshed token has to be written somewhere durable. Writing it back into
 * Secret Manager would mean granting the runtime service account permission to
 * create secret versions — i.e. giving the posting robot the ability to rewrite
 * its own credentials store, which is a much larger blast radius than the
 * problem deserves.
 *
 * Instead the secret is a SEED. The first refresh writes the live token to
 * `dispatch/tokens`, and from then on Firestore is the source of truth. The
 * secret is only consulted when Firestore has nothing, which is exactly the
 * first run after ignition. Rotating by hand still works: put a new value in
 * .secrets.local, delete the Firestore doc, and the seed takes over again.
 */

const GRAPH = 'https://graph.threads.com';
const DAY = 86400000;

/** Refresh once the token is this old. 25 days leaves 35 days of slack before
 *  the 60-day cliff — enough that a fortnight of failed refreshes is survivable
 *  and still shows up in the digest long before anything is lost. */
export const REFRESH_AFTER_DAYS = 25;
/** Start shouting in the digest at this age. */
export const WARN_AFTER_DAYS = 45;

export function tokenAgeDays(rec, now) {
  if (!rec || !rec.refreshedAt) return null;
  return (now.getTime() - new Date(rec.refreshedAt).getTime()) / DAY;
}

/**
 * Resolve the token the publisher should actually use, refreshing it when due.
 *
 * Returns { token, userId, age, refreshed, warn } — never throws. A failed
 * refresh is not fatal: the existing token is still valid for weeks, and
 * killing the whole dispatch run because a rotation failed would turn a
 * cosmetic problem into an outage.
 */
export async function resolveThreadsToken({ store, secrets, now = new Date(), fetchImpl = fetch, log = () => {} }) {
  const userId = secrets.THREADS_USER_ID;
  const seed = secrets.THREADS_TOKEN;
  if (!userId || !seed) return { token: null, userId: null, age: null, refreshed: false, warn: null };

  const rec = (await store.get('dispatch/tokens').catch(() => null)) || {};
  const th = rec.threads || null;

  // No record yet: the secret is the seed. Stamp it as of now — we cannot know
  // when it was actually minted, and assuming "just now" is the safe direction
  // to be wrong in, because it makes the first refresh happen sooner, not later.
  if (!th || !th.token) {
    await store.update('dispatch/tokens', { threads: { token: seed, refreshedAt: now.toISOString(), seeded: true } }).catch(() => {});
    return { token: seed, userId, age: 0, refreshed: false, warn: null };
  }

  const age = tokenAgeDays(th, now);
  if (age === null || age < REFRESH_AFTER_DAYS) {
    return { token: th.token, userId, age, refreshed: false, warn: null };
  }

  try {
    const url = `${GRAPH}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(th.token)}`;
    const res = await fetchImpl(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      throw new Error(`threads refresh ${res.status}: ${body.error_message || body.error || 'no token in response'}`);
    }
    await store.update('dispatch/tokens', {
      threads: { token: body.access_token, refreshedAt: now.toISOString(), expiresIn: body.expires_in || null, seeded: false },
    });
    log(`threads token refreshed at ${Math.round(age)}d — good for another 60`);
    return { token: body.access_token, userId, age: 0, refreshed: true, warn: null };
  } catch (err) {
    log(`threads token refresh failed at ${Math.round(age)}d: ${err.message}`);
    const warn = age >= WARN_AFTER_DAYS
      ? `Threads token is ${Math.round(age)} days old and the last ${Math.max(1, Math.round(age - REFRESH_AFTER_DAYS))} days of refreshes have failed. It dies at 60 days and cannot be recovered after that — re-run the authorization window.`
      : null;
    return { token: th.token, userId, age, refreshed: false, warn };
  }
}
