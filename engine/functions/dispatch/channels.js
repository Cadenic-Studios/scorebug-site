// Scorebug dispatch — the channels that are not social networks.
//
// Social is rented ground: the reach is somebody else's to change, and it
// resets to zero every time an algorithm does. The channels here are the ones
// where an audience, once gained, stays gained — and for an Android game the
// biggest of them is not a channel at all, it is the store listing.
//
//   DISCORD        our own server, our own reach, no ranking in the way. Every
//                  dispatch is mirrored there the moment it goes out.
//   NEWSLETTER     the weekly briefing, sent to the Resend audience the site's
//                  signup form already fills. An address is the only piece of
//                  audience nobody can take away.
//   STORE LISTING  the Play "what's new" text, which is read by everyone who
//                  looks at the app and is indexed by Play's own search. This
//                  module PROPOSES; a person applies it. See below for why.
//   OPPORTUNITIES  places where a real question is being asked that Scorebug is
//                  a real answer to. Surfaced for a human to answer in their
//                  own words, never auto-posted — see the note on Reddit.
//
// Everything here fails soft. A dead webhook must never take down the tick that
// called it.

import { createHmac } from 'node:crypto';
import { isHostile } from './safety.js';

/** The unsubscribe token the site verifies: HMAC of the lower-cased address under ENGINE_KEY, 32 hex chars. */
export function unsubscribeToken(key, email) {
  return createHmac('sha256', String(key)).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

/* ────────────────────────────────────────────────────────────────────────────
   DISCORD
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Mirror a dispatch into our own server.
 *
 * A webhook, not a bot: no gateway connection, no presence, no permissions to
 * get wrong, and nothing to keep alive between ticks. The URL is the whole
 * credential, which is why it lives in Secret Manager with everything else.
 */
export async function toDiscord({ webhookUrl, content, embedUrl, imageUrl, fetchImpl = fetch }) {
  if (!webhookUrl || !content) return { skipped: true };
  const body = {
    content: content.slice(0, 1900),
    allowed_mentions: { parse: [] }, // never ping anybody from an automated post
  };
  if (embedUrl || imageUrl) {
    body.embeds = [{
      url: embedUrl || undefined,
      color: 0x58a6ff,
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
    }];
  }
  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message) };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   NEWSLETTER
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Create the weekly broadcast in Resend, and — only when asked — send it.
 *
 * Created-but-unsent is the default on purpose. A broadcast is the one thing in
 * this engine that cannot be unpublished: a bad post can be deleted and a bad
 * tweet can be quoted, but mail that has left is gone into other people's
 * inboxes. So the machine writes it, and a person presses send from the digest
 * or from the Resend dashboard, until they have watched enough of them to trust
 * it — at which point `channels.newsletter` turns on and this sends directly.
 */
export async function createBroadcast({ apiKey, audienceId, from, subject, html, text, send = false, fetchImpl = fetch }) {
  if (!apiKey || !audienceId) return { skipped: true, reason: 'no resend key or audience' };
  const create = await fetchImpl('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ audience_id: audienceId, from, subject, html, text }),
  });
  if (!create.ok) {
    return { ok: false, error: `resend broadcast: HTTP ${create.status} ${String(await create.text()).slice(0, 200)}` };
  }
  const made = await create.json();
  if (!send) return { ok: true, id: made.id, sent: false };

  const go = await fetchImpl(`https://api.resend.com/broadcasts/${made.id}/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!go.ok) return { ok: true, id: made.id, sent: false, error: `send: HTTP ${go.status}` };
  return { ok: true, id: made.id, sent: true };
}

/**
 * The briefing as an email.
 *
 * Plain, single column, no images, no tracking pixels and no web fonts —
 * everything that makes a newsletter render badly in one client or land in a
 * spam folder in another. The text part is not an afterthought: it is what
 * several clients actually show.
 */
export function newsletterHtml({ title, standfirst, rows, url }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = rows.map((r) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #1F2630;">
        <div style="font:600 15px/1.35 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#E6EDF3;">${esc(r.title)}</div>
        <div style="font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9AA4B2;margin-top:4px;">${esc(r.detail)}</div>
      </td>
    </tr>`).join('');

  return `<!doctype html><html><body style="margin:0;background:#0A0B0E;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0E;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="font:700 13px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:5px;color:#F85149;padding-bottom:18px;">SCOREBUG</td></tr>
  <tr><td style="font:700 24px/1.25 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#E6EDF3;padding-bottom:10px;">${esc(title)}</td></tr>
  <tr><td style="font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9AA4B2;padding-bottom:16px;">${esc(standfirst)}</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table></td></tr>
  <tr><td style="padding-top:22px;"><a href="${esc(url)}" style="font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0A0B0E;background:#58A6FF;padding:12px 18px;text-decoration:none;border-radius:4px;display:inline-block;">Open the week's slate</a></td></tr>
  <tr><td style="font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#5d6d82;padding-top:26px;">You are getting this because you ticked the weekly-slate box at getscorebug.app. {{{RESEND_UNSUBSCRIBE_URL}}}</td></tr>
</table>
</td></tr></table></body></html>`;
}

