// Cadenic dispatch — WHERE PROSPECTS COME FROM
//
// ─── THE REFRAME THAT MAKES THIS WORK ───────────────────────────────────────
//
// The obvious way to find Discord prospects is to look for Discord servers,
// on the directories that list them. That is the wrong list. A five-thousand
// member anime server has a community and no budget; nobody there is buying
// software. The list that converts is the opposite shape:
//
//     a BUSINESS that already has a Discord link on its own website.
//
// That single filter does an extraordinary amount of work. It means somebody
// decided a community was worth having (so the need is real and already felt),
// it means there is a company behind it (so there is a budget and an invoice
// address), and it means they published a contact address themselves (which is
// the basis on which a commercial email to them is lawful in Canada). A
// directory listing gives you none of those three.
//
// So we do not search for servers. We search the web for companies, and keep
// the ones whose own site links to Discord.
//
// ─── WHAT WE SEARCH WITH ────────────────────────────────────────────────────
//
// A real search API, not scraping a search engine's results page. Two are
// supported and either is enough:
//
//   Google Programmable Search  100 queries/day free, no card. The default.
//   Brave Search API            2,000 queries/month free.
//
// Both are documented products whose whole purpose is programmatic search,
// which is the difference between using a service and abusing one. With
// neither key the beat says so in the digest and does nothing — it never falls
// back to scraping a SERP.
//
// GitHub's code search is a third source, for the developer-tools segment. It
// is an official API, it needs a free token, and it finds a kind of prospect
// the web search does not: a project whose README carries a discord.gg link
// and whose maintainer is, by construction, technical enough to want a bot.

const UA = 'CadenicStudiosBot/1.0 (+https://cadenic.studio; prospect research; hello@cadenic.studio)';
export const USER_AGENT = UA;

/* ══════════════════════════════════════════════════════════ THE QUERIES */

/**
 * What to look for, as data.
 *
 * Each entry is one segment and the queries that surface it. They rotate by
 * the day of the year so a free 100-a-day quota covers every segment across a
 * week instead of burning out on one — and so the same query does not return
 * the same first page every morning.
 *
 * `-site:` exclusions matter more than the positive terms. Without them every
 * query returns the Discord directories themselves, which is exactly the list
 * this module exists to avoid.
 */
const EXCLUDE = [
  '-site:disboard.org', '-site:top.gg', '-site:discadia.com', '-site:discords.com',
  '-site:discord.com', '-site:reddit.com', '-site:twitter.com', '-site:x.com',
  '-site:facebook.com', '-site:youtube.com', '-site:medium.com', '-site:github.io',
].join(' ');

export const SEGMENTS = [
  {
    key: 'game-studio',
    label: 'game studio',
    queries: [
      '"discord.gg" "indie game" studio site:.ca',
      '"join our discord" indie game developer devlog',
      '"discord.gg" "wishlist on steam" studio',
      '"our discord" game studio press kit',
    ],
  },
  {
    key: 'creator',
    label: 'creator',
    queries: [
      '"discord.gg" patreon "supporters" community',
      '"join the discord" newsletter creator substack',
      '"discord.gg" ko-fi members community',
    ],
  },
  {
    key: 'streamer',
    label: 'streamer',
    queries: [
      '"discord.gg" twitch "business inquiries" canada',
      '"discord.gg" "sponsorship" streamer media kit',
    ],
  },
  {
    key: 'saas',
    label: 'software company',
    queries: [
      '"discord.gg" changelog "sign up" saas',
      '"join our discord" developer api documentation',
      '"discord.gg" "open source" "contact us" tool',
    ],
  },
  {
    key: 'commerce',
    label: 'shop or brand',
    queries: [
      '"discord.gg" "add to cart" brand community',
      '"discord.gg" trading cards shop events canada',
      '"discord.gg" tabletop games store',
    ],
  },
  {
    key: 'club',
    label: 'club or league',
    queries: [
      '"discord.gg" hockey club canada members',
      '"discord.gg" esports organisation roster canada',
      '"discord.gg" running club OR cycling club community',
    ],
  },
];

/** Today's queries: one segment, rotated, so a free quota lasts a week. */
export function queriesForDay(now = Date.now(), perDay = 3) {
  const day = Math.floor(now / 86_400_000);
  const seg = SEGMENTS[day % SEGMENTS.length];
  const start = (day * perDay) % seg.queries.length;
  const picked = [];
  for (let i = 0; i < Math.min(perDay, seg.queries.length); i++) {
    picked.push(seg.queries[(start + i) % seg.queries.length]);
  }
  return { segment: seg, queries: [...new Set(picked)] };
}

/* ══════════════════════════════════════════════════════════ THE ADAPTERS */

