# Scorebug marketing engine — starting prompt

Paste everything below the line into a new Cowork conversation, with this computer linked.

---

I want to build Scorebug a marketing engine, reusing what we built for Delta-V.

## What already exists (Delta-V — the thing to port)

In `C:\Users\wyatt\Documents\AstroDrift` there is a working, live, autonomous marketing engine for my game Delta-V. It runs on Firebase Cloud Functions (project `delta-v-b4837`, Node 22, ESM) against a Next.js site on Vercel. It is currently live with `dryRun=false, autopilot=true` posting to four networks, with 143 passing tests. **Read that repo before designing anything** — particularly `functions/dispatch/`, `scripts/ignite.mjs`, `scripts/clipd.mjs` and `scripts/clipVision.mjs`. The long docblocks in those files explain *why* each decision was made, and most of those reasons apply again.

The pieces worth porting, and what each one solved:

- **`ignite` — one command, whole deploy.** Reads `functions/.secrets.local`, pushes every value into Google Secret Manager, writes `functions/.env`, runs the tests, deploys the functions, writes the Vercel production variables, deploys the site, then verifies the live result. It must never overwrite the operator's live/dry-run choice on a redeploy, must survive its own offer to delete the secrets file, and must report the engine's *actual* mode at the end rather than a hardcoded string. All three of those were real bugs.
- **Two switches, not one.** `dryRun` (nothing reaches a network) and `autopilot` (routine posts send themselves). Anything genuinely sensitive always waits for a human regardless of both.
- **An ops endpoint + a daily digest email** with signed one-click approve / skip / pause links, so the whole thing can be driven from a phone.
- **Per-network publishers.** Bluesky (richtext facets for links *and* tags — without a facet a hashtag is grey text that nothing indexes; log in with the **DID**, never a handle, because handles change; video goes through a separate service with a service-auth token whose audience is the user's own PDS), Mastodon, Threads (fetches media by public URL, and hoists exactly one hashtag into a topic tag), X (OAuth 1.0a, and it *bills per request* — see the spend meter).
- **A spend meter for any paid network.** X charges $0.015 a post, or **$0.200 if the post contains a URL**. The meter prices each send, charges itself *before* the network call, and refuses the post that would cross a monthly cap. Running out costs one network, never the whole post. It must count replies too — the link often lives in a reply, and that is the expensive half.
- **A linter over every draft.** No exclamation marks, no emoji, no hype words, numbers must be traceable to the source record, links restricted to an allow-list, hashtags budgeted per network. It is what stops the output reading like a bot.
- **Short attribution links.** `/get?s=…&c=…` for the store and `/r/<path>?s=…&c=…` for the site, both 302ing server-side to the full UTM form. Posting the full tagging inline costs ~90 characters and visibly makes a post look machine-made.
- **A Thompson-sampling bandit** over copy variants, and a nightly metrics pull (GA4 Data API + Play install reports).
- **The clip factory.** Drop a screen recording in a folder, run `clips`, and ffmpeg scores it on motion and loudness, a vision model discards menus and loading screens and writes a caption from what is actually on screen, then it cuts branded vertical 1080×1920 video with an animated caption, a progress bar, an end card and a synthesized audio bed. **This one needs the most rethinking for Scorebug** — see below.

## What Scorebug is

- **Positioning:** "The Letterboxd for sports." You log every game you watch or attend, grade it out of 5.0, write what it meant, and keep it forever. Live scores across **19 leagues** (NHL, NFL, NBA, MLB, F1, IPL, CFL, NCAAF, NCAAB, Premier League, Champions League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, Chinese SL, Indian SL, J.League). You can back-log finals as far as the 2002 season.
- **In-app language:** The Log (submitting a game), The Slate (schedule), The Vault (your history), The Bleachers, the Player Card (profile), The Front Office (premium), The Wire (news), the Analytics Desk.
- **Where it runs:** Web is **live** at `app.getscorebug.app`. Android is in **closed testing** (`ca.scorebug.sports`). iOS is in development. Marketing site is `getscorebug.app`; `scorebug.ca` 301s to it. One Next.js + Supabase codebase ships to all three via Capacitor.
- **Repos on this PC:** `scorebug-site` (marketing site, Next 14 + Tailwind), `scorebug-app` (the product), `scorebug-commerce` (Medusa v2 → Braintree → Printify merch backend), `scorebug-keys`, `scorebug-releases`.
- **Brand:** canvas `#0A0B0E`, card `#11151C`, red `#F85149`, blue `#58A6FF`, teal `#2DD4BF`, gold `#E5B53C`, ink `#E6EDF3`. Oswald for display, Inter for body. Broadcast-graphics aesthetic.
- **Made by** Cadenic Studios, in Canada.

## Revenue surfaces the engine should drive

1. **The Front Office** — $3.99/month or $19.99/year, sold through Paddle on web, Google Play on the Android build.
2. **Ads** — AdSense on web, AdMob on native. Premium users see none.
3. **Affiliates** — Fanatics International and eBay, wired per league. Every link carries `rel="sponsored"` under a visible SPONSORED badge. See `scorebug-site/PARTNERS.md`.
4. **Merch** — Pro Shop and Fan Gear, Medusa + Printify.

## Hard constraints — these are not preferences

- **Zero gambling. Zero sports betting. Ever.** The site says so in its own voice: no odds, no spreads, no bonus-bet inducements, no sportsbook logo. Sports content and automation are saturated with betting affiliates, and the engine must refuse them outright — not weigh them. This is the single most important rule and it is a brand promise already made in public.
- **Never advertise a store listing that does not admit the reader.** `scorebug-site/app/config.ts` has a `LAUNCH_STAGE` switch (`waitlist` / `testing` / `live`) precisely because the site was once linking "Get it on Google Play" at a listing that did not exist, and later at a *closed* test that admits nobody uninvited. Android is at `testing` today, so Android calls to action must route to the waitlist signup, not to Play. The engine must read that switch rather than hard-coding a link, and it must never claim a platform the product is not on — `appPlatforms()` is the one source of truth for that claim.
- **The machine never holds a payment method and never spends money.** It recommends; I click.
- **Never post to Reddit or any forum.** Read and rank only — automated forum posting is a domain-ban risk.
- All credentials live in Secret Manager or Vercel env vars, never in the repo. `*.local`, `*.jks`, keystore files and service-account JSON stay gitignored.
- Anything involving a real person — an athlete, a death, a serious injury — waits for me, the same way Delta-V holds any launch failure or crewed mission.

## Where I think the content actually comes from

Delta-V's daily beat was the spaceflight calendar: launches, anniversaries, moon phases. Scorebug's equivalent is far richer and already in the product — **19 leagues of live scores and schedules**, plus a back catalogue to 2002. Every night has finals; every date has anniversaries. Start there.

The clip factory needs rethinking, because Scorebug has no gameplay to record. I suspect the visual unit is a **generated card image** rather than video — Delta-V's `/api/card` route renders share images with Satori, and a graded-game card in Scorebug's broadcast aesthetic is the obvious analogue. Tell me if you disagree.

Scorebug has **no social accounts yet** — the site's `sameAs` lists only cadenic.studio and GitHub. So unlike Delta-V, this starts from zero: we will need to decide which networks are worth it before creating anything.

## What I want from you first

Do not start building. Read the Delta-V repo and the three Scorebug repos, look at the live site, and come back with:

1. What ports across essentially unchanged, what needs adapting, and what should not be reused at all.
2. Your honest view of the content calendar — what a week of posts actually looks like, with real examples, not a description of a system.
3. Which networks are worth creating accounts on for a sports-logging app, in priority order, and what each costs. Be direct if one is not worth it.
4. What you need from me — accounts, credentials, decisions — as a short list, ordered so I am never blocked waiting on you and you are never blocked waiting on me.

Push back where the Delta-V approach was wrong or where sports changes the answer. I would rather hear it now.
