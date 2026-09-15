# SCOREBUG // ENGINE — the growth machine

Written 2026-09-09, ported from the Delta-V engine (AstroDrift `functions/dispatch/`,
rev 10) and rebuilt around a scoreboard. Sibling: `RUNBOOK.md` (what the owner
does, in order). The site-side half lives in `../app` (card press, `/get`, `/r`,
`/ops`, `/slate`, `/api/dispatch/facts`).

The brief: **a system checked once a day, not a console operated.** Everything
below is judged by that.

---

## 1. What it is

Twenty-eight modules in `functions/dispatch/`, no new npm dependencies,
**101 behavioural tests** (`cd functions && npm test`), of which 22 are the
hardening suite — one test per defect found in the 9 September audit. Node 22, ESM, Firebase
Functions v2. Plus six routes on the site.

### The loops

| Loop | Clock (Mountain) | What it does |
|---|---|---|
| **Publish** | every 10 min | Reads every in-season league's scoreboard (ESPN; TheSportsDB for CFL), detects beats, ranks the candidates against the day's budget, drafts, lints, routes, posts, records. |
| **Engage** | every 30 min | Mentions on Bluesky and Mastodon → three drafted answers → the digest. Hostile or betting-adjacent mentions are flagged and never machine-answered. |
| **Measure** | 03:20, 15:20 | Logs and loggers this week and waitlist counts from Supabase, GA4 sessions by source, follower counts, and per-post engagement read back from the networks. One document a day. |
| **Decide** | 03:40 | Thompson sampling over the closing line, the card style and the product line. Prints its confidence. |
| **Reviews** | 04:00 | Play reviews → drafted replies. Off until there is a public listing. |
| **Publish content** | Mon 05:00 | The week's slate page (`/slate/2026-W38`), the newsletter draft, an IndexNow ping. |
| **Report** | 07:00 | One email. Decisions first, then the product numbers, then what the machine decided, then what went out, then money, then today's slate, then health. |
| **Send the letter** | Mon 09:00 | The approved slate email, only to addresses that ticked the box, with a one-tap unsubscribe. |

### The beats (events.js)

| Beat | When | Where | What |
|---|---|---|---|
| SLATE | 07:00–09:00 | all | Today's five best fixtures on one card. |
| PREGAME | T-1h, one a day | Bluesky, X | The day's best fixture, an hour out. |
| FINAL | within minutes | Bluesky, Mastodon, X | A final worth posting. Candidates only — `rank.js` chooses. |
| MORNING | 07:00–10:00 | Threads, Instagram | Last night's best final again, for the networks where nobody is awake at 23:40, with the community grade if ten fans logged it. |
| ANNIVERSARY | 11:00–14:00 | all | A final from this date in a past season, back to 2002, chosen by the same scorer. Round numbers first. |
| PRODUCT | Tue/Thu 19:00–21:00 | all | One verified sentence about the app, through `/get`. |
| WEEKAHEAD | Mon 12:00–14:00 | all | The week's slate page. |
| WEEKNUMBERS | Sun 20:00–22:00 | all | What the community logged — only once one game has ten logs. |

### The files

