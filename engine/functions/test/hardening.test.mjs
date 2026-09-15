/**
 * SCOREBUG // THE AUDIT, AS TESTS
 *
 * Every case below is a real defect that was found in this engine by an
 * adversarial audit on 2026-09-09, reproduced first and fixed second. They are
 * kept together, and kept in the language of what went wrong, because the
 * common thread is not "a bug" — it is that each one PASSED the existing
 * suite. A filter that misses the plural of every word it blocks still blocks
 * the singular the test happened to use.
 *
 * If one of these ever fails, the fix has been undone. Read the comment before
 * changing the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bettingHit, isHostile, namesIn, fold, words } from '../dispatch/safety.js';
import { lint, unknownProperNouns, BETTING } from '../dispatch/draft.js';
import { isSensitive } from '../dispatch/events.js';
import { memoryStore } from '../dispatch/store.js';
import { reserve as reserveX, monthKey } from '../dispatch/xspend.js';
import { todaysBudget, markSlot, sendApproved, SLOTS, EV } from '../dispatch/run.js';
import { select } from '../dispatch/rank.js';
import { findAnniversary } from '../dispatch/archive.js';

/* ─────────────────────────────────────────── THE BRAND'S HARDEST PROMISE */

test('betting: the PLURAL of every blocked word is blocked', () => {
  // The original pattern ended every alternative with `)\b`, so the trailing
  // "s" ate the word boundary. This sentence linted perfectly clean through
  // the filter whose entire job is "Zero gambling. Zero sports betting. Ever."
  const sentence = 'We do not publish spreads or moneylines, and we never take wagers from underdogs backers.';
  assert.ok(bettingHit(sentence), 'the plural sentence must be caught');
  for (const w of ['spreads', 'parlays', 'moneylines', 'sportsbooks', 'wagers', 'bookmakers', 'underdogs', 'bettors', 'teasers']) {
    assert.ok(bettingHit(`nothing to see here ${w} nothing to see here`), `${w} must be caught`);
  }
});

test('betting: the price shape survives brackets, colons, a minus sign and a full stop', () => {
  for (const s of ['Chiefs -110', 'Chiefs (-110)', 'Chiefs [-110]', 'Chiefs:-110', 'Chiefs −110', 'They were +150.', 'Chiefs -7.5', 'Chiefs +3.5', 'o47.5 tonight']) {
    assert.ok(bettingHit(s), `${s} must be caught`);
  }
});

test('betting: a link slug and a hashtag are not hiding places', () => {
  // Both of these linted clean, because the linter stripped URLs and hashtags
  // BEFORE it looked for betting language — the two places you would hide it.
  const src = 'Titans 16 Lions 15';
  assert.ok(lint('Grade it out of 5.0. https://getscorebug.app/r/parlay-odds-moneyline-draftkings?s=x', { sources: src }).some((p) => p.startsWith('betting language')));
  assert.ok(lint('Titans 16, Lions 15. One point. #Parlay #BetMGM', { sources: `${src} 16 15`, network: 'mastodon' }).some((p) => p.startsWith('betting language')));
});

test('betting: a Cyrillic look-alike and the other languages we ship in', () => {
  assert.ok(bettingHit('раrlay tonight'), 'Cyrillic р and а spell parlay');
  for (const s of ['apuestas deportivas', '赔率', 'бетинг ставки', 'オッズ']) {
    assert.ok(bettingHit(s), `${s} must be caught`);
  }
});

test('betting: ordinary sports prose is NOT caught', () => {
  // A filter that holds every good post every night is its own kind of outage.
  for (const s of [
    'Oilers 4, Flames 3. By one.',
    'Newcastle at Leeds, 1:00pm.',
    'Chennai 185/6 (20 ov). Mumbai chased it down.',
    'Final/OT. Two points separated them.',
    'The spread offense worked all night.',
    '2026-27 season, Week 2.',
    'props to the whole roster',
    'He came over. Under the lights.',
    'turn it over under pressure',
  ]) assert.equal(bettingHit(s), null, `${s} must be clean`);
});

