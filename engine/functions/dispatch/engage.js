// Scorebug dispatch — the engagement loop.
//
// Reads mentions and replies on Bluesky and Mastodon, drafts three
// candidate replies in the house voice, and either files them for the
// daily digest (engage.autoReply=false, the default) or sends the first
// one (engage.autoReply=true). An account that never answers reads as a
// bot; an account that answers badly reads worse — hence the default.
//
// Never replies twice to the same post, never replies to itself, never
// replies inside a thread it already answered in the last 12 hours, and
// never replies to anything the classifier below marks hostile — those
// go to the digest for a human, or to nobody.

import { replyCandidates } from './llm.js';
import { lint } from './draft.js';
import { isHostile } from './safety.js';

const RP = 'dispatch/state/replies/';
/* Hostile, or the one topic the account must never be drawn into: a mention
   asking for a pick, a line or a parlay is never machine-answered, because the
   only correct answer is a person saying, once, that there is none. */
/* The shared gate in safety.js, not a private regex. This one missed the
   plural of every word it blocked — "any parlays today", "what are the
   spreads", "best sportsbooks?" and "who do you like ATS" all passed straight
   through to the model. */
const HOSTILE = { test: (t) => isHostile(t) };
const OWN = /scorebug/i;

export async function engageTick({ store, publishers, settings, secrets, now = Date.now(), log = () => {}, fetchImpl = fetch, facts = undefined }) {
  const out = { drafted: [], sent: [], skipped: [] };
  if (!settings.engage || !settings.engage.enabled) return { ...out, note: 'engage disabled' };
  const seen = new Set((await store.list(RP)).map((d) => d.id));

  for (const net of ['bluesky', 'mastodon']) {
    const pub = publishers[net];
    if (!pub || !pub.notifications) continue;
    let items = [];
    try { items = await pub.notifications(40); } catch (e) { log('notifications failed', net, String(e.message)); continue; }
    for (const n of items) {
      if (!n.id || !n.text) continue;
      const key = `${net}-${hash(n.id)}`;
      if (seen.has(key)) continue;
      if (OWN.test(String(n.author || ''))) { seen.add(key); continue; }
      const hostile = HOSTILE.test(n.text);
      const candidates = hostile ? [] : await replyCandidates({ apiKey: secrets.ANTHROPIC_API_KEY, model: settings.llm && settings.llm.model, comment: n.text, network: net, fetchImpl, facts });
      /* `sources: ''`, deliberately. It used to be `n.text` — the stranger's own
         message — which made the mention the authority for what numbers the
         reply was allowed to quote: write "we have 4,000,000 users" at us and
         the linter would agree the reply may say it back. Numbers in a reply
         must come from the product facts, which lint() adds itself.
         `knownVocabularyOnly` is what stands in for the `people` list this
         path does not have; see the note in draft.js. */
      const clean = candidates.filter((c) => lint(c, {
        sources: '', network: net, facts, knownVocabularyOnly: true, strictNames: true,
      }).length === 0);
      const doc = { id: key, network: net, author: n.author || null, comment: n.text, postId: n.id, at: n.at || null, candidates: clean, hostile, status: 'drafted', createdAt: new Date(now).toISOString() };
      if (!clean.length) doc.status = 'no-candidate';
      const send = settings.engage.autoReply && !hostile && clean.length && !settings.dryRun;
      if (send) {
        try {
          const r = await pub.post(clean[0], { replyTo: { id: n.id, uri: n.uri, cid: n.cid, root: n.root } });
          doc.status = 'sent'; doc.reply = clean[0]; doc.url = r.url; doc.sentAt = new Date(now).toISOString();
          out.sent.push(key);
        } catch (e) {
          doc.status = 'failed'; doc.error = String(e.message);
          out.skipped.push(key);
        }
      } else {
        out.drafted.push(key);
      }
      await store.set(RP + key, doc);
      seen.add(key);
    }
  }
  return out;
}

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
