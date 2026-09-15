// Scorebug engine — Cloud Functions root.
//
// ESM, and functions/package.json declares "type": "module" to say so. That
// declaration is load-bearing: a .js file in a package WITHOUT it is loaded as
// CommonJS at cold start and throws "Cannot use import statement outside a
// module" — easy to miss locally because Node 22 auto-detects module syntax.
//
// Runtime is nodejs22 (firebase-functions v6). Everything the engine does is
// in dispatch/index.js; this file only initialises the admin app and
// re-exports the functions so the deploy discovers them.

import { initializeApp } from 'firebase-admin/app';

initializeApp();

export * from './dispatch/index.js';
