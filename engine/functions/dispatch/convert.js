// Cadenic dispatch — THE STEP THAT ASKS FOR THE WORK.
//
// ─── THE GAP THIS FILLS ─────────────────────────────────────────────────────
//
// Everything before this file generates goodwill. Discovery finds a company,
// outreach writes to them, the inbox handles the reply, and the teardown
// delivers a thousand words of specific, honest, free advice about their
// server. Then the machine stops, and whether any of it becomes money depends
// on the recipient spontaneously deciding to buy something.
//
// That is not a funnel, it is a charity with a mailing list. The teardown is
// the most valuable thing the studio gives away and the moment right after
// somebody reads it is the only moment they will ever be more informed about
// their own problem, and more aware of who explained it, than they are now.
//
// So: four days after a teardown lands, if they have not written back, one
// short note offering to do the first thing on their own list. Never a second.
//
// ─── WHY FOUR DAYS ──────────────────────────────────────────────────────────
//
// A teardown takes twenty minutes to read and most people do not read it the
// day it arrives. Four days is long enough that they have read it or never
// will, and short enough that the document is still the most recent thing they
// know about us. Ten days — the outreach follow-up interval — is too long
// here: by then the document is filed and the note reads as a stranger's.
//
// ─── WHAT IT IS NOT ALLOWED TO DO ───────────────────────────────────────────
//
// No price. That rule is universal across every module here and it is not an
// oversight at the moment of sale — it is strongest there. A number in an
// automated email is a quote, the engine cannot know their scope, and a stale
// or wrong quote is a commitment problem rather than an embarrassment. The
// pricing page carries the numbers and is always current.
//
// No second note. No "just checking in". No deadline, no scarcity, no offer
// that expires. If one honest note about their own stated problem does not
// land, the answer is no, and the correct response to no is silence.
//
// It also refuses to write at all unless it can name something specific from
// THEIR teardown. A conversion note that could have been sent to anybody is
// the exact thing the whole pipeline was built to avoid, and it would undo
// the credit the teardown earned.

import { TEARDOWNS } from './teardown.js';
import { footer } from './prospects.js';
import { bettingHit } from './safety.js';

/** Long enough to have read it, short enough to still be the last thing they read. */
export const CONVERT_AFTER_DAYS = 4;

/** Shorter than the outreach opener. By now they know who we are. */
export const CONVERT_MAX_WORDS = 150;

/**
 * Which teardowns are owed a note right now.
 *
 * A reply of any kind disqualifies: the inbox has already moved that
 * conversation to a human, and a note asking for the work while somebody is
 * mid-thread is the machine talking over its owner.
 */
export function dueForConversion(docs, now = Date.now(), afterDays = CONVERT_AFTER_DAYS) {
  const cutoff = now - afterDays * 86_400_000;
  return docs.filter(({ data: t }) => (
    t.status === 'sent'
    && t.sentAt && Date.parse(t.sentAt) <= cutoff
    && !t.convertNote                 // never a second
    && !t.repliedAt                   // they are already talking to a person
    && (t.found || []).length > 0     // there is something specific to point at
  ));
}

/**
 * The one finding to lead with: the cheapest real fix in their own document.
 *
 * Cheapest first is not modesty, it is the thing most likely to be said yes
 * to — and a first job that takes an afternoon and visibly works is worth more
 * than a large one that never starts.
 */
export function leadFinding(teardown) {
  const found = [...(teardown.found || [])].sort((a, b) => (a.cost || 9) - (b.cost || 9));
  return found[0] || null;
}

const SYSTEM = `You write one short note from Wyatt at Cadenic Studios, a small Canadian software studio that builds Discord servers and bots.

CONTEXT: a few days ago you sent this person a free written teardown of their Discord server. They did not reply. That is normal and is not a slight. This note offers to do the first thing on the list, and is the only one they will get.

VOICE: plain, warm, brief, a little dry. First person. No exclamation marks. No "just checking in", no "circling back", no "bumping this", no "I wanted to follow up". No urgency, no scarcity, no deadline. Write like somebody with enough work who would be glad to do this one.

STRUCTURE (under ${CONVERT_MAX_WORDS} words total):
1. One line: you sent the teardown, no reply needed, this is the only note.
2. Two or three sentences on THE ONE FINDING you are given — what it is and what doing it involves. Use their own specifics. This is the whole substance of the note.
3. One sentence offering to do that one thing, and saying plainly they are welcome to hand it to whoever they already use instead.
4. One sentence: what the studio charges is at https://cadenic.studio/services/discord-engineering
5. Sign off "Wyatt", blank line, then exactly the FOOTER given to you, unchanged.

HARD RULES: Never name a price or any figure that is not in the material you are given. Never promise a result, a member count or a ranking. Never ask for a call, a meeting or a time. Never mention odds, betting or gambling. Never imply they were rude not to reply. Never say this was written by software. Output the note body only — no subject line, no markdown.`;

