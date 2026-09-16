/**
 * CADENIC // THE TEARDOWN, AS TESTS
 *
 * This document is the promise every cold email makes. It goes to somebody who
 * knows their own server far better than we ever will, which means a single
 * invented number discredits the other thousand words — and a document that
 * could have been written about anybody is worse than sending nothing.
 *
 * So the tests are about three failures: saying something we did not measure,
 * sending something the linter refused, and padding out a server we could not
 * actually read.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  teardownId, teardownFindings, strengths, lintTeardown,
  teardownTick, sendTeardown, teardownStats, inspect, TEARDOWNS,
} from '../dispatch/teardown.js';
import { memoryStore } from '../dispatch/store.js';

const DATA = {
  at: '2026-09-16T12:00:00.000Z',
  invite: { ok: true, guildId: '1', guildName: 'Roundtable', description: '', members: 1240, present: 96, presenceRatio: 0.077, community: false, discoverable: false, verificationLevel: 0, inviteExpires: '2026-10-01T00:00:00Z' },
  preview: { ok: false, reason: 'not discoverable' },
  site: { checked: true, reachable: true, linksToInvite: true, hasOwnDiscordPage: false, mentionsDiscord: true },
};

test('teardownId is stable for the same person and server', () => {
  assert.equal(teardownId('A@B.co', 'https://discord.gg/xyz'), teardownId('a@b.co  ', 'discord.gg/xyz'));
  assert.notEqual(teardownId('a@b.co', 'discord.gg/xyz'), teardownId('a@b.co', 'discord.gg/other'));
});

test('findings come back cheapest-fix-first', () => {
  const f = teardownFindings(DATA);
  const costs = f.map((x) => x.cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b), 'a document that opens with the expensive fix reads as a quote');
  const keys = f.map((x) => x.key);
  assert.ok(keys.includes('community'), 'community mode off is the highest-value free switch');
  assert.ok(keys.includes('verification'));
  assert.ok(keys.includes('expiry'));
  assert.ok(keys.includes('invite-link'));
});

test('every finding carries the numbers it is allowed to use', () => {
  for (const f of teardownFindings(DATA)) {
    assert.ok(Array.isArray(f.numbers), `${f.key} must declare its numbers`);
    for (const n of f.numbers) assert.equal(typeof n, 'number');
  }
  const presence = teardownFindings(DATA).find((f) => f.key === 'presence');
  assert.deepEqual(presence.numbers, [1240, 96, 8]);
});

test('a healthy server earns a genuine compliment, a bare one earns none', () => {
  assert.equal(strengths(DATA).length, 0, 'nothing here is actually good yet, and saying otherwise is a lie');
  const good = strengths({ invite: { ...DATA.invite, presenceRatio: 0.22, community: true, discoverable: true, description: 'a room', verificationLevel: 2 }, preview: { ok: true, emojis: 14 } });
  assert.ok(good.length >= 3);
  assert.ok(good.some((g) => g.numbers.includes(22)));
});

/* ─────────────────────────────────────────────────── THE LINTER */

const GOOD_DOC = `## What I looked at
I read Roundtable from the outside on 16 September 2026 — the public invite endpoint and your website. I cannot see your channels, permissions, moderation logs or retention.

## What is working
The setup is early rather than wrong, which is the easier of the two to fix.

## What I would change
### Community mode is off
This is the highest-value switch in Discord and it is free. Server Settings, then the onboarding flow.
### 1,240 members, 96 present
About 8% when I looked. That is the number nobody sees from the inside, and it is the one that decides whether the room feels worth opening. The people are already there and are simply not being given a reason to come back, which is a cheaper problem to have than not enough people.
### Verification is set to None
A brand-new account can join and post straight away. That is where raid spam comes from, and it tends to arrive on the day you get your first real traffic, which is the worst possible day for it. Low or Medium stops nearly all of it and inconveniences nobody real.
### The invite I was given expires
Every place that link has been printed stops working on that date, quietly, and you find out from the traffic rather than from an error message. A permanent invite costs nothing and means anything you publish keeps working.
### Your website links straight to discord.gg
Two costs there. The link is temporary, so everywhere you have published it is publishing something that can break. And that page is not yours and ranks for nothing, where a page on your own domain about your community can rank, can be linked to, and can be changed without reprinting anything.

## Where I would start
1. Turn on Community mode. An afternoon.
2. Raise verification to Medium. Ten minutes.
3. Publish a permanent invite. Ten minutes.

## What a bot could do here
Something that posts the one thing your members would otherwise go elsewhere for.

## If you want a hand
The work is at https://cadenic.studio/services/discord-engineering. You are welcome to hand any of this to whoever you already use.`;

const FOUND = teardownFindings(DATA);

test('a clean document passes', () => {
  assert.deepEqual(lintTeardown(GOOD_DOC, FOUND, []), []);
});

