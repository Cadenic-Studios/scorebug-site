# Affiliate partners — what is live, and what to sign next

Written 2026-09-07 when `/football` and `/hockey` became real hubs; revised
2026-09-08 after the Fanatics International contract was found to already cover
European football, which the code was wrongly excluding.

The football hub covers ten association-football competitions across England,
Spain, Italy, Germany, France, the United States, Canada, China, India and
Japan. Six of the ten now reach a storefront that genuinely stocks them; the
three Asian leagues and the CFL are on eBay because nothing else carries them.

---

## 1. What is wired today

All IDs are copied verbatim from the app's `lib/ads/`. Every rendered link
carries `rel="sponsored noopener noreferrer"` and sits under a visible
**SPONSORED** badge — see `app/components/Sponsored.tsx`, which takes no props
on purpose.

| Partner | Network | Campaign | Covers | Used on |
|---|---|---|---|---|
| **Fanatics (US)** | Impact | `586570/9663` | NHL, NFL, NBA, MLB, NCAAF, NCAAB, MLS | `/gear/[team]`, both hubs, all league pages |
| **Fanatics International** | Impact | `895352/9663` | EPL, La Liga, Serie A, Bundesliga, Ligue 1, UCL | `/football`, the six European league pages |
| **eBay** | eBay Partner Network | — | anything: CFL, CSL, ISL, J.League, F1, IPL | `/gear/[team]`, both hubs, all league pages |
| **TicketNetwork** | CJ | `11080825` | North American events | `/gear/[team]` |
| **SoccerGarage** | CJ | `10596243` | boots, keeper gloves, training kit, balls | `/football` |
| **Beckett** | CJ | — | cards and grading | app only |

### The correction that unlocked the European leagues

This file previously said Fanatics "does not carry European or Asian football".
**That was true of `fanatics.com` and false of the international storefront**,
and it cost the ten association-football leagues on `/football` a real club
store each. Measured 2026-09-08 in a browser against the destination host —
never the Impact tracking link, which would register a click — reading rendered
product **titles**:

| Query | Reported | Real titles | Verdict |
|---|---|---|---|
| Arsenal | 299 items | "Arsenal adidas Away Shirt 2026-27" | **stocked** |
| Real Madrid | 183 items | "Real Madrid adidas Away Shirt 2026-27" | **stocked** |
| Juventus | 125 items | "Juventus adidas Third Shirt 2026-27" | **stocked** |
| Borussia Dortmund | 93 items | "Borussia Dortmund PUMA Home Shirt" | **stocked** |
| Paris Saint-Germain | 1081 items | "PSG Nike Home Stadium Shirt 2026-27" | **stocked** |
| Olympique Marseille | 72 items | 70 title hits | **stocked** |
| Champions League | 393 items | 9 title hits, mostly retro | thin, but every club is stocked |
| Kashima Antlers | 2 items | one 1993-94 retro shirt | **not stocked** |
| Saskatchewan Roughriders | 100 items | **zero** — Yankees memorabilia | **not stocked** |

### ⚠️ Item counts are not evidence. Test titles.

That last row is the important one. **`fanatics.co.uk` never returns an empty
page.** For a club it does not stock it returns ~100 fuzzily-matched products
from unrelated sports — the Roughriders search returns New York Yankees
game-used memorabilia. "Bengaluru FC" returns 98 items of nothing relevant.

So a non-zero count proves nothing, and this file's earlier claim that Fanatics
returns "an empty results page" for a CFL club was wrong in the *other*
direction: it returns a full, plausible-looking page of junk, which is worse.

**Anyone re-checking `FANATICS_INTL_LEAGUES` must read rendered product titles,
not counts, and must do it in a real browser — the site 403s scripted requests
and its search results are client-rendered, so `fetch` returns an empty shell.**

### Open items on the wiring

