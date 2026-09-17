/**
 * CADENIC // THE ASK, AS TESTS
 *
 * This is the only message in the engine sent to somebody who has already had
 * something valuable for free, and the failure modes are about tone and timing
 * rather than accuracy. The three that matter: asking somebody who is already
 * mid-conversation with Wyatt, asking twice, and sounding like every other
 * piece of automated sales mail on the way through.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dueForConversion, leadFinding, lintConversion, convertTick, sendConversion,
  conversionStats, CONVERT_AFTER_DAYS, CONVERT_MAX_WORDS,
} from '../dispatch/convert.js';
import { TEARDOWNS } from '../dispatch/teardown.js';
import { memoryStore } from '../dispatch/store.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const sentDaysAgo = (n) => new Date(NOW - n * DAY).toISOString();

const FOUND = [
  { key: 'presence', cost: 2, numbers: [1240, 96, 8], observation: '1,240 members, 96 present — about 8%.', meaning: 'The room reads as empty.', fix: 'A standing weekly prompt.' },
  { key: 'community', cost: 1, numbers: [], observation: 'Community mode is off.', meaning: 'No welcome screen, no onboarding, no Discovery.', fix: 'Server Settings, then the onboarding flow. An afternoon.' },
];

const teardown = (over = {}) => ({
  id: 't1', email: 'sam@studio.example', name: 'Sam Reyes', company: 'Roundtable',
  status: 'sent', sentAt: sentDaysAgo(6), found: FOUND,
  draft: { subject: 'Your Discord teardown — Roundtable', body: 'x' },
  ...over,
});
const asDocs = (list) => list.map((d, i) => ({ id: d.id || `t${i}`, data: d }));

/* ─────────────────────────────────────────────────── WHO IS DUE */

test('a delivered teardown with no reply becomes due after the interval', () => {
  assert.equal(dueForConversion(asDocs([teardown()]), NOW).length, 1);
  assert.equal(dueForConversion(asDocs([teardown({ sentAt: sentDaysAgo(1) })]), NOW).length, 0, 'one day is not long enough to have read it');
});

test('somebody who has written back is NEVER asked', () => {
  const t = teardown({ repliedAt: sentDaysAgo(2) });
  assert.equal(dueForConversion(asDocs([t]), NOW).length, 0, 'they are already talking to a person; the machine must not talk over him');
});

test('there is only ever one', () => {
  const t = teardown({ convertNote: { subject: 'x', body: 'y' } });
  assert.equal(dueForConversion(asDocs([t]), NOW).length, 0);
});

test('a teardown that was never delivered is not asked about', () => {
  for (const status of ['new', 'inspected', 'drafted', 'blocked', 'skipped']) {
    assert.equal(dueForConversion(asDocs([teardown({ status })]), NOW).length, 0, status);
  }
});

test('a teardown with no findings is not asked about', () => {
  assert.equal(dueForConversion(asDocs([teardown({ found: [] })]), NOW).length, 0, 'a note with nothing specific in it is the thing this pipeline exists to avoid');
});

test('the lead is the cheapest fix, not the first one written', () => {
  assert.equal(leadFinding(teardown()).key, 'community', 'an afternoon that visibly works beats a big job that never starts');
});

/* ────────────────────────────────────────────────── THE LINTER */

const POSTAL = 'Cadenic Studios, 4810 50 Ave Suite 469, Leduc, AB T9E 6X9, Canada';
const GOOD = `Hi Sam — I sent over the teardown for Roundtable a few days ago. No reply needed to this one, and it is the only note you will get from me about it.

The first thing on that list was that Community mode is off. Turning it on gives you the welcome screen, the rules screening and the onboarding questions. It is an afternoon of work.

If you would like me to do that one, I am happy to. You are welcome to hand the document to whoever you already use instead.

What the studio charges is at https://cadenic.studio/services/discord-engineering

Wyatt

Cadenic Studios · ${POSTAL}
hello@cadenic.studio · cadenic.studio
Reply "stop" and you will not hear from me again.`;

const LEAD = FOUND[1];

test('a clean note passes', () => {
  assert.deepEqual(lintConversion(GOOD, LEAD, { postal: POSTAL }), []);
});

test('manufactured urgency is refused', () => {
  for (const line of [
    'I have two spots left this month.',      // the count form a person actually writes
    'This is a limited time offer.',
    'Act now before the prices change.',
    'Spots are filling up.',
    'Only a few slots left.',
    'My calendar is filling for October.',
  ]) {
    assert.match(lintConversion(GOOD.replace('Wyatt\n', `${line}\n\nWyatt\n`), LEAD, { postal: POSTAL }).join(' '), /urgency/, line);
  }
});

test('reproaching them for the silence is refused', () => {
  for (const line of ["I didn't hear back from you.", 'Just checking in on this.', 'Circling back on my last note.', 'Bumping this to the top of your inbox.']) {
    assert.match(lintConversion(GOOD.replace('No reply needed to this one,', `${line}`), LEAD, { postal: POSTAL }).join(' '), /reproaches/, line);
  }
});

test('a price, a promise and a call are each refused', () => {
  assert.match(lintConversion(`${GOOD}\nIt is $400.`, LEAD, { postal: POSTAL }).join(' '), /price/);
  assert.match(lintConversion(GOOD.replace('is an afternoon', 'will double your members and is an afternoon'), LEAD, { postal: POSTAL }).join(' '), /promises a result/);
  assert.match(lintConversion(GOOD.replace('I am happy to.', 'let us book a time.'), LEAD, { postal: POSTAL }).join(' '), /call/);
});

test('a number we never measured is refused', () => {
  assert.match(lintConversion(GOOD.replace('Community mode is off', 'about 340 of your members never return'), LEAD, { postal: POSTAL }).join(' '), /not in the finding/);
});

