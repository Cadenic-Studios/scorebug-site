#!/usr/bin/env node
/**
 * SCOREBUG // BUILD THE DISCORD SERVER
 *
 *   node scripts/setup-discord-server.mjs --dry-run     (see what it would do)
 *   node scripts/setup-discord-server.mjs               (do it)
 *
 * Creates the categories, channels, permissions, roles and the pinned welcome
 * post, from one definition. Idempotent: it reads what exists first and only
 * creates what is missing, so running it twice is safe and running it after you
 * have renamed something by hand will not fight you.
 *
 * ── WHY THIS IS A SCRIPT ───────────────────────────────────────────────────
 * Forty clicks through Discord's settings is forty chances to set one channel's
 * permissions differently from its neighbour, and no record of what was
 * intended. This file IS the record. When the second Cadenic server gets built,
 * the diff between the two is a list of channel names rather than a memory of
 * an afternoon.
 *
 * ── PERMISSIONS THIS NEEDS, AND GIVING THEM BACK ───────────────────────────
 * To create channels and roles the bot needs Manage Channels and Manage Roles —
 * far more than it should hold day to day. So: give it Administrator for the
 * five minutes this takes, run it, then take the role away. The bot's real job
 * needs Send Messages and nothing else, and a bot that keeps Administrator is a
 * standing invitation for a leaked token to become somebody else's server.
 * The last thing this prints is a reminder to do exactly that.
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
} catch { /* handled below */ }

const TOKEN = env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error('Need DISCORD_BOT_TOKEN in engine/functions/.secrets.local');
  process.exit(1);
}
const DRY = process.argv.includes('--dry-run');

