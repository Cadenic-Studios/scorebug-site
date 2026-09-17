/**
 * CADENIC // THE INBOX, AS TESTS
 *
 * Every test here is about a way the machine could mishandle the one moment
 * that decides whether outreach is a business or a nuisance: a human writing
 * back. The expensive mistakes are asymmetric and the tests are shaped to
 * match — chasing somebody who already answered, missing somebody who asked
 * to be left alone, or losing a real lead by mistaking a holiday for a no.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
  verifyWebhook, bareAddress, stripHtml, newTextOnly, classifyPlainly,
  lintAnswer, handleInbound, sendAnswer, inboxStats, INBOX, SEEN, SIGNATURE_TOLERANCE_MS,
} from '../dispatch/inbox.js';
import { memoryStore } from '../dispatch/store.js';
import { PROSPECTS } from '../dispatch/prospects.js';
import { SUPPRESSION, suppressionKey, noUnsolicitedNotice } from '../dispatch/discover.js';
import { ownSiteFrom, feedsForDay, FEEDS } from '../dispatch/feeds.js';

/* ───────────────────────────────────────────────── SIGNATURE */

const SECRET = `whsec_${Buffer.from('a-test-signing-key-32-bytes-long').toString('base64')}`;

function signed(body, { id = 'msg_abc', at = Date.now(), secret = SECRET } = {}) {
  const ts = Math.floor(at / 1000);
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` };
}

test('verifyWebhook accepts a correctly signed body', () => {
  const body = JSON.stringify({ type: 'email.received' });
  assert.equal(verifyWebhook({ secret: SECRET, headers: signed(body), rawBody: body }).ok, true);
});

test('verifyWebhook rejects a body that changed by one byte', () => {
  const body = JSON.stringify({ type: 'email.received' });
  const r = verifyWebhook({ secret: SECRET, headers: signed(body), rawBody: `${body} ` });
  assert.equal(r.ok, false);
  assert.match(r.reason, /signature/);
});

test('verifyWebhook rejects a replay outside the tolerance', () => {
  const body = '{}';
  const r = verifyWebhook({ secret: SECRET, headers: signed(body, { at: Date.now() - SIGNATURE_TOLERANCE_MS - 10_000 }), rawBody: body });
  assert.equal(r.ok, false);
  assert.match(r.reason, /tolerance/);
});

test('verifyWebhook refuses everything when no secret is configured', () => {
  const body = '{}';
  assert.equal(verifyWebhook({ secret: '', headers: signed(body), rawBody: body }).ok, false);
});

test('verifyWebhook accepts one of several rotated signatures', () => {
  const body = '{"a":1}';
  const h = signed(body);
  h['svix-signature'] = `v1,ZmFrZXNpZ25hdHVyZQ== ${h['svix-signature']}`;
  assert.equal(verifyWebhook({ secret: SECRET, headers: h, rawBody: body }).ok, true);
});

/* ───────────────────────────────────────────────── PARSING */

test('bareAddress unwraps a display name', () => {
  assert.equal(bareAddress('Jane Doe <Jane@Example.COM>'), 'jane@example.com');
  assert.equal(bareAddress('  plain@host.io '), 'plain@host.io');
});

test('stripHtml keeps the words and drops the markup', () => {
  const out = stripHtml('<p>Hello <b>there</b></p><script>ignore()</script><p>Bye</p>');
  assert.match(out, /Hello there/);
  assert.match(out, /Bye/);
  assert.doesNotMatch(out, /ignore/);
});

test('newTextOnly keeps what they wrote, not what we wrote', () => {
  const body = `Sure, send it over.

On Tue, 3 Sep 2026 at 09:14, Wyatt <hello@cadenic.studio> wrote:
> Your server has 1,240 members`;
  assert.equal(newTextOnly(body), 'Sure, send it over.');
});

test('newTextOnly cuts our own footer when it is quoted back', () => {
  assert.equal(newTextOnly('No thanks.\n\nCadenic Studios · somewhere\nhello@cadenic.studio'), 'No thanks.');
});

/* ───────────────────────────────────── CLASSIFICATION ORDER */

test('a stop request wins over everything else in the message', () => {
  assert.equal(classifyPlainly({ text: 'This sounds interesting but please remove me from your list.', subject: 'Re: your Discord' }).kind, 'unsubscribe');
});

test('a bare stop is an unsubscribe', () => {
  assert.equal(classifyPlainly({ text: 'stop', subject: '' }).kind, 'unsubscribe');
  assert.equal(classifyPlainly({ text: 'Unsubscribe.', subject: '' }).kind, 'unsubscribe');
});

test('an out-of-office is not a reply', () => {
  assert.equal(classifyPlainly({ text: 'I am away until the 12th.', subject: 'Automatic reply: your Discord' }).kind, 'auto');
  assert.equal(classifyPlainly({ text: 'back soon', subject: 'x', headers: { 'auto-submitted': 'auto-replied' } }).kind, 'auto');
  assert.equal(classifyPlainly({ text: 'back soon', subject: 'x', headers: { precedence: 'bulk' } }).kind, 'auto');
});

test('a bounce is recognised by sender and by subject', () => {
  assert.equal(classifyPlainly({ text: '', subject: 'x', from: 'MAILER-DAEMON@host.tld' }).kind, 'bounce');
  assert.equal(classifyPlainly({ text: 'x', subject: 'Undeliverable: your Discord', from: 'a@b.co' }).kind, 'bounce');
});

test('a real human message is handed to the model, not decided here', () => {
  assert.equal(classifyPlainly({ text: 'What would something like this cost us?', subject: 'Re: your Discord' }), null);
});

/* ─────────────────────────────────────────────────── INTAKE */

const PID = 'abc123';
const seededStore = (extra = {}) => memoryStore({
  [PROSPECTS + PID]: {
    id: PID, email: 'ops@studio.example', name: 'Sam Reyes', company: 'Studio Example',
    status: 'sent', sentAt: '2026-09-01T10:00:00.000Z', followUpAt: '2026-09-11T10:00:00.000Z',
    found: [{ key: 'presence', numbers: [1240, 96, 8], text: '1,240 members and 96 present — about 8%.' }],
    draft: { subject: 'your Discord — two things I noticed', body: 'x' },
    ...extra,
  },
});

const evt = (over = {}) => ({ type: 'email.received', data: { email_id: 'e1', from: 'Sam <ops@studio.example>', to: ['inbound@cadenic.studio'], subject: 'Re: your Discord', message_id: '<m1@studio.example>', ...over } });

/** Resend's body fetch and the model, both stubbed. */
const fakeFetch = ({ text = 'Thanks, what would this cost?', kind = 'question', headers = {}, subject = 'Re: your Discord' } = {}) => async (url) => {
  const u = String(url);
  if (u.includes('/emails/receiving/')) {
    return { ok: true, status: 200, async json() { return { from: 'Sam <ops@studio.example>', to: ['inbound@cadenic.studio'], subject, text, html: '', headers, message_id: '<m1@studio.example>' }; } };
  }
  if (u.includes('api.anthropic.com')) {
    return { ok: true, status: 200, async json() { return { content: [{ text: JSON.stringify({ kind, summary: 'asked about price', asks: ['what would this cost?'] }) }] }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};

test('a reply cancels the follow-up', async () => {
  const store = seededStore();
  await handleInbound({ store, event: evt(), secrets: { RESEND_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeFetch() });
  const p = await store.get(PROSPECTS + PID);
  assert.equal(p.followUpAt, null, 'the timer must be cleared');
  assert.equal(p.status, 'replied');
  assert.ok(p.repliedAt);
});

test('an out-of-office does NOT cancel the follow-up', async () => {
  const store = seededStore();
  /* The subject is set on BOTH the webhook metadata and the retrieved message,
     because the retrieved one is authoritative and a stub that disagreed with
     itself was testing the stub rather than the code. */
  const out = await handleInbound({ store, event: evt({ subject: 'Out of office' }), secrets: { RESEND_API_KEY: 'k' }, fetchImpl: fakeFetch({ text: 'I am on leave until October.', subject: 'Out of office' }) });
  assert.equal(out.kind, 'auto');
  const p = await store.get(PROSPECTS + PID);
  assert.equal(p.followUpAt, '2026-09-11T10:00:00.000Z', 'a holiday is not an answer');
  assert.equal(p.status, 'sent');
});

test('an unsubscribe suppresses the address permanently and needs no model', async () => {
  const store = seededStore();
  const out = await handleInbound({
    store, event: evt(),
    secrets: { RESEND_API_KEY: 'k' },   // deliberately no ANTHROPIC_API_KEY
    fetchImpl: fakeFetch({ text: 'Please remove me from your list.' }),
  });
  assert.equal(out.kind, 'unsubscribe');
  assert.equal((await store.get(PROSPECTS + PID)).status, 'declined');
  assert.ok(await store.get(SUPPRESSION + suppressionKey('ops@studio.example')), 'must be on the permanent list');
});

test('the same webhook delivered twice is handled once', async () => {
  const store = seededStore();
  const secrets = { RESEND_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' };
  await handleInbound({ store, event: evt(), secrets, fetchImpl: fakeFetch() });
  const again = await handleInbound({ store, event: evt(), secrets, fetchImpl: fakeFetch() });
  assert.equal(again.note, 'already handled');
  assert.ok(await store.get(SEEN + 'e1'));
});

test('a reply we could not fetch still stops the follow-up', async () => {
  const store = seededStore();
  const fetchImpl = async (url) => {
    if (String(url).includes('/emails/receiving/')) return { ok: false, status: 500, async text() { return 'boom'; } };
    return { ok: true, status: 200, async json() { return { content: [{ text: '{"kind":"other","summary":"","asks":[]}' }] }; } };
  };
  await handleInbound({ store, event: evt(), secrets: { RESEND_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, fetchImpl });
  assert.equal((await store.get(PROSPECTS + PID)).followUpAt, null, 'an unreadable message is likelier a person than a bounce');
});

test('a hostile reply is suppressed, not merely marked declined', async () => {
  const store = seededStore();
  await handleInbound({ store, event: evt(), secrets: { RESEND_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeFetch({ text: 'How did you get this address.', kind: 'hostile' }) });
  assert.equal((await store.get(PROSPECTS + PID)).status, 'declined');
  assert.ok(await store.get(SUPPRESSION + suppressionKey('ops@studio.example')), 'a status can be reset by a CSV; a suppression cannot');
});

/* ───────────────────────────────────────────────── THE SEND */

test('sendAnswer refuses in dry run, and threads the reply when it does send', async () => {
  const store = seededStore();
  await store.set(INBOX + 'e1', { from: 'ops@studio.example', subject: 'Re: your Discord', answer: 'Sure — prices are on the page.', problems: [], status: 'drafted', inReplyTo: '<m1@studio.example>', prospectId: PID });

  const dry = await sendAnswer({ store, id: 'e1', secrets: { CADENIC_POSTAL: 'somewhere' }, settings: { dryRun: true }, sendEmail: async () => {} });
  assert.equal(dry.ok, false);
  assert.match(dry.reason, /dry run/);

  let sent = null;
  const ok = await sendAnswer({ store, id: 'e1', secrets: { CADENIC_POSTAL: 'Cadenic Studios, Leduc AB' }, settings: { dryRun: false }, sendEmail: async (a) => { sent = a; } });
  assert.equal(ok.ok, true);
  assert.equal(sent.headers['In-Reply-To'], '<m1@studio.example>', 'must land inside their thread');
  assert.match(sent.text, /Cadenic Studios, Leduc AB/, 'CASL address on every message');
  assert.equal((await store.get(INBOX + 'e1')).status, 'answered');
});

test('sendAnswer refuses without a postal address', async () => {
  const store = seededStore();
  await store.set(INBOX + 'e1', { from: 'a@b.co', answer: 'hi', problems: [], status: 'drafted' });
  const r = await sendAnswer({ store, id: 'e1', secrets: {}, settings: { dryRun: false }, sendEmail: async () => {} });
  assert.equal(r.ok, false);
  assert.match(r.reason, /CADENIC_POSTAL/);
});

test('sendAnswer refuses a draft the linter rejected', async () => {
  const store = seededStore();
  await store.set(INBOX + 'e1', { from: 'a@b.co', answer: 'hi', problems: ['names a price'], status: 'needs-human' });
  const r = await sendAnswer({ store, id: 'e1', secrets: { CADENIC_POSTAL: 'x' }, settings: { dryRun: false }, sendEmail: async () => {} });
  assert.equal(r.ok, false);
  assert.match(r.reason, /linter/);
});

/* ────────────────────────────────────────────────── THE LINT */

test('lintAnswer rejects a number we never told them', () => {
  const p = { found: [{ numbers: [1240, 96, 8] }] };
  assert.deepEqual(lintAnswer('You have 1,240 members and 96 present.', p), []);
  assert.match(lintAnswer('You have about 1,300 members.', p).join(' '), /never told them/);
});

test('lintAnswer refuses a price and a guarantee', () => {
  assert.match(lintAnswer('It is $400 a month.', { found: [] }).join(' '), /price/);
  assert.match(lintAnswer('I guarantee it will work.', { found: [] }).join(' '), /promises a result/);
});

test('inboxStats counts what is waiting', () => {
  const s = inboxStats([
    { data: { kind: 'question', status: 'drafted' } },
    { data: { kind: 'unsubscribe', status: 'closed' } },
    { data: { kind: 'question', status: 'needs-human' } },
  ]);
  assert.equal(s.waiting, 2);
  assert.equal(s.by.question, 2);
});

/* ────────────────────────────────────────── CASL: THE NOTICE */

test('a no-unsolicited notice beside the address is honoured', () => {
  const html = '<p>Contact <a href="mailto:hi@co.example">hi@co.example</a>. Please, no unsolicited sales email.</p>';
  assert.match(noUnsolicitedNotice(html, 'hi@co.example'), /no unsolicited/i);
});

test('the same notice far away on the page is not about us', () => {
  const html = `<a href="mailto:hi@co.example">hi@co.example</a>${'&nbsp;'.repeat(900)}<p>Recruiters: no unsolicited agency enquiries.</p>`;
  assert.equal(noUnsolicitedNotice(html, 'hi@co.example'), '', 'a careers-page line is not a refusal of our email');
});

/* ───────────────────────────────────────────────── THE FEEDS */

test('ownSiteFrom skips platforms and returns the company', () => {
  const html = '<a href="https://twitter.com/x">t</a><a href="https://discord.gg/abc">d</a><a href="https://roundtable.example/game">site</a>';
  assert.equal(ownSiteFrom(html, 'itch.io'), 'https://roundtable.example');
});

test('ownSiteFrom returns nothing when a page is only social buttons', () => {
  assert.equal(ownSiteFrom('<a href="https://x.com/a">a</a><a href="https://youtube.com/b">b</a>'), '');
});

test('feedsForDay rotates so every source is sampled across a week', () => {
  const day = 86_400_000;
  const seen = new Set();
  for (let i = 0; i < FEEDS.length; i++) for (const f of feedsForDay(i * day, 2)) seen.add(f.key);
  assert.equal(seen.size, FEEDS.length, 'every feed must come up');
  assert.equal(feedsForDay(0, 2).length, 2);
});

/* ──────────────────────────────────────── REPLIES HAVE TO LAND SOMEWHERE */

/**
 * Outgoing mail is From hello@cadenic.studio, a Google Workspace inbox. Without
 * a Reply-To on the receiving subdomain, every reply goes there and this whole
 * module never sees one. Four send paths, one header, and a test that fails if
 * any of them drops it.
 */
test('every Cadenic send carries the reply-to when it is configured', async () => {
  const { sendOutreach, PROSPECTS: P } = await import('../dispatch/prospects.js');
  const { sendTeardown, TEARDOWNS: T } = await import('../dispatch/teardown.js');
  const { sendConversion } = await import('../dispatch/convert.js');

  const seed = {
    [P + 'p1']: { id: 'p1', email: 'a@b.co', name: 'A', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' } },
    [T + 't1']: {
      id: 't1', email: 'a@b.co', name: 'A', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' },
      convertStatus: 'drafted', convertProblems: [], convertNote: { subject: 's', body: 'b' },
    },
    [INBOX + 'e1']: { from: 'a@b.co', subject: 's', answer: 'hi', problems: [], status: 'drafted' },
  };
  const secrets = { CADENIC_POSTAL: 'somewhere', RESEND_API_KEY: 'k', CADENIC_REPLY_TO: 'wyatt@inbound.cadenic.studio' };
  const settings = { dryRun: false };

  for (const [label, fn, id] of [
    ['outreach', sendOutreach, 'p1'],
    ['teardown', sendTeardown, 't1'],
    ['the ask', sendConversion, 't1'],
    ['an answer', sendAnswer, 'e1'],
  ]) {
    let sent = null;
    const r = await fn({ store: memoryStore(seed), id, secrets, settings, sendEmail: async (a) => { sent = a; } });
    assert.equal(r.ok, true, `${label}: ${r.reason || ''}`);
    assert.equal(sent.replyTo, 'wyatt@inbound.cadenic.studio', `${label} must carry the reply-to or the reply is lost`);
  }
});

test('with no reply-to configured, the header is simply absent, not empty', async () => {
  const { sendOutreach, PROSPECTS: P } = await import('../dispatch/prospects.js');
  const store = memoryStore({ [P + 'p1']: { id: 'p1', email: 'a@b.co', name: 'A', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' } } });
  let sent = null;
  await sendOutreach({ store, id: 'p1', secrets: { CADENIC_POSTAL: 'x', RESEND_API_KEY: 'k' }, settings: { dryRun: false }, sendEmail: async (a) => { sent = a; } });
  assert.equal(sent.replyTo, undefined, 'an empty Reply-To header is worse than none');
});