test('a number we never measured is refused', () => {
  const bad = GOOD_DOC.replace('1,240 members, 96 present', '1,300 members, 96 present');
  assert.match(lintTeardown(bad, FOUND, []).join(' '), /not in the findings/);
});

test('a promise, a price and a call are each refused', () => {
  assert.match(lintTeardown(`${GOOD_DOC}\nThis will double your members.`, FOUND, []).join(' '), /promises a result/);
  assert.match(lintTeardown(`${GOOD_DOC}\nIt is $900.`, FOUND, []).join(' '), /price/);
  assert.match(lintTeardown(`${GOOD_DOC}\nHappy to hop on a call.`, FOUND, []).join(' '), /call/);
});

test('a document that hides how little it could see is refused', () => {
  /* Both sentences have to go. The first says how the reading was done and the
     second says what it could not reach, and only the second is the disclaimer
     that actually protects the reader. */
  const bad = GOOD_DOC
    .replace(' I cannot see your channels, permissions, moderation logs or retention.', '')
    .replace('from the outside on', 'thoroughly on');
  assert.match(lintTeardown(bad, FOUND, []).join(' '), /limit of what was read/);
});

test('a document missing a required section is refused', () => {
  assert.match(lintTeardown(GOOD_DOC.replace('## Where I would start', '## Some thoughts'), FOUND, []).join(' '), /Where I would start/);
});

test('list numbering and years are not treated as claims', () => {
  assert.deepEqual(lintTeardown(GOOD_DOC, FOUND, []), [], '1. 2. 3. and 2026 must not read as invented figures');
});

/* ───────────────────────────────────────────── THE REFUSAL PATH */

test('a server we cannot read is refused, not padded out with generic advice', async () => {
  const store = memoryStore({ [TEARDOWNS + 't1']: { id: 't1', email: 'a@b.co', discordInvite: 'discord.gg/dead', status: 'new' } });
  const fetchImpl = async (url) => {
    if (String(url).includes('/invites/')) return { ok: false, status: 404, async json() { return {}; } };
    return { ok: true, status: 200, async text() { return ''; }, async json() { return {}; } };
  };
  const out = await teardownTick({ store, secrets: { ANTHROPIC_API_KEY: 'k' }, fetchImpl });
  assert.equal(out.refused, 1);
  const r = await store.get(TEARDOWNS + 't1');
  assert.equal(r.status, 'blocked');
  assert.match(r.problems[0], /could not read the server/);
  assert.equal(r.draft, undefined, 'nothing should have been written about a server we never saw');
});

test('inspect refuses when the invite will not resolve', async () => {
  const out = await inspect({ discordInvite: 'discord.gg/dead' }, { fetchImpl: async () => ({ ok: false, status: 404, async json() { return {}; } }) });
  assert.equal(out.ok, false);
});

/* ─────────────────────────────────────────────────── THE SEND */

const ready = () => memoryStore({
  [TEARDOWNS + 't1']: {
    id: 't1', email: 'sam@studio.example', name: 'Sam Reyes', company: 'Roundtable',
    status: 'drafted', problems: [], draft: { subject: 'Your Discord teardown — Roundtable', body: GOOD_DOC },
  },
});

test('sendTeardown refuses in dry run and without a postal address', async () => {
  assert.match((await sendTeardown({ store: ready(), id: 't1', secrets: { CADENIC_POSTAL: 'x' }, settings: { dryRun: true }, sendEmail: async () => {} })).reason, /dry run/);
  assert.match((await sendTeardown({ store: ready(), id: 't1', secrets: {}, settings: { dryRun: false }, sendEmail: async () => {} })).reason, /CADENIC_POSTAL/);
});

test('sendTeardown refuses a draft the linter rejected', async () => {
  const store = ready();
  await store.update(TEARDOWNS + 't1', { problems: ['names a price'] });
  assert.match((await sendTeardown({ store, id: 't1', secrets: { CADENIC_POSTAL: 'x' }, settings: { dryRun: false }, sendEmail: async () => {} })).reason, /linter/);
});

test('a sent teardown carries the CASL address and cannot be sent twice', async () => {
  const store = ready();
  let sent = null;
  const args = { store, id: 't1', secrets: { CADENIC_POSTAL: 'Cadenic Studios, Leduc AB' }, settings: { dryRun: false }, sendEmail: async (a) => { sent = a; } };
  assert.equal((await sendTeardown(args)).ok, true);
  assert.match(sent.text, /Cadenic Studios, Leduc AB/);
  assert.match(sent.text, /free and there is nothing to reply to/);
  assert.match((await sendTeardown(args)).reason, /already sent/);
});

test('teardownStats counts what is owed', () => {
  const s = teardownStats([
    { data: { status: 'sent' } }, { data: { status: 'drafted' } }, { data: { status: 'blocked' } }, { data: { status: 'new' } },
  ]);
  assert.equal(s.sent, 1);
  assert.equal(s.waiting, 2);
  assert.equal(s.total, 4);
});