export async function draftConversion({ apiKey, model = 'claude-sonnet-4-5', teardown, lead, postal, fetchImpl = fetch, timeoutMs = 25_000 }) {
  if (!apiKey) return { ok: false, reason: 'no ANTHROPIC_API_KEY' };
  if (!lead) return { ok: false, reason: 'nothing specific to point at' };
  const foot = footer({ postal });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 600, temperature: 0.4,
        system: SYSTEM,
        messages: [{ role: 'user', content: [
          `Their name: ${teardown.name || 'there'}`,
          `Their server or company: ${teardown.company || '(unnamed)'}`,
          '',
          'THE ONE FINDING (this is the whole note — use only this):',
          `observation: ${lead.observation}`,
          `what it costs them: ${lead.meaning}`,
          `what doing it involves: ${lead.fix}`,
          '',
          'FOOTER (copy exactly):',
          foot,
          '',
          'Write the note.',
        ].join('\n') }],
      }),
    });
    if (!res.ok) return { ok: false, reason: `anthropic ${res.status}` };
    const out = await res.json();
    const body = (out.content || []).map((c) => c.text || '').join('').trim();
    return { ok: true, body, subject: `Re: ${teardown.draft?.subject || 'your Discord teardown'}` };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * The same discipline as every other outbound message here, plus the two rules
 * that only matter at the moment of asking for money: no manufactured urgency,
 * and no reproach for the silence.
 */
export function lintConversion(body, lead, { postal } = {}) {
  const problems = [];
  const text = String(body || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words > CONVERT_MAX_WORDS) problems.push(`${words} words; limit is ${CONVERT_MAX_WORDS}`);
  if (words < 30) problems.push('too short to be a note');

  const allowed = new Set((lead?.numbers || []).map(Number));
  const bodyOnly = text.split(/\nCadenic Studios ·/)[0];
  const seen = [...bodyOnly.matchAll(/\b\d[\d,]*\b/g)].map((m) => Number(m[0].replace(/,/g, '')));
  const bad = seen.filter((n) => !allowed.has(n) && !(n >= 1900 && n <= 2100));
  if (bad.length) problems.push(`number(s) not in the finding: ${[...new Set(bad)].join(', ')}`);

  const bet = bettingHit(text);
  if (bet) problems.push(`betting vocabulary: ${bet}`);
  if (/\$\s?\d/.test(text)) problems.push('names a price');
  if (/\b(guarantee|guaranteed|will increase|will grow|will double)\b/i.test(text)) problems.push('promises a result');
  if (/\b(a call|a meeting|hop on|jump on|schedule|calendar|book a time)\b/i.test(text)) problems.push('asks for a call');
  /* ── MANUFACTURED URGENCY ────────────────────────────────────────────────
     The standard move at this point in a sequence, and the one thing that
     would make this note indistinguishable from every other piece of
     automated sales mail — which would spend all the credit the free teardown
     just earned.

     The first version of this pattern only caught the textbook phrasings
     ("limited time", "spots are filling") and let through "I have two spots
     left this month", which is the same claim in the words a person would
     actually use. Scarcity is asserted far more often by counting than by
     announcing, so the count forms are what this mostly looks for. */
  const URGENCY = [
    /\blimited (?:time|availability|spots?)\b/i,
    /\bthis (?:week|month) only\b/i,
    /\b(?:offer|price|this) expires\b/i,
    /\blast chance\b/i,
    /\bact (?:now|fast|today)\b/i,
    /\bwhile (?:supplies|spaces) last\b/i,
    /\bfirst come\b/i,
    /\bdon'?t miss\b/i,
    /\b(?:closing|ends) (?:soon|tonight|friday|this week)\b/i,
    /\bbefore (?:the )?price(?:s)? (?:go|change|rise)/i,
    /\bbook(?:ing)? (?:up|before|by)\b/i,
    // The count forms: "two spots left", "only a few slots", "one place remaining".
    /\b(?:only |just )?(?:a few|one|two|three|\d+)\s+(?:spots?|slots?|places?|openings?)\b/i,
    /\b(?:spots?|slots?|places?|openings?)\s+(?:left|remaining|available|are (?:limited|filling)|filling)\b/i,
    /\bmy (?:calendar|schedule) (?:is )?(?:filling|nearly full)\b/i,
  ];
  if (URGENCY.some((re) => re.test(text))) problems.push('manufactured urgency');
  /* Reproach. "I did not hear back" is technically true and reads as a bill
     for their attention. */
  if (/\b(didn'?t hear back|haven'?t heard back|no response|you missed|circling back|just checking in|bumping this)\b/i.test(text)) problems.push('reproaches them for the silence');
  if (!/cadenic\.studio\/services/.test(text)) problems.push('missing the pricing link');
  if (!/Reply "stop"/.test(text)) problems.push('missing the stop line (CASL)');
  if (postal && !text.includes(postal)) problems.push('missing the postal address (CASL)');
  return problems;
}

