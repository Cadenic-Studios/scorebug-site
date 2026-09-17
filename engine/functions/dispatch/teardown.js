// Cadenic dispatch — THE DELIVERABLE.
//
// ─── WHY THIS IS THE MOST IMPORTANT FILE IN THE OUTREACH SIDE ───────────────
//
// Every cold email this engine sends ends with the same promise: a full
// written teardown of your Discord, free, no call, nothing wanted back. That
// promise is the entire reason anybody replies. It is also, until now, the one
// step that was a person sitting down for two hours with somebody else's
// server — which meant the funnel could generate more interest than it could
// possibly service, and the fastest way to destroy a small studio's name is to
// offer something free and then take three weeks to deliver it.
//
// So the teardown writes itself, from facts, and a person presses send.
//
// ─── WHAT MAKES IT WORTH READING ────────────────────────────────────────────
//
// It is specific about THEIR server or it does not go out. A teardown that
// could have been written about anybody is an advertisement with a different
// name on it, and the recipient can tell within one paragraph. So:
//
//   • every observation is derived from an endpoint we actually read
//   • every number in the document must exist in the findings, enforced
//   • the recommendations are ordered by what costs least to fix first
//   • it says what is already good, because a document that finds only faults
//     reads as a sales pitch and a document that finds one genuine strength
//     reads as somebody who actually looked
//   • it names no price and asks for nothing
//
// ─── THE HONEST LIMIT, STATED IN THE DOCUMENT ───────────────────────────────
//
// We are reading a server from the outside: the public invite endpoint, the
// discovery preview if they are discoverable, and their own website. We cannot
// see their channels, their permissions, their mod logs or their retention.
// The document says so, in those words, near the top. A teardown that implies
// more access than it had is the kind of thing a prospect discovers at exactly
// the wrong moment.

import { createHash } from 'node:crypto';
import { resolveInvite, inviteCode, inspectSite, footer } from './prospects.js';
import { bettingHit } from './safety.js';

export const TEARDOWNS = 'dispatch/state/teardowns/';

/** Requests are keyed by email so a second request updates the first. */
export function teardownId(email, invite = '') {
  return createHash('sha256').update(`${String(email).trim().toLowerCase()}|${inviteCode(invite) || ''}`).digest('hex').slice(0, 16);
}

/* ═════════════════════════════════════════════════════ DEEPER READING */

const DISCORD = 'https://discord.com/api/v10';

/**
 * The discovery preview, which Discord serves without a token for any server
 * that has turned Discovery on. It carries what the invite endpoint does not:
 * the emoji and sticker counts, the full feature list, and the description as
 * it appears to someone browsing rather than someone following a link.
 *
 * A 404 here is not an error — it is the answer to "are they discoverable",
 * and that answer is itself one of the more valuable findings in the document.
 */
