// Scorebug engine — tests ported from Delta-V for the modules that moved
// essentially unchanged: Google auth and the Play/GA4 readers, the bandit's
// arithmetic, the review responder, the signed digest links, settings merging,
// the Threads token lifecycle, the X spend meter, the Bluesky facets and OAuth
// vector, the publisher request shapes, the deploy-discovery guard and the
// Bluesky identity rule. Where a test named a launch it now names a game.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseServiceAccount, decodeReport, parseCsv, column } from '../dispatch/google.js';
import { playInstalls, playRatings, ga4, postEngagement, engagementScore, median, metricsTick } from '../dispatch/metrics.js';
import { betaSample } from '../dispatch/optimize.js';
import { normalizeReview, mayAutoReply, replyToReview, reviewsTick, REPLY_LIMIT } from '../dispatch/reviews.js';
import { sign, verify } from '../dispatch/digest.js';
import { memoryStore } from '../dispatch/store.js';
import { linkFacets, tagFacets, oauth1Header, bluesky, mastodon } from '../dispatch/publish.js';

const T0 = Date.parse('2026-09-03T12:00:00Z');
const DAY = 86_400_000;

/* ───────────────────────────────────────────────────────────────── google */

test('service-account JSON is accepted raw, with escaped newlines, and base64', () => {
  const sa = { client_email: 'a@b.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n' };
  assert.equal(parseServiceAccount(JSON.stringify(sa)).private_key, sa.private_key);
  const escaped = JSON.stringify({ ...sa, private_key: sa.private_key.replace(/\n/g, '\\n') });
  assert.equal(parseServiceAccount(escaped).private_key.includes('\n'), true, 'escaped newlines must be restored or Google returns invalid_grant');
  assert.equal(parseServiceAccount(Buffer.from(JSON.stringify(sa)).toString('base64')).client_email, sa.client_email);
  assert.equal(parseServiceAccount(''), null);
  assert.equal(parseServiceAccount('{"client_email":"x"}'), null);
});

test("Play's UTF-16 reports decode; UTF-8 and BOM-less do too", () => {
  const text = 'Date,Daily Device Installs\n2026-09-01,7\n';
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  assert.equal(decodeReport(utf16), text);
  assert.equal(decodeReport(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])), text);
  assert.equal(decodeReport(Buffer.from(text, 'utf8')), text);
});

test('CSV parsing survives quotes, embedded commas and CRLF; columns match loosely', () => {
  const rows = parseCsv('Date,"Package Name",Daily Device Installs\r\n2026-09-01,"com.a,b",12\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Package Name'], 'com.a,b');
  assert.equal(column(rows[0], 'Daily Device Installs'), '12');
  assert.equal(column(rows[0], 'daily device install'), '12', 'header names have drifted over the years; match loosely');
  assert.equal(column(rows[0], 'Nonexistent'), undefined);
});

/* ──────────────────────────────────────────────────────────────── metrics */

function gcsFetch({ installs, ratings }) {
  return async (url) => {
    if (url.includes('oauth2.googleapis.com')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    if (url.includes('/o?prefix=stats%2Finstalls')) return { ok: true, json: async () => ({ items: [{ name: 'stats/installs/installs_ca.scorebug.sports_202609_overview.csv' }] }) };
    if (url.includes('/o?prefix=stats%2Fratings')) return { ok: true, json: async () => ({ items: [{ name: 'stats/ratings/ratings_ca.scorebug.sports_202609_overview.csv' }] }) };
    if (url.includes('installs_')) return { ok: true, arrayBuffer: async () => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(installs, 'utf16le')]) };
    if (url.includes('ratings_')) return { ok: true, arrayBuffer: async () => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(ratings, 'utf16le')]) };
    return { ok: false, status: 404, text: async () => 'no' };
  };
}
const SA = { client_email: 'a@b', private_key: null };

