// Scorebug dispatch — the league registry, mirrored.
//
// ── HAND-MIRRORED FROM scorebug-app/lib/leagueRegistry.ts, ON PURPOSE ────────
//
// The app is a static export bundled into an APK and this is a Cloud Function;
// there is no shared package between them, so the list is copied rather than
// imported — the same convention scorebug-site/app/leagues.ts already documents.
// The fields that matter to the ENGINE are the ones that address ESPN (`sport`,
// `espnSlug`, `rangeQuery`, `scoreboardParams`), the season gate
// (`seasonMonths`), and three fields the app does not have because the app does
// not have to choose between games: `audience`, `tags` and `country`.
//
// IF YOU ADD A LEAGUE: add it in the app's registry FIRST, then the site's
// leagues.ts, then here. `LEAGUE_COUNT` is derived so the three can never print
// different totals, but a league missing from one of them is still a bug.
//
// ── WHY CFL IS NOT ON ESPN ─────────────────────────────────────────────────
//
// ESPN's CFL scoreboard answered with an empty events array for a September
// week that had four games in it (measured 2026-09-09). The app reads CFL from
// TheSportsDB and its own scraped tables; the engine reads TheSportsDB too. See
// feed.js.

export const LEAGUES = Object.freeze([
  //  id        sport         slug                      range  params        season   split  aud  country                   tz
  L('NHL',     'hockey',     'nhl',                     true,  '',           [8, 5],  true,  3,   'United States and Canada', 'America/New_York',  'NHL',        ['NHL', 'Hockey']),
  L('NFL',     'football',   'nfl',                     true,  '',           [6, 1],  false, 3,   'United States',            'America/New_York',  'NFL',        ['NFL']),
  L('NBA',     'basketball', 'nba',                     true,  '',           [8, 5],  true,  2,   'United States and Canada', 'America/New_York',  'NBA',        ['NBA']),
  L('MLB',     'baseball',   'mlb',                     true,  '',           [1, 10], false, 2,   'United States and Canada', 'America/New_York',  'MLB',        ['MLB']),
  L('F1',      'racing',     'f1',                      false, '',           [2, 11], false, 1,   'Worldwide',                'Europe/London',     'Formula 1',  ['F1', 'Formula1']),
  L('IPL',     'cricket',    '8048',                    false, '',           [2, 5],  false, 1,   'India',                    'Asia/Kolkata',      'IPL',        ['IPL', 'Cricket']),
  L('CFL',     'football',   'cfl',                     true,  '',           [4, 11], false, 2,   'Canada',                   'America/Toronto',   'CFL',        ['CFL']),
  L('NCAAF',   'football',   'college-football',        true,  '',           [7, 0],  false, 1,   'United States',            'America/New_York',  'college football', ['CollegeFootball', 'CFB']),
  L('NCAAB',   'basketball', 'mens-college-basketball', false, 'groups=50',  [9, 3],  true,  1,   'United States',            'America/New_York',  'college basketball', ['CollegeBasketball', 'NCAAB']),
  L('EPL',     'soccer',     'eng.1',                   true,  '',           [6, 4],  true,  2,   'England',                  'Europe/London',     'Premier League', ['PremierLeague', 'PL']),
  L('UCL',     'soccer',     'uefa.champions',          true,  '',           [6, 4],  true,  2,   'Europe',                   'Europe/Paris',      'Champions League', ['ChampionsLeague', 'UCL']),
  L('LALIGA',  'soccer',     'esp.1',                   true,  '',           [6, 4],  true,  1,   'Spain',                    'Europe/Madrid',     'La Liga',    ['LaLiga']),
  L('SERIEA',  'soccer',     'ita.1',                   true,  '',           [6, 4],  true,  1,   'Italy',                    'Europe/Rome',       'Serie A',    ['SerieA']),
  L('BUND',    'soccer',     'ger.1',                   true,  '',           [6, 4],  true,  1,   'Germany',                  'Europe/Berlin',     'Bundesliga', ['Bundesliga']),
  L('LIGUE1',  'soccer',     'fra.1',                   true,  '',           [6, 4],  true,  1,   'France',                   'Europe/Paris',      'Ligue 1',    ['Ligue1']),
  L('MLS',     'soccer',     'usa.1',                   true,  '',           [1, 11], false, 1,   'United States and Canada', 'America/New_York',  'MLS',        ['MLS']),
  L('CSL',     'soccer',     'chn.1',                   true,  '',           [1, 11], false, 0,   'China',                    'Asia/Shanghai',     'Chinese Super League', ['CSL']),
  L('ISL',     'soccer',     'ind.1',                   true,  '',           [7, 4],  true,  0,   'India',                    'Asia/Kolkata',      'Indian Super League', ['ISL', 'IndianFootball']),
  L('JLEAGUE', 'soccer',     'jpn.1',                   true,  '',           [1, 11], false, 0,   'Japan',                    'Asia/Tokyo',        'J.League',   ['JLeague']),
]);