/* ══════════════════════════════════════════════════════════════ TICK */

export async function convertTick({ store, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const cfg = settings.cadenic || {};
  const summary = { due: 0, drafted: 0, refused: 0 };
  if (cfg.enabled === false || cfg.convert === false) { summary.note = 'conversion notes off'; return summary; }
  const postal = secrets.CADENIC_POSTAL || '';

  const due = dueForConversion(await store.list(TEARDOWNS), now, Number(cfg.convertAfterDays) || CONVERT_AFTER_DAYS);
  summary.due = due.length;

  for (const { id, data: t } of due) {
    try {
      if (!postal) { summary.refused++; continue; }
      const lead = leadFinding(t);
      const d = await draftConversion({ apiKey: secrets.ANTHROPIC_API_KEY, teardown: t, lead, postal, fetchImpl });
      if (!d.ok) { summary.refused++; log('convertTick', id, d.reason); continue; }
      const problems = lintConversion(d.body, lead, { postal });
      await store.update(TEARDOWNS + id, {
        convertNote: { subject: d.subject, body: d.body, leadKey: lead.key },
        convertProblems: problems,
        convertStatus: problems.length ? 'blocked' : 'drafted',
        convertDraftedAt: new Date(now).toISOString(),
      });
      if (problems.length) summary.refused++; else summary.drafted++;
    } catch (e) {
      log('convertTick', id, String(e.message || e));
    }
  }
  return summary;
}

/* ══════════════════════════════════════════════════════════════ SEND */

export async function sendConversion({ store, id, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, sendEmail }) {
  const t = await store.get(TEARDOWNS + id);
  if (!t) return { ok: false, reason: 'that teardown is gone' };
  if (t.convertStatus === 'sent') return { ok: false, reason: 'already sent — there is only ever one' };
  if (!t.convertNote) return { ok: false, reason: 'no note to send' };
  if ((t.convertProblems || []).length) return { ok: false, reason: `the draft did not pass the linter: ${t.convertProblems.join('; ')}` };
  if (t.repliedAt) return { ok: false, reason: 'they have written back — this belongs in a thread with a person in it' };
  if (settings.dryRun) return { ok: false, reason: 'the engine is in dry run — nothing reaches a stranger until it ends' };
  const postal = secrets.CADENIC_POSTAL || '';
  if (!postal) return { ok: false, reason: 'CADENIC_POSTAL is not set; nothing can be sent without a mailing address' };

  await sendEmail({
    apiKey: secrets.RESEND_API_KEY,
    from: secrets.CADENIC_FROM || 'Wyatt at Cadenic Studios <hello@cadenic.studio>',
    to: t.email,
    subject: t.convertNote.subject,
    text: t.convertNote.body,
    fetchImpl,
  });
  await store.update(TEARDOWNS + id, { convertStatus: 'sent', convertSentAt: new Date(now).toISOString() });
  return { ok: true };
}

/** For the digest: how the free document is actually converting. */
export function conversionStats(docs) {
  const delivered = docs.filter(({ data }) => data.status === 'sent').length;
  const asked = docs.filter(({ data }) => data.convertStatus === 'sent').length;
  const answered = docs.filter(({ data }) => data.convertStatus === 'sent' && data.repliedAt).length;
  return { delivered, asked, answered, rate: asked ? Math.round((answered / asked) * 100) : null };
}
