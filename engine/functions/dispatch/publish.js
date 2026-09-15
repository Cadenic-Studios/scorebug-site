// Scorebug dispatch — publishers. One function per network, all with the
// same contract: post(text, ctx) -> { id, url } or throw. Replies take a
// `replyTo` from a previous result. No SDKs: every network is a couple of
// HTTP calls and a dependency is a deploy risk this function does not need.
//
// Secrets never appear in logs. Log the network and the post id, nothing else.
//
// ── MEDIA ───────────────────────────────────────────────────────────────────
//
// Every `post` takes an optional `media` — one attachment from
// dispatch/media.js, already fetched, sniffed and size-checked. The four
// networks disagree completely about how to receive it, and the disagreement is
// structural rather than cosmetic:
//
//   Bluesky  takes raw bytes at com.atproto.repo.uploadBlob and hands back a
//            blob ref to embed. Video does NOT go that way — it goes to a
//            separate service (video.bsky.app) that needs its own service auth
//            token and runs an asynchronous job you have to poll. Both paths
//            are implemented; the video one is the reason clips can post at all.
//   Mastodon takes multipart and may answer 202, meaning "still transcoding" —
//            attaching that id to a status immediately produces a post with an
//            attachment that never appears, so it is polled to 200 first.
//   Threads  will not take bytes in any form. It fetches a PUBLIC URL itself,
//            asynchronously, and the container has to be polled to FINISHED.
//   X        takes multipart at the v1.1 upload host, which is signed WITHOUT
//            the body in the base string — the one place OAuth 1.0a differs
//            from every other call here.
//
// Alt text is passed on every path that supports it. None of them require it;
// all of them accept it.

import { createHmac, randomBytes } from 'node:crypto';

const enc = new TextEncoder();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build a multipart/form-data body by hand.
 *
 * Node has FormData and Blob, and using them would be shorter — but the X
 * signature has to be computed over a body whose boundary is already fixed, and
 * FormData does not expose its boundary. Building it here means one code path
 * for both networks and no surprise when a runtime changes its boundary format.
 */