function L(id, sport, espnSlug, rangeQuery, scoreboardParams, seasonMonths, splitYear, audience, country, tz, name, tags) {
  return Object.freeze({ id, sport, espnSlug, rangeQuery, scoreboardParams, seasonMonths, splitYear, audience, country, tz, name, tags: Object.freeze(tags), espn: id !== 'CFL' });
}

export const LEAGUE_COUNT = LEAGUES.length;
export const LEAGUE_BY_ID = Object.freeze(Object.fromEntries(LEAGUES.map((l) => [l.id, l])));
export const CLUB_SPORTS = new Set(['hockey', 'football', 'basketball', 'baseball', 'soccer', 'cricket']);

/** The first season the app lets a fan back-log. A product fact, mirrored from the site. */
export const FIRST_SEASON = 2002;

/**
 * Is this league plausibly playing in this month? Padded wide on purpose, the
 * same as the app: a wasted empty request costs nothing and a too-narrow window
 * hides real games. Month is 0-based.
 */
export function inSeason(league, month) {
  const l = typeof league === 'string' ? LEAGUE_BY_ID[league] : league;
  if (!l) return true;
  const [first, last] = l.seasonMonths;
  return first <= last ? month >= first && month <= last : month >= first || month <= last;
}

/**
 * ── WHAT "CLOSE" MEANS IN EACH SPORT ────────────────────────────────────────
 *
 * A one-goal hockey game and a one-point basketball game are not the same
 * thing, and a ranker that treats margins as plain numbers would rate every
 * basketball game as a blowout. These are per-sport thresholds for "decided by
 * a single score" (tight) and "close enough that the loser was in it" (close),
 * plus the total above which the game was unusually high-scoring. They are
 * judgement calls stated once, so the bandit can tune them later rather than a
 * template inventing them per post.
 */
export const SPORT_SHAPE = Object.freeze({
  hockey:     { tight: 1, close: 2, highTotal: 9,   periods: 3, periodName: 'period',  ot: 'OT', so: 'SO' },
  soccer:     { tight: 1, close: 2, highTotal: 5,   periods: 2, periodName: 'half',    ot: 'ET', so: 'pens' },
  basketball: { tight: 3, close: 6, highTotal: 240, periods: 4, periodName: 'quarter', ot: 'OT', so: null },
  football:   { tight: 3, close: 7, highTotal: 55,  periods: 4, periodName: 'quarter', ot: 'OT', so: null },
  baseball:   { tight: 1, close: 2, highTotal: 15,  periods: 9, periodName: 'inning',  ot: 'extras', so: null },
  cricket:    { tight: 0, close: 0, highTotal: 0,   periods: 2, periodName: 'innings', ot: null, so: null },
  racing:     { tight: 0, close: 0, highTotal: 0,   periods: 1, periodName: 'race',    ot: null, so: null },
});

/**
 * ── TEAM HASHTAGS ───────────────────────────────────────────────────────────
 *
 * On Bluesky and Mastodon a tag is a feed people follow, and in sports the tag
 * people follow is the TEAM'S, not the league's. This is a hand-checked table
 * of the ones that are genuinely in use; anything not here falls back to the
 * league tag, which is a weaker post but never a wrong one. A generated tag —
 * `#${city}${nickname}` — is how an account ends up posting #NewYorkJets to a
 * fan base that uses #Jets, and it reads as a bot immediately.
 *
 * Keyed by league then ESPN abbreviation. Add to it; never derive it.
 */
