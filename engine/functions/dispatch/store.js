// Scorebug dispatch — the ledger.
//
// One interface, two implementations: Firestore in production, memory in
// tests. The orchestrator never touches Firestore directly, which is what
// makes every branch in run.js testable without an emulator.
//
// Layout (all under the `dispatch` document to keep it out of the game's
// collections):
//   dispatch/settings                       { enabled, dryRun, autopilot, networks, ... }
//   dispatch/state/launches/{launchId}      { status, net, posted: {EVENT: iso} }
//   dispatch/state/events/{eventId}         the draft + what happened to it
//   dispatch/state/replies/{id}             engagement drafts and sent replies
//   dispatch/state/digests/{YYYY-MM-DD}     the daily digest as sent
//   dispatch/state/metrics/{YYYY-MM-DD}     follower counts etc.
//   dispatch/state/clips/{clipId}           clips handed over by the factory
//   dispatch/state/meta/slots               which almanac slots fired today

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,      // master switch — the function exits in its first line when false
  dryRun: true,        // everything runs, nothing is sent, drafts land in events with status "dry"
  autopilot: false,    // when true, routine beats (slate, pregame, finals, morning, anniversaries, product lines) send themselves
  networks: { bluesky: true, mastodon: true, threads: true, x: true, instagram: true },
  /**
   * ── THE DAILY BUDGET, PER NETWORK ─────────────────────────────────────────
   * Delta-V could not over-post; there were never enough launches. This engine
   * can post a hundred finals in a night if the ranker has a bug, so the cap
   * is enforced in rank.js before a publisher is ever called. A day is a
   * Mountain day. Under-posting is always fine.
   */
  maxPerDay: { bluesky: 5, mastodon: 5, threads: 4, x: 3, instagram: 1 },
  minGapMinutes: 40,          // between two posts on the same network (slate and morning are exempt)
  maxPerLeaguePerDay: 2,      // finals from one league per day
  floors: { minFinal: 4, minPregame: 3, xLink: 8 },  // rank.js FLOORS; a final under minFinal never posts
  weights: null,              // rank.js WEIGHTS overrides, key by key; the bandit may write here
  maxEventsPerRun: 4,
  productPosts: true,         // the Tue/Thu verified line about the app
  // Enforced in xspend.js on every X send. Finals on X carry a card and no link
  // ($0.02); one link reply a day at $0.20. ~US$5/month at the default caps;
  // $10 leaves room for a playoff week and sits below the hard limit in X's console.
  xMonthlyCapUsd: 10,
  engage: { enabled: false, autoReply: false },   // mentions; autoReply false = drafts only
  reviews: { enabled: false, autoReply: false },  // Play reviews; off until there is a public listing
  llm: { model: 'claude-sonnet-4-5', enabled: false },  // the optional sentence; off by default — see llm.js
  archive: { enabled: true },   // on-this-day finals from past seasons
  community: { enabled: true, minLogs: 10 },  // community grades post only above this many logs on one game
  channels: {                   // everything that is not a social network
    discord: true,              // mirror every dispatch to our own server
    newsletter: false,          // send the weekly slate as a broadcast (needs consent rows — see supabase.js)
    opportunities: true,        // surface places worth answering by hand
  },
});

const isPlain = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * Firestore's `set(patch, { merge: true })` DEEP-merges maps: a key the patch
 * omits is kept, not removed. The memory store used to shallow-spread, which
 * is a different function, and the difference hid a real bug for months —
 * `markSlot` deleted expired keys from a map and wrote it back with `update`,
 * the tests saw the shallow behaviour and passed, and in production not one
 * key was ever actually removed. So the fake now merges the way the real one
 * does. Where a caller genuinely wants replacement, it must use `set`.
 */
function deepMerge(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function memoryStore(seed = {}) {
  const docs = new Map(Object.entries(seed));
  return {
    async get(path) { return docs.has(path) ? structuredClone(docs.get(path)) : null; },
    async set(path, data) { docs.set(path, structuredClone(data)); },
    async update(path, patch) { docs.set(path, structuredClone(deepMerge(docs.get(path), patch))); },
    async del(path) { docs.delete(path); },
    async list(prefix) {
      const out = [];
      for (const [k, v] of docs) if (k.startsWith(prefix)) out.push({ path: k, id: k.slice(prefix.length), data: structuredClone(v) });
      return out;
    },
    /**
     * Compare-and-set on `status`. The check and the write happen in one
     * synchronous block with no `await` between them, which in a single
     * JavaScript thread is exactly as atomic as the Firestore transaction it
     * stands in for — two concurrent callers can only interleave at an await.
     */
    async claim(path, from, patch) {
      const cur = docs.get(path);
      if (!cur || !from.includes(cur.status)) return false;
      docs.set(path, structuredClone(deepMerge(cur, patch)));
      return true;
    },
    _docs: docs,
  };
}

export function firestoreStore(db) {
  const ref = (path) => db.doc(path);
  return {
    async get(path) { const s = await ref(path).get(); return s.exists ? s.data() : null; },
    async set(path, data) { await ref(path).set(data); },
    async update(path, patch) { await ref(path).set(patch, { merge: true }); },
    async del(path) { await ref(path).delete(); },
    async list(prefix) {
      const col = prefix.replace(/\/$/, '');
      const snap = await db.collection(col).get();
      return snap.docs.map((d) => ({ path: `${col}/${d.id}`, id: d.id, data: d.data() }));
    },
    /**
     * Move a document from one status to another, atomically, and say whether
     * THIS caller was the one who moved it.
     *
     * Read-then-write is not good enough for approval. The digest's button,
     * the console and a mail scanner's prefetch can all arrive within the same
     * second, and each would read `approval`, each would decide to send, and
     * the fans would see the post twice. A transaction makes exactly one of
     * them win.
     */
    async claim(path, from, patch) {
      return db.runTransaction(async (t) => {
        const snap = await t.get(ref(path));
        if (!snap.exists) return false;
        const cur = snap.data() || {};
        if (!from.includes(cur.status)) return false;
        t.set(ref(path), patch, { merge: true });
        return true;
      });
    },
  };
}

export async function loadSettings(store) {
  const s = (await store.get('dispatch/settings')) || {};
  // Every nested object is merged key by key: a settings document that sets
  // only `reviews.enabled` must not wipe `reviews.autoReply` back to undefined,
  // because `!undefined` and `!false` behave the same right up until someone
  // reads the document and believes autoReply is unset when it is on.
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    networks: { ...DEFAULT_SETTINGS.networks, ...(s.networks || {}) },
    engage: { ...DEFAULT_SETTINGS.engage, ...(s.engage || {}) },
    reviews: { ...DEFAULT_SETTINGS.reviews, ...(s.reviews || {}) },
    llm: { ...DEFAULT_SETTINGS.llm, ...(s.llm || {}) },
    maxPerDay: { ...DEFAULT_SETTINGS.maxPerDay, ...(s.maxPerDay || {}) },
    floors: { ...DEFAULT_SETTINGS.floors, ...(s.floors || {}) },
    archive: { ...DEFAULT_SETTINGS.archive, ...(s.archive || {}) },
    community: { ...DEFAULT_SETTINGS.community, ...(s.community || {}) },
    channels: { ...DEFAULT_SETTINGS.channels, ...(s.channels || {}) },
  };
}
