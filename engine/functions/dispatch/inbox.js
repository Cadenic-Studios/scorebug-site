// Cadenic dispatch — THE INBOX.
//
// ─── WHAT THIS IS ───────────────────────────────────────────────────────────
//
// The other half of outreach. Until now the engine could send a cold email and
// then had no idea what happened to it: a prospect who replied "no thanks" was
// still sitting on a timer that would send them a follow-up ten days later, and
// a prospect who replied "yes please" was invisible until Wyatt happened to
// read his own inbox. Both of those are the machine failing at the only moment
// that matters.
//
// So: Resend receives at inbound.cadenic.studio, posts a webhook here, and this
// module decides what a reply means and moves the prospect. Everything after
// the reply arrives is automatic except the one thing that should never be.
//
// ─── WHAT IS AUTOMATIC, AND WHAT IS NOT ─────────────────────────────────────
//
//   automatic   stopping the follow-up. The instant anything arrives from a
//               prospect, the timer is cancelled. This happens before
//               classification, before any model call, before anything that
//               can fail — because the failure mode of getting this wrong is
//               chasing someone who already answered.
//   automatic   the unsubscribe. "stop", "unsubscribe", "remove me" suppress
//               the address permanently and for good, by string match, with no
//               model in the path. CASL gives ten business days; this takes
//               about two seconds, and it cannot be broken by an API outage.
//   automatic   classification, and the state the prospect lands in.
//   NOT         the reply itself. A person who wrote to what they believe is a
//               human gets a human. The draft is prepared and waits in the
//               digest behind the same signed approval as everything else.
//
// ─── THE WEBHOOK IS METADATA ONLY ───────────────────────────────────────────
//
// Resend's `email.received` payload deliberately carries no body, no headers
// and no attachments — only their metadata — so that a large attachment cannot
// blow a serverless request-size limit. The body comes from a second,
// authenticated call to /emails/receiving/{id}. Any handler written from
// memory of how SendGrid's Inbound Parse works will look correct and read an
// empty body forever, so the fetch is not optional and is not an optimisation.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PROSPECTS } from './prospects.js';
import { bettingHit } from './safety.js';

export const INBOX = 'dispatch/state/inbox/';

/** Svix replays a failed delivery eight times over about a day. Every one of
 *  those is the same message, and processing it twice would suppress an
 *  address twice (harmless) or draft a reply twice (not). Keyed by svix-id. */
export const SEEN = 'dispatch/state/inboxSeen/';

/** Five minutes, which is what every Svix client library uses. A signature
 *  older than this is a replay of a captured request, not a slow network. */
export const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

/* ─────────────────────────────────────────────────────── SIGNATURE */

/**
 * Verify a Svix-signed webhook. Resend signs with Svix, which means:
 *
 *   signed content = `{svix-id}.{svix-timestamp}.{raw body}`   (literal dots)
 *   key            = base64-decode(secret without its `whsec_` prefix)
 *   signature      = base64(HMAC-SHA256(key, signed content))
 *
 * The secret is base64 AFTER the prefix — using the whole string as an ASCII
 * key produces a stable, wrong signature that fails identically every time,
 * which reads like a misconfigured endpoint rather than a bug.
 *
 * `rawBody` must be the exact bytes that arrived. A framework that parses JSON
 * and re-stringifies it will reorder nothing and change key spacing everything,
 * and the signature will never match again.
 */
export function verifyWebhook({ secret, headers = {}, rawBody, now = Date.now() }) {
  const h = (k) => String(headers[k] || headers[k.toLowerCase()] || '');
  const id = h('svix-id');
  const ts = h('svix-timestamp');
  const sig = h('svix-signature');
  if (!secret) return { ok: false, reason: 'no signing secret configured' };
  if (!id || !ts || !sig) return { ok: false, reason: 'missing svix headers' };

  const seconds = Number(ts);
  if (!Number.isFinite(seconds)) return { ok: false, reason: 'bad timestamp' };
  if (Math.abs(now - seconds * 1000) > SIGNATURE_TOLERANCE_MS) return { ok: false, reason: 'timestamp outside tolerance' };

  const raw = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody || '').toString('utf8');
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');

  /* The header can carry several space-delimited signatures during a secret
     rotation, each prefixed with its version. One match is a match. */
  const offered = sig.split(/\s+/).map((p) => p.replace(/^v1,/, '')).filter(Boolean);
  const want = Buffer.from(expected);
  const good = offered.some((o) => {
    const got = Buffer.from(o);
    return got.length === want.length && timingSafeEqual(got, want);
  });
  return good ? { ok: true, id } : { ok: false, reason: 'signature mismatch' };
}

