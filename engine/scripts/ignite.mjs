#!/usr/bin/env node
/**
 * SCOREBUG // IGNITION
 *
 *   node scripts/ignite.mjs            do everything
 *   node scripts/ignite.mjs --check    report what would happen, change nothing
 *   node scripts/ignite.mjs --secrets  secrets only, no deploy
 *   node scripts/ignite.mjs --deploy   deploy only, assume secrets are set
 *   node scripts/ignite.mjs --verify   verify a running engine, change nothing
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Bringing the engine up by hand is twenty-four `firebase functions:secrets:set`
 * prompts, an .env file, a deploy, three Vercel variables, a Firestore document
 * and four verification calls. Every one of those is a place to fat-finger a
 * value that then fails silently — a DISPATCH_KEY that differs by one character
 * between Firebase and Vercel produces a 401 that shows up only as a beat that
 * never fires, days later, with nothing in any log that says why.
 *
 * So it is one script, it is idempotent, and it verifies rather than assumes.
 *
 * ── WHERE THE VALUES COME FROM ──────────────────────────────────────────────
 *
 * functions/.secrets.local — gitignored, never committed, never printed. One
 * KEY=value per line. GOOGLE_SERVICE_ACCOUNT is special: give it a PATH to the
 * downloaded JSON key and the file's contents are sent, so a private key never
 * has to be pasted into anything.
 *
 * Secret values are passed to the Firebase CLI on stdin. They are not written
 * to a temp file, not put in argv (where any process on the machine can read
 * them out of the process list), and not echoed. The only place this script
 * prints a secret is nowhere.
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
const readFileSyncUtf8 = (p) => readFileSync(p, 'utf8');
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');      // scorebug-site/engine
const SITE_DIR = resolve(ROOT, '..');                                        // scorebug-site (the Vercel project)
const SECRETS_FILE = join(ROOT, 'functions', '.secrets.local');
/** The Firebase project, from .firebaserc so one file owns the name. */
const PROJECT = (() => {
  try { return JSON.parse(readFileSyncUtf8(join(ROOT, '.firebaserc'))).projects.default; } catch { return 'scorebug-engine'; }
})();

/**
 * Must match UNSET_SENTINEL in functions/dispatch/index.js.
 *
 * Firebase refuses to deploy while a DECLARED secret has no value, and
 * `--non-interactive` cannot prompt. Rather than fight that, every name without
 * a real value gets this, so all of them exist and the deploy always proceeds.
 * The runtime treats it as absent, so the capability stays off exactly as if
 * the secret had never been created — and the digest still names it.
 */
const UNSET_SENTINEL = '__scorebug_unset__';

/**
 * The ops endpoint before the first deploy has told us its real address.
 *
 * Firebase will not deploy non-interactively while a declared param has no
 * value, and an empty string counts as none — so "we find out after the first
 * deploy" is not an option the CLI offers. This is the deterministic
 * cloudfunctions.net alias, which is correct and working; the real URL from the
 * deploy output replaces it immediately afterwards.
 */
const PREDICTED_OPS_URL = `https://us-central1-${PROJECT}.cloudfunctions.net/dispatchOps`;

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const ONLY_CHECK = has('check');
const ONLY_VERIFY = has('verify');
const DO_SECRETS = !ONLY_VERIFY && (has('secrets') || (!has('deploy') && !ONLY_CHECK));
const DO_DEPLOY = !ONLY_VERIFY && (has('deploy') || (!has('secrets') && !ONLY_CHECK));

const C = { r: '\x1b[0m', b: '\x1b[1m', dim: '\x1b[2m', g: '\x1b[32m', y: '\x1b[33m', red: '\x1b[31m', c: '\x1b[36m' };
const isWin = process.platform === 'win32';
const say = (m = '') => console.log(m);
const ok = (m) => say(`  ${C.g}✓${C.r} ${m}`);
const warn = (m) => say(`  ${C.y}!${C.r} ${m}`);
const bad = (m) => say(`  ${C.red}✗${C.r} ${m}`);
const head = (m) => say(`\n${C.b}${C.c}${m}${C.r}\n${C.dim}${'─'.repeat(m.length)}${C.r}`);

let problems = 0;
/** Set when the deploy left functions missing; the closing banner must not claim success. */
let DEPLOY_INCOMPLETE = false;
const fail = (m) => { bad(m); problems += 1; };

/* ────────────────────────────────────────────────────────── PROCESS ── */

/**
 * Spawn a CLI, cross-platform.
 *
 * ── WHY shell:true ON WINDOWS ───────────────────────────────────────────────
 *
 * `firebase` and `vercel` on Windows are .cmd shims, and since Node's fix for
 * CVE-2024-27980 the runtime REFUSES to spawn a batch file without a shell —
 * it throws EINVAL before the process starts, with an error that names neither
 * the command nor the reason. Passing `firebase.cmd` explicitly does not help;
 * the block is on batch files as a class.
 *
 * So Windows goes through cmd.exe, which also fixes PATHEXT resolution for
 * free. The safety that the CVE fix was protecting is preserved a different
 * way: every argument is checked against a shell-metacharacter guard below, and
 * secret VALUES never travel in argv at all — they go over stdin, which the
 * shell passes through untouched.
 */
