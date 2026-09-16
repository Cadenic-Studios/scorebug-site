// Cadenic dispatch — THE OUTREACH BEAT
//
// ─── WHAT THIS IS ───────────────────────────────────────────────────────────
//
// The first Cadenic tenant inside the engine that was built for Scorebug. It
// takes a list of prospects — a name, an address, a Discord invite — and does
// everything a salesperson would do before the first reply, without a person
// touching it:
//
//   enrich   resolve the invite through Discord's public API and read the
//            server the way a prospect never does: how many members, how many
//            are actually present, whether it is discoverable, whether the
//            address they print anywhere is a discord.gg link that will die.
//   draft    a short, specific email built ONLY from those findings — three
//            things we noticed about your server, no pitch, no call, a link to
//            the free teardown page.
//   lint     every number in the draft must exist in the findings. A claim the
//            findings cannot support is rejected outright, because a cold
//            email that gets one fact wrong is worse than no email.
//   queue    the draft waits in the digest for a signed approval. Outreach
//            NEVER goes out on autopilot. A bad social post is embarrassing;
//            a bad cold email to a business is a reputation and a CASL problem.
//   send     Resend, from the studio's verified domain, with the sender
//            identification and the working stop mechanism CASL requires.
//   follow   ten days after a send with no reply, one follow-up is drafted —
//            the one that lets them off the hook — and queued the same way.
//            Never a second one.
//   count    sent, replied, declined, converted, in the digest, so the beat is
//            judged on money and not on volume.
//
// ─── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
//
// It does not find prospects. Deciding which forty communities are worth a
// studio's attention is judgement, and the directories that list Discord
// servers have no public API worth building on. The list is a CSV Wyatt
// writes; everything after the CSV is the machine.
//
// It does not join servers. A bot cannot enter a server without an admin
// adding it, and a person joining forty strangers' servers to look around is
// exactly the behaviour a good community bans. Everything here is read from
// endpoints Discord makes public on purpose: the invite resolver, and the
// guild preview for discoverable servers.
//
// It does not DM anybody on Discord. Unsolicited DMs are against Discord's
// terms and get accounts banned, which would take the Scorebug bot with it.
//
// ─── CASL, IN ONE PARAGRAPH ─────────────────────────────────────────────────
//
// Canada's anti-spam law permits a commercial email to a business address that
// is published (a website contact, a bio) when the message is relevant to the
// recipient's role, provided it identifies the sender with a mailing address
// and offers a way to stop that works for sixty days. The draft carries all
// three or the linter refuses it, and the send refuses if CADENIC_POSTAL is
// not configured, because "we will add the address later" is how a company
// ends up sending a hundred emails without one.

import { createHash } from 'node:crypto';
import { bettingHit } from './safety.js';

export const PROSPECTS = 'dispatch/state/prospects/';

/** Ten days: long enough that silence is an answer, short enough to still be remembered. */
export const FOLLOW_UP_DAYS = 10;

/** A cold email that needs scrolling is a cold email that gets closed. */
export const OUTREACH_MAX_WORDS = 230;

/* ─────────────────────────────────────────────────────────── THE PROSPECT */

/** Stable id from the email, so re-importing a CSV updates rather than duplicates. */
export function prospectId(email) {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 16);
}

const INVITE_CODE = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([A-Za-z0-9-]+)/i;

export function inviteCode(value) {
  const s = String(value || '').trim();
  const m = s.match(INVITE_CODE);
  if (m) return m[1];
  // A bare code, pasted without the domain.
  if (/^[A-Za-z0-9-]{2,32}$/.test(s)) return s;
  return null;
}