export function multipart(fields) {
  const boundary = `----scorebug${randomBytes(12).toString('hex')}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value == null) continue;
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (Buffer.isBuffer(value.bytes)) {
      chunks.push(Buffer.from(
        `content-disposition: form-data; name="${name}"; filename="${value.filename || 'upload'}"\r\n` +
        `content-type: ${value.type || 'application/octet-stream'}\r\n\r\n`
      ));
      chunks.push(value.bytes);
    } else {
      chunks.push(Buffer.from(`content-disposition: form-data; name="${name}"\r\n\r\n`));
      chunks.push(Buffer.from(String(value)));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

const extFor = (type) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
}[type] || 'bin');

async function json(res, what) {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const err = new Error(`${what}: HTTP ${res.status} ${body && (body.message || body.error || body.raw) || ''}`.trim());
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ------------------------------------------------------------ BLUESKY
/** UTF-8 byte-offset link facets, which is what makes a URL clickable on Bluesky. */
export function linkFacets(text) {
  const facets = [];
  const re = /https?:\/\/[^\s)]+/g;
  let m;
  while ((m = re.exec(text))) {
    const before = enc.encode(text.slice(0, m.index)).length;
    const len = enc.encode(m[0]).length;
    facets.push({
      index: { byteStart: before, byteEnd: before + len },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }
  return facets;
}

/**
 * Tag facets.
 *
 * On Bluesky a '#' in the text is nothing on its own — the tag is only indexed,
 * searchable and followable if the record carries a facet pointing at those
 * bytes. A post with hashtags and no facets looks perfectly normal in every
 * client and reaches nobody through them, which is the worst kind of bug: it
 * has no error, no log line, and no symptom short of wondering why tagging
 * changed nothing.
 *
 * Per the lexicon the facet value carries NO leading '#'; that character stays
 * in the display text and out of the reference.
 */
export function tagFacets(text) {
  const facets = [];
  const re = /(^|\s)(#([A-Za-z][A-Za-z0-9_]*))/g;
  let m;
  while ((m = re.exec(text))) {
    const at = m.index + m[1].length;
    const before = enc.encode(text.slice(0, at)).length;
    const len = enc.encode(m[2]).length;
    facets.push({
      index: { byteStart: before, byteEnd: before + len },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[3] }],
    });
  }
  return facets;
}

/**
 * ── IDENTIFIER vs DISPLAY NAME ─────────────────────────────────────────────
 *
 * `handle` is what we LOG IN with and `displayHandle` is what we put in a URL,
 * because on Bluesky those are not reliably the same string.
 *
 * A handle is a rented name: it changes when you take a domain, and the PDS
 * accepts the new one as a login identifier only once the change has fully
 * landed there — resolving publicly is not the same thing, as this account
 * proved. A DID never changes, for any reason, which is the entire purpose of
 * a DID. So the identifier should be the DID and nothing else.
 *
 * The URL is the opposite problem: `bsky.app/profile/<anything that resolves>`
 * works, so the right thing to show is the domain handle, which is the branded,
 * platform-verified one. Deriving it from the session would print whatever the
 * PDS currently thinks the handle is — today, the old borrowed address.
 */
export function bluesky({ handle, appPassword, displayHandle, service = 'https://bsky.social', fetchImpl = fetch }) {
  let session = null;
  async function login() {
    if (session) return session;
    const res = await fetchImpl(`${service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    session = await json(res, 'bluesky login');
    return session;
  }
  /** Raw bytes in, blob ref out. Images only — video takes the job path below. */
  async function uploadBlob(bytes, type) {
    const s = await login();
    const res = await fetchImpl(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: { 'content-type': type, authorization: `Bearer ${s.accessJwt}` },
      body: bytes,
    });
    const out = await json(res, 'bluesky uploadBlob');
    return out.blob;
  }

  /**
   * Video, which is a different service and an asynchronous job.
   *
   * Three steps, and skipping any of them produces a post with a dead embed:
   *   1. Ask the PDS for a service auth token scoped to the video service.
   *   2. PUT the bytes at video.bsky.app, which answers with a job id.
   *   3. Poll that job until it hands back a blob ref, then embed that.
   *
   * The poll is bounded. A video that is still transcoding after the budget is
   * abandoned and the caller posts the text without it, because a dispatch that
   * hangs waiting on someone else's encoder is worse than one without a clip.
   */
  /**
   * The account's own PDS DID, read from the DID document the session returns.
   *
   * Every Bluesky account lives on a specific host — this one is on
   * phellinus.us-west.host.bsky.network — and the video service checks that a
   * service-auth token was minted FOR THAT HOST. Hardcoding anything here would
   * work for one account and fail for the next.
   */
  function pdsDidOf(s) {
    const svc = ((s.didDoc && s.didDoc.service) || []).find((x) => String(x.id).includes('atproto_pds'));
    const endpoint = (svc && svc.serviceEndpoint) || service;
    try { return `did:web:${new URL(endpoint).hostname}`; } catch { return `did:web:${String(endpoint).replace(/^https?:\/\//, '')}`; }
  }

  /**
   * ── WHY THIS TOOK THREE TRIES ──────────────────────────────────────────────
   *
   * Video on Bluesky is not uploadBlob with a different mime type. It goes to a
   * separate service, and that service authenticates with a SERVICE AUTH token
   * whose audience and lexicon method it checks independently. Getting either
   * wrong returns 401 with a message that reads like the other one is wrong:
   *
   *   aud=did:web:video.bsky.app   -> "should be the user's PDS DID"
   *   lxm=app.bsky.video.uploadVideo -> "should be com.atproto.repo.uploadBlob"
   *
   * So the token is minted for the user's OWN PDS, with the ordinary blob
   * upload method, and then presented to video.bsky.app. That combination is
   * the one the service accepts, confirmed against the live API.
   *
   * The second trap is the response shape: uploadVideo answers with jobId and
   * state at the TOP level, while getJobStatus nests them under jobStatus. Code
   * that reads only the nested shape sees no job id, throws, and the whole
   * video path fails on a post that the server actually accepted — which is
   * exactly how this failed silently, leaving Bluesky in `pending` with no
   * error recorded anywhere.
   */
  async function uploadVideo(bytes, type, { pollMs = 4000, tries = 30 } = {}) {
    const s = await login();
    const aud = pdsDidOf(s);
    const authRes = await fetchImpl(
      `${service}/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent(aud)}`
        + `&lxm=com.atproto.repo.uploadBlob&exp=${Math.floor(Date.now() / 1000) + 1800}`,
      { headers: { authorization: `Bearer ${s.accessJwt}` } }
    );
    const auth = await json(authRes, 'bluesky video auth');

    const name = `scorebug-${Date.now()}.${extFor(type)}`;
    const upRes = await fetchImpl(
      `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(s.did)}&name=${encodeURIComponent(name)}`,
      { method: 'POST', headers: { 'content-type': type, authorization: `Bearer ${auth.token}` }, body: bytes }
    );
    const job = await json(upRes, 'bluesky video upload');
    /** Both shapes, because the two endpoints disagree about nesting. */
    const statusOf = (r) => (r && r.jobStatus) || r || {};
    const j0 = statusOf(job);
    if (j0.blob) return j0.blob;
    const jobId = j0.jobId;
    if (!jobId) throw new Error(`bluesky video: no job id in ${JSON.stringify(job).slice(0, 200)}`);

    for (let i = 0; i < tries; i += 1) {
      await sleep(pollMs);
      const st = await json(
        await fetchImpl(`https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`,
          { headers: { authorization: `Bearer ${auth.token}` } }),
        'bluesky video status'
      );
      const j = statusOf(st);
      if (j.blob) return j.blob;
      if (j.state && String(j.state).toUpperCase().includes('FAILED')) {
        throw new Error(`bluesky video failed: ${j.error || j.state}`);
      }
    }
    throw new Error('bluesky video: still processing after the poll budget');
  }

  async function post(text, { replyTo, media } = {}) {
    const s = await login();
    const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() };
    const facets = [...linkFacets(text), ...tagFacets(text)]
      .sort((a, b) => a.index.byteStart - b.index.byteStart);
    if (facets.length) record.facets = facets;
    if (replyTo) record.reply = { root: replyTo.root || { uri: replyTo.uri, cid: replyTo.cid }, parent: { uri: replyTo.uri, cid: replyTo.cid } };
    if (media) {
      if (media.kind === 'video') {
        const blob = await uploadVideo(media.bytes, media.type);
        record.embed = { $type: 'app.bsky.embed.video', video: blob, alt: media.alt };
      } else {
        const blob = await uploadBlob(media.bytes, media.type);
        const image = { alt: media.alt, image: blob };
        if (media.width && media.height) image.aspectRatio = { width: media.width, height: media.height };
        record.embed = { $type: 'app.bsky.embed.images', images: [image] };
      }
    }
    const res = await fetchImpl(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.accessJwt}` },
      body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record }),
    });
    const out = await json(res, 'bluesky post');
    const rkey = String(out.uri).split('/').pop();
    return { id: out.uri, cid: out.cid, uri: out.uri, url: `https://bsky.app/profile/${displayHandle || s.handle || handle}/post/${rkey}` };
  }
  async function profile() {
    const s = await login();
    const res = await fetchImpl(`${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`, { headers: { authorization: `Bearer ${s.accessJwt}` } });
    const p = await json(res, 'bluesky profile');
    return { followers: p.followersCount, posts: p.postsCount };
  }
  async function notifications(limit = 40) {
    const s = await login();
    const res = await fetchImpl(`${service}/xrpc/app.bsky.notification.listNotifications?limit=${limit}`, { headers: { authorization: `Bearer ${s.accessJwt}` } });
    const n = await json(res, 'bluesky notifications');
    return (n.notifications || []).filter((x) => x.reason === 'mention' || x.reason === 'reply').map((x) => ({
      id: x.uri, cid: x.cid, uri: x.uri, author: x.author && x.author.handle, text: x.record && x.record.text, at: x.indexedAt, isRead: x.isRead,
      root: x.record && x.record.reply && x.record.reply.root,
    }));
  }
  return { name: 'bluesky', post, profile, notifications, uploadBlob, uploadVideo };
}

