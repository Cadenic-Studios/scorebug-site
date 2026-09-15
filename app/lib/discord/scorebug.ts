import { createHmac } from 'node:crypto'
import { SITE, WEB_APP } from '../../config'
import { loadRecent, loadSlate, leagueFromSlug, LEAGUE_IDS, type RecentGame } from '../gamepage'
import { type Bot, type Interaction, type Reply, type Embed, message, note, choices } from './core'
import { DISCORD_BOT_INVITE, DISCORD_INVITE } from './public'

/**
 * THE SCOREBUG BOT — what it knows, said in one place.
 *
 * Everything Discord-shaped lives in ./core. This file is the product: which
 * commands exist, what they say, and which colours they say it in. A second
 * Cadenic bot is a second file like this one and nothing else.
 *
 * ─── WHY THE CARD IMAGE IS THE WHOLE POINT ──────────────────────────────────
 *
 * A bot that answers in text is a utility. A bot that answers with a Scorebug
 * card — the same broadcast graphic the marketing engine posts — is a utility
 * that markets itself: every answer is a branded image sitting in somebody
 * else's server, with the domain along the bottom of it. The card press already
 * exists at /api/card and already renders these. The bot just has to ask.
 *
 * ─── WHAT IT WILL NOT SAY ───────────────────────────────────────────────────
 *
 * Only the aggregates the website already publishes: counts and averages over
 * public logs. No usernames, no written notes, nothing per person. Discord is
 * a place where names are attached to faces and voices, which makes it exactly
 * the wrong room to start reading out somebody's viewing history.
 */

const RED = 0xf85149, TEAL = 0x2dd4bf, INK = 0x7d8590

/**
 * Cards carry SIGNED claims.
 *
 * Any parameter that asserts something about Scorebug — a community grade, a
 * log count, a headline — is dropped by the card press unless the URL carries
 * an HMAC over the query under DISPATCH_KEY. That is what stops anyone pasting
 * `&g=5.0&n=90000` into a card URL and posting a screenshot of it. The bot is
 * a legitimate caller, so it signs the same way the engine does.
 *
 * Without the key the card still renders — it simply loses the grade, which is
 * the correct failure: a real card with less on it, never a fabricated one.
 */
function cardUrl(params: Record<string, string>): string {
  const u = new URL(`${SITE}/api/card`)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  const key = process.env.DISPATCH_KEY
  if (key) {
    const pairs: string[] = []
    u.searchParams.forEach((v, k) => { if (k !== 'sig') pairs.push(`${k}=${v}`) })
    u.searchParams.set('sig', createHmac('sha256', key).update(pairs.sort().join('&')).digest('hex').slice(0, 24))
  }
  return u.toString()
}

function cardFor(g: RecentGame): string {
  return cardUrl({
    k: 'final', size: 'wide', l: g.leagueId,
    a: g.awayAbbr || g.awayTeam.slice(0, 3).toUpperCase(), an: g.awayTeam,
    as: g.awayScore == null ? '' : String(g.awayScore),
    h: g.homeAbbr || g.homeTeam.slice(0, 3).toUpperCase(), hn: g.homeTeam,
    hs: g.homeScore == null ? '' : String(g.homeScore),
    d: 'Final',
    ...(g.logs >= 1 ? { band: 'community', g: g.avg.toFixed(1), n: String(g.logs) } : {}),
  })
}

const scoreText = (g: RecentGame) =>
  `${g.awayAbbr || g.awayTeam} ${g.awayScore ?? '–'} · ${g.homeScore ?? '–'} ${g.homeAbbr || g.homeTeam}`

const listLine = (g: RecentGame) =>
  `**${g.avg.toFixed(1)}** · ${scoreText(g)}  _(${g.leagueId}, ${g.logs} ${g.logs === 1 ? 'grade' : 'grades'})_\n${SITE}${g.href}`

/** "oilers" → "Oilers". People type lower case; a title should not repeat it back. */
const titleCase = (s: string) =>
  String(s || '').replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())

