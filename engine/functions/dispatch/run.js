// Scorebug dispatch — the orchestrator. One tick = one pass over the scoreboards.
//
//   settings → feed → state → detect → rank → draft → lint → route
//   (send / approval / dry) → publish → ledger
//
// Every dependency is injected so the whole thing runs against fabricated
// scoreboards in tests. The ledger entry is written BEFORE the function
// returns for every event it touched, and a network that failed is retried on
// the next tick for that event only — never re-drafted.
//
// Kept from Delta-V unchanged, because each was a bug once: exactly one sender
// (`sendAll`), dry run enforced in that one place, idempotency by event id, the
// 36-hour expiry, the retry-per-network loop, and the approved-queue drain.
//
// ── THE ORDER OF THE LEDGER WRITE ───────────────────────────────────────────
//
// An event is written to the ledger as `sending` BEFORE anything reaches a
// network, and patched to `sent` after. It used to be the other way round, and
// the header above claimed idempotency by event id while the id only came into
// existence once the posts were already public: a Firestore write that failed,
// or a tick that hit its timeout mid-send, left no record, and the next tick
// re-detected the same final and posted it to every network a second time.
// Only Mastodon honours an idempotency key, so only Mastodon was protected.
//
// A doc stuck at `sending` is therefore ambiguous — the post may or may not
// have gone out — and the engine will not guess. After fifteen minutes it is
// marked `stalled` and put in front of the owner, which is the only honest
// thing to do with "I do not know whether this is public".

import { detect, needsHuman, isRoutine, titleOf, WINDOWS, weekKey } from './events.js';
import { select, slatePick } from './rank.js';
import { draft, lint, sourcesFor, altFor, LIMITS } from './draft.js';
import { cardFor, setCardKey } from './cards.js';
import { loadSettings } from './store.js';
import { reserve as reserveXSpend } from './xspend.js';
import { POLICY, policyFor } from './optimize.js';
import { loadAttachment } from './media.js';
import { fetchFacts, FALLBACK_FACTS } from './facts.js';
import { findAnniversary } from './archive.js';
import { weekInNumbers, communityFor } from './supabase.js';
import { localParts } from './leagues.js';

export const EV = 'dispatch/state/events/';
export const GM = 'dispatch/state/games/';
export const SLOTS = 'dispatch/state/meta/slots';
export const FACTS = 'dispatch/state/meta/facts';
const ALL_NETWORKS = ['bluesky', 'mastodon', 'threads', 'x', 'instagram'];
const HOUR = 3_600_000;
const MINUTE = 60_000;
/**
 * Retry waits, in order. The retry loop used to have no backoff and no attempt
 * cap at all: its only stop condition was the 36-hour expiry, so a network
 * that kept failing was hit once every ten minutes for a day and a half — 216
 * attempts. On X, where a timeout after a successful post looks exactly like a
 * failure, that is up to 216 duplicate tweets and about US$47 of billing
 * against a US$10 cap. Four attempts, spread out, then the digest says so.
 */
const RETRY_WAITS = [0, 30 * MINUTE, 2 * HOUR, 6 * HOUR];
/** A send that never reported back. Long enough that a slow network is not called stalled. */
const SENDING_STALE = 15 * MINUTE;
/** How much of the ledger a tick needs. Everything it does looks back 36 hours at most. */
const TICK_WINDOW = 72 * HOUR;
/** How long the ledger keeps a finished event. The bandit reads six weeks; nothing reads more. */
const KEEP_MS = 45 * 86_400_000;
const TZ = 'America/Edmonton';

