import { LEAGUES, type SiteLeague } from './leagues'
import { CLUBS, type Club } from './clubs'
import { MATCHUPS, type Matchup } from './matchups'
import { VANITY_DOMAINS } from './config'
import type { Faq } from './lib/seo'

/**
 * The sport hubs: /football and /hockey.
 *
 * ─── THESE ARE THE LANDING PAGES FOR THE VANITY DOMAINS ─────────────────────
 * scorebug.football and scorebug.hockey (see VANITY_DOMAINS in app/config.ts)
 * both land here. They are the biggest pages on the site by design: a hub has
 * to earn its own rankings, not merely receive a redirect.
 *
 * ─── WHY A SPORT LAYER EXISTS BETWEEN /leagues AND /leagues/[league] ────────
 * Two things make a hub a real page rather than a second copy of the league
 * page underneath it:
 *
 *  1. IT IS A DIRECTORY, NOT AN ARGUMENT. /leagues/epl answers one question in
 *     prose. A hub is the index: every league in the sport, the country it
 *     plays in, every club in it, every named rivalry. Different page type,
 *     different query, no restated body copy.
 *  2. IT CARRIES THE INTERNAL LINK GRAPH. Before these pages existed, a crawler
 *     could reach the club and rivalry pages only through /gear and /matchups.
 *     Now /football is one hop from thirteen league pages and several hundred
 *     named clubs. That graph is most of what makes a programmatic set rank —
 *     the same argument app/leagues/page.tsx gives for existing at all.
 *
 * ─── THE FOOTBALL HUB SERVES BOTH CODES, AND LEADS WITH IT ─────────────────
 * "Football" means the gridiron game to a reader in Calgary and association
 * football to almost everybody else, and a page that quietly assumes one of
 * them throws away most of the traffic the word brings. So /football is
 * explicitly about both, split into two families, and it says so in the H1
 * rather than burying it in an aside. That framing is also the honest one:
 * Scorebug covers three gridiron leagues and ten association ones across three
 * continents, and "we cover the NFL" undersells a product whose best untold
 * story is that it is not a North American app.
 *
 * ─── WHAT IS DERIVED, AND WHAT IS NOT ──────────────────────────────────────
 * Every LIST and every COUNT rendered by the components is derived: leagues
 * from leagues.ts, clubs from the generated clubs.ts, rivalries from
 * matchups.ts. Add a league to the registry, regenerate, and it appears on the
 * hub with its country, its clubs and its gear rail with no edit to this file.
 *
 * The PROSE below is not. A handful of figures are spelled out in words in the
 * title, description, points and FAQ answers, because "thirteen leagues" reads
 * and gets quoted better than a template hole. An earlier version of this
 * comment claimed there was "not a single hand-typed number in the copy below",
 * which was false and would have convinced the next editor to leave them alone.
 * WHEN YOU ADD A LEAGUE, grep this file for spelled-out numbers and fix them.
 */

export interface SportHub {
  /** URL slug and the route folder name. */
  slug: string
  /**
   * Which `sport` values in leagues.ts belong to this hub. A LIST, because
   * football is two sports that share a name: the hub selects both 'Football'
   * (gridiron) and 'Soccer' (association).
   */
  sports: SiteLeague['sport'][]
  /** Title-case label for headings and breadcrumbs. */
  label: string
  /** The vanity domain that lands here. Printed on the page — an address
   *  nobody ever sees written down earns nothing. */
  vanityHost?: string
  /** The H1. A claim, not a category name. */
  h1: string
  /** First paragraph. Must survive being quoted with no surrounding context,
   *  because that is exactly how an answer engine will use it. */
  lede: string
  /** `<title>`. Kept short — layout.tsx appends ' · Scorebug'. */
  title: string
  description: string
  /**
   * The families this hub splits into, in render order. Football has two;
   * hockey has none and renders one flat list. `match` runs against the hub's
   * own leagues, so a newly added league joins the right family by itself.
   */
  families?: {
    key: string
    /** Heading. Names the code, not the marketing. */
    name: string
    /** One paragraph that has to be worth reading on its own. */
    blurb: string
    match: (l: SiteLeague) => boolean
  }[]
  /** Sport-specific capability cards. */
  points: { head: string; body: string }[]
  faqs: Faq[]
}

