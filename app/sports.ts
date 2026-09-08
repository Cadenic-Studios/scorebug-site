import { LEAGUES, type SiteLeague } from './leagues'
import { GEAR_TEAMS, type GearTeam } from './lib/teams'
import { MATCHUPS, type Matchup } from './matchups'
import { VANITY_DOMAINS } from './config'
import type { Faq } from './lib/seo'

/**
 * The sport hubs: /hockey and /football.
 *
 * ─── WHY A SPORT LAYER EXISTS BETWEEN /leagues AND /leagues/[league] ─────────
 * These are the pages the vanity domains land on (see VANITY_DOMAINS in
 * app/config.ts), and they had to justify themselves as pages before they were
 * worth pointing a domain at. Two things make them real rather than a second
 * copy of the league page:
 *
 *  1. THEY ARE DIRECTORIES, NOT ARGUMENTS. /leagues/nhl answers one question —
 *     where to follow the NHL without gambling ads — in prose. A sport hub is
 *     the index: every league in the sport, every named rivalry, every club.
 *     Different page type, different query, and it does not restate the league
 *     page's body copy.
 *  2. THEY CARRY THE INTERNAL LINK GRAPH. The 32 club pages and the rivalry
 *     pages currently hang off /gear and /matchups and nothing else. A crawler
 *     reaching /hockey now finds 12 rivalries and 32 clubs one hop away. That
 *     link graph is most of what makes a programmatic set rank at all — the
 *     same reasoning app/leagues/page.tsx gives for existing.
 *
 * ─── WHY ONLY TWO ───────────────────────────────────────────────────────────
 * Because only two domains were bought, and because the sports that would earn
 * a hub are the ones with something to index. Football has three leagues, 32
 * clubs and a dozen named rivalries; hockey has one league but 32 clubs and as
 * many rivalries, including the two oldest in the sport. Basketball, baseball and
 * soccer would each be a defensible hub later; racing and cricket would be one
 * league and no clubs, which is a thin page wearing a hub's clothes. Adding a
 * sport here is a deliberate act, the same way adding a league or a rivalry is.
 *
 * ─── EVERY LIST IS DERIVED ──────────────────────────────────────────────────
 * Leagues, clubs and rivalries are all filtered out of the existing tables, so
 * a league added to leagues.ts or a rivalry added to matchups.ts appears here
 * with no edit. Nothing about a sport is typed twice.
 */

export interface SportHub {
  /** URL slug and the route folder name. */
  slug: string
  /** The `sport` value in leagues.ts that selects this hub's leagues. */
  sport: SiteLeague['sport']
  /** Title-case label for headings and breadcrumbs. */
  label: string
  /** The vanity domain that lands here, if one is pointed at it. Rendered as
   *  a plain fact in the footer of the page — it is a real address the reader
   *  can use, and printing it is how a memorable domain gets remembered. */
  vanityHost?: string
  /** The H1. Written as the thing somebody types, answered. */
  h1: string
  /** First paragraph. Must survive being quoted with no surrounding context —
   *  that is exactly how an answer engine will use it. */
  lede: string
  /** `<title>` and the meta description. */
  title: string
  description: string
  /** Three or four sport-specific capability lines. */
  points: { head: string; body: string }[]
  /** A short honest aside, used by football to disambiguate the word. */
  aside?: { head: string; body: string; href: string; cta: string }
  faqs: Faq[]
}

/** Which `GearLeague` ids belong to each hub, so club lists can be derived. */
export function leaguesFor(hub: SportHub): SiteLeague[] {
  return LEAGUES.filter(l => l.sport === hub.sport)
}

export function clubsFor(hub: SportHub): GearTeam[] {
  const ids = new Set(leaguesFor(hub).map(l => l.id))
  return GEAR_TEAMS.filter(t => ids.has(t.league))
}

export function rivalriesFor(hub: SportHub): Matchup[] {
  const ids = new Set(leaguesFor(hub).map(l => l.id))
  return MATCHUPS.filter(m => ids.has(m.league))
}

const vanityFor = (slug: string) =>
  VANITY_DOMAINS.find(v => v.landing === `/${slug}`)?.host