export const TEAM_TAGS = Object.freeze({
  NHL: { EDM: 'LetsGoOilers', CGY: 'Flames', TOR: 'LeafsForever', MTL: 'GoHabsGo', VAN: 'Canucks', WPG: 'GoJetsGo', OTT: 'GoSensGo', BOS: 'NHLBruins', NYR: 'NYR', PIT: 'LetsGoPens', CHI: 'Blackhawks', DET: 'LGRW', COL: 'GoAvsGo', VGK: 'VegasBorn', FLA: 'TimeToHunt', TBL: 'GoBolts', TB: 'GoBolts', DAL: 'TexasHockey', LAK: 'GoKingsGo', LA: 'GoKingsGo', SEA: 'SeaKraken', MIN: 'MNWild', NJD: 'NJDevils', NJ: 'NJDevils', CAR: 'LetsGoCanes', WSH: 'ALLCAPS', PHI: 'LetsGoFlyers', BUF: 'LetsGoBuffalo', STL: 'STLBlues', NSH: 'Preds', CBJ: 'CBJ', ANA: 'FlyTogether', SJS: 'SJSharks', SJ: 'SJSharks', NYI: 'Isles', UTA: 'TusksUp' },
  NFL: { KC: 'ChiefsKingdom', BUF: 'BillsMafia', DET: 'OnePride', PHI: 'FlyEaglesFly', DAL: 'DallasCowboys', GB: 'GoPackGo', SF: 'FTTB', NE: 'ForeverNE', PIT: 'HereWeGo', MIN: 'Skol', CHI: 'DaBears', NYJ: 'Jets', NYG: 'NYGiants', BAL: 'RavensFlock', CIN: 'WhoDey', CLE: 'DawgPound', DEN: 'BroncosCountry', LV: 'RaiderNation', LAC: 'BoltUp', LAR: 'RamsHouse', SEA: 'Seahawks', ARI: 'BirdCityFootball', ATL: 'DirtyBirds', CAR: 'KeepPounding', NO: 'Saints', TB: 'GoBucs', HOU: 'WeAreTexans', IND: 'ForTheShoe', JAX: 'DUUUVAL', TEN: 'Titans', MIA: 'FinsUp', WSH: 'RaiseHail' },
  NBA: { TOR: 'WeTheNorth', LAL: 'LakeShow', BOS: 'BleedGreen', GS: 'DubNation', GSW: 'DubNation', MIL: 'FearTheDeer', DEN: 'MileHighBasketball', OKC: 'ThunderUp', PHI: 'BrotherlyLove', NY: 'Knicks', NYK: 'Knicks', MIA: 'HEATCulture', DAL: 'MFFL', PHX: 'ValleyProud', CLE: 'LetEmKnow', MIN: 'RaisedByWolves', IND: 'BoomBaby', SA: 'PorVida', SAS: 'PorVida', LAC: 'ClipperNation' },
  MLB: { TOR: 'BlueJays', NYY: 'RepBX', LAD: 'Dodgers', BOS: 'DirtyWater', CHC: 'Cubs', ATL: 'BravesCountry', HOU: 'Astros', SF: 'SFGiants', SEA: 'Mariners', PHI: 'RingTheBell', BAL: 'Birdland', DET: 'RepDetroit', CLE: 'ForTheLand', MIL: 'ThisIsMyCrew', SD: 'Padres', NYM: 'LGM', TEX: 'StraightUpTX', MIN: 'MNTwins', STL: 'STLCards', KC: 'Royals' },
  CFL: { EDM: 'Elks', CGY: 'Stamps', SSK: 'Riders', WPG: 'ForTheW', TOR: 'Argos', HAM: 'Ticats', BC: 'BCLions', OTT: 'RNation', MTL: 'Alouettes' },
  EPL: { ARS: 'Arsenal', CHE: 'CFC', LIV: 'LFC', MCI: 'ManCity', MUN: 'MUFC', TOT: 'COYS', NEW: 'NUFC', AVL: 'AVFC', EVE: 'EFC', WHU: 'WHUFC', LEE: 'LUFC', BHA: 'BHAFC', NFO: 'NFFC', CRY: 'CPFC', FUL: 'FFC', BRE: 'BrentfordFC', WOL: 'WWFC', BOU: 'AFCB', SUN: 'SAFC', BUR: 'TwitterClarets' },
  LALIGA: { RMA: 'HalaMadrid', BAR: 'ForcaBarca', ATM: 'AtleticoMadrid', SEV: 'SevillaFC', RSO: 'RealSociedad', ATH: 'AthleticClub', BET: 'RealBetis', VIL: 'Villarreal', VAL: 'ValenciaCF' },
  SERIEA: { JUV: 'Juventus', INT: 'Inter', MIL: 'ACMilan', NAP: 'Napoli', ROM: 'ASRoma', LAZ: 'Lazio', ATA: 'Atalanta', FIO: 'Fiorentina' },
  BUND: { BAY: 'FCBayern', DOR: 'BVB', LEV: 'Bayer04', LEI: 'RBLeipzig', FRA: 'SGE', STU: 'VfB', WOB: 'VfLWolfsburg', BMG: 'Borussia' },
  LIGUE1: { PSG: 'PSG', MAR: 'OM', LYON: 'OL', LYO: 'OL', MON: 'ASMonaco', LILL: 'LOSC', LIL: 'LOSC', NICE: 'OGCNice', NIC: 'OGCNice', LEN: 'RCLens' },
  UCL: {},
  MLS: { TOR: 'TFCLive', VAN: 'VWFC', MTL: 'CFMTL', LAFC: 'LAFC', MIA: 'InterMiamiCF', ATL: 'UniteAndConquer', SEA: 'Sounders', CLB: 'Crew96', LAG: 'LAGalaxy', POR: 'RCTID', CIN: 'AllForCincy' },
  NCAAF: {}, NCAAB: {}, CSL: {}, ISL: {}, JLEAGUE: {}, IPL: {}, F1: {},
});