/* ─────────────────────────────────────────────────────────── FETCH */

/** The bare address out of `Name <addr@host>`, lowercased. */
export function bareAddress(value) {
  const s = String(value || '').trim();
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

/**
 * The body, from the second call the webhook's design requires.
 * `text` is nullable in Resend's own example, so HTML is stripped as the
 * fallback rather than treated as an error.
 */
export async function fetchReceived({ apiKey, emailId, fetchImpl = fetch, timeoutMs = 15_000 }) {
  if (!apiKey) return { ok: false, reason: 'no RESEND_API_KEY' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      signal: ctl.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        /* Resend answers 403 code 1010 to any request without one. */
        'user-agent': 'CadenicStudios-engine/1.0 (+https://cadenic.studio)',
      },
    });
    if (!res.ok) return { ok: false, reason: `resend ${res.status}` };
    const j = await res.json();
    const headers = {};
    for (const [k, v] of Object.entries(j.headers || {})) headers[String(k).toLowerCase()] = v;
    return {
      ok: true,
      from: j.from || '',
      to: Array.isArray(j.to) ? j.to : [],
      subject: j.subject || '',
      text: j.text || stripHtml(j.html || ''),
      headers,
      messageId: j.message_id || '',
    };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Everything below the first quote marker is what WE wrote, coming back. A
 * classifier reading it will find our own enthusiasm and our own "reply stop"
 * line in every message and grade accordingly, so it is cut before anything
 * looks at the text.
 */
export function newTextOnly(body) {
  const s = String(body || '').replace(/\r\n/g, '\n');
  const cuts = [
    /\n>+\s?/,                                     // quoted lines
    /\nOn .{0,80}\bwrote:/,                        // Gmail, Apple Mail
    /\n-{2,}\s*Original Message\s*-{2,}/i,         // Outlook
    /\n_{10,}/,                                    // Outlook's rule
    /\nFrom:\s.{0,120}\nSent:/i,                   // Outlook header block
    /\nCadenic Studios ·/,                         // our own footer, quoted back
  ];
  let end = s.length;
  for (const re of cuts) {
    const m = s.match(re);
    if (m && m.index != null && m.index < end) end = m.index;
  }
  return s.slice(0, end).trim();
}

/* ──────────────────────────────────────────────────── CLASSIFICATION */

/**
 * THE STOP LIST.
 *
 * Deliberately generous, deliberately dumb, and deliberately first. CASL wants
 * an unsubscribe honoured within ten business days; the cost of reading "no
 * thank you please remove me" as merely a decline is that the person gets one
 * more email from us, which is exactly the thing the law is about. A false
 * positive costs us a lead we were not going to win anyway.
 */
const STOP = [
  /\bunsubscribe\b/i,
  /\bopt[\s-]?out\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\bdo not (?:contact|email|write|message)\b/i,
  /\bdon'?t (?:contact|email) me\b/i,
  /\bstop (?:emailing|contacting|messaging)\b/i,
  /\bno longer wish\b/i,
  /\bnot interested,? (?:please )?(?:remove|stop)\b/i,
];

/** A bare "stop" or "unsubscribe" as the entire message. */
const BARE_STOP = /^\s*(stop|unsubscribe|remove|no|no\.?|no thanks?\.?)\s*[.!]?\s*$/i;

/**
 * Out-of-office is NOT a reply. Treating it as one loses the lead silently:
 * the follow-up is cancelled, the prospect sits in "replied" forever, and
 * nobody ever hears from the person who was on holiday. It cancels nothing.
 */
const AUTO_SUBJECT = /\b(out of (?:the )?office|automatic reply|auto[\s-]?reply|autoresponder|on (?:vacation|annual leave|parental leave)|away from (?:my )?(?:desk|email)|maternity|paternity)\b/i;

