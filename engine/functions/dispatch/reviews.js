// Scorebug dispatch — the Play Store review responder.
//
// OFF until there is a public listing (settings.reviews.enabled). A closed
// test has no public reviews; the module ports unchanged and waits.
//
// The most under-automated high-value surface a solo Android developer owns.
// A replied-to review measurably lifts the rating a player leaves behind, and
// the reply is public: every future visitor to the listing reads it. Nobody
// does it because it is a chore. A machine should.
//
// WHAT IT DOES
//   reviews.list  → every review with a comment, newest first (Play keeps
//                   roughly the last week available through the API; anything
//                   older has to be answered in the console, which is why this
//                   runs daily and not weekly).
//   → dedupe against the ledger by reviewId + lastModified, so an edited
//     review is treated as new and a re-run is not.
//   → draft a reply in the house voice, from the game's verified facts only.
//   → 4★ and 5★ may be sent by the machine when reviews.autoReply is on.
//     1★, 2★ and 3★ NEVER are. A bad review is a person telling you something
//     true; the reply is a human's job and the digest hands it to him with the
//     draft already written.
//   reviews.reply → 350 characters, HTML stripped by Google. The linter
//                   enforces the limit before the call, because a rejected
//                   reply is silent.
//
// The reply never promises a fix, never gives an iOS date, never argues, and
// never claims a feature the build does not have.

import { googleFetch, SCOPES } from './google.js';
import { lint } from './draft.js';

const RV = 'dispatch/state/reviews/';
export const REPLY_LIMIT = 350;

const VOICE = `You are replying, as the developer, to a review of Scorebug on Google Play. One person, one app, no marketing department.

VOICE: plain, specific, warm without gushing. No exclamation marks. No emoji. No "we" — it is one developer, so "I". Never argue with a rating. Never promise a fix or a date. Thank people for specifics, not for the stars. Never name a player or any person. Never mention betting, odds or gambling except to say plainly that Scorebug has none and never will.

FACTS YOU MAY USE (nothing else): you log every game you watch or attend, grade it out of 5.0, write what it meant and keep it; live scores across 19 leagues (NHL, NFL, NBA, MLB, F1, IPL, CFL, NCAAF, NCAAB, Premier League, Champions League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, Chinese Super League, Indian Super League, J.League); you can back-log finals as far as the 2002 season; The Slate is the schedule, The Vault is your history, The Bleachers are public reviews, the Player Card is your profile; the web app is free at app.getscorebug.app; The Front Office is an optional membership that removes ads and adds the Analytics Desk; zero gambling ads and zero sports betting, ever. iOS is in development with NO date.

RULES: under 300 characters. If they report a bug, thank them, say it is written down, and ask for the league or the game if that would help — do not claim it is fixed. If they ask for a league the app does not have, say which nineteen it has and that you have written the request down. If they ask for iOS, say it is in development and you will not give a date. If the review is one word or empty of content, a single warm sentence is the whole reply.`;

/** GET the recent reviews Play will still let us answer. */
export async function listReviews({ sa, packageName, maxResults = 100, fetchImpl = fetch }) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/reviews?maxResults=${maxResults}`;
  const res = await googleFetch(sa, SCOPES.publisher, url, {}, { fetchImpl });
  if (!res.ok) throw new Error(`reviews.list ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const body = await res.json();
  return (body.reviews || []).map(normalizeReview).filter(Boolean);
}

export function normalizeReview(raw) {
  if (!raw || !raw.reviewId) return null;
  const comments = raw.comments || [];
  const user = comments.map((c) => c.userComment).find(Boolean);
  const dev = comments.map((c) => c.developerComment).find(Boolean);
  if (!user) return null;
  const secs = Number(user.lastModified && user.lastModified.seconds) || 0;
  return {
    reviewId: String(raw.reviewId),
    author: raw.authorName || null,
    stars: Number(user.starRating) || null,
    text: String(user.text || '').trim(),
    language: user.reviewerLanguage || null,
    device: user.device || null,
    androidOsVersion: user.androidOsVersion || null,
    appVersion: user.appVersionName || null,
    lastModified: secs ? new Date(secs * 1000).toISOString() : null,
    answered: !!dev,
    developerReply: dev ? String(dev.text || '') : null,
  };
}

