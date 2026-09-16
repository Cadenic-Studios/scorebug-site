// Cadenic dispatch — FROM A SEARCH RESULT TO A PROSPECT
//
// ─── WHAT THIS DOES ─────────────────────────────────────────────────────────
//
// sources.js returns URLs. This turns a URL into either a prospect or a
// recorded "no", and it is the half where the care lives, because this is the
// step that decides whose inbox gets used.
//
//   robots    every domain's robots.txt is read and obeyed before any page of
//             theirs is fetched. Not because a crawler is obliged to, but
//             because a studio that ignores robots.txt has no standing to talk
//             to anybody about how to run software politely.
//   fetch     one page per domain, ever. The homepage, then at most one
//             contact-looking page found on it. Never a crawl.
//   extract   the Discord invite, a published contact address, and the name
//             the business calls itself.
//   qualify   both an invite and an address, or it is not a prospect. A
//             company with no published address has not invited contact, and
//             guessing info@ is exactly the behaviour that makes cold email
//             the thing everybody hates.
//   suppress  a permanent do-not-contact list, checked before anything is
//             written. Anyone who declined, said stop, or bounced is on it
//             forever, and one person per domain is contacted EVER.
//
// ─── THE LEGAL SHAPE, ON PURPOSE ────────────────────────────────────────────
//
// Canada's anti-spam law allows a commercial message to an address a business
// has conspicuously published, where the message is relevant to that person's
// role and carries sender identification and a working unsubscribe. Every part
// of that sentence is a rule in this file: we only take addresses from the
// company's own website (published), we only keep companies that run a Discord
// (relevant), and prospects.js refuses to send without the postal address and
// the stop line. Nothing here buys a list, guesses an address, or takes one
// from a directory that scraped it from somewhere else.

import { PROSPECTS, normalizeProspect, inviteCode } from './prospects.js';
import { search, searchProvider, queriesForDay, USER_AGENT } from './sources.js';
import { harvest } from './feeds.js';

export const CANDIDATES = 'dispatch/state/candidates/';
export const SUPPRESSION = 'dispatch/state/suppression/';

/** Addresses that are never a person, and never a sales contact. */
const ROLE_DENY = /^(noreply|no-reply|donotreply|postmaster|abuse|dmca|legal|privacy|security|webmaster|hostmaster|admin@example|unsubscribe|bounce)/i;
/** Domains that are never a prospect — platforms, not companies. */
const HOST_DENY = /(^|\.)(discord\.com|discord\.gg|disboard\.org|top\.gg|discadia\.com|discords\.com|reddit\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|twitch\.tv|patreon\.com|ko-fi\.com|github\.com|github\.io|medium\.com|substack\.com|wikipedia\.org|linktr\.ee|carrd\.co|notion\.site|google\.com|apple\.com|microsoft\.com|amazon\.|shopify\.com|squarespace\.com|wixsite\.com|itch\.io)$/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const INVITE_RE = /https?:\/\/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/gi;

export function hostOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function isPlatform(host) { return HOST_DENY.test(host); }

/* ═══════════════════════════════════════════════════════════════ ROBOTS */

/**
 * A deliberately small robots.txt reader: the groups that apply to us, and the
 * Disallow prefixes in them. It errs toward being allowed only when robots.txt
 * does not exist — a 5xx or a timeout means we do not fetch the site at all,
 * because "their server is struggling" is the worst possible moment to add a
 * request.
 */
export async function robotsAllows(host, path = '/', { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://${host}/robots.txt`, { signal: ctl.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/plain' } });
    if (res.status === 404 || res.status === 410) return { allowed: true, reason: 'no robots.txt' };
    if (!res.ok) return { allowed: false, reason: `robots.txt answered ${res.status}` };
    const txt = (await res.text()).slice(0, 100_000);

    let applies = false, sawAny = false;
    const rules = [];
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const [k, ...rest] = line.split(':');
      const key = k.trim().toLowerCase();
      const val = rest.join(':').trim();
      if (key === 'user-agent') {
        const ua = val.toLowerCase();
        const mine = ua === '*' || USER_AGENT.toLowerCase().includes(ua.replace(/\*/g, ''));
        if (sawAny && applies && !mine) break;   // end of our group
        applies = mine;
        sawAny = true;
      } else if (applies && (key === 'disallow' || key === 'allow')) {
        rules.push({ allow: key === 'allow', prefix: val });
      }
    }
    // Longest match wins, which is the documented behaviour.
    const match = rules
      .filter((r) => r.prefix && path.startsWith(r.prefix))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (match && !match.allow) return { allowed: false, reason: `robots.txt disallows ${match.prefix}` };
    if (rules.some((r) => r.prefix === '/' && !r.allow) && !match) return { allowed: false, reason: 'robots.txt disallows everything' };
    return { allowed: true, reason: 'allowed' };
  } catch (e) {
    return { allowed: false, reason: `robots.txt unreachable (${String(e.message || e).slice(0, 40)})` };
  } finally {
    clearTimeout(t);
  }
}