const BOUNCE_FROM = /^(mailer-daemon|postmaster|no-?reply|bounce|bounces)@/i;
const BOUNCE_SUBJECT = /\b(undeliverable|delivery (?:status notification|has failed|failure)|returned mail|mail delivery (?:failed|subsystem)|address not found|recipient rejected)\b/i;

/**
 * What kind of reply this is, without a model. Returns null when the message
 * needs judgement, which is the only case a model is asked about.
 *
 * Order is the whole point: stop beats everything, then bounces, then
 * auto-responders, and only a real human message reaches the model.
 */
export function classifyPlainly({ text, subject = '', from = '', headers = {}, readable = true }) {
  const body = newTextOnly(text);

  if (BARE_STOP.test(body) && /^\s*(stop|unsubscribe|remove)/i.test(body)) return { kind: 'unsubscribe', why: 'a one-word stop' };
  for (const re of STOP) if (re.test(body)) return { kind: 'unsubscribe', why: 'asked to be removed' };

  const addr = bareAddress(from);
  if (BOUNCE_FROM.test(addr) || BOUNCE_SUBJECT.test(subject)) return { kind: 'bounce', why: 'the address did not accept it' };

  /* RFC 3834 and the older Exchange convention. A machine that labels itself
     honestly should be believed. */
  const auto = String(headers['auto-submitted'] || '');
  const prec = String(headers['precedence'] || '').toLowerCase();
  if ((auto && auto.toLowerCase() !== 'no') || String(headers['x-autoreply'] || '') || String(headers['x-autorespond'] || '')) return { kind: 'auto', why: 'marked as an automatic reply' };
  if (prec === 'bulk' || prec === 'auto_reply') return { kind: 'auto', why: 'sent as bulk' };
  if (AUTO_SUBJECT.test(subject)) return { kind: 'auto', why: 'an out-of-office' };

  /* ── EMPTY IS ONLY EMPTY IF WE ACTUALLY READ IT ────────────────────────
     `readable` is false when the second call to Resend failed, and the
     difference is not cosmetic. An empty body we retrieved is a machine
     rattling; an empty body we never managed to retrieve is a message we know
     nothing about, and treating "I could not read it" as "nobody wrote" is how
     a real person who already replied gets chased ten days later. Unknown
     resolves toward the human every time. */
  if (readable && (!body || body.length < 2)) return { kind: 'auto', why: 'empty' };
  return null;
}

const CLASSIFY_SYSTEM = `You read one reply to a cold email that a small software studio sent to a business about their Discord server. You return JSON only.

Return exactly: {"kind": "...", "summary": "...", "asks": ["..."]}

kind must be one of:
  "interested"  they want the teardown, the work, prices, or more detail
  "question"    they are asking something before deciding
  "referral"    they are pointing you at a colleague, or say it is not their call
  "decline"     a no, but not a request to be removed from the list
  "hostile"     angry, accusatory, or threatening
  "other"       none of the above

summary: one short sentence, under 20 words, in plain English, saying what they actually said.
asks: the specific questions or requests they made, verbatim-ish, as short strings. Empty array if none.

Judge only what is written. Do not infer enthusiasm from politeness. A reply that says "thanks, we're all set" is a decline, not interest.`;