/** Normalise one CSV row into a prospect document. Returns null for a row without an email. */
export function normalizeProspect(row, now = Date.now()) {
  const email = String(row.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return {
    id: prospectId(email),
    email,
    name: String(row.name || '').trim(),
    company: String(row.company || row.server || '').trim(),
    site: String(row.site || row.website || '').trim(),
    discordInvite: String(row.discord || row.discordInvite || row.invite || '').trim(),
    segment: String(row.segment || '').trim(),
    status: 'new',
    addedAt: new Date(now).toISOString(),
  };
}

/* ────────────────────────────────────────────────────────────── ENRICH */

const DISCORD = 'https://discord.com/api/v10';

/**
 * What Discord will tell anyone about a server from its invite, without a
 * token: name, description, features, and the two counts that matter.
 * `approximate_presence_count / approximate_member_count` is the single most
 * honest number about a community — how many of the people who joined are
 * actually there.
 */
export async function resolveInvite(code, { fetchImpl = fetch } = {}) {
  if (!code) return { ok: false, reason: 'no invite' };
  try {
    const res = await fetchImpl(`${DISCORD}/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { ok: false, reason: 'invite expired or invalid' };
    if (!res.ok) return { ok: false, reason: `discord ${res.status}` };
    const j = await res.json();
    const g = j.guild || {};
    const members = Number(j.approximate_member_count) || 0;
    const present = Number(j.approximate_presence_count) || 0;
    const features = Array.isArray(g.features) ? g.features : [];
    return {
      ok: true,
      guildId: g.id || null,
      guildName: g.name || '',
      description: g.description || '',
      members,
      present,
      presenceRatio: members ? Number((present / members).toFixed(3)) : null,
      community: features.includes('COMMUNITY'),
      discoverable: features.includes('DISCOVERABLE'),
      verificationLevel: Number(g.verification_level ?? -1),
      inviteExpires: j.expires_at || null,
      channelName: (j.channel && j.channel.name) || '',
    };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}

/**
 * Where does their own website send people for Discord? A discord.gg link is
 * the finding: it ranks for nothing, is not indexed, and dies when the invite
 * is regenerated. A page on their own domain is the fix, and it is the cheapest
 * package the studio sells.
 */
export async function inspectSite(site, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const url = String(site || '').trim();
  if (!url) return { checked: false };
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(href, { signal: ctl.signal, headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; CadenicStudios/1.0; +https://cadenic.studio)' } });
    if (!res.ok) return { checked: true, reachable: false, status: res.status };
    const html = (await res.text()).slice(0, 400_000);
    const rawInvites = [...html.matchAll(/https?:\/\/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/gi)].map((m) => m[0]);
    let host = '';
    try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* keep empty */ }
    const ownPage = host ? new RegExp(`https?://(?:www\\.)?${host.replace(/\./g, '\\.')}/[^"'\\s]*discord`, 'i').test(html) || /href="\/[^"]*discord[^"]*"/i.test(html) : false;
    return {
      checked: true,
      reachable: true,
      linksToInvite: rawInvites.length > 0,
      inviteLinks: [...new Set(rawInvites)].slice(0, 3),
      hasOwnDiscordPage: ownPage,
      mentionsDiscord: /discord/i.test(html),
    };
  } catch (e) {
    return { checked: true, reachable: false, error: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

export async function enrichProspect(p, { fetchImpl = fetch } = {}) {
  const code = inviteCode(p.discordInvite);
  const [invite, site] = await Promise.all([
    resolveInvite(code, { fetchImpl }),
    inspectSite(p.site, { fetchImpl }),
  ]);
  return { invite, site, enrichedAt: new Date().toISOString() };
}

/* ───────────────────────────────────────────────────────────── FINDINGS */

/**
 * The findings, as sentences a human would write, in priority order. This is
 * the ONLY material the model is given, and the linter checks the draft back
 * against these numbers, so nothing can be said that is not here.
 */
export function findings(p, enrichment) {
  const out = [];
  const inv = enrichment?.invite || {};
  const site = enrichment?.site || {};

  if (inv.ok) {
    if (inv.presenceRatio !== null && inv.members >= 50) {
      const pct = Math.round(inv.presenceRatio * 100);
      out.push({
        key: 'presence',
        numbers: [inv.members, inv.present, pct],
        text: `${inv.members.toLocaleString('en-CA')} members and ${inv.present.toLocaleString('en-CA')} present when I looked — about ${pct}%. ${pct < 10 ? 'That is the number people do not see from the inside, and it is almost always an onboarding problem rather than a content one.' : pct < 20 ? 'Respectable, and usually the first place there is easy ground to gain.' : 'That is a healthy room; most of what I would look at is keeping it that way as it grows.'}`,
      });
    }
    if (!inv.community) {
      out.push({ key: 'community', numbers: [], text: 'Community mode is off, which means no onboarding questions, no rules screening, no welcome screen and no eligibility for discovery — the four things that most decide whether a new arrival stays.' });
    } else if (!inv.discoverable) {
      out.push({ key: 'discoverable', numbers: [], text: 'Community mode is on but the server is not in Discovery, so nobody searching inside Discord can find it — only people who already hold a link.' });
    }
    if (inv.verificationLevel === 0) {
      out.push({ key: 'verification', numbers: [], text: 'Verification is at the lowest level, so a brand-new account can post immediately. That is where spam and the odd bad actor come from, and it costs one setting to change.' });
    }
    if (!inv.description) {
      out.push({ key: 'description', numbers: [], text: 'The server has no description, so an invite unfurls as a name and a member count and nothing else.' });
    }
  }
  if (site.checked && site.reachable) {
    if (site.linksToInvite && !site.hasOwnDiscordPage) {
      out.push({ key: 'invite-link', numbers: [], text: 'Your website sends people to a discord.gg link. Those pages are not indexed, they rank for nothing, and the link dies the moment the invite is regenerated — so everywhere you have printed it is printing something temporary. A page on your own domain fixes both and is the cheapest thing on this list.' });
    } else if (!site.mentionsDiscord) {
      out.push({ key: 'no-mention', numbers: [], text: 'Your website does not mention the Discord at all, so the community is only reachable by people who already know it exists.' });
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────── DRAFT */

const SYSTEM = `You write a short cold email from Wyatt at Cadenic Studios, a small Canadian software studio that builds Discord servers and bots.

VOICE: plain, warm, specific, a little dry. First person. No exclamation marks. No "I hope this finds you well". No "quick question". No superlatives. No "revolutionise", "unlock", "elevate", "leverage", "supercharge".

STRUCTURE (under ${OUTREACH_MAX_WORDS} words, total):
1. One line saying who you are and that you looked at their server this morning.
2. The findings, as two or three short observations. Use ONLY the findings you are given, and ONLY the numbers in them. Do not invent, round differently, or add any figure.
3. One sentence: the full written teardown — onboarding walkthrough, permissions, what a bot could answer from their data — is free at https://cadenic.studio/teardown, no call needed, nothing wanted back.
4. One sentence: if they would rather see prices first, they are at https://cadenic.studio/services/discord-engineering.
5. Sign off: "Wyatt" then a blank line then exactly the FOOTER you are given, unchanged.

HARD RULES: Never mention odds, betting, gambling or sportsbooks. Never promise a result. Never ask for a call or a meeting. Never say "follow up". Do not name any package price. Do not mention this email was drafted by software. Output the email body only — no subject line, no preamble, no markdown.`;

export function footer({ postal, email = 'hello@cadenic.studio' }) {
  return `Cadenic Studios · ${postal}\n${email} · cadenic.studio\nReply "stop" and you will not hear from me again.`;
}

export async function draftOutreach({ apiKey, model = 'claude-sonnet-4-5', prospect, found, postal, fetchImpl = fetch, timeoutMs = 25_000 }) {
  if (!apiKey) return { ok: false, reason: 'no ANTHROPIC_API_KEY' };
  if (!found.length) return { ok: false, reason: 'nothing found worth saying' };
  const foot = footer({ postal });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 700, temperature: 0.4,
        system: SYSTEM,
        messages: [{ role: 'user', content:
          `Recipient first name: ${prospect.name.split(/\s+/)[0] || 'there'}\nServer: ${prospect.company || '(unnamed)'}\n\nFINDINGS (use only these):\n${found.map((f, i) => `${i + 1}. ${f.text}`).join('\n')}\n\nFOOTER (copy exactly):\n${foot}` }],
      }),
    });
    if (!res.ok) return { ok: false, reason: `anthropic ${res.status}` };
    const out = await res.json();
    const body = (out.content || []).map((c) => c.text || '').join('').trim();
    const subject = `your Discord — ${found.length === 1 ? 'one thing' : `${['two', 'three', 'four', 'five'][found.length - 2] || found.length} things`} I noticed`;
    return { ok: true, subject, body };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/* ───────────────────────────────────────────────────────────────── LINT */

/**
 * Every number in the email must be a number in the findings. This is the
 * whole safety of the beat: a model given "1,240 members" will sometimes write
 * "over 1,200" or "1,240 people" or "about 1,250", and a prospect who knows
 * their own server will know instantly which of those is wrong.
 */
export function lintOutreach(body, found, { postal } = {}) {
  const problems = [];
  const text = String(body || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words > OUTREACH_MAX_WORDS) problems.push(`${words} words; limit is ${OUTREACH_MAX_WORDS}`);
  if (words < 40) problems.push('too short to be an email');

  const allowed = new Set(found.flatMap((f) => f.numbers.map(Number)));
  /* The footer carries a street number and a postal code, and the two links
     carry none — so numbers are counted in the body only, above the footer.
     Everything from the studio's sign-off line down is CASL boilerplate we
     wrote ourselves, not a claim about their server. */
  const bodyOnly = text.split(/\nCadenic Studios ·/)[0];
  const seen = [...bodyOnly.matchAll(/\b\d[\d,]*\b/g)].map((m) => Number(m[0].replace(/,/g, '')));
  const bad = seen.filter((n) => !allowed.has(n) && !(n >= 1900 && n <= 2100));
  if (bad.length) problems.push(`number(s) not in the findings: ${[...new Set(bad)].join(', ')}`);

  const bet = bettingHit(text);
  if (bet) problems.push(`betting vocabulary: ${bet}`);
  if (/\b(guarantee|guaranteed)\b/i.test(text)) problems.push('promises a result');
  if (/\b(a call|a meeting|hop on|jump on|schedule|calendar)\b/i.test(text)) problems.push('asks for a call');
  if (/!/.test(text)) problems.push('exclamation mark');
  if (!/cadenic\.studio\/teardown/.test(text)) problems.push('missing the teardown link');
  if (!/Reply "stop"/.test(text)) problems.push('missing the stop line (CASL)');
  if (postal && !text.includes(postal)) problems.push('missing the postal address (CASL)');
  if (/\$\s?\d/.test(text)) problems.push('names a price');
  return problems;
}

/* ──────────────────────────────────────────────────────────── FOLLOW-UP */

export function followUpBody({ prospect, sentOn, postal }) {
  const first = prospect.name.split(/\s+/)[0] || 'there';
  return `Hi ${first} — no reply needed to this one.

Just closing the loop on the note I sent on ${sentOn} about ${prospect.company || 'your server'}. The offer of a written teardown stands and it is free either way: https://cadenic.studio/teardown. You are also welcome to hand any of it to whoever you already use.

All the best with the community.

Wyatt

${footer({ postal })}`;
}

/* ───────────────────────────────────────────────────────────────── TICK */

/**
 * Runs on a schedule. Each pass advances every prospect one step and stops:
 * new → enriched → drafted (waiting for a person). Nothing here sends.
 */
export async function prospectsTick({ store, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const cfg = settings.cadenic || {};
  const summary = { enriched: 0, drafted: 0, followUps: 0, refused: 0, skipped: 0 };
  if (cfg.enabled === false) { summary.note = 'cadenic disabled'; return summary; }
  const postal = secrets.CADENIC_POSTAL || '';
  const docs = await store.list(PROSPECTS);

  for (const { id, data: p } of docs) {
    try {
      if (p.status === 'new') {
        const enrichment = await enrichProspect(p, { fetchImpl });
        const found = findings(p, enrichment);
        await store.update(PROSPECTS + id, { enrichment, found, status: found.length ? 'enriched' : 'nothing-found', enrichedAt: new Date(now).toISOString() });
        summary.enriched++;
        if (!found.length) summary.skipped++;
        continue;
      }
      if (p.status === 'enriched') {
        if (!postal) { await store.update(PROSPECTS + id, { status: 'blocked', problems: ['CADENIC_POSTAL is not set — CASL requires a mailing address in every message'] }); summary.refused++; continue; }
        const d = await draftOutreach({ apiKey: secrets.ANTHROPIC_API_KEY, prospect: p, found: p.found || [], postal, fetchImpl });
        if (!d.ok) { await store.update(PROSPECTS + id, { status: 'blocked', problems: [d.reason] }); summary.refused++; continue; }
        const problems = lintOutreach(d.body, p.found || [], { postal });
        await store.update(PROSPECTS + id, { draft: { subject: d.subject, body: d.body }, problems, status: problems.length ? 'blocked' : 'drafted', draftedAt: new Date(now).toISOString() });
        if (problems.length) summary.refused++; else summary.drafted++;
        continue;
      }
      if (p.status === 'sent' && p.followUpAt && Date.parse(p.followUpAt) <= now && !p.followUp) {
        if (!postal) continue;
        const sentOn = new Date(p.sentAt).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', timeZone: 'America/Edmonton' });
        await store.update(PROSPECTS + id, { followUp: { subject: `Re: ${p.draft?.subject || 'your Discord'}`, body: followUpBody({ prospect: p, sentOn, postal }) }, status: 'follow-up-drafted' });
        summary.followUps++;
      }
    } catch (e) {
      log('prospectsTick', id, String(e.message || e));
    }
  }
  return summary;
}

/* ──────────────────────────────────────────────────────────────── SEND */

/**
 * Called from a signed approval only. Refuses without the postal address,
 * refuses a draft the linter rejected, refuses in dry run, and refuses past
 * the daily cap — in that order, each one a separate sentence in the reply.
 */
export async function sendOutreach({ store, id, secrets = {}, settings = {}, kind = 'first', now = Date.now(), fetchImpl = fetch, sendEmail }) {
  const p = await store.get(PROSPECTS + id);
  if (!p) return { ok: false, reason: 'that prospect is gone' };
  const postal = secrets.CADENIC_POSTAL || '';
  if (!postal) return { ok: false, reason: 'CADENIC_POSTAL is not set; nothing can be sent without a mailing address' };
  if (settings.dryRun) return { ok: false, reason: 'the engine is in dry run — nothing reaches a stranger until it ends' };

  const msg = kind === 'follow' ? p.followUp : p.draft;
  if (!msg) return { ok: false, reason: 'no draft to send' };
  if (kind === 'first' && (p.problems || []).length) return { ok: false, reason: `the draft did not pass the linter: ${p.problems.join('; ')}` };
  if (kind === 'first' && p.status !== 'drafted') return { ok: false, reason: `already ${p.status}` };
  if (kind === 'follow' && p.status !== 'follow-up-drafted') return { ok: false, reason: `not awaiting a follow-up (${p.status})` };

  const cap = Number(settings.cadenic?.maxPerDay) || 5;
  const today = new Date(now).toISOString().slice(0, 10);
  const all = await store.list(PROSPECTS);
  const sentToday = all.filter(({ data }) => (data.sentAt || '').startsWith(today) || (data.followedUpAt || '').startsWith(today)).length;
  if (sentToday >= cap) return { ok: false, reason: `${cap} already sent today; the cap is there so a bad batch is a small one` };

  await sendEmail({
    apiKey: secrets.RESEND_API_KEY,
    from: secrets.CADENIC_FROM || 'Wyatt at Cadenic Studios <hello@cadenic.studio>',
    to: p.email,
    subject: msg.subject,
    text: msg.body,
    fetchImpl,
  });

  const stamp = new Date(now).toISOString();
  if (kind === 'follow') {
    await store.update(PROSPECTS + id, { status: 'followed-up', followedUpAt: stamp });
  } else {
    const followUpAt = new Date(now + FOLLOW_UP_DAYS * 86_400_000).toISOString();
    await store.update(PROSPECTS + id, { status: 'sent', sentAt: stamp, followUpAt });
  }
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────── STATS */

export function outreachStats(docs) {
  const by = {};
  for (const { data } of docs) by[data.status] = (by[data.status] || 0) + 1;
  const sent = (by.sent || 0) + (by['followed-up'] || 0) + (by.replied || 0) + (by.converted || 0) + (by.declined || 0);
  const replied = (by.replied || 0) + (by.converted || 0) + (by.declined || 0);
  return { by, sent, replied, converted: by.converted || 0, replyRate: sent ? Math.round((replied / sent) * 100) : null };
}