test('installs come out of the report bucket with a 7-day sum and the latest row', async () => {
  const installs = [
    'Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Active Device Installs,Total User Installs',
    '2026-09-01,ca.scorebug.sports,3,0,5,9',
    '2026-09-02,ca.scorebug.sports,6,1,10,15',
  ].join('\n');
  const ratings = 'Date,Package Name,Daily Average Rating,Total Average Rating\n2026-09-02,ca.scorebug.sports,5.0,4.6\n';
  const fetchImpl = gcsFetch({ installs, ratings });
  // No private key in the fixture, so token minting is stubbed by the fake fetch
  // via the module's own cache; sign with a throwaway key instead.
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { ...SA, private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };

  const r = await playInstalls({ sa, bucket: 'pubsite_prod_rev_1', packageName: 'ca.scorebug.sports', now: T0, fetchImpl });
  assert.equal(r.installs7d, 9);
  assert.equal(r.latest.date, '2026-09-02');
  assert.equal(r.activeDevices, 10);
  const rat = await playRatings({ sa, bucket: 'pubsite_prod_rev_1', packageName: 'ca.scorebug.sports', now: T0, fetchImpl });
  assert.equal(rat.average, 4.6);
});

test('a bucket with no matching report says so instead of returning zero', async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'c@d', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const fetchImpl = async (url) => {
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    return { ok: true, json: async () => ({ items: [] }) };
  };
  const r = await playInstalls({ sa, bucket: 'b', packageName: 'p', now: T0, fetchImpl });
  assert.match(r.error, /no installs overview/);
  assert.equal(r.installs7d, undefined, 'a missing source must not look like a real zero');
});

test('GA4 sessions come back grouped by source, biggest first', async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'e@f', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const fetchImpl = async (url) => {
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    return { ok: true, json: async () => ({ rows: [
      { dimensionValues: [{ value: 'google' }], metricValues: [{ value: '120' }, { value: '95' }, { value: '4' }] },
      { dimensionValues: [{ value: 'bluesky' }], metricValues: [{ value: '210' }, { value: '180' }, { value: '11' }] },
    ] }) };
  };
  const r = await ga4({ sa, propertyId: 'properties/1234', fetchImpl });
  assert.equal(r.sessions, 330);
  assert.equal(r.bySource[0].source, 'bluesky');
  assert.equal(r.bySource[0].keyEvents, 11);
});

test('engagement is read back per post from the public AppView and from Mastodon', async () => {
  const store = memoryStore({
    'dispatch/state/events/E1': { id: 'E1', type: 'T24H', sentAt: new Date(T0 - DAY).toISOString(), postedUrls: { blueskyUri: 'at://did/app.bsky.feed.post/1' }, postedIds: { mastodon: '99' }, hookId: 'hook:2' },
    'dispatch/state/events/OLD': { id: 'OLD', type: 'T24H', sentAt: new Date(T0 - 40 * DAY).toISOString(), postedUrls: { blueskyUri: 'at://did/app.bsky.feed.post/old' } },
  });
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('getPosts')) return { ok: true, json: async () => ({ posts: [{ uri: 'at://did/app.bsky.feed.post/1', likeCount: 5, repostCount: 2, replyCount: 1, quoteCount: 0, indexedAt: 'x' }] }) };
    if (url.includes('/api/v1/statuses/99')) return { ok: true, json: async () => ({ url: 'https://m/1', favourites_count: 3, reblogs_count: 1, replies_count: 0 }) };
    return { ok: false };
  };
  const posts = await postEngagement({ store, mastodonBase: 'https://mastodon.social', now: T0, fetchImpl });
  assert.equal(posts.length, 2);
  const b = posts.find((p) => p.network === 'bluesky');
  assert.equal(b.eventId, 'E1');
  assert.equal(b.hook, 'hook:2');
  assert.equal(engagementScore(b), 5 + 2 * 2 + 2 * 1, 'likes + 2x reposts + 2x replies + 3x quotes');
  assert.ok(!seen.some((u) => u.includes('post/old')), 'posts outside the window are not re-read');
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('a metrics tick writes one document, survives every source failing, and computes deltas', async () => {
  const store = memoryStore({ [`dispatch/state/metrics/${new Date(T0 - DAY).toISOString().slice(0, 10)}`]: { day: 'prev', play: { installs7d: 4 }, followers: { bluesky: 10 } } });
  const publishers = { bluesky: { profile: async () => ({ followers: 14 }) }, mastodon: { profile: async () => { throw new Error('down'); } } };
  const doc = await metricsTick({ store, secrets: {}, publishers, now: T0, fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'x' }) });
  assert.equal(doc.followers.bluesky, 14);
  assert.equal(doc.followers.mastodon, null, 'a network that failed is null, never 0');
  assert.equal(doc.play, null, 'no service account means no play data, not fake data');
  assert.equal(doc.deltas.followers.bluesky, 4);
  assert.ok(await store.get(`dispatch/state/metrics/${new Date(T0).toISOString().slice(0, 10)}`));
});

