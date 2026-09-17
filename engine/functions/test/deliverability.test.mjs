/**
 * CADENIC // THE CIRCUIT BREAKER, AS TESTS
 *
 * Everything else in the outreach side assumes mail arrives. This is the file
 * that notices when it stops arriving, and the failure it guards against is
 * terminal rather than gradual: a sending domain past a complaint threshold
 * does not get slower, it gets suspended, and it takes the digest, the
 * newsletter and hello@ with it.
 *
 * So the tests are about the three ways a breaker fails to be one: tripping on
 * noise, failing to trip on the real thing, and quietly clearing itself.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  recordDelivery, deliveryHealth, sendingAllowed, resetBreaker, isHardBounce,
  isDeliveryEvent, DELIVERY, BREAKER, MIN_SAMPLE, COMPLAINT_LIMIT, BOUNCE_LIMIT,
} from '../dispatch/deliverability.js';
import { memoryStore } from '../dispatch/store.js';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const today = NOW;

const evt = (type, over = {}) => ({ type, data: { email_id: `e${Math.random()}`, ...over } });
const dayDoc = (d) => ({ id: d.day, data: d });

test('it knows which events it is for', () => {
  for (const t of ['email.sent', 'email.delivered', 'email.bounced', 'email.complained']) assert.ok(isDeliveryEvent(t), t);
  assert.equal(isDeliveryEvent('email.received'), false, 'inbound is a different path entirely');
  assert.equal(isDeliveryEvent('nonsense'), false);
});

test('a retried webhook is counted once', async () => {
  const store = memoryStore();
  const e = evt('email.complained', { email_id: 'fixed-id' });
  await recordDelivery({ store, event: e, now: today });
  const again = await recordDelivery({ store, event: e, now: today });
  assert.equal(again.note, 'already counted');
  const health = deliveryHealth(await store.list(DELIVERY), today);
  assert.equal(health.complained, 1, 'Svix retries eight times; a complaint counted twice halves the rate that trips the breaker');
});

test('the denominator is delivered, not sent', () => {
  const health = deliveryHealth([dayDoc({ day: '2026-09-20', sent: 1000, delivered: 100, bounced: 10, complained: 1 })], today);
  assert.equal(health.decided, 110);
  assert.equal(health.complaintRate, 1 / 100, 'complaints are measured against what actually landed');
  assert.equal(health.bounceRate, 10 / 110, 'bounces against everything a receiving server decided about');
});

test('rates outside the window are ignored', () => {
  const old = dayDoc({ day: '2026-01-01', delivered: 1000, bounced: 900 });
  assert.equal(deliveryHealth([old], today).decided, 0, 'a disaster in January is not this month');
});

/* ───────────────────────────────────────────── TRIPPING, AND NOT */

test('a tiny sample never trips, however bad it looks', async () => {
  const store = memoryStore({ [`${DELIVERY}2026-09-20`]: { day: '2026-09-20', delivered: 2, bounced: 1, complained: 1 } });
  const gate = await sendingAllowed({ store, now: today });
  assert.equal(gate.allowed, true, 'one bounce in three is a 33% rate and means nothing; a breaker that fires here teaches you to ignore it');
  assert.equal(gate.health.enough, false);
});

test('a real complaint rate stops sending and records why', async () => {
  const store = memoryStore({ [`${DELIVERY}2026-09-20`]: { day: '2026-09-20', delivered: 500, bounced: 5, complained: 3 } });
  const gate = await sendingAllowed({ store, now: today });
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /marked as spam/);
  const b = await store.get(BREAKER);
  assert.equal(b.open, true);
  assert.match(b.why, /0\.60%/, 'the reason has to carry the number, or nobody can judge it');
});

test('a real bounce rate stops sending', async () => {
  const store = memoryStore({ [`${DELIVERY}2026-09-20`]: { day: '2026-09-20', delivered: 80, bounced: 20, complained: 0 } });
  const gate = await sendingAllowed({ store, now: today });
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /bounced/);
});

test('healthy numbers at real volume allow sending', async () => {
  const store = memoryStore({ [`${DELIVERY}2026-09-20`]: { day: '2026-09-20', delivered: 1000, bounced: 20, complained: 0 } });
  const gate = await sendingAllowed({ store, now: today });
  assert.equal(gate.allowed, true);
  assert.equal(gate.health.enough, true);
});