// ─── Derived selectors ───────────────────────────────────────────────────────

export function leaguesFor(hub: SportHub): SiteLeague[] {
  return LEAGUES.filter(l => hub.sports.includes(l.sport))
}

export function leaguesInFamily(hub: SportHub, key: string): SiteLeague[] {
  const fam = hub.families?.find(f => f.key === key)
  return fam ? leaguesFor(hub).filter(fam.match) : []
}

export function clubsInLeagues(leagues: SiteLeague[]): Club[] {
  const ids = new Set(leagues.map(l => l.id))
  return CLUBS.filter(c => ids.has(c.league))
}

/**
 * Distinct clubs across a set of leagues, counted by name.
 *
 * The dedupe is accuracy, not tidiness. Arsenal is in both the Premier League
 * and the Champions League, and so are three dozen other clubs, so a plain sum
 * over the hub's leagues overstates the club count by most of the size of the
 * UCL field. A headline number wrong by that much is exactly the kind of claim
 * that gets quoted back at you.
 */
export function distinctClubCount(leagues: SiteLeague[]): number {
  return new Set(clubsInLeagues(leagues).map(c => c.name)).size
}

export function rivalriesFor(hub: SportHub): Matchup[] {
  const ids = new Set(leaguesFor(hub).map(l => l.id))
  return MATCHUPS.filter(m => ids.has(m.league))
}

/**
 * The countries a hub's leagues actually play in, deduped, in league order.
 *
 * Reads `nations`, not the `country` display string. Deduping display strings
 * counted 'United States', 'Canada' and 'United States and Canada' as three
 * countries and put "12 Countries" on the football hub where the true figure is
 * ten — a number a reader can check against the list directly underneath it.
 * A continental competition contributes nothing here; see the note on `nations`
 * in leagues.ts.
 */
export function countriesFor(hub: SportHub): string[] {
  const out: string[] = []
  for (const l of leaguesFor(hub)) {
    for (const n of l.nations) if (!out.includes(n)) out.push(n)
  }
  return out
}

const vanityFor = (slug: string) =>
  VANITY_DOMAINS.find(v => v.landing === `/${slug}`)?.host

// ─── The hubs ────────────────────────────────────────────────────────────────