/* ══════════════════════════════════════════════════════════════ EXTRACT */

export function extract(html, { host }) {
  const page = String(html || '').slice(0, 600_000);

  const invites = [...new Set([...page.matchAll(INVITE_RE)].map((m) => m[0]))];

  /* mailto: first. An address a company put behind a mailto is unambiguously
     published for contact; one that merely appears in body text might be a
     customer's, a quote, or a screenshot's alt text. */
  const mailtos = [...page.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => m[1]);
  const inText = [...page.matchAll(EMAIL_RE)].map((m) => m[0]);
  const emails = [...new Set([...mailtos, ...inText])]
    .map((e) => e.trim().toLowerCase())
    .filter((e) => !ROLE_DENY.test(e))
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(e))
    .filter((e) => {
      const d = e.split('@')[1] || '';
      // Prefer their own domain; allow a different one only if nothing else.
      return d && !isPlatform(d);
    });
  const own = emails.filter((e) => (e.split('@')[1] || '').endsWith(host.split('.').slice(-2).join('.')));
  const email = own[0] || emails[0] || '';

  const ogName = (page.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) || [])[1];
  const title = (page.match(/<title[^>]*>([^<]{2,120})</i) || [])[1];
  const name = (ogName || title || host).replace(/\s*[|\-–—]\s*(home|official site|welcome).*$/i, '').trim().slice(0, 80);

  // A contact-ish path on the same site, for a second look if we found no address.
  const contactPath = (page.match(/href=["'](\/[^"']*(?:contact|about|support|press|impressum)[^"']*)["']/i) || [])[1] || '';

  return { invites, email, name, contactPath, notice: noUnsolicitedNotice(page, email) };
}

/* ═══════════════════════════════════════════ THE CASL NOTICE CHECK */

/**
 * WHY A STRING SEARCH IS A LEGAL CONTROL.
 *
 * CASL lets us email a business address the business published itself, without
 * prior consent — but only when "the publication is not accompanied by a
 * statement that the person does not wish to receive unsolicited commercial
 * electronic messages at the electronic address". That clause is the whole
 * basis on which this engine is allowed to exist, and it has a condition
 * attached that a crawler can actually check.
 *
 * So we check it, and we record the answer, because the burden of proving
 * implied consent falls on the sender. "We did not notice the notice" is not a
 * defence anybody has ever won with.
 *
 * The window matters. A "no unsolicited offers" line in a careers section
 * three thousand characters away is about recruiters, not about us; a line
 * beside the address is about us. Twelve hundred characters either side is
 * roughly the surrounding block on a contact page.
 */
const NOTICE_RE = /\b(no[\s-]?unsolicited|unsolicited (?:commercial )?(?:e-?mail|messages|offers|enquir|inquir|pitch|solicitation)|do not (?:send|email) (?:us )?(?:any )?(?:unsolicited|marketing|sales|promotional)|no (?:sales|marketing|vendor|spam) (?:e-?mail|enquir|inquir|pitch|solicitation)|not accept unsolicited|we do not accept (?:sales|vendor|marketing))/i;

export function noUnsolicitedNotice(html, email, window = 1200) {
  const page = String(html || '');
  if (!email) return '';
  const at = page.toLowerCase().indexOf(String(email).toLowerCase());
  const near = at < 0 ? page.slice(0, 4000) : page.slice(Math.max(0, at - window), at + window);
  const hit = near.match(NOTICE_RE);
  return hit ? hit[0].replace(/\s+/g, ' ').trim() : '';
}

/* ══════════════════════════════════════════════════════ SUPPRESSION LIST */

export function suppressionKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120);
}