export async function tick({ store, feed, publishers = {}, now = Date.now(), secrets = {}, log = () => {}, fetchImpl = fetch, factsFetch = fetchFacts, archive = findAnniversary, supabase = null, tz = TZ }) {
  const settings = await loadSettings(store);
  /* The card press signs the parameters that make a claim about Scorebug — a
     community grade, a games-logged total, a free-text headline — with the
     same key the facts endpoint uses. Set it explicitly rather than relying on
     module-load env capture, so a cold start ordering change cannot silently
     turn every card into an unsigned one the site then strips. */
  setCardKey(secrets.DISPATCH_KEY || process.env.DISPATCH_KEY || '');
  const summary = { ran: false, events: [], sent: [], approval: [], refused: [], dry: [], errors: [], retried: [], deferred: 0, feed: {} };
  if (!settings.enabled) { summary.note = 'disabled'; return summary; }
  summary.ran = true;

  // 1. Feed and state
  const { games, errors: feedErrors = [], leagues = [] } = await feed({ now });
  summary.feed = { games: games.length, leagues: leagues.length, errors: feedErrors };
  for (const e of feedErrors) summary.errors.push(`feed ${e}`);
  const gameDocs = await store.list(GM);
  const state = new Map(gameDocs.map((d) => [d.id, d.data]));
  /* Only the recent past. Listing the whole events collection on every tick is
     144 full-collection reads a day against a document count that grows for
     ever; nothing in a tick looks back further than the 36-hour expiry. */
  const eventDocs = await listSince(store, EV, now - TICK_WINDOW);
  const slots = (await store.get(SLOTS)) || { fired: {} };

  // 2. Anything left mid-send by a crashed tick, then the retries.
  //
  //    The retry goes through `sendAll`, not `sendOne`. Calling the low-level
  //    sender here bypassed all three of the guarantees sendAll exists to make:
  //    dry run was ignored (turning dry run back ON did not stop a pending
  //    network from posting every ten minutes), a network switched off in the
  //    console kept posting, and every retried X send skipped the spend meter.
  for (const d of eventDocs) {
    const e = d.data;
    if (e.status === 'sending' && now - Date.parse(e.sendStartedAt || e.createdAt) > SENDING_STALE) {
      await store.update(d.path, { status: 'stalled', note: `${e.note || ''} · interrupted mid-send; check the networks before re-approving`.trim() });
      summary.errors.push(`${d.id}: interrupted mid-send`);
      continue;
    }
    if (e.status !== 'sent' || !e.pending || !e.pending.length) continue;
    const attempts = Number(e.retryAttempts || 0);
    if (attempts >= RETRY_WAITS.length || now - Date.parse(e.createdAt) > 36 * HOUR) {
      if (e.pending.length) {
        await store.update(d.path, { pending: [], note: `${e.note || ''} · gave up on ${e.pending.join(',')} after ${attempts} attempts`.trim() });
      }
      continue;
    }
    const since = Date.parse(e.lastRetryAt || e.sentAt || e.createdAt);
    if (Number.isFinite(since) && now - since < RETRY_WAITS[attempts]) continue;
    const out = await sendAll(publishers, e.texts, settings, log, { media: e.media, fetchImpl, store, networks: e.pending });
    if (out.dryRun) continue;   // dry run came back on: leave the queue exactly as it is
    await store.update(d.path, {
      postedUrls: { ...(e.postedUrls || {}), ...out.urls },
      postedIds: { ...(e.postedIds || {}), ...out.ids },
      pending: out.failed,
      retryAttempts: attempts + 1,
      lastRetryAt: new Date(now).toISOString(),
    });
    for (const f of out.errors) summary.errors.push(`${d.id}: ${f}`);
    summary.retried.push(d.id);
  }

  // 2b. Drain the approved queue — the digest's one-click link, the console,
  //     or contentTick under autopilot — so there is exactly one sender.
  for (const d of eventDocs) {
    const e = d.data;
    if (e.status !== 'approved') continue;
    if (settings.dryRun) continue;
    if (now - Date.parse(e.createdAt) > 36 * HOUR) {
      await store.update(d.path, { status: 'skipped', note: `${e.note || ''} · expired before it could be sent`.trim() });
      continue;
    }
    // Claim it before sending, so a console approval racing this drain cannot
    // both win and post the same draft twice.
    if (!(await store.claim(d.path, ['approved'], { status: 'sending', sendStartedAt: new Date(now).toISOString() }))) continue;
    const out = await sendAll(publishers, e.texts, settings, log, { media: e.media, fetchImpl, store, networks: e.networks });
    await store.update(d.path, { status: 'sent', postedUrls: out.urls, postedIds: out.ids, pending: out.failed, sentAt: new Date(now).toISOString() });
    for (const f of out.errors) summary.errors.push(`${d.id}: ${f}`);
    summary.sent.push(d.id);
  }

  // 3. The product facts — from the site, cached six hours, conservative fallback.
  const facts = await loadFacts({ store, secrets, now, fetchImpl, factsFetch, log });

  // 4. What the slot beats need, fetched only when their window is open.
  const local = localParts(now, tz);
  const fired = slots.fired || {};
  const ctx = { recentFinals: [], anniversary: null, community: null, weekAhead: null };

  ctx.recentFinals = eventDocs.map((d) => d.data)
    .filter((e) => e.type === 'FINAL' && e.game && (e.status === 'sent' || e.status === 'dry') && now - Date.parse(e.createdAt) <= 16 * HOUR)
    .map((e) => ({ id: e.id, game: e.game, score: e.score || 0 }));

  const annivKey = `anniv:${local.day}`;
  if (settings.archive && settings.archive.enabled !== false && !fired[annivKey] && inWin(local.minutes, WINDOWS.ANNIVERSARY)) {
    ctx.anniversary = await archive({ now, tz, fetchImpl, log, weights: settings.weights }).catch((e) => { log('archive failed', String(e.message)); return null; });
    if (!ctx.anniversary) {
      // Nothing cleared the floor: close the slot so the archive is not queried on every tick until 14:00.
      await markSlot(store, { slotKey: annivKey }, now, 'no anniversary cleared the floor');
    }
  }

  const wk = weekKey(now, tz);
  if (local.weekday === 'Sun' && !fired[`weeknumbers:${wk}`] && inWin(local.minutes, WINDOWS.WEEKNUMBERS) && settings.community && settings.community.enabled !== false) {
    ctx.community = await weekInNumbers({ client: supabase, minLogs: settings.community.minLogs || 10 });
    if (!ctx.community.ok) await markSlot(store, { slotKey: `weeknumbers:${wk}` }, now, ctx.community.reason);
  }
  if (local.weekday === 'Mon' && !fired[`weekahead:${wk}`] && inWin(local.minutes, WINDOWS.WEEKAHEAD)) {
    const slate = await store.get(`dispatch/state/slates/${wk}`);
    if (slate && slate.count) ctx.weekAhead = { slug: wk, count: slate.count, leagues: slate.leagues, range: slate.range, highlights: slate.highlights || [] };
    else await markSlot(store, { slotKey: `weekahead:${wk}` }, now, 'no slate page for this week');
  }

  // 5. Detect, then rank against today's budget.
  const events = detect({ now, games, state, slots, settings, tz, ...ctx });
  const budget = todaysBudget(eventDocs.map((d) => d.data), local.day, tz, now);
  const todo = select({ events, settings, now, tz, ...budget, rivalries: facts.rivalries || null }).slice(0, settings.maxEventsPerRun || 4);
  summary.deferred = Math.max(0, events.filter((e) => e.type === 'FINAL').length - todo.filter((e) => e.type === 'FINAL').length);

  // 6. Draft, lint, route, publish, record.
  const policy = policyFor(await store.get(POLICY));
  for (const ev of todo) {
    const id = ev.id;
    if (await store.get(EV + id)) continue; // idempotent by construction

    if (ev.type === 'SLATE') ev.pick = slatePick(ev.games, 5, { tz, weights: settings.weights });

    // Community grade rides on the morning card when the gate passes.
    let community = null;
    if ((ev.type === 'MORNING' || ev.type === 'FINAL') && supabase && ev.game && ev.game.espnId && settings.community && settings.community.enabled !== false) {
      community = await communityFor({ client: supabase, espnId: ev.game.espnId, minLogs: settings.community.minLogs || 10 }).catch(() => null);
    }

    const texts = draft(ev, { now, tz, facts, invite: policy.invite, productIndex: policy.productIndex });
    const sources = sourcesFor(ev, { now, tz });
    const people = ev.game ? ev.game.people || [] : (ev.games || []).flatMap((g) => g.people || []);
    /* The clubs in this record, handed to the name check so that a first name
       which is also a club — Austin FC, Orlando City — is not read as a person
       and does not hold a perfectly good post every night. */
    const safeWords = [ev.game, ...(ev.games || [])].filter(Boolean)
      .flatMap((g) => [g.home, g.away].filter(Boolean).flatMap((sd) => [sd.name, sd.short, sd.nickname, sd.abbr]))
      .filter(Boolean).join(' ');
    const problems = {};
    for (const net of Object.keys(texts)) {
      const p = lint(texts[net], { sources, network: net === 'xReply' ? 'x' : net, people, facts, safeWords });
      if (p.length) problems[net] = p;
    }
    const media = cardFor(ev, { tz, band: policy.card, community, productId: policy.productId, alt: altFor(ev) });
    const variants = { ...policy.variants };
    const base = record(ev, now, texts, { media, variants, community, facts: { stage: facts.stage, fallback: !!facts.fallback } });

    if (Object.keys(problems).length) {
      /* "The engine must refuse them outright — not weigh them." A draft that
         mentions odds is not a judgement call the owner should be handed with
         an Approve button next to it; it is a bug in whatever wrote it. So a
         betting hit is QUARANTINED — status `refused`, which nothing can
         approve — while every other lint problem is a hold the owner decides. */
      const all = Object.values(problems).flat();
      const bet = all.find((x) => x.startsWith('betting language'));
      await store.set(EV + id, {
        ...base,
        status: bet ? 'refused' : 'approval',
        note: `lint: ${JSON.stringify(problems)}`,
      });
      (bet ? summary.refused : summary.approval).push(id);
      if (bet) summary.errors.push(`${id}: REFUSED — ${bet}`);
      await touch(store, ev, now);
      continue;
    }
    const route = routeFor(ev, settings);
    if (settings.dryRun) {
      await store.set(EV + id, { ...base, status: 'dry', route });
      summary.dry.push(id);
      await touch(store, ev, now);
      continue;
    }
    if (route === 'approval') {
      await store.set(EV + id, { ...base, status: 'approval' });
      summary.approval.push(id);
      await touch(store, ev, now);
      continue;
    }
    /* The ledger first, then the networks. See the note at the top of the file:
       writing the record only after a successful send meant a crash between
       the two re-posted the whole event on the next tick. */
    await store.set(EV + id, { ...base, status: 'sending', sendStartedAt: new Date(now).toISOString() });
    await touch(store, ev, now);
    const out = await sendAll(publishers, texts, settings, log, { media, fetchImpl, store, networks: ev.networks });
    await store.update(EV + id, { status: 'sent', postedUrls: out.urls, postedIds: out.ids, pending: out.failed, sentAt: new Date(now).toISOString() });
    for (const f of out.errors) summary.errors.push(`${id}: ${f}`);
    summary.sent.push(id);
  }
  await store.update('dispatch/state/meta/counters', { lastTick: new Date(now).toISOString(), lastGames: games.length });

  /* 7. Prune, once a day.
   *
   *    The ledger is the engine's working memory, not its archive. Nothing
   *    deleted anything, so `dispatch/state/events` grew by ~10 documents a
   *    day for ever and every one of the 144 daily ticks read all of them.
   *    Six weeks is longer than the bandit's window and longer than any
   *    report; past that a finished event is only a Firestore bill. Capped per
   *    run so a first prune after a long gap cannot blow the tick's budget. */
  const pruneKey = `prune:${local.day}`;
  if (!fired[pruneKey] && typeof store.del === 'function') {
    let removed = 0;
    const cutoff = now - KEEP_MS;
    for (const d of await store.list(EV)) {
      if (removed >= 300) break;
      const e = d.data || {};
      if (e.status === 'sending' || e.status === 'approval' || e.status === 'approved') continue;
      const at = Date.parse(e.sentAt || e.createdAt);
      if (!Number.isFinite(at) || at >= cutoff) continue;
      await store.del(d.path); removed += 1;
    }
    for (const d of gameDocs) {
      if (removed >= 400) break;
      const at = Date.parse(d.data && d.data.start);
      if (!Number.isFinite(at) || at >= cutoff) continue;
      await store.del(d.path); removed += 1;
    }
    summary.pruned = removed;
    await markSlot(store, { slotKey: pruneKey }, now, `pruned ${removed} finished records older than 45 days`);
  }

  summary.events = todo.map((e) => e.id);
  return summary;
}

