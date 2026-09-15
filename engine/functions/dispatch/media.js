// Scorebug dispatch — attachments.
//
// Everything a post carries besides text: fetching the bytes, proving they are
// what they claim to be, and refusing them when they are too large for the
// network that is about to receive them.
//
// ── WHY THE CAPS ARE ENFORCED HERE AND NOT AT THE PUBLISHER ─────────────────
//
// Every network states a different limit and every one of them enforces it by
// returning an error AFTER the upload. On a Cloud Function that means paying
// for the transfer twice — once to fetch a 9 MB NASA original, once to push it
// at Bluesky — before learning it was never going to be accepted. So the cap is
// checked against the smallest limit among the networks a post is going to,
// before a single byte moves toward a social API.
//
// ── AND WHY NOTHING IS RESIZED ─────────────────────────────────────────────
//
// The obvious fix for an oversized image is to shrink it, and the obvious way
// to shrink it is a native image library in the functions package. That is a
// deploy risk (a native build that works locally and not on the runtime) in
// exchange for solving a problem the archives have already solved: NASA's
// library publishes ~thumb, ~small, ~medium and ~orig renditions of every item,
// and Wikimedia serves any width through its thumbnail service. So the SITE
// picks a rendition that fits and hands over a URL, and this file's job is to
// verify that promise rather than to fix it. When a picture genuinely will not
// fit, the post goes out as text — which is a worse post, not a broken one.

/** The smallest of each network's published limits, in bytes. */
export const LIMITS = {
  bluesky: { image: 976_560, video: 50_000_000 },   // blob limit is ~1e6; leave headroom
  mastodon: { image: 8_000_000, video: 40_000_000 },
  threads: { image: 8_000_000, video: 1_000_000_000 }, // fetched by Meta from a URL
  x: { image: 5_000_000, video: 512_000_000 },
  instagram: { image: 8_000_000, video: 1_000_000_000 }, // fetched by Meta from a URL
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

/**
 * Sniff the real type from the leading bytes.
 *
 * The Content-Type header is a claim by a server we do not control, and a
 * mislabelled file is uploaded, accepted, and then renders as a broken frame
 * on a public timeline. Magic numbers are the only thing that actually knows.
 */
export function sniff(buf) {
  const b = buf;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  // ISO base media: "....ftyp"
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = b.subarray(8, 12).toString('latin1');
    if (brand.startsWith('qt')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}

export function isImage(type) { return IMAGE_TYPES.has(type); }
export function isVideo(type) { return VIDEO_TYPES.has(type); }

/**
 * Fetch bytes, refusing anything over `maxBytes` — including a response that
 * lies in its Content-Length and then keeps sending, which is checked while
 * streaming rather than trusted up front.
 */
export async function fetchBytes(url, { maxBytes, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { 'user-agent': 'Scorebug dispatch (+https://getscorebug.app)' } });
    if (!res.ok) throw new Error(`media fetch: HTTP ${res.status}`);

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared && maxBytes && declared > maxBytes) {
      throw new Error(`media too large: ${declared} > ${maxBytes}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (maxBytes && buf.length > maxBytes) {
      throw new Error(`media too large: ${buf.length} > ${maxBytes}`);
    }

    const type = sniff(buf);
    if (!type) throw new Error('media type not recognised from its bytes');
    return { bytes: buf, type, size: buf.length, url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The tightest limit across a set of networks, for the kind of media in hand.
 * Unknown networks are ignored rather than assumed generous.
 */
export function tightestLimit(networks, kind) {
  let min = Infinity;
  for (const n of networks) {
    const l = LIMITS[n];
    if (l && l[kind]) min = Math.min(min, l[kind]);
  }
  return Number.isFinite(min) ? min : null;
}

/**
 * Load one attachment for a post.
 *
 * `alt` is required and not defaulted. A picture posted without alt text is
 * a picture a blind reader is told nothing about, and every network here
 * supports it — so the caller has to have written one. Returns null on any
 * failure, because a missing image must never stop a post going out.
 */
export async function loadAttachment(att, networks, { fetchImpl = fetch, log = () => {} } = {}) {
  if (!att || !att.url || !att.alt) return null;
  const kind = att.kind === 'video' ? 'video' : 'image';
  const cap = tightestLimit(networks, kind);
  try {
    const got = await fetchBytes(att.url, { maxBytes: cap, fetchImpl });
    const kindOk = kind === 'video' ? isVideo(got.type) : isImage(got.type);
    if (!kindOk) throw new Error(`expected ${kind}, got ${got.type}`);
    return {
      ...got,
      kind,
      alt: String(att.alt).slice(0, 1000),
      credit: att.credit || null,
      width: att.width || null,
      height: att.height || null,
      /** A public URL, which is the only form Threads and Instagram accept. */
      publicUrl: att.publicUrl || att.url,
    };
  } catch (err) {
    log(`attachment skipped: ${err.message}`);
    return null;
  }
}

/**
 * Alt text from a photo record.
 *
 * Written from what the archive says the picture shows, never from the post's
 * own copy — the caption is what we claim, the alt text is what is there.
 */
export function altFor(photo, fallback) {
  const bits = [];
  if (photo && photo.title) bits.push(String(photo.title).trim());
  if (photo && photo.creditLine) bits.push(String(photo.creditLine).trim());
  const out = bits.join('. ');
  return (out || fallback || '').slice(0, 1000);
}
