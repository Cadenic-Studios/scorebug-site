// Cadenic dispatch — THE CIRCUIT BREAKER.
//
// ─── WHY THIS IS NOT OPTIONAL ───────────────────────────────────────────────
//
// Everything else in the outreach side assumes mail arrives. Discovery, the
// linter, the teardown, the note that asks for the work — all of it is worth
// exactly nothing the moment the studio's domain starts landing in spam, and
// the whole apparatus would carry on producing beautiful drafts and reporting
// healthy numbers while nobody read a word.
//
// Worse, the failure is usually terminal rather than gradual. A sending domain
// that crosses a complaint threshold does not get slower — it gets suspended,
// and a suspended domain takes the digest, the newsletter and hello@ with it.
// Amazon SES, which is what sits behind Resend, warns at a 0.1% complaint rate
// and reviews accounts above 0.5%; it warns at a 5% bounce rate and reviews
// above 10%. Those are the numbers below.
//
// So the engine watches its own mail and stops itself. Not a dashboard, not an
// alert in a digest nobody reads until morning — a refusal, in the send path,
// checked on every message.
//
// ─── WHY IT MUST BE RESET BY A PERSON ───────────────────────────────────────
//
// The breaker does not clear itself when the rate falls back under the line.
// It cannot: the rate falls the moment sending stops, so an automatic reset
// would resume exactly the behaviour that tripped it, on a rolling window that
// has been artificially flattered by the pause. Somebody has to look at what
// was sent and decide. That is a feature and it is deliberately annoying.
//
// ─── THE MINIMUM VOLUME, AND WHY ────────────────────────────────────────────
//
// One bounce out of three sends is a 33% bounce rate and means nothing at all.
// A breaker that trips on tiny samples would fire on the first typo in the
// first week and teach its owner to ignore it, which is worse than not having
// one. Nothing trips below MIN_SAMPLE messages in the window.

export const DELIVERY = 'dispatch/state/delivery/';
export const BREAKER = 'dispatch/state/meta/breaker';

/** SES warns here and reviews accounts at five times it. */
export const COMPLAINT_LIMIT = 0.001;   // 0.1%
/** SES warns here and reviews accounts at twice it. */
export const BOUNCE_LIMIT = 0.05;       // 5%
/** Below this many delivered-or-bounced messages, no rate means anything. */
export const MIN_SAMPLE = 20;
/** How far back the rates are computed. */
export const WINDOW_DAYS = 30;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Resend's outbound event types, mapped to the counter each one moves.
 *
 * `email.sent` is deliberately NOT counted as the denominator. Sent means
 * handed to the provider; delivered means a receiving server accepted it. A
 * bounce rate computed against "sent" flatters itself by counting the bounced
 * message in the denominator twice over, and the number that gets a domain
 * suspended is computed the other way.
 */
export const EVENT_COUNTERS = Object.freeze({
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
});

export function isDeliveryEvent(type) {
  return Object.hasOwn(EVENT_COUNTERS, String(type));
}

/**
 * Record one outbound event. Idempotent on the provider's message id, because
 * Svix retries a failed delivery eight times and a complaint counted twice is
 * a breaker that trips at half the real rate.
 */
export async function recordDelivery({ store, event, now = Date.now() }) {
  const counter = EVENT_COUNTERS[String(event?.type)];
  if (!counter) return { ok: false, reason: 'not a delivery event' };

  const id = String(event?.data?.email_id || '');
  const key = `${DELIVERY}${day(now)}`;
  const seenKey = `${key}/seen/${counter}/${id}`;
  if (id) {
    if (await store.get(seenKey)) return { ok: true, note: 'already counted' };
    await store.set(seenKey, { at: new Date(now).toISOString() });
  }

  const cur = (await store.get(key)) || { day: day(now) };
  await store.update(key, { day: day(now), [counter]: (Number(cur[counter]) || 0) + 1 });

  /* A complaint is worth knowing about individually, not only as a rate. One
     person who marks a cold email as spam is a signal about the message; two
     from the same segment in a week is a signal about the segment. */
  if (counter === 'complained' && id) {
    await store.set(`${DELIVERY}complaints/${id}`, {
      at: new Date(now).toISOString(),
      to: (event.data?.to || [])[0] || '',
      subject: event.data?.subject || '',
    });
  }
  return { ok: true, counter };
}