const matches = (g: RecentGame, q: string) =>
  `${g.homeTeam} ${g.awayTeam} ${g.homeAbbr} ${g.awayAbbr}`.toLowerCase().includes(q)

/** One game, as a card. The answer this bot exists to give. */
function gameEmbed(g: RecentGame): Embed {
  return {
    title: `${g.awayTeam} at ${g.homeTeam}`,
    url: `${SITE}${g.href}`,
    color: TEAL,
    description:
      `**${g.avg.toFixed(1)} / 5.0** from ${g.logs} ${g.logs === 1 ? 'fan who logged it' : 'fans who logged it'}\n`
      + `${g.leagueId} · ${scoreText(g)}`,
    image: { url: cardFor(g) },
    footer: { text: 'Graded by the people who watched it · getscorebug.app' },
  }
}

const HELP: Embed = {
  title: 'Scorebug',
  url: SITE,
  color: RED,
  description:
    'A logbook for the games you watch. Log it, grade it out of 5.0, say what it meant, keep it forever.\n'
    + 'Live scores across 19 leagues, and not one gambling ad — that part is permanent.',
  fields: [
    { name: '/rate', value: 'How fans graded a team’s last game, with the card', inline: false },
    { name: '/slate', value: 'Tonight’s fixtures, finished ones already rated out of 100', inline: false },
    { name: '/best', value: 'The highest-graded games lately', inline: true },
    { name: '/find', value: 'Every graded game for a club', inline: true },
    { name: '/league', value: 'Recent games in one league', inline: true },
    { name: '/invite', value: 'Add this bot to your own server — free', inline: true },
    { name: 'Use it now', value: `[${WEB_APP.replace(/^https?:\/\//, '')}](${WEB_APP})`, inline: true },
    { name: 'Every game rated', value: `[Was it a good game?](${SITE}/game)`, inline: true },
  ],
  footer: { text: 'Made by Cadenic Studios' },
}

