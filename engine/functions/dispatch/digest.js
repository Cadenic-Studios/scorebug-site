// Scorebug dispatch — the daily digest: the ONE surface.
//
// The brief was a system checked once a day, not a console operated. This is
// that once. Everything the machine did, everything it decided and why,
// everything that still needs a human, and every number that moved — in one
// email, at 07:00 Mountain Time, readable on a phone, with the decisions as
// links so a click is the whole interaction.
//
// Design rules, which are the site's own:
//   - Every figure ships with the sentence that says what it means. A number
//     with no sentence is deleted, not shrunk.
//   - Nothing is invented. A source that failed prints "n/a" and why.
//   - The things that need a decision come FIRST. What went well is history
//     and can wait until the reader scrolls.
//   - Links are signed and expire; the secret never travels in a URL.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { status as budgetStatus, recommendation as budgetRecommendation, costPerInstall } from './budget.js';
import { engagementScore } from './metrics.js';
import { POLICY } from './optimize.js';
import { SITE } from './facts.js';
import { PROSPECTS, outreachStats } from './prospects.js';
import { INBOX, inboxStats } from './inbox.js';
import { TEARDOWNS, teardownStats } from './teardown.js';
import { conversionStats } from './convert.js';
import { CANDIDATES, discoveryStats } from './discover.js';

const EV = 'dispatch/state/events/';
const RP = 'dispatch/state/replies/';
const RV = 'dispatch/state/reviews/';
const MET = 'dispatch/state/metrics/';
const DAY = 86_400_000;

/* ───────────────────────────────────────────────────────── SIGNED ACTIONS */

export function sign(secret, action, id, day) {
  return createHmac('sha256', String(secret)).update(`${action}:${id}:${day}`).digest('hex').slice(0, 32);
}
export function verify(secret, action, id, day, token) {
  const want = Buffer.from(sign(secret, action, id, day));
  const got = Buffer.from(String(token || ''));
  return want.length === got.length && timingSafeEqual(want, got);
}

/* ─────────────────────────────────────────────────────────────── HELPERS */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v, dp = 0) => (Number.isFinite(v) ? v.toFixed(dp) : null);
const delta = (v) => (Number.isFinite(v) && v !== 0 ? `${v > 0 ? '+' : ''}${v}` : Number.isFinite(v) ? '±0' : '');
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

const C = { void: '#0A0B0E', hull: '#11151C', line: '#242B36', phos: '#58A6FF', gold: '#E5B53C', go: '#2DD4BF', alert: '#F85149', ink: '#E6EDF3', dim: '#9AA4B2', violet: '#A371F7' };

/**
 * The 1080×1920 twin of a card, for the one network the engine does not post
 * to: TikTok is video and its API wants an audited app, so the owner posts
 * there by hand, and this is the link to save the card in the shape TikTok
 * (and every story format) takes. Only the size changes; the card is the same.
 */
function storyUrl(media) {
  const u = media && media.publicUrl;
  if (!u || !/[?&]size=/.test(u)) return null;
  return u.replace(/([?&])size=[a-z]+/, '$1size=story');
}

function card(inner, accent = C.line) {
  return `<div style="border:1px solid ${C.line};border-left:3px solid ${accent};background:${C.hull};padding:14px 16px;margin:0 0 12px">${inner}</div>`;
}
function h(text, count) {
  return `<h2 style="font:600 12px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:${C.phos};margin:26px 0 10px;border-bottom:1px solid ${C.line};padding-bottom:6px">${esc(text)}${count != null ? ` <span style="color:${C.dim}">· ${count}</span>` : ''}</h2>`;
}
function btn(href, label, colour = C.go) {
  return `<a href="${esc(href)}" style="display:inline-block;border:1px solid ${colour};color:${colour};text-decoration:none;padding:7px 14px;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;border-radius:3px;margin:8px 8px 0 0">${esc(label)}</a>`;
}
function stat(label, value, sub) {
  return `<td style="padding:0 14px 12px 0;vertical-align:top"><div style="font:700 22px/1.1 system-ui,sans-serif;color:${value == null ? C.dim : C.ink};font-variant-numeric:tabular-nums">${value == null ? 'n/a' : esc(String(value))}</div><div style="font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.dim};margin-top:4px">${esc(label)}</div>${sub ? `<div style="font:400 12px/1.4 system-ui,sans-serif;color:${C.dim};margin-top:3px">${esc(sub)}</div>` : ''}</td>`;
}

/* ────────────────────────────────────────────────────────────── THE BUILD */

