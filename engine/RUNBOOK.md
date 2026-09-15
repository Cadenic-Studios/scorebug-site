# SCOREBUG // RUNBOOK — what you do, in order

Everything the machine cannot do for itself, in the order that never leaves
you waiting on it or it waiting on you. Budget: CA$1,000, and where it goes is
in §8. Reading time: ten minutes. Doing time: one evening for §1–§5, then a
few minutes a day. Updated 9 September for the accounts you created (X
`@scorebug_app`, Bluesky, Mastodon `@scorebug`, TikTok `@scorebugapp`).

Where things are: the engine is in `scorebug-site/engine/`; the site pieces
are in `scorebug-site/app/`; the database migration is
`scorebug-app/database-v54.sql`; the brand kit is `scorebug-site/marketing/kit/`.

---

## 0. Tonight, before anything else (15 minutes)

1. **Run the migration.** Supabase → SQL editor → paste `scorebug-app/database-v54.sql` → Run.
   Then store the engine key (make one first — see §4):
   ```sql
   insert into private.app_secrets (key, value) values ('engine_key', '<your 64 hex>')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
   Check: `select * from public.engine_counts();` returns one row of counts.
2. **Deploy the site.** `cd scorebug-site && npx vercel --prod`. This ships the
   league-page fix (no more "on Android" while the test is closed), the consent
   box on the waitlist, `/get`, `/r`, the card press, `/slate`, `/ops`, the facts
   endpoint. Nothing posts yet; nothing needs an env var to render — `/ops` just
   says "not configured" until §5.
3. **Look at one card:** `https://getscorebug.app/api/card?k=final&l=NHL&a=CGY&an=Flames&as=3&h=EDM&hn=Oilers&hs=4&d=Final%2FOT&size=wide`.
   If it renders — the app icon top-left, Anton headline, the glass tile, two
   shields — the fonts, the brand assets and the edge bundle are fine.
4. **Check the Bluesky proof:** `https://getscorebug.app/.well-known/atproto-did`
   must print `did:plc:j6ypvmvjbaya4mbwxrrrci24` as plain text and nothing else.
   THEN go and tap "Verify Text File" in Bluesky (§2). It failed the first time
   for two reasons, both now fixed: the file did not exist on the deployed site,
   and a catch-all header rule was stamping `application/json` onto everything
   under `/.well-known/`, which atproto's spec rejects — it requires
   `text/plain`.

## 1. The Firebase project (10 minutes)

1. console.firebase.google.com → **Add project** → name `scorebug-engine`
   (if the id is taken, take what it gives you and put that id in
   `engine/.firebaserc`). No Analytics needed.
2. Upgrade to **Blaze** (pay as you go). This engine costs cents.
3. Build → **Firestore Database** → Create → production mode → `us-central1`.
4. Project settings → General → copy the **Web API key** → it goes in
   `.secrets.local` as `ENGINE_WEB_API_KEY` (§4). It authorises nothing; the
   site needs it to read the weekly slate.
5. Project settings → Service accounts → **Generate new private key** →
   save the JSON into `scorebug-site/engine/functions/` (any name; ignite finds
   it by its contents; it is gitignored).
6. Google Cloud console for the same project → APIs & Services → enable
   **Google Analytics Data API**.
7. GA4 → Admin → property **551128063** (Scorebug) → Property access
   management → add the service account's email as **Viewer**.

## 2. The accounts (the ones you made, finished; 30 minutes)

