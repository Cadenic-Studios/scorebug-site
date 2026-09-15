#!/usr/bin/env node
/**
 * SCOREBUG // WATCHABILITY CALIBRATION
 *
 *   node scripts/check-watchability.mjs
 *
 * The rating in app/lib/watchability.ts is a heuristic, and the only way to know
 * a heuristic is right is to state, in advance, what a sports fan would say about
 * a game and check the number agrees. Every row below is a game shape with a
 * verdict a fan would not argue with; the run fails if any of them drifts.
 *
 * These caught two real errors during the first pass:
 *   • a one-run EXTRA-INNINGS game rated 37/100, because ESPN writes baseball
 *     extras as "Final/10" and the overtime pattern only knew "Final/OT";
 *   • an ordinary one-score game rated 40/100 — "for the diehards" — because the
 *     scale had no baseline, so the most watchable thing in ordinary sport
 *     started at zero and had to climb out.
 *
 * The site has no test runner, so this is deliberately a standalone script with
 * one dependency (esbuild, already a transitive dev dep) and no framework.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'app', 'lib', 'watchability.ts');
const dir = mkdtempSync(join(tmpdir(), 'sb-watch-'));
const out = join(dir, 'w.mjs');

execFileSync('npx', ['esbuild', SRC, '--outfile=' + out, '--format=esm', '--log-level=error'], { stdio: 'inherit', shell: process.platform === 'win32' });
const { watchability } = await import(pathToFileURL(out).href);

/** [label, game, expected verdict, [min, max] score] */
const CASES = [
  ['Game 7, one-goal, OT, comeback, rivalry',
    { sport: 'hockey', homeScore: 4, awayScore: 3, detail: 'Final/OT', homeLine: [0,1,2,1], awayLine: [2,1,0,0], seasonType: 3, rivalry: true },
    'Must-watch', [88, 100]],
  ['Hockey 7-1',
    { sport: 'hockey', homeScore: 7, awayScore: 1, detail: 'Final', homeLine: [3,2,2], awayLine: [0,1,0], seasonType: 2 },
    'Skippable', [0, 33]],
  ['Basketball 20-point blowout',
    { sport: 'basketball', homeScore: 120, awayScore: 100, detail: 'Final', seasonType: 2 },
    'Skippable', [0, 33]],
  ['NFL three-point game with two lead changes',
    { sport: 'football', homeScore: 27, awayScore: 24, detail: 'Final', homeLine: [7,3,7,10], awayLine: [0,14,7,3], seasonType: 2 },
    'Worth your time', [66, 81]],
  ['Baseball one-run in extras — "Final/10", not "Final/OT"',
    { sport: 'baseball', homeScore: 3, awayScore: 2, detail: 'Final/10', seasonType: 2, homeLine: [0,0,1,0,0,1,0,0,0,1], awayLine: [1,0,0,0,1,0,0,0,0,0] },
    'Must-watch', [82, 100]],
  ['Soccer 4-3',
    { sport: 'soccer', homeScore: 4, awayScore: 3, detail: 'FT', homeLine: [1,3], awayLine: [2,1], seasonType: 2 },
    'Worth your time', [66, 81]],
  ['Goalless draw',
    { sport: 'soccer', homeScore: 0, awayScore: 0, detail: 'FT', seasonType: 2 },
    'For the diehards', [34, 49]],
  ['Preseason one-goal game is still preseason',
    { sport: 'hockey', homeScore: 3, awayScore: 2, detail: 'Final', seasonType: 1 },
    'For the diehards', [34, 49]],
  ['An upset the records can see',
    { sport: 'basketball', homeScore: 102, awayScore: 99, detail: 'Final', seasonType: 2, homeRecord: '10-40', awayRecord: '40-10' },
    'Worth your time', [66, 81]],
  ['A race has no home and away — rate nothing rather than guess',
    { sport: 'racing', homeScore: null, awayScore: null, detail: 'Final' },
    'Not rated', [0, 0]],
  ['A game still in progress is not rated',
    { sport: 'hockey', homeScore: null, awayScore: null, detail: '2nd Period' },
    'Not rated', [0, 0]],
];

let bad = 0;
for (const [label, game, verdict, [lo, hi]] of CASES) {
  const w = watchability(game);
  const ok = w.verdict === verdict && w.score >= lo && w.score <= hi;
  if (!ok) bad += 1;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${String(w.score).padStart(3)}  ${w.verdict.padEnd(17)} ${label}`);
  if (!ok) console.log(`        expected ${verdict} in ${lo}–${hi}`);
}
rmSync(dir, { recursive: true, force: true });
console.log(bad ? `\n${bad} of ${CASES.length} drifted` : `\nall ${CASES.length} hold`);
process.exit(bad ? 1 : 0);