const inWin = (m, [a, b]) => m >= a && m < b;

/**
 * The slice of a collection a tick actually needs.
 *
 * Uses the store's own `since` query when it has one (Firestore answers a
 * single-field `where('createdAt','>=')` from an automatic index — no composite
 * index to declare), and otherwise lists and filters. Either way the caller
 * sees the same shape, and the memory store in the tests behaves identically.
 */
async function listSince(store, prefix, sinceMs) {
  const iso = new Date(sinceMs).toISOString();
  if (typeof store.listSince === 'function') return store.listSince(prefix, iso);
  const all = await store.list(prefix);
  return all.filter((d) => {
    const at = d.data && d.data.createdAt;
    return !at || String(at) >= iso;   // a doc with no createdAt is always in scope
  });
}

/** The facts, from the site, cached. A fallback answer is never cached — the next tick asks again. */
async function loadFacts({ store, secrets, now, fetchImpl, factsFetch, log }) {
  const cached = await store.get(FACTS);
  if (cached && cached.fetchedAt && !cached.fallback && now - Date.parse(cached.fetchedAt) < 6 * HOUR) return cached;
  const facts = await factsFetch({ base: secrets.SITE_BASE_URL || undefined, key: secrets.DISPATCH_KEY, fetchImpl, log });
  if (!facts.fallback) await store.set(FACTS, facts);
  return facts.fallback && cached && !cached.fallback ? cached : facts;
}