/* ─────────────────────────────────────────────────────────────── optimize */


/* ─────────────────────────────────────────────────────────────── optimize */

test('beta samples stay in range and favour the arm with more wins', () => {
  for (let i = 0; i < 200; i++) {
    const x = betaSample(3, 5);
    assert.ok(x > 0 && x < 1, `beta out of range: ${x}`);
  }
  let winnerAhead = 0;
  for (let i = 0; i < 400; i++) if (betaSample(30, 3) > betaSample(3, 30)) winnerAhead++;
  assert.ok(winnerAhead > 380, `the better arm should nearly always draw higher, got ${winnerAhead}/400`);
});


/* ──────────────────────────────────────────────────────────────── reviews */

test('a Play review normalises, and 1-3 stars are never answered by the machine', () => {
  const raw = { reviewId: 'r1', authorName: 'Sam', comments: [{ userComment: { text: 'Great physics', starRating: 5, lastModified: { seconds: 1756800000 }, appVersionName: '1.2.1', device: 'pixel' } }] };
  const r = normalizeReview(raw);
  assert.equal(r.stars, 5);
  assert.equal(r.appVersion, '1.2.1');
  assert.equal(r.answered, false);
  const on = { reviews: { autoReply: true } };
  assert.equal(mayAutoReply(r, on), true);
  assert.equal(mayAutoReply({ ...r, stars: 3 }, on), false, 'three stars is a person telling you something');
  assert.equal(mayAutoReply({ ...r, stars: 1 }, on), false);
  assert.equal(mayAutoReply(r, { reviews: { autoReply: false } }), false);
  assert.equal(mayAutoReply({ ...r, answered: true }, on), false);
  assert.equal(normalizeReview({ reviewId: 'x', comments: [] }), null);
});

test('a reply over Play\'s limit is refused before the call, because a rejection is silent', async () => {
  await assert.rejects(
    () => replyToReview({ sa: {}, packageName: 'p', reviewId: 'r', replyText: 'x'.repeat(REPLY_LIMIT + 1) }),
    /rejects over 350/,
  );
});

test('a review tick drafts for everything and sends only what the rule allows', async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'g@h', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const replied = [];
  const fetchImpl = async (url, init) => {
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    if (url.includes('/reviews?')) return { ok: true, json: async () => ({ reviews: [
      { reviewId: 'good', authorName: 'A', comments: [{ userComment: { text: 'The grade labels are the best part', starRating: 5, lastModified: { seconds: 1756800000 } } }] },
      { reviewId: 'bad', authorName: 'B', comments: [{ userComment: { text: 'The Slate crashed on the NHL tab twice', starRating: 2, lastModified: { seconds: 1756800000 } } }] },
    ] }) };
    if (url.includes(':reply')) { replied.push(JSON.parse(init.body).replyText); return { ok: true, json: async () => ({}) }; }
    if (url.includes('api.anthropic.com')) return { ok: true, json: async () => ({ content: [{ text: 'Thanks for saying so. The grade labels took longer than anything else in the app.' }] }) };
    return { ok: false, status: 404, text: async () => 'x' };
  };
  const store = memoryStore();
  const settings = { reviews: { enabled: true, autoReply: true }, llm: {}, dryRun: false };
  const out = await reviewsTick({ store, sa, secrets: { ANTHROPIC_API_KEY: 'k' }, settings, now: T0, fetchImpl });
  assert.equal(out.sent.length, 1, 'only the five-star review is answered by the machine');
  assert.equal(replied.length, 1);
  const docs = (await store.list('dispatch/state/reviews/')).map((d) => d.data);
  const two = docs.find((d) => d.stars === 2);
  assert.equal(two.status, 'drafted', 'the two-star review is drafted and handed to a human');
  assert.ok(two.draft.length > 0);
  // A second run must not answer the same review twice.
  const again = await reviewsTick({ store, sa, secrets: { ANTHROPIC_API_KEY: 'k' }, settings, now: T0 + 60_000, fetchImpl });
  assert.equal(again.sent.length, 0);
  assert.equal(replied.length, 1);
});