/**
 * Teams in Canada, by league and ESPN abbreviation. The first market is Canada
 * and the United States, and a Canadian club in a game is worth a point in the
 * ranker until the bandit says otherwise. This is a market weight, not a claim
 * about quality.
 */
export const CANADIAN = Object.freeze({
  NHL: new Set(['EDM', 'CGY', 'TOR', 'MTL', 'VAN', 'WPG', 'OTT']),
  MLB: new Set(['TOR']),
  NBA: new Set(['TOR']),
  MLS: new Set(['TOR', 'VAN', 'MTL']),
  CFL: new Set(['EDM', 'CGY', 'SSK', 'WPG', 'TOR', 'HAM', 'BC', 'OTT', 'MTL']),
});

/* ────────────────────────────────────────────────────────────── LOCAL TIME */

const DTF = new Map();
function fmt(tz) {
  if (!DTF.has(tz)) {
    DTF.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }));
  }
  return DTF.get(tz);
}

/**
 * The parts of an instant in a time zone. `day` is YYYY-MM-DD in that zone,
 * which is the key every daily slot uses — a "day" for this engine is a
 * Mountain day, not a UTC one, because a final at 23:40 Mountain is still
 * tonight's game and a slate at 07:00 Mountain is this morning's.
 */
export function localParts(ms, tz = 'America/Edmonton') {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year), month: Number(parts.month) - 1, date: Number(parts.day),
    hour, minute: Number(parts.minute), weekday: parts.weekday, // 'Mon'
    minutes: hour * 60 + Number(parts.minute),
  };
}

/** "6:15pm" in a zone, the way a person writes it, no leading zero, no seconds. */
export function clock(ms, tz = 'America/Edmonton') {
  const p = localParts(ms, tz);
  const h12 = p.hour % 12 || 12;
  return `${h12}:${String(p.minute).padStart(2, '0')}${p.hour < 12 ? 'am' : 'pm'}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "18 September 2016" — a record, not a greeting. */
export function longDate(ms, tz = 'America/Edmonton') {
  const p = localParts(ms, tz);
  return `${p.date} ${MONTHS[p.month]} ${p.year}`;
}

/**
 * The season label the app uses: "2026-27" for split seasons, "2026" otherwise.
 *
 * `year` is ESPN's `season.year`, which for a split season is the END year —
 * the 2026-27 NHL season is reported as 2027 (measured on the September 2026
 * preseason scoreboard). So a split season prints year-1 to year.
 */
export function seasonLabel(league, year) {
  const l = typeof league === 'string' ? LEAGUE_BY_ID[league] : league;
  if (l && l.splitYear) return `${year - 1}-${String(year).slice(2)}`;
  return String(year);
}