const C = { g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', r: '\x1b[0m', b: '\x1b[1m', red: '\x1b[31m' };
const say = (s = '') => console.log(s);

/* ── Discord's permission bits, named. ─────────────────────────────────── */
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const ADD_REACTIONS = 1n << 6n;
const CREATE_PUBLIC_THREADS = 1n << 35n;
const SEND_MESSAGES_IN_THREADS = 1n << 38n;

const TEXT = 0, CATEGORY = 4;

/**
 * The server, as data.
 *
 * `readOnly` denies @everyone the ability to post but leaves reactions on:
 * an announcement channel people cannot react to feels broken, and a reaction
 * is the cheapest signal a lurker will ever give you.
 */
const LAYOUT = [
  {
    category: 'START HERE',
    channels: [
      { name: 'welcome', topic: 'What Scorebug is, and the one rule.', readOnly: true },
      { name: 'announcements', topic: 'Releases, new leagues, new features.', readOnly: true },
    ],
  },
  {
    category: 'THE GAMES',
    channels: [
      { name: 'the-slate', topic: 'Tonight’s games and last night’s results, posted automatically.', readOnly: true },
      { name: 'the-bleachers', topic: 'Arguing about what you just watched. The main room.' },
      { name: 'graded', topic: 'Share your cards — a game, a grade, and what it meant.' },
    ],
  },
  {
    category: 'THE APP',
    channels: [
      { name: 'bugs-and-ideas', topic: 'What is broken and what is missing. Testers especially.' },
      { name: 'bot', topic: 'Run /rate, /slate and /best in here so they stay out of the conversation.' },
    ],
  },
];

const ROLES = [
  { name: 'Founding Tester', color: 0xf85149, hoist: true, reason: 'the closed testers who were here first' },
  { name: 'Front Office', color: 0xe5b53c, hoist: true, reason: 'subscribers, later' },
];

const WELCOME = `# Scorebug

A logbook for the games you watch.

Log it, grade it out of **5.0**, say what it meant. Keep it forever.
19 leagues, live scores, and not one gambling ad — that part is permanent, not a phase.

**The app** — https://app.getscorebug.app
**Every game, rated** — https://getscorebug.app/game

## One rule

No betting talk. No odds, no spreads, no picks, no tout links.
It is the promise the whole product is built on, and it applies in here too.

## Try the bot

Head to <#BOT_CHANNEL> and run \`/rate\` with any team name — it will tell you how
fans graded their last game, and show you the card. \`/slate\` gives you tonight's
fixtures with the finished ones already rated out of 100.`;

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
  say(`${C.b}SCOREBUG · DISCORD SERVER SETUP${C.r}${DRY ? `  ${C.y}(dry run — nothing will change)${C.r}` : ''}\n`);

  const me = await api('GET', '/users/@me');
  say(`  bot: ${C.g}${me.username}${C.r}`);

  const guilds = await api('GET', '/users/@me/guilds');
  if (!guilds.length) {
    say(`\n${C.red}The bot is not in any server.${C.r}`);
    say('Add it first, with Administrator for setup:');
    say(`${C.d}  https://discord.com/oauth2/authorize?client_id=${me.id}&permissions=8&scope=bot+applications.commands${C.r}`);
    process.exit(1);
  }
  const guild = guilds.find(g => /scorebug/i.test(g.name)) || guilds[0];
  say(`  server: ${C.g}${guild.name}${C.r} (${guild.id})`);
  if (guilds.length > 1) say(`${C.d}  (in ${guilds.length} servers; picked this one by name)${C.r}`);
  say('');

  const existing = await api('GET', `/guilds/${guild.id}/channels`);
  const byName = new Map(existing.map(c => [c.name.toLowerCase(), c]));
  const everyone = guild.id;   // the @everyone role id is always the guild id

  let made = 0, kept = 0;
  const created = {};

  for (const group of LAYOUT) {
    let cat = existing.find(c => c.type === CATEGORY && c.name.toUpperCase() === group.category);
    if (!cat) {
      say(`  ${C.g}+${C.r} category ${group.category}`);
      if (!DRY) cat = await api('POST', `/guilds/${guild.id}/channels`, { name: group.category, type: CATEGORY });
      made++;
    } else {
      say(`  ${C.d}·${C.r} category ${group.category} ${C.d}already there${C.r}`);
      kept++;
    }

    for (const ch of group.channels) {
      const found = byName.get(ch.name);
      if (found) {
        say(`    ${C.d}·${C.r} #${ch.name} ${C.d}already there${C.r}`);
        created[ch.name] = found.id;
        kept++;
        continue;
      }
      say(`    ${C.g}+${C.r} #${ch.name}${ch.readOnly ? `  ${C.d}(read-only)${C.r}` : ''}`);
      made++;
      if (DRY) continue;
      const overwrites = ch.readOnly
        ? [{
            id: everyone, type: 0,
            allow: String(VIEW_CHANNEL | ADD_REACTIONS),
            deny: String(SEND_MESSAGES | CREATE_PUBLIC_THREADS | SEND_MESSAGES_IN_THREADS),
          }]
        : [];
      const c = await api('POST', `/guilds/${guild.id}/channels`, {
        name: ch.name, type: TEXT, topic: ch.topic,
        parent_id: cat ? cat.id : undefined,
        permission_overwrites: overwrites,
      });
      created[ch.name] = c.id;
    }
  }

  say('');
  const roles = await api('GET', `/guilds/${guild.id}/roles`);
  for (const r of ROLES) {
    if (roles.some(x => x.name.toLowerCase() === r.name.toLowerCase())) {
      say(`  ${C.d}·${C.r} role ${r.name} ${C.d}already there${C.r}`); kept++; continue;
    }
    say(`  ${C.g}+${C.r} role ${r.name} ${C.d}— ${r.reason}${C.r}`);
    made++;
    if (!DRY) await api('POST', `/guilds/${guild.id}/roles`, { name: r.name, color: r.color, hoist: r.hoist, mentionable: false });
  }

  /* The welcome post, only if the channel is empty. Never a second copy. */
  say('');
  const welcomeId = created.welcome;
  if (welcomeId && !DRY) {
    const msgs = await api('GET', `/channels/${welcomeId}/messages?limit=5`);
    if (msgs.length) {
      say(`  ${C.d}·${C.r} #welcome already has messages — left alone`);
    } else {
      const body = WELCOME.replace('<#BOT_CHANNEL>', created.bot ? `<#${created.bot}>` : '#bot');
      const posted = await api('POST', `/channels/${welcomeId}/messages`, { content: body, allowed_mentions: { parse: [] } });
      await api('PUT', `/channels/${welcomeId}/pins/${posted.id}`).catch(() => {});
      say(`  ${C.g}+${C.r} posted and pinned the welcome message`);
    }
  } else if (welcomeId) {
    say(`  ${C.g}+${C.r} would post and pin the welcome message`);
  }

  say(`\n${C.b}${made} created, ${kept} already in place.${C.r}`);
  if (DRY) { say(`${C.y}Dry run — nothing changed. Run again without --dry-run.${C.r}`); return; }

  say('');
  say(`${C.y}${C.b}Now take Administrator away from the bot.${C.r}`);
  say(`${C.d}  Server Settings → Roles → Scorebug → turn everything off except Send Messages.${C.r}`);
  say(`${C.d}  Its day job needs nothing more, and a bot holding Administrator turns a leaked${C.r}`);
  say(`${C.d}  token into somebody else's server.${C.r}`);
}

main().catch(e => { console.error(`\n${C.red}${e.message}${C.r}`); process.exit(1); });
