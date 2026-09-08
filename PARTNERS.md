# Affiliate partners — what is live, and what to sign next

Written 2026-09-07, when `/football` and `/hockey` went from redirect targets to
real hubs. The football hub covers ten association-football competitions across
England, Spain, Italy, Germany, France, the United States, Canada, China, India
and Japan — and our merchant coverage does **not** currently reach most of them.
This file records what is wired, what the gap is, and which programmes close it.

---

## 1. What is wired today

All four are already live in `app/lib/affiliates.ts`, with IDs copied verbatim
from the app's `lib/ads/`. Every rendered link carries `rel="sponsored noopener
noreferrer"` and sits under a visible **SPONSORED** badge — see
`app/components/Sponsored.tsx`, which takes no props on purpose.

| Partner | Network | Covers | Used on |
|---|---|---|---|
| **Fanatics** | Impact | NHL, NFL, NBA, MLB, NCAAF, NCAAB, MLS | `/gear/[team]`, both hubs |
| **eBay** | eBay Partner Network | anything — any club, any league, any country | `/gear/[team]`, both hubs |
| **TicketNetwork** | CJ | North American events | `/gear/[team]` |
| **SoccerGarage** | CJ | world-football boots, keeper gear, training kit | `/football` |
| **Beckett** | CJ | cards and grading | app only |

### The gap, stated precisely

**Fanatics does not carry European or Asian football**, and returns an empty
results page for those clubs. `fanaticsCarriesLeague()` therefore excludes them,
which is correct — sending a fan to an empty store is worse than showing them
nothing.

**SoccerGarage cannot be deep-linked.** Probed against the destination host on
2026-09-07 (never the CJ click URL — fetching that registers a real click and
reads as fraud):

```
/catalogsearch/result/?q=arsenal            → 302 → /404.html
/search.php?keywords= | ?q= | ?search= | ?keyword=
                                            → 200, all four byte-identical
                                              (167,429 bytes) — the parameter is
                                              ignored; the search form is POST
```

So there is no per-club or per-league SoccerGarage URL to build. It is rendered
as one honest shop link labelled "SoccerGarage", never as a club button.

**The consequence:** every European and Asian football league on `/football`
currently monetises through an **eBay search only**. That works — eBay resolves
for any club on earth — but it is the lowest-converting option on the page, and
it is fronting the leagues with the largest audiences we cover.

---

## 2. Sign these next, in this order

Each needs an account and a tracking ID before it can be wired. Nothing below is
in the code yet, and no placeholder IDs have been invented — a wrong tracking ID
produces a link that works perfectly for the visitor and pays nobody.

### 2.1 Fanatics International EU (Kitbag) — **the one that matters**

The single highest-value gap-closer, and the lowest-friction one because we
already have a Fanatics relationship on Impact.

Fanatics acquired Kitbag (Manchester) in February 2016 and it now trades as
Fanatics International. It operates the **official online stores** for
Manchester United, Real Madrid, Paris Saint-Germain, Atlético Madrid, Everton,
Celtic, Aston Villa, Manchester City and Borussia Dortmund, with club
relationships across the Premier League, La Liga, the Bundesliga and Ligue 1.

That is exactly the per-club deep-linking that SoccerGarage cannot give us. It
would upgrade six of the ten association leagues on `/football` from a generic
eBay search to a real club store, and it would let `GEAR_TEAMS` — and therefore
`/gear/[team]` pages — expand into European football for the first time.

- **Note:** it is a *separate* programme from the US Fanatics account, so it
  needs its own application even though the parent company is the same.
- **When approved:** add an `INTL_FANATICS_LEAGUES` set beside
  `FANATICS_LEAGUES` in `app/lib/affiliates.ts` and give `leagueGearLink` a
  third branch. The structure already supports it.

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