export async function classifyWithModel({ apiKey, model = 'claude-sonnet-4-5', text, subject, fetchImpl = fetch, timeoutMs = 20_000 }) {
  if (!apiKey) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 300, temperature: 0,
        system: CLASSIFY_SYSTEM,
        messages: [{ role: 'user', content: `Subject: ${subject || '(none)'}\n\n${newTextOnly(text).slice(0, 4000)}` }],
      }),
    });
    if (!res.ok) return null;
    const out = await res.json();
    const raw = (out.content || []).map((c) => c.text || '').join('');
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const kind = ['interested', 'question', 'referral', 'decline', 'hostile', 'other'].includes(j.kind) ? j.kind : 'other';
    return { kind, summary: String(j.summary || '').slice(0, 160), asks: (Array.isArray(j.asks) ? j.asks : []).map(String).slice(0, 5) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ───────────────────────────────────────────────────────── THE ANSWER */

const ANSWER_SYSTEM = `You draft a reply from Wyatt at Cadenic Studios, a small Canadian software studio that builds Discord servers and bots. Someone has replied to a short note he sent them about their Discord server.

VOICE: plain, warm, specific, a little dry. First person. Short. No exclamation marks. No "great question". No "absolutely". No "I'd love to". No superlatives. Write like someone who has done this work and has nothing to prove.

RULES:
- Answer what they actually asked, in the order they asked it. If you cannot answer something from the facts you are given, say plainly that you will find out, and do not invent it.
- Never promise a result, a ranking, a member count, or a timeline you were not given.
- Never mention odds, betting, gambling or sportsbooks.
- Never say this was drafted by software.
- The written teardown is free and needs no call: https://cadenic.studio/teardown
- Prices, if they asked for prices: https://cadenic.studio/services/discord-engineering
- Do not name a price yourself. The page has them and they change.
- If they are declining, thank them in one line and leave. Do not counter-offer, do not ask why, do not try again.
- If they are hostile, apologise once, plainly, confirm they will not hear from you again, and stop. Do not defend the email.
- If they pointed you at a colleague, thank them and ask only whether they would rather introduce you or have you write directly.
- Under 150 words. Sign off "Wyatt" and nothing after it — a footer is added for you.

Output the reply body only. No subject line, no preamble, no markdown.`;

export async function draftAnswer({ apiKey, model = 'claude-sonnet-4-5', prospect, reply, classification, fetchImpl = fetch, timeoutMs = 25_000 }) {
  if (!apiKey) return { ok: false, reason: 'no ANTHROPIC_API_KEY' };
  const found = (prospect.found || []).map((f) => f.text).join('\n');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 600, temperature: 0.4,
        system: ANSWER_SYSTEM,
        messages: [{ role: 'user', content:
          `Their name: ${prospect.name || '(unknown)'}\nTheir company or server: ${prospect.company || '(unnamed)'}\nHow their reply reads: ${classification.kind}${classification.summary ? ` — ${classification.summary}` : ''}\n\nWHAT WE ORIGINALLY TOLD THEM ABOUT THEIR SERVER (the only facts you may restate):\n${found || '(nothing on file)'}\n\nTHEIR REPLY:\n${newTextOnly(reply.text).slice(0, 3000)}\n\nWrite the reply.` }],
      }),
    });
    if (!res.ok) return { ok: false, reason: `anthropic ${res.status}` };
    const out = await res.json();
    const body = (out.content || []).map((c) => c.text || '').join('').trim();
    return { ok: true, body };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * The reply is held to the same standard as the cold email, minus the rules
 * that only make sense for a first contact. Numbers are checked against what
 * we already told them: a reply that invents a new figure about their server
 * is the same failure as an opener that does, and it is worse here because by
 * now they are paying attention.
 */
export function lintAnswer(body, prospect) {
  const problems = [];
  const text = String(body || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) problems.push('empty');
  if (words > 200) problems.push(`${words} words; a reply over 200 is a document`);

  const allowed = new Set((prospect.found || []).flatMap((f) => (f.numbers || []).map(Number)));
  const seen = [...text.matchAll(/\b\d[\d,]*\b/g)].map((m) => Number(m[0].replace(/,/g, '')));
  const bad = seen.filter((n) => !allowed.has(n) && !(n >= 1900 && n <= 2100));
  if (bad.length) problems.push(`number(s) we never told them: ${[...new Set(bad)].join(', ')}`);

  const bet = bettingHit(text);
  if (bet) problems.push(`betting vocabulary: ${bet}`);
  if (/\b(guarantee|guaranteed)\b/i.test(text)) problems.push('promises a result');
  if (/\$\s?\d/.test(text)) problems.push('names a price');
  if (/!/.test(text)) problems.push('exclamation mark');
  return problems;
}

/* ─────────────────────────────────────────────────────────── INTAKE */

/**
 * One inbound message, from webhook to settled state.
 *
 * The order here is the design. The follow-up is cancelled and the message is
 * recorded BEFORE the first thing that can fail, so an Anthropic outage or a
 * Resend hiccup can cost us a good draft but can never cost us a stopped
 * follow-up or a missed unsubscribe.
 */
