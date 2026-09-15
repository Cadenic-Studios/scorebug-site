# Scorebug marketing engine — port assessment

Written 2026-09-09 after reading `AstroDrift/functions/dispatch/` (22 modules), `scripts/ignite.mjs`, `scripts/clipd.mjs`, `scripts/clipVision.mjs`, `web/docs/ENGINE.md`, the `/get`, `/r` and `/api/card` routes, and the five Scorebug repos plus the live site. Nothing has been built. This is the answer to the four questions, plus the things I found while reading that change the design.

> **Status, later the same day.** Everything below has since been built: the
> engine is in `scorebug-site/engine/` (79 tests), the site pieces are in
> `scorebug-site/app/`, the migration is `scorebug-app/database-v54.sql`, and
> what remains for the owner is `engine/RUNBOOK.md`. The accounts now exist
> and the plan is corrected to them: **X `@scorebug_app`**, **Bluesky**
> `@scorebug-app.bsky.social` → `@getscorebug.app` once the site's
> `/.well-known/atproto-did` verifies (the "No DNS panel" path, not the TXT
> record proposed in §3), **Mastodon `@scorebug@mastodon.social`**, and
> **TikTok `@scorebugapp`**, which was not in the plan and is handled by hand
> with a story-shaped twin of every card (runbook §2). The card press and the
> kit were rebuilt around the real assets — the app icon, the wordmark, the
> rink backdrop, Anton — after the first drafts read as generic. §3's handle
> advice (`getscorebug` everywhere) is superseded: the set is what it is, and
> the site's `sameAs` and footer say exactly that.

---

## The short version

- **About 60% of the engine ports with a find-and-replace**: the orchestrator, the ledger, the two switches, the ops endpoint, the signed digest, the four publishers, the spend meter, the media pipeline, `ignite`. The remaining 40% is the part that knows what a launch is, and it gets rewritten around a scoreboard.
- **The clip factory does not port. You are right about the card.** The app already has a "Broadcast Shield" system built specifically so no trademarked crest ever renders — that is the asset the card press needs, and it is why the cards can be generated at all.
- **Sports inverts Delta-V's core problem.** Delta-V had to find something to say on quiet days. Scorebug will have 60–150 finals on a Saturday in November and must choose. The new module is a ranker, not a template bank.
- **The real-person rule reshapes the voice more than anything else.** Sports posts name people constantly; this machine must not. It posts about games, teams, scores and grades. That happens to match the product's own hook — grade the game — so the constraint is a feature.
- **Start with Bluesky, Threads and X, plus a Discord server and the waitlist email. Not Instagram yet, not TikTok, not Mastodon beyond a free mirror.** Costs below; X is the only one that bills, at roughly $8/month at the volume proposed.
- **Two things in the repos need fixing before the engine links to them**: the league pages claim "free on Android" in hard-coded copy while `LAUNCH_STAGE` is `testing`, and the waitlist form has no newsletter consent, which matters under CASL.

---

## 1. What ports, what adapts, what does not

### Ports essentially unchanged

| Module | Why it survives |
|---|---|
| `run.js` (orchestrator) | One sender, retry-per-network, 36h expiry, approved-queue drain. Sport-agnostic. |
| `store.js` | Firestore/memory ledger. Settings shape changes; the interface does not. |
| `index.js` scheduling + lazy admin imports | The 10-second discovery budget lesson applies verbatim. |
| `digest.js` + HMAC one-click links | Rebrand the email. The phone-driven approve/skip/pause is the whole operating model. |
| `publish.js` (Bluesky, Mastodon, Threads, X) | Every hard-won detail — DID login, UTF-8 byte facets, Bluesky video service auth, Mastodon 202 polling, Threads public-URL fetch, X OAuth 1.0a hand-signed with the multipart exception — carries over. Add an Instagram publisher later; it is the Threads shape with a different host. |
| `xspend.js` | Identical, including reply-counting. Verified today against docs.x.com: $0.015 / $0.200 with URL / $0.005 media metadata. Cap lower (see §3). |
| `media.js` | Sniffing, per-network caps, "never resize in Functions". The card press renders at a size that fits everything. |
| `engage.js` | Mentions → drafts → hostile flag. |
| `channels.js` Discord mirror + opportunities finder | Reddit stays read-only. The subreddit list changes. |
| `scripts/ignite.mjs` | Parameterise the project id, the secrets list and the Vercel project. All three fixed bugs (never clobber live/dry-run, survive the delete-secrets offer, report actual mode) stay. |
| Lazy `firebase-admin` imports, the `__unset__` sentinel, the `DISPATCH_OPS_URL` default | All deploy-time contracts, all still true. |
| `optimize.js` (bandit) | Ports as code. See the caveat under "where Delta-V was wrong". |
| `llm.js` | One fenced paragraph, linted like everything else. Same fence. |