/** What today has already used, per network and per league, from the ledger. */
export function todaysBudget(events, day, tz = TZ, now = Date.now()) {
  const sentToday = {}, lastSentAt = {}, leagueToday = {};
  let xLinkedToday = false;
  for (const e of events) {
    if (!e.createdAt || !['sent', 'sending', 'approval', 'approved', 'dry'].includes(e.status)) continue;
    const at = Date.parse(e.sentAt || e.createdAt);
    if (!Number.isFinite(at)) continue;
    /* The 40-minute gap is a rule about real time and must not reset at local
       midnight. It did: everything outside today's calendar day was dropped
       before `lastSentAt` was computed, so a post at 23:50 and the next at
       00:10 were twenty minutes apart and both went out — in exactly the
       window where North American finals land. The counts below stay
       per-calendar-day, which is what a daily cap means. */
    if (now - at <= 24 * HOUR) {
      for (const n of e.networks || []) lastSentAt[n] = Math.max(lastSentAt[n] || 0, at);
    }
    if (localParts(at, tz).day !== day) continue;
    for (const n of e.networks || []) {
      sentToday[n] = (sentToday[n] || 0) + 1;
    }
    if (e.type === 'FINAL' && e.game) leagueToday[e.game.league] = (leagueToday[e.game.league] || 0) + 1;
    if (e.type === 'FINAL' && e.link) xLinkedToday = true;
  }
  return { sentToday, lastSentAt, leagueToday, xLinkedToday };
}