/* ──────────────────────────────────────────────────────────────── content */


/* ───────────────────────────────────────────────────────────────── digest */

test('signed links are per action, per id, per day, and compared without leaking timing', () => {
  const t = sign('k', 'approve', 'E1', '2026-09-03');
  assert.equal(verify('k', 'approve', 'E1', '2026-09-03', t), true);
  assert.equal(verify('k', 'skip', 'E1', '2026-09-03', t), false);
  assert.equal(verify('k', 'approve', 'E2', '2026-09-03', t), false);
  assert.equal(verify('k', 'approve', 'E1', '2026-09-04', t), false);
  assert.equal(verify('other', 'approve', 'E1', '2026-09-03', t), false);
  assert.equal(verify('k', 'approve', 'E1', '2026-09-03', 'short'), false, 'a wrong-length token must not throw');
});


test('settings merge key by key, so setting one nested field does not erase its sibling', async () => {
  const { loadSettings, DEFAULT_SETTINGS } = await import('../dispatch/store.js');
  const store = memoryStore({ 'dispatch/settings': { enabled: true, reviews: { enabled: true }, networks: { x: false } } });
  const s = await loadSettings(store);
  assert.equal(s.reviews.enabled, true);
  assert.equal(s.reviews.autoReply, false, 'the sibling keeps its default rather than becoming undefined');
  assert.equal(s.networks.x, false);
  assert.equal(s.networks.bluesky, true);
  assert.equal(s.maxPerDay.x, DEFAULT_SETTINGS.maxPerDay.x, 'an untouched nested budget keeps its default');
  assert.equal(s.dryRun, true, 'dry run stays on unless it is explicitly turned off');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * THREADS TOKEN LIFECYCLE
 *
 * The failure this guards against is silent and two months out: a long-lived
 * Threads token dies at 60 days and cannot be revived. Every branch below is a
 * step on the path between "freshly seeded" and "permanently dead".
 * ────────────────────────────────────────────────────────────────────────── */

import { resolveThreadsToken, tokenAgeDays, REFRESH_AFTER_DAYS, WARN_AFTER_DAYS } from '../dispatch/threadsToken.js';

const THSEC = { THREADS_USER_ID: '17841400000000000', THREADS_TOKEN: 'SEED_TOKEN' };
const daysAgo = (n, from) => new Date(from - n * DAY).toISOString();

test('threads token: first run seeds from the secret and records the date', async () => {
  const store = memoryStore();
  const now = new Date(T0);
  const r = await resolveThreadsToken({ store, secrets: THSEC, now, fetchImpl: async () => { throw new Error('must not call'); } });
  assert.equal(r.token, 'SEED_TOKEN');
  assert.equal(r.refreshed, false);
  const rec = await store.get('dispatch/tokens');
  assert.equal(rec.threads.token, 'SEED_TOKEN');
  assert.equal(rec.threads.seeded, true);
});

test('threads token: a young token is used as-is and never spends a refresh', async () => {
  const now = new Date(T0);
  const store = memoryStore({ 'dispatch/tokens': { threads: { token: 'LIVE', refreshedAt: daysAgo(3, T0) } } });
  let called = 0;
  const r = await resolveThreadsToken({ store, secrets: THSEC, now, fetchImpl: async () => { called += 1; } });
  assert.equal(called, 0, 'refreshing a 3-day-old token wastes a call and buys nothing');
  assert.equal(r.token, 'LIVE');
  assert.ok(r.age > 2.9 && r.age < 3.1);
});

test('threads token: past the refresh age it rotates and persists the new token', async () => {
  const now = new Date(T0);
  const store = memoryStore({ 'dispatch/tokens': { threads: { token: 'OLD', refreshedAt: daysAgo(REFRESH_AFTER_DAYS + 1, T0) } } });
  const seen = [];
  const r = await resolveThreadsToken({
    store, secrets: THSEC, now,
    fetchImpl: async (url) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => ({ access_token: 'FRESH', expires_in: 5183944 }) };
    },
  });
  assert.equal(r.refreshed, true);
  assert.equal(r.token, 'FRESH');
  assert.match(seen[0], /graph\.threads\.com\/refresh_access_token/);
  assert.match(seen[0], /grant_type=th_refresh_token/);
  assert.match(seen[0], /access_token=OLD/);
  const rec = await store.get('dispatch/tokens');
  assert.equal(rec.threads.token, 'FRESH', 'the rotated token must outlive this process');
  assert.equal(rec.threads.seeded, false);
});

