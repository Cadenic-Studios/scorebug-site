/**
 * CADENIC // DISCOVERY, AS TESTS
 *
 * This is the beat that decides whose inbox gets used, so every test here is a
 * way it could contact somebody it should not: a platform instead of a
 * company, a site that asked not to be crawled, an address nobody published,
 * somebody who already said no, or the same company twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  hostOf, isPlatform, extract, robotsAllows, assess, suppress, isSuppressed,
  discoverTick, discoveryStats, CANDIDATES, SUPPRESSION,
} from '../dispatch/discover.js';
import { PROSPECTS } from '../dispatch/prospects.js';
import { queriesForDay, searchProvider, search, SEGMENTS } from '../dispatch/sources.js';
import { memoryStore } from '../dispatch/store.js';

/* Both text() and json(): the page fetches read text, the search adapters read
   json, and one helper serving both keeps the fakes honest about being the
   same fetch. */
const html = (body) => ({
  ok: true,
  status: 200,
  text: async () => body,
  json: async () => JSON.parse(body),
});
const PAGE = `<html><head><title>Northlight Games | Indie Studio</title>
<meta property="og:site_name" content="Northlight Games"></head><body>
<a href="https://discord.gg/abc123">Join our Discord</a>
<a href="mailto:hello@northlight.example">hello@northlight.example</a>
</body></html>`;

test('a platform is never a prospect, however good the search result looks', () => {
  assert.equal(hostOf('https://www.northlight.example/about'), 'northlight.example');
  for (const h of ['discord.com', 'top.gg', 'disboard.org', 'reddit.com', 'twitch.tv', 'patreon.com', 'itch.io', 'github.com']) {
    assert.equal(isPlatform(h), true, `${h} should be excluded`);
  }
  assert.equal(isPlatform('northlight.example'), false);
  assert.equal(isPlatform('maplehockey.ca'), false);
});

test('extraction prefers a mailto on their own domain and never takes a role address', () => {
  const f = extract(PAGE, { host: 'northlight.example' });
  assert.equal(f.email, 'hello@northlight.example');
  assert.equal(f.invites[0], 'https://discord.gg/abc123');
  assert.equal(f.name, 'Northlight Games');

  const noisy = extract(`<a href="mailto:noreply@northlight.example">x</a>
    <a href="mailto:dmca@northlight.example">y</a>
    <a href="mailto:studio@northlight.example">z</a>
    <a href="https://discord.gg/q">d</a>`, { host: 'northlight.example' });
  assert.equal(noisy.email, 'studio@northlight.example', 'noreply and dmca are skipped');

  const offsite = extract(`<a href="mailto:someone@gmail.com">c</a><a href="https://discord.gg/q">d</a>`, { host: 'northlight.example' });
  assert.equal(offsite.email, 'someone@gmail.com', 'a published address on another domain is still published');

  const platformMail = extract(`<a href="mailto:x@discord.com">c</a><a href="https://discord.gg/q">d</a>`, { host: 'n.example' });
  assert.equal(platformMail.email, '', 'a platform address is not a company contact');
});