export async function buildDigest({ store, publishers = {}, upcoming = [], now = Date.now(), opsUrl, opsSecret, settings = {}, health = {}, opportunities = [], organicDays = 0 }) {
  const day = ymd(now);
  const link = (action, id) => `${opsUrl}?action=${action}&id=${encodeURIComponent(id)}&day=${day}&t=${sign(opsSecret, action, id, day)}`;

  const events = (await store.list(EV)).map((d) => d.data);
  const sent = events.filter((e) => e.sentAt && now - Date.parse(e.sentAt) <= DAY).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  const waiting = events.filter((e) => e.status === 'approval').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const dry = events.filter((e) => e.status === 'dry' && now - Date.parse(e.createdAt) <= DAY);
  const refused = events.filter((e) => (e.status === 'refused' || e.status === 'stalled') && now - Date.parse(e.createdAt) <= 3 * DAY);
  const replies = (await store.list(RP)).map((d) => d.data).filter((r) => r.status === 'drafted');
  const reviews = (await store.list(RV)).map((d) => d.data).filter((r) => r.status === 'drafted' || r.status === 'needs-human');
  const prospectDocs = await store.list(PROSPECTS);
  const prospects = prospectDocs.map((d) => d.data);
  const discovery = (await store.get('dispatch/state/meta/discovery')) || {};
  const inboxDocs = await store.list(INBOX);
  const teardownDocs = await store.list(TEARDOWNS);
  const teardowns = teardownDocs.map((d) => d.data);
  const inbox = inboxDocs.map((d) => ({ id: d.id, ...d.data }));
  const candidates = (await store.list(CANDIDATES)).map((d) => d.data);
  const metrics = (await store.get(`${MET}${day}`)) || (await store.get(`${MET}${ymd(now - DAY)}`)) || {};
  const policy = (await store.get(POLICY)) || {};
  const budgetDoc = (await store.get('dispatch/state/meta/budget')) || {};
  const bud = budgetStatus({ entries: budgetDoc.entries || [], now, metrics, organic: { days: organicDays } });

  // Engagement of the posts sent in the window, keyed by event id.
  const measured = new Map();
  for (const p of (metrics.posts || [])) {
    const k = p.eventId;
    measured.set(k, (measured.get(k) || 0) + engagementScore(p));
  }

  const decisions = waiting.length + replies.length + reviews.length;
  const nets = Object.entries(settings.networks || {}).filter(([, v]) => v !== false).map(([k]) => k);
  const liveNets = nets.filter((k) => (health.publishers || []).includes(k));

  const H = [], T = [];
  const mode = settings.dryRun ? 'DRY RUN' : settings.autopilot ? 'AUTOPILOT' : 'APPROVAL';
  T.push(`SCOREBUG // DAILY DIGEST // ${day} // ${mode}`, '');
  H.push(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:${C.alert}">Scorebug // daily digest // ${day}</div>
<div style="font:700 26px/1.15 system-ui,sans-serif;color:${C.ink};margin:8px 0 4px">${decisions ? `${decisions} thing${decisions === 1 ? '' : 's'} need you.` : 'Nothing needs you.'}</div>
<div style="font:400 15px/1.5 system-ui,sans-serif;color:${C.dim}">${esc(headline({ mode, sent, waiting, replies, reviews, liveNets, metrics }))}</div>`);

  /* ── 1. DECISIONS ── */
  if (waiting.length) {
    H.push(h('Waiting on you', waiting.length));
    T.push(`WAITING ON YOU (${waiting.length})`);
    for (const e of waiting) {
      const g = e.game || {};
      const why = g.postponed || g.canceled || g.suspended ? 'the game was called off — a person decides whether to mention it'
        : /names a person/.test(e.note || '') ? 'a draft named a person — never automatic'
        : /betting/.test(e.note || '') ? 'betting language in a draft — this is a bug, not a decision'
        : g.headline || g.note ? 'the record carries a headline about a person'
        : g.sport === 'racing' ? 'a race: the winner is a named driver'
        : e.note ? 'the linter stopped it' : 'autopilot is off';
      H.push(card(
        `<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">${esc(e.type)}${e.outcome ? ` · ${esc(e.outcome)}` : ''} · ${esc(why)}</div>
         <div style="font:500 16px/1.35 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(e.title || 'Standalone post')}${(e.networks || []).length ? ` <span style="color:${C.dim};font:400 12px ui-monospace,monospace">→ ${esc((e.networks || []).join(', '))}</span>` : ''}</div>
         ${e.media && e.media.publicUrl ? `<img src="${esc(e.media.publicUrl)}" alt="${esc(e.media.alt || '')}" width="320" style="display:block;width:320px;max-width:100%;margin:8px 0 0;border:1px solid ${C.line}">` : ''}
         ${storyUrl(e.media) ? `<div style="font:400 12px/1.4 ui-monospace,monospace;margin-top:4px"><a href="${esc(storyUrl(e.media))}" style="color:${C.dim};text-decoration:none">story shape (TikTok, by hand)</a></div>` : ''}
         <pre style="white-space:pre-wrap;font:400 14px/1.5 system-ui,sans-serif;color:${C.dim};margin:8px 0 0">${esc((e.texts && (e.texts.bluesky || e.texts.threads || e.texts.mastodon || e.texts.x)) || '')}</pre>
         ${e.note ? `<div style="font:400 12px/1.4 ui-monospace,monospace;color:${C.alert};margin-top:6px">${esc(e.note)}</div>` : ''}
         ${btn(link('approve', e.id), 'Approve and send')}${btn(link('skip', e.id), 'Skip', C.dim)}`, C.gold));
      T.push(`- [${e.type}] ${e.title || ''} (${why})`, `  ${String((e.texts && (e.texts.bluesky || e.texts.threads || e.texts.x)) || '').replace(/\n/g, ' / ')}`, `  approve: ${link('approve', e.id)}`, `  skip:    ${link('skip', e.id)}`);
    }
    T.push('');
  }

  /* Refused and stalled. Deliberately ABOVE the queue and deliberately with no
     buttons: a betting hit is a bug in a template, not a decision to make at
     breakfast, and a send that was interrupted may already be public. Both
     want a person to look at the code, not to click Approve. */
  if (refused.length) {
    H.push(h('Needs a fix, not a decision', refused.length));
    T.push(`NEEDS A FIX (${refused.length})`);
    for (const e of refused) {
      const why = e.status === 'stalled'
        ? 'a send was interrupted — check the networks before doing anything with this one'
        : 'the linter REFUSED this draft. Betting language is never approvable; fix the template that wrote it.';
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.alert}">${esc(e.status)} · ${esc(e.type)}</div>
        <div style="font:500 15px/1.35 system-ui,sans-serif;color:${C.ink};margin:5px 0">${esc(e.title || '')}</div>
        <div style="font:400 13px/1.5 system-ui,sans-serif;color:${C.dim}">${esc(why)}</div>
        ${e.note ? `<div style="font:400 12px/1.4 ui-monospace,monospace;color:${C.alert};margin-top:6px">${esc(String(e.note).slice(0, 300))}</div>` : ''}`, C.alert));
      T.push(`- [${e.status}] ${e.type} ${e.title || ''}: ${why}`, `  ${String(e.note || '').slice(0, 200)}`);
    }
    T.push('');
  }

  if (reviews.length) {
    H.push(h('Play Store reviews', reviews.length));
    T.push(`PLAY REVIEWS (${reviews.length})`);
    for (const r of reviews) {
      const stars = '★'.repeat(r.stars || 0) + '☆'.repeat(Math.max(0, 5 - (r.stars || 0)));
      H.push(card(
        `<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:${(r.stars || 0) >= 4 ? C.go : C.alert}">${stars} · ${esc(r.author || 'anonymous')}${r.appVersion ? ` · v${esc(r.appVersion)}` : ''}${r.device ? ` · ${esc(r.device)}` : ''}</div>
         <div style="font:400 15px/1.5 system-ui,sans-serif;color:${C.ink};margin:6px 0">${esc(r.text || '(no text)')}</div>
         <div style="border-left:2px solid ${C.line};padding-left:10px;font:400 14px/1.5 system-ui,sans-serif;color:${C.dim}">${esc(r.draft || 'no draft — write this one yourself')}</div>
         ${(r.problems || []).length ? `<div style="font:400 12px/1.4 ui-monospace,monospace;color:${C.alert};margin-top:6px">${esc((r.problems || []).join(', '))}</div>` : ''}
         ${r.draft && !(r.problems || []).length ? btn(link('review', r.id), 'Send this reply') : ''}${btn(link('dismiss-review', r.id), 'Leave it', C.dim)}`, (r.stars || 0) >= 4 ? C.go : C.alert));
      /* The same gate as the HTML button above. This line used to print the
         send link unconditionally, so a mail client rendering the plain-text
         half offered one tap to post a draft the linter had REJECTED onto the
         public Play listing. (The endpoint re-checks too, now — a gate that
         only exists in a template is not a gate.) */
      T.push(`- ${r.stars}★ ${r.author || ''}: "${(r.text || '').slice(0, 160)}"`, `  draft: ${r.draft || '(none)'}`,
        r.draft && !(r.problems || []).length ? `  send: ${link('review', r.id)}` : `  needs you: ${(r.problems || []).join('; ') || 'no draft'}`);
    }
    T.push('');
  }

  if (replies.length) {
    H.push(h('Mentions', replies.length));
    T.push(`MENTIONS (${replies.length})`);
    for (const r of replies) {
      H.push(card(
        `<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:${C.dim}">${esc(r.network)} · @${esc(r.author || '')}${r.hostile ? ` · <span style="color:${C.alert}">flagged, machine will not answer</span>` : ''}</div>
         <div style="font:400 15px/1.5 system-ui,sans-serif;color:${C.ink};margin:6px 0">${esc(r.comment || '')}</div>
         <ol style="margin:6px 0;padding-left:20px;font:400 14px/1.5 system-ui,sans-serif;color:${C.dim}">${(r.candidates || []).map((c) => `<li style="margin-bottom:4px">${esc(c)}</li>`).join('')}</ol>
         ${(r.candidates || []).map((_, i) => btn(link(`reply${i + 1}`, r.id), `Send ${i + 1}`, C.phos)).join('')}${btn(link('dismiss', r.id), 'Ignore', C.dim)}`, C.phos));
      T.push(`- ${r.network} @${r.author}: "${String(r.comment || '').slice(0, 140)}"`, ...(r.candidates || []).map((c, i) => `  ${i + 1}. ${c}`), `  send 1: ${link('reply1', r.id)}`);
    }
    T.push('');
  }

  /* ── 1c. CADENIC — OUTREACH ──────────────────────────────────────────────
   *
   * The agency's sales queue, in the same email as the product's post queue,
   * because there is one person and one morning. Drafts first (a decision),
   * follow-ups second (a decision), then the money line — sent, replied,
   * converted — because this beat is judged on invoices, not on volume.
   *
   * Every send is a signed link. The reason each draft passed the linter is
   * NOT printed; the reason it failed is, because a blocked draft is a fact
   * the owner needs and a passed one is just a draft. */
  /* ── CADENIC — REPLIES ────────────────────────────────────────────────────
     Above the cold-email queue, deliberately and permanently. A person who
     wrote back is waiting on an answer; a draft to a stranger is waiting on
     nothing. If this email is skimmed for ten seconds, the ten seconds should
     land here.

     What has ALREADY happened by the time this is read: the follow-up was
     cancelled, a stop was honoured and suppressed, a bounce was marked. None
     of that waited for anyone. What is left in this section is the only part
     that should need a person — the words that get sent back. */
  const answers = inbox.filter((x) => x.status === 'drafted');
  const needHuman = inbox.filter((x) => x.status === 'needs-human');
  const settledToday = inbox.filter((x) => (x.status === 'closed') && now - Date.parse(x.at || 0) <= DAY);
  if (answers.length || needHuman.length || settledToday.length) {
    H.push(h('Cadenic — replies', answers.length + needHuman.length));
    T.push(`CADENIC REPLIES (${answers.length} drafted, ${needHuman.length} need you)`);

    for (const x of answers) {
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.go}">reply · ${esc(x.kind || 'other')}</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.company || x.from)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">${esc(x.summary || x.subject || '')}</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.dim};margin:0 0 8px;padding:8px 10px;background:${C.void};border-radius:6px;max-height:140px;overflow:auto">${esc((x.excerpt || '').slice(0, 400))}</pre>
        <div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:${C.dim};margin:0 0 4px">your answer</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px;padding:10px 12px;background:${C.void};border-radius:6px;max-height:240px;overflow:auto">${esc(x.answer || '')}</pre>
        ${btn(link('inbox-send', x.id), 'Send reply', C.go)} ${btn(link('inbox-skip', x.id), 'Handle it myself', C.dim)}`, C.go));
      T.push(`- REPLY ${x.company || x.from} (${x.kind}) — ${x.summary || ''}`, `  they said: ${(x.excerpt || '').slice(0, 200).replace(/\n/g, ' ')}`, `  send: ${link('inbox-send', x.id)}`, `  skip: ${link('inbox-skip', x.id)}`);
    }

    /* A reply we could not draft an answer to is MORE urgent than one we
       could, not less — it is usually the interesting one. It gets the alert
       colour and the sender's own words, because that is all Wyatt needs to
       write two lines himself. */
    for (const x of needHuman) {
      const why = (x.problems || []).join('; ') || x.answerProblem || 'no draft';
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.alert}">write this one yourself · ${esc(x.kind || 'other')}</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.company || x.from)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.alert};margin:2px 0 8px">${esc(why)}</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px;padding:10px 12px;background:${C.void};border-radius:6px;max-height:240px;overflow:auto">${esc(x.excerpt || '')}</pre>
        ${btn(`mailto:${encodeURIComponent(x.from)}?subject=${encodeURIComponent(/^re:/i.test(x.subject || '') ? x.subject : `Re: ${x.subject || ''}`)}`, 'Reply in your mail app', C.alert)} ${btn(link('inbox-skip', x.id), 'Done', C.dim)}`, C.alert));
      T.push(`- NEEDS YOU ${x.company || x.from} (${x.kind}) — ${why}`, `  they said: ${(x.excerpt || '').slice(0, 300).replace(/\n/g, ' ')}`, `  done: ${link('inbox-skip', x.id)}`);
    }

    /* The quiet line. Stops and bounces are handled without anybody, and the
       only thing owed to the reader is the count — but it is owed, because an
       unsubscribe that happens invisibly is indistinguishable from one that
       did not happen at all. */
    if (settledToday.length) {
      const by = {};
      for (const x of settledToday) by[x.kind] = (by[x.kind] || 0) + 1;
      const line = Object.entries(by).map(([k, v]) => `${v} ${k}`).join(' · ');
      H.push(`<div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.dim};margin:2px 0 10px">handled without you in 24h: ${esc(line)}</div>`);
      T.push(`  handled without you: ${line}`);
    }
    const ist = inboxStats(inboxDocs);
    T.push('');
    if (ist.total) H.push(`<div style="font:400 13px/1.6 system-ui,sans-serif;color:${C.dim};margin:0 0 14px">${ist.total} message(s) received in total</div>`);
  }

  /* ── CADENIC — TEARDOWNS ──────────────────────────────────────────────────
     The thing that was actually promised. Somebody asked for this, we said it
     was free, and every day it sits here is a day the promise is outstanding —
     so it sits above the cold-email queue and below a live reply.

     The document is not printed in full. It is a thousand words and this is an
     email; the first lines and a link to the console are what a decision
     actually needs, and the console is where it gets read properly. */
  const tdReady = teardowns.filter((x) => x.status === 'drafted');
  const tdBlocked = teardowns.filter((x) => x.status === 'blocked');
  const tdWorking = teardowns.filter((x) => ['new', 'inspected'].includes(x.status));
  if (tdReady.length || tdBlocked.length || tdWorking.length) {
    H.push(h('Cadenic — teardowns', tdReady.length + tdBlocked.length));
    T.push(`CADENIC TEARDOWNS (${tdReady.length} ready to send)`);

    for (const x of tdReady) {
      const keys = (x.found || []).map((f) => f.key).join(', ');
      const words = String(x.draft?.body || '').trim().split(/\s+/).filter(Boolean).length;
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">teardown ready · ${words} words</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.company || x.email)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">asked ${esc(String(x.askedAt || '').slice(0, 10))} · found: ${esc(keys)}</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px;padding:10px 12px;background:${C.void};border-radius:6px;max-height:220px;overflow:auto">${esc(String(x.draft?.body || '').slice(0, 900))}…</pre>
        ${btn(link('teardown-send', x.id), 'Send it', C.gold)} ${btn(link('teardown-skip', x.id), 'I will write this one', C.dim)}`, C.gold));
      T.push(`- TEARDOWN ${x.company || x.email} (${words} words, found: ${keys})`, `  send: ${link('teardown-send', x.id)}`, `  skip: ${link('teardown-skip', x.id)}`);
    }

    /* A blocked teardown is an unkept promise with a name on it, so it is
       printed in the alert colour with the reason and a way to try again —
       not folded into a count. */
    for (const x of tdBlocked) {
      const why = (x.problems || []).join('; ');
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.alert}">teardown refused</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.company || x.email)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.alert};margin:2px 0 8px">${esc(why)}</div>
        <div style="font:400 13px/1.55 system-ui,sans-serif;color:${C.dim};margin:0 0 10px">They asked ${esc(String(x.askedAt || '').slice(0, 10))} and have not had it. If the invite expired, ask them for a fresh one.</div>
        ${btn(link('teardown-retry', x.id), 'Try again', C.alert)} ${btn(link('teardown-skip', x.id), 'I will handle it', C.dim)}`, C.alert));
      T.push(`- TEARDOWN REFUSED ${x.company || x.email}: ${why}`, `  retry: ${link('teardown-retry', x.id)}`);
    }

    if (tdWorking.length) {
      H.push(`<div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.dim};margin:2px 0 10px">${tdWorking.length} being read and written now</div>`);
      T.push(`  ${tdWorking.length} in progress`);
    }
    /* ── THE ONE THAT ASKS FOR THE WORK ────────────────────────────────
       Printed inside the teardown section rather than beside it, because it
       is the same conversation four days on and splitting them would make it
       read as a separate campaign — which is exactly what it must never be.
       There is only ever one of these per teardown. */
    const convertReady = teardowns.filter((x) => x.convertStatus === 'drafted');
    const convertBlocked = teardowns.filter((x) => x.convertStatus === 'blocked');
    for (const x of convertReady) {
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.violet}">asking for the work · the only one</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.company || x.email)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">teardown sent ${esc(String(x.sentAt || '').slice(0, 10))} · no reply · leading on ${esc(x.convertNote?.leadKey || '')}</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px;padding:10px 12px;background:${C.void};border-radius:6px;max-height:240px;overflow:auto">${esc(x.convertNote?.body || '')}</pre>
        ${btn(link('convert-send', x.id), 'Send', C.violet)} ${btn(link('convert-skip', x.id), 'Leave it', C.dim)}`, C.violet));
      T.push(`- ASK ${x.company || x.email} (teardown ${String(x.sentAt || '').slice(0, 10)}, leading on ${x.convertNote?.leadKey || ''})`, `  send: ${link('convert-send', x.id)}`, `  skip: ${link('convert-skip', x.id)}`);
    }
    if (convertBlocked.length) {
      H.push(`<div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.alert};margin:2px 0 8px">${convertBlocked.length} ask(s) refused by the linter: ${convertBlocked.map((x) => `${esc(x.company || x.email)} — ${esc((x.convertProblems || []).join('; '))}`).join(' · ')}</div>`);
      T.push(...convertBlocked.map((x) => `  ASK REFUSED ${x.company || x.email}: ${(x.convertProblems || []).join('; ')}`));
    }

    const cs = conversionStats(teardownDocs);
    const ts = teardownStats(teardownDocs);
    if (cs.asked) {
      H.push(`<div style="font:400 14px/1.6 system-ui,sans-serif;color:${C.ink};margin:4px 0 10px">${cs.delivered} teardown(s) delivered · ${cs.asked} asked for the work · <span style="color:${C.gold};font-weight:700">${cs.answered} answered</span>${cs.rate !== null ? ` (${cs.rate}%)` : ''}</div>`);
      T.push(`  ${cs.delivered} delivered · ${cs.asked} asked · ${cs.answered} answered${cs.rate !== null ? ` (${cs.rate}%)` : ''}`);
    }
    if (ts.sent) {
      H.push(`<div style="font:400 14px/1.6 system-ui,sans-serif;color:${C.ink};margin:0 0 14px">${ts.sent} teardown${ts.sent === 1 ? '' : 's'} delivered in total</div>`);
      T.push(`  ${ts.sent} delivered in total`, '');
    }
  }

  const drafted = prospects.filter((x) => x.status === 'drafted').sort((a, b) => (a.draftedAt < b.draftedAt ? 1 : -1));
  const followUps = prospects.filter((x) => x.status === 'follow-up-drafted');
  const blocked = prospects.filter((x) => x.status === 'blocked');
  const awaiting = prospects.filter((x) => x.status === 'sent');
  const stats = outreachStats(prospectDocs);
  if (prospects.length) {
    H.push(h('Cadenic — outreach', drafted.length + followUps.length));
    T.push(`CADENIC OUTREACH (${drafted.length} to approve, ${followUps.length} follow-ups)`);
    for (const x of drafted) {
      const f = (x.found || []).map((y) => y.key).join(', ');
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.violet}">first email · ${esc(x.segment || 'prospect')}</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.name)} · ${esc(x.company || x.email)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">${esc(x.draft?.subject || '')} · found: ${esc(f)}</div>
        <pre style="white-space:pre-wrap;font:400 13px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px;padding:10px 12px;background:${C.void};border-radius:6px;max-height:260px;overflow:auto">${esc(x.draft?.body || '')}</pre>
        ${btn(link('outreach', x.id), 'Send')} ${btn(link('outreach-skip', x.id), 'Skip', C.dim)}`, C.violet));
      T.push(`- ${x.name} · ${x.company || x.email} · ${x.draft?.subject || ''}`, `  found: ${f}`, `  send: ${link('outreach', x.id)}`, `  skip: ${link('outreach-skip', x.id)}`);
    }
    for (const x of followUps) {
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">follow-up · the only one</div>
        <div style="font:600 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${esc(x.name)} · ${esc(x.company || x.email)}</div>
        <div style="font:400 12px/1.5 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">sent ${esc(String(x.sentAt || '').slice(0, 10))} · no reply marked</div>
        ${btn(link('outreach-follow', x.id), 'Send follow-up', C.gold)} ${btn(link('outreach-replied', x.id), 'They replied', C.go)} ${btn(link('outreach-skip', x.id), 'Drop', C.dim)}`, C.gold));
      T.push(`- FOLLOW-UP ${x.name} · ${x.company || x.email} (sent ${String(x.sentAt || '').slice(0, 10)})`, `  send: ${link('outreach-follow', x.id)}`, `  replied: ${link('outreach-replied', x.id)}`);
    }
    if (awaiting.length) {
      H.push(`<div style="font:400 13px/1.6 system-ui,sans-serif;color:${C.dim};margin:4px 0 10px">Waiting on a reply: ${awaiting.map((x) => `${esc(x.name)} <a href="${link('outreach-replied', x.id)}" style="color:${C.go}">replied</a> · <a href="${link('outreach-converted', x.id)}" style="color:${C.gold}">client</a> · <a href="${link('outreach-declined', x.id)}" style="color:${C.dim}">no</a>`).join(' &nbsp;·&nbsp; ')}</div>`);
      T.push(`  awaiting reply: ${awaiting.map((x) => x.name).join(', ')}`);
    }
    if (blocked.length) {
      H.push(`<div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.alert};margin:4px 0 10px">${blocked.length} draft(s) refused by the linter: ${blocked.map((x) => `${esc(x.name)} — ${esc((x.problems || []).join('; '))}`).join(' · ')}</div>`);
      T.push(...blocked.map((x) => `  REFUSED ${x.name}: ${(x.problems || []).join('; ')}`));
    }
    /* WHERE THE QUEUE CAME FROM. Printed with the outreach numbers rather than
       in a section of its own, because a discovery beat that finds forty
       companies and converts none of them is not a success worth its own
       heading — and the rejection reasons are how the queries get tuned. */
    const disc = discoveryStats(candidates, now - DAY);
    if (disc.seen) {
      const why = Object.entries(disc.by).filter(([k]) => k !== 'qualified').sort((a, b) => b[1] - a[1]).slice(0, 4);
      H.push(`<div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.dim};margin:2px 0 8px">found ${disc.seen} site(s) in 24h · ${disc.qualified} qualified${why.length ? ` · ${esc(why.map(([k, v]) => `${v} ${k}`).join(', '))}` : ''}</div>`);
      T.push(`  discovery: ${disc.seen} seen, ${disc.qualified} qualified${why.length ? ` (${why.map(([k, v]) => `${v} ${k}`).join(', ')})` : ''}`);
    }
    /* Which sources are actually producing. A feed that has been returning
       nothing for a week is a broken feed, and the only way anybody finds out
       is if the digest says so on the days it finds nothing. */
    const feedNotes = Object.entries(discovery.feeds || {});
    if (feedNotes.length) {
      const line = feedNotes.map(([k, v]) => `${k}: ${v}`).join(' · ');
      H.push(`<div style="font:400 12px/1.6 ui-monospace,monospace;color:${C.dim};margin:0 0 8px">sources — ${esc(line)}</div>`);
      T.push(`  sources: ${line}`);
    }
    H.push(`<div style="font:400 14px/1.6 system-ui,sans-serif;color:${C.ink};margin:6px 0 14px">${stats.sent} sent · ${stats.replied} replied${stats.replyRate !== null ? ` (${stats.replyRate}%)` : ''} · <span style="color:${C.gold};font-weight:700">${stats.converted} client${stats.converted === 1 ? '' : 's'}</span> · ${stats.by.new || 0} queued</div>`);
    T.push(`  ${stats.sent} sent · ${stats.replied} replied${stats.replyRate !== null ? ` (${stats.replyRate}%)` : ''} · ${stats.converted} clients · ${stats.by.new || 0} queued`, '');
  }

  /* ── WHERE THE ACCOUNTS CAME FROM ────────────────────────────────────────
     Printed only when there is something to print. A paid campaign is the
     one thing in this engine that costs real money every day it runs, so the
     line that says whether it is working belongs above the vanity numbers and
     needs no interpretation: source, campaign, count.

     `direct` is deliberately included rather than filtered out. A table
     showing only campaign traffic makes every campaign look like it accounts
     for all growth, which is the most flattering possible lie. */
  const campaigns = Array.isArray(metrics.campaigns) ? metrics.campaigns.filter((c) => c.signups > 0) : [];
  if (campaigns.length) {
    const total = campaigns.reduce((n, c) => n + c.signups, 0);
    const paid = campaigns.filter((c) => c.source !== 'direct');
    H.push(h('Where the accounts came from'));
    H.push(`<div style="font:400 14px/1.7 system-ui,sans-serif;color:${C.ink};margin:0 0 14px">${campaigns.slice(0, 8).map((c) => `<span style="color:${c.source === 'direct' ? C.dim : C.gold};font-weight:${c.source === 'direct' ? 400 : 700}">${esc(c.source)}${c.campaign ? ` / ${esc(c.campaign)}` : ''}</span> ${c.signups}`).join(' &nbsp;·&nbsp; ')}<br><span style="color:${C.dim}">${total} account(s) in 30 days${paid.length ? ` · ${paid.reduce((n, c) => n + c.signups, 0)} of them tagged` : ' · none tagged, so every one of them is direct'}</span></div>`);
    T.push('WHERE THE ACCOUNTS CAME FROM', ...campaigns.slice(0, 8).map((c) => `  ${c.source}${c.campaign ? ` / ${c.campaign}` : ''}: ${c.signups}`), `  ${total} in 30 days`, '');
  }

  /* ── 2. NUMBERS ── */
  const p = metrics.play || {}, d = metrics.deltas || {}, site = metrics.site || {}, prod = metrics.product || {};
  H.push(h('The numbers'));
  H.push(`<table style="width:100%;border-collapse:collapse"><tr>
    ${stat('games logged, 7 days', prod.logs7d ?? null, d.logs7d != null ? `${delta(d.logs7d)} on yesterday` : (prod.error ? prod.error : null))}
    ${stat('fans who logged, 7 days', prod.loggers7d ?? null, prod.fans != null ? `${prod.fans} accounts in all` : null)}
    ${stat('android waitlist', prod.signups && prod.signups.android != null ? prod.signups.android : null, prod.signups ? `${prod.signups.invited} invited · ${prod.signups.newsletter} on the slate list` : null)}
  </tr><tr>
    ${stat('installs, 7 days', p.installs7d ?? null, d.installs7d != null ? `${delta(d.installs7d)} on yesterday` : (p.error ? 'no public listing yet' : null))}
    ${stat('front office', prod.premium ?? null, null)}
    ${stat('rating', metrics.ratings && metrics.ratings.average != null ? n(metrics.ratings.average, 2) : null, metrics.ratings && metrics.ratings.date ? `as of ${metrics.ratings.date}` : null)}
  </tr><tr>
    ${stat('site sessions, 7d', site.sessions ?? null, (site.bySource || []).slice(0, 2).map((s) => `${s.source} ${s.sessions}`).join(', ') || null)}
    ${stat('followers', Object.values(metrics.followers || {}).some((v) => Number.isFinite(v)) ? Object.values(metrics.followers || {}).reduce((s, v) => s + (v || 0), 0) : null, Object.entries(metrics.followers || {}).map(([k, v]) => `${k} ${v ?? 'n/a'}${d.followers && d.followers[k] ? ` (${delta(d.followers[k])})` : ''}`).join(', ') || null)}
    ${stat('median engagement', metrics.engagement && metrics.engagement.median != null ? metrics.engagement.median : null, metrics.engagement ? `${metrics.engagement.postsMeasured} posts measured` : null)}
  </tr></table>`);
  T.push('THE NUMBERS',
    `- games logged 7d: ${prod.logs7d ?? 'n/a'}; fans who logged: ${prod.loggers7d ?? 'n/a'}; accounts: ${prod.fans ?? 'n/a'}; front office: ${prod.premium ?? 'n/a'}`,
    `- android waitlist: ${prod.signups ? prod.signups.android : 'n/a'} (${prod.signups ? prod.signups.invited : 'n/a'} invited; ${prod.signups ? prod.signups.newsletter : 'n/a'} on the slate list)`,
    `- installs 7d: ${p.installs7d ?? 'n/a'} (${delta(d.installs7d) || 'no prior'})`,
    `- active devices: ${p.activeDevices ?? 'n/a'}`,
    `- rating: ${metrics.ratings && metrics.ratings.average != null ? metrics.ratings.average : 'n/a'}`,
    `- site sessions 7d: ${site.sessions ?? 'n/a'}`,
    `- followers: ${Object.entries(metrics.followers || {}).map(([k, v]) => `${k} ${v ?? 'n/a'}`).join(', ') || 'n/a'}`,
    `- median engagement: ${metrics.engagement && metrics.engagement.median != null ? metrics.engagement.median : 'n/a'} over ${metrics.engagement ? metrics.engagement.postsMeasured : 0} posts`, '');

  /* ── 2b. WHERE THE SIGNUPS CAME FROM ──────────────────────────────────────
   *
   * The section this report existed without for its whole life. Everything
   * above is either a product number or an engagement number; neither answers
   * "is the posting working". This does: every link is tagged, the waitlist
   * writes the tag, and these are the tags people actually arrived on.
   *
   * The letter after the beat is the closing line the bandit chose that day —
   * q "What was it out of 5.0?", s "Grade it out of 5.0 and keep it.",
   * l "Log it. Grade it out of 5.0.", n none. */
  const acq = Array.isArray(metrics.acquisition) ? metrics.acquisition : [];
  const fromUs = acq.filter((r) => r.network && r.campaign);
  if (fromUs.length) {
    const total = fromUs.reduce((sum, r) => sum + r.signups, 0);
    const byNet = new Map();
    for (const r of fromUs) byNet.set(r.network, (byNet.get(r.network) || 0) + r.signups);
    const top = [...fromUs].sort((a, b) => b.signups - a.signups).slice(0, 8);
    H.push(h('Where the signups came from', total));
    H.push(`<div style="font:400 15px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px">${esc([...byNet.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))} <span style="color:${C.dim}">in 30 days</span></div>
      <table style="width:100%;border-collapse:collapse;font:400 13px/1.5 system-ui,sans-serif">${top.map((r) => `<tr>
        <td style="padding:3px 10px 3px 0;color:${C.ink};font-family:ui-monospace,monospace">${esc(r.network)} · ${esc(r.campaign)}</td>
        <td style="padding:3px 10px 3px 0;color:${C.phos};font-family:ui-monospace,monospace">${r.signups}</td>
        <td style="padding:3px 0;color:${C.dim}">${r.invited} invited</td></tr>`).join('')}</table>`);
    T.push(`WHERE THE SIGNUPS CAME FROM (${total} in 30 days)`,
      ...top.map((r) => `- ${r.network} ${r.campaign}: ${r.signups} (${r.invited} invited)`), '');
  } else if (acq.length || (metrics.acquisition && metrics.acquisition.error)) {
    H.push(h('Where the signups came from', 0));
    H.push(`<div style="color:${C.dim};font:400 15px system-ui,sans-serif">Nobody has reached the waitlist on a tagged link yet. That is the number to watch: everything else on this page can move without it.</div>`);
    T.push('WHERE THE SIGNUPS CAME FROM', '- nobody yet on a tagged link', '');
  }

  /* ─── CARDS SHARED, BY WEEK ────────────────────────────────────────────────
   *
   * Reported ABOVE the waitlist nudge and below the signup table on purpose:
   * it is the step between them. A fan logging a game is retention, a stranger
   * reaching the waitlist is acquisition, and a card leaving the app is the
   * only thing that connects the two. For as long as signups are zero, this is
   * the number that has to move first, and a digest that does not print it is
   * asking to be judged on likes again.
   *
   * Two weeks, side by side, because the shape of this number matters more
   * than its size at this stage. Everything else is detail: which surface (the
   * OS share sheet or the save button) and which leagues actually travel.
   */
  const shares = Array.isArray(metrics.shares) ? metrics.shares : [];
  if (shares.length) {
    const weeks = [...new Set(shares.map((r) => r.week))].sort().reverse();
    const sum = (w) => shares.filter((r) => r.week === w).reduce((n, r) => n + r.shares, 0);
    const people = (w) => Math.max(0, ...shares.filter((r) => r.week === w).map((r) => r.sharers));
    const thisWeek = weeks[0] ? sum(weeks[0]) : 0;
    const lastWeek = weeks[1] ? sum(weeks[1]) : 0;
    const delta = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
    const bySurface = new Map();
    for (const r of shares.filter((x) => x.week === weeks[0])) bySurface.set(r.surface, (bySurface.get(r.surface) || 0) + r.shares);
    const byLeague = new Map();
    for (const r of shares.filter((x) => x.week === weeks[0])) byLeague.set(r.league, (byLeague.get(r.league) || 0) + r.shares);
    const topLeagues = [...byLeague.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const unmarked = shares.filter((r) => r.week === weeks[0]).reduce((n, r) => n + r.unmarked, 0);

    H.push(h('Cards shared', thisWeek));
    H.push(`<div style="font:400 15px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 10px">
      ${thisWeek} this week from ${people(weeks[0])} ${people(weeks[0]) === 1 ? 'person' : 'people'}${lastWeek ? ` · ${lastWeek} last week` : ''}${delta === null ? '' : ` <span style="color:${delta >= 0 ? C.phos : C.alert}">${delta >= 0 ? '+' : ''}${delta}%</span>`}
      </div>
      <div style="font:400 13px/1.6 ui-monospace,monospace;color:${C.dim}">
      ${esc([...bySurface.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || 'no shares this week')}<br>
      ${esc(topLeagues.map(([k, v]) => `${k} ${v}`).join(' · '))}${unmarked ? ` <span style="color:${C.gold}">· ${unmarked} without the watermark</span>` : ''}
      </div>`);
    T.push(`CARDS SHARED: ${thisWeek} this week from ${people(weeks[0])} people${lastWeek ? `, ${lastWeek} last week` : ''}${delta === null ? '' : ` (${delta >= 0 ? '+' : ''}${delta}%)`}`,
      `  by surface: ${[...bySurface.entries()].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
      `  by league:  ${topLeagues.map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`, '');
  } else if (metrics.shares && metrics.shares.error) {
    H.push(h('Cards shared', 0));
    H.push(`<div style="color:${C.dim};font:400 15px system-ui,sans-serif">No share data yet — ${esc(String(metrics.shares.error))}. If this says the function is missing, database-v55.sql has not been run.</div>`);
    T.push('CARDS SHARED: no data — ' + String(metrics.shares.error), '');
  }

  /* The waitlist is not the goal; a tester is. A signup nobody invites is a
     person who asked to use the product and never got to. */
  const waitingToBeInvited = prod.signups ? (Number(prod.signups.android) || 0) - (Number(prod.signups.invited) || 0) : 0;
  if (waitingToBeInvited >= 5) {
    H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">Do this today</div>
      <div style="font:500 16px/1.4 system-ui,sans-serif;color:${C.ink};margin:6px 0 0">${waitingToBeInvited} people are on the Android waitlist and have not been invited.</div>
      <div style="font:400 14px/1.5 system-ui,sans-serif;color:${C.dim};margin-top:4px">Play Console → Testing → Closed testing → Testers. Every day they wait is a day they are not logging games, and the closed test is the only way in.</div>`, C.gold));
    T.push(`DO THIS TODAY: invite the ${waitingToBeInvited} uninvited Android waitlist signups (Play Console → Closed testing → Testers).`, '');
  }
  if (p.error || site.error || prod.error) {
    const why = [prod.error && `product: ${prod.error}`, p.error && `installs: ${p.error}`, site.error && `site: ${site.error}`].filter(Boolean).join(' · ');
    H.push(`<div style="font:400 13px/1.5 ui-monospace,monospace;color:${C.gold}">Not every source answered — ${esc(why)}</div>`);
    T.push(`  (sources that did not answer — ${why})`, '');
  }

  /* ── 3. WHAT THE MACHINE DECIDED ── */
  if ((policy.findings || []).length || policy.chosen) {
    H.push(h('What the machine decided'));
    T.push('WHAT THE MACHINE DECIDED');
    for (const f of policy.findings || []) { H.push(`<div style="font:400 15px/1.55 system-ui,sans-serif;color:${C.ink};margin:0 0 8px">${esc(f.text)}</div>`); T.push(`- ${f.text}`); }
    if (!(policy.findings || []).length) {
      const msg = `Still learning: ${policy.sampleSize || 0} measured posts. It keeps trying every closing line and card until one is clearly better. Below about two hundred posts this is noise wearing a graph.`;
      H.push(`<div style="font:400 15px/1.55 system-ui,sans-serif;color:${C.dim}">${esc(msg)}</div>`);
      T.push(`- ${msg}`);
    }
    T.push('');
  }

  /* ── 4. WHAT WENT OUT ── */
  H.push(h('What went out', sent.length));
  T.push(`WHAT WENT OUT (${sent.length})`);
  for (const e of sent) {
    const score = measured.get(e.id);
    H.push(`<div style="margin:0 0 10px"><div style="font:500 15px/1.35 system-ui,sans-serif;color:${C.ink}">${esc(e.type)} · ${esc(e.title || 'standalone')}${score != null ? ` <span style="color:${C.phos};font:600 13px ui-monospace,monospace">${score} engagement</span>` : ''}</div>
      <div style="font:400 13px/1.5 ui-monospace,monospace">${Object.entries(e.postedUrls || {}).filter(([k]) => k !== 'blueskyUri').map(([k, u]) => `<a href="${esc(u)}" style="color:${C.phos};text-decoration:none">${esc(k)}</a>`).join(' · ')}${(e.pending || []).length ? ` <span style="color:${C.gold}">retrying ${esc((e.pending || []).join(','))}</span>` : ''}${storyUrl(e.media) ? ` · <a href="${esc(storyUrl(e.media))}" style="color:${C.dim};text-decoration:none">story shape</a>` : ''}</div></div>`);
    T.push(`- ${e.type} ${e.title || ''}${score != null ? ` [${score}]` : ''}: ${Object.entries(e.postedUrls || {}).filter(([k]) => k !== 'blueskyUri').map(([k, u]) => `${k} ${u}`).join('  ')}`);
  }
  if (!sent.length) { H.push(`<div style="color:${C.dim};font:400 15px system-ui,sans-serif">Nothing. ${settings.dryRun ? 'Dry run is on — see below for what it would have sent.' : 'No final cleared the floor and no slot opened.'}</div>`); T.push('- nothing'); }
  T.push('');

  if (dry.length) {
    H.push(h('Dry run — what it would have done', dry.length));
    T.push(`DRY RUN (${dry.length})`);
    for (const e of dry) {
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:${C.dim}">${esc(e.type)} → would have ${esc(e.route)}</div>
        <div style="font:500 15px/1.35 system-ui,sans-serif;color:${C.ink};margin:5px 0">${esc(e.title || '')}${(e.networks || []).length ? ` <span style="color:${C.dim};font:400 12px ui-monospace,monospace">→ ${esc((e.networks || []).join(', '))}</span>` : ''}</div>
        <pre style="white-space:pre-wrap;font:400 14px/1.5 system-ui,sans-serif;color:${C.dim};margin:0">${esc((e.texts && e.texts.bluesky) || '')}</pre>`, C.dim));
      T.push(`- ${e.type} → ${e.route}: ${String((e.texts && e.texts.bluesky) || '').replace(/\n/g, ' / ')}`);
    }
    T.push('');
  }

  /* ── 5. MONEY ── */
  const rec = budgetRecommendation(bud, { metrics });
  const cpi = costPerInstall({ entries: budgetDoc.entries || [], metrics });
  H.push(h('Money'));
  H.push(`<div style="font:400 15px/1.55 system-ui,sans-serif;color:${C.ink}">CA$${bud.used} of CA$${bud.total} spent this month. CA$${bud.remaining} left.${cpi != null ? ` Measured cost per install so far: CA$${cpi}.` : ''}</div>
    <div style="font:400 14px/1.55 system-ui,sans-serif;color:${C.dim};margin-top:6px">${esc(rec || '')}</div>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font:400 13px/1.5 system-ui,sans-serif">${bud.lines.map((l) => `<tr><td style="padding:4px 10px 4px 0;color:${l.open ? C.go : C.dim}">${esc(l.label)}</td><td style="padding:4px 10px 4px 0;color:${C.dim};font-family:ui-monospace,monospace">CA$${l.remaining} left</td><td style="padding:4px 0;color:${C.dim}">${esc(l.blocker || 'open')}</td></tr>`).join('')}</table>`);
  T.push('MONEY', `- CA$${bud.used} of CA$${bud.total} spent; CA$${bud.remaining} left${cpi != null ? `; CPI CA$${cpi}` : ''}`, `- ${rec || ''}`,
    ...bud.lines.map((l) => `  ${l.label}: CA$${l.remaining} left — ${l.blocker || 'open'}`), '');

  /* ── 5b. WORTH ANSWERING BY HAND ── */
  //
  // The one block in this email that asks for writing rather than a click. The
  // engine will not post these itself and is not going to be persuaded to —
  // channels.js says why at length. Three links, oldest ranking first, and an
  // honest note that they may be nothing.
  if (opportunities.length) {
    H.push(h('Worth answering yourself', opportunities.length));
    H.push(`<div style="font:400 14px/1.55 system-ui,sans-serif;color:${C.dim};margin-bottom:8px">Real threads where Scorebug is a real answer. Reply as you, in your own words — the machine will not touch these, and it will never post to a forum.</div>`);
    for (const o of opportunities) {
      H.push(card(`<div style="font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:${C.dim}">r/${esc(o.subreddit)} · ${o.ageHours}h old · ${o.comments} comments</div>
        <div style="font:500 15px/1.35 system-ui,sans-serif;color:${C.ink};margin:5px 0">${esc(o.title)}</div>
        <a href="${esc(o.url)}" style="font:400 13px/1.5 ui-monospace,monospace;color:${C.phos}">open the thread</a>`, C.violet));
    }
    T.push(`WORTH ANSWERING YOURSELF (${opportunities.length})`, ...opportunities.map((o) => `- r/${o.subreddit}: ${o.title}\n  ${o.url}`), '');
  }

  /* ── 6. THE WEEK AHEAD ── */
  const next = upcoming.filter((g) => g.start && g.start > now && g.start - now < DAY).slice(0, 12);
  H.push(h('Today on the slate', next.length));
  H.push(`<table style="width:100%;border-collapse:collapse;font:400 13px/1.6 ui-monospace,monospace;color:${C.dim}">${next.map((g) => `<tr><td style="padding:2px 12px 2px 0;white-space:nowrap;color:${C.ink}">${esc(g.when || '')}</td><td style="padding:2px 0">${esc(g.label || '')}</td><td style="padding:2px 0 2px 10px;color:${C.gold}">${esc(g.league || '')}</td></tr>`).join('')}</table>`);
  T.push(`TODAY ON THE SLATE (${next.length})`, ...next.map((g) => `- ${g.when}  ${g.label}  [${g.league}]`), '');

  /* ── 7. HEALTH ── */
  const missing = (health.missingSecrets || []);
  H.push(h('Machine health'));
  H.push(`<div style="font:400 14px/1.6 system-ui,sans-serif;color:${C.dim}">
    Mode <b style="color:${settings.dryRun ? C.gold : settings.autopilot ? C.go : C.phos}">${mode}</b>.
    Posting to ${liveNets.length ? esc(liveNets.join(', ')) : 'no network yet'}.
    ${missing.length ? `Not configured: ${esc(missing.join(', '))}.` : 'Every configured surface answered.'}
    ${health.lastError ? `Last error: ${esc(health.lastError)}` : ''}
  </div>
  ${health.xSpend && health.xSpend.cap !== null ? `<div style="margin-top:10px;font:400 13px/1.6 ui-monospace,monospace;color:${health.xSpend.exhausted ? C.alert : C.dim}">
    X this month: $${health.xSpend.spent.toFixed(2)} of $${health.xSpend.cap.toFixed(2)} over ${health.xSpend.posts} post${health.xSpend.posts === 1 ? '' : 's'}${health.xSpend.exhausted ? ' — cap reached, X paused until the 1st' : ''}
  </div>` : ''}
  ${(health.warnings || []).map((w) => `<div style="margin-top:10px;border-left:3px solid ${C.alert};padding:8px 12px;background:rgba(255,107,107,.08);font:400 14px/1.55 system-ui,sans-serif;color:${C.ink}">${esc(w)}</div>`).join('')}
  <div style="margin-top:10px">${btn(link('pause', 'engine'), 'Pause everything', C.alert)}${settings.dryRun ? btn(`${SITE}/ops`, 'End dry run (console)', C.go) : ''}${!settings.autopilot && !settings.dryRun ? btn(`${SITE}/ops`, 'Turn on autopilot (console)', C.go) : ''}</div>
  <div style="font:400 12px/1.5 system-ui,sans-serif;color:${C.dim};margin-top:8px">Stopping is one tap from here. Starting is not: ending dry run and switching on autopilot are console actions, so that nothing in an inbox — a scanner, a prefetch, a forwarded email — can start this machine.</div>`);
  T.push('MACHINE HEALTH', `- mode: ${mode}; networks: ${liveNets.join(', ') || 'none'}${missing.length ? `; not configured: ${missing.join(', ')}` : ''}`,
    ...(health.xSpend && health.xSpend.cap !== null ? [`- x spend: $${health.xSpend.spent.toFixed(2)} of $${health.xSpend.cap.toFixed(2)} (${health.xSpend.posts} posts)`] : []),
    ...(health.warnings || []).map((w) => `- WARNING: ${w}`),
    `- pause: ${link('pause', 'engine')}`, '');

  const html = `<div style="background:${C.void};color:${C.ink};padding:22px 18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:680px;margin:0 auto">${H.join('\n')}
    <div style="margin-top:28px;border-top:1px solid ${C.line};padding-top:12px;font:400 11px/1.6 ui-monospace,monospace;color:${C.dim}">Scorebug dispatch · these links expire in three days · reply to this email and nothing will read it</div></div>`;

  const digest = { day, text: T.join('\n'), html, counts: { sent: sent.length, waiting: waiting.length, replies: replies.length, reviews: reviews.length, dry: dry.length, decisions } };
  await store.set(`dispatch/state/digests/${day}`, { ...digest, createdAt: new Date(now).toISOString() });
  return digest;
}

function headline({ mode, sent, waiting, replies, reviews, liveNets, metrics }) {
  const bits = [];
  if (mode === 'DRY RUN') bits.push('Dry run: nothing is being sent yet.');
  else if (!liveNets.length) bits.push('No network is configured yet, so nothing can go out.');
  else bits.push(`${sent.length} post${sent.length === 1 ? '' : 's'} went out on ${liveNets.join(', ')}.`);
  if (waiting.length) bits.push(`${waiting.length} waiting for a decision.`);
  if (reviews.length) bits.push(`${reviews.length} Play review${reviews.length === 1 ? '' : 's'} to answer.`);
  if (replies.length) bits.push(`${replies.length} mention${replies.length === 1 ? '' : 's'}.`);
  const logs = metrics && metrics.product && metrics.product.logs7d;
  if (Number.isFinite(logs)) bits.push(`${logs} games logged in the last seven days.`);
  return bits.join(' ');
}

/** Resend transactional send; one call, no SDK. */
/**
 * `headers` carries In-Reply-To and References when this is a reply, which is
 * what puts the message inside the thread the prospect started rather than
 * beside it as a second cold approach. Resend takes them as a flat object.
 *
 * The user-agent is not decoration: Resend answers 403 with error code 1010 to
 * any API request that arrives without one, and Node's fetch does not always
 * set a default. A send that works in testing and fails in production on a
 * header nobody set is a bad afternoon.
 */
export async function sendEmail({ apiKey, from, to, subject, text, html, headers, replyTo, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'CadenicStudios-engine/1.0 (+https://cadenic.studio)',
    },
    body: JSON.stringify({
      from, to: Array.isArray(to) ? to : [to], subject, text, html,
      ...(headers && Object.keys(headers).length ? { headers } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