- **Confirm campaign `895352` covers `fanatics.co.uk` deep links.** The link was
  supplied as "Fanatics EU home page" and the contract lists IT/ES/FR/DE plus
  Online Sale EU/UK/ROW as separate payout lines. The Impact `?u=` deep-link
  form is documented and used identically on the US campaign, but it could not
  be tested without registering a click. **Check the first EU click in the
  Impact dashboard.** If `u=` is ignored the visitor still lands on the EU shop
  — worse targeting, not a broken link. If a UK-specific tracking link exists,
  swapping `FANATICS_INTL_BASE` is a one-line change.
- **Three SoccerGarage creatives are live, and each belongs to a placement
  family.** All confirmed valid by the owner. They are not a conflict to
  resolve — they are per-placement reporting, and mixing them up is the bug:
  | Creative | Pixel host | Rendered by |
  |---|---|---|
  | `10479704` | `ftjcfx.com` | the app's RepYourSide **and** this site's gear rail — a text button with an impression pixel |
  | `10596243` | `tqlkg.com` | nothing. A 120×60 **banner** creative. Reserved for a real banner placement if one is ever built |
  | `11017822` | — | the app's ad-engine soccer slots and Lineup merch rail, via `soccerGarageUrl` |
  A click id must always be paired with ITS OWN pixel host. This site briefly
  shipped `10596243`'s click id under a text button that never displays the
  banner, crediting an impression for an ad nobody saw; it is back on
  `10479704` and matches the app.
- **SoccerGarage cannot be deep-linked, and the app was 404ing on it.**
  `soccerGarageUrl` in the app deep-linked
  `soccergarage.com/catalogsearch/result/?q=<club>`, which resolves — measured
  2026-09-08 — to `www.soccergarage.com/404.html`. Every soccer click from
  three ad-engine slots and the Lineup merch rail dead-ended, invisibly: the CJ
  click resolved, the chain returned 200, and the failure was two hops down.
  Fixed to the shop root. **Any copy above a SoccerGarage link must ask for a
  CATEGORY — boots, keeper gloves, training kit — and never name a club.** The
  ad engine's `club-kit` angle used to read "Kit Up in Your Arsenal Colours"
  over that link; it is now "Training Kit & Team Wear".
- **Kitbag: applied, awaiting approval.** Note that Fanatics International
  already covers the same catalogue through campaign `895352`, so approval is
  now an improvement (per-club official stores) rather than the unlock it was.

## 2. Sign these next, in this order

Each needs an account and a tracking ID before it can be wired. Nothing below is
in the code yet, and no placeholder IDs have been invented — a wrong tracking ID
produces a link that works perfectly for the visitor and pays nobody.

### 2.1 Kitbag / Fanatics International — applied, awaiting approval

**Status: applied 2026-09-08.** No longer the blocking unlock it was, because
campaign `895352` already reaches the international catalogue and the six
European leagues now route there.

What approval would still add: **per-club official stores**. Fanatics
International operates the official shops for Manchester United, Real Madrid,
PSG, Atlético Madrid, Everton, Celtic, Aston Villa, Manchester City and
Borussia Dortmund. Today those clubs resolve through a league-level search on
`fanatics.co.uk`; approval would let them resolve to the club's own store, and
would make it defensible to give European clubs their own `/gear/[team]` pages.

**Do not expand `GEAR_TEAMS` before then.** The 154 existing club pages are
already at the edge of the added-value test — their body is four affiliate
buttons — and adding 96 more of the same shape amplifies a known weakness for
no new content. The trigger is a real per-club fact worth a page, not a working
merchant link.

### 2.2 P1 Travel — European football tickets

Official tickets and travel packages with direct partnerships at major European
clubs, run through **Partnerize**, paying per booking.

Tickets are the highest-value click on any of these pages and we currently have
**no ticket partner outside North America** — TicketNetwork does not serve this
audience. This is the second-biggest hole in the football hub.

Prefer this over the secondary-market brokers below: official-allocation
inventory is the safer association for a brand whose whole pitch is *not* being
the sleazy corner of sports media.

### 2.3 StubHub International — ticket fallback

Reported at roughly **3–4% commission with a 30-day cookie**, available through
FlexOffers. Broad international inventory, useful where P1 has no partnership.