### Needs adapting

| Module | What changes |
|---|---|
| `feed.js` | LL2 → ESPN scoreboard, per league, using the app's `leagueRegistry.ts` (slugs, `rangeQuery`, `extraQuery`, `seasonMonths`) so the engine and the app can never disagree about a fixture. CFL comes from the app's own scraped tables in Supabase, not ESPN — the CFL scoreboard returned an empty events array today. |
| `events.js` | The transition detector becomes: **SLATE** (morning), **PREGAME** (T-1h, one marquee game), **FINAL**, **OVERTIME/EXTRA-TIME/SHOOTOUT**, **COMEBACK** (led by ≥N at a break, lost), **UPSET** (standings gap), **ANNIVERSARY** (same date, prior seasons back to 2002), **WEEK-AHEAD**. `needsHuman` gains: anything naming an athlete, postponed/abandoned games, any event the feed marks with an injury or incident note. |
| New: `rank.js` | The selection layer that Delta-V never needed. Scores every final on margin, overtime, total, standings, rivalry (the site's `matchups.ts` already lists them), audience weight per league, and time of day — then posts the top N per network per day. |
| `draft.js` templates + `GAME_FACTS` | Facts become: 19 leagues, back-log to 2002, grade out of 5.0, web live, Android early access, $3.99 / $19.99 Front Office, zero gambling. `SITE`, `LIMITS` unchanged. `GAME_LINES` become `PRODUCT_LINES`. |
| `draft.js` `lint()` | Keep every rule. **Add a betting blocklist** (`odds`, `spread`, `moneyline`, `parlay`, `over/under`, `o/u`, `bet`, `sportsbook`, `+150`-style prices, `lock`, `pick`) as a hard reject, not a hold. Add a person-name check: any capitalised token that matches a roster name in the record routes to approval. Numbers still trace to the source record — for sports that is the score, the period, the date and the season. |
| `tags.js` | Vocabulary becomes league + team. Budgets stay (Mastodon 3, Bluesky 2, Threads 1, X 0). League tags derive from the registry; team tags are a hand-checked table for marquee clubs and fall back to the league tag — generated team hashtags are how you end up posting `#NewYorkJets` when the fans use `#Jets`. |
| `almanac.js` | The lunar theory and eclipse canon go. The *pattern* — the site owns the calendar, the engine consumes `/api/dispatch/almanac` with `DISPATCH_KEY` — stays, and the site's almanac becomes: today's slate, anniversaries from the archive, season milestones (opening night, trade deadline, playoffs). |
| `google.js` + `metrics.js` | GA4 property `551128063` exists already. Play install reports and `reviews.js` wait until there is a public listing — the module ports, the schedule stays off. **New north-star sources**: Supabase `tester_signups` (which already carries a `source` column for attribution) and `game_records` counts. |
| `budget.js` | You have not stated a Scorebug budget. The gates are worth keeping even at $0 because they are what stops a future spend line from firing without a measured reason. |
| `content.js` (weekly briefing) | "Every launch this week" becomes "the week's slate" — one page per week on the site with every fixture across 19 leagues. |
| `/get` and `/r` on the site | Port to `scorebug-site`. **`/get` must read `LAUNCH_STAGE`**: at `testing` it 302s to `/#waitlist` with the same `s`/`c` tags carried into the form's `source` field; at `live` it 302s to Play with the referrer. That is the mechanism that makes "never advertise a listing that does not admit the reader" true for every post ever sent, retroactively. |
| `/api/card` | Rewrite in Scorebug's palette, Oswald/Inter, three sizes, with the Broadcast Shields. See §1.3. |

### Should not be reused

| Piece | Why |
|---|---|
| `clipd.mjs`, `clipVision.mjs`, `clipFactory.mjs` | There is no screen to record. The motion/loudness scoring, the vision pass, the ffmpeg pipeline — none of it has an input. Do not keep it around "for later"; if Scorebug ever wants video it will be card-to-motion (a Satori card animated in ffmpeg), which shares no code with this. |
| The Delta-V almanac's science (`verify:almanac`, lunar bisection, NASA eclipse canon, the 7,971-launch mirror) | Nothing to verify against. |
| `DEPOT_LINES` / the Shopify shop beat | Scorebug's merch is Medusa + Printify and the shop is at `/shop` on the site. The *rule* ports (say what it is, never a price, one in N quiet slots); the lines do not. |
| The photo-archive licence logic (`isArchivePhoto`, `subjectLadder`, `NOT_THE_EVENT`) | Sports photography is the opposite of NASA's archive: essentially nothing is free to reuse, and a wire photo on a brand account is a takedown. Cards replace photos entirely. |
| Delta-V's quiet-day machinery | There are no quiet days in a 19-league calendar. Replaced by the ranker's daily cap. |

### 1.1 Where the engine lives

Recommendation: **a new repo `scorebug-engine` on a new Firebase project (`scorebug-engine`, Blaze plan), not inside any existing repo, and not on Supabase Edge Functions.**

- `scorebug-app` is `output: 'export'` — a static bundle with no server, no secrets and no cron. It cannot host this and its own README says so.
- Supabase Edge Functions are Deno. Porting 143 passing Node tests to Deno throws away the thing that makes the port cheap. The engine reads Supabase over REST with a scoped key; it does not need to live there.
- `scorebug-site` is on Vercel and hosts the pieces that must be URLs: the card press, `/get`, `/r`, `/api/dispatch/almanac`, `/ops`, the weekly slate page. Same split as Delta-V, for the same reason (Threads and Instagram only accept media by public URL).
- Keeping it out of `delta-v-b4837` keeps the two ledgers, the two secret sets and the two digests separate, so a Delta-V redeploy can never touch Scorebug's live/dry-run state.

### 1.2 Where the Delta-V approach was wrong, or where sports changes the answer

1. **Timing is per network, not per event.** North American finals land 21:00–00:30 MT. On X and Bluesky, sports fans are awake and arguing at 11:40pm — post the final within minutes. On Threads and Instagram nobody is; those get the morning "last night" card at 07:00 MT. Asian leagues (J.League, CSL, ISL) finish at 03:00–07:00 MT and belong in the morning slate, never posted at final time. Delta-V posted every event to every network at the same instant; that was fine for a launch and is wrong here.
2. **The bandit needs samples it will not have for months.** Thompson sampling over five copy variants with 60 posts a month is noise wearing a graph. Port it, but make the arms *selection* features (question vs statement, card style, final-time vs morning) and print its confidence in the digest so you can see when it is still guessing.
3. **No player names, ever, without a click.** This is the single biggest voice constraint. A machine that says "Titans 16, Lions 15. One point. Grade it." is safe forever; a machine that says who missed the kick is one bad night from a post about a real person's worst day. It also means no Wire/news reposts — every headline is about a person.
4. **Never quote a user's log.** The Bleachers are public, but a fan's review on a brand account without opt-in is a real person too. A "Bleachers spotlight" beat needs a per-user consent flag in the app first; skip it until then.
5. **Affiliate links never go in a post.** Impact and CJ terms want disclosure, networks treat them as spam, and the brand promise is about not being the sleazy corner of sports media. Posts link to `/gear/[team]` and `/leagues/[league]` on the site, where the SPONSORED badge and `rel="sponsored"` already exist.
6. **The Play reviews responder waits.** Closed testing has no public reviews. Keep the schedule off until `LAUNCH_STAGE` is `live`.
7. **ESPN is not a contract.** The site's `/api/espn` proxy exists because ESPN dropped CORS overnight and took The Slate down. The engine calls ESPN from Functions (server-side, unaffected by CORS), caches every scoreboard in Firestore, and a failed pull is a skipped beat, never a post with a stale score. Also: the cards must never carry ESPN's logo files. The shields exist for exactly this.
8. **Cards, not photos, not video.** Agreed with your instinct, with one refinement: the card is the *whole* visual language, so it is worth designing once, well, and generating three shapes (1200×675 for X/Bluesky link previews, 1080×1080 Threads/Instagram, 1080×1350 portrait) from one component.
9. **Discord is a product feature here, not just a mirror.** The app already has Discord OAuth and `discord_servermates()`. A Scorebug server is where servermates come from. It moves from "nice owned channel" to priority two.
10. **Volume caps per network per day, hard.** Delta-V could not over-post; this engine can post 100 finals in a night if the ranker has a bug. `maxPerDay: { bluesky: 5, threads: 4, x: 3, mastodon: 5, instagram: 1 }` in settings, enforced in `run.js` before the publisher is called.

### 1.3 The card press

Lives at `scorebug-site/app/api/card`, Satori on the edge, public URL, every parameter clamped — same as Delta-V. What is on it:

- Two Broadcast Shields (from `lib/data/badges.gen.ts` and the hand-seeded list — copy the generator output into the site the same way `leagues.ts` mirrors the registry), the score in Oswald, the league chip in its registry colour, period/OT/ET/SO marker, date and season.
- One of three bottom bands: **Grade it** (the 5.0 dial, empty), **Community grade** (the dial filled, "n logs" — gated on n ≥ 10 so an empty product never says "2 fans"), or **The Slate** (up to five fixtures with local times).
- Canvas `#0A0B0E`, card `#11151C`, ink `#E6EDF3`, red `#F85149` for the grade dial, gold `#E5B53C` for the OT marker, blue `#58A6FF` for the league chip default, teal `#2DD4BF` for the community band. `getscorebug.app` in the corner, nothing else.
- Cricket scorelines are strings, not integers (the registry warns about this); the card takes the string.

---

## 2. A real week — Monday 14 to Sunday 20 September 2026

Fixtures below were pulled from ESPN's scoreboard today. Times are Mountain. Every draft passes the current linter (no exclamation marks, no emoji, no hype words, every number in the record). Bracketed values are the ones the engine fills at final time — I am not inventing scores for games that have not been played.

**Monday 14**
- 07:00 · **Slate card** (all networks): "Monday on Scorebug. Newcastle at Leeds, 1pm MT. Tigers at Blue Jays, 5:07pm. Broncos at Chiefs, 6:15pm, the last game of Week 1. Log the ones you watch." Link `/r/the-slate?s=bluesky&c=slate`.
- 17:15 · **Pregame** (X, Bluesky only): "Broncos at Chiefs in an hour. Monday night, Week 1. Grade it when it is over." Card: Grade it, empty dial.
- ~21:45 · **Final** (X, Bluesky, Mastodon, at final; Threads next morning): "Broncos [a], Chiefs [h]. [Final / OT]. Grade it out of 5.0 and keep it." Card: Grade it. X gets the card and no link ($0.02); the link rides in one reply only if the ranker scored this the night's top game ($0.20).

**Tuesday 15**
- 07:00 · **Last night** (Threads, Instagram): the Broncos–Chiefs final card with "Monday night is on the record. Grade it."
- 19:30 · **Product line** (Bluesky, Mastodon): "Every game you have ever watched, back to the 2002 season, graded out of 5.0 and kept. That is The Vault. Free on the web." Link `/r/?s=bluesky&c=vault`. No card, or the portrait Vault card.

**Wednesday 16**
- 07:00 · Slate card. Midweek European fixtures, MLB.
- Evening · Top-ranked MLB final only (Mastodon and Bluesky). Threads gets nothing today — under-posting is fine.

**Thursday 17**
- 07:00 · Slate card: "Lions at Bills tonight, 6:15pm MT. Thursday night, Week 2."
- 17:15 · Pregame, Grade-it card.
- ~21:30 · Final. This is the week's X link post.

**Friday 18 — an anniversary day**
- 07:00 · **On this day** (all networks): "18 September 2016. Titans 16, Lions 15. One point, Week 2, ten years ago today. It is in the archive if you were there." Card: the 2016 final with the Grade-it band. This is the archive beat — the engine reads the same calendar date in prior seasons back to 2002, ranks by margin and overtime, and posts one. No names, no highlight, just the scoreline and the invitation.
- 12:00 · Pregame for Chelsea at Brentford (1pm MT), Bluesky only, because Friday-afternoon Premier League reaches the European-hours audience on Bluesky and nobody on X at noon Mountain.
- Evening · CFL from the app's own tables; top NCAAF Friday game if any.

**Saturday 19 — the volume problem in miniature**
- 05:30 Villa at Spurs, 08:00 Arsenal at Brighton plus three more Premier League 3pm kickoffs, NCAAF all afternoon, MLB, 17:00 Canadiens–Maple Leafs split-squad preseason in both cities, 18:00 **Jets at Oilers, first NHL preseason game in Edmonton**, then Kings, Kraken.
- The ranker's job: at most five posts to Bluesky today, three to X. Likely picks: the 07:00 slate card (which itself lists five fixtures — that is how the other fifty games get mentioned), Arsenal at Brighton final at ~10:00, a "hockey is back" card at 17:00 ("Jets at Oilers tonight, 6pm MT. The first NHL game on the Slate this season, preseason or not. The Vault opens for 2026-27."), the Oilers final around 20:45, and one NCAAF final chosen on margin.
- 20:45 · The Oilers card is also the week's **Front Office** line, once, in the reply: "Analytics Desk turns your Vault into a season in numbers. Part of The Front Office." No price in the post; the pricing page has it.

**Sunday 20**
- 07:00 · Slate card: "Week 2, Sunday. Eagles at Titans, Steelers at Patriots, Packers at Jets, Vikings at Bears, Panthers at Falcons, all 11am MT. Log every one you watch."
- 12:45–13:15 · Early-window finals: the ranker posts *one*, the closest margin, as a card. The rest are in the app.
- ~16:30 · Late-window top final.
- 20:30 · **Week in numbers** (all networks, only once the gate passes): "[n] games logged on Scorebug this week across [k] leagues. Highest community grade: [Away] [a], [Home] [h], [grade] from [n] logs." Until the gate passes (≥ 10 logs on a single game), this slot is the weekly "the week ahead" post that links the slate page instead.

**What the machine sends by itself under autopilot:** slate cards, pregames, finals, anniversaries, product lines, the week-ahead. **What waits for your click:** anything with a person's name in the record, any postponed or abandoned game, the week-in-numbers post, anything the linter flagged, and every reply to a mention.

Weekly volume at this plan: ~28 Bluesky, ~24 Mastodon, ~12 Threads, ~14 X (of which ~4 carry a link), ~5 Instagram. That is a busy but recognisably human account, and every post is a scoreline with an invitation, which is the only thing this product needs people to do.

---

## 3. Networks, in priority order

| # | Network | Verdict | Cost | Why |
|---|---|---|---|---|
| 1 | **Bluesky** | Created | Free. Domain handle `@getscorebug.app` via the site serving the DID at `/.well-known/atproto-did` (no DNS record needed) — no squatting problem, and it verifies ownership. | Hashtag feeds and custom feeds mean a zero-follower account can be *found*; NHL and NBA communities are real there; the publisher is done and handles video if cards ever move. Link previews render the 1200×675 card. |
| 2 | **Discord server** | Create now | Free | Product feature (servermates) and owned channel. The webhook mirror ports as is. |
| 3 | **Waitlist email** (Resend) | Wire now, send when consent exists | Free tier | `tester_signups` is the only audience you own. Weekly slate email plus the Android invite. **Blocked on CASL consent — see §4.** |
| 4 | **Threads** | Create now | Free; 250 posts/24h; dev-mode testers means no App Review for your own account | Meta gives new accounts real distribution, cards look right, one topic tag hoists. Same Meta app serves Instagram later. |
| 5 | **X** | Create now, capped | $0.015 a post, $0.200 with a URL, $0.005 media metadata. At the §2 volume: ~60 posts × $0.02 + ~16 link replies × $0.20 ≈ **$4.40/month**; set `xMonthlyCapUsd: 10` and a $15 hard limit in X's console. Requires a card on file — yours, in X's console; the machine never sees it. | Sports conversation lives here more than anywhere. Reach for a new account posting links is near zero, so the card carries the post and the link rides in a reply only when the ranker says the game deserved it. |
| 6 | **Mastodon** | Create, mirror, expect little | Free | The publisher exists, tags are the entire distribution mechanism there, and the marginal cost of a fifth copy is zero. Do not spend design time on it. |
| 7 | **Instagram** | Month two | Free; 100 API posts/24h; needs a Professional account | Cards are the right unit, but Instagram is link-hostile and the audience discovers through Reels, which we do not make. One card a day, bio link only, via the same Meta app as Threads. Worth it once the cards look good on Threads. |
| — | **TikTok** (`@scorebugapp`, created) / YouTube Shorts | By hand, measured | Free; the posting API needs an app audit | No engine video yet. Every card has a 1080×1920 story twin, linked from the digest; the owner posts a daily 15-second app screen-recording with the card as cover. A card-to-motion pipeline follows the first post that clears a thousand views, not before. |
| — | **Pinterest** | No | — | Wrong audience for live sport. |
| — | **LinkedIn** | No | — | Cadenic Studios news only, by hand. |
| — | **Reddit / forums** | Read only, as specified | Free (read) | The opportunities finder surfaces threads like "app to track games I've watched" for you to answer in your own words. |

Handles, as they turned out: X `@scorebug_app`, Mastodon `@scorebug`, TikTok `@scorebugapp`, Bluesky the domain. Not one string, but each is short and unambiguous, and the DID and the site's `sameAs` tie them together. When Threads/Instagram are made, `scorebug_app` first (matches X), then `scorebugapp` (matches TikTok).

---

## 4. What I need from you — ordered so nobody waits

**You, this week (none of it blocks me):**

1. **Say yes or no to §3's list** and to the engine living in a new `scorebug-engine` Firebase project. Create the project (Blaze) and enable Secret Manager, Firestore and Cloud Functions — same as `delta-v-b4837`.
2. **Decide the X cap** (I propose $10) and whether Scorebug has any paid budget at all this year. If it is $0, `budget.js` still ports with every gate closed.
3. **Create the accounts**, in this order: Bluesky (domain handle — I will give you the exact TXT record), Discord server + one webhook URL, Threads via an Instagram Professional account + a Meta developer app with the Threads API product, X account + developer pay-per-use with a $15 spending limit, Mastodon on `mastodon.social`. Use `hello@getscorebug.app` for all of them.
4. **Google**: grant `Viewer` on GA4 property `551128063` to a new service account in the engine project (I will name it). Play Console access waits for a public listing.
5. **Supabase**: I will write a read-only role and two RPCs (`engine_game_aggregates`, `engine_signup_counts`) so the engine never holds the service-role key. You run the SQL and paste the key it produces into `.secrets.local`.
6. **Resend**: verify `getscorebug.app`, and a full-access key (the Delta-V key is send-only and cannot broadcast).
7. **Approve two site copy changes** I will draft: the CASL consent line on the waitlist form ("Also send me the weekly slate" — unchecked by default, required before any newsletter goes to that list), and the league-page fix below.

**Me, starting now, with no credentials:**

1. Scaffold `scorebug-engine`: port the unchanged modules, rewrite `feed`/`events`/`draft`/`tags`, add `rank.js`, port the tests and write the sports ones (a Saturday with 120 finals, an abandoned game, a cricket scoreline, a player name in the record).
2. On `scorebug-site`: the card press, `/get` with `LAUNCH_STAGE`, `/r`, `/api/dispatch/almanac`, `/ops`, the weekly slate page.
3. Parameterised `ignite.mjs`.
4. Dry-run against the real ESPN feed for a week with no network secrets set — the digest shows what would have gone where.

**Then, together:** `ignite`, dry run for five days, `dryRun: false` with every post waiting for your click for two days, then `autopilot: true` — the same ladder as Delta-V, because it worked.

---

## 5. Found while reading — fix before the engine links anywhere

- **`scorebug-site/app/leagues/[league]/page.tsx` says "free to use in any browser and on Android"** in both the `<meta description>` (line 51) and the body copy (lines 170–171) as literal strings, while `LAUNCH_STAGE` is `testing`. That is exactly the claim `appPlatforms()` exists to prevent, on nineteen indexed pages. One-line fix, derived from `appPlatforms()`; I can make it and you deploy.
- **The waitlist form has no newsletter consent.** `tester_signups` was collected for a test invite. Under CASL, that is implied consent for the invite, not for a weekly marketing email from the same address. The consent line is a checkbox and a column; the engine refuses to broadcast to any row without it.
- **`config.ts` says `COMPANY_LOCATION = 'Calgary, Alberta, Canada'`.** If that is deliberate, fine; if not, the legal pages carry it.
- **CFL has no ESPN scoreboard** (`hasEspnData: false`, empty events array today). The engine reads the app's scraped CFL tables. That is one more reason the engine needs a Supabase read path from day one.
- **The Champions League league phase returned no fixtures today** for 14–18 September. Either ESPN has not loaded matchweek 1 or the dates differ; the ranker must treat "no events" as "nothing to post", never as an error that makes the digest red.
