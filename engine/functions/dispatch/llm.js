// Scorebug dispatch — the one sentence a model is allowed to write.
//
// ── OFF BY DEFAULT, AND WHY ─────────────────────────────────────────────────
//
// Delta-V let a model write "the sentence that says what the figure means" on
// every launch post. In sports that sentence is almost always about a person —
// who scored, who missed, who got hurt — and this engine's first rule is that
// it never names one. So the model path exists (settings.llm.enabled) but
// ships off, and when it is on, the output is linted against the record's
// named athletes like anything else. A rejected sentence ships a template-only
// post, which is the post the engine wanted anyway.
//
// The reply candidates are a different matter: a mention is a conversation,
// and three drafted answers for the owner to pick from is worth a model call.

import { productLines, FALLBACK_FACTS, platformLine } from './facts.js';

const VOICE = `You write one short sentence (under 160 characters) for a sports account with this voice: a scoreboard that likes you. Dry, specific, literate. No exclamation marks, no emoji, no hashtags, no hype words (epic, huge, insane, amazing, instant classic). Uppercase only for acronyms.
HARD RULES: use ONLY facts present in the game record you are given. NEVER name a player, coach, referee or any person. Do not add any number that is not in the record. Do not mention odds, betting, spreads or anything about gambling. Do not mention the app. If the record gives you nothing worth saying that is not about a person, reply with exactly: NONE.`;

export async function meaningSentence({ apiKey, model = 'claude-sonnet-4-5', game, eventType, fetchImpl = fetch, timeoutMs = 20_000 }) {
  if (!apiKey) return '';
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 120, temperature: 0.3,
        system: VOICE,
        messages: [{ role: 'user', content: `Event: ${eventType}\nGame record (JSON):\n${JSON.stringify(game)}\n\nWrite the sentence, or NONE.` }],
      }),
    });
    if (!res.ok) return '';
    const out = await res.json();
    const text = (out.content || []).map((c) => c.text || '').join('').trim();
    if (!text || /^NONE\b/.test(text)) return '';
    return text.replace(/\s+/g, ' ');
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

/** Three candidate replies to a comment, JSON array of strings. */
export async function replyCandidates({ apiKey, model = 'claude-sonnet-4-5', comment, network, fetchImpl = fetch, facts = FALLBACK_FACTS }) {
  if (!apiKey) return [];
  const facts_ = productLines(facts).map((l) => l.text).join(' ');
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 400, temperature: 0.5,
      system: `Write three possible replies, as the Scorebug brand account (a sports logbook: you log every game you watch, grade it out of 5.0, and keep it), to a comment on ${network}. Voice: a scoreboard that likes you — dry, specific, plain. Answer the actual point. Never argue. Never name a player or any person. Never mention odds, betting or gambling; if asked for a pick or a line, say plainly that Scorebug has none and never will. If it is criticism of the app, thank them and say what is true. If it asks for iOS, say it is in development, no date. Android: ${platformLine(facts)} No emoji, no exclamation marks, under 240 characters each. Only these facts about the product: ${facts_} Reply with only a JSON array of three strings.`,
      messages: [{ role: 'user', content: comment }],
    }),
  });
  if (!res.ok) return [];
  const out = await res.json();
  const text = (out.content || []).map((c) => c.text || '').join('');
  try {
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    return Array.isArray(arr) ? arr.map(String).slice(0, 3) : [];
  } catch {
    return [];
  }
}
