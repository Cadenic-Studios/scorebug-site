import { handleInteraction } from '../../lib/discord/core'
import { scorebugBot } from '../../lib/discord/scorebug'

/**
 * /api/discord — where Discord posts when somebody runs a Scorebug command.
 *
 * Three lines of wiring on purpose. Everything Discord-shaped is in
 * lib/discord/core (signature checking, routing, response shapes) and
 * everything Scorebug-shaped is in lib/discord/scorebug. A second product's
 * bot is a second file beside this one:
 *
 *     export const POST = (req: Request) =>
 *       handleInteraction(req, deltaVBot, process.env.DELTAV_DISCORD_PUBLIC_KEY)
 *
 * ─── WHY NODE AND NOT EDGE ──────────────────────────────────────────────────
 * The signature check uses node:crypto's Ed25519 verification. Web Crypto can
 * do it too, but node:crypto is synchronous, and a synchronous check cannot be
 * accidentally awaited wrongly into a branch that returns before it resolves.
 *
 * ─── WHY IT IS NEVER CACHED ─────────────────────────────────────────────────
 * Every request is a different signed payload and every reply is specific to
 * the person who asked. A cached interaction response would answer one person
 * with another person's result.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = (req: Request) =>
  handleInteraction(req, scorebugBot, process.env.DISCORD_PUBLIC_KEY)

/** A GET is a person pasting the URL into a browser, not Discord. Say so plainly. */
export function GET() {
  return new Response(
    'This is the Scorebug Discord bot’s interactions endpoint. It only answers signed POSTs from Discord.\n'
    + 'The bot itself lives in servers: https://getscorebug.app/discord\n',
    { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )
}