const FOOTBALL: SportHub = {
  slug: 'football',
  sports: ['Football', 'Soccer'],
  label: 'Football',
  vanityHost: vanityFor('football'),

  /* The H1 is the page's thesis, not a category label, and it is the sentence
     most likely to be lifted whole into an AI overview — because it resolves
     the ambiguity in the query instead of picking a side and hoping. */
  h1: 'Football means two different sports. Scorebug keeps a record of both.',
  lede:
    'The gridiron game and association football share a name and almost nothing else, and most '
    + 'apps pick one. Scorebug follows live scores across the NFL, the CFL and NCAA college '
    + 'football, and across the Premier League, the Champions League, La Liga, Serie A, the '
    + 'Bundesliga, Ligue 1, MLS, the Chinese Super League, the Indian Super League and the '
    + 'J.League. Every match in every one of them can be graded out of 5.0, written up and kept '
    + 'permanently. No betting odds, no spreads, no sportsbook sponsorships, and free in any '
    + 'browser.',
  /* NOT "every league". That is an exhaustive claim, and "both codes" beside it
     primes it to be read as one — while Liga MX, the Eredivisie, the Primeira
     Liga and the Championship are all absent. A checkable number is a stronger
     claim than a universal quantifier anyway, and it survives being quoted. */
  title: 'Football, both codes: thirteen leagues in one logbook',
  /* 153 chars. The house budget is ~150 (see app/layout.tsx) and the previous
     222-char version pushed "no betting odds" — the actual differentiator —
     past where Google truncates. It also ended "...MLS and Asia", listing a
     continent as an item in a list of leagues, which contradicts the "not a
     token listing" claim forty lines below. */
  description:
    'Thirteen football leagues, gridiron and association: the NFL, CFL, college '
    + 'football, the Premier League, La Liga, Serie A, MLS and the J.League. No odds.',

  families: [
    {
      key: 'association',
      name: 'Association football',
      blurb:
        'Ten competitions across three continents, from the Premier League and the Champions '
        + 'League to the J.League and the Indian Super League. One logbook holds all of them, so '
        + 'a season spent on Arsenal on Saturday and Kashima Antlers on Sunday is a single record '
        + 'rather than two apps and a spreadsheet.',
      match: l => l.code === 'association',
    },
    {
      key: 'gridiron',
      name: 'The gridiron game',
      blurb:
        'The NFL, the CFL and NCAA college football. Following all three usually means three apps '
        + 'and three sets of notifications; here it is one Docket. Scorebug is built in Calgary, '
        + 'so the CFL is a first-class league in it rather than a line item.',
      match: l => l.code === 'gridiron',
    },
  ],

  points: [
    {
      head: 'One record, thirteen leagues',
      body:
        'A Champions League tie, a Grey Cup and a Saturday in the Bundesliga all land in the same '
        + 'logbook with the same grade out of 5.0. Your record is of the football you watched, not '
        + 'of whichever league an app happened to support.',
    },
    {
      head: 'Not a North American app',
      body:
        'The Chinese Super League, the Indian Super League and the J.League are here on the same '
        + 'footing as the NFL — live scores, full logging, and a place in your Starting Lineup. '
        + 'Not a token listing bolted on to pad a league count.',
    },
    {
      head: 'The game, not the line',
      body:
        'No odds, no spreads, no sportsbook logos. Football is the most heavily gambling-monetised '
        + 'sport on earth in both codes, and leaving that out is the point of the product rather '
        + 'than a setting you have to go and find.',
    },
    {
      head: 'Back to the 2002 season',
      body:
        'Finished matches are loggable back to 2002, so a final you still argue about can be added '
        + 'to your record two decades after the fact.',
    },
  ],

  faqs: [
    {
      q: 'Does Scorebug cover soccer, or only American football?',
      a: 'Both. Scorebug covers the Premier League, the UEFA Champions League, La Liga, Serie A, '
        + 'the Bundesliga, Ligue 1, Major League Soccer, the Chinese Super League, the Indian '
        + 'Super League and the J1 League, alongside the NFL, the CFL and NCAA college football.',
    },
    {
      q: 'Is there one app that tracks the NFL, the CFL and college football together?',
      a: 'Yes. Scorebug follows live scores across the NFL, the CFL and NCAA college football in a '
        + 'single app, and every game in all three is logged and graded in the same record.',
    },
    {
      q: 'Which European football leagues does Scorebug track?',
      a: 'The English Premier League, the UEFA Champions League, La Liga in Spain, Serie A in '
        + 'Italy, the Bundesliga in Germany and Ligue 1 in France, with live scores and full match '
        + 'logging in each.',
    },
    {
      q: 'Does Scorebug cover football outside Europe and North America?',
      a: 'Yes. The Chinese Super League, the Indian Super League and Japan’s J1 League are all '
        + 'covered, with live scores and the same logging and grading as every other league.',
    },
    {
      q: 'Can I log and rate matches I watched years ago?',
      a: 'Yes. Finished matches can be logged as far back as the 2002 season. You grade the match '
        + 'out of 5.0, write what it meant, record whether you watched at home or were in the '
        + 'ground, and it stays in your vault permanently.',
    },
    {
      q: 'Is Scorebug free for football fans?',
      a: 'Yes. Live scores and match logging are free in any browser. An optional Front Office '
        + 'membership adds a bigger Starting Lineup and the Analytics Desk — your season ledger, '
        + 'rivalry splits and attendance history — but no league coverage sits behind it.',
    },
  ],
}