export async function guildPreview(guildId, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!guildId) return { ok: false, reason: 'no guild id' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${DISCORD}/guilds/${encodeURIComponent(guildId)}/preview`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (res.status === 404 || res.status === 403) return { ok: false, reason: 'not discoverable' };
    if (!res.ok) return { ok: false, reason: `discord ${res.status}` };
    const g = await res.json();
    return {
      ok: true,
      emojis: Array.isArray(g.emojis) ? g.emojis.length : 0,
      stickers: Array.isArray(g.stickers) ? g.stickers.length : 0,
      features: Array.isArray(g.features) ? g.features : [],
      description: g.description || '',
      members: Number(g.approximate_member_count) || 0,
      present: Number(g.approximate_presence_count) || 0,
    };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Everything we can honestly learn, in one pass.
 *
 * `invite` is the one call that must succeed; without it there is no server to
 * write about and the request is refused rather than padded out with generic
 * advice, which is the failure this whole module exists to prevent.
 */
export async function inspect(req, { fetchImpl = fetch } = {}) {
  const code = inviteCode(req.discordInvite);
  const invite = await resolveInvite(code, { fetchImpl });
  if (!invite.ok) return { ok: false, reason: invite.reason };
  const [preview, site] = await Promise.all([
    guildPreview(invite.guildId, { fetchImpl }),
    inspectSite(req.site, { fetchImpl }),
  ]);
  return { ok: true, invite, preview, site, at: new Date().toISOString() };
}

/* ══════════════════════════════════════════════════════════ FINDINGS */

const pct = (n) => Math.round(n * 100);

/**
 * The findings, richer than the cold email's, and each one carrying the
 * numbers it is allowed to use. `fix` is what would be done about it and `cost`
 * orders the document: cheapest real win first, because a teardown that opens
 * with the expensive recommendation reads as a quote.
 */
export function teardownFindings(data) {
  const out = [];
  const inv = data.invite || {};
  const pre = data.preview || {};
  const site = data.site || {};

  if (inv.presenceRatio !== null && inv.members >= 25) {
    const p = pct(inv.presenceRatio);
    out.push({
      key: 'presence', cost: 2, numbers: [inv.members, inv.present, p],
      observation: `${inv.members.toLocaleString('en-CA')} members, ${inv.present.toLocaleString('en-CA')} present when I looked — about ${p}%.`,
      meaning: p < 8
        ? 'Under roughly one in ten is the range where the room reads as empty to a new arrival, and an empty room empties itself further. It is almost never a content problem at that point; it is that nobody has a reason to open the app.'
        : p < 15
          ? 'That is the ordinary middle. It is also where the cheapest gains are, because the people are already there and are simply not being given a reason to come back.'
          : 'That is a healthy ratio and worth saying plainly, because most servers this size are well below it. The work here is protecting it as the number grows rather than fixing it.',
      fix: 'A reason to open the app that is not a person talking: a scheduled thread, a standing weekly prompt, or a bot that posts the one thing your members would otherwise go elsewhere for.',
    });
  }

  if (!inv.community) {
    out.push({
      key: 'community', cost: 1, numbers: [],
      observation: 'Community mode is off.',
      meaning: 'This is the single highest-value switch in Discord and it is free. With it off there is no welcome screen, no rules screening, no onboarding questions, no server guide, no Discovery eligibility and no member screening — six things that between them decide whether somebody who joins on a Tuesday is still there on a Friday.',
      fix: 'Server Settings → Enable Community, then the onboarding flow. An afternoon, and it costs nothing.',
    });
  } else if (!inv.discoverable) {
    out.push({
      key: 'discoverable', cost: 1, numbers: [],
      observation: 'Community mode is on, but the server is not in Discovery.',
      meaning: 'So the only people who can find it are people who already hold a link. Discovery is the one distribution channel inside Discord itself, and you have already done the work that qualifies you for it.',
      fix: 'Server Settings → Discovery. It checks your rules channel, description and activity, then lists you.',
    });
  }

  if (inv.verificationLevel === 0) {
    out.push({
      key: 'verification', cost: 1, numbers: [],
      observation: 'Verification level is None.',
      meaning: 'A brand-new account can join and post immediately. That is where raid spam and the occasional bad actor come from, and it tends to arrive on the day you get your first real traffic — which is the worst possible day for it.',
      fix: 'Set it to Low or Medium. Medium (registered five minutes, member ten) stops nearly all of it and inconveniences nobody real.',
    });
  }

  if (!inv.description && !pre.description) {
    out.push({
      key: 'description', cost: 1, numbers: [],
      observation: 'The server has no description.',
      meaning: 'An invite to it unfurls, everywhere it is pasted, as a name and a member count. Somebody deciding whether to join has nothing to decide on.',
      fix: 'One sentence saying who the room is for. It appears on the invite card, in Discovery and in search.',
    });
  }

  if (inv.inviteExpires) {
    out.push({
      key: 'expiry', cost: 1, numbers: [],
      observation: 'The invite I was given expires.',
      meaning: 'Every place that link has been printed — your site, a video description, a README, somebody else\'s tweet — stops working on that date, silently, and you find out from the traffic rather than from an error.',
      fix: 'Generate a permanent invite (Expire After: Never, Max Uses: No Limit) and use only that one in anything published.',
    });
  }

  if (pre.ok && pre.emojis === 0) {
    out.push({
      key: 'emoji', cost: 1, numbers: [],
      observation: 'No custom emoji.',
      meaning: 'Small, and it matters more than it sounds: custom emoji are the cheapest thing a community has that members carry into other servers. Every use is somebody else seeing your name.',
      fix: 'Five or six, drawn from whatever your members already say.',
    });
  }

  if (site.checked && site.reachable) {
    if (site.linksToInvite && !site.hasOwnDiscordPage) {
      out.push({
        key: 'invite-link', cost: 2, numbers: [],
        observation: 'Your website sends people straight to a discord.gg link.',
        meaning: 'Two costs. The link is temporary, so everywhere you have published it is publishing something that can break. And discord.gg pages are not yours and rank for nothing — a page on your own domain about your community can rank, can be linked to, can carry a description, and can be changed without reprinting anything.',
        fix: 'A /discord or /community page on your own domain that redirects. One page, and every future mention points at it instead.',
      });
    } else if (!site.mentionsDiscord) {
      out.push({
        key: 'no-mention', cost: 1, numbers: [],
        observation: 'Your website does not mention the Discord anywhere I could see.',
        meaning: 'The people most likely to join are the ones already on your site, and they are not being told it exists.',
        fix: 'A line in the footer and one in the place people land after they buy or sign up.',
      });
    }
  } else if (site.checked && !site.reachable) {
    out.push({
      key: 'site-unreachable', cost: 1, numbers: [],
      observation: 'I could not reach the website address I had for you, so nothing here covers it.',
      meaning: 'That may simply be my end, and it is noted so you know what this document does and does not cover.',
      fix: 'Send me the right address and I will look at it.',
    });
  }

  return out.sort((a, b) => a.cost - b.cost);
}

/** Something true and good, if there is one. A document with none is a pitch. */
export function strengths(data) {
  const out = [];
  const inv = data.invite || {};
  const pre = data.preview || {};
  if (inv.presenceRatio !== null && pct(inv.presenceRatio) >= 15) out.push({ numbers: [pct(inv.presenceRatio)], text: `A presence ratio around ${pct(inv.presenceRatio)}% is well above what most servers this size run at.` });
  if (inv.community && inv.discoverable) out.push({ numbers: [], text: 'Community mode and Discovery are both on, which is more setup than most servers ever do.' });
  if (inv.description || pre.description) out.push({ numbers: [], text: 'The server has a written description, so the invite card says something to a stranger.' });
  if (pre.ok && pre.emojis >= 10) out.push({ numbers: [pre.emojis], text: `${pre.emojis} custom emoji — members carry those into other servers, which is free reach.` });
  if (inv.verificationLevel >= 2) out.push({ numbers: [], text: 'Verification is set high enough to stop drive-by spam.' });
  return out;
}

/* ═════════════════════════════════════════════════════════════ DRAFT */

const SYSTEM = `You write a free written teardown of a Discord server, from Wyatt at Cadenic Studios, a small Canadian software studio that builds Discord servers and bots. The recipient asked for this. It is free, nothing is wanted back, and there is no call.

VOICE: plain, specific, warm, a little dry. First person. The tone of a tradesperson who has looked at the job and is telling you honestly what they saw. No exclamation marks. No "great news". No superlatives. No "unlock", "leverage", "supercharge", "game-changer", "best practices".

STRUCTURE — use these exact markdown headings, in this order:

## What I looked at
Two or three sentences. Name the server. Say plainly that this is read from the outside — the public invite endpoint, the Discovery preview if they have it on, and their own website — and that you cannot see channels, permissions, moderation logs or retention. Say what date you looked.

## What is working
The strengths you are given, as short sentences. If you are given none, write one honest line saying the setup is early rather than inventing a compliment.

## What I would change
One "### " subsection per finding, in the order given. Each one: the observation, what it actually costs them, and what you would do about it. Use the words you are given; do not add findings of your own.

## Where I would start
Three numbered items, cheapest and highest-value first, drawn only from the findings above. Say roughly how long each takes in plain terms (an afternoon, an evening, a week). No prices, no hours-as-currency.

## What a bot could do here
Two or three sentences, specific to this server, about what could be automated from data they already have. If nothing obvious applies, say that a bot is not the first thing you would reach for here and why — that is a more useful answer than a generic one.

## If you want a hand
Two sentences maximum. Say the work is at https://cadenic.studio/services/discord-engineering, that they are welcome to hand any of this to whoever they already use, and stop. Do not ask for a call, a meeting or a reply.

HARD RULES:
- Use ONLY the observations, meanings, fixes, strengths and numbers you are given. Every number you write must appear in the material given to you, exactly as given. Do not round, restate as an approximation, or add a figure of your own.
- Never mention odds, betting, gambling or sportsbooks.
- Never promise a result, a member count, a ranking or a timeline.
- Never name a price.
- Never say this was written by software.
- No emoji.
Output the document only, starting with the first heading. No preamble.`;

export async function draftTeardown({ apiKey, model = 'claude-sonnet-4-5', req, data, found, good, fetchImpl = fetch, timeoutMs = 60_000 }) {
  if (!apiKey) return { ok: false, reason: 'no ANTHROPIC_API_KEY' };
  if (!found.length && !good.length) return { ok: false, reason: 'nothing could be read about that server' };
  const inv = data.invite || {};
  const when = new Date(data.at || Date.now()).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Edmonton' });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 2500, temperature: 0.4,
        system: SYSTEM,
        messages: [{ role: 'user', content: [
          `Server name: ${inv.guildName || req.company || '(unnamed)'}`,
          `Their name: ${req.name || '(unknown)'}`,
          `Date looked at: ${when}`,
          `Discovery preview available: ${data.preview?.ok ? 'yes' : 'no'}`,
          `Website checked: ${data.site?.checked ? (data.site.reachable ? 'yes' : 'unreachable') : 'none given'}`,
          '',
          'WHAT IS WORKING (use only these):',
          good.length ? good.map((g) => `- ${g.text}`).join('\n') : '(nothing to report — say so honestly)',
          '',
          'FINDINGS, in the order to present them (use only these):',
          found.map((f, i) => `${i + 1}. [${f.key}]\n   observation: ${f.observation}\n   what it costs: ${f.meaning}\n   what to do: ${f.fix}`).join('\n'),
          '',
          req.notes ? `WHAT THEY TOLD US WHEN THEY ASKED (context only, do not quote back):\n${String(req.notes).slice(0, 600)}` : '',
          '',
          'Write the teardown.',
        ].filter(Boolean).join('\n') }],
      }),
    });
    if (!res.ok) return { ok: false, reason: `anthropic ${res.status}` };
    const out = await res.json();
    const body = (out.content || []).map((c) => c.text || '').join('').trim();
    return { ok: true, body, subject: `Your Discord teardown — ${inv.guildName || req.company || 'as promised'}` };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/* ══════════════════════════════════════════════════════════════ LINT */

/**
 * The same rule as the cold email, applied to a document ten times longer:
 * every number must be one we measured. A teardown is read closely by someone
 * who knows the server better than we ever will, and a single invented figure
 * discredits the other two thousand words.
 */
export function lintTeardown(body, found, good) {
  const problems = [];
  const text = String(body || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words < 250) problems.push(`${words} words; too thin to be worth sending`);
  if (words > 1600) problems.push(`${words} words; nobody reads that`);

  const allowed = new Set([...found, ...good].flatMap((f) => (f.numbers || []).map(Number)));
  /* ── THE DATE IS NOT A CLAIM ────────────────────────────────────────────
     The document is instructed to say when it was written, and "16 September
     2026" contains a 16 that is not a fact about anybody's server. Counting it
     rejected every possible document on any day after the fifth of a month —
     a linter that refuses correct work is worse than no linter, because the
     first instinct on seeing it fire is to weaken the rule that matters.
     Written dates are removed before counting; nothing else is. */
  const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const counted = text
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  const seen = [...counted.matchAll(/\b\d[\d,]*\b/g)].map((m) => Number(m[0].replace(/,/g, '')));
  /* 1–5 are list numbering and "one in ten"; 1900–2100 are years. Neither is a
     claim about their server, and refusing them would reject every document. */
  const bad = seen.filter((n) => !allowed.has(n) && !(n >= 1900 && n <= 2100) && !(n >= 1 && n <= 5) && n !== 10);
  if (bad.length) problems.push(`number(s) not in the findings: ${[...new Set(bad)].join(', ')}`);

  for (const need of ['## What I looked at', '## What I would change', '## Where I would start']) {
    if (!text.includes(need)) problems.push(`missing the "${need.replace('## ', '')}" section`);
  }
  const bet = bettingHit(text);
  if (bet) problems.push(`betting vocabulary: ${bet}`);
  if (/\b(guarantee|guaranteed|will increase|will grow|will double)\b/i.test(text)) problems.push('promises a result');
  if (/\$\s?\d/.test(text)) problems.push('names a price');
  if (/\b(hop on|jump on|book a call|schedule a call|set up a time)\b/i.test(text)) problems.push('asks for a call');
  if (/!/.test(text)) problems.push('exclamation mark');
  /* "From the outside" alone is not enough and the test that proved it was
     written before this line changed: a document can say it looked from the
     outside and still go on to imply it read the channels. The enumerated
     disclaimer — what specifically was NOT visible — is the one that stops a
     prospect discovering the limit at the wrong moment. */
  if (!/cannot see|could not see|can't see|no access to|do not have access/i.test(text)) problems.push('does not state the limit of what was read');
  return problems;
}

/* ══════════════════════════════════════════════════════════════ TICK */

/**
 * One step per request per pass: new → inspected → drafted, then it waits.
 * Nothing here sends; the deliverable goes out on a signed approval like
 * everything else that reaches a stranger.
 */
export async function teardownTick({ store, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const cfg = settings.cadenic || {};
  const summary = { inspected: 0, drafted: 0, refused: 0 };
  if (cfg.enabled === false || cfg.teardowns === false) { summary.note = 'teardowns off'; return summary; }

  for (const { id, data: req } of await store.list(TEARDOWNS)) {
    try {
      if (req.status === 'new') {
        const data = await inspect(req, { fetchImpl });
        if (!data.ok) {
          /* We cannot write about a server we cannot read, and we will not
             pad it out with generic advice. Wyatt is told to ask them for a
             working invite, which is a better email than a worse document. */
          await store.update(TEARDOWNS + id, { status: 'blocked', problems: [`could not read the server: ${data.reason}`], checkedAt: new Date(now).toISOString() });
          summary.refused++;
          continue;
        }
        const found = teardownFindings(data);
        const good = strengths(data);
        await store.update(TEARDOWNS + id, { data, found, good, status: 'inspected', checkedAt: new Date(now).toISOString() });
        summary.inspected++;
        continue;
      }
      if (req.status === 'inspected') {
        const d = await draftTeardown({ apiKey: secrets.ANTHROPIC_API_KEY, req, data: req.data, found: req.found || [], good: req.good || [], fetchImpl });
        if (!d.ok) { await store.update(TEARDOWNS + id, { status: 'blocked', problems: [d.reason] }); summary.refused++; continue; }
        const problems = lintTeardown(d.body, req.found || [], req.good || []);
        await store.update(TEARDOWNS + id, { draft: { subject: d.subject, body: d.body }, problems, status: problems.length ? 'blocked' : 'drafted', draftedAt: new Date(now).toISOString() });
        if (problems.length) summary.refused++; else summary.drafted++;
      }
    } catch (e) {
      log('teardownTick', id, String(e.message || e));
    }
  }
  return summary;
}

/* ══════════════════════════════════════════════════════════════ SEND */

export async function sendTeardown({ store, id, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, sendEmail }) {
  const r = await store.get(TEARDOWNS + id);
  if (!r) return { ok: false, reason: 'that request is gone' };
  if (r.status === 'sent') return { ok: false, reason: 'already sent' };
  if (!r.draft) return { ok: false, reason: 'no draft to send' };
  if ((r.problems || []).length) return { ok: false, reason: `the draft did not pass the linter: ${r.problems.join('; ')}` };
  if (settings.dryRun) return { ok: false, reason: 'the engine is in dry run — nothing reaches a stranger until it ends' };

  /* ── THE CIRCUIT BREAKER ────────────────────────────────────────────────
     Checked here, in the send path, on every single message — not on a
     schedule. A breaker evaluated once a night is a breaker that lets a bad
     batch finish before anybody notices. */
  const { sendingAllowed } = await import('./deliverability.js');
  const gate = await sendingAllowed({ store, now });
  if (!gate.allowed) return { ok: false, reason: gate.reason };
  const postal = secrets.CADENIC_POSTAL || '';
  if (!postal) return { ok: false, reason: 'CADENIC_POSTAL is not set; nothing can be sent without a mailing address' };

  const first = String(r.name || '').split(/\s+/)[0] || 'there';
  const text = `Hi ${first} — here is the teardown, as promised. It is free and there is nothing to reply to.\n\n${r.draft.body}\n\nWyatt\n\n${footer({ postal })}`;
  await sendEmail({
    apiKey: secrets.RESEND_API_KEY,
    from: secrets.CADENIC_FROM || 'Wyatt at Cadenic Studios <hello@cadenic.studio>',
    to: r.email, subject: r.draft.subject, text, replyTo: secrets.CADENIC_REPLY_TO || undefined, fetchImpl,
  });
  await store.update(TEARDOWNS + id, { status: 'sent', sentAt: new Date(now).toISOString() });
  return { ok: true };
}

export function teardownStats(docs) {
  const by = {};
  for (const { data } of docs) by[data.status] = (by[data.status] || 0) + 1;
  return { by, total: docs.length, sent: by.sent || 0, waiting: (by.drafted || 0) + (by.blocked || 0) };
}