/** The rates over the window, and whether either is past its line. */
export function deliveryHealth(docs, now = Date.now(), windowDays = WINDOW_DAYS) {
  const from = day(now - windowDays * 86_400_000);
  const totals = { sent: 0, delivered: 0, bounced: 0, complained: 0, delayed: 0 };
  for (const { data: d } of docs) {
    if (!d || !d.day || d.day < from) continue;
    for (const k of Object.keys(totals)) totals[k] += Number(d[k]) || 0;
  }
  /* Delivered plus bounced is every message a receiving server made a decision
     about, which is the denominator the providers use. */
  const decided = totals.delivered + totals.bounced;
  const complaintRate = totals.delivered ? totals.complained / totals.delivered : 0;
  const bounceRate = decided ? totals.bounced / decided : 0;
  const enough = decided >= MIN_SAMPLE;
  return {
    ...totals,
    decided,
    complaintRate,
    bounceRate,
    enough,
    complaintsHigh: enough && complaintRate > COMPLAINT_LIMIT,
    bouncesHigh: enough && bounceRate > BOUNCE_LIMIT,
  };
}

/**
 * Should anything be sent right now?
 *
 * Called in the send path of every outbound message, not on a schedule. A
 * breaker that is only evaluated once a night is a breaker that lets a bad
 * batch finish.
 */
export async function sendingAllowed({ store, now = Date.now() }) {
  const tripped = await store.get(BREAKER);
  if (tripped && tripped.open) {
    return { allowed: false, reason: `outreach is stopped: ${tripped.why}. Reset it from the console once you have looked at what went out` };
  }
  const health = deliveryHealth(await store.list(DELIVERY), now);
  if (health.complaintsHigh) {
    const why = `${(health.complaintRate * 100).toFixed(2)}% of delivered mail was marked as spam over ${WINDOW_DAYS} days (the line is ${(COMPLAINT_LIMIT * 100).toFixed(1)}%)`;
    await store.set(BREAKER, { open: true, why, at: new Date(now).toISOString(), health });
    return { allowed: false, reason: `outreach has stopped itself: ${why}` };
  }
  if (health.bouncesHigh) {
    const why = `${(health.bounceRate * 100).toFixed(1)}% of mail bounced over ${WINDOW_DAYS} days (the line is ${(BOUNCE_LIMIT * 100).toFixed(0)}%)`;
    await store.set(BREAKER, { open: true, why, at: new Date(now).toISOString(), health });
    return { allowed: false, reason: `outreach has stopped itself: ${why}` };
  }
  return { allowed: true, health };
}

/** Only ever by hand. See the header for why this is not automatic. */
export async function resetBreaker({ store, now = Date.now() }) {
  const cur = await store.get(BREAKER);
  if (!cur || !cur.open) return { ok: false, reason: 'nothing is stopped' };
  await store.set(BREAKER, { open: false, clearedAt: new Date(now).toISOString(), previously: cur.why });
  return { ok: true, was: cur.why };
}

/**
 * A hard bounce means the address does not exist, and writing to it again is
 * both pointless and a further hit to the domain's reputation. Suppression is
 * permanent and by address, so no future CSV import or discovery run can bring
 * it back.
 */
export function isHardBounce(event) {
  const b = event?.data?.bounce || {};
  const type = String(b.type || b.bounceType || '').toLowerCase();
  const sub = String(b.subType || b.bounceSubType || '').toLowerCase();
  if (type.includes('permanent') || type === 'hard') return true;
  return ['general', 'nosuchuser', 'suppressed', 'onaccountsuppressionlist'].includes(sub) && type !== 'transient';
}
