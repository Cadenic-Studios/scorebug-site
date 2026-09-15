#!/usr/bin/env node
/**
 * SCOREBUG // DOES EVERY CREDENTIAL ACTUALLY WORK?
 *
 *   node scripts/check-credentials.mjs
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * Every network client in this engine was written against published API docs
 * and asserted against test vectors, because for weeks there were no real
 * tokens to try. That is a perfectly good way to build and a terrible way to
 * find out you were wrong — a request shape that is subtly off fails at 07:00
 * on the first live morning, looking like a bug in the orchestrator.
 *
 * This calls each service for real, READ-ONLY, and reports what came back. It
 * proves three separate things a secrets file cannot:
 *   • the credential is present AND complete (a truncated paste fails here,
 *     not in production three days later);
 *   • it has the PERMISSION the engine needs — X in particular hands out
 *     read-only tokens that authenticate perfectly and refuse to post;
 *   • our request shape is right, since a 200 means the service understood it.
 *
 * Nothing here posts, sends, charges or changes anything. The Discord check
 * fetches the webhook's own metadata rather than posting to the channel; the
 * Anthropic check lists models, which is not billed.
 *
 * Re-run it after rotating anything.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FN = resolve(HERE, '..', 'functions');
const { oauth1Header } = await import(pathToFileURL(join(FN, 'dispatch', 'publish.js')).href);

let env = {};
try {
  env = Object.fromEntries(readFileSync(join(FN, '.secrets.local'), 'utf8').split('\n')
    .filter(l => /^[A-Z_0-9]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
} catch {
  console.error('No functions/.secrets.local — nothing to check.');
  process.exit(1);
}

const C = { r: '\x1b[0m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', red: '\x1b[31m', b: '\x1b[1m' };
const rows = [];
const say = (name, state, detail) => {
  const tag = state === 'ok' ? `${C.g}  ok  ${C.r}` : state === 'skip' ? `${C.d} skip ${C.r}` : `${C.red} FAIL ${C.r}`;
  console.log(`${tag} ${name.padEnd(22)} ${detail}`);
  rows.push({ name, state });
};

async function check(name, need, fn) {
  const missing = need.filter(k => !env[k]);
  if (missing.length) return say(name, 'skip', `${C.d}not configured: ${missing.join(', ')}${C.r}`);
  try { await fn(); } catch (e) { say(name, 'fail', `${C.red}${String(e.message).slice(0, 140)}${C.r}`); }
}

/* ── X ─────────────────────────────────────────────────────────────────────
   The access level header is the whole point. X stamps the permission onto the
   token when it is generated, so an app set to Read and Write AFTER the token
   was made still hands out a read-only token — which authenticates, returns
   200 here, and then refuses the first real post. */
await check('X', ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'], async () => {
  const url = 'https://api.x.com/2/users/me';
  const res = await fetch(url, { headers: { authorization: oauth1Header({
    method: 'GET', url,
    consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET,
  }) } });
  const level = res.headers.get('x-access-level') || '';
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 120)}`);
  if (!/write/.test(level)) throw new Error(`token is ${level || 'read-only'} — regenerate it AFTER setting Read and Write`);
  const extra = /directmessages/.test(level) ? `  ${C.y}(scope includes DMs — narrower would be safer)${C.r}` : '';
  say('X', 'ok', `@${body?.data?.username} · ${level}${extra}`);
});

/* ── Bluesky ── createSession is exactly how the engine logs in. */
await check('Bluesky', ['BSKY_HANDLE', 'BSKY_APP_PASSWORD'], async () => {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: env.BSKY_HANDLE, password: env.BSKY_APP_PASSWORD }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.error || ''} ${b.message || ''}`);
  say('Bluesky', 'ok', `@${b.handle}${b.emailConfirmed === false ? `  ${C.y}(email NOT confirmed — cannot post)${C.r}` : ''}`);
});

/* ── Mastodon ── the scopes line tells us whether it may post. */
await check('Mastodon', ['MASTODON_BASE', 'MASTODON_TOKEN'], async () => {
  const base = env.MASTODON_BASE.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
    headers: { authorization: `Bearer ${env.MASTODON_TOKEN}` },
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.error || ''}`);
  say('Mastodon', 'ok', `@${b.username}@${new URL(base).host}`);
});

/* ── Discord ── GET returns the webhook's own record. It does not post. */
await check('Discord', ['DISCORD_WEBHOOK_URL'], async () => {
  const res = await fetch(env.DISCORD_WEBHOOK_URL);
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.message || ''}`);
  say('Discord', 'ok', `webhook "${b.name}" → channel ${b.channel_id}`);
});

/* ── Resend ── listing domains also tells us whether the sending domain is verified. */
await check('Resend', ['RESEND_API_KEY'], async () => {
  const res = await fetch('https://api.resend.com/domains', {
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.message || b.name || ''}`);
  const list = Array.isArray(b.data) ? b.data : [];
  const verified = list.filter(d => d.status === 'verified').map(d => d.name);
  if (!list.length) throw new Error('key works, but NO sending domain is added yet — the weekly letter cannot send');
  if (!verified.length) throw new Error(`domain(s) added but not verified: ${list.map(d => `${d.name} (${d.status})`).join(', ')}`);
  say('Resend', 'ok', `verified: ${verified.join(', ')}`);
});

/* ── Anthropic ── listing models is not billed. */
await check('Anthropic', ['ANTHROPIC_API_KEY'], async () => {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b?.error?.message || ''}`);
  say('Anthropic', 'ok', `key live · ${b?.data?.[0]?.id || 'models readable'}`);
});

/* ── Supabase ── the anon key against a SECURITY DEFINER aggregate. */
await check('Supabase', ['SUPABASE_URL', 'SUPABASE_ANON_KEY'], async () => {
  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/rest/v1/rpc/engine_counts`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: '{}',
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.message || b.hint || ''}`);
  const r = Array.isArray(b) ? b[0] : b;
  say('Supabase', 'ok', `${r?.fans ?? '?'} accounts · ${r?.logs_all ?? '?'} logs · ${r?.signups_android ?? '?'} on the waitlist`);
});

/* ── Supabase, the engine key ── proves the SQL insert actually ran. */
await check('Engine key in DB', ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ENGINE_KEY'], async () => {
  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/rest/v1/rpc/engine_newsletter_recipients`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_key: env.ENGINE_KEY }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${b.message || b.hint || ''}`);
  const n = Array.isArray(b) ? b.length : 0;
  /* The function returns zero rows for a WRONG key and zero rows for an empty
     list, so a 0 here is not proof of anything on its own — it is only a
     failure if you know people have opted in. */
  say('Engine key in DB', 'ok', n > 0 ? `${n} consented recipient(s)` : `${C.d}0 recipients (correct key, or nobody has opted in yet)${C.r}`);
});

const failed = rows.filter(r => r.state === 'fail').length;
const skipped = rows.filter(r => r.state === 'skip').length;
console.log(`\n${C.b}${rows.length - failed - skipped} live, ${skipped} not configured, ${failed} failing${C.r}`);
process.exit(failed ? 1 : 0);