export function newsletterText({ title, standfirst, rows, url }) {
  return [
    'SCOREBUG',
    '',
    title,
    standfirst,
    '',
    ...rows.map((r) => `- ${r.title}\n  ${r.detail}`),
    '',
    `Open the week's slate: ${url}`,
    '',
    'You are getting this because you ticked the weekly-slate box at getscorebug.app.',
    '{{{RESEND_UNSUBSCRIBE_URL}}}',
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────────────────
   THE STORE LISTING
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A proposed "what's new" for the Play listing.
 *
 * ── WHY THIS PROPOSES RATHER THAN PUBLISHES ────────────────────────────────
 *
 * The engine already holds an Android Publisher token — it reads the install
 * reports with it — and the same token can patch the listing. It is not going
 * to. A store listing is the one surface where a mistake is not a bad post but
 * a policy review, and Play's automated checks reject on things no linter here
 * models: a claim that reads as a ranking, a mention of another platform, an
 * emoji in the wrong field. A rejected listing update can hold a release.
 *
 * So this writes the text, puts it in the digest with a copy button, and a
 * person pastes it. That is thirty seconds a release against a class of failure
 * that costs days.
 *
 * The text itself is assembled from facts the engine already has: the release
 * notes it was given, and the launch window ahead, because "the next two weeks
 * of launches are in the app" is both true and the reason to open it again.
 */
export function proposeWhatsNew({ version, notes = [], upcomingCount = 0, limit = 500 }) {
  const lines = [];
  if (version) lines.push(`Version ${version}`);
  for (const n of notes.slice(0, 4)) lines.push(`- ${String(n).replace(/^[-•]\s*/, '')}`);
  if (upcomingCount > 0) {
    lines.push('', `${upcomingCount} games are on The Slate this week. Log the ones you watch.`);
  }
  const text = lines.join('\n');
  return {
    text: text.length > limit ? `${text.slice(0, limit - 1)}…` : text,
    length: Math.min(text.length, limit),
    limit,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   OPPORTUNITIES
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Places where somebody is asking a question this app answers.
 *
 * ── WHY THESE ARE NEVER POSTED AUTOMATICALLY ───────────────────────────────
 *
 * Reddit and forums like it are where an app like this genuinely gets found,
 * and they are also where an automated account gets the domain banned — not the
 * account, the DOMAIN, sitewide, permanently. That is not a hypothetical risk to
 * balance against reach; it is the loss of the channel and of every link already
 * pointing from it.
 *
 * There is also a plainer reason. The reply that works is the one that answers
 * the actual question, from somebody who made the thing. A machine cannot write
 * that, and a machine that tried would produce exactly the comment everybody
 * scrolls past.
 *
 * So the engine reads, ranks, and puts three links in the morning digest. The
 * operator writes the replies. This is deliberately the least automated thing in
 * the whole system.
 */
const SUBREDDITS = ['hockey', 'nfl', 'nba', 'baseball', 'soccer', 'CFL', 'sports', 'androidapps', 'apps', 'Letterboxd', 'formula1', 'PremierLeague'];

const WANTED = [
  /letterboxd for sports/i, /track (the )?games (i|you)('ve| have)? watched/i, /log (the )?games/i, /keep track of games/i,
  /sports (diary|journal|logbook|log app)/i, /rate (the )?games/i, /games (i|i've) attended/i, /stadium (tracker|checklist|journey)/i,
  /app (to|for) track(ing)? (games|matches)/i, /score(s)? app without (betting|gambling|odds)/i, /no (betting|gambling) (ads|odds)/i,
];
/** Threads the engine must never surface, whatever else they match. */
/* The shared wall, not a fourth private copy. This one is only deciding
   whether to SHOW the owner a thread, so it uses the broader mention gate:
   refusing to surface one thread costs nothing, and a betting thread is the
   one place this account must never turn up. */
const REFUSED = { test: (t) => isHostile(t) || /\bfantasy lineup\b/i.test(String(t)) };

/**
 * Search Reddit's public JSON for recent threads worth a human answer.
 *
 * Unauthenticated, read-only, and rate limited politely — this is the same
 * endpoint a browser hits. Failure returns an empty list.
 */
export async function findOpportunities({ fetchImpl = fetch, limit = 3, sinceHours = 48, log = () => {} } = {}) {
  const cutoff = Date.now() / 1000 - sinceHours * 3600;
  const found = [];

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetchImpl(`https://www.reddit.com/r/${sub}/new.json?limit=25`, {
        headers: { 'user-agent': 'Scorebug dispatch/1.0 (+https://getscorebug.app)', accept: 'application/json' },
      });
      if (!res.ok) continue;
      const j = await res.json();
      for (const child of (j.data && j.data.children) || []) {
        const d = child.data || {};
        if (!d.title || d.created_utc < cutoff || d.over_18) continue;
        const hay = `${d.title} ${d.selftext || ''}`.slice(0, 1200);
        if (REFUSED.test(hay)) continue;
        const hits = WANTED.filter((re) => re.test(hay)).length;
        if (!hits) continue;
        found.push({
          subreddit: sub,
          title: String(d.title).slice(0, 160),
          url: `https://www.reddit.com${d.permalink}`,
          comments: d.num_comments || 0,
          score: hits * 10 + Math.min(20, d.num_comments || 0),
          ageHours: Math.round((Date.now() / 1000 - d.created_utc) / 3600),
        });
      }
    } catch (err) {
      log(`opportunities: ${sub}: ${err.message}`);
    }
  }

  return found.sort((a, b) => b.score - a.score).slice(0, limit);
}
