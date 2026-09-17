/**
 * THE SECRET LIST, AS TESTS
 *
 * A deploy that fails is cheap. A deploy that fails AFTER the tests pass and
 * the secrets are written, on a name nothing ever created, with an error that
 * names the symptom rather than the cause, is not — and that is exactly what
 * happened when RESEND_WEBHOOK_SECRET was added to dispatch/index.js and not
 * to the copy of the same list inside scripts/ignite.mjs.
 *
 * The copies are gone; both files import secretNames.js. These tests exist so
 * that fix cannot be quietly undone, because the next person to add a secret
 * will not have read the story and the failure is three minutes into a deploy.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SECRET_NAMES, UNSET_SENTINEL } from '../dispatch/secretNames.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

test('the list is frozen, unique, and shaped like environment variables', () => {
  assert.ok(Object.isFrozen(SECRET_NAMES), 'a mutable shared constant is a shared constant waiting to be edited at runtime');
  assert.equal(new Set(SECRET_NAMES).size, SECRET_NAMES.length, 'a duplicate name would be stored twice and read once');
  for (const n of SECRET_NAMES) {
    assert.match(n, /^[A-Z][A-Z0-9_]*$/, `${n} is not a plausible secret name`);
  }
});

test('the sentinel is a value no real secret could be, and index.js still re-exports it', () => {
  assert.match(UNSET_SENTINEL, /^__.*_unset__$/);
  /* Checked in the source rather than by importing index.js, which would pull
     in firebase-functions and define every trigger just to read one string. */
  assert.match(read('../dispatch/index.js'), /export \{ UNSET_SENTINEL \}/, 'something still imports it from index.js');
  assert.ok(UNSET_SENTINEL.length > 12, 'short enough to collide is short enough to be a credential');
});

/**
 * The load-bearing test. Either file defining its own list recreates the exact
 * bug this was written after: one side declares a secret, the other never
 * creates a placeholder for it, and Firebase stops a non-interactive deploy
 * because it cannot prompt for a value.
 */
test('neither index.js nor ignite.mjs defines its own copy of the list', () => {
  for (const [label, path] of [['dispatch/index.js', '../dispatch/index.js'], ['scripts/ignite.mjs', '../../scripts/ignite.mjs']]) {
    const src = read(path);
    assert.doesNotMatch(src, /^\s*const SECRET_NAMES\s*=\s*\[/m, `${label} declares its own SECRET_NAMES — import it from dispatch/secretNames.js instead`);
    assert.doesNotMatch(src, /^\s*const UNSET_SENTINEL\s*=\s*'/m, `${label} declares its own UNSET_SENTINEL — import it from dispatch/secretNames.js instead`);
    assert.match(src, /secretNames\.js/, `${label} should import from dispatch/secretNames.js`);
  }
});

/**
 * Every secret the engine actually reads must be declared, or it is silently
 * undefined at runtime — a capability that looks configured and is not. The
 * scan is deliberately crude: it looks for `secrets.NAME` and `s.NAME` across
 * the dispatch modules and asks whether each looks like a secret name.
 */
test('every secret the code reads is on the list', () => {
  const dir = join(here, '..', 'dispatch');
  const declared = new Set(SECRET_NAMES);
  const missing = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    if (f === 'secretNames.js') continue;
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/\b(?:secrets|s)\.([A-Z][A-Z0-9_]{3,})\b/g)) {
      if (!declared.has(m[1])) missing.add(`${m[1]} (${f})`);
    }
  }
  assert.deepEqual([...missing], [], 'these are read but never declared, so they are always undefined');
});
