// Scorebug engine — THE ONE LIST OF SECRET NAMES.
//
// ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
//
// This list lived in two places: dispatch/index.js, which declares each name to
// Firebase, and scripts/ignite.mjs, which stores the values and — critically —
// creates a placeholder for every name that has no value yet.
//
// `defineSecret` is a deploy-time contract. Every name index.js declares must
// resolve to something in Secret Manager or a non-interactive deploy stops
// dead, because it cannot prompt. The placeholder mechanism in ignite.mjs is
// what makes an optional capability optional: a name with no value gets the
// sentinel below, the deploy proceeds, and readSecrets() treats the sentinel
// as absent so the capability simply stays off and the digest says so.
//
// That mechanism only ever protected names ignite.mjs knew about. Adding
// RESEND_WEBHOOK_SECRET to index.js alone declared a secret that nothing would
// ever create, and the deploy failed with:
//
//     Error: In non-interactive mode but have no value for the secret
//
// after the tests had passed and the secrets had been written — the most
// expensive possible moment to fail, and with an error that points at the
// symptom rather than the cause.
//
// The same codebase already learned this for the project id: ".firebaserc so
// one file owns the name". The secret list never got the same treatment. It
// has it now. Two constants, one file, imported by both — drift is not
// something to remember to avoid, it is something that can no longer happen.
//
// ADDING A SECRET: add the name here and nowhere else.

/**
 * What ignite.mjs writes for a declared name that has no real value, and what
 * readSecrets() in index.js treats as absent.
 *
 * It is a shared literal rather than a rule each side implements, because the
 * failure when the two disagree is silent and total: every optional capability
 * reads a 19-character string as its credential and fails at the moment it is
 * first used, which is usually days later and in somebody else's log.
 */
export const UNSET_SENTINEL = '__scorebug_unset__';

export const SECRET_NAMES = Object.freeze([
  'BSKY_HANDLE', 'BSKY_APP_PASSWORD', 'BSKY_DISPLAY_HANDLE', 'MASTODON_BASE', 'MASTODON_TOKEN',
  'THREADS_USER_ID', 'THREADS_TOKEN', 'IG_USER_ID', 'IG_TOKEN',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET', 'X_HANDLE',
  'ANTHROPIC_API_KEY', 'RESEND_API_KEY',
  'OPS_SECRET', 'GOOGLE_SERVICE_ACCOUNT', 'PLAY_BUCKET', 'PLAY_PACKAGE',
  'GA4_PROPERTY_ID', 'INDEXNOW_KEY',
  // The site's facts endpoint and card press; our own Discord.
  'DISPATCH_KEY', 'SITE_BASE_URL', 'DISCORD_WEBHOOK_URL',
  // The product's database, read-only, aggregates only. ENGINE_KEY unlocks the
  // consented newsletter list, signs its unsubscribe links, and reads the
  // account-attribution counts.
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ENGINE_KEY',
  // Cadenic outreach. Both optional to deploy; the beat refuses to SEND
  // without CADENIC_POSTAL, because CASL puts a mailing address in every
  // commercial email and 'we will add it later' is how that gets skipped.
  'CADENIC_POSTAL', 'CADENIC_FROM',
  // Prospect discovery. Optional now: the keyless feeds in dispatch/feeds.js
  // find leads with none of these set. A search key widens the funnel.
  'GOOGLE_CSE_KEY', 'GOOGLE_CSE_CX', 'BRAVE_SEARCH_KEY', 'GITHUB_TOKEN',
  // Inbound replies. Without it the webhook refuses every request it is sent,
  // which is the correct behaviour for an unauthenticated public endpoint.
  'RESEND_WEBHOOK_SECRET',
  // Where replies GO. Outgoing mail is From hello@cadenic.studio, which is a
  // Google Workspace inbox; without a Reply-To on the receiving subdomain every
  // reply lands there and Resend — and therefore the inbox module — never sees
  // one. The whole reply-handling side of the engine hangs on this one header.
  'CADENIC_REPLY_TO',
]);