const SHELL_UNSAFE = /[&|<>^"'`\n\r%!]/;

function run(cmd, cmdArgs, { stdin, quiet = false, cwd, env } = {}) {
  const dangerous = cmdArgs.find((a) => SHELL_UNSAFE.test(String(a)));
  if (isWin && dangerous) {
    return Promise.resolve({ code: -1, out: '', err: `refusing to shell-quote an argument containing shell metacharacters: ${dangerous}` });
  }
  return new Promise((res) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: [stdin === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
      shell: isWin,
      cwd,
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; if (!quiet) process.stdout.write(d); });
    child.stderr.on('data', (d) => { err += d; if (!quiet) process.stderr.write(d); });
    child.on('error', (e) => res({ code: -1, out, err: e.message }));
    child.on('close', (code) => res({ code, out, err }));
    if (stdin !== undefined) {
      // A CLI that exits early closes the pipe; without this the whole script
      // dies on an unhandled EPIPE instead of reporting which secret failed.
      child.stdin.on('error', () => {});
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/* Some Windows setups only resolve the CLI through a shell. */
async function runShell(line, cwd) {
  return new Promise((res) => {
    const child = spawn(line, { shell: true, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => res({ code: -1, out, err: e.message }));
    child.on('close', (code) => res({ code, out, err }));
  });
}

/* ────────────────────────────────────────────────────────── SECRETS ── */

/**
 * Parse KEY=value lines. Values are taken verbatim after the first `=`, so a
 * base64 blob or a token containing `=` survives; surrounding quotes are
 * stripped because half the world's .env files have them and half do not.
 */
async function readSecretsFile() {
  if (!existsSync(SECRETS_FILE)) return null;
  const raw = await readFile(SECRETS_FILE, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) out[k] = v;
  }
  return out;
}

/**
 * GOOGLE_SERVICE_ACCOUNT may be a path to the downloaded JSON. Resolving it
 * here means the private key is read from disk and streamed to the CLI, and
 * never appears in the secrets file, the terminal or the shell history.
 */
async function readKeyFile(path) {
  const text = await readFile(path, 'utf8');
  try {
    const j = JSON.parse(text);
    if (j.type !== 'service_account' || !j.private_key || !j.client_email) return null;
    return { text, email: j.client_email, project: j.project_id, path };
  } catch {
    return null;
  }
}

/**
 * Find the service-account key.
 *
 * The console does not let you name the download: it arrives as
 * `<project>-<keyid>.json`, e.g. delta-v-b4837-e64910e9792a.json. Insisting on
 * a specific filename means the first run always fails on a file that is
 * sitting right there, so the configured path is tried first and then the
 * folder is searched for anything that IS a service-account key — identified by
 * its contents, not its name.
 */
async function resolveServiceAccount(value) {
  if (value && value.trimStart().startsWith('{')) return value;

  if (value) {
    const path = isAbsolute(value) ? value : resolve(ROOT, value);
    try {
      await access(path);
      const k = await readKeyFile(path);
      if (k) return k.text;
      return { error: `${path} exists but is not a service-account key` };
    } catch { /* fall through to the search */ }
  }

  const { readdir } = await import('node:fs/promises');
  const seen = [];
  for (const dir of [ROOT, join(ROOT, 'functions'), join(ROOT, 'secrets')]) {
    let entries = [];
    try { entries = await readdir(dir); } catch { continue; }
    for (const e of entries) {
      if (!e.toLowerCase().endsWith('.json')) continue;
      const k = await readKeyFile(join(dir, e));
      if (k) seen.push(k);
    }
  }

  if (seen.length === 1) return { text: seen[0].text, found: seen[0] };
  if (seen.length > 1) {
    return { error: `found ${seen.length} service-account keys (${seen.map((k) => k.path).join(', ')}) — set GOOGLE_SERVICE_ACCOUNT in .secrets.local to the one you want` };
  }
  return { error: value
    ? `no service-account key at ${value}, and none found in the project folder`
    : 'GOOGLE_SERVICE_ACCOUNT is not set and no key was found in the project folder' };
}

const SECRET_NAMES = [
  'BSKY_HANDLE', 'BSKY_APP_PASSWORD', 'BSKY_DISPLAY_HANDLE', 'MASTODON_BASE', 'MASTODON_TOKEN',
  'THREADS_USER_ID', 'THREADS_TOKEN', 'IG_USER_ID', 'IG_TOKEN',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'X_HANDLE',
  'ANTHROPIC_API_KEY', 'RESEND_API_KEY',
  'OPS_SECRET', 'GOOGLE_SERVICE_ACCOUNT', 'PLAY_BUCKET', 'PLAY_PACKAGE',
  'GA4_PROPERTY_ID', 'INDEXNOW_KEY',
  'DISPATCH_KEY', 'SITE_BASE_URL', 'DISCORD_WEBHOOK_URL',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ENGINE_KEY',
];

/** The eight without which turning it on is not worth doing. */
const CORE = ['BSKY_HANDLE', 'BSKY_APP_PASSWORD', 'DISPATCH_KEY', 'SITE_BASE_URL',
  'OPS_SECRET', 'RESEND_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];

async function setSecret(name, value) {
  const r = await run('firebase', ['functions:secrets:set', name, '--project', PROJECT, '--data-file', '-', '--force'],
    { stdin: value, quiet: true });
  if (r.code === 0) return { ok: true };
  // Older CLI builds reject --force; retry without it.
  if (/unknown option|--force/i.test(r.err)) {
    const r2 = await run('firebase', ['functions:secrets:set', name, '--project', PROJECT, '--data-file', '-'],
      { stdin: value, quiet: true });
    if (r2.code === 0) return { ok: true };
    return { ok: false, error: r2.err.trim().split('\n').slice(-3).join(' ') };
  }
  return { ok: false, error: r.err.trim().split('\n').slice(-3).join(' ') };
}

/* ────────────────────────────────────────────────────────── MAIN ── */

/**
 * ── THE DISCOVERY BUDGET ───────────────────────────────────────────────────
 *
 * Before deploying, the CLI loads functions/index.js purely to read which
 * functions it exports, and gives that ten seconds. It is not running anything
 * — it just wants the list. On a machine where node_modules is slow to read,
 * `firebase-functions/v2/https` alone can eat the whole budget, and the deploy
 * dies with "Cannot determine backend specification. Timeout after 10000",
 * which reads like broken code and is not.
 *
 * The module graph has been trimmed hard for this — Firestore, Storage and the
 * root firebase-functions barrel are all loaded on first use instead of at
 * import, taking discovery from 26 seconds to about 9. That is under the limit
 * and far too close to it to trust on someone else's disk, so the documented
 * override goes up as well. It costs nothing when discovery is fast.
 */
const DEPLOY_ENV = { FUNCTIONS_DISCOVERY_TIMEOUT: '120' };

async function main() {
  say(`${C.b}SCOREBUG IGNITION${C.r}  ${C.dim}project ${PROJECT}${C.r}`);

  /* ── 1. Tooling ─────────────────────────────────────────────────── */
  head('01 · TOOLING');
  const fb = await runShell('firebase --version');
  if (fb.code !== 0) {
    fail('firebase CLI not found. Install it: npm i -g firebase-tools');
    say(`\n${C.red}Cannot continue without it.${C.r}`);
    process.exit(1);
  }
  ok(`firebase CLI ${fb.out.trim().split('\n').pop()}`);

  const who = await runShell('firebase login:list');
  if (/No authorized accounts|not logged in/i.test(who.out + who.err)) {
    fail('firebase CLI is not logged in. Run: firebase login');
    process.exit(1);
  }
  ok(`logged in — ${(who.out.match(/[\w.+-]+@[\w.-]+/) || ['(account found)'])[0]}`);

  const vc = await runShell('vercel --version');
  const hasVercel = vc.code === 0;
  if (hasVercel) ok(`vercel CLI ${vc.out.trim().split('\n').pop()}`);
  else warn('vercel CLI not found — site variables will be listed for you to set by hand');

  /* ── 2. Secrets ─────────────────────────────────────────────────── */
  /* ── WHEN THERE IS NO FILE ────────────────────────────────────────────────
     This used to exit. That was wrong, and specifically wrong: the last thing
     this script does is OFFER TO DELETE the secrets file, on the correct
     grounds that Secret Manager now holds everything. Taking that offer then
     bricked every future run — the script refusing to work because you followed
     its own advice.
     A missing file is not a missing secret. It means there is nothing new to
     push, so the run continues with nothing to push: the probe below finds what
     Secret Manager already holds, the functions deploy against it, and only the
     steps that genuinely need a plaintext value (writing Vercel variables,
     calling the ops endpoint) stand down with a line saying so. */
  const secretsFromFile = await readSecretsFile();
  const secrets = secretsFromFile || {};
  const haveFile = !!secretsFromFile;

  head('02 · SECRETS');
  if (!haveFile) {
    warn(`no ${SECRETS_FILE} — nothing new to push`);
    say(`  ${C.dim}Whatever is already in Secret Manager is what the functions will bind.${C.r}`);
    say(`  ${C.dim}To change a value later, put it back in that file and run this again.${C.r}`);
    say('');
  }
  if (haveFile) {
    const missingCore = CORE.filter((k) => !secrets[k]);
    const present = SECRET_NAMES.filter((k) => secrets[k]);
    say(`  ${present.length} of ${SECRET_NAMES.length} values present in .secrets.local`);
    if (missingCore.length) warn(`core values still missing: ${missingCore.join(', ')}`);
    else ok('every core value is present');
  }

  const saRaw = secrets.GOOGLE_SERVICE_ACCOUNT;
  let saJson = null;
  {
    const r = await resolveServiceAccount(saRaw);
    if (typeof r === 'string') {
      saJson = r;
      ok(`service account key read (${(saJson.length / 1024).toFixed(1)} KB)`);
    } else if (r && r.text) {
      saJson = r.text;
      ok(`service account key found: ${r.found.path}`);
      ok(`  ${r.found.email} · project ${r.found.project}`);
    } else if (r && r.error) {
      if (haveFile) {
        fail(r.error);
        warn('without it: no installs, no ratings, no review replies, no site traffic in the digest');
      } else {
        say(`  ${C.dim}service account key not re-read — the deployed one stays bound${C.r}`);
      }
    }
  }

  /* Names this deployment will be able to bind. Everything else gets the
     sentinel below so the deploy can proceed — see dispatch/index.js. */
  const available = new Set(
    SECRET_NAMES.filter((n) => (n === 'GOOGLE_SERVICE_ACCOUNT' ? saJson : secrets[n]))
  );

  if (DO_SECRETS && !ONLY_CHECK) {
    say('');
    for (const name of SECRET_NAMES) {
      const value = name === 'GOOGLE_SERVICE_ACCOUNT' ? saJson : secrets[name];
      if (!value) continue;
      process.stdout.write(`  ${C.dim}setting${C.r} ${name.padEnd(24)}`);
      const r = await setSecret(name, value);
      say(r.ok ? `${C.g}ok${C.r}` : `${C.red}FAILED${C.r} ${r.error}`);
      if (r.ok) available.add(name);
      else { available.delete(name); problems += 1; }
    }
  } else if (ONLY_CHECK) {
    say(`  ${C.dim}(--check: nothing was written)${C.r}`);
  }

  /* A secret set by hand, outside .secrets.local, still counts. Only the names
     the file does not carry are probed, so this costs a few seconds rather than
     twenty-four round trips. */
  if (!ONLY_CHECK) {
    const unknown = SECRET_NAMES.filter((n) => !available.has(n));
    if (unknown.length) {
      process.stdout.write(`  ${C.dim}checking Secret Manager for ${unknown.length} name(s) not in the file…${C.r}`);
      let found = 0;
      for (const n of unknown) {
        const r = await run('firebase', ['functions:secrets:get', n, '--project', PROJECT], { quiet: true });
        if (r.code === 0 && !/not found|does not exist/i.test(r.out + r.err)) { available.add(n); found += 1; }
      }
      say(found ? ` ${C.g}${found} already in Secret Manager${C.r}` : ` ${C.dim}none${C.r}`);
    }
  }

  const declared = SECRET_NAMES.filter((n) => available.has(n));
  const undeclared = SECRET_NAMES.filter((n) => !available.has(n));
  /* A name already in Secret Manager might hold a real value or a placeholder
     from a previous run — telling them apart would mean reading the value back,
     which prints it. So this counts what the deployment can BIND, and the engine
     decides at runtime which of those are real. The digest's health block is the
     honest report of what is actually configured. */
  say(`\n  ${declared.length} secret(s) available to bind (${SECRET_NAMES.filter((n) => secrets[n] || (n === 'GOOGLE_SERVICE_ACCOUNT' && saJson)).length} from this file)`);

  /* Everything else gets a sentinel so the deploy can proceed. This is the
     mechanism that actually unblocks it — see the long note in
     functions/dispatch/index.js for the one that did not. */
  if (undeclared.length && !ONLY_CHECK && !ONLY_VERIFY) {
    say(`  ${C.dim}${undeclared.length} name(s) have no value; creating placeholders so the deploy can proceed${C.r}`);
    for (const name of undeclared) {
      process.stdout.write(`  ${C.dim}placeholder${C.r} ${name.padEnd(24)}`);
      const r = await setSecret(name, UNSET_SENTINEL);
      say(r.ok ? `${C.dim}ok${C.r}` : `${C.red}FAILED${C.r} ${r.error}`);
      if (!r.ok) problems += 1;
    }
    say(`  ${C.dim}these read as absent at runtime — the capability stays off and the digest names it${C.r}`);
  } else if (undeclared.length) {
    say(`  ${C.dim}would create placeholders for: ${undeclared.join(', ')}${C.r}`);
  }

  /* ── 3. functions/.env ──────────────────────────────────────────── */
  head('03 · FUNCTION ENVIRONMENT');
  const envPath = join(ROOT, 'functions', '.env');

  /* An ops URL already written by a previous run counts. Without this the file
     is reset to the alias on every run and the script redeploys a second time
     to fix a URL it had just discarded — which would make "idempotent" false in
     the one way that costs two minutes each time. */
  let opsUrlFromEnv = '';
  try {
    const prev = await readFile(envPath, 'utf8');
    opsUrlFromEnv = (/^DISPATCH_OPS_URL=(.+)$/m.exec(prev) || [, ''])[1].trim();
  } catch { /* no .env yet */ }
  const opsUrlKnown = secrets.DISPATCH_OPS_URL || opsUrlFromEnv || '';
  const envBody = [
    '# Not secrets — a URL and two addresses.',
    '# Written by scripts/ignite.mjs. Safe to commit.',
    `DISPATCH_OWNER_EMAIL=${secrets.DISPATCH_OWNER_EMAIL || 'wyattmcph@gmail.com'}`,
    `DISPATCH_FROM_EMAIL=${secrets.DISPATCH_FROM_EMAIL || 'Scorebug <dispatch@getscorebug.app>'}`,
    '',
    '# The ops endpoint. Never blank: Firebase treats an empty value as no value',
    '# and refuses to deploy. The deterministic alias below works; the deploy',
    '# output replaces it with the exact URL if that differs.',
    `DISPATCH_OPS_URL=${opsUrlKnown || PREDICTED_OPS_URL}`,
    '',
  ].join('\n');
  if (!ONLY_CHECK && !ONLY_VERIFY) { await writeFile(envPath, envBody, 'utf8'); ok('functions/.env written'); }
  else say(`  ${C.dim}(would write functions/.env)${C.r}`);

  /* ── 4. Deploy ──────────────────────────────────────────────────── */
  let opsUrl = opsUrlKnown;
  let redeployForOpsUrl = false;
  if (DO_DEPLOY && !ONLY_CHECK) {
    head('04 · DEPLOY');
    const test = await runShell('npm test', join(ROOT, 'functions'));
    if (test.code !== 0) {
      fail('the test suite is red — refusing to deploy');
      say(test.out.split('\n').slice(-20).join('\n'));
      process.exit(1);
    }
    ok(`tests pass (${(test.out.match(/# pass (\d+)/) || [, '?'])[1]})`);

    say(`\n  ${C.dim}deploying…${C.r}\n`);
    /* --force sets the Artifact Registry cleanup policy without asking.
       Without it the CLI finishes the deploy, fails to set the policy, prints
       "Functions successfully deployed but could not set up cleanup policy" and
       EXITS NON-ZERO — a complete success reported as a failure. It matters for
       more than the exit code: every deploy leaves a container image behind in
       Artifact Registry, and with no policy they accumulate for ever and quietly
       become the largest line on a bill that should be pennies. */
    const dep = await run('firebase', ['deploy', '--only', 'functions,firestore:rules', '--project', PROJECT, '--non-interactive', '--force'], { env: DEPLOY_ENV });

    /* ── A PARTIAL DEPLOY IS NOT A DEPLOY ─────────────────────────────────
     *
     * The Firebase CLI exits 0 when SOME functions fail. On the first deploy
     * into a fresh project this is the normal case, not the rare one: all nine
     * functions are created in parallel, each tries to create the shared
     * gcf-v2-sources bucket, one wins and the rest get
     *   HTTP Error: 409, Could not create bucket gcf-v2-sources-<n>-<region>
     * — and the CLI still exits 0.
     *
     * That happened, and this script printed "✓ deployed" over the top of
     * eight missing functions, including dispatchTick (the heartbeat) and
     * dailyDigest (the 07:00 email). The engine looked deployed, the ops
     * endpoint answered, and nothing would ever have run. So: count what was
     * attempted against what succeeded, and name the difference. */
    /* ── STRIP THE COLOUR BEFORE READING THE LOG ──────────────────────────
     *
     * This is the third time this block has been wrong, and the first two
     * fixes both assumed the text arriving here looked like the text on the
     * screen. It does not. The Firebase CLI writes ANSI escape sequences into
     * the stream even when it is piped, so
     *     functions[dispatchTick(us-central1)] Successful update operation
     * arrives with escape codes wrapping the function name, and a pattern that
     * matched the visible characters matched nothing at all.
     *
     * Observed on a real run: nine functions updated successfully, the CLI
     * exited 0, and this script printed "deployed — 0 function(s) live" in
     * green. Which is the SAME failure the block was written to prevent, only
     * inverted — it could not see success, so it also could not have seen
     * failure. A parser that reads zero of everything agrees with a total
     * wipe-out just as happily as it agrees with a clean deploy.
     *
     * So: strip the escapes first, and treat "parsed nothing" as an unknown
     * rather than as a number. */
    const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
    const log = (dep.out + dep.err).replace(ANSI, '');
    const attempted = [...log.matchAll(/functions:\s+(?:creating|updating)\b[^\n]*?\bfunction\s+([A-Za-z0-9_]+)\(/g)].map((m) => m[1]);
    const succeeded = new Set([...log.matchAll(/functions\[([A-Za-z0-9_]+)\([^)]*\)\]\s+Successful\s+(?:create|update)\s+operation/g)].map((m) => m[1]));
    const missing = [...new Set(attempted)].filter((n) => !succeeded.has(n));

    /* ── THE LOG OUTRANKS THE EXIT CODE ──────────────────────────────────
     *
     * Both directions have now happened on this project, a night apart:
     *   • eight of nine functions failed and the CLI exited 0;
     *   • all nine deployed and the CLI exited 1, over a cleanup policy.
     *
     * So the exit code is treated as a hint and the deploy log as the evidence.
     * If every function the CLI said it was creating reported a successful
     * operation, the deploy worked, whatever the process returned. Only when
     * the log shows nothing at all is the exit code the last word. */
    if (!attempted.length && dep.code !== 0) {
      fail('deploy failed before it reached any function — see the output above');
      process.exit(1);
    }
    /* PARSED NOTHING IS NOT ZERO, AND IT IS NOT SUCCESS.
     *
     * If the CLI exited 0 but this block could not find a single function name
     * in its output, the honest report is "cannot tell". Printing a green tick
     * with a count of zero is how a completely failed deploy would look, and
     * it is what this script did before the ANSI strip above went in. */
    if (!attempted.length && !succeeded.size) {
      warn('deploy finished, but the log could not be read — count unverified');
      say(`  ${C.dim}The CLI exited ${dep.code}. Check the Firebase console before trusting this.${C.r}`);
      say(`  ${C.dim}https://console.firebase.google.com/project/${PROJECT}/functions${C.r}`);
    } else if (missing.length) {
      fail(`${missing.length} of ${new Set(attempted).size} function(s) did not deploy: ${missing.join(', ')}`);
      if (/Could not create bucket gcf-v2-sources/.test(log)) {
        say(`  ${C.y}This is the first-deploy race, not a broken engine.${C.r}`);
        say(`  ${C.dim}Every function tried to create the same sources bucket at once; one won.${C.r}`);
        say(`  ${C.dim}The bucket exists now, so simply RUN THIS SCRIPT AGAIN — the rest will take.${C.r}`);
      } else {
        say(`  ${C.dim}Re-run this script; deploys are idempotent and only the missing ones are created.${C.r}`);
      }
      say(`  ${C.y}Until they exist the engine cannot run: dispatchTick is the heartbeat${C.r}`);
      say(`  ${C.y}and dailyDigest is the 07:00 email.${C.r}`);
      DEPLOY_INCOMPLETE = true;
    } else {
      ok(`deployed — ${succeeded.size} function(s) live`);
      if (dep.code !== 0) {
        warn(`the firebase CLI exited ${dep.code}, but every function deployed — reporting what the log says`);
        if (/cleanup policy/i.test(log)) {
          say(`  ${C.dim}it was the Artifact Registry cleanup policy. --force sets it; already passed above.${C.r}`);
        }
      }
    }

    const found = (dep.out + dep.err).match(/https:\/\/dispatchops[^\s"']*/i);
    const printed = found ? found[0].replace(/[).,]+$/, '') : '';
    const inEnv = opsUrlKnown || PREDICTED_OPS_URL;
    if (printed && printed !== inEnv) {
      opsUrl = printed;
      ok(`ops endpoint ${opsUrl}`);
      say(`  ${C.dim}differs from the alias — rewriting .env so the digest links are exact${C.r}`);
      await writeFile(envPath, envBody.replace(`DISPATCH_OPS_URL=${inEnv}`, `DISPATCH_OPS_URL=${opsUrl}`), 'utf8');
      // DEFERRED ON PURPOSE. This is a second full functions deploy — three to
      // five silent minutes with nothing on screen, which is exactly where a
      // run gets abandoned. Everything after this point (switch-on, the Vercel
      // variables, verification) is fast and matters more, so it goes first and
      // the slow cosmetic redeploy happens last, where losing it costs nothing
      // but a digest link pointing at the alias — which works.
      redeployForOpsUrl = true;
    } else {
      opsUrl = printed || inEnv;
      ok(`ops endpoint ${opsUrl}`);
      say(`  ${C.dim}already correct — no second deploy needed${C.r}`);
    }
  }

  /* ── 5. Switch on, in dry run ───────────────────────────────────── */
  if (opsUrl && secrets.OPS_SECRET && !ONLY_CHECK) {
    head('05 · SWITCH ON');
    const call = async (action) => {
      const r = await fetch(`${opsUrl}?action=${action}&id=engine`, { headers: { 'x-ops-secret': secrets.OPS_SECRET } });
      return r.ok;
    };
    /* ── ONLY ON THE FIRST RUN ────────────────────────────────────────────
       This block used to run unconditionally, which made every deploy a
       silent policy change: the operator ends dry run, turns on autopilot,
       ships a fix an hour later, and the engine quietly goes back to posting
       nothing. The symptom is the worst kind — everything reports success and
       the machine simply stops working.
       So the switches are DEFAULTS FOR A NEW INSTALL, not settings this script
       owns. If dispatch/settings already exists, whatever you chose in the
       digest or the console is left exactly as it is. */
    const existing = await fetch(`${opsUrl}?action=status&id=engine`, { headers: { 'x-ops-secret': secrets.OPS_SECRET } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const firstRun = !existing || !existing.settings || existing.settings.dryRun === undefined;

    if (!firstRun) {
      const s = existing.settings;
      /* ── PAUSED IS NOT DRY RUN, AND THIS LINE USED TO SAY IT WAS ──────────
       *
       * `mode` only ever read dryRun and autopilot. With enabled=false it
       * printed "the engine stays dry run" in green — and dry run is the state
       * where the engine DOES everything and sends nothing, which is exactly
       * what you want to watch for a week. Paused is the state where it does
       * not run at all.
       *
       * Those look identical in a digest (no posts either way) and are
       * opposite in meaning: one is five days of drafts to read, the other is
       * five empty emails while you wait for drafts that were never going to
       * come. Which is what happened. So enabled is checked first, and when it
       * is off the script says so at the top of its voice. */
      const paused = s.enabled === false;
      const mode = paused
        ? `${C.y}${C.b}PAUSED${C.r}`
        : s.dryRun ? `${C.y}dry run${C.r}` : s.autopilot ? `${C.g}live, autopilot on${C.r}` : `${C.g}live, approval required${C.r}`;
      ok(`settings left alone — the engine stays ${mode}`);
      say(`  ${C.dim}deploying is not a reason to change how you have it set.${C.r}`);
      if (paused) {
        say('');
        warn('PAUSED MEANS NOTHING IS DRAFTED — not even into the digest.');
        say(`  ${C.y}Every tick returns immediately. Tomorrow's 07:00 email will have${C.r}`);
        say(`  ${C.y}no drafts in it, and so will the one after that.${C.r}`);
        say(`  ${C.dim}To watch it work without anything reaching a network, you want${C.r}`);
        say(`  ${C.dim}enabled=true AND dryRun=true. Press Resume at ${(secrets.SITE_BASE_URL || "https://getscorebug.app").replace(/\/+$/, "")}/ops.${C.r}`);
      }
    } else {
      // Order matters on a fresh install: dry run BEFORE enabling, so there is
      // no window in which the engine is live and unmuzzled.
      const a = await call('dryrun');
      const b = await call('autopilot-off');
      const c = await call('resume');
      if (a && b && c) ok('dispatch/settings created — enabled, dryRun on, autopilot off');
      else fail('could not create the settings document through the ops endpoint; check OPS_SECRET matches');
    }
  }

  /* ── 6. Vercel ──────────────────────────────────────────────────── */
  head('06 · SITE VARIABLES');
  if (!haveFile) {
    say(`  ${C.dim}skipped — these are already set on Vercel and rewriting them needs the${C.r}`);
    say(`  ${C.dim}plaintext values. Recover them with:${C.r}  vercel env pull .env.recover   (from the site root)`);
  }
  /* Everything the SITE needs from this run. ENGINE_KEY signs the newsletter's
     unsubscribe links; the two NEXT_PUBLIC_ values let /slate read the weekly
     page over the Firestore REST API (the web API key authorises nothing —
     firestore.rules is what grants read on dispatch/public/articles). */
  const siteVars = {
    DISPATCH_KEY: secrets.DISPATCH_KEY,
    DISPATCH_OPS_URL: opsUrl,
    DISPATCH_OPS_SECRET: secrets.OPS_SECRET,
    OPS_CONSOLE_PASSWORD: secrets.OPS_CONSOLE_PASSWORD,
    INDEXNOW_KEY: secrets.INDEXNOW_KEY,
    ENGINE_KEY: secrets.ENGINE_KEY,
    /* The site verifies every Discord interaction against this. It is a PUBLIC
       key — it can check a signature and authorise nothing — which is exactly
       why the bot token stays out of a deployment that serves public traffic. */
    DISCORD_PUBLIC_KEY: secrets.DISCORD_PUBLIC_KEY,
    NEXT_PUBLIC_ENGINE_PROJECT_ID: PROJECT,
    NEXT_PUBLIC_ENGINE_API_KEY: secrets.ENGINE_WEB_API_KEY,
  };
  const settable = haveFile ? Object.entries(siteVars).filter(([, v]) => v) : [];
  for (const [k] of settable) say(`  ${C.dim}·${C.r} ${k}`);
  if (haveFile) for (const [k, v] of Object.entries(siteVars)) if (!v) warn(`${k} has no value yet`);

  if (hasVercel && haveFile && !ONLY_CHECK && !ONLY_VERIFY) {
    /* The Vercel project is linked at the SITE root (scorebug-site), one level
       above this engine folder — that is where `vercel --prod` runs and where
       .vercel/project.json lives. Run from the wrong folder and every call
       fails with "Your codebase isn't linked to a project". */
    const webDir = SITE_DIR;
    if (!existsSync(join(webDir, '.vercel', 'project.json'))) {
      warn('scorebug-site/.vercel/project.json is missing — run `npx vercel link` once in scorebug-site, then re-run this script');
    }
    say(`\n  ${C.dim}writing to Vercel (production) from the site root…${C.r}`);
    for (const [k, v] of settable) {
      // `vercel env rm` first so a re-run updates rather than erroring.
      await run('vercel', ['env', 'rm', k, 'production', '--yes'], { quiet: true, cwd: webDir });
      const r = await run('vercel', ['env', 'add', k, 'production'], { stdin: `${v}\n`, quiet: true, cwd: webDir });
      say(r.code === 0 ? `  ${C.g}✓${C.r} ${k}` : `  ${C.red}✗${C.r} ${k} — ${r.err.trim().split('\n').pop()}`);
      if (r.code !== 0) problems += 1;
    }
    say(`\n  ${C.dim}Deploy the site when you are ready:${C.r}  npx vercel --prod   (from scorebug-site)`);
  } else if (!hasVercel && haveFile) {
    say(`\n  ${C.y}Set these by hand${C.r} at vercel.com → project → Settings → Environment Variables.`);
  }

  /* ── 6b. The deferred redeploy ──────────────────────────────────── */
  if (redeployForOpsUrl) {
    head('06b · WIRING THE OPS URL');
    say(`  ${C.dim}a second functions deploy so the digest buttons carry the exact URL.${C.r}`);
    say(`  ${C.dim}three to five minutes with no output. everything important is already done —${C.r}`);
    say(`  ${C.dim}if you interrupt here, nothing is lost but the exact link.${C.r}\n`);
    const again = await run('firebase', ['deploy', '--only', 'functions', '--project', PROJECT, '--non-interactive'], { quiet: true, env: DEPLOY_ENV });
    if (again.code === 0) ok('ops URL wired in');
    else warn('the second deploy failed; the first one is live and the links use the alias, which works');
  }

  /* ── 7. Verify ──────────────────────────────────────────────────── */
  head('07 · VERIFY');
  /* Read by the closing banner so it reports the engine's real mode. */
  let verified = null;
  if (!haveFile) {
    say(`  ${C.dim}the engine's own checks need OPS_SECRET and DISPATCH_KEY in plaintext,${C.r}`);
    say(`  ${C.dim}so they stand down. The deploy above is what mattered; open /ops to look.${C.r}`);
  }
  const base = (secrets.SITE_BASE_URL || 'https://getscorebug.app').replace(/\/+$/, '');

  if (secrets.DISPATCH_KEY) {
    try {
      const r = await fetch(`${base}/api/dispatch/facts`, { headers: { 'x-dispatch-key': secrets.DISPATCH_KEY } });
      if (r.ok) {
        const j = await r.json();
        ok(`facts reachable — stage ${j.stage}, platforms "${j.platforms}", ${j.leagueCount} leagues`);
        if (j.stage !== 'live') say(`  ${C.dim}Android is not public: /get lands on the waitlist and no post will say "on Google Play".${C.r}`);
      } else if (r.status === 401) {
        /* On a first run this is simply the ordering: the key was written to
           Vercel a moment ago in step 06, and the site that is serving right
           now was built before it existed. Saying "the keys differ" sent the
           operator looking for a mismatch that was not there. */
        warn('facts answered 401 — expected on a first run: the key reached Vercel in step 06 but the LIVE site was built before that');
        say(`  ${C.dim}the deploy at the end of this run fixes it. If it persists afterwards, the${C.r}`);
        say(`  ${C.dim}keys really do differ — check DISPATCH_KEY in Vercel against .secrets.local.${C.r}`);
      } else if (r.status === 404) {
        warn('facts answered 404 — the site has not been deployed with the new routes yet');
      } else fail(`facts answered ${r.status}`);
    } catch (e) { warn(`could not reach the site: ${e.message}`); }
    try {
      const r = await fetch(`${base}/api/card?k=final&l=NHL&a=CGY&an=Flames&as=3&h=EDM&hn=Oilers&hs=4&d=Final%2FOT&size=wide`);
      const type = r.headers.get('content-type') || '';
      const size = r.ok ? (await r.arrayBuffer()).byteLength : 0;
      if (r.ok && /image\/png/.test(type)) ok(`card press renders (${Math.round(size / 1024)} KB PNG)`);
      else fail(`card press answered ${r.status} ${type}`);
    } catch (e) { warn(`could not reach the card press: ${e.message}`); }

    /* The card press drops any parameter that makes a CLAIM about Scorebug —
       a community grade, a games-logged total, a headline — unless it carries
       an HMAC over the query, keyed by this same DISPATCH_KEY. If the site and
       the engine disagree about that key, every card still renders and quietly
       loses its community grade, which is the kind of failure nobody notices
       for a month. So: sign one, ask for it, and compare. */
    try {
      const u = new URL(`${base}/api/card`);
      for (const [k, v] of Object.entries({ k: 'numbers', size: 'wide', logs: '412', leagues: '6', top: 'Ignition check', g: '4.2', n: '38' })) u.searchParams.set(k, v);
      const pairs = [];
      for (const [k, v] of u.searchParams) pairs.push(`${k}=${v}`);
      u.searchParams.set('sig', createHmac('sha256', secrets.DISPATCH_KEY).update(pairs.sort().join('&')).digest('hex').slice(0, 24));
      const signed = await fetch(u.toString());
      const bad = await fetch(u.toString().replace(/sig=[0-9a-f]+/, 'sig=' + '0'.repeat(24)));
      /* MEASURE THE BODY, NOT THE HEADER. The card press streams its PNG, so
         content-length is absent; reading it gave 0 for both, the
         `sBytes && bBytes` guard went false, and this fell through to "agree"
         — reporting a pass on a comparison it had not made. The "? KB" in the
         line above is the same header being missing, which is what gave it
         away. */
      const sBytes = (await signed.arrayBuffer()).byteLength;
      const bBytes = (await bad.arrayBuffer()).byteLength;
      if (!signed.ok) fail(`signed card answered ${signed.status}`);
      else if (!sBytes || !bBytes) fail('the card press returned an empty image');
      else if (sBytes === bBytes) fail('the card press is not checking signatures — DISPATCH_KEY missing on Vercel, or the site has not been redeployed since it was written');
      else ok(`card signatures agree between the engine and the site (${Math.round(sBytes / 1024)} KB signed vs ${Math.round(bBytes / 1024)} KB stripped)`);
    } catch (e) { warn(`could not check card signing: ${e.message}`); }
  }

  /* The Bluesky domain handle. Bluesky re-checks this file for as long as the
     handle exists, so a deploy that loses it renames the account. atproto's
     spec requires text/plain and a body that is the bare DID. */
  try {
    const r = await fetch(`${base}/.well-known/atproto-did`);
    const body = (await r.text()).trim();
    const type = r.headers.get('content-type') || '';
    if (!r.ok) fail(`/.well-known/atproto-did answered ${r.status} — the Bluesky handle cannot verify`);
    else if (!/^did:plc:[a-z0-9]+$/.test(body)) fail(`/.well-known/atproto-did returned "${body.slice(0, 40)}", which is not a DID`);
    else if (!/text\/plain/.test(type)) fail(`/.well-known/atproto-did is served as ${type}; atproto requires text/plain`);
    else ok(`bluesky handle proof served: ${body}`);
  } catch (e) { warn(`could not check the bluesky handle proof: ${e.message}`); }

  if (opsUrl && secrets.OPS_SECRET) {
    try {
      const r = await fetch(`${opsUrl}?action=status`, { headers: { 'x-ops-secret': secrets.OPS_SECRET } });
      if (!r.ok) fail(`ops status answered ${r.status}`);
      else {
        const j = await r.json();
        verified = j;
        const s = j.settings || {};
        ok(`engine: enabled=${s.enabled} dryRun=${s.dryRun} autopilot=${s.autopilot}`);
        /* The one combination that looks safe and is actually idle. Repeated
           here because step 05 is a hundred lines further up the scroll, and
           this is the block people actually read. */
        if (s.enabled === false) {
          warn('the engine is PAUSED — it will draft nothing until you press Resume');
          say(`  ${C.dim}${(secrets.SITE_BASE_URL || "https://getscorebug.app").replace(/\/+$/, "")}/ops → Resume. Dry run stays on; nothing reaches a network.${C.r}`);
        }
        ok(`networks live: ${(j.health?.publishers || []).join(', ') || 'none'}`);
        ok(`${j.health?.declaredSecrets ?? '?'} secret(s) bound to the deployment`);
        const missing = j.health?.missingSecrets || [];
        if (missing.length) warn(`not configured: ${missing.join(', ')}`);
        else ok('every capability is configured');
        say(`  ${C.dim}events in the ledger: ${(j.events || []).length}${C.r}`);
      }
    } catch (e) { fail(`could not reach the ops endpoint: ${e.message}`); }
  }

  /* ── done ───────────────────────────────────────────────────────── */
  say('');
  if (problems === 0) {
    /* ── SAY WHAT IS TRUE, NOT WHAT WAS TRUE THE DAY THIS WAS WRITTEN ────────
       This line was hardcoded to "running in dry run" and printed regardless.
       Once the engine went live it was simply a lie, printed in green, directly
       underneath a verification block that had just reported the opposite two
       lines earlier — which is worse than no message at all, because it teaches
       you to distrust the part that IS checked. It reads the state now. */
    const live = verified && verified.settings ? verified.settings : null;
    const mode = !live ? 'in an unknown state — the ops endpoint did not answer'
      : live.dryRun ? `${C.y}in dry run${C.r} — nothing reaches a network`
      : live.autopilot ? `${C.g}live, autopilot on${C.r} — routine posts send themselves`
      : `${C.g}live${C.r} — every post waits for your approval in the digest`;
    say(`${C.g}${C.b}Ignition complete.${C.r} The engine is ${mode}.`);
    say(`${C.dim}Tomorrow at 07:00 you get the first digest. Read five days of drafts, then end dry run.${C.r}`);
  } else if (DEPLOY_INCOMPLETE) {
    /* The one failure that must not read like the others. Everything else on
       this page can be wrong and the engine still runs; if the scheduled
       functions are missing, nothing runs at all and the ops endpoint answering
       makes it look fine. */
    say(`${C.red}${C.b}The engine is not running.${C.r} Functions are missing — see the deploy step above.`);
    say(`${C.dim}The ops endpoint answering does not mean the engine ticks: that is a different function.${C.r}`);
    say(`${C.dim}Run this script again. Nothing else needs changing.${C.r}`);
  } else {
    say(`${C.y}${C.b}${problems} problem(s) above.${C.r} Everything else is done; fix those and re-run — this script is idempotent.`);
  }

  if (!ONLY_CHECK && !ONLY_VERIFY && existsSync(SECRETS_FILE)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = !haveFile ? 'n' : (await rl.question(`\nDelete ${SECRETS_FILE} now that the secrets are in Secret Manager? [y/N] `)).trim().toLowerCase();
    rl.close();
    if (a === 'y') {
      const { unlink } = await import('node:fs/promises');
      await unlink(SECRETS_FILE);
      say('Deleted. Secret Manager is the only copy now.');
    } else {
      say(`Kept. It is gitignored — delete it whenever you like.`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
