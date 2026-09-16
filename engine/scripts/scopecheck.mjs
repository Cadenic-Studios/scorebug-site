#!/usr/bin/env node
// Scorebug engine — the scope check.
//
// WHY THIS IS A SEPARATE GATE FROM THE TESTS.
//
// `npm run lint` used to be two `node --check` calls. `node --check` parses a
// file and tells you whether it is syntactically valid JavaScript. It has
// nothing whatever to say about whether the identifiers in it exist.
//
// That distinction shipped a real bug. Three actions in the ops endpoint —
// including the one that sends a cold email to a stranger — referenced a
// `settings` binding that was declared inside a different block, one that
// returns before those lines can run. Perfect syntax. Guaranteed
// ReferenceError the first time anybody pressed the button. It sat there
// because the only thing standing between it and production was a parser.
//
// So: eslint's no-undef and no-unused-vars over every engine module, every
// time the tests run. It is a narrow rule set on purpose — this is not a style
// gate, and it should never fail for a reason anybody is tempted to ignore.
//
// eslint is not a dependency of functions/; it is hoisted into the site's
// node_modules by Next. If it genuinely is not installed this exits 0 with a
// loud note rather than failing the suite, because a missing dev tool is not
// a broken engine — but it never passes silently.

import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function findEslint(from) {
  let dir = from;
  for (let i = 0; i < 8; i++) {
    const p = join(dir, 'node_modules', 'eslint');
    if (existsSync(p)) return p;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const eslintDir = findEslint(root);
if (!eslintDir) {
  console.log('scopecheck: eslint is not installed anywhere above this folder — skipping.');
  console.log('            run `npm i` in the site folder to get it back.');
  process.exit(0);
}

const { Linter } = await import(pathToFileURL(join(eslintDir, 'lib', 'linter', 'index.js')).href);
const linter = new Linter();

const dir = join(root, 'functions', 'dispatch');
const files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();

const config = {
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { es2022: true, node: true },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }] },
};

const { readFileSync } = await import('node:fs');
let bad = 0;
for (const f of files) {
  const code = readFileSync(join(dir, f), 'utf8');
  for (const m of linter.verify(code, config, f)) {
    if (m.severity !== 2) continue;
    bad++;
    console.error(`  ${f}:${m.line}:${m.column}  ${m.message}  (${m.ruleId})`);
  }
}

if (bad) {
  console.error(`\nscopecheck: ${bad} problem${bad === 1 ? '' : 's'} across ${files.length} modules.`);
  process.exit(1);
}
console.log(`scopecheck: ${files.length} modules, no undefined or unused identifiers.`);
