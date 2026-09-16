#!/usr/bin/env node
/**
 * CADENIC // FEED THE OUTREACH BEAT
 *
 *   node scripts/import-prospects.mjs prospects.csv
 *
 * Reads a CSV and hands the rows to the engine. From there everything is
 * automatic: the beat enriches each one from Discord's public API and their
 * own website, drafts a specific email from what it found, lints every number
 * in it, and puts it in the 07:00 digest with a Send button. You never write
 * the email. You read it and press one of two links.
 *
 * ── THE CSV ─────────────────────────────────────────────────────────────────
 * A header row, then one prospect per line. Column names are matched loosely:
 *
 *   name, email, company, site, discord, segment
 *
 *   name      the person — first name is all the email uses
 *   email     required; the row is keyed on it, so re-importing updates
 *   company   the community or business, as they would say it
 *   site      their website, if they have one — we check where it sends people
 *   discord   the invite link (discord.gg/xxxx) — the enrichment needs this
 *   segment   anything you like: "game studio", "hockey club" — shown in the digest
 *
 * Re-running with the same file is safe. Anyone already sent to, replied,
 * declined or skipped is NEVER reset by an import; their status is the record
 * of a real interaction and a spreadsheet does not get to overwrite it.
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

const OPS = env.DISPATCH_OPS_URL || process.env.DISPATCH_OPS_URL;
const SECRET = env.OPS_SECRET || process.env.OPS_SECRET;
const file = process.argv[2];
if (!OPS || !SECRET) { console.error('Need DISPATCH_OPS_URL and OPS_SECRET in engine/functions/.secrets.local (ignite writes both).'); process.exit(1); }
if (!file) { console.error('Usage: node scripts/import-prospects.mjs prospects.csv'); process.exit(1); }

/** A small CSV reader that survives quoted commas and CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) {
      if (c === '"' && n === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && n === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const [header, ...lines] = parseCsv(readFileSync(resolve(file), 'utf8'));
const keys = header.map(h => h.trim().toLowerCase());
const rows = lines.map(line => Object.fromEntries(keys.map((k, i) => [k, (line[i] || '').trim()])));

const res = await fetch(`${OPS}?action=prospects`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-ops-secret': SECRET },
  body: JSON.stringify({ rows }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok || !out.ok) { console.error(`The engine answered ${res.status}: ${JSON.stringify(out)}`); process.exit(1); }

console.log(`${rows.length} row(s) read from ${file}`);
console.log(`  ${out.added} added · ${out.updated} updated · ${out.kept} left alone (already in play) · ${out.invalid} without a usable email`);
console.log('');
console.log('The beat runs at 06:30 and 18:30. Each prospect is enriched on one pass and drafted on');
console.log('the next, so a list imported now is in tomorrow morning\'s digest with a Send button.');