Secondary-market ticketing carries real reputational baggage (pricing, fees).
If we take it, it should sit *behind* P1 rather than beside it.

### 2.4 Fubo — streaming, and it is on a network we already use

Fubo runs its affiliate programme on **Impact Radius**, the same network as our
existing Fanatics account, so this is close to zero setup friction. Fubo Sports
carries exclusive UEFA matches, and Fubo now distributes DAZN1 under a
multi-year partnership announced this year.

"Where can I watch this match" is a question every fixture page implicitly
raises and none of ours currently answers. A streaming partner is a genuinely
useful answer rather than an ad, which makes it the best fit of anything here
for the editorial tone.

### 2.5 DAZN Global — streaming, international

Runs its own programme at `affiliate.dazn.com` and is also listed on FlexOffers.
Explicitly recruiting sports-content partners. Strongest in exactly the markets
where we are weakest — Italy, Germany, Japan.

---

## 3. Rules that apply to anything added here

Non-negotiable, and all of them already cost something once:

1. **Never fetch a CJ click URL to test it.** It registers a real click against
   publisher `101840629` and reads as fraud. Fetch the *destination* host.
2. **The merchant a surface displays must come from the same call that produced
   the URL.** A `merchantForLeague()` helper used to answer separately, and every
   European gear row rendered a visible "SoccerGarage" over a link to eBay. That
   is a false disclosure, not a cosmetic bug. `leagueGearLink()` now returns
   `{ url, merchant }` together, and the standalone helper was deleted.
3. **A merchant that returns an empty result set gets `null`, not a link.**
4. **Every link needs `rel="sponsored"` and a visible SPONSORED badge.** The
   badge is for the reader; the `rel` is for the crawler. Both are required.
5. **No first-party `/go/cj` hop exists on this origin.** The app has one; this
   site does not, and adding an open redirect to the marketing domain is a
   phishing primitive. CJ links here go direct and some will be ad-blocked. A
   lost commission beats a security incident.
6. **Keep commerce league-level on the hubs.** Several hundred affiliate links
   on one page is the structural signature of a thin affiliate page whatever the
   content around it says. Per-club commerce lives at `/gear/[team]`, one club
   per page.

---

## 4. Coverage note: Liga MX is not covered

Mexican football has come up as an assumed part of the international story. It
is **not** in the product: there is no Liga MX entry in `lib/leagueRegistry.ts`,
no ESPN slug wired for it and no clubs in the registry.

Nothing on the site claims it, and nothing should until it ships. Advertising a
league the app cannot log is the most damaging kind of marketing copy, because
the visitor finds out about ninety seconds after installing.

If it is wanted, the order is: registry → `app/leagues.ts` → regenerate
`app/clubs.ts` — and it lands on `/football` automatically, because every list
and count on that page is derived.

---

## Sources

- [Fanatics International EU affiliate programme](https://getlasso.co/affiliate/fanatics-international-eu/)
- [Fanatics acquires Kitbag](https://www.fanaticsinc.com/press-releases/2016/02/fanatics-acquires-leading-international-sports-ecommerce-company)
- [Kitbag — about](https://www.kitbag.com/en/about-us/ch-1377)
- [P1 Travel affiliate programme](https://www.p1travel.com/en/partnerships/affiliate-programme)
- [StubHub International on FlexOffers](https://www.flexoffers.com/affiliate-programs/stubhub-international-affiliate-program/)
- [StubHub affiliate terms overview](https://ecomobi.com/stubhub-affiliate-program/)
- [TicketGum affiliate programme](https://www.ticketgum.com/affiliate-program)
- [Fubo affiliate programme](https://www.fubo.tv/stream/affiliate/)
- [DAZN affiliate programme](https://affiliate.dazn.com/)
- [DAZN Global on FlexOffers](https://www.flexoffers.com/affiliate-programs/dazn-global-affiliate-program/)
- [Fubo × DAZN partnership](https://dazngroup.com/press-room/fubo-dazn-strike-multi-year-integrated-partnership/)

Commission figures above are as reported by those sources and are **not**
verified against a signed agreement. Treat them as a ranking hint, not a
forecast.