You created these on 9 September: **X `@scorebug_app`**, **Bluesky
`@scorebug-app.bsky.social`** (DID `did:plc:j6ypvmvjbaya4mbwxrrrci24`),
**Mastodon `@scorebug@mastodon.social`**, **TikTok `@scorebugapp`**. The
engine, the site's `sameAs` and the kit now all say exactly those. Use
`hello@getscorebug.app` for anything still to make, and the kit in
`marketing/kit/` (avatar = the real app icon; banners = the real wordmark over
the app's rink; bios and the pinned post in `BIOS.md`).

**Bluesky** — finish the domain handle, then the engine login
- You chose "No DNS panel". That needs the site to answer
  `https://getscorebug.app/.well-known/atproto-did` with the DID, as
  **text/plain**. It does now — the file is `public/.well-known/atproto-did`,
  beside the two store files that have worked on this domain since August, and
  next.config.js names the content type per file instead of stamping JSON on
  everything under that path (which is what would have broken it even after a
  successful deploy).
- So: **deploy first** (§0 step 2), open the URL yourself and check it prints
  the DID, and only then tap Settings → Change handle → No DNS panel →
  **Verify Text File**. The handle becomes `@getscorebug.app`.
- Settings → Privacy and security → **App passwords** → add one named
  `engine` → copy it (`BSKY_APP_PASSWORD`). The DID is already in
  `.secrets.local.example` as `BSKY_HANDLE`.
- Upload `avatar-400.png` and `bluesky-banner-3000x1000.png`; paste the bio.
- **Verify the email.** An unverified Bluesky account cannot post (this bit
  Delta-V for a week).

**X** — the avatar is up; the rest
- Upload `x-header-1500x500.png`, paste the bio, set the website to
  `https://getscorebug.app`. Display name is yours to decide (see `BIOS.md`).
- developer.x.com → sign up for **pay-per-use** → set the **spending limit to
  US$15** in Billing before anything else → create a project and app →
  Keys and tokens → API key + secret (`X_API_KEY`, `X_API_SECRET`) → generate
  Access token + secret with **Read and Write** (`X_ACCESS_TOKEN`,
  `X_ACCESS_SECRET`). Your card is on X's account; the engine never sees it.
  `X_HANDLE=scorebug_app` is already the default.

**Mastodon** — no avatar yet
- Upload `avatar-400.png` and `mastodon-header-1500x500.png`; paste the bio.
- Edit profile → **Extra fields** → label `Website`, content
  `https://getscorebug.app`. The site's footer now links back to
  `mastodon.social/@scorebug` with `rel="me"`, so after the deploy Mastodon
  marks the field **verified** (green tick) on its own. That is the one free
  trust signal on the fediverse; it costs one deploy.
- Preferences → Development → New application → name `engine`, scopes
  `read write` → copy the access token (`MASTODON_TOKEN`).
  `MASTODON_BASE=https://mastodon.social`.

**TikTok** — `@scorebugapp`, by hand
- Avatar `avatar-400.png`, the 80-character bio, website
  `https://getscorebug.app` (a brand-new account can take a day or two to show
  the website field; a free Business account always has it).
- There is **no TikTok pipeline in the engine**, and there should not be one
  yet: TikTok is video, the engine makes stills, and TikTok's posting API
  requires an app audit for a still-image account nobody follows. The plan:
  every card the engine makes also exists in a 1080×1920 **story** shape
  (`/api/card?…&size=story`) — the digest will show you the link under each
  post — and the honest first month on TikTok is you, once a day, screen-recording
  the app logging last night's best game (15 seconds, no talking needed), with
  the card as the cover. Post at 20:30 Mountain. The moment one of those
  clears a thousand views, we know TikTok is worth a real pipeline
  (card-to-motion: the card assembled over four seconds, a beacon flash, the
  grade filling in) and I will build it. Not before.

**Discord**
- Create a server "Scorebug" → a channel `#the-slate` → channel settings →
  Integrations → Webhooks → New → copy the URL (`DISCORD_WEBHOOK_URL`).

**Threads + Instagram** (month two; one Meta app serves both)
- Create the Instagram account — try `scorebug_app` (matches X), then
  `scorebugapp` (matches TikTok) → switch it to a **Professional** account
  (Creator). Threads is the same login.
- developers.facebook.com → Create app → type "Business" → add the products
  **Threads API** and **Instagram API with Instagram Login**.
- Threads API → User token generator → add your Threads account as a tester
  (Threads app → Settings → Website permissions → accept) → generate a token
  → exchange it for a long-lived token (the "Get long-lived token" button) →
  `THREADS_TOKEN`; the numeric id it shows is `THREADS_USER_ID`. The engine
  refreshes it before the 60-day expiry (threadsToken.js).
- Instagram: same generator on the Instagram product → `IG_TOKEN`, `IG_USER_ID`.
  Leave both blank until then; the digest will say they are off.

**Resend**
- Domains → add `getscorebug.app` → add the DNS records it shows → verified.
- API keys → create one with **full access** (the Delta-V key is send-only and
  cannot batch) → `RESEND_API_KEY`.

**Anthropic**
- console.anthropic.com → API key → `ANTHROPIC_API_KEY`. Reply drafts only;
  under US$2/month.

## 3. Two keys you make yourself (2 minutes)

In any terminal, four times:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
→ `OPS_SECRET`, `DISPATCH_KEY`, `ENGINE_KEY` (the one you stored in Supabase in
§0), and a 32-character one (`…toString('hex').slice(0,32)`) → `INDEXNOW_KEY`.
Pick any `OPS_CONSOLE_PASSWORD`.

## 4. The secrets file (5 minutes)

`cd scorebug-site/engine/functions && copy .secrets.local.example .secrets.local`
and fill it in. Leave blank what you do not have; the engine reports what is
off. `SUPABASE_URL=https://hobwgictugtqoypbewez.supabase.co` and
`SUPABASE_ANON_KEY` is the same publishable key the site already uses
(`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`).

## 5. Ignition (15 minutes, mostly waiting)

```
cd scorebug-site/engine/functions && npm install && npm test     # 79 passing
cd .. && npm i -g firebase-tools vercel                            # if you have not
firebase login
cd ../ && npx vercel link                                          # once, from scorebug-site
cd engine && node scripts/ignite.mjs
```

It pushes every secret to Secret Manager, writes `functions/.env`, runs the
tests, deploys the functions, writes the Vercel variables, creates
`dispatch/settings` as **enabled, dry run, autopilot off**, and verifies the
facts endpoint, the card press and the ops endpoint. Then:

```
cd .. && npx vercel --prod
```

Open `getscorebug.app/ops`, sign in with your console password, and you should
see "DRY RUN · posting to bluesky, mastodon …" and the numbers from Supabase.

## 6. The ladder (a week)

- **Days 1–5, dry run.** Every morning at 07:00 the digest lands. Read the
  drafts and the cards. If a scoreline is wrong, a clause reads badly, or a
  card is ugly, tell me — the templates are three functions in `draft.js`.
- **Day 6:** open `getscorebug.app/ops` and tap **End dry run**. Every post now
  waits for your tap. Approve a few.
- **Day 8:** on `/ops`, tap **Turn on autopilot**. Slates, finals, mornings,
  anniversaries and product lines go out by themselves. Anything about a person
  still waits.

  Both of these are console actions, not email buttons, and that is deliberate.
  Mail scanners follow every link in an email — Outlook Safe Links, Gmail's
  proxy, corporate filters — so a digest link that could end dry run or switch
  on autopilot could be fired by a machine nobody asked. The digest can still
  **stop** everything in one tap, because stopping is the safe direction.
  Approving a single post from the email now shows a one-button confirmation
  page first, for the same reason.
- **Week 2:** on `/ops`, set `engage.enabled` (the console has the switch) so
  mentions get drafted replies in the digest. A week later, `autoReply`.
- **When the slate list has 25+ addresses:** `channels.newsletter: true`, then
  approve the first letter on `/ops`. It sends Monday 09:00.

## 6b. What the morning email now tells you that it did not before

- **Where the signups came from.** Every link the engine posts has always been
  tagged; nothing ever read the tags back, so the machine could report likes
  and could not report a single person arriving. It now reads
  `tester_signups.source` and prints, per network and per beat, how many people
  reached the waitlist in the last thirty days — and the letter after the beat
  (`final-q`, `final-s`) is which closing line brought them. That is the number
  to steer by. Likes are a proxy for a proxy.
- **"Do this today."** When five or more people are on the Android waitlist and
  have not been invited, the digest says so, with the exact Play Console path.
  A signup nobody invites is a person who asked to use Scorebug and never got
  to, and that is the cheapest user you will ever fail to acquire.
- **"Needs a fix, not a decision."** Drafts the linter REFUSED (betting
  language) and sends that were interrupted mid-flight. Neither has an Approve
  button, on purpose: a betting draft is a bug in a template, and an
  interrupted send may already be public.

## 7. Then, by hand, once

- Post the pinned message in `BIOS.md` on each account in your own words, and pin it.
- The four live profiles are already in `SOCIAL_LINKS` in
  `scorebug-site/app/config.ts` — the site's `sameAs` and the footer's
  "Follow" row read from it. When Threads and Instagram exist, add them there
  and redeploy.
- Set `LAUNCH_STAGE` to `'live'` the day the Play listing is public. Every
  `/get` link ever posted starts landing on Play that minute; the product lines
  start saying "on Google Play"; the review responder can be switched on.

## 8. The CA$1,000 (budget.js, and the gates are in code)

| Line | Cap | Earliest | Gate |
|---|---|---|---|
| **NHL opening week on Meta** | CA$350 | 5 Oct | Seven days of organic posts, GA4 recording a web signup as a key event, the card press live. Then CA$50–100/day for four days, Canada, 21–44, hockey interest, to app.getscorebug.app, creative = a card. Stop when cost per new fan passes CA$4. |
| **Creator seeding** | CA$300 | 22 Sep | Three sports creators/podcasters in Canada, 5k–50k followers, a flat CA$75–100 to log a week of games in public and post their own card once, disclosed. Never pay for an opinion; pay for the week of logs. |
| **X API credits** | CA$50 | now | The meter keeps it under US$10/month. |
| **Reserve** | CA$300 | 19 Oct | Two weeks of measured cost per new fan, then the better of the two lines above, timed to NBA tip-off or the World Series — or held for an App Store push if iOS lands. |

Not from this envelope: Apple Developer (US$99, engineering), Anthropic,
Resend, affiliate fees. Never: an install ad while the test is closed, a
gambling-adjacent placement or creator, a broad campaign below the platform's
noise floor.

Log every spend on `/ops` → Money, and the digest does the arithmetic.

## 9. What to send me when you are back

Nothing secret — never paste a key into a chat. Tell me: the Firebase project
id if it is not `scorebug-engine`; which handles you got; what the first
digest said; and any draft that read wrong. I will tune the templates, the
weights and the floors from the dry-run ledger before you end dry run.
