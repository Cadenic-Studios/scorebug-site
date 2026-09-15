# The Cadenic Discord bot pattern

One Discord bot is built here, for Scorebug. This document is how the **second**
one gets built — for Delta-V, or for a client — without writing any of the hard
parts again.

Read it before starting a new bot. It is short on purpose.

---

## What is reusable and what is not

    app/lib/discord/core.ts       ← PORT THIS UNCHANGED
    app/lib/discord/scorebug.ts   ← the product. Write a new one.
    app/lib/discord/public.ts     ← the server's public description
    app/api/discord/route.ts      ← three lines of wiring
    app/discord/page.tsx          ← the landing page that catches the search
    engine/scripts/register-discord-commands.mjs

`core.ts` knows nothing about sport, games or grades. It knows how to prove a
request came from Discord, how to shape a reply, and how to route an
interaction. Every one of those is identical for every bot anybody will ever
write, and every one of them is somewhere a hand-rolled second copy goes subtly
wrong.

**Do not fork `core.ts` and edit it.** If a second product needs something it
does not do, add it to `core.ts` and let both bots have it.

---

## Building the second bot

### 1. The product file

Copy `scorebug.ts` to `deltav.ts` and replace its insides. The contract is small:

```ts
export const deltaVBot: Bot = {
  name: 'Delta-V',
  async onCommand(i) { /* return message([...]) or note('...') */ },
  async onAutocomplete(i) { /* optional; return choices([...]) */ },
}
```

`Interaction` arrives with options already flattened — `i.options.team`, not
four levels of Discord's nesting — and `i.focused` tells an autocomplete handler
which field is being typed into.

### 2. The route

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = (req: Request) =>
  handleInteraction(req, deltaVBot, process.env.DELTAV_DISCORD_PUBLIC_KEY)
```

A separate public key per product, because they are separate Discord
applications. Never share one.

### 3. The commands

Copy the registration script, change `COMMANDS`, point it at the other app's id
and token. It does a `PUT`, so it replaces the whole set — there is nothing to
clean up between runs.

### 4. The page

Copy `app/discord/page.tsx` and `public.ts`. This is the part most people skip
and it is the part that compounds; see *Why the page exists* below.

---

## The rules worth keeping

**Verify the raw body.** Not a re-serialised object — a different string than
the one that was signed.

**Every failure is a 401.** Missing header, malformed key, thrown exception. When
you save an interactions URL, Discord sends deliberately invalid signatures and
refuses the endpoint unless they are rejected. There is no partial credit.

**Bound the timestamp.** A valid old request is still valid. Five minutes.

**Never ping.** `allowed_mentions: { parse: [] }` on every reply. A bot that can
be made to `@everyone` is a bot that gets removed from every server it is in.
`core.ts` does this for you; do not undo it.

**Answer inside three seconds.** Discord shows "the application did not respond"
otherwise, which reads as a broken bot. Every command here reads one cached
aggregate and returns. If one genuinely needs longer, let *that* command defer —
not all of them, pre-emptively.

**Say nothing about a person.** Totals and averages. A Discord server is a place
where names are attached to faces and voices, which makes it exactly the wrong
room to start reading out somebody's history with your product.

---

## Why the page exists

`/discord` on your own domain, not a bare `discord.gg` link.

`<product> discord` is close to the highest-intent query a small product gets:
whoever typed it already knows what you are and is looking for the door. A
discord.gg invite cannot rank for it — those pages are `noindex` and the link
carries no text a crawler can read. A page on your domain can, and it can answer
the two questions that decide whether somebody joins: what is in there, and what
is it for.

It is also the only durable address. Invites expire, get revoked and get
regenerated. Print `yourdomain/discord` on every card, post and video, and when
the invite changes you edit one constant — everything already out in the world
keeps working.

The page carries `FAQPage` markup answering the questions as people ask them —
*"is there a Discord bot that rates sports games"* — because an answer engine
quotes a question-shaped answer far more readily than it paraphrases a
paragraph. Write those questions the way a person would type them, not the way
a marketer would headline them.

---

## Making the bot market itself

The Scorebug bot answers with **the product's own card image**, signed, rendered
by the same press the marketing engine uses. That is the difference between a
utility and a growth loop: every answer is a branded graphic sitting in somebody
else's server with the domain along the bottom of it, and it costs nothing
because the renderer already existed.

Delta-V has the same opportunity — a run, a score, a ship. If the product can
draw a picture of itself, the bot should answer with it.

If your card press signs its claims (Scorebug's does, under `DISPATCH_KEY`),
sign them in the bot too. Without the key the card must still render, just
without the claim — a real card with less on it, never a fabricated one.

---

## Offering it as a service

What a client is actually buying is this document plus `core.ts`. The work in a
new bot is deciding what it should say, which is a conversation, not an
engineering problem. Quote the conversation.

The parts that are genuinely per-client: the command set, the copy, the palette,
the landing page, and the data source behind it. Two days, not two weeks — and
the security model, the failure behaviour and the SEO shape arrive already
right, which is the part a client cannot evaluate and will feel eighteen months
later.