// ------------------------------------------------------------ MASTODON
export function mastodon({ base, token, fetchImpl = fetch }) {
  const root = String(base).replace(/\/+$/, '');
  /**
   * Upload and wait for the server to finish with it.
   *
   * A 202 means accepted-but-processing. Attaching that id to a status right
   * away is accepted too, and produces a post whose attachment never appears —
   * a failure that is invisible from our side and obvious from everyone else's.
   */
  async function upload(media, { pollMs = 2500, tries = 20 } = {}) {
    const { body, contentType } = multipart({
      file: { bytes: media.bytes, type: media.type, filename: `scorebug.${extFor(media.type)}` },
      description: media.alt,
    });
    const res = await fetchImpl(`${root}/api/v2/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      body,
    });
    const out = await json(res, 'mastodon media');
    if (res.status !== 202 && out.url) return String(out.id);
    for (let i = 0; i < tries; i += 1) {
      await sleep(pollMs);
      const check = await fetchImpl(`${root}/api/v1/media/${out.id}`, { headers: { authorization: `Bearer ${token}` } });
      if (check.status === 200) return String(out.id);
    }
    throw new Error('mastodon media: still processing after the poll budget');
  }

  async function post(text, { replyTo, idempotency, media } = {}) {
    const body = new URLSearchParams({ status: text });
    if (replyTo) body.set('in_reply_to_id', replyTo.id);
    if (media) body.append('media_ids[]', await upload(media));
    const res = await fetchImpl(`${root}/api/v1/statuses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': idempotency || randomBytes(12).toString('hex') },
      body,
    });
    const out = await json(res, 'mastodon post');
    return { id: String(out.id), url: out.url };
  }
  async function profile() {
    const res = await fetchImpl(`${root}/api/v1/accounts/verify_credentials`, { headers: { authorization: `Bearer ${token}` } });
    const p = await json(res, 'mastodon profile');
    return { followers: p.followers_count, posts: p.statuses_count, acct: p.acct };
  }
  async function notifications(limit = 40) {
    const res = await fetchImpl(`${root}/api/v1/notifications?types[]=mention&limit=${limit}`, { headers: { authorization: `Bearer ${token}` } });
    const n = await json(res, 'mastodon notifications');
    return (n || []).map((x) => ({
      id: x.status && String(x.status.id), author: x.account && x.account.acct, text: x.status && String(x.status.content || '').replace(/<[^>]+>/g, ''), at: x.created_at,
    }));
  }
  return { name: 'mastodon', post, profile, notifications, upload };
}

