# Scorebug — account kit

Every file in this folder is made from the real brand assets and nothing else:
the avatar **is** `scorebug-site/public/app-icon.png` (the store icon, the site
header, and the X avatar already uploaded); the banners carry the app's own
wordmark (`scorebug-app/public/icons/wordmark.png`, lifted to white with the red
beacon kept) over the app's own rink backdrop, with the site's two-tone hero
in Anton. Never a team crest, never a league logo, never a player.

## The accounts that exist (created 2026-09-09)

| Network | Handle | Display name today | Do | Banner |
|---|---|---|---|---|
| **X** | `@scorebug_app` | "Scorebug Sports Chronicler" | Avatar is up. Add `x-header-1500x500.png`, the bio below, the site link, the pinned post. Consider the display name — see below. | `x-header-1500x500.png` |
| **Bluesky** | `@scorebug-app.bsky.social` → `@getscorebug.app` | Scorebug | Finish "Change handle → No DNS panel": once the site is deployed, tap **Verify Text File** (the site serves the DID at `/.well-known/atproto-did`). Avatar `avatar-400.png`, banner, bio. **Verify the email** — an unverified account cannot post. | `bluesky-banner-3000x1000.png` |
| **Mastodon** | `@scorebug@mastodon.social` | Scorebug | Avatar `avatar-400.png`, header, bio. In the profile's "extra fields" put `Website = https://getscorebug.app` — the site links back with `rel="me"`, so Mastodon shows it as **verified** (green) within a few minutes. | `mastodon-header-1500x500.png` |
| **TikTok** | `@scorebugapp` | Scorebug | Avatar `avatar-400.png`, the short bio, the site link (the website field may take a day or two to appear on a brand-new account; if it does not, switch to a Business account, which is free and always has it). No engine here; see "TikTok" in the runbook. | none (TikTok has no banner) |
| **Discord** | server "Scorebug" | — | Avatar as the server icon; `#the-slate` channel; webhook → `DISCORD_WEBHOOK_URL`. | — |
| Threads / Instagram | not yet | — | Month two. When you make them: try `scorebug_app` first so X and Meta match, then `scorebugapp` (to match TikTok). Same login serves both. | none |

**The X display name.** "Scorebug Sports Chronicler" is accurate but long: on a
phone the timeline shows about 20 characters before the handle, so it reads as
"Scorebug Sports Chr…". "Scorebug" alone is what every other account says and
what the wordmark says. Your call — the engine never reads it.

**The DID.** `did:plc:j6ypvmvjbaya4mbwxrrrci24` is the account's permanent
identity; the handle is a label on it. The engine logs in with the DID, the
site's `sameAs` points at `bsky.app/profile/<DID>`, and both keep working
whichever handle the profile shows.

## Bios

No exclamation marks, no emoji, no hashtags in a bio. The link is the site, and
on TikTok and Instagram the link is the whole call to action.

**Bluesky (256 chars)**
> The logbook for every game you watch. Grade it out of 5.0, say what it meant, keep it for good. Live scores across 19 leagues, no odds anywhere. Made in Canada by Cadenic Studios.
> getscorebug.app

**X (160 chars)**
> The logbook for every game you watch. Grade it out of 5.0, keep it for good. Live scores across 19 leagues. Zero odds, zero sportsbooks. Made in Canada.

**Mastodon (500 chars)**
> Scorebug is the logbook for every game you watch or attend: grade it out of 5.0, write what it meant, and keep it for good. Live scores and schedules across 19 leagues — NHL, NFL, NBA, MLB, CFL, MLS, the Premier League and the rest of Europe, the IPL, F1 — and a back catalogue to 2002. There is no gambling in it, no odds, no sportsbook, and there never will be. Free on the web. Made in Edmonton by Cadenic Studios. This account is run by an engine that posts scorelines and never names a person; a human reads every reply.

**TikTok (80 chars)**
> Grade every game out of 5.0. 19 leagues. Zero gambling. Free on the web.

**Threads / Instagram (150 chars)**
> Your life as a fan, on the record. Grade every game out of 5.0 and keep it. 19 leagues. Zero gambling.

**Discord server description**
> Scorebug fans. Log the games you watch, compare grades, find your Linemates. No odds, no picks, no betting talk — that rule is the whole point.

## Pinned post (post once by hand, in your own words, then pin)

> This account posts finals, tonight's slate, and anniversaries from the archive, and asks one question every time: what was it out of 5.0? It is run by an engine I built, it never names a player, and it will never mention odds. If you reply, a person reads it.

## The cards (`samples/`)

What the engine posts, rendered from the live card press at
`getscorebug.app/api/card`: finals, the community grade, a pregame, an
anniversary, the slate, the week ahead, the week in numbers, the product lines,
in wide (1200×675, Bluesky/X/Mastodon), square (1080×1080, Threads/Instagram),
portrait (1080×1350) and story (1080×1920 — TikTok and stories, by hand).
Every card is the site: Anton headline, Oswald display, Inter body, the app
icon, the floodlit sky, the enamelled glass, the enamel-red pill, and the app's
Broadcast Shields — original crests drawn from club colours, never a logo.