const HOCKEY: SportHub = {
  slug: 'hockey',
  sports: ['Hockey'],
  label: 'Hockey',
  vanityHost: vanityFor('hockey'),

  h1: 'Every hockey game you watch, graded and kept for good',
  lede:
    'Scorebug is a logbook for hockey fans: live NHL scores across all 32 clubs, and then the part '
    + 'a scoreboard never does — you grade the game out of 5.0, write what it meant, record how you '
    + 'watched it, and keep all of it permanently. No betting odds, no spreads and no sportsbook '
    + 'sponsorships, and free in any browser.',
  title: 'Hockey — live NHL scores and a permanent logbook',
  description:
    'Live NHL scores with no betting odds, and a permanent record of every hockey game you watch, '
    + 'graded out of 5.0. All 32 clubs, the rivalries, and games back to the 2002 season.',

  points: [
    {
      head: 'All 32 clubs, every night',
      body:
        'Live scoring across the whole league, and a Docket you fill with the games you actually '
        + 'intend to watch rather than a wall of everything happening at once.',
    },
    {
      head: 'The game, not the line',
      body:
        'No odds, no spreads, no sportsbook logos. Hockey broadcasting is unusually saturated with '
        + 'them, and leaving them out is the point of the product rather than a setting.',
    },
    {
      head: 'Back to the 2002 season',
      body:
        'A game you watched years ago can still be added. Finished games are loggable back to '
        + '2002, so your record can start well before the day you signed up.',
    },
    {
      head: 'Home or in the building',
      body:
        'Every entry records where you watched, which is what turns a pile of ratings into an '
        + 'attendance history worth keeping.',
    },
  ],

  faqs: [
    {
      q: 'Is there a hockey app without betting odds in it?',
      a: 'Scorebug shows live NHL scores with no betting odds, no spreads and no sportsbook '
        + 'sponsorships anywhere in the product. It is free to use in any browser.',
    },
    {
      q: 'Can I keep a record of every hockey game I watch?',
      a: 'Yes. Scorebug is a logbook first: after a game ends you grade it out of 5.0, write what '
        + 'it meant, and record how you took it in — at the game, at home, at a bar, or catching '
        + 'up later. The entry stays in your vault permanently.',
    },
    {
      q: 'How far back can I log NHL games in Scorebug?',
      a: 'Finished NHL games can be logged as far back as the 2002 season, so a game you watched '
        + 'years ago can still be added to your record.',
    },
    {
      q: 'Which hockey clubs does Scorebug cover?',
      a: 'All 32 NHL clubs, each with live scores, and each able to sit in your Starting Lineup so '
        + 'their games surface first.',
    },
  ],
}

/* Football first: it is the larger hub, and /leagues renders its sport groups
   in registry order where football already precedes hockey's siblings. */
export const SPORT_HUBS: SportHub[] = [FOOTBALL, HOCKEY]

export function getSportHub(slug: string): SportHub | undefined {
  return SPORT_HUBS.find(h => h.slug === slug)
}

/**
 * The route files' lookup. Throws rather than returning undefined, so a route
 * folder whose slug is not in SPORT_HUBS fails the BUILD on this machine
 * instead of shipping a page that renders empty.
 *
 * It is a separate function because the obvious alternative — a module-scope
 * `if (!HUB) throw` in the route — does not narrow the type inside the
 * component that closes over it, and the `!` that silences that is exactly the
 * assertion this replaces with a real check.
 */
export function requireSportHub(slug: string): SportHub {
  const hub = getSportHub(slug)
  if (!hub) throw new Error(`app/sports.ts has no hub for '${slug}' — the route and SPORT_HUBS disagree`)
  return hub
}

/** The hub a league belongs to, for the sibling link on /leagues/[league]. */
export function hubForSport(sport: SiteLeague['sport']): SportHub | undefined {
  return SPORT_HUBS.find(h => h.sports.includes(sport))
}