// ------------------------------------------------------------ THREADS (Meta)
export function threads({ userId, token, fetchImpl = fetch, graph = 'https://graph.threads.com/v1.0' }) {
  /**
   * Meta fetches the media itself, from a URL, on its own schedule. So the
   * container is created and then polled until it reports FINISHED — publishing
   * an IN_PROGRESS container is an error, and publishing an ERROR one silently
   * produces nothing.
   */
  async function waitForContainer(id, { pollMs = 3000, tries = 20 }) {
    for (let i = 0; i < tries; i += 1) {
      const st = await json(
        await fetchImpl(`${graph}/${id}?fields=status,error_message&access_token=${encodeURIComponent(token)}`),
        'threads container status'
      );
      const status = String(st.status || '').toUpperCase();
      if (status === 'FINISHED') return true;
      if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`threads container ${status}: ${st.error_message || ''}`);
      await sleep(pollMs);
    }
    throw new Error('threads container: still processing after the poll budget');
  }

  async function post(text, { replyTo, media } = {}) {
    const params = new URLSearchParams({ media_type: 'TEXT', text, access_token: token });
    if (media && media.publicUrl) {
      if (media.kind === 'video') {
        params.set('media_type', 'VIDEO');
        params.set('video_url', media.publicUrl);
      } else {
        params.set('media_type', 'IMAGE');
        params.set('image_url', media.publicUrl);
      }
      params.set('alt_text', media.alt);
    }
    if (replyTo) params.set('reply_to_id', replyTo.id);
    const c = await json(await fetchImpl(`${graph}/${userId}/threads`, { method: 'POST', body: params }), 'threads container');
    if (media && media.publicUrl) await waitForContainer(c.id, { pollMs: media.kind === 'video' ? 5000 : 3000, tries: media.kind === 'video' ? 36 : 20 });
    const p = await json(await fetchImpl(`${graph}/${userId}/threads_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }), 'threads publish');
    const info = await json(await fetchImpl(`${graph}/${p.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), 'threads permalink').catch(() => ({}));
    return { id: String(p.id), url: info.permalink || null };
  }
  return { name: 'threads', post };
}