export async function suppress(store, { email = '', host = '', reason = 'declined' }) {
  const stamp = new Date().toISOString();
  if (email) await store.set(SUPPRESSION + suppressionKey(email), { kind: 'email', value: email.toLowerCase(), reason, at: stamp });
  if (host) await store.set(SUPPRESSION + suppressionKey(host), { kind: 'host', value: host.toLowerCase(), reason, at: stamp });
}

export async function isSuppressed(store, { email = '', host = '' }) {
  if (email && await store.get(SUPPRESSION + suppressionKey(email))) return true;
  if (host && await store.get(SUPPRESSION + suppressionKey(host))) return true;
  return false;
}

/* ═════════════════════════════════════════════════════════════ ONE PAGE */

async function getPage(url, { fetchImpl = fetch, timeoutMs = 9000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' } });
    if (!res.ok) return { ok: false, reason: `${res.status}` };
    return { ok: true, html: await res.text() };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 60) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * One search result → one verdict. Returns the candidate document, whose
 * `verdict` is either 'qualified' or the reason it is not. Every rejection is
 * written down: without that the beat cannot be tuned, and a query that
 * returns forty platform pages looks identical to one that returns nothing.
 */
export async function assess(result, { store, segment, fetchImpl = fetch }) {
  const host = hostOf(result.url);
  const base = { url: result.url, host, title: result.title || '', segment, seenAt: new Date().toISOString() };
  if (!host) return { ...base, verdict: 'unreadable url' };
  if (isPlatform(host)) return { ...base, verdict: 'platform, not a company' };

  if (await store.get(CANDIDATES + suppressionKey(host))) return { ...base, verdict: 'already assessed' };
  if (await isSuppressed(store, { host })) return { ...base, verdict: 'suppressed' };

  const path = (() => { try { return new URL(result.url).pathname || '/'; } catch { return '/'; } })();
  const robots = await robotsAllows(host, path, { fetchImpl });
  if (!robots.allowed) return { ...base, verdict: robots.reason };

  const page = await getPage(result.url, { fetchImpl });
  if (!page.ok) return { ...base, verdict: `page ${page.reason}` };

  let found = extract(page.html, { host });

  /* One second page, only when the first had an invite but no address — the
     contact page is where a company puts the address it wants used. */
  if (found.invites.length && !found.email && found.contactPath) {
    const second = await robotsAllows(host, found.contactPath, { fetchImpl });
    if (second.allowed) {
      const cp = await getPage(`https://${host}${found.contactPath}`, { fetchImpl });
      if (cp.ok) {
        const more = extract(cp.html, { host });
        found = { ...found, email: more.email || found.email, name: found.name || more.name };
      }
    }
  }

  if (!found.invites.length) return { ...base, verdict: 'no Discord on the site' };

  /* Steam publishes a support address as structured data on the store page.
     It is used only when the company's own site shows none, and it carries its
     own provenance URL, because the address was published there and not here. */
  let emailSource = result.url;
  if (!found.email && result.emailHint) {
    found = { ...found, email: result.emailHint, notice: '' };
    emailSource = result.emailHintSource || result.url;
  }

  if (!found.email) return { ...base, verdict: 'no published contact address' };

  /* They said not to. That is the end of it — recorded as a candidate so the
     same site is not re-assessed tomorrow, and never promoted to a prospect. */
  if (found.notice) return { ...base, verdict: 'asked not to receive unsolicited email', notice: found.notice };

  if (await isSuppressed(store, { email: found.email })) return { ...base, verdict: 'suppressed' };

  return {
    ...base, verdict: 'qualified', name: found.name, email: found.email,
    discordInvite: found.invites[0], inviteCode: inviteCode(found.invites[0]),
    /* ── THE CASL RECORD ──────────────────────────────────────────────────
       Where the address was published, when we saw it, and that no notice
       refusing unsolicited mail accompanied it. Kept per lead because the
       sender carries the burden of demonstrating implied consent, and an
       argument made eighteen months later is only as good as what was
       written down on the day. Conspicuous-publication consent does not
       expire, so this record does not either. */
    provenance: { source: emailSource, via: result.via || 'search', checkedAt: base.seenAt, noticeFound: false, basis: 'CASL s.10(9)(b) conspicuous publication' },
  };
}

/* ══════════════════════════════════════════════════════════════════ TICK */

/**
 * The discovery beat. Searches, assesses, and promotes what qualifies into the
 * prospect queue that prospects.js already enriches, drafts and hands to the
 * digest for approval.
 *
 * Every cap here exists so that a bad day is a small day: a handful of
 * queries, a bounded number of pages, and a hard ceiling on how many new
 * prospects can enter the queue in one run. A discovery beat without a ceiling
 * is a machine for generating regret at scale.
 */
export async function discoverTick({ store, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const cfg = settings.cadenic || {};
  const summary = { provider: searchProvider(secrets), searched: 0, seen: 0, qualified: 0, added: 0, rejected: {}, feeds: {} };
  if (cfg.discover === false) { summary.note = 'discovery off'; return summary; }

  const maxNew = Number(cfg.maxNewPerRun) || 8;
  const maxPages = Number(cfg.maxPagesPerRun) || 40;
  const { segment, queries } = queriesForDay(now, Number(cfg.queriesPerRun) || 3);

  /**
   * ── TWO POPULATIONS, ONE ASSESSOR ──────────────────────────────────────
   *
   * The keyless feeds run first, and they run whether or not a search key
   * exists. That ordering is deliberate: this beat used to return on its
   * second line when GOOGLE_CSE_CX was unset, which meant the entire revenue
   * side of the engine was gated behind a console setup nobody had finished,
   * and the digest reported "no search key" every morning for days while
   * finding nothing. A machine that cannot start without a key it does not
   * have is not a machine.
   *
   * Both populations go through exactly the same `assess`: robots.txt, the
   * company's own page, a published address, no notice refusing unsolicited
   * mail. A lead from Hacker News gets no easier ride than one from Google.
   */
  const leads = [];
  if (cfg.feeds !== false) {
    const h = await harvest({ secrets, now, perDay: Number(cfg.feedsPerRun) || 2, fetchImpl, log });
    summary.feeds = h.notes;
    leads.push(...h.results.map((r) => ({ ...r, segment: r.via })));
  }

  if (summary.provider) {
    for (const q of queries) {
      const found = await search({ secrets, query: q, count: 10, fetchImpl });
      summary.searched++;
      if (!found.ok) { summary.note = found.reason; log('discover', q, found.reason); continue; }
      leads.push(...found.results.map((r) => ({ ...r, segment: segment.label, foundQuery: q })));
    }
  } else if (!leads.length) {
    summary.note = 'no search key and no feed returned anything — set GOOGLE_CSE_KEY and GOOGLE_CSE_CX (free, 100/day, no card) or BRAVE_SEARCH_KEY';
    return summary;
  } else {
    summary.note = 'running on the keyless feeds only; a search key would widen this';
  }

  for (const r of leads) {
    if (summary.added >= maxNew || summary.seen >= maxPages) break;
    summary.seen++;
    try {
      const c = await assess(r, { store, segment: r.segment || segment.label, fetchImpl });
      await store.set(CANDIDATES + suppressionKey(c.host || c.url), c);
      if (c.verdict !== 'qualified') {
        summary.rejected[c.verdict] = (summary.rejected[c.verdict] || 0) + 1;
        continue;
      }
      summary.qualified++;
      const p = normalizeProspect({ email: c.email, name: '', company: c.name, site: `https://${c.host}`, discord: c.discordInvite, segment: c.segment }, now);
      if (!p) continue;
      if (await store.get(PROSPECTS + p.id)) continue;   // one contact per company, ever
      await store.set(PROSPECTS + p.id, { ...p, foundBy: r.via || 'discovery', foundQuery: r.foundQuery || '', provenance: c.provenance || null });
      summary.added++;
    } catch (e) {
      log('discover', r.url, String(e.message || e));
    }
  }

  /* The digest runs hours after this beat and in a different process, so the
     only way it can report which sources produced anything is if the beat
     writes it down. A feed silently returning nothing for a week is otherwise
     invisible, which is the failure mode that matters here: discovery does not
     crash when a source dies, it just quietly finds less. */
  await store.set('dispatch/state/meta/discovery', { at: new Date(now).toISOString(), ...summary });
  return summary;
}

/** For the digest: what discovery has done lately, and why things were refused. */
export function discoveryStats(candidates, sinceMs) {
  const recent = candidates.filter((c) => Date.parse(c.seenAt || 0) >= sinceMs);
  const by = {};
  for (const c of recent) by[c.verdict] = (by[c.verdict] || 0) + 1;
  return { seen: recent.length, qualified: by.qualified || 0, by };
}