export async function replyToReview({ sa, packageName, reviewId, replyText, fetchImpl = fetch }) {
  if (replyText.length > REPLY_LIMIT) throw new Error(`reply is ${replyText.length} characters; Play rejects over ${REPLY_LIMIT}`);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/reviews/${encodeURIComponent(reviewId)}:reply`;
  const res = await googleFetch(sa, SCOPES.publisher, url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ replyText }),
  }, { fetchImpl });
  if (!res.ok) throw new Error(`reviews.reply ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

/** Ask the model for a reply. Returns '' rather than throwing. */
export async function draftReply({ apiKey, model = 'claude-sonnet-4-5', review, fetchImpl = fetch }) {
  if (!apiKey) return '';
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 300, temperature: 0.4, system: VOICE,
        messages: [{ role: 'user', content: `${review.stars}-star review${review.appVersion ? ` on v${review.appVersion}` : ''}${review.device ? `, device ${review.device}` : ''}:\n\n"${review.text || '(no text)'}"\n\nWrite only the reply.` }],
      }),
    });
    if (!res.ok) return '';
    const out = await res.json();
    return (out.content || []).map((c) => c.text || '').join('').trim().replace(/^"|"$/g, '');
  } catch { return ''; }
}

/** The rule that decides who answers. Exported because it is the whole policy. */
export function mayAutoReply(review, settings) {
  if (!settings || !settings.reviews || !settings.reviews.autoReply) return false;
  if (!review.stars || review.stars < 4) return false;   // 1-3 stars are a person's job
  if (review.answered) return false;
  if (!review.text || review.text.length < 4) return false; // nothing to answer
  return true;
}

export async function reviewsTick({ store, sa, secrets = {}, settings = {}, now = Date.now(), fetchImpl = fetch, log = () => {} }) {
  const out = { drafted: [], sent: [], skipped: [], errors: [] };
  if (!settings.reviews || !settings.reviews.enabled) return { ...out, note: 'reviews disabled' };
  if (!sa) return { ...out, note: 'no service account' };
  const packageName = secrets.PLAY_PACKAGE || 'ca.scorebug.sports';

  let reviews;
  try {
    reviews = await listReviews({ sa, packageName, fetchImpl });
  } catch (e) {
    out.errors.push(String(e.message));
    return out;
  }

  const seen = new Map((await store.list(RV)).map((d) => [d.id, d.data]));
  for (const r of reviews) {
    const key = `${r.reviewId}-${(r.lastModified || '').slice(0, 10)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    const prior = seen.get(key);
    if (prior && (prior.status === 'sent' || prior.status === 'dismissed')) continue;
    if (r.answered && !prior) { await store.set(RV + key, { ...r, id: key, status: 'already-answered', createdAt: new Date(now).toISOString() }); continue; }

    const text = prior && prior.draft ? prior.draft : await draftReply({ apiKey: secrets.ANTHROPIC_API_KEY, model: settings.llm && settings.llm.model, review: r, fetchImpl });
    /* The review's own text is NOT a number source — see the same note in
       engage.js. A one-star review claiming a figure must not license the
       reply to repeat it. `knownVocabularyOnly` replaces the `people` list
       this path has never had: a drafted reply naming an athlete used to lint
       clean and, with reviews.autoReply on, post itself to the public listing. */
    const problems = text ? lint(text, {
      sources: `${r.appVersion || ''} 19 2002 5.0`,
      network: 'mastodon',
      allowLinks: ['https://getscorebug.app', 'https://app.getscorebug.app'],
      knownVocabularyOnly: true,
      strictNames: true,
    }) : ['no draft'];
    const tooLong = text.length > REPLY_LIMIT;
    const doc = {
      id: key, ...r, draft: text, problems: [...problems, ...(tooLong ? [`over ${REPLY_LIMIT}`] : [])],
      status: 'drafted', createdAt: new Date(now).toISOString(),
    };

    if (!text || tooLong || problems.length) {
      doc.status = 'needs-human';
      out.skipped.push(key);
    } else if (mayAutoReply(r, settings) && !settings.dryRun) {
      try {
        await replyToReview({ sa, packageName, reviewId: r.reviewId, replyText: text, fetchImpl });
        doc.status = 'sent'; doc.sentAt = new Date(now).toISOString();
        out.sent.push(key);
        log('review replied', r.reviewId, `${r.stars}star`);
      } catch (e) {
        doc.status = 'failed'; doc.error = String(e.message);
        out.errors.push(`${key}: ${e.message}`);
      }
    } else {
      out.drafted.push(key);
    }
    await store.set(RV + key, doc);
  }
  return out;
}