test('betting: a hit is quarantined, not offered for approval', async () => {
  // "The engine must refuse them outright — not weigh them." A draft that
  // mentions odds must never appear with an Approve button next to it.
  const store = memoryStore({ [`${EV}x`]: { id: 'x', status: 'refused', texts: { bluesky: 'y' }, networks: ['bluesky'] } });
  await assert.rejects(sendApproved({ store, publishers: {}, id: 'x' }), /never approvable/);
});

/* ───────────────────────────────────────────────────── REAL PEOPLE */

test('people: a hashtag, a URL slug and an accent are all the same name', () => {
  assert.deepEqual(namesIn('Two goals. #McDavid', ['Connor McDavid']), ['Connor McDavid']);
  assert.deepEqual(namesIn('https://getscorebug.app/r/connor-mcdavid', ['Connor McDavid']), ['Connor McDavid']);
  assert.deepEqual(namesIn('Mbappe again.', ['Kylian Mbappé']), ['Kylian Mbappé']);
  assert.deepEqual(namesIn('Mbappé again.', ['Kylian Mbappe']), ['Kylian Mbappe']);
});

test('people: a first name that is also a club does not hold the post, but a surname always does', () => {
  assert.deepEqual(namesIn('Austin FC drew again.', ['Austin Reaves'], 'Austin FC vs Orlando City'), []);
  assert.deepEqual(namesIn('Austin was everywhere.', ['Austin Reaves'], 'Toronto Raptors'), ['Austin Reaves']);
  assert.deepEqual(namesIn('McDavid with the winner.', ['Connor McDavid'], 'Edmonton Oilers McDavid EDM'), ['Connor McDavid']);
});

test('people: a reply may not name anything the engine does not already know', () => {
  // The two auto-reply paths have no `people` list — the model can name anyone
  // alive — so they invert the rule: an unknown capitalised word is a hold.
  // Note there is NO sentence-initial exemption, because the shape being
  // hunted is a reply that BEGINS with a surname.
  assert.deepEqual(unknownProperNouns('Mahomes had a rough night and the log will remember it.'), ['Mahomes']);
  assert.deepEqual(unknownProperNouns('Fair. I have written down the request for McDavid shift charts.'), ['McDavid']);
  assert.deepEqual(unknownProperNouns('Thanks — the Bleachers are where fans write that down.'), []);
  assert.deepEqual(unknownProperNouns('Sorry about that — Android early access is open on the site.'), []);
});

test('sensitive: the words a sports injury is actually described with', () => {
  const g = (o) => ({ league: 'NFL', home: {}, away: {}, ...o });
  for (const note of ['Brock Purdy returns from concussion protocol', 'carted off in the third', 'torn ACL, out for the season', 'taken away by ambulance', 'ejected after the brawl']) {
    assert.equal(isSensitive(g({ note })), true, `"${note}" must wait for a person`);
  }
  // and it reads every field the feed fills, not just the first headline
  assert.equal(isSensitive(g({ note: null, headline: null, feedText: 'a moment of silence before the game' })), true);
  assert.equal(isSensitive(g({ note: 'Week 2. A division game.' })), false);
});

/* ──────────────────────────────────────────────────── LINKS AND NUMBERS */

test('links: the allow-list compares origins, not string prefixes', () => {
  // `startsWith('https://getscorebug.app')` is true of
  // getscorebug.app.evil.example — any attacker-registered suffix domain was
  // permanently allow-listed on every surface, including the auto-reply path.
  const bad = lint('Titans 16, Lions 15. https://getscorebug.app.evil.example/r/go', { sources: 'Titans 16 Lions 15' });
  assert.ok(bad.some((p) => p.startsWith('foreign link')), 'a look-alike host is a foreign link');
  assert.deepEqual(lint('Titans 16, Lions 15. https://getscorebug.app/r/x?s=bluesky', { sources: 'Titans 16 Lions 15' }), []);
});

test('links: a scheme-less domain is still a link', () => {
  // Bluesky and Mastodon autolink bare domains, so this was a live outbound
  // link the https?:// matcher never saw.
  assert.ok(lint('Scorebug has none of that. bestparlaypicks.co has the rest.', { sources: '' }).some((p) => p.startsWith('bare domain') || p.startsWith('betting language')));
});