test('the thresholds are the ones the providers actually use', () => {
  assert.equal(COMPLAINT_LIMIT, 0.001, 'SES warns at 0.1%');
  assert.equal(BOUNCE_LIMIT, 0.05, 'SES warns at 5%');
  assert.ok(MIN_SAMPLE >= 10);
});

/* ─────────────────────────────────────────────────── THE RESET */

test('the breaker does not clear itself when the rate falls', async () => {
  const store = memoryStore({ [BREAKER]: { open: true, why: 'it was bad' } });
  /* No delivery docs at all, so every rate is zero and the sample is empty —
     the most flattering possible state, and exactly the state a pause
     produces. */
  const gate = await sendingAllowed({ store, now: today });
  assert.equal(gate.allowed, false, 'the rate falls the moment sending stops; auto-clearing would resume what tripped it');
  assert.match(gate.reason, /it was bad/);
});

test('a person can reset it, and only once', async () => {
  const store = memoryStore({ [BREAKER]: { open: true, why: 'too many complaints' } });
  const r = await resetBreaker({ store, now: today });
  assert.equal(r.ok, true);
  assert.match(r.was, /complaints/);
  assert.equal((await sendingAllowed({ store, now: today })).allowed, true);
  assert.equal((await resetBreaker({ store, now: today })).ok, false, 'nothing to reset twice');
});

/* ────────────────────────────────────────────── HARD BOUNCES */

test('a permanent bounce is recognised, a transient one is not', () => {
  assert.equal(isHardBounce({ data: { bounce: { type: 'Permanent', subType: 'General' } } }), true);
  assert.equal(isHardBounce({ data: { bounce: { bounceType: 'Permanent', bounceSubType: 'NoSuchUser' } } }), true);
  assert.equal(isHardBounce({ data: { bounce: { type: 'Transient', subType: 'MailboxFull' } } }), false, 'a full mailbox empties; the address exists');
  assert.equal(isHardBounce({ data: { bounce: { type: 'Transient', subType: 'General' } } }), false);
  assert.equal(isHardBounce({ data: {} }), false, 'no information is not a permanent failure');
});

test('a complaint is kept individually, not only as a rate', async () => {
  const store = memoryStore();
  await recordDelivery({ store, event: evt('email.complained', { email_id: 'c1', to: ['sam@studio.example'], subject: 'your Discord' }), now: today });
  const one = await store.get(`${DELIVERY}complaints/c1`);
  assert.equal(one.to, 'sam@studio.example');
  assert.match(one.subject, /Discord/);
});

/* ─────────────────────────── THE GATE IS IN THE SEND PATH */

test('an open breaker refuses an outreach send, a teardown and the ask alike', async () => {
  const { sendOutreach, PROSPECTS } = await import('../dispatch/prospects.js');
  const { sendTeardown, TEARDOWNS } = await import('../dispatch/teardown.js');
  const { sendConversion } = await import('../dispatch/convert.js');

  const seed = {
    [BREAKER]: { open: true, why: 'too many complaints' },
    [PROSPECTS + 'p1']: { id: 'p1', email: 'a@b.co', name: 'A', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' } },
    [TEARDOWNS + 't1']: {
      id: 't1', email: 'a@b.co', name: 'A', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' },
      convertStatus: 'drafted', convertProblems: [], convertNote: { subject: 's', body: 'b' },
    },
  };
  const secrets = { CADENIC_POSTAL: 'somewhere', RESEND_API_KEY: 'k' };
  const settings = { dryRun: false };
  let sends = 0;
  const sendEmail = async () => { sends += 1; };

  for (const [label, fn, id] of [
    ['outreach', sendOutreach, 'p1'],
    ['teardown', sendTeardown, 't1'],
    ['the ask', sendConversion, 't1'],
  ]) {
    const store = memoryStore(seed);
    const r = await fn({ store, id, secrets, settings, sendEmail });
    assert.equal(r.ok, false, `${label} must refuse while the breaker is open`);
    assert.match(r.reason, /stopped/, label);
  }
  assert.equal(sends, 0, 'not one message may leave while the breaker is open');
});