/**
 * Everything the machine may never send by itself waits; with autopilot on,
 * routine beats go. With autopilot off, everything waits.
 */
export function routeFor(ev, settings) {
  if (needsHuman(ev)) return 'approval';
  if (settings.autopilot && isRoutine(ev)) return 'send';
  return 'approval';
}

/** Mark the game as posted for this beat, and the slot as fired. */
async function touch(store, ev, now) {
  if (ev.game && (ev.type === 'FINAL' || ev.type === 'PREGAME' || ev.type === 'MORNING')) {
    const cur = (await store.get(GM + ev.game.id)) || { posted: {} };
    await store.set(GM + ev.game.id, { league: ev.game.league, state: ev.game.state, start: ev.game.start, posted: { ...(cur.posted || {}), [ev.type]: new Date(now).toISOString() } });
  }
  if (ev.slotKey) await markSlot(store, ev, now);
}

/** Record that a slot fired, and forget the days that have passed. */
export async function markSlot(store, ev, now, note = null) {
  if (!ev.slotKey) return;
  const doc = (await store.get(SLOTS)) || {};
  const fired = { ...(doc.fired || {}), [ev.slotKey]: new Date(now).toISOString() };
  const keepFrom = now - 10 * 86_400_000;
  for (const [k, at] of Object.entries(fired)) {
    const t = Date.parse(at);
    if (Number.isFinite(t) && t < keepFrom) delete fired[k];
  }
  const notes = { ...(doc.notes || {}) };
  if (note) notes[ev.slotKey] = note;
  for (const k of Object.keys(notes)) if (!fired[k]) delete notes[k];
  /* `set`, not `update`. Firestore's merge deep-merges maps, so a key deleted
     from `fired` above was never actually removed from the document — the
     prune has been a no-op since it was written, and the document grows by
     about eight keys a day until it hits the 1 MiB limit and every tick starts
     throwing. Replacing the whole document is what this function always meant. */
  await store.set(SLOTS, { ...doc, fired, notes });
}

