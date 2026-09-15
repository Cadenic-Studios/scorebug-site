/**
 * The public face of the Discord server, in one place.
 *
 * The invite, the channel list and the command list are read by the /discord
 * page, the llms.txt brief and anything else that describes the server. One
 * definition means the page, the answer-engine document and the bot's own /help
 * can never drift into describing three different servers.
 *
 * ─── CHANGE THE INVITE HERE AND NOWHERE ELSE ────────────────────────────────
 * Discord invites expire, get revoked and get regenerated. Everywhere we print
 * an address we print getscorebug.app/discord instead, so when the invite
 * changes only this constant does — and every card, post and printed link that
 * has already gone out keeps working.
 */

/** The permanent invite. Create it as a NEVER-EXPIRING, unlimited-use link. */
export const DISCORD_INVITE = 'https://discord.gg/tzxVFBwHtf'

/** The bot's install link. Scopes: applications.commands + bot. Permission: Send Messages (2048). */
export const DISCORD_BOT_INVITE =
  'https://discord.com/oauth2/authorize?client_id=1514041378080821388&permissions=2048&scope=bot+applications.commands'

/**
 * The OTHER install: a person adds Scorebug to their own Discord account
 * rather than to a server (`integration_type=1`).
 *
 * This is the link that does not need an admin. A server install needs
 * somebody with Manage Server to agree; a user install needs nobody, and the
 * commands then travel with that person into every server and DM they are in
 * — including servers where a bot would never be approved. It is the cheapest
 * distribution we have, and the reason the registered commands declare
 * integration_types [0, 1] (see engine/scripts/register-discord-commands.mjs).
 *
 * Replies from a user-installed command are only visible to the person who
 * ran it, which is also why it is safe: it cannot spam a room it was never
 * invited into.
 */
export const DISCORD_USER_INSTALL =
  'https://discord.com/oauth2/authorize?client_id=1514041378080821388&integration_type=1&scope=applications.commands'

export const DISCORD_CHANNELS: Array<{ name: string; what: string }> = [
  { name: 'welcome', what: 'What Scorebug is, where to get it, and the one rule.' },
  { name: 'announcements', what: 'Releases, new leagues, new features. Nothing else.' },
  { name: 'the-slate', what: 'Tonight’s games and last night’s results, posted automatically.' },
  { name: 'the-bleachers', what: 'Arguing about what you just watched. The main room.' },
  { name: 'graded', what: 'Cards people have shared — a game, a grade, and what it meant.' },
  { name: 'bugs-and-ideas', what: 'Where the closed testers put what is broken and what is missing.' },
  { name: 'bot', what: 'Where /rate and /best go, so they stay out of the conversation.' },
]

export const DISCORD_COMMANDS: Array<{ name: string; what: string }> = [
  { name: 'rate', what: 'A game’s grade out of 5.0, with the Scorebug card for it.' },
  { name: 'slate', what: 'Tonight’s games in a league, and which are worth staying up for.' },
  { name: 'best', what: 'The highest-graded games lately, across every league.' },
  { name: 'find', what: 'Graded games for a club, by name or abbreviation.' },
  { name: 'league', what: 'The recently graded games in one league.' },
  { name: 'invite', what: 'Add the bot to your own server. Free, and it only replies when asked.' },
  { name: 'help', what: 'What Scorebug is and where to get it.' },
]