async function googleSearch({ key, cx, query, count = 10, fetchImpl = fetch }) {
  const u = new URL('https://www.googleapis.com/customsearch/v1');
  u.searchParams.set('key', key);
  u.searchParams.set('cx', cx);
  u.searchParams.set('q', `${query} ${EXCLUDE}`);
  u.searchParams.set('num', String(Math.min(10, count)));
  const res = await fetchImpl(u.toString(), { headers: { accept: 'application/json' } });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    /* ── SAY WHAT GOOGLE SAID ─────────────────────────────────────────────
     * This returned `google 403` and nothing else, which is the least useful
     * sentence available: the three things that produce a 4xx here have three
     * completely different fixes, and two of them are one click each.
     *
     *   400 "API key not valid"          the key is wrong
     *   403 "does not have the access"   the Custom Search API is not enabled
     *                                    on that Cloud project
     *   400 (no cx)                      the search engine ID is missing
     *   429                              the free 100 a day is spent
     *
     * Google names which one it is. Passing that through means the digest can
     * print a sentence somebody can act on instead of a status code. */
    const said = (j && j.error && j.error.message) || '';
    if (/API key not valid/i.test(said)) return { ok: false, reason: 'the Google API key is not valid' };
    if (/does not have the access/i.test(said)) return { ok: false, reason: 'the Custom Search API is not enabled on that Google Cloud project — enable it at console.cloud.google.com, then wait a minute' };
    if (res.status === 429) return { ok: false, reason: "the day's 100 free Google queries are spent; it resets at midnight Pacific" };
    return { ok: false, reason: said ? `google: ${said}` : `google ${res.status}` };
  }
  return { ok: true, results: ((j && j.items) || []).map((i) => ({ url: i.link, title: i.title || '', snippet: i.snippet || '' })) };
}

async function braveSearch({ key, query, count = 10, fetchImpl = fetch }) {
  const u = new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q', `${query} ${EXCLUDE}`);
  u.searchParams.set('count', String(Math.min(20, count)));
  const res = await fetchImpl(u.toString(), { headers: { accept: 'application/json', 'X-Subscription-Token': key } });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'the Brave Search key was refused' };
    if (res.status === 429) return { ok: false, reason: 'the Brave Search quota is spent for now' };
    return { ok: false, reason: `brave ${res.status}` };
  }
  const j = await res.json();
  return { ok: true, results: ((j.web && j.web.results) || []).map((r) => ({ url: r.url, title: r.title || '', snippet: r.description || '' })) };
}

/**
 * GitHub code search. A different kind of prospect: the maintainer of a
 * project whose README links a Discord is technical by construction, already
 * running a community, and the likeliest person alive to want a bot that
 * answers from their own data.
 */
export async function githubSearch({ token, query = '"discord.gg" filename:README.md', count = 10, fetchImpl = fetch }) {
  if (!token) return { ok: false, reason: 'no GITHUB_TOKEN' };
  const u = new URL('https://api.github.com/search/code');
  u.searchParams.set('q', query);
  u.searchParams.set('per_page', String(Math.min(30, count)));
  const res = await fetchImpl(u.toString(), {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': UA, 'x-github-api-version': '2022-11-28' },
  });
  if (!res.ok) return { ok: false, reason: `github ${res.status}` };
  const j = await res.json();
  const results = (j.items || [])
    .map((i) => i.repository && i.repository.homepage ? { url: i.repository.homepage, title: i.repository.full_name || '', snippet: i.repository.description || '' } : null)
    .filter(Boolean);
  return { ok: true, results };
}

/**
 * One search, whichever key exists. Google first because its free tier needs
 * no card, which is the difference between "set this up in two minutes" and
 * "set this up eventually".
 */
export async function search({ secrets = {}, query, count = 10, fetchImpl = fetch }) {
  /* A key with no engine id is the commonest half-finished setup, and it is
     worth its own sentence: the key comes from one Google console and the id
     from a different one, so having the first and not the second is the
     normal way through. */
  if (secrets.GOOGLE_CSE_KEY && !secrets.GOOGLE_CSE_CX && !secrets.BRAVE_SEARCH_KEY) {
    return { ok: false, reason: 'GOOGLE_CSE_KEY is set but GOOGLE_CSE_CX is not — create the engine at programmablesearchengine.google.com, tick "Search the entire web", and copy its ID' };
  }
  if (secrets.GOOGLE_CSE_KEY && secrets.GOOGLE_CSE_CX) {
    return googleSearch({ key: secrets.GOOGLE_CSE_KEY, cx: secrets.GOOGLE_CSE_CX, query, count, fetchImpl });
  }
  if (secrets.BRAVE_SEARCH_KEY) {
    return braveSearch({ key: secrets.BRAVE_SEARCH_KEY, query, count, fetchImpl });
  }
  return { ok: false, reason: 'no search key — set GOOGLE_CSE_KEY + GOOGLE_CSE_CX, or BRAVE_SEARCH_KEY' };
}

export function searchProvider(secrets = {}) {
  if (secrets.GOOGLE_CSE_KEY && secrets.GOOGLE_CSE_CX) return 'google';
  if (secrets.BRAVE_SEARCH_KEY) return 'brave';
  return null;
}