async function onCommand(i: Interaction): Promise<Reply> {
  switch (i.name) {
    case 'about':
    case 'help':
      return message([HELP])

    case 'rate': {
      const q = (i.options.team || '').toLowerCase().trim()
      if (q.length < 2) return note('Give me at least two letters of a team name.')
      const hit = (await loadRecent(60)).filter(g => matches(g, q))[0]
      if (!hit) {
        /* THE MOST VALUABLE MOMENT THIS BOT HAS. Somebody has just told us, in
           public, that they care enough about a team to ask how its game was —
           and we have nothing. An apology wastes that. An invitation does not,
           and it is true: the next grade on that page really would be theirs. */
        return message([{
          title: `Nobody has graded a ${titleCase(i.options.team)} game yet`,
          url: WEB_APP,
          color: RED,
          description:
            `Which means the first grade is going.\n\n`
            + `Log the game on Scorebug, give it a mark out of 5.0, say what it meant — and it `
            + `becomes the rating everyone else sees.`,
          fields: [
            { name: 'Grade it', value: `[${WEB_APP.replace(/^https?:\/\//, '')}](${WEB_APP})`, inline: true },
            { name: 'Everything rated so far', value: `[getscorebug.app/game](${SITE}/game)`, inline: true },
          ],
        }], true)
      }
      return message([gameEmbed(hit)])
    }

    case 'slate':
    case 'tonight': {
      const id = (i.options.league || 'NHL').toUpperCase()
      const lg = leagueFromSlug(id)
      if (!lg) return note(`I do not know “${id}”. Try one of: ${LEAGUE_IDS.join(', ')}.`)
      const games = await loadSlate(id)
      if (games == null) return note('Could not reach the sports wire just then. Try again in a moment.')
      if (!games.length) return note(`No ${lg.name} games today.`)
      return message([{
        title: `${lg.name} today`,
        url: `${SITE}/game`,
        color: RED,
        description: games.slice(0, 12).map(g =>
          `${g.final ? '**FT**' : g.time} · ${g.away} ${g.awayScore ?? ''} ${g.final ? '–' : 'at'} ${g.homeScore ?? ''} ${g.home}`
          + (g.watch != null ? `  _(${g.watch}/100 — ${g.verdict.toLowerCase()})_` : '')).join('\n'),
        footer: { text: 'Finished games are rated from the box score · grade them yourself on Scorebug' },
      }])
    }

    case 'invite':
      return message([{
        title: 'Add Scorebug to your server',
        url: DISCORD_BOT_INVITE,
        color: TEAL,
        description:
          'Free, and it only ever speaks when somebody runs a command — it cannot read your messages '
          + 'and asks for one permission: to send them.',
        fields: [
          { name: 'Add the bot', value: `[Authorise it](${DISCORD_BOT_INVITE})`, inline: true },
          { name: 'Our server', value: `[${DISCORD_INVITE.replace(/^https?:\/\//, '')}](${SITE}/discord)`, inline: true },
        ],
      }, ], true)

    case 'best': {
      const top = (await loadRecent(60))
        .filter(g => g.logs >= 2)
        .sort((a, b) => b.avg - a.avg || b.logs - a.logs)
        .slice(0, 5)
      if (!top.length) return note('Nothing has enough grades yet. Log a game and it will show up here.')
      /* The best one gets a card; the rest are a list. Six images in one message
         is a wall, and Discord collapses them anyway. */
      return message([
        { ...gameEmbed(top[0]), title: `Best-graded lately — ${top[0].awayTeam} at ${top[0].homeTeam}` },
        ...(top.length > 1
          ? [{ title: 'Also highly graded', color: INK, description: top.slice(1).map(listLine).join('\n\n'), url: `${SITE}/game` }]
          : []),
      ])
    }

    case 'find': {
      const q = (i.options.team || '').toLowerCase().trim()
      if (q.length < 2) return note('Give me at least two letters of a team name.')
      const hits = (await loadRecent(60)).filter(g => matches(g, q)).slice(0, 5)
      if (!hits.length) return note(`Nothing graded matching “${q}”. Everything logged so far is at ${SITE}/game`)
      return message([{ title: `Graded games matching “${q}”`, url: `${SITE}/game`, color: TEAL, description: hits.map(listLine).join('\n\n') }])
    }

    case 'league': {
      const id = (i.options.league || '').toUpperCase()
      const lg = leagueFromSlug(id)
      if (!lg) return note(`I do not know “${id}”. Try one of: ${LEAGUE_IDS.join(', ')}.`)
      const games = (await loadRecent(60)).filter(g => g.leagueId === lg.id).slice(0, 5)
      if (!games.length) return note(`No ${lg.name} games have been graded yet. Be the first: ${WEB_APP}`)
      return message([{ title: `${lg.name} — recently graded`, url: `${SITE}/game`, color: TEAL, description: games.map(listLine).join('\n\n') }])
    }

    default:
      return note('Unknown command. Try /help.')
  }
}

/**
 * Typeahead over the clubs that actually have a graded game, so the list can
 * never offer something that returns nothing. Discord allows three seconds and
 * will not retry, so this reads the same cached aggregate the commands do.
 */
async function onAutocomplete(i: Interaction): Promise<Reply> {
  if (i.focused !== 'team') return choices([])
  const q = (i.options.team || '').toLowerCase().trim()
  const seen = new Map<string, string>()
  for (const g of await loadRecent(60)) {
    for (const name of [g.homeTeam, g.awayTeam]) {
      if (!name) continue
      const k = name.toLowerCase()
      if (!seen.has(k) && (!q || k.includes(q))) seen.set(k, name)
    }
  }
  /* forEach, not spread: this project's tsconfig target predates downlevel
     iteration of a Map iterator — the same constraint the card route hit. */
  const names: string[] = []
  seen.forEach(v => names.push(v))
  return choices(names.sort().map(n => ({ name: n, value: n })))
}

export const scorebugBot: Bot = { name: 'Scorebug', onCommand, onAutocomplete }