/** Send an event that a human approved (called from the ops endpoint). */
export async function sendApproved({ store, publishers, id, now = Date.now(), log = () => {} }) {
  const e = await store.get(EV + id);
  if (!e) throw new Error('unknown event');
  if (e.status === 'sent') return e;
  if (e.status === 'sending') throw new Error('That post is already going out.');
  if (e.status === 'refused') throw new Error('That draft was refused by the linter — betting language is never approvable. Fix the template instead.');
  if (e.status === 'stalled') throw new Error('That send was interrupted and may already be public. Check the networks before re-approving.');
  const settings = await loadSettings(store);
  if (settings.dryRun) {
    await store.update(EV + id, { status: 'approved', approvedAt: new Date(now).toISOString() });
    throw new Error('Dry run is on, so nothing was sent. This post is queued and will go out as soon as you end dry run.');
  }
  /* Claim it, atomically, and only send if this caller is the one that won.
     Read-then-send let a double-tapped digest button, or a mail scanner racing
     the owner's click, post the same draft to five networks twice. */
  const claimed = await store.claim(EV + id, ['approval', 'approved', 'pending'], { status: 'sending', sendStartedAt: new Date(now).toISOString() });
  if (!claimed) throw new Error('That post was already claimed — it is going out, or it already went.');
  const out = await sendAll(publishers, e.texts, settings, log, { media: e.media, store, networks: e.networks });
  const patch = { status: 'sent', postedUrls: out.urls, postedIds: out.ids, pending: out.failed, sentAt: new Date(now).toISOString(), approvedAt: new Date(now).toISOString() };
  await store.update(EV + id, patch);
  return { ...e, ...patch };
}