test('threads token: a failed refresh keeps posting on the old token, quietly, until 45 days', async () => {
  const now = new Date(T0);
  const store = memoryStore({ 'dispatch/tokens': { threads: { token: 'OLD', refreshedAt: daysAgo(30, T0) } } });
  const r = await resolveThreadsToken({
    store, secrets: THSEC, now,
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error_message: 'upstream' }) }),
  });
  assert.equal(r.token, 'OLD', 'a rotation failure must not take the network down — the token has 30 days left');
  assert.equal(r.refreshed, false);
  assert.equal(r.warn, null, 'no alarm at 30 days; there is plenty of runway');
});

test('threads token: past the warning age a failed refresh raises it into the digest', async () => {
  const now = new Date(T0);
  const store = memoryStore({ 'dispatch/tokens': { threads: { token: 'OLD', refreshedAt: daysAgo(WARN_AFTER_DAYS + 2, T0) } } });
  const r = await resolveThreadsToken({
    store, secrets: THSEC, now,
    fetchImpl: async () => { throw new Error('network down'); },
  });
  assert.equal(r.token, 'OLD');
  assert.ok(r.warn && /cannot be recovered/.test(r.warn), 'the owner has to hear about this before day 60');
});

test('threads token: no credentials means no token and no writes', async () => {
  const store = memoryStore();
  const r = await resolveThreadsToken({ store, secrets: {}, now: new Date(T0), fetchImpl: async () => { throw new Error('must not call'); } });
  assert.equal(r.token, null);
  assert.equal(await store.get('dispatch/tokens'), null);
});

