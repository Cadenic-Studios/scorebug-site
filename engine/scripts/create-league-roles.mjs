#!/usr/bin/env node
/**
 * SCOREBUG // ONE ROLE PER LEAGUE, FROM THE REGISTRY
 *
 *   node scripts/create-league-roles.mjs --dry-run    (see what it would do)
 *   node scripts/create-league-roles.mjs
 *
 * Idempotent. A role that already exists by name is left exactly as it is,
 * including its colour and its position, so running this again after somebody
 * has reordered the role list changes nothing.
 *
 * ── WHY NINETEEN AND NOT SEVEN ──────────────────────────────────────────────
 *
 * The first version of this list was hand-written and had seven entries: NHL,
 * NFL, NBA, MLB, Soccer, F1, CFL. That list is wrong twice over.
 *
 * It is wrong by omission. Scorebug covers nineteen leagues. Collapsing twelve
 * of them into the single word "Soccer" tells a Premier League supporter that
 * their competition is a category, and tells an IPL viewer — of a league with
 * an audience larger than most of the ones that DID get a role — that theirs
 * does not exist here. A fan who opens the onboarding screen and cannot find
 * their league has been told, in the first ten seconds, that this is not for
 * them. Nineteen options is not a longer form; it is the moment somebody
 * thinks "oh, they actually have mine".
 *
 * It is also wrong by vocabulary. "Soccer" is the North American word, and
 * this is a global product — but "Football" cannot be the fix either, because
 * it already means the NFL and the CFL here. The registry solved this long
 * ago and the hand-written list ignored the solution: LEAGUES are named, not
 * sports. "Premier League", "J.League", "NFL", "CFL" are unambiguous in every
 * English-speaking market on earth, and the word soccer never has to be
 * printed at all. That is why this file reads the registry instead of holding
 * its own list.
 *
 * ── WHAT THE ROLES ARE FOR ──────────────────────────────────────────────────
 *
 * Two things. Immediately: onboarding hands them out, so a member sees a
 * server shaped like their own interests instead of nineteen leagues of noise.
 * Soon after: they are mentionable, which lets the engine ping @NHL when a
 * game finishes above a rating threshold AND IS STILL ON — "that one is a 94,
 * third period, go" — which is the one thing a community can do that no scores
 * app can, and the reason to build this now rather than when it is needed.
 *
 * ── PERMISSIONS ─────────────────────────────────────────────────────────────
 * This needs Manage Roles and nothing else — NOT Administrator. The server
 * build script asked for Administrator because it also creates channels and
 * writes a pinned message; this one only touches roles, so tick the one box,
 * run it, untick it. A narrower grant is not politeness, it is the difference
 * between a leaked token being embarrassing and being somebody else's server.
 *
 * Discord also refuses to create a role ABOVE the bot's own highest role. If
 * this fails with a 403 and the permission is set, drag the Scorebug role up
 * the list in Server Settings → Roles and run it again.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUES } from '../functions/dispatch/leagues.js';

const FN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'functions');
let env = {};
try {
  env = Object.fromEntries(readFileSync(join(FN, '.secrets.local'), 'utf8').split('\n')
    .filter(l => /^[A-Z_0-9]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
} catch { /* handled below */ }

const TOKEN = env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error('Need DISCORD_BOT_TOKEN in engine/functions/.secrets.local');
  process.exit(1);
}
const DRY = process.argv.includes('--dry-run');