| File | Job |
|---|---|
| `leagues.js` | The registry, mirrored from the app: ESPN slugs, season windows, the sport's idea of "close", team hashtags, Canadian clubs, local-time helpers. |
| `feed.js` | ESPN scoreboards per league (no custom user-agent — ESPN's edge 403s one), TheSportsDB for CFL, fails soft per league, `people` lifted from every record for the linter. |
| `events.js` | The beats, the windows, `needsHuman` / `isRoutine` — the safety rules in code. |
| `rank.js` | **The module Delta-V never needed.** Scores every final on what the record says (margin vs the sport's tight/close, OT, comeback in the linescores, upset in the records, rivalry, playoffs up, preseason down, audience, Canadian side), applies per-network daily caps, a gap, a per-league cap, a quality floor, one final per tick, one X link a day. |
| `safety.js` | **The one copy of the brand's hardest promise.** The betting vocabulary, the mention gate and the name matcher, folded through a Unicode normaliser first so a Cyrillic "а", a zero-width space or an accent cannot smuggle a word past. draft.js, engage.js and channels.js used to carry three private copies of this and all three missed the plural of nearly every word they blocked. |
| `draft.js` | Templates (scoreline · one clause · the invitation), `compose`, and **the linter**: no `!`, no emoji, hashtag budget per network, no hype, no link off an allow-listed **origin** (not a string prefix), **no betting language (hard REFUSE — quarantined, never approvable)**, **no person the record names (hold)**, every number traceable to the record as a token, not a substring. The reply paths add `knownVocabularyOnly`, which holds anything naming a proper noun the engine does not already know. |
| `facts.js` | The product facts from the site's `/api/dispatch/facts`; the conservative fallback; the verified product lines. The engine never types a claim about the product. |
| `tags.js` | Team tag, then league tag, then beat tag; budgets Mastodon 3, Bluesky 2, Threads 1, Instagram 5, X 0. |
| `cards.js` | Builds card-press URLs; the site renders. |
| `archive.js` | The anniversary finder: round years first, three leagues a day, twelve requests at most. |
| `supabase.js` | Anon-key reads of four SECURITY DEFINER aggregates — including `engine_signup_sources`, which reads back the tags the engine has always written and is the only thing in here that can say whether the posting acquires anyone; the consented newsletter list behind ENGINE_KEY. |
| `publish.js` | Bluesky (DID login, UTF-8 facets for links and tags), Mastodon, Threads, **Instagram** (new: container → publish, image only), X (OAuth 1.0a by hand). |
| `media.js` | Fetch, sniff, cap per network before a byte moves toward a social API. |
| `xspend.js` | The X meter: prices the reply too, charges before the call, refuses the post that would cross the cap. |
| `run.js` | The orchestrator, and the only sender. |
| `content.js` | The weekly slate page and the newsletter draft. No model prose. |
| `digest.js`, `engage.js`, `llm.js`, `metrics.js`, `optimize.js`, `budget.js`, `reviews.js`, `channels.js`, `google.js`, `threadsToken.js`, `store.js` | Ported from Delta-V; rebranded; the arms, the plan, the facts and the voice replaced. |
| `index.js` | The scheduled functions and the ops endpoint. |

### On the site (`../app`)

| Route | What |
|---|---|
| `/api/card` | The card press. Parameters that make a CLAIM about Scorebug — a community grade, a games-logged total, a free-text headline — must carry an HMAC (`sig`) or they are dropped and the rest of the card still renders; scorelines stay open, because a fake one is a lie anybody could tell in an image editor. Satori on the edge, built from the site's own parts: the app icon (`brand/icon-128.png`, from `public/app-icon.png`), Anton for the two-tone headline (`.headline`), Oswald and Inter, the `.lit-*` floodlight sky, `.glass-card`, the `.enamel-red` pill, and the app's Broadcast Shields (`lib/shields.gen.ts`, 1,500 clubs, generated from the app's dictionaries) on a tile that washes away-colour to home-colour like the app's matchup card. Kinds: final, pregame, archive, slate, product, week, numbers. Four shapes: wide, square, portrait, and `story` (1080×1920) for TikTok and stories by hand. `hl=TOP\|BOTTOM` overrides the headline. Every parameter clamped. |
| `/api/dispatch/facts` | `LAUNCH_STAGE`, `appPlatforms()`, `androidCta()`, `PRICING`, the leagues, the rivalries — signed with `DISPATCH_KEY`. |
| `/get` | The store link. Reads `LAUNCH_STAGE`: `live` → Play with the referrer; otherwise → the waitlist with the tags carried into `tester_signups.source`. |
| `/r/[...path]` | The short site link; rebuilds the UTM form; passes `gameId`/`gameTime` through to The Log. Cannot be an open redirect. |
| `/slate`, `/slate/[week]` | The weekly page, read over the Firestore REST API. |
| `/ops` | The console: state, the queue, mentions, numbers, the bandit, money, the newsletter. Password, `noindex`, **zero client JavaScript**. |
| `/newsletter/unsubscribe` | One tap, HMAC-checked twice. |
| `/indexnow-key.txt` | From an env var. |
| `/.well-known/atproto-did` | The Bluesky DID as plain text (a static file in `public/`, with its content type named explicitly in next.config.js — a catch-all rule there was forcing `application/json`, which atproto rejects). |

`firestore.rules` deny all client access to `dispatch/**` except
`dispatch/public/articles/{week}`, world-readable, client-unwritable.

---

## 2. What the machine may never do

In code, not in this document:

- Mention odds, a spread, a line, a parlay, a sportsbook, a bonus bet, or a price shape like `+150` — `draft.js` `BETTING`, a hard reject that parks the draft as a bug.
- Name a player, coach, referee or any person the record names — `lint({ people })`, a hold for the owner. Templates never insert a name; the check exists for the model path and for team names that happen to be a surname.
- Post about a postponed, cancelled or suspended game, a record whose headline is an injury or worse, or a race (the winner is a named driver) without a person — `events.js` `needsHuman`.
- Post more than the day's budget on any network, two finals from one league, a final under the quality floor, or two finals in one tick — `rank.js`.
- Be started by a link in an email. `pause` is one tap from the digest because stopping is the safe direction; ending dry run and switching on autopilot are console actions, and every other mutating action renders a confirmation page on GET and only acts on POST — because mail scanners follow links.
- Post the same draft twice. The ledger row is written **before** the send, an approval is claimed with a compare-and-set, and a send that was interrupted is marked `stalled` for a human rather than retried blind.
- Retry for ever. Four attempts with backoff, then the digest says it gave up — it used to try 216 times over 36 hours, which on X is 216 duplicate posts and about US$47 against a US$10 cap.
- Post on X when the spend meter cannot read or write its own ledger. The meter fails closed.
- Quote a fan's log. The Bleachers are public; a brand account quoting one needs an opt-in the app does not collect.
- Post an affiliate link, or any link off `getscorebug.app` / `app.getscorebug.app` — `ALLOWED_LINKS`.
- Claim a platform the product is not on. The claim is read from the site's facts, and `/get` decides where the click lands.
- Send a newsletter to an address that did not tick the box, or without an unsubscribe link.
- Post to Reddit or any forum. The opportunity finder reads, ranks, and refuses betting threads.
- Spend money. It recommends; the owner clicks.
- Post the same event twice, re-draft a post that failed on one network, or send anything older than 36 hours.

---

## 3. The ladder

Four settings, in the order that earns trust. Each is one field in
`dispatch/settings`, and every one has a control on `/ops` and in the digest.

1. **`dryRun: true`** — five days. Every tick records what it *would* have sent
   and where. The digest shows it, with the card. Nothing goes out.
2. **`dryRun: false`, `autopilot: false`** — every post waits for a click in
   the morning email. Two days.
3. **`autopilot: true`** — slates, pregames, finals, mornings, anniversaries,
   product lines and the week ahead go out by themselves. Anything about a
   person still waits. **This is the self-driving state.**
4. **`engage.enabled: true`**, then `engage.autoReply: true` a week later.
   `channels.newsletter: true` once the consented list has more than a handful
   of addresses.

`enabled: false` stops everything within ten minutes; the digest's **Pause
everything** link sets it, and no signed email link can ever start the machine.

---

## 4. Settings worth knowing

```
maxPerDay: { bluesky: 5, mastodon: 5, threads: 4, x: 3, instagram: 1 }
minGapMinutes: 40           maxPerLeaguePerDay: 2
floors: { minFinal: 4, minPregame: 3, xLink: 8 }
weights: null               // rank.js WEIGHTS overrides, key by key
xMonthlyCapUsd: 10
community: { enabled: true, minLogs: 10 }
archive: { enabled: true }
llm: { enabled: false }     // the optional sentence; off, see llm.js
```

All merge key by key, so setting one nested key never wipes its siblings.

---

## 5. Costs

Functions at this volume round to zero. Anthropic: reply drafts only, under
US$2/month. X pay-per-use: US$0.015 a post plus US$0.005 for the card, US$0.20
for the one linked reply a day — about US$4–5/month at the default caps, capped
at US$10 by the meter and at US$15 by the console. Resend: free tier. Supabase:
three aggregate queries a day. ESPN and TheSportsDB: free, no key, no contract.

---

## 6. What has not been verified

Stated plainly, because an unverified claim that turns out wrong costs more
than an admitted gap:

- Threads, Instagram and X have never been called with real tokens. The X,
  Bluesky, Mastodon and TikTok accounts exist (`@scorebug_app`,
  `did:plc:j6ypvmvjbaya4mbwxrrrci24`, `@scorebug@mastodon.social`,
  `@scorebugapp`); no tokens have been issued yet. Request shapes come from the
  published APIs; the X signature is asserted against the documented vector.
- TikTok has no publisher on purpose: it is a video network with an audited
  posting API. The engine gives every card a story-shaped twin and the digest
  links it; the owner posts there by hand until the numbers justify a
  card-to-motion pipeline (RUNBOOK §2).
- The card press has been rendered locally through Satori + resvg for every
  kind and shape (the PNGs are in `../marketing/kit/samples`); it has not yet
  been deployed to Vercel's edge. Edge bundle weight: fonts 175 KB (Anton,
  Oswald ×2, Inter ×2), shields 123 KB, the icon 11 KB — under the 1 MB edge
  limit with room.
- ESPN has been read live from two networks. TheSportsDB's CFL day endpoint has
  been read for shape, not for a live game day.
- The Supabase functions in `database-v54.sql` have been written against the
  schema in the repo, not run against the project.
- The weekly slate page and the ops console type-check; they have not been
  rendered against a live engine.

---

## 7. Adding a market

The design leaves room for a second account per network (a UK Bluesky account
for the Premier League, say) without a rewrite: an event carries its league,
`NETWORKS_FOR` and the caps are the only per-network tables, and publishers
are keyed by network. The work is (1) a `markets` setting mapping league → account,
(2) suffixed secrets (`BSKY_HANDLE__UK`), (3) `fromSecrets` building
`publishers[account][network]`, (4) `sendAll` taking the account from the
event. Do it only when a market has earned it — the digest's per-league
engagement will say when.