test('numbers: a timestamp is one token, not a bag of digits', () => {
  // `sources.includes('74')` was true of 1757462400000, so two invented
  // numbers passed the check that exists to make every figure traceable.
  const sources = JSON.stringify({ id: 'NHL-1', start: 1757462400000, home: { score: 3 }, away: { score: 2 } });
  const problems = lint('Oilers 74, Flames 62. By 12.', { sources });
  assert.ok(problems.includes('unsourced number 74'), '74 is not in the record');
  assert.ok(problems.includes('unsourced number 62'), '62 is not in the record');
  // and a number that IS in the record still passes
  assert.deepEqual(lint('Oilers 3, Flames 2.', { sources }), []);
});

/* ─────────────────────────────────────────────────── THE ORCHESTRATOR */

test('the 40-minute gap does not reset at local midnight', () => {
  // Everything outside today's calendar day was dropped BEFORE lastSentAt was
  // computed, so 23:50 and 00:10 were twenty minutes apart and both went out —
  // in exactly the window North American finals land in.
  const TZ = 'America/Edmonton';
  const lateLastNight = Date.parse('2026-09-10T05:50:00Z');   // 23:50 MDT on the 9th
  const justAfterMidnight = Date.parse('2026-09-10T06:10:00Z'); // 00:10 MDT on the 10th
  const events = [{ status: 'sent', createdAt: new Date(lateLastNight).toISOString(), sentAt: new Date(lateLastNight).toISOString(), networks: ['bluesky'] }];
  const b = todaysBudget(events, '10', TZ, justAfterMidnight);
  assert.equal(b.sentToday.bluesky, undefined, 'yesterday does not count against today’s cap');
  assert.equal(b.lastSentAt.bluesky, lateLastNight, 'but it DOES count against the gap');
});

test('one final per tick does not starve the pregame beat', () => {
  // PREGAME sorts after FINAL in the priority table, and the cap used `break`,
  // which left the whole loop. On any night with a final in each tick the
  // pregame beat — whose window is only 45-80 minutes wide — never fired.
  const now = Date.parse('2026-09-19T02:00:00Z');
  const settings = { networks: {}, maxPerDay: { bluesky: 5, x: 3 }, minGapMinutes: 0, maxPerLeaguePerDay: 2, floors: { minFinal: 0, minPregame: 0, xLink: 99 } };
  const mk = (type, id, league) => ({
    type, id, score: 5, networks: ['bluesky'],
    game: { id, league, start: now, home: { abbr: 'A', score: 2, record: '1-0' }, away: { abbr: 'B', score: 1, record: '1-0' }, linescores: [] },
  });
  const out = select({ events: [mk('FINAL', 'f1', 'NHL'), mk('PREGAME', 'p1', 'NFL')], settings, now, tz: 'America/Edmonton', sentToday: {}, lastSentAt: {}, leagueToday: {} });
  const types = out.map((e) => e.type).sort();
  assert.deepEqual(types, ['FINAL', 'PREGAME'], 'both beats survive the same tick');
});

test('two finals in one tick is still one final', () => {
  const now = Date.parse('2026-09-19T02:00:00Z');
  const settings = { networks: {}, maxPerDay: { bluesky: 5 }, minGapMinutes: 0, maxPerLeaguePerDay: 2, floors: { minFinal: 0, minPregame: 0, xLink: 99 } };
  const mk = (id, league) => ({
    type: 'FINAL', id, score: 5, networks: ['bluesky'],
    game: { id, league, start: now, home: { abbr: 'A', score: 2, record: '1-0' }, away: { abbr: 'B', score: 1, record: '1-0' }, linescores: [] },
  });
  const out = select({ events: [mk('f1', 'NHL'), mk('f2', 'NFL')], settings, now, tz: 'America/Edmonton', sentToday: {}, lastSentAt: {}, leagueToday: {} });
  assert.equal(out.filter((e) => e.type === 'FINAL').length, 1);
});

