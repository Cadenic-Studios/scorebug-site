#!/usr/bin/env node
/**
 * SCOREBUG // REGISTER THE BOT'S SLASH COMMANDS
 *
 *   node scripts/register-discord-commands.mjs
 *
 * Run this once, and again whenever a command's name, description or options
 * change. It is idempotent: Discord replaces the whole set with what is sent.
 *
 * ── WHY THIS IS A SCRIPT AND NOT PART OF THE DEPLOY ────────────────────────
 * Registering commands needs the BOT TOKEN, which the website never should
 * have — the site only needs the PUBLIC KEY, and only to verify signatures.
 * Keeping registration here means the token stays in the operator's hands and
 * out of a deployment that serves public traffic.
 *
 * ── GLOBAL vs GUILD ────────────────────────────────────────────────────────
 * Global commands can take up to an hour to appear. Pass a guild id as the
 * first argument while testing and they appear immediately in that server:
 *   node scripts/register-discord-commands.mjs 1547638633601695786
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'functions');
let env = {};
try {
  env = Object.fromEntries(readFileSync(join(FN, '.secrets.local'), 'utf8').split('\n')
    .filter(l => /^[A-Z_0-9]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
} catch { /* fall through to the check below */ }

const APP_ID = env.DISCORD_APP_ID || process.env.DISCORD_APP_ID;
const TOKEN = env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!APP_ID || !TOKEN) {
  console.error('Need DISCORD_APP_ID and DISCORD_BOT_TOKEN in functions/.secrets.local');
  console.error('Both are on the Discord application page: General Information, and Bot.');
  process.exit(1);
}

const COMMANDS = [
  {
    name: 'rate',
    description: 'How fans graded a game, with the Scorebug card',
    type: 1,
    options: [{
      name: 'team',
      description: 'Team name or abbreviation, e.g. Oilers or EDM',
      type: 3,
      required: true,
      /* Typeahead over clubs that actually have a graded game, so the list can
         never suggest something that comes back empty. */
      autocomplete: true,
    }],
  },
  {
    name: 'slate',
    description: 'Tonight’s games, with the finished ones already rated',
    type: 1,
    options: [{
      name: 'league', description: 'Which league (defaults to NHL)', type: 3, required: false,
      choices: [
        { name: 'NHL', value: 'NHL' }, { name: 'NFL', value: 'NFL' },
        { name: 'NBA', value: 'NBA' }, { name: 'MLB', value: 'MLB' },
        { name: 'Premier League', value: 'EPL' }, { name: 'Champions League', value: 'UCL' },
        { name: 'MLS', value: 'MLS' }, { name: 'CFL', value: 'CFL' },
        { name: 'La Liga', value: 'LALIGA' }, { name: 'Serie A', value: 'SERIEA' },
        { name: 'Bundesliga', value: 'BUND' }, { name: 'Ligue 1', value: 'LIGUE1' },
      ],
    }],
  },
  {
    name: 'invite',
    description: 'Add the Scorebug bot to your own server',
    type: 1,
  },
  {
    name: 'best',
    description: 'The highest-graded games lately, out of 5.0',
    type: 1,
  },
  {
    name: 'find',
    description: 'Graded games for a team',
    type: 1,
    options: [{
      name: 'team', description: 'Team name or abbreviation', type: 3, required: true, autocomplete: true,
    }],
  },
  {
    name: 'league',
    description: 'Recently graded games in one league',
    type: 1,
    options: [{
      name: 'league', description: 'Which league', type: 3, required: true,
      choices: [
        { name: 'NHL', value: 'NHL' }, { name: 'NFL', value: 'NFL' },
        { name: 'NBA', value: 'NBA' }, { name: 'MLB', value: 'MLB' },
        { name: 'Premier League', value: 'EPL' }, { name: 'Champions League', value: 'UCL' },
        { name: 'MLS', value: 'MLS' }, { name: 'CFL', value: 'CFL' },
        { name: 'La Liga', value: 'LALIGA' }, { name: 'Serie A', value: 'SERIEA' },
        { name: 'Bundesliga', value: 'BUND' }, { name: 'Ligue 1', value: 'LIGUE1' },
      ],
    }],
  },
  {
    name: 'help',
    description: 'What Scorebug is, and where to get it',
    type: 1,
  },
];

/**
 * ── WHERE THE COMMANDS ARE ALLOWED TO RUN ──────────────────────────────────
 *
 * By default a slash command exists only inside servers that installed the
 * bot. That is one install per room, and every room needs an admin.
 *
 * `integration_types: [0, 1]` says the command works BOTH ways: 0 is the
 * classic server install, 1 is a user install — a person adds Scorebug to
 * their own account once and then has /rate everywhere they go, including in
 * servers where nobody has ever heard of us and in servers where they could
 * never get a bot approved.
 *
 * `contexts: [0, 1, 2]` is where it may be typed: a server, a DM with the bot,
 * and a group DM or any other channel the user can see.
 *
 * This costs nothing and is safe here for one specific reason: nothing in
 * lib/discord/core.ts or lib/discord/scorebug.ts reads guild_id, member,
 * roles or channel — every answer is computed from the command options alone.
 * A bot that needed server context would break the moment it ran in a DM.
 *
 * The catch: a GUILD-SCOPED registration rejects both fields (a command that
 * only exists in one server cannot also be user-installable). So they are
 * stripped when a guild id is passed for testing.
 */
const EVERYWHERE = { integration_types: [0, 1], contexts: [0, 1, 2] };

const guild = process.argv[2];
const url = guild
  ? `https://discord.com/api/v10/applications/${APP_ID}/guilds/${guild}/commands`
  : `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const payload = guild ? COMMANDS : COMMANDS.map(c => ({ ...c, ...EVERYWHERE }));

const res = await fetch(url, {
  method: 'PUT',
  headers: { authorization: `Bot ${TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const out = await res.text();
if (!res.ok) {
  console.error(`Discord answered ${res.status}:\n${out.slice(0, 800)}`);
  process.exit(1);
}
const made = JSON.parse(out);
console.log(`Registered ${made.length} command(s) ${guild ? `in guild ${guild} (instant)` : 'globally (up to an hour to appear)'}:`);
for (const c of made) console.log(`  /${c.name} — ${c.description}`);
if (!guild) {
  console.log('\nInstallable both ways: added to a server, or added to a single');
  console.log('user account and carried into every server and DM they are in.');
  console.log('For the second to be offered, User Install must also be ticked on');
  console.log('the Installation tab of the Discord application page.');
}
