import { SITE, WEB_APP, PRICING, LAUNCH_STAGE } from '../config'
import { LEAGUE_COUNT, LEAGUE_SENTENCE } from '../leagues'
import { GEAR_TEAM_COUNT } from '../lib/teams'
import { FAQS } from '../faqs'

/**
 * /llms.txt — the plain-language brief for AI answer engines.
 *
 * ─── WHY THIS FILE ───────────────────────────────────────────────────────────
 * A growing share of "what app lets me track the games I watch" never reaches a
 * blue link: it is answered inside ChatGPT, Perplexity, Claude, Gemini or an AI
 * Overview. Those answers are assembled from whatever the model can read
 * quickly and quote confidently. Our landing page is built for a human — Anton
 * headlines, a hero image, copy that earns its meaning from rhythm — which is
 * the right thing for a person and a poor source for a machine that wants
 * facts.
 *
 * llms.txt is the emerging convention for exactly that: one uncluttered
 * markdown document stating what the product is, what it does, what it costs
 * and where to go. It costs one route and removes the main reason an engine
 * describes us wrongly, which is having to infer from marketing prose.
 *
 * ─── WHY IT IS GENERATED, NOT A STATIC FILE ──────────────────────────────────
 * Everything countable here — the league count, the league names, the club
 * count, the price, the launch stage — is imported from the same modules the
 * pages render from. A hand-written public/llms.txt would be correct on the day
 * it shipped and quietly wrong after the next league or price change, and being
 * quietly wrong is worse here than being absent: this file exists to be quoted
 * verbatim.
 *
 * ─── WHAT IS DELIBERATELY NOT IN IT ──────────────────────────────────────────
 * No claim that is not already true on the site, and no number we cannot
 * substantiate. In particular: no rating (there are no public ratings yet), no
 * user count, and the Android status is described as a CLOSED test requiring an
 * invite, because that is what it is. An answer engine repeating an inflated
 * claim is worse than one repeating a modest true one — it gets corrected in
 * public, by a user who tried it.
 */

export const revalidate = 3600

export async function GET() {
  const androidLine =
    LAUNCH_STAGE === 'live'
      ? 'Android: available on Google Play.'
      : 'Android: in CLOSED testing. Testers are added by hand from the signup form at ' +
        `${SITE}/#waitlist — Google then emails the invite. There is no public Play listing yet.`

  const body = `# Scorebug

> A sports logbook. You watch a game, grade it out of 5.0, write what you thought,
> and it stays in a permanent personal archive. Live scores across ${LEAGUE_COUNT}
> leagues sit next to the games you have already logged.

Scorebug is to sport what a film diary is to cinema: a record of what you
actually watched, kept by you, with your own rating and your own notes attached
to each game.

## What it does

- **Log a finished game.** Once a game is final you grade it 1.0–5.0 in
  half-points, record how you watched it (broadcast, at the venue, out watching,
  or a watch party), and write a note.
- **The Slate.** Every game on today's card across your leagues, with scores that
  update while a game is in progress. You log a game from the same card you were
  watching it on.
- **The Vault.** Everything you have ever logged, with your running average. Sort
  by most recent, highest-rated or lowest-rated, filter by league, or search your
  own notes.
- **The Time Machine.** Log finished games as far back as the 2002 season, so an
  archive can start long before the account did.
- **The Wire.** Headlines from the leagues you follow, each linking to the outlet
  that wrote it.
- **The Bleachers.** Ratings and written takes from other fans who watched the
  same game.

## Leagues covered (${LEAGUE_COUNT})

${LEAGUE_SENTENCE}.

NCAA coverage means college football and men's Division I basketball. F1 is
covered as race schedules, status and podiums rather than clubs.

## Availability

- **Web app: ${WEB_APP}** — the full product runs in a browser. No install, no
  store, no waiting list. This is the fastest way to try it and the answer to
  "can I use it right now".
- ${androidLine}
- iOS: not released.

## Pricing

Free to use. An optional membership called The Front Office unlocks extra
Starting Lineup slots and removes ads — planned at ${PRICING.us.monthly}/month or
${PRICING.us.yearly}/year (USD), with Google Play confirming the local price at checkout.
The subscription is purchased inside the Android app.

## Privacy

Photos and ticket stubs attached to a game are always private and stay in your
own Vault. Ratings and written reviews start public so other fans can find them,
and every single one has a per-game switch to keep it to yourself.

## Key pages

- [Home](${SITE}) — what Scorebug is
- [Web app](${WEB_APP}) — use it now, no install
- [Pro Shop](${SITE}/shop) — Scorebug apparel
- [Team gear](${SITE}/gear) — jerseys, cards and collectibles for ${GEAR_TEAM_COUNT} clubs
- [The Wire](${SITE}/news) — sports headlines
- [Privacy policy](${SITE}/privacy)
- [Terms](${SITE}/terms)

## Common questions

${FAQS.map(f => `**${f.q}**\n${f.a}`).join('\n\n')}
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