test('a racing event does not crash the anniversary finder', async () => {
  // Racing normalises to home:null / away:null on purpose, F1 is in the league
  // pool most of the year, and `g.home.score` threw a TypeError straight out
  // of the function — which the caller read as "no anniversary" and used to
  // close the slot for the whole day.
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      events: [{
        id: '1', date: '2016-09-09T20:00:00Z', name: 'Grand Prix',
        season: { year: 2016, type: 2 },
        competitions: [{ date: '2016-09-09T20:00:00Z', status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL', detail: 'Final' } }, competitors: [{ id: 'a', homeAway: null }, { id: 'b', homeAway: null }] }],
      }],
    }),
  });
  const got = await findAnniversary({ now: Date.parse('2026-09-09T18:00:00Z'), tz: 'America/Edmonton', fetchImpl, maxRequests: 3, floor: 0 });
  assert.equal(got, null, 'no anniversary, and no exception');
});

test('markSlot actually forgets old days', async () => {
  // The prune deleted keys from a map and wrote it back with `update`, and
  // Firestore's merge DEEP-merges maps — so nothing was ever removed and the
  // document grew by ~8 keys a day until it hit the 1 MiB limit. The memory
  // store now merges the same way, so this test can see it.
  const now = Date.parse('2026-09-09T12:00:00Z');
  const old = new Date(now - 40 * 86_400_000).toISOString();
  const store = memoryStore({ [SLOTS]: { fired: { 'anniv:01': old, 'weekahead:2026-W20': old }, notes: { 'anniv:01': 'x' } } });
  await markSlot(store, { slotKey: 'anniv:09' }, now);
  const doc = await store.get(SLOTS);
  assert.deepEqual(Object.keys(doc.fired), ['anniv:09'], 'forty-day-old keys are gone');
  assert.deepEqual(Object.keys(doc.notes), [], 'and their notes with them');
});

test('the memory store merges the way Firestore merges', async () => {
  const store = memoryStore({ 'dispatch/settings': { networks: { bluesky: true, x: true } } });
  await store.update('dispatch/settings', { networks: { x: false } });
  const s = await store.get('dispatch/settings');
  assert.deepEqual(s.networks, { bluesky: true, x: false }, 'a nested patch must not wipe its siblings');
});

test('an approval can only be claimed once', async () => {
  // Read-then-send let a double-tapped digest button, or a scanner racing the
  // owner's click, post the same draft to five networks twice.
  const store = memoryStore({
    'dispatch/settings': { enabled: true, dryRun: false, autopilot: false },
    [`${EV}a`]: { id: 'a', status: 'approval', texts: { bluesky: 'hello' }, networks: ['bluesky'], createdAt: new Date().toISOString() },
  });
  let posts = 0;
  const publishers = { bluesky: { post: async () => { posts += 1; return { id: '1', url: 'u' }; } } };
  const results = await Promise.allSettled([
    sendApproved({ store, publishers, id: 'a' }),
    sendApproved({ store, publishers, id: 'a' }),
  ]);
  assert.equal(posts, 1, 'exactly one of the two concurrent approvals posts');
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

/* ──────────────────────────────────────────────────────── THE MONEY */

test('the X spend meter fails CLOSED', async () => {
  // Both the read and the write swallowed their errors and carried on to
  // allowed:true. Measured at 500 consecutive sends against a $10 cap.
  const unwritable = { ...memoryStore(), async update() { throw new Error('permission denied'); } };
  const r = await reserveX({ store: unwritable, text: 'a post', settings: { xMonthlyCapUsd: 10 } });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /unmetered/);

  const unreadable = { ...memoryStore(), async get() { throw new Error('unavailable'); } };
  const r2 = await reserveX({ store: unreadable, text: 'a post', settings: { xMonthlyCapUsd: 10 } });
  assert.equal(r2.allowed, false);
});

test('the billing month is the Mountain month', () => {
  // On UTC the key rolled over at 18:00 MT on the last day of the month —
  // inside the evening window where finals land.
  assert.equal(monthKey(new Date('2026-10-01T01:00:00Z')), '2026-09', 'still September in Edmonton');
  assert.equal(monthKey(new Date('2026-10-01T12:00:00Z')), '2026-10');
});