// ------------------------------------------------------------ INSTAGRAM (Meta)
/**
 * Instagram content publishing, through the "Instagram API with Instagram
 * Login" — the same container-then-publish shape as Threads, on a different
 * host, and with the same rule: Meta fetches the image from a PUBLIC URL. A
 * card that is already a URL on the site is the only form that works.
 *
 * Instagram has no link in a caption; the reader taps the profile. So the
 * caption carries the sentence and the tags, and the profile link carries the
 * store. IMAGE only: a text-only Instagram post does not exist, and a post with
 * no media is skipped rather than failed.
 */
export function instagram({ userId, token, fetchImpl = fetch, graph = 'https://graph.instagram.com/v21.0' }) {
  async function waitForContainer(id, { pollMs = 3000, tries = 20 }) {
    for (let i = 0; i < tries; i += 1) {
      const st = await json(
        await fetchImpl(`${graph}/${id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`),
        'instagram container status'
      );
      const status = String(st.status_code || '').toUpperCase();
      if (status === 'FINISHED') return true;
      if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`instagram container ${status}: ${st.status || ''}`);
      await sleep(pollMs);
    }
    throw new Error('instagram container: still processing after the poll budget');
  }
  async function post(text, { replyTo, media } = {}) {
    if (replyTo) throw new Error('instagram: replies are comments, and the engine does not comment');
    if (!media || !media.publicUrl || media.kind !== 'image') return { id: null, url: null, skipped: 'instagram needs an image' };
    const params = new URLSearchParams({ image_url: media.publicUrl, caption: text, alt_text: media.alt || '', access_token: token });
    const c = await json(await fetchImpl(`${graph}/${userId}/media`, { method: 'POST', body: params }), 'instagram container');
    await waitForContainer(c.id, { pollMs: 3000, tries: 20 });
    const p = await json(await fetchImpl(`${graph}/${userId}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: token }) }), 'instagram publish');
    const info = await json(await fetchImpl(`${graph}/${p.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), 'instagram permalink').catch(() => ({}));
    return { id: String(p.id), url: info.permalink || null };
  }
  return { name: 'instagram', post };
}

// ------------------------------------------------------------ X (OAuth 1.0a, pay-per-use)
function pct(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
/** RFC 5849 signature. Exported so the Twitter documentation vector can be asserted in tests. */
export function oauth1Header({ method, url, consumerKey, consumerSecret, token, tokenSecret, nonce, timestamp, extraParams = {} }) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce || randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const u = new URL(url);
  const params = { ...oauth, ...extraParams };
  for (const [k, v] of u.searchParams) params[k] = v;
  const normalized = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join('&');
  const base = `${method.toUpperCase()}&${pct(`${u.origin}${u.pathname}`)}&${pct(normalized)}`;
  const key = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  const sig = createHmac('sha1', key).update(base).digest('base64');
  const header = Object.keys({ ...oauth, oauth_signature: sig }).sort()
    .map((k) => `${pct(k)}="${pct(k === 'oauth_signature' ? sig : oauth[k])}"`).join(', ');
  return `OAuth ${header}`;
}