export const SPORT_HUBS: SportHub[] = [
  {
    slug: 'hockey',
    sport: 'Hockey',
    label: 'Hockey',
    vanityHost: vanityFor('hockey'),
    h1: 'Keep a record of every hockey game you watch',
    lede:
      'Scorebug is a logbook for hockey fans: follow live NHL scores, then grade the game out of '
      + '5.0, write what it meant and keep it permanently. There are no betting odds, no spreads '
      + 'and no sportsbook sponsorships anywhere in it, and it is free to use in any browser.',
    /* Kept short deliberately: layout.tsx appends ' · Scorebug' to every title
       via the metadata template, and a title Google truncates mid-word is a
       worse result than a shorter one that reads whole. */
    title: 'Hockey scores and a logbook for every game',
    description:
      'Live NHL scores with no betting odds, and a permanent record of every hockey game you '
      + 'watch, graded out of 5.0. All 32 clubs. Free in any browser.',
    points: [
      {
        head: 'Every club, every night',
        body:
          'All 32 NHL clubs, with live scoring, and a Docket you fill with the games you actually '
          + 'intend to watch rather than a wall of everything happening at once.',
      },
      {
        head: 'The game, not the line',
        body:
          'No odds, no spreads, no sportsbook logos. Hockey coverage is unusually saturated with '
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
          'Each entry records whether you watched at home or were there, which is what turns a '
          + 'pile of ratings into an attendance history worth keeping.',
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
          + 'it meant, record whether you watched at home or were in the building, and the entry '
          + 'stays in your vault permanently.',
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
  },
  {
    slug: 'football',
    sport: 'Football',
    label: 'Football',
    vanityHost: vanityFor('football'),
    h1: 'Track the NFL, the CFL and college football in one place',
    lede:
      'Scorebug follows live scores across the NFL, the CFL and NCAA college football in a single '
      + 'logbook, then lets you grade every game you watch out of 5.0 and keep it forever. There '
      + 'are no betting odds, no spreads and no sportsbook sponsorships, and it is free to use in '
      + 'any browser.',
    title: 'NFL, CFL and college football in one logbook',
    description:
      'One app for the NFL, the CFL and NCAA college football: live scores with no betting odds, '
      + 'and a permanent record of every game you watch, graded out of 5.0.',
    points: [
      {
        head: 'Three leagues, one record',
        body:
          'The NFL, the CFL and NCAA college football sit in the same logbook. Following all three '
          + 'usually means three apps and three sets of notifications; here it is one Docket.',
      },
      {
        head: 'The CFL is not an afterthought',
        body:
          'Scorebug is built in Calgary, and the CFL is a first-class league in it rather than a '
          + 'line item — live scores and full logging, the same as the NFL.',
      },
      {
        head: 'The game, not the line',
        body:
          'No odds, no spreads, no sportsbook logos. Football is the most heavily monetised sport '
          + 'in North America for exactly that, and leaving it out is the point of the product.',
      },
      {
        head: 'Back to the 2002 season',
        body:
          'Finished games are loggable back to 2002, so a Sunday you still talk about can be added '
          + 'to your record years after the fact.',
      },
    ],
    aside: {
      head: 'Looking for football the rest of the world means?',
      body:
        'Scorebug covers ten football competitions outside North America as well, including the '
        + 'Premier League, the Champions League, La Liga, Serie A, the Bundesliga, Ligue 1 and MLS. '
        + 'This page is about the gridiron game; the leagues index has all of them.',
      href: '/leagues',
      cta: 'See every league',
    },
    faqs: [
      {
        q: 'Is there one app that tracks the NFL, the CFL and college football?',
        a: 'Yes. Scorebug follows live scores across the NFL, the CFL and NCAA college football in a '
          + 'single app, and every game in all three can be logged and graded in the same record.',
      },
      {
        q: 'Can I log and rate football games I have watched?',
        a: 'Yes. After a game ends you grade it out of 5.0, write what it meant, record whether you '
          + 'watched at home or were in the stadium, and it stays in your vault permanently.',
      },
      {
        q: 'Does Scorebug cover soccer as well as gridiron football?',
        a: 'Yes. Alongside the NFL, CFL and NCAA football, Scorebug covers the Premier League, the '
          + 'UEFA Champions League, La Liga, Serie A, the Bundesliga, Ligue 1, MLS, the Chinese '
          + 'Super League, the Indian Super League and the J1 League.',
      },
      {
        q: 'Is Scorebug free for football fans?',
        a: 'Yes. Tracking live scores and logging games is free. An optional Front Office membership '
          + 'adds a larger Starting Lineup and deeper history, but no league coverage is paywalled.',
      },
    ],
  },
]

export function getSportHub(slug: string): SportHub | undefined {
  return SPORT_HUBS.find(h => h.slug === slug)
}

/**
 * The route files' lookup. Throws rather than returning undefined, which makes
 * a route folder whose slug is not in SPORT_HUBS a BUILD failure on this
 * machine instead of a page that renders empty in production.
 *
 * It exists as a separate function because the obvious alternative — a
 * module-scope `if (!HUB) throw` in the route — does not narrow the type inside
 * the component that closes over it, and the `!` that silences that is exactly
 * the assertion this is meant to replace with a real check.
 */
export function requireSportHub(slug: string): SportHub {
  const hub = getSportHub(slug)
  if (!hub) throw new Error(`app/sports.ts has no hub for '${slug}' — the route and SPORT_HUBS disagree`)
  return hub
}
