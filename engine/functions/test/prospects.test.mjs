/**
 * CADENIC // THE OUTREACH BEAT, AS TESTS
 *
 * Cold email to a business is the one thing in this engine where a single
 * wrong fact costs more than the whole beat is worth. So every test here is
 * about a way the machine could say something untrue, send something it
 * should not, or send it twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeProspect, prospectId, inviteCode, resolveInvite, inspectSite, findings,
  lintOutreach, footer, followUpBody, prospectsTick, sendOutreach, outreachStats, PROSPECTS, OUTREACH_MAX_WORDS,
} from '../dispatch/prospects.js';
import { memoryStore } from '../dispatch/store.js';

const POSTAL = '123 Example Ave NW, Edmonton AB T5J 0A1';
const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

const INVITE_JSON = {
  approximate_member_count: 1240, approximate_presence_count: 87, expires_at: null,
  guild: { id: '1', name: 'Maple Hockey', description: '', features: ['COMMUNITY'], verification_level: 0 },
  channel: { name: 'general' },
};

test('a prospect is keyed by email, so a re-imported row updates instead of duplicating', () => {
  const a = normalizeProspect({ email: 'Owner@Example.com', name: 'Sam', discord: 'https://discord.gg/abc123' });
  const b = normalizeProspect({ email: 'owner@example.com', name: 'Samantha' });
  assert.equal(a.id, b.id);
  assert.equal(a.email, 'owner@example.com');
  assert.equal(normalizeProspect({ name: 'no address' }), null, 'a row without an email is not a prospect');
  assert.equal(prospectId('x@y.io').length, 16);
});

test('invite codes are read from every spelling Discord uses, and garbage is refused', () => {
  assert.equal(inviteCode('https://discord.gg/abc123'), 'abc123');
  assert.equal(inviteCode('discord.com/invite/Xy-9'), 'Xy-9');
  assert.equal(inviteCode('https://discordapp.com/invite/old'), 'old');
  assert.equal(inviteCode('abc123'), 'abc123');
  assert.equal(inviteCode('https://example.com/discord'), null);
  assert.equal(inviteCode(''), null);
});

test('resolveInvite reads the two counts that matter and never throws on a dead invite', async () => {
  const live = await resolveInvite('abc', { fetchImpl: async () => ok(INVITE_JSON) });
  assert.equal(live.ok, true);
  assert.equal(live.members, 1240);
  assert.equal(live.present, 87);
  assert.equal(live.presenceRatio, 0.07);
  assert.equal(live.community, true);
  assert.equal(live.discoverable, false);

  const dead = await resolveInvite('gone', { fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(dead.ok, false);
  assert.match(dead.reason, /expired/);

  const down = await resolveInvite('x', { fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(down.ok, false);
});

test('inspectSite tells a discord.gg link on their site from a page on their own domain', async () => {
  const withInvite = await inspectSite('https://mapleclub.ca', {
    fetchImpl: async () => ({ ok: true, text: async () => '<a href="https://discord.gg/abc123">Join our Discord</a>' }),
  });
  assert.equal(withInvite.linksToInvite, true);
  assert.equal(withInvite.hasOwnDiscordPage, false);

  const withPage = await inspectSite('mapleclub.ca', {
    fetchImpl: async () => ({ ok: true, text: async () => '<a href="/discord">Community</a>' }),
  });
  assert.equal(withPage.hasOwnDiscordPage, true);

  const none = await inspectSite('', {});
  assert.equal(none.checked, false);
});

test('findings only ever contain numbers the API returned, and say the honest thing about each', () => {
  const found = findings({}, { invite: { ok: true, members: 1240, present: 87, presenceRatio: 0.07, community: true, discoverable: false, verificationLevel: 0, description: '' }, site: { checked: true, reachable: true, linksToInvite: true, hasOwnDiscordPage: false, mentionsDiscord: true } });
  const keys = found.map((f) => f.key);
  assert.deepEqual(keys, ['presence', 'discoverable', 'verification', 'description', 'invite-link']);
  assert.deepEqual(found[0].numbers, [1240, 87, 7]);
  assert.match(found[0].text, /1,240 members and 87 present/);
  assert.match(found[0].text, /onboarding problem/);

  // A healthy server gets told it is healthy, not sold a problem.
  const healthy = findings({}, { invite: { ok: true, members: 500, present: 150, presenceRatio: 0.3, community: true, discoverable: true, verificationLevel: 2, description: 'A club.' }, site: { checked: false } });
  assert.equal(healthy.length, 1);
  assert.match(healthy[0].text, /healthy room/);

  // Tiny servers get no presence claim: 6 of 12 online is noise, not a finding.
  const tiny = findings({}, { invite: { ok: true, members: 12, present: 6, presenceRatio: 0.5, community: false, verificationLevel: 1, description: 'x' }, site: { checked: false } });
  assert.equal(tiny.find((f) => f.key === 'presence'), undefined);
});

test('the linter refuses a number the findings do not contain — the whole safety of the beat', () => {
  const found = [{ key: 'presence', numbers: [1240, 87, 7], text: '…' }];
  const base = `Hi Sam,\n\nI build Discord servers for a living and had a look at Maple Hockey this morning. You have 1,240 members and 87 were present — about 7%. That is usually an onboarding problem rather than a content one.\n\nThe full written teardown is free at https://cadenic.studio/teardown, no call needed. Prices, if you would rather see them first, are at https://cadenic.studio/services/discord-engineering.\n\nWyatt\n\n${footer({ postal: POSTAL })}`;
  assert.deepEqual(lintOutreach(base, found, { postal: POSTAL }), []);

  assert.match(lintOutreach(base.replace('87 were', '90 were'), found, { postal: POSTAL }).join(' '), /not in the findings: 90/);
  assert.match(lintOutreach(base.replace('about 7%', 'about 8%'), found, { postal: POSTAL }).join(' '), /8/);
  assert.match(lintOutreach(base + ' I guarantee it.', found, { postal: POSTAL }).join(' '), /promises/);
  assert.match(lintOutreach(base + ' Can we hop on a call?', found, { postal: POSTAL }).join(' '), /call/);
  assert.match(lintOutreach(base.replace('Reply "stop"', 'Reply stop'), found, { postal: POSTAL }).join(' '), /CASL/);
  assert.match(lintOutreach(base.replace(POSTAL, ''), found, { postal: POSTAL }).join(' '), /postal/);
  assert.match(lintOutreach(base + ' Our bots start at $6,000.', found, { postal: POSTAL }).join(' '), /price/);
  assert.match(lintOutreach(base + ' Best odds in town.', found, { postal: POSTAL }).join(' '), /betting/);
  assert.match(lintOutreach(base + ' Great!', found, { postal: POSTAL }).join(' '), /exclamation/);
  assert.match(lintOutreach(base + ' word'.repeat(OUTREACH_MAX_WORDS), found, { postal: POSTAL }).join(' '), /words; limit/);
});

test('the tick moves new → enriched → drafted and stops; without a postal address it blocks rather than drafting', async () => {
  const store = memoryStore();
  await store.set(PROSPECTS + 'p1', { id: 'p1', email: 'a@b.ca', name: 'Sam Lee', company: 'Maple Hockey', site: 'https://maple.ca', discordInvite: 'https://discord.gg/abc123', status: 'new' });
  const fetchImpl = async (url) => {
    if (String(url).includes('discord.com/api')) return ok(INVITE_JSON);
    if (String(url).includes('anthropic.com')) return ok({ content: [{ type: 'text', text: `Hi Sam,\n\nI build Discord servers and bots for a living and had a look at Maple Hockey this morning.\n\nYou have 1,240 members and 87 were present when I looked — about 7%. Community mode is on but the server is not in Discovery. Your website sends people to a discord.gg link, which ranks for nothing.\n\nThe full written teardown is free at https://cadenic.studio/teardown, no call needed, nothing wanted back. Prices are at https://cadenic.studio/services/discord-engineering if you would rather see them first.\n\nWyatt\n\n${footer({ postal: POSTAL })}` }] });
    return { ok: true, text: async () => '<a href="https://discord.gg/abc123">discord</a>' };
  };

  // Pass 1: enrich.
  let s = await prospectsTick({ store, secrets: { ANTHROPIC_API_KEY: 'k', CADENIC_POSTAL: POSTAL }, fetchImpl });
  assert.equal(s.enriched, 1);
  let p = await store.get(PROSPECTS + 'p1');
  assert.equal(p.status, 'enriched');
  assert.equal(p.found.length, 5);

  // Pass 2: draft, and the draft passes the linter.
  s = await prospectsTick({ store, secrets: { ANTHROPIC_API_KEY: 'k', CADENIC_POSTAL: POSTAL }, fetchImpl });
  assert.equal(s.drafted, 1);
  p = await store.get(PROSPECTS + 'p1');
  assert.equal(p.status, 'drafted');
  assert.deepEqual(p.problems, []);
  assert.match(p.draft.subject, /five things/);

  // Pass 3: nothing to do. It does not re-draft.
  s = await prospectsTick({ store, secrets: { ANTHROPIC_API_KEY: 'k', CADENIC_POSTAL: POSTAL }, fetchImpl });
  assert.equal(s.drafted + s.enriched, 0);

  // No postal address: enriched prospects are blocked, never drafted.
  const bare = memoryStore();
  await bare.set(PROSPECTS + 'p2', { id: 'p2', email: 'c@d.ca', name: 'Al', discordInvite: 'abc', status: 'enriched', found: [{ key: 'x', numbers: [], text: 'y' }] });
  s = await prospectsTick({ store: bare, secrets: { ANTHROPIC_API_KEY: 'k' }, fetchImpl });
  assert.equal(s.refused, 1);
  assert.match((await bare.get(PROSPECTS + 'p2')).problems[0], /CASL/);
});

test('sendOutreach refuses in dry run, without a postal address, on a refused draft, and past the daily cap', async () => {
  const store = memoryStore();
  const sends = [];
  const sendEmail = async (m) => { sends.push(m); return { id: 'x' }; };
  const good = { id: 'p1', email: 'a@b.ca', name: 'Sam', status: 'drafted', problems: [], draft: { subject: 's', body: 'b' } };
  await store.set(PROSPECTS + 'p1', good);
  const secrets = { RESEND_API_KEY: 'r', CADENIC_POSTAL: POSTAL };

  let r = await sendOutreach({ store, id: 'p1', secrets, settings: { dryRun: true }, sendEmail });
  assert.equal(r.ok, false); assert.match(r.reason, /dry run/);

  r = await sendOutreach({ store, id: 'p1', secrets: { RESEND_API_KEY: 'r' }, settings: {}, sendEmail });
  assert.equal(r.ok, false); assert.match(r.reason, /mailing address/);

  await store.set(PROSPECTS + 'p3', { ...good, id: 'p3', email: 'x@y.ca', problems: ['number(s) not in the findings: 90'] });
  r = await sendOutreach({ store, id: 'p3', secrets, settings: {}, sendEmail });
  assert.equal(r.ok, false); assert.match(r.reason, /linter/);

  assert.equal(sends.length, 0, 'nothing was sent by any refusal');

  r = await sendOutreach({ store, id: 'p1', secrets, settings: {}, sendEmail, now: Date.parse('2026-09-16T15:00:00Z') });
  assert.equal(r.ok, true);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].to, 'a@b.ca');
  const after = await store.get(PROSPECTS + 'p1');
  assert.equal(after.status, 'sent');
  assert.equal(after.followUpAt.slice(0, 10), '2026-09-26', 'follow-up is ten days out');

  // Sending it again is refused: it is not 'drafted' any more.
  r = await sendOutreach({ store, id: 'p1', secrets, settings: {}, sendEmail });
  assert.equal(r.ok, false); assert.match(r.reason, /already sent/);

  // The daily cap.
  for (let i = 0; i < 5; i++) await store.set(PROSPECTS + `q${i}`, { ...good, id: `q${i}`, email: `q${i}@z.ca`, status: 'sent', sentAt: '2026-09-16T10:00:00Z' });
  await store.set(PROSPECTS + 'p9', { ...good, id: 'p9', email: 'p9@z.ca' });
  r = await sendOutreach({ store, id: 'p9', secrets, settings: {}, sendEmail, now: Date.parse('2026-09-16T16:00:00Z') });
  assert.equal(r.ok, false); assert.match(r.reason, /already sent today/);
});

test('the follow-up is drafted at day ten, sent once, and never drafted for someone who replied', async () => {
  const store = memoryStore();
  const sentAt = '2026-09-01T12:00:00Z';
  await store.set(PROSPECTS + 'p1', { id: 'p1', email: 'a@b.ca', name: 'Sam Lee', company: 'Maple Hockey', status: 'sent', sentAt, followUpAt: '2026-09-11T12:00:00Z', draft: { subject: 'your Discord — three things I noticed' } });
  await store.set(PROSPECTS + 'p2', { id: 'p2', email: 'c@d.ca', name: 'Al', status: 'replied', sentAt, followUpAt: '2026-09-11T12:00:00Z' });

  // Day 9: nothing.
  let s = await prospectsTick({ store, secrets: { CADENIC_POSTAL: POSTAL }, now: Date.parse('2026-09-10T12:00:00Z') });
  assert.equal(s.followUps, 0);
  // Day 10: p1 gets one, p2 (replied) does not.
  s = await prospectsTick({ store, secrets: { CADENIC_POSTAL: POSTAL }, now: Date.parse('2026-09-11T13:00:00Z') });
  assert.equal(s.followUps, 1);
  const p1 = await store.get(PROSPECTS + 'p1');
  assert.equal(p1.status, 'follow-up-drafted');
  assert.match(p1.followUp.body, /no reply needed/);
  assert.match(p1.followUp.body, /Reply "stop"/);
  assert.equal((await store.get(PROSPECTS + 'p2')).status, 'replied');

  const sends = [];
  const r = await sendOutreach({ store, id: 'p1', secrets: { RESEND_API_KEY: 'r', CADENIC_POSTAL: POSTAL }, settings: {}, kind: 'follow', sendEmail: async (m) => { sends.push(m); } });
  assert.equal(r.ok, true);
  assert.equal((await store.get(PROSPECTS + 'p1')).status, 'followed-up');
  // Day 30: no second follow-up, ever.
  s = await prospectsTick({ store, secrets: { CADENIC_POSTAL: POSTAL }, now: Date.parse('2026-10-01T12:00:00Z') });
  assert.equal(s.followUps, 0);
  assert.equal(sends.length, 1);
});

test('the follow-up is the one that lets them off the hook, and the stats count money', () => {
  const body = followUpBody({ prospect: { name: 'Sam Lee', company: 'Maple Hockey' }, sentOn: '1 September', postal: POSTAL });
  assert.match(body, /^Hi Sam — no reply needed/);
  assert.match(body, /hand any of it to whoever you already use/);
  assert.doesNotMatch(body, /call|meeting|!/);

  const stats = outreachStats([
    { data: { status: 'new' } }, { data: { status: 'sent' } }, { data: { status: 'sent' } },
    { data: { status: 'replied' } }, { data: { status: 'converted' } }, { data: { status: 'declined' } },
  ]);
  assert.equal(stats.sent, 5);
  assert.equal(stats.replied, 3);
  assert.equal(stats.converted, 1);
  assert.equal(stats.replyRate, 60);
});