export async function handleInbound({ store, event, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const data = event?.data || {};
  const emailId = String(data.email_id || '');
  if (!emailId) return { ok: false, reason: 'no email id' };

  const seenKey = SEEN + emailId;
  if (await store.get(seenKey)) return { ok: true, note: 'already handled' };
  await store.set(seenKey, { at: new Date(now).toISOString() });

  const from = bareAddress(data.from);
  const stamp = new Date(now).toISOString();

  /* Match the sender to a prospect. Someone replying from a different address
     than the one we wrote to is common (a shared inbox, a personal account),
     so the reply-to and the original recipient list are checked too. */
  const all = await store.list(PROSPECTS);
  const hit = all.find(({ data: p }) => bareAddress(p.email) === from)
    || all.find(({ data: p }) => (data.to || []).map(bareAddress).includes(bareAddress(p.replyPlus || '')));

  const full = await fetchReceived({ apiKey: secrets.RESEND_API_KEY, emailId, fetchImpl });
  const subject = full.ok ? full.subject : String(data.subject || '');
  const text = full.ok ? full.text : '';
  const headers = full.ok ? full.headers : {};

  /* The webhook's own metadata still carries `from` and `subject`, so a bounce
     or an out-of-office is recognised even when the body fetch failed. */
  const plain = classifyPlainly({ text, subject, from: data.from, headers, readable: full.ok });

  /* ── THE CANCELLATION, AS EARLY AS POSSIBLE ──────────────────────────────
     An out-of-office and a bounce are not replies and must not stop anything;
     everything else does, including a message we could not read. A message we
     failed to fetch is far more likely to be a real person than a bounce, and
     chasing a real person who already answered is the worse mistake. */
  const isReply = !plain || !['auto', 'bounce'].includes(plain.kind);
  if (hit && isReply) {
    await store.update(PROSPECTS + hit.id, { repliedAt: stamp, followUpAt: null, followUp: null });
  }

  /* ── AND THE TEARDOWN, WHICH IS A SEPARATE TIMER ─────────────────────────
     Somebody who filled in the form on /teardown may never have been a
     prospect at all, and a teardown carries its own four-day clock toward the
     note that asks for the work. Marking only the prospect would leave that
     clock running, and the machine would ask a person for the job while they
     were already mid-conversation with Wyatt about it — talking over its own
     owner, which is the worst thing a sales automation can do.

     Matched on the address rather than an id, because the two records are not
     linked and a teardown request often arrives from a different inbox than
     the one that was written to. */
  if (isReply) {
    const { TEARDOWNS } = await import('./teardown.js');
    for (const { id: tid, data: t } of await store.list(TEARDOWNS)) {
      if (bareAddress(t.email) === from && !t.repliedAt) {
        await store.update(TEARDOWNS + tid, { repliedAt: stamp });
      }
    }
  }

  const record = {
    emailId, from, subject, at: stamp,
    prospectId: hit ? hit.id : null,
    company: hit ? hit.data.company || '' : '',
    excerpt: newTextOnly(text).slice(0, 600),
    fetched: full.ok,
    status: 'new',
  };

  /* ── UNSUBSCRIBE: TERMINAL, IMMEDIATE, NO MODEL ─────────────────────────── */
  if (plain && plain.kind === 'unsubscribe') {
    if (hit) await store.update(PROSPECTS + hit.id, { status: 'declined', decidedAt: stamp, declineReason: 'asked to be removed' });
    const { suppress } = await import('./discover.js');
    await suppress(store, { email: from, reason: 'unsubscribed by reply' });
    await store.set(INBOX + emailId, { ...record, kind: 'unsubscribe', why: plain.why, status: 'closed' });
    return { ok: true, kind: 'unsubscribe', suppressed: from };
  }

  if (plain && plain.kind === 'bounce') {
    if (hit) await store.update(PROSPECTS + hit.id, { status: 'bounced', decidedAt: stamp });
    await store.set(INBOX + emailId, { ...record, kind: 'bounce', why: plain.why, status: 'closed' });
    return { ok: true, kind: 'bounce' };
  }

  if (plain && plain.kind === 'auto') {
    await store.set(INBOX + emailId, { ...record, kind: 'auto', why: plain.why, status: 'closed' });
    return { ok: true, kind: 'auto', note: 'not counted as a reply' };
  }

  /* ── A HUMAN WROTE BACK ─────────────────────────────────────────────────── */
  const model = (await classifyWithModel({ apiKey: secrets.ANTHROPIC_API_KEY, text, subject, fetchImpl }))
    || { kind: 'other', summary: '', asks: [] };

  if (hit) {
    const status = model.kind === 'decline' || model.kind === 'hostile' ? 'declined' : 'replied';
    await store.update(PROSPECTS + hit.id, { status, replyKind: model.kind, replySummary: model.summary, decidedAt: status === 'declined' ? stamp : null });
    /* Hostile means we got it wrong. They are not asked again, ever, and that
       is a suppression rather than a status, because a status can be reset by
       a CSV re-import and a suppression cannot. */
    if (model.kind === 'hostile') {
      const { suppress } = await import('./discover.js');
      await suppress(store, { email: from, reason: 'replied unhappily' });
    }
  }

  const draft = hit
    ? await draftAnswer({ apiKey: secrets.ANTHROPIC_API_KEY, prospect: hit.data, reply: { text }, classification: model, fetchImpl })
    : { ok: false, reason: 'not one of our prospects' };
  const problems = draft.ok ? lintAnswer(draft.body, hit ? hit.data : {}) : [];

  await store.set(INBOX + emailId, {
    ...record,
    kind: model.kind,
    summary: model.summary,
    asks: model.asks,
    inReplyTo: data.message_id || '',
    answer: draft.ok ? draft.body : null,
    answerProblem: draft.ok ? null : draft.reason,
    problems,
    status: draft.ok && !problems.length ? 'drafted' : 'needs-human',
  });

  log('inbound', from, model.kind);
  return { ok: true, kind: model.kind, drafted: draft.ok && !problems.length };
}

/* ───────────────────────────────────────────────────────── THE SEND */

/**
 * Send a drafted answer. Threaded properly: In-Reply-To and References point
 * at their message, so it lands in the conversation they started rather than
 * arriving as a fresh email that looks like a second cold approach.
 */
export async function sendAnswer({ store, id, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, sendEmail }) {
  const m = await store.get(INBOX + id);
  if (!m) return { ok: false, reason: 'that message is gone' };
  if (m.status === 'answered') return { ok: false, reason: 'already answered' };
  if (!m.answer) return { ok: false, reason: m.answerProblem ? `no draft: ${m.answerProblem}` : 'no draft to send' };
  if ((m.problems || []).length) return { ok: false, reason: `the draft did not pass the linter: ${m.problems.join('; ')}` };
  if (settings.dryRun) return { ok: false, reason: 'the engine is in dry run — nothing reaches a stranger until it ends' };
  const postal = secrets.CADENIC_POSTAL || '';
  if (!postal) return { ok: false, reason: 'CADENIC_POSTAL is not set; nothing can be sent without a mailing address' };

  const { footer } = await import('./prospects.js');
  const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject || 'your Discord'}`;
  await sendEmail({
    apiKey: secrets.RESEND_API_KEY,
    from: secrets.CADENIC_FROM || 'Wyatt at Cadenic Studios <hello@cadenic.studio>',
    to: m.from,
    subject,
    text: `${m.answer}\n\n${footer({ postal })}`,
    headers: m.inReplyTo ? { 'In-Reply-To': m.inReplyTo, References: m.inReplyTo } : undefined,
    fetchImpl,
  });

  const stamp = new Date(now).toISOString();
  await store.update(INBOX + id, { status: 'answered', answeredAt: stamp });
  if (m.prospectId) await store.update(PROSPECTS + m.prospectId, { lastAnsweredAt: stamp });
  return { ok: true };
}

/** What the digest prints. */
export function inboxStats(docs) {
  const by = {};
  for (const { data } of docs) by[data.kind || 'unknown'] = (by[data.kind || 'unknown'] || 0) + 1;
  const waiting = docs.filter(({ data }) => data.status === 'drafted' || data.status === 'needs-human').length;
  return { by, waiting, total: docs.length };
}