export function x({ apiKey, apiSecret, accessToken, accessSecret, handle = 'scorebug_app', fetchImpl = fetch }) {
  const url = 'https://api.x.com/2/tweets';
  const creds = { consumerKey: apiKey, consumerSecret: apiSecret, token: accessToken, tokenSecret: accessSecret };

  /**
   * Image upload on the v1.1 host.
   *
   * The signature base string here contains ONLY the oauth_* parameters — not
   * the multipart body. That is per RFC 5849 §3.4.1.3.1, which includes body
   * parameters only for application/x-www-form-urlencoded, and it is the single
   * most common reason a hand-rolled Twitter media upload returns 401 while
   * every other call from the same code signs correctly.
   *
   * NOT VERIFIED AGAINST THE LIVE API: this account has no X developer access
   * yet. The signing path it shares with posting is asserted against Twitter's
   * own published test vector in functions/test/dispatch.test.mjs.
   */
  async function upload(media) {
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    const { body, contentType } = multipart({
      media: { bytes: media.bytes, type: media.type, filename: `scorebug.${extFor(media.type)}` },
    });
    const res = await fetchImpl(uploadUrl, {
      method: 'POST',
      headers: { 'content-type': contentType, authorization: oauth1Header({ method: 'POST', url: uploadUrl, ...creds }) },
      body,
    });
    const out = await json(res, 'x media upload');
    const id = String(out.media_id_string || out.media_id);
    if (media.alt) {
      const metaUrl = 'https://upload.twitter.com/1.1/media/metadata/create.json';
      await fetchImpl(metaUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: oauth1Header({ method: 'POST', url: metaUrl, ...creds }) },
        body: JSON.stringify({ media_id: id, alt_text: { text: media.alt.slice(0, 1000) } }),
      }).catch(() => {});
    }
    return id;
  }

  async function post(text, { replyTo, media } = {}) {
    const body = { text };
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo.id };
    if (media && media.kind === 'image') body.media = { media_ids: [await upload(media)] };
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: oauth1Header({ method: 'POST', url, ...creds }) },
      body: JSON.stringify(body),
    });
    const out = await json(res, 'x post');
    const id = out.data && out.data.id;
    return { id: String(id), url: `https://x.com/${handle}/status/${id}` };
  }
  return { name: 'x', post, upload };
}

/** Build the enabled publishers from secrets; a missing secret means the network is off. */
export function fromSecrets(s, fetchImpl = fetch) {
  const out = {};
  if (s.BSKY_HANDLE && s.BSKY_APP_PASSWORD) out.bluesky = bluesky({ handle: s.BSKY_HANDLE, appPassword: s.BSKY_APP_PASSWORD, displayHandle: s.BSKY_DISPLAY_HANDLE, fetchImpl });
  if (s.MASTODON_BASE && s.MASTODON_TOKEN) out.mastodon = mastodon({ base: s.MASTODON_BASE, token: s.MASTODON_TOKEN, fetchImpl });
  if (s.THREADS_USER_ID && s.THREADS_TOKEN) out.threads = threads({ userId: s.THREADS_USER_ID, token: s.THREADS_TOKEN, fetchImpl });
  if (s.IG_USER_ID && s.IG_TOKEN) out.instagram = instagram({ userId: s.IG_USER_ID, token: s.IG_TOKEN, fetchImpl });
  if (s.X_API_KEY && s.X_API_SECRET && s.X_ACCESS_TOKEN && s.X_ACCESS_SECRET) out.x = x({ apiKey: s.X_API_KEY, apiSecret: s.X_API_SECRET, accessToken: s.X_ACCESS_TOKEN, accessSecret: s.X_ACCESS_SECRET, handle: s.X_HANDLE || 'scorebug_app', fetchImpl });
  return out;
}