test('threads token: age is measured in days from the recorded refresh', () => {
  assert.equal(tokenAgeDays(null, new Date(T0)), null);
  assert.equal(tokenAgeDays({ refreshedAt: daysAgo(10, T0) }, new Date(T0)), 10);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * X SPEND METER
 *
 * X is the only network that bills per request, and it charges 13x more for a
 * post carrying a link — which every linked reply does. The cap existed in the
 * settings document for weeks while nothing read it; these tests are what make
 * it real.
 * ────────────────────────────────────────────────────────────────────────── */

import { costOf, reserve as reserveX, spendStatus, monthKey, X_RATES } from '../dispatch/xspend.js';

const NOW = new Date('2026-09-06T12:00:00Z');

test('x spend: a link is the expensive case, and it is the normal case', () => {
  assert.equal(costOf('Sputnik 1 reached orbit 69 years ago today.'), X_RATES.post);
  assert.equal(costOf('Titans 16, Lions 15. https://getscorebug.app/history'), X_RATES.postWithUrl);
  assert.equal(costOf('with a card https://getscorebug.app/x', true),
    Number((X_RATES.postWithUrl + X_RATES.mediaMetadata).toFixed(3)));
});

test('x spend: reserving charges before the send, not after', async () => {
  const store = memoryStore();
  const r = await reserveX({ store, text: 'link https://x.example', hasMedia: true, settings: { xMonthlyCapUsd: 15 }, now: NOW });
  assert.equal(r.allowed, true);
  const rec = await store.get(`dispatch/state/xspend/${monthKey(NOW)}`);
  assert.equal(rec.spentUsd, 0.205, 'the ledger moves before the network call, so a crash cannot buy a free post');
  assert.equal(rec.posts, 1);
});

test('x spend: the cap refuses the post that would cross it, not the one after', async () => {
  const key = monthKey(NOW);
  const store = memoryStore({ [`dispatch/state/xspend/${key}`]: { month: key, spentUsd: 0.9, posts: 5 } });
  const r = await reserveX({ store, text: 'link https://x.example', settings: { xMonthlyCapUsd: 1 }, now: NOW });
  assert.equal(r.allowed, false, '0.90 + 0.20 exceeds 1.00, so this one must not go');
  assert.match(r.reason, /cap reached/);
  const rec = await store.get(`dispatch/state/xspend/${key}`);
  assert.equal(rec.spentUsd, 0.9, 'a refused post must not move the meter');
});

test('x spend: a zero cap means no X spend at all', async () => {
  const r = await reserveX({ store: memoryStore(), text: 'anything', settings: { xMonthlyCapUsd: 0 }, now: NOW });
  assert.equal(r.allowed, false);
});

test('x spend: the meter resets with the month, on the Mountain clock', async () => {
  const store = memoryStore();
  // 30 Sep 23:00Z is 17:00 MDT on the 30th; 1 Oct 01:00Z is 19:00 MDT, still
  // the 30th. Both are September, and both must draw on September's allowance.
  // On the old UTC month key the second one silently opened October's — in the
  // middle of the evening window where finals actually land.
  await reserveX({ store, text: 'a https://x.example', settings: { xMonthlyCapUsd: 15 }, now: new Date('2026-09-30T23:00:00Z') });
  const stillSept = await spendStatus({ store, settings: { xMonthlyCapUsd: 15 }, now: new Date('2026-10-01T01:00:00Z') });
  assert.equal(stillSept.spent, 0.2, 'the last evening of the month is still that month');

  const oct = await spendStatus({ store, settings: { xMonthlyCapUsd: 15 }, now: new Date('2026-10-01T12:00:00Z') });
  assert.equal(oct.spent, 0, 'October must not inherit September');
  assert.equal(oct.remaining, 15);
});

test('x spend: status reports the month honestly for the digest', async () => {
  const store = memoryStore();
  for (let i = 0; i < 3; i += 1) await reserveX({ store, text: 'a https://x.example', settings: { xMonthlyCapUsd: 15 }, now: NOW });
  const st = await spendStatus({ store, settings: { xMonthlyCapUsd: 15 }, now: NOW });
  assert.equal(st.posts, 3);
  assert.equal(st.spent, 0.6);
  assert.equal(st.remaining, 14.4);
  assert.equal(st.exhausted, false);
});


test('x spend: the reply is billed too — pricing only the main post undercounts by ~13x', async () => {
  const store = memoryStore();
  const r = await reserveX({
    store,
    text: 'Sputnik 1 reached orbit 69 years ago today.',        // no URL  → $0.015
    reply: 'Free on Google Play: https://play.google.com/x',    // has URL → $0.200
    settings: { xMonthlyCapUsd: 15 },
    now: NOW,
  });
  assert.equal(r.cost, 0.215, 'both requests, charged together, before either is sent');
  const rec = await store.get(`dispatch/state/xspend/${monthKey(NOW)}`);
  assert.equal(rec.spentUsd, 0.215);
});

test('x spend: the cap accounts for the reply, so it cannot be overrun by 13x', async () => {
  const key = monthKey(NOW);
  const store = memoryStore({ [`dispatch/state/xspend/${key}`]: { month: key, spentUsd: 14.9, posts: 70 } });
  const r = await reserveX({
    store, text: 'no link here', reply: 'link https://x.example',
    settings: { xMonthlyCapUsd: 15 }, now: NOW,
  });
  assert.equal(r.allowed, false, '14.90 + 0.215 crosses 15.00 — metering the reply is what catches this');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * DISCOVERY TAGS
 *
 * Four networks, four different answers about what a tag is for. The one that
 * needs guarding hardest is Bluesky, where a hashtag without a facet is a grey
 * string that nothing indexes — a failure with no error and no symptom.
 * ────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────── facets and oauth */

test('Bluesky link facets are UTF-8 byte offsets', () => {
  const text = 'Montréal wins it. https://getscorebug.app/leagues/nhl';
  const [f] = linkFacets(text);
  assert.equal(f.index.byteStart, Buffer.byteLength('Montréal wins it. '));
  assert.equal(f.index.byteEnd, Buffer.byteLength(text));
  assert.equal(f.features[0].uri, 'https://getscorebug.app/leagues/nhl');
});

test('OAuth 1.0a signature matches the published Twitter example', () => {
  // https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature
  const h = oauth1Header({
    method: 'POST', url: 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true',
    consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', timestamp: 1318622958,
    extraParams: { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
  });
  assert.ok(h.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'), h);
});


test('publisher request shapes: bluesky createRecord and mastodon statuses', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push([url, init]);
    if (url.endsWith('createSession')) return { ok: true, text: async () => JSON.stringify({ accessJwt: 'j', did: 'did:plc:1', handle: 'getscorebug.bsky.social' }) };
    if (url.endsWith('createRecord')) return { ok: true, text: async () => JSON.stringify({ uri: 'at://did:plc:1/app.bsky.feed.post/abc', cid: 'c' }) };
    if (url.endsWith('/api/v1/statuses')) return { ok: true, text: async () => JSON.stringify({ id: '9', url: 'https://mastodon.social/@getscorebug/9' }) };
    return { ok: false, status: 500, text: async () => 'x' };
  };
  const b = bluesky({ handle: 'getscorebug.bsky.social', appPassword: 'p', fetchImpl });
  const r = await b.post('hello https://getscorebug.app');
  assert.equal(r.url, 'https://bsky.app/profile/getscorebug.bsky.social/post/abc');
  const rec = JSON.parse(seen[1][1].body).record;
  assert.equal(rec.facets.length, 1);
  const m = mastodon({ base: 'https://mastodon.social/', token: 't', fetchImpl });
  const mr = await m.post('hi', { idempotency: 'k1' });
  assert.equal(mr.url, 'https://mastodon.social/@getscorebug/9');
  assert.equal(seen[2][1].headers['idempotency-key'], 'k1');
});


test('bluesky facets: a hashtag without a facet reaches nobody, so every tag gets one', () => {
  const text = 'Sputnik 1 reached orbit.\n\n#SpaceHistory #OnThisDay';
  const f = tagFacets(text);
  assert.equal(f.length, 2);
  assert.equal(f[0].features[0].$type, 'app.bsky.richtext.facet#tag');
  assert.equal(f[0].features[0].tag, 'SpaceHistory', 'the lexicon says the reference carries no leading #');
  // The offsets must be UTF-8 BYTES, not characters, or every facet after a
  // non-ASCII character points at the wrong span.
  const bytes = new TextEncoder().encode(text);
  const slice = new TextDecoder().decode(bytes.slice(f[0].index.byteStart, f[0].index.byteEnd));
  assert.equal(slice, '#SpaceHistory');
});

test('bluesky facets: byte offsets survive non-ASCII text', () => {
  const text = 'Solar eclipse — totality lasts 4m 28s.\n\n#Eclipse';
  const f = tagFacets(text);
  const bytes = new TextEncoder().encode(text);
  assert.equal(new TextDecoder().decode(bytes.slice(f[0].index.byteStart, f[0].index.byteEnd)), '#Eclipse',
    'the em dash is three bytes and one character; getting this wrong shifts every later facet');
});

test('bluesky facets: links and tags coexist and stay in document order', () => {
  const text = 'A post. https://getscorebug.app/x\n\n#NHL';
  const all = [...linkFacets(text), ...tagFacets(text)].sort((a, b) => a.index.byteStart - b.index.byteStart);
  assert.equal(all.length, 2);
  assert.equal(all[0].features[0].$type, 'app.bsky.richtext.facet#link');
  assert.equal(all[1].features[0].$type, 'app.bsky.richtext.facet#tag');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * CLIP PACING
 *
 * The queue is a backlog, not an outbox. Nine clips at one-per-tick would be
 * nine posts in ninety minutes, which is what an account looks like just before
 * people mute it.
 * ────────────────────────────────────────────────────────────────────────── */

import { readFile as readSourceFile } from 'node:fs/promises';
import { fileURLToPath as toPath } from 'node:url';
import { dirname as dirOf, join as joinPath } from 'node:path';

const FUNCTIONS_ROOT = joinPath(dirOf(toPath(import.meta.url)), '..');

/** Static `import ... from 'x'` only — a dynamic import() inside a function is the fix, not the fault. */
const staticImports = (src) =>
  [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

test('discovery: no entry point statically imports a heavy SDK', async () => {
  const banned = [
    ['firebase-admin/firestore', 'measured at 14s on its own'],
    ['firebase-admin/storage', 'only the ops endpoint needs it'],
    ['firebase-functions', 'the root barrel drags in v1, v2 and every trigger type'],
  ];
  for (const file of ['index.js', 'dispatch/index.js']) {
    const src = await readSourceFile(joinPath(FUNCTIONS_ROOT, file), 'utf8');
    const imports = staticImports(src);
    for (const [mod, why] of banned) {
      assert.ok(!imports.includes(mod),
        `${file} statically imports '${mod}' — ${why}. Load it inside the handler instead.`);
    }
  }
});

test('discovery: the dispatch module graph itself stays cheap', async () => {
  // Our own code was never the problem — 15ms for draft, 9ms for publish, 74ms
  // for run. This guards against someone "helpfully" hoisting an SDK into one.
  for (const file of ['dispatch/draft.js', 'dispatch/run.js', 'dispatch/publish.js', 'dispatch/tags.js']) {
    const src = await readSourceFile(joinPath(FUNCTIONS_ROOT, file), 'utf8');
    for (const mod of staticImports(src)) {
      assert.ok(!mod.startsWith('firebase-'),
        `${file} imports '${mod}' — the drafting and publishing code must stay free of the SDK`);
    }
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
 * BLUESKY IDENTITY
 *
 * A handle is rented and a DID is owned. Taking the domain @getscorebug.space
 * changed how the profile is addressed publicly WITHOUT the PDS accepting the
 * new name as a login identifier — verified live: the DID authenticates, the
 * new handle returns 401, and the PDS still reports the old one.
 * ────────────────────────────────────────────────────────────────────────── */
import { bluesky as blueskyPublisher } from '../dispatch/publish.js';

test('bluesky identity: the posted URL uses the branded handle, not the session one', async () => {
  // The publisher parses res.text(), so a stub must supply a real body.
  const reply = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload), json: async () => payload });
  const fake = async (url) => (String(url).includes('createSession')
    // What the PDS actually returns today: the OLD handle, because taking the
    // domain did not change the account's canonical name.
    ? reply({ did: 'did:plc:test', accessJwt: 'j', handle: 'getscorebug.bsky.social', didDoc: {} })
    : reply({ uri: 'at://did:plc:test/app.bsky.feed.post/abc123', cid: 'c' }));

  const p = blueskyPublisher({ handle: 'did:plc:test', appPassword: 'x', displayHandle: 'getscorebug.app', fetchImpl: fake });
  const out = await p.post('A post.');
  assert.equal(out.url, 'https://bsky.app/profile/getscorebug.app/post/abc123',
    'deriving the URL from the session would print the borrowed .bsky.social address');
  assert.equal(out.uri, 'at://did:plc:test/app.bsky.feed.post/abc123');
});

test('bluesky identity: without a display handle it falls back to the session', async () => {
  const reply = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload), json: async () => payload });
  const fake = async (url) => (String(url).includes('createSession')
    ? reply({ did: 'did:plc:test', accessJwt: 'j', handle: 'someone.bsky.social', didDoc: {} })
    : reply({ uri: 'at://did:plc:test/app.bsky.feed.post/zzz', cid: 'c' }));
  const p = blueskyPublisher({ handle: 'did:plc:test', appPassword: 'x', fetchImpl: fake });
  assert.match((await p.post('A post.')).url, /profile\/someone\.bsky\.social\/post\/zzz$/);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * THE SILENT STALL
 *
 * Both of these shipped as "autopilot is on" while the posts they cover queued
 * for approval and never went out. Neither raised an error, and the health
 * block reported four live networks throughout — which is the failure mode
 * worth the most tests: the machine says it is working and is not.
 * ────────────────────────────────────────────────────────────────────────── */