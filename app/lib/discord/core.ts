/**
 * A DISCORD BOT, WITHOUT THE PRODUCT IN IT
 *
 * Everything in this file is true of any Discord bot: how a request is proved
 * to have come from Discord, how a reply is shaped, how an interaction is
 * routed to a handler. Nothing in it knows what Scorebug is.
 *
 * That separation is the point. Cadenic Studios runs more than one product, and
 * the second bot should be a list of commands and a palette — not a second
 * implementation of Ed25519 verification, written from memory, subtly different
 * in the one place it matters. Port this file unchanged; write a new `Bot`.
 *
 *     import { handleInteraction } from '../../lib/discord/core'
 *     import { deltaV } from '../../lib/discord/deltav'
 *     export const POST = (req) => handleInteraction(req, deltaV, process.env.DELTAV_DISCORD_PUBLIC_KEY)
 *
 * ─── THE SIGNATURE IS THE ENTIRE SECURITY MODEL ─────────────────────────────
 *
 * The endpoint is public and unauthenticated by design. What stops anybody
 * posting to it is an Ed25519 signature over `timestamp + rawBody`, made with a
 * key only Discord holds. Three rules follow, and all three have teeth:
 *
 *   1. Verify the RAW body, before parsing. Verifying a re-serialised object
 *      checks a different string than the one that was signed.
 *   2. Any failure — missing header, malformed key, exception — is a 401 and
 *      never a fall-through. Discord tests this: when you save an endpoint it
 *      sends deliberately invalid signatures and refuses the URL unless they
 *      are rejected.
 *   3. Bound the timestamp. A valid old request is still a valid request, and
 *      replaying one is free.
 */

import { verify, createPublicKey } from 'node:crypto'

/** The fixed SPKI DER header for Ed25519; Discord gives the 32 key bytes as hex. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Discord's numbering, named so the branches below read as English. */
export const InteractionType = { PING: 1, COMMAND: 2, COMPONENT: 3, AUTOCOMPLETE: 4, MODAL: 5 } as const
export const ResponseType = {
  PONG: 1,
  MESSAGE: 4,
  DEFERRED: 5,
  AUTOCOMPLETE_RESULT: 8,
} as const
/** Message flag 64: only the person who ran the command can see it. */
export const EPHEMERAL = 1 << 6

export interface Embed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  image?: { url: string }
  thumbnail?: { url: string }
  footer?: { text: string }
}

export type Reply =
  | { kind: 'message'; content?: string; embeds?: Embed[]; ephemeral?: boolean }
  | { kind: 'choices'; choices: Array<{ name: string; value: string }> }

export interface Interaction {
  name: string
  /** Option values by name, already flattened out of Discord's nesting. */
  options: Record<string, string>
  /** For autocomplete: which option the person is typing into. */
  focused: string | null
  locale: string
  raw: any
}

export interface Bot {
  /** Used only in error text, so a failure says which bot failed. */
  name: string
  onCommand(i: Interaction): Promise<Reply>
  /** Optional: typeahead. Discord allows three seconds and no retry. */
  onAutocomplete?(i: Interaction): Promise<Reply>
}

export function message(embeds: Embed[], ephemeral = false): Reply {
  return { kind: 'message', embeds, ephemeral }
}
export function note(content: string, ephemeral = true): Reply {
  return { kind: 'message', content, ephemeral }
}
export function choices(list: Array<{ name: string; value: string }>): Reply {
  /* Discord rejects the whole response over 25, and truncates names past 100
     characters rather than telling you. Enforce both here so no command has to
     remember. */
  return {
    kind: 'choices',
    choices: list.slice(0, 25).map(c => ({ name: c.name.slice(0, 100), value: c.value.slice(0, 100) })),
  }
}

export function verifyRequest(rawBody: string, sig: string | null, ts: string | null, publicKeyHex: string | undefined): boolean {
  if (!publicKeyHex || !sig || !ts) return false
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts))
  if (!Number.isFinite(age) || age > 300) return false
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der', type: 'spki',
    })
    return verify(null, Buffer.from(ts + rawBody), key, Buffer.from(sig, 'hex'))
  } catch {
    return false   // a malformed key or signature is a failure, never a pass
  }
}

/** Discord nests options for subcommands; this flattens whatever arrived. */
function readOptions(data: any): { options: Record<string, string>; focused: string | null } {
  const out: Record<string, string> = {}
  let focused: string | null = null
  const walk = (list: any[]) => {
    for (const o of list || []) {
      if (Array.isArray(o?.options)) { walk(o.options); continue }
      if (o?.name != null && o?.value != null) out[String(o.name)] = String(o.value)
      if (o?.focused === true) focused = String(o.name)
    }
  }
  walk(data?.options || [])
  return { options: out, focused }
}

function toResponse(r: Reply): Response {
  if (r.kind === 'choices') {
    return Response.json({ type: ResponseType.AUTOCOMPLETE_RESULT, data: { choices: r.choices } })
  }
  return Response.json({
    type: ResponseType.MESSAGE,
    data: {
      ...(r.content ? { content: r.content.slice(0, 2000) } : {}),
      ...(r.embeds?.length ? { embeds: r.embeds.slice(0, 10) } : {}),
      /* Never ping anybody from an automated message. A bot that can be made to
         @everyone is a bot that gets removed from every server it is in. */
      allowed_mentions: { parse: [] },
      ...(r.ephemeral ? { flags: EPHEMERAL } : {}),
    },
  })
}

/**
 * The whole request lifecycle. A route is three lines on top of this.
 *
 * Note what is NOT here: deferred replies. Discord gives three seconds, and
 * every command in these bots reads one cached aggregate and returns. Deferring
 * would mean a follow-up webhook call, a second failure mode, and a visible
 * "thinking..." for work that takes 200ms. If a command ever genuinely needs
 * longer, it should be the one that defers — not all of them, pre-emptively.
 */
export async function handleInteraction(req: Request, bot: Bot, publicKeyHex: string | undefined): Promise<Response> {
  const raw = await req.text()
  const ok = verifyRequest(
    raw,
    req.headers.get('x-signature-ed25519'),
    req.headers.get('x-signature-timestamp'),
    publicKeyHex,
  )
  if (!ok) return new Response('invalid request signature', { status: 401 })

  let body: any
  try { body = JSON.parse(raw) } catch { return new Response('bad request', { status: 400 }) }

  if (body?.type === InteractionType.PING) return Response.json({ type: ResponseType.PONG })

  const isCommand = body?.type === InteractionType.COMMAND
  const isAutocomplete = body?.type === InteractionType.AUTOCOMPLETE
  if (!isCommand && !isAutocomplete) return Response.json({ type: ResponseType.PONG })

  const { options, focused } = readOptions(body?.data)
  const interaction: Interaction = {
    name: String(body?.data?.name || '').toLowerCase(),
    options,
    focused,
    locale: String(body?.locale || 'en-US'),
    raw: body,
  }

  try {
    if (isAutocomplete) {
      return toResponse(bot.onAutocomplete ? await bot.onAutocomplete(interaction) : choices([]))
    }
    return toResponse(await bot.onCommand(interaction))
  } catch {
    /* Discord shows "the application did not respond" on a throw or a timeout,
       which reads as a broken bot rather than a service being briefly away.
       Say the true thing instead, quietly, to the person who asked. */
    return toResponse(note(`${bot.name} could not reach its data just then. Try again in a moment.`))
  }
}