test('robots.txt is obeyed, and an unreachable robots.txt means we stay away', async () => {
  const yes = await robotsAllows('a.example', '/', { fetchImpl: async () => html('User-agent: *\nDisallow: /admin\n') });
  assert.equal(yes.allowed, true);

  const no = await robotsAllows('a.example', '/admin/x', { fetchImpl: async () => html('User-agent: *\nDisallow: /admin\n') });
  assert.equal(no.allowed, false);

  const all = await robotsAllows('a.example', '/', { fetchImpl: async () => html('User-agent: *\nDisallow: /\n') });
  assert.equal(all.allowed, false);

  const allowWins = await robotsAllows('a.example', '/admin/public', { fetchImpl: async () => html('User-agent: *\nDisallow: /admin\nAllow: /admin/public\n') });
  assert.equal(allowWins.allowed, true, 'the longest matching rule wins');

  const missing = await robotsAllows('a.example', '/', { fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(missing.allowed, true, 'no robots.txt is not a refusal');

  const broken = await robotsAllows('a.example', '/', { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(broken.allowed, false, 'a struggling server is the worst time to add a request');

  const dead = await robotsAllows('a.example', '/', { fetchImpl: async () => { throw new Error('ETIMEDOUT'); } });
  assert.equal(dead.allowed, false);
});

test('assess qualifies a company with both an invite and a published address, and names every refusal', async () => {
  const store = memoryStore();
  const fetchImpl = async (url) => {
    if (url.endsWith('/robots.txt')) return html('User-agent: *\nAllow: /\n');
    return html(PAGE);
  };
  const good = await assess({ url: 'https://northlight.example/', title: 'Northlight' }, { store, segment: 'game studio', fetchImpl });
  assert.equal(good.verdict, 'qualified');
  assert.equal(good.email, 'hello@northlight.example');
  assert.equal(good.inviteCode, 'abc123');

  assert.equal((await assess({ url: 'https://top.gg/servers/1' }, { store, fetchImpl })).verdict, 'platform, not a company');

  const noDiscord = await assess({ url: 'https://plain.example/' }, { store, segment: 'x', fetchImpl: async (u) => u.endsWith('/robots.txt') ? html('User-agent: *\n') : html('<title>Plain</title><a href="mailto:a@plain.example">c</a>') });
  assert.equal(noDiscord.verdict, 'no Discord on the site');

  const noEmail = await assess({ url: 'https://quiet.example/' }, { store, segment: 'x', fetchImpl: async (u) => u.endsWith('/robots.txt') ? html('User-agent: *\n') : html('<title>Quiet</title><a href="https://discord.gg/z">d</a>') });
  assert.equal(noEmail.verdict, 'no published contact address');

  const blocked = await assess({ url: 'https://shy.example/' }, { store, segment: 'x', fetchImpl: async (u) => u.endsWith('/robots.txt') ? html('User-agent: *\nDisallow: /\n') : html(PAGE) });
  assert.match(blocked.verdict, /robots\.txt/);
});

test('a contact page is read only when the homepage had an invite but no address', async () => {
  const store = memoryStore();
  const hits = [];
  const fetchImpl = async (url) => {
    hits.push(url);
    if (url.endsWith('/robots.txt')) return html('User-agent: *\n');
    if (url.endsWith('/contact')) return html('<a href="mailto:studio@maple.example">write</a>');
    return html('<title>Maple</title><a href="https://discord.gg/m">d</a><a href="/contact">Contact</a>');
  };
  const r = await assess({ url: 'https://maple.example/' }, { store, segment: 'club', fetchImpl });
  assert.equal(r.verdict, 'qualified');
  assert.equal(r.email, 'studio@maple.example');
  assert.equal(hits.filter((h) => !h.endsWith('/robots.txt')).length, 2, 'exactly two pages, never a crawl');
});

test('suppression is permanent and stops discovery finding them again', async () => {
  const store = memoryStore();
  await suppress(store, { email: 'hello@northlight.example', host: 'northlight.example', reason: 'declined' });
  assert.equal(await isSuppressed(store, { host: 'northlight.example' }), true);
  assert.equal(await isSuppressed(store, { email: 'hello@northlight.example' }), true);
  assert.equal(await isSuppressed(store, { host: 'other.example' }), false);

  const fetchImpl = async (u) => u.endsWith('/robots.txt') ? html('User-agent: *\n') : html(PAGE);
  const r = await assess({ url: 'https://northlight.example/' }, { store, segment: 'x', fetchImpl });
  assert.equal(r.verdict, 'suppressed');
});

test('the full tick searches, qualifies, promotes — and never adds the same company twice', async () => {
  const store = memoryStore();
  const secrets = { GOOGLE_CSE_KEY: 'k', GOOGLE_CSE_CX: 'c' };
  const fetchImpl = async (url) => {
    if (url.includes('googleapis.com/customsearch')) {
      return html(JSON.stringify({ items: [
        { link: 'https://northlight.example/', title: 'Northlight Games' },
        { link: 'https://top.gg/servers/9', title: 'A directory' },
        { link: 'https://quiet.example/', title: 'No contact' },
      ] }));
    }
    if (url.endsWith('/robots.txt')) return html('User-agent: *\n');
    if (url.includes('quiet.example')) return html('<title>Quiet</title><a href="https://discord.gg/z">d</a>');
    return html(PAGE);
  };

  const s1 = await discoverTick({ store, secrets, settings: { cadenic: { queriesPerRun: 1 } }, fetchImpl, now: Date.parse('2026-09-17T05:30:00Z') });
  assert.equal(s1.provider, 'google');
  assert.equal(s1.qualified, 1);
  assert.equal(s1.added, 1);
  assert.equal(s1.rejected['platform, not a company'], 1);
  assert.equal(s1.rejected['no published contact address'], 1);

  const queued = (await store.list(PROSPECTS)).map((d) => d.data);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].email, 'hello@northlight.example');
  assert.equal(queued[0].status, 'new');
  assert.equal(queued[0].foundBy, 'discovery');

  // Same day again: everything is already assessed, so nothing new is added.
  const s2 = await discoverTick({ store, secrets, settings: { cadenic: { queriesPerRun: 1 } }, fetchImpl, now: Date.parse('2026-09-17T05:30:00Z') });
  assert.equal(s2.added, 0);
  /* Two, not three: the platform check is free and runs before the
     already-assessed lookup, so top.gg is refused for what it is rather than
     for having been seen. Cheapest check first is the right order; the test
     records that it is the order. */
  assert.equal(s2.rejected['already assessed'], 2);
  assert.equal(s2.rejected['platform, not a company'], 1);
  assert.equal((await store.list(PROSPECTS)).length, 1, 'one contact per company, ever');
});

test('with no search key it says so and touches nothing', async () => {
  const store = memoryStore();
  let called = false;
  const s = await discoverTick({ store, secrets: {}, fetchImpl: async () => { called = true; return html('{}'); } });
  assert.equal(s.provider, null);
  assert.match(s.note, /GOOGLE_CSE_KEY/);
  assert.equal(called, false, 'no key means no requests at all, and never a SERP scrape');
  assert.equal((await store.list(PROSPECTS)).length, 0);
});

test('the ceilings hold: a generous search cannot flood the queue', async () => {
  const store = memoryStore();
  const many = Array.from({ length: 10 }, (_, i) => ({ link: `https://co${i}.example/`, title: `Co ${i}` }));
  const fetchImpl = async (url) => {
    if (url.includes('customsearch')) return html(JSON.stringify({ items: many }));
    if (url.includes('api.search.brave.com')) return html(JSON.stringify({ web: { results: many.map((m) => ({ url: m.link, title: m.title })) } }));
    if (url.endsWith('/robots.txt')) return html('User-agent: *\n');
    const host = new URL(url).hostname;
    return html(`<title>${host}</title><a href="https://discord.gg/x">d</a><a href="mailto:hi@${host}">c</a>`);
  };
  const s = await discoverTick({ store, secrets: { BRAVE_SEARCH_KEY: 'b' }, settings: { cadenic: { maxNewPerRun: 3, queriesPerRun: 2 } }, fetchImpl });
  assert.equal(s.added, 3, 'stops dead at the ceiling');
  assert.equal((await store.list(PROSPECTS)).length, 3);
});

test('the queries rotate by day so a free quota covers every segment', () => {
  const a = queriesForDay(Date.parse('2026-09-16T12:00:00Z'), 3);
  const b = queriesForDay(Date.parse('2026-09-17T12:00:00Z'), 3);
  assert.notEqual(a.segment.key, b.segment.key);
  const keys = new Set();
  for (let i = 0; i < SEGMENTS.length; i++) keys.add(queriesForDay(Date.parse('2026-09-16T12:00:00Z') + i * 86_400_000).segment.key);
  assert.equal(keys.size, SEGMENTS.length, 'every segment gets a turn within one cycle');
  assert.equal(searchProvider({ BRAVE_SEARCH_KEY: 'x' }), 'brave');
  assert.equal(searchProvider({ GOOGLE_CSE_KEY: 'x', GOOGLE_CSE_CX: 'y' }), 'google');
  assert.equal(searchProvider({}), null);
});

test('discoveryStats reports the refusals, because that is how the queries get tuned', () => {
  const now = Date.now();
  const st = discoveryStats([
    { verdict: 'qualified', seenAt: new Date(now - 1000).toISOString() },
    { verdict: 'no Discord on the site', seenAt: new Date(now - 2000).toISOString() },
    { verdict: 'no Discord on the site', seenAt: new Date(now - 3000).toISOString() },
    { verdict: 'qualified', seenAt: new Date(now - 10 * 86_400_000).toISOString() },
  ], now - 86_400_000);
  assert.equal(st.seen, 3);
  assert.equal(st.qualified, 1);
  assert.equal(st.by['no Discord on the site'], 2);
});

test('a failed search says what is actually wrong, because each cause has a different one-click fix', async () => {
  const err = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }), text: async () => message });

  const noCx = await search({ secrets: { GOOGLE_CSE_KEY: 'k' }, query: 'x', fetchImpl: async () => err(400, 'Request contains an invalid argument.') });
  assert.match(noCx.reason, /GOOGLE_CSE_CX is not/, 'a key with no engine id is caught before the request');

  const notEnabled = await search({ secrets: { GOOGLE_CSE_KEY: 'k', GOOGLE_CSE_CX: 'c' }, query: 'x', fetchImpl: async () => err(403, 'This project does not have the access to Custom Search JSON API.') });
  assert.match(notEnabled.reason, /not enabled on that Google Cloud project/);

  const badKey = await search({ secrets: { GOOGLE_CSE_KEY: 'k', GOOGLE_CSE_CX: 'c' }, query: 'x', fetchImpl: async () => err(400, 'API key not valid. Please pass a valid API key.') });
  assert.match(badKey.reason, /key is not valid/);

  const spent = await search({ secrets: { GOOGLE_CSE_KEY: 'k', GOOGLE_CSE_CX: 'c' }, query: 'x', fetchImpl: async () => err(429, 'Quota exceeded') });
  assert.match(spent.reason, /100 free Google queries are spent/);

  const brave = await search({ secrets: { BRAVE_SEARCH_KEY: 'b' }, query: 'x', fetchImpl: async () => err(401, 'nope') });
  assert.match(brave.reason, /Brave Search key was refused/);
});

test('a half-finished setup is reported in the digest rather than failing silently', async () => {
  const store = memoryStore();
  const s = await discoverTick({ store, secrets: { GOOGLE_CSE_KEY: 'k' }, fetchImpl: async () => { throw new Error('should not be called'); } });
  assert.equal(s.provider, null, 'a key without an engine id is not a usable provider');
  assert.match(s.note, /GOOGLE_CSE_KEY/);
  assert.equal((await store.list(PROSPECTS)).length, 0);
});