test('the CASL lines are required', () => {
  assert.match(lintConversion(GOOD.replace('Reply "stop" and you will not hear from me again.', ''), LEAD, { postal: POSTAL }).join(' '), /stop line/);
  assert.match(lintConversion(GOOD.replace(POSTAL, ''), LEAD, { postal: POSTAL }).join(' '), /postal address/);
});

test('the limit is a real limit', () => {
  const long = `${GOOD.split('\n')[0]} ${'word '.repeat(CONVERT_MAX_WORDS + 20)}`;
  assert.match(lintConversion(long, LEAD, { postal: POSTAL }).join(' '), /limit is/);
});

/* ──────────────────────────────────────────────────── THE TICK */

const fakeFetch = (body) => async (url) => {
  if (String(url).includes('api.anthropic.com')) {
    return { ok: true, status: 200, async json() { return { content: [{ text: body }] }; } };
  }
  throw new Error(`unexpected fetch ${url}`);
};

test('the tick drafts for the due one and stamps which finding it leads on', async () => {
  const store = memoryStore({ [TEARDOWNS + 't1']: teardown() });
  const out = await convertTick({
    store, secrets: { ANTHROPIC_API_KEY: 'k', CADENIC_POSTAL: POSTAL },
    now: NOW, fetchImpl: fakeFetch(GOOD),
  });
  assert.equal(out.due, 1);
  assert.equal(out.drafted, 1);
  const t = await store.get(TEARDOWNS + 't1');
  assert.equal(t.convertStatus, 'drafted');
  assert.equal(t.convertNote.leadKey, 'community');
});

test('a note the linter rejects is blocked, not sent', async () => {
  const store = memoryStore({ [TEARDOWNS + 't1']: teardown() });
  const out = await convertTick({
    store, secrets: { ANTHROPIC_API_KEY: 'k', CADENIC_POSTAL: POSTAL },
    now: NOW, fetchImpl: fakeFetch(`${GOOD}\n\nOnly two spots left this month.`),
  });
  assert.equal(out.refused, 1);
  const t = await store.get(TEARDOWNS + 't1');
  assert.equal(t.convertStatus, 'blocked');
  assert.match((t.convertProblems || []).join(' '), /urgency/);
});

test('the tick refuses without a postal address', async () => {
  const store = memoryStore({ [TEARDOWNS + 't1']: teardown() });
  const out = await convertTick({ store, secrets: { ANTHROPIC_API_KEY: 'k' }, now: NOW, fetchImpl: fakeFetch(GOOD) });
  assert.equal(out.drafted, 0);
  assert.equal(out.refused, 1);
});

test('the tick can be switched off', async () => {
  const store = memoryStore({ [TEARDOWNS + 't1']: teardown() });
  const out = await convertTick({ store, settings: { cadenic: { convert: false } }, now: NOW, fetchImpl: fakeFetch(GOOD) });
  assert.equal(out.due, 0);
  assert.match(out.note, /off/);
});

/* ──────────────────────────────────────────────────── THE SEND */

const ready = (over = {}) => memoryStore({
  [TEARDOWNS + 't1']: teardown({
    convertNote: { subject: 'Re: Your Discord teardown — Roundtable', body: GOOD, leadKey: 'community' },
    convertProblems: [], convertStatus: 'drafted', ...over,
  }),
});

test('sending refuses in dry run, without a postal address, and on a rejected draft', async () => {
  const sendEmail = async () => {};
  assert.match((await sendConversion({ store: ready(), id: 't1', secrets: { CADENIC_POSTAL: POSTAL }, settings: { dryRun: true }, sendEmail })).reason, /dry run/);
  assert.match((await sendConversion({ store: ready(), id: 't1', secrets: {}, settings: {}, sendEmail })).reason, /CADENIC_POSTAL/);
  assert.match((await sendConversion({ store: ready({ convertProblems: ['names a price'] }), id: 't1', secrets: { CADENIC_POSTAL: POSTAL }, settings: {}, sendEmail })).reason, /linter/);
});

test('a reply arriving between the draft and the button stops the send', async () => {
  const store = ready({ });
  await store.update(TEARDOWNS + 't1', { repliedAt: new Date(NOW).toISOString() });
  const r = await sendConversion({ store, id: 't1', secrets: { CADENIC_POSTAL: POSTAL }, settings: {}, sendEmail: async () => {} });
  assert.equal(r.ok, false);
  assert.match(r.reason, /written back/, 'the gate has to hold at the moment of sending, not only when the draft was made');
});

test('it sends once and refuses the second time', async () => {
  const store = ready();
  let sent = null;
  const args = { store, id: 't1', secrets: { CADENIC_POSTAL: POSTAL, RESEND_API_KEY: 'k' }, settings: {}, sendEmail: async (a) => { sent = a; } };
  assert.equal((await sendConversion(args)).ok, true);
  assert.match(sent.text, /Reply "stop"/);
  assert.match(sent.subject, /^Re: /);
  assert.match((await sendConversion(args)).reason, /only ever one/);
});

test('conversionStats reports the funnel, not the volume', () => {
  const s = conversionStats(asDocs([
    teardown({ id: 'a' }),
    teardown({ id: 'b', convertStatus: 'sent' }),
    teardown({ id: 'c', convertStatus: 'sent', repliedAt: sentDaysAgo(1) }),
  ]));
  assert.equal(s.delivered, 3);
  assert.equal(s.asked, 2);
  assert.equal(s.answered, 1);
  assert.equal(s.rate, 50);
});

test('the interval is days, not something else', () => {
  assert.ok(CONVERT_AFTER_DAYS >= 2 && CONVERT_AFTER_DAYS <= 14);
});