const C = { g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', r: '\x1b[0m', b: '\x1b[1m', red: '\x1b[31m' };
const say = (s = '') => console.log(s);

/**
 * League colours, mirrored from the SITE registry (app/leagues.ts).
 *
 * This is the one thing not imported, because the site's registry is
 * TypeScript and this script is a plain module in another package. It is
 * therefore the one thing that can drift — so the check below refuses to run
 * if this map and the engine registry ever stop describing the same nineteen
 * leagues, rather than silently giving a new league Discord's default grey.
 */
const COLOUR = {
  NHL: 0x58A6FF, NFL: 0xA371F7, NBA: 0xF78166, MLB: 0xD29922, F1: 0xE10600,
  IPL: 0x7E22CE, CFL: 0x10B981, NCAAF: 0xEC4899, NCAAB: 0xEA580C,
  EPL: 0x963CFF, UCL: 0x4453D6, LALIGA: 0xE11D48, SERIEA: 0x0EA5E9,
  BUND: 0x84CC16, LIGUE1: 0xF59E0B, MLS: 0x00B2A9, CSL: 0xC026D3,
  ISL: 0xFF9933, JLEAGUE: 0xBC002D,
};

/** "college football" → "College Football". Every other registry name is already set. */
const title = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const ROLES = LEAGUES.map((l) => ({ id: l.id, name: title(l.name), color: COLOUR[l.id] }));

/**
 * Roles created by the earlier, worse seven-role list.
 *
 * RENAMED, not recreated. If a role called "F1" already exists, somebody may
 * be holding it, and deleting it to make "Formula 1" would silently take the
 * league away from every member who had already chosen it. A rename keeps the
 * role id, so every assignment survives and the member never notices.
 */
const SUPERSEDED = { f1: 'Formula 1' };

/**
 * Roles the registry has no equivalent for, because they were a category
 * rather than a league.
 *
 * REPORTED, never deleted. "Soccer" stood in for twelve competitions, and a
 * script that quietly removes a role is a script that removes the wrong one
 * eventually. Whoever is holding it should be told to pick their actual
 * leagues before it goes, and that is a decision for a person.
 */
const RETIRED = ['Soccer'];

const uncoloured = ROLES.filter((r) => r.color === undefined).map((r) => r.id);
if (uncoloured.length) {
  console.error(`${C.red}The colour map is behind the registry.${C.r}`);
  console.error(`No colour for: ${uncoloured.join(', ')}`);
  console.error(`Add them from scorebug-site/app/leagues.ts and run again. A league`);
  console.error(`without a colour would be created in Discord's default grey, which`);
  console.error(`is the kind of thing nobody notices until every role is grey.`);
  process.exit(1);
}

/* ── the thinnest possible Discord client ──────────────────────────────── */
const API = 'https://discord.com/api/v10';
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bot ${TOKEN}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 429) {
    const j = await res.json().catch(() => ({ retry_after: 2 }));
    const wait = Math.ceil((j.retry_after || 2) * 1000) + 250;
    say(`${C.d}   rate limited, waiting ${wait}ms${C.r}`);
    await new Promise(r => setTimeout(r, wait));
    return api(method, path, body);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  say(`${C.b}SCOREBUG · LEAGUE ROLES${C.r}${DRY ? `  ${C.y}(dry run — nothing will change)${C.r}` : ''}\n`);

  const guilds = await api('GET', '/users/@me/guilds');
  if (!guilds.length) {
    say(`${C.red}The bot is not in any server.${C.r}`);
    say(`${C.d}Add it first — see getscorebug.app/discord.${C.r}`);
    process.exit(1);
  }
  const guild = guilds.find(g => /scorebug/i.test(g.name)) || guilds[0];
  say(`  server: ${C.g}${guild.name}${C.r} (${guild.id})`);
  if (guilds.length > 1) say(`${C.d}  (in ${guilds.length} servers; picked this one by name)${C.r}`);
  say('');

  const existing = await api('GET', `/guilds/${guild.id}/roles`);
  const byName = new Map(existing.map(r => [r.name.toLowerCase(), r]));

  /* Rename before creating, so the pass below sees the new name and does not
     make a second role beside it. */
  let renamed = 0;
  for (const [oldName, newName] of Object.entries(SUPERSEDED)) {
    const role = byName.get(oldName);
    if (!role || byName.has(newName.toLowerCase())) continue;
    const colour = ROLES.find(r => r.name === newName)?.color;
    say(`  ${C.y}~${C.r} ${role.name} ${C.d}→${C.r} ${newName} ${C.d}(renamed; members keep it)${C.r}`);
    renamed++;
    if (!DRY) await api('PATCH', `/guilds/${guild.id}/roles/${role.id}`, { name: newName, color: colour, mentionable: true });
    byName.set(newName.toLowerCase(), { ...role, name: newName });
  }

  let made = 0, kept = 0;
  for (const role of ROLES) {
    if (byName.has(role.name.toLowerCase())) {
      say(`  ${C.d}·${C.r} ${role.name} ${C.d}already there${C.r}`);
      kept++;
      continue;
    }
    say(`  ${C.g}+${C.r} ${role.name}`);
    made++;
    if (!DRY) {
      /* hoist:false — nineteen hoisted roles would turn the member list into a
         table of contents. mentionable:true is the whole point: it is what lets
         the engine ping a league when a game is worth interrupting someone for. */
      await api('POST', `/guilds/${guild.id}/roles`, {
        name: role.name,
        color: role.color,
        hoist: false,
        mentionable: true,
      });
    }
  }

  say(`\n${C.b}${made} created, ${renamed} renamed, ${kept} already in place.${C.r}`);

  const stale = RETIRED.filter(n => byName.has(n.toLowerCase()));
  if (stale.length) {
    say('');
    say(`${C.y}Left alone, and worth removing by hand: ${stale.join(', ')}${C.r}`);
    say(`${C.d}  These were categories, not leagues, and the real leagues now exist above.${C.r}`);
    say(`${C.d}  Not deleted here: somebody may be holding one, and a script that quietly${C.r}`);
    say(`${C.d}  removes a role removes the wrong one eventually. Server Settings → Roles.${C.r}`);
  }
  if (DRY) { say(`${C.y}Dry run — nothing changed. Run again without --dry-run.${C.r}`); return; }

  say('');
  say(`${C.y}Next: Server Settings → Onboarding → a multi-select question${C.r}`);
  say(`${C.d}  "Which do you follow?" with one answer per role above. Optional, never required.${C.r}`);
  say('');
  say(`${C.y}${C.b}Then take Manage Roles away from the bot again.${C.r}`);
  say(`${C.d}  Server Settings → Roles → Scorebug → everything off except Send Messages.${C.r}`);
}

main().catch(e => { console.error(`\n${C.red}${e.message}${C.r}`); process.exit(1); });