export async function sendAll(publishers, texts, settings, log, { media: mediaSpec, fetchImpl = fetch, store = null, networks = ALL_NETWORKS } = {}) {
  // Dry run is authoritative, in ONE place. Every path that could reach a
  // network goes through here, so this single guard is what makes "nothing
  // goes out" a fact rather than a convention five callers observe.
  if (settings.dryRun) return { urls: {}, ids: {}, failed: [], errors: [], dryRun: true };
  const urls = {}, ids = {}, failed = [], errors = [];
  const wanted = (networks && networks.length ? networks : ALL_NETWORKS).filter((n) => ALL_NETWORKS.includes(n));
  const targets = wanted.filter((n) => settings.networks[n] !== false && publishers[n] && texts[n]);

  const media = mediaSpec ? await loadAttachment(mediaSpec, targets, { fetchImpl, log }) : null;
  if (mediaSpec && !media) errors.push('attachment unavailable, posted as text');

  for (const net of targets) {
    if (net === 'x' && store) {
      const gate = await reserveXSpend({ store, text: texts.x, reply: texts.xReply || '', hasMedia: !!media, settings });
      if (!gate.allowed) { log('x skipped —', gate.reason); errors.push(`x: ${gate.reason}`); continue; }
    }
    const r = await sendOne(publishers[net], net, texts, settings, log, media);
    if (r.skipped) continue;
    if (r.ok) {
      urls[net] = r.url;
      ids[net] = r.id;
      if (net === 'bluesky' && r.uri) urls.blueskyUri = r.uri;
    } else { failed.push(net); errors.push(`${net}: ${r.error}`); }
  }
  return { urls, ids, failed, errors };
}

async function sendOne(pub, net, texts, settings, log, media = null) {
  if (!pub || !texts[net]) return { skipped: true };
  try {
    const usable = media && !((net === 'threads' || net === 'instagram') && !media.publicUrl) ? media : null;
    if (net === 'instagram' && !usable) return { skipped: true };
    const main = await pub.post(texts[net], { idempotency: `${net}-${hash(texts[net])}`, media: usable });
    if (main && main.skipped) return { skipped: true };
    if (net === 'x' && texts.xReply) {
      try { await pub.post(texts.xReply, { replyTo: main }); } catch (e) { log('x reply failed', String(e.message)); }
    }
    log('posted', net, main.id);
    return { ok: true, url: main.url || main.id, id: main.id, uri: main.uri || null };
  } catch (e) {
    log('post failed', net, String(e.message));
    return { ok: false, error: String(e.message) };
  }
}

function record(ev, now, texts, extra) {
  const g = ev.game;
  return {
    id: ev.id, type: ev.type, status: 'pending', createdAt: new Date(now).toISOString(),
    title: titleOf(ev), day: ev.day || null, slotKey: ev.slotKey || null,
    networks: ev.networks || [], link: !!ev.link, score: ev.score ?? null, features: ev.features || null,
    game: g ? slim(g) : null,
    games: ev.games ? (ev.pick || ev.games).slice(0, 5).map(slim) : null,
    years: ev.years ?? null, week: ev.week || null,
    texts, limits: LIMITS, ...extra,
  };
}

/** The game as the ledger keeps it — enough to re-draft and to render the digest, without the whole record. */
export function slim(g) {
  const side = (s) => (s ? { abbr: s.abbr, name: s.name, short: s.short, nickname: s.nickname, score: s.score, scoreText: s.scoreText, record: s.record, winner: s.winner, linescores: s.linescores || [] } : null);
  return {
    id: g.id, espnId: g.espnId, league: g.league, sport: g.sport, name: g.name, shortName: g.shortName, start: g.start, state: g.state, completed: g.completed,
    detail: g.detail, postponed: g.postponed, canceled: g.canceled, suspended: g.suspended, period: g.period, seasonType: g.seasonType, seasonYear: g.seasonYear, week: g.week, note: g.note, headline: g.headline, feedText: g.feedText || null,
    venue: g.venue, broadcast: g.broadcast, home: side(g.home), away: side(g.away), people: g.people || [], source: g.source,
  };
}

function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
