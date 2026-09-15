// Scorebug dispatch — Google service-account auth, shared by everything Google.
//
// Three Google surfaces the machine reads or writes, all with one service
// account and one JWT flow:
//   - Cloud Storage  → the Play Console report bucket (installs, ratings).
//     The Play Developer REPORTING API does NOT carry installs; it is vitals
//     only (crash rate, ANR rate, errors, slow start). Install and rating
//     numbers live only in the bucket Play Console calls "Cloud Storage URI",
//     as monthly CSVs. Verified 2026-09-03 against Google's own metric-set
//     index and the Play Console download-reports help page.
//   - Android Publisher → reviews.list and reviews.reply.
//   - Analytics Data v1beta → runReport, for site sessions by utm_source.
//
// No googleapis SDK: it is a very large dependency for four HTTP calls, and
// every extra dependency is a cold-start and a deploy risk on a function that
// must not break. RS256 signing is in node:crypto.

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const SCOPES = {
  storage: 'https://www.googleapis.com/auth/devstorage.read_only',
  publisher: 'https://www.googleapis.com/auth/androidpublisher',
  analytics: 'https://www.googleapis.com/auth/analytics.readonly',
};

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Parse the service-account JSON however it arrives. A Firebase secret is a
 * single-line string, so the private key's newlines are usually escaped as
 * \n — un-escaping them is the difference between "invalid_grant" and working.
 */
export function parseServiceAccount(raw) {
  if (!raw) return null;
  let json = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    try {
      json = JSON.parse(text);
    } catch {
      // Also accept base64-encoded JSON, which is how people usually paste it.
      try { json = JSON.parse(Buffer.from(text, 'base64').toString('utf8')); } catch { return null; }
    }
  }
  if (!json || !json.client_email || !json.private_key) return null;
  return { ...json, private_key: String(json.private_key).replace(/\\n/g, '\n') };
}

const cache = new Map(); // scope -> { token, expires }

/** Mint (and cache) an access token for one scope. */
export async function accessToken(sa, scope, { fetchImpl = fetch, now = Date.now } = {}) {
  if (!sa) throw new Error('no service account configured');
  const key = `${sa.client_email}:${scope}`;
  const hit = cache.get(key);
  if (hit && hit.expires - 60_000 > now()) return hit.token;

  const iat = Math.floor(now() / 1000);
  const claim = { iss: sa.client_email, scope, aud: TOKEN_URL, exp: iat + 3600, iat };
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');

  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`google token: ${res.status} ${body.error_description || body.error || ''}`);
  cache.set(key, { token: body.access_token, expires: now() + (body.expires_in || 3600) * 1000 });
  return body.access_token;
}

export async function googleFetch(sa, scope, url, init = {}, { fetchImpl = fetch } = {}) {
  const token = await accessToken(sa, scope, { fetchImpl });
  const res = await fetchImpl(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
  return res;
}

// ------------------------------------------------------------ CLOUD STORAGE

/** List object names under a prefix. */
export async function gcsList(sa, bucket, prefix, { fetchImpl = fetch } = {}) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix)}&maxResults=200`;
  const res = await googleFetch(sa, SCOPES.storage, url, {}, { fetchImpl });
  if (!res.ok) throw new Error(`gcs list ${res.status} on ${bucket}/${prefix}`);
  const body = await res.json();
  return (body.items || []).map((o) => o.name);
}

/**
 * Fetch one object as text. Play's report CSVs are UTF-16 with a BOM — read
 * as UTF-8 and every header comes back with NULs between the letters, so the
 * decode is not optional and the BOM is how we detect it.
 */
export async function gcsText(sa, bucket, name, { fetchImpl = fetch } = {}) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`;
  const res = await googleFetch(sa, SCOPES.storage, url, {}, { fetchImpl });
  if (!res.ok) throw new Error(`gcs get ${res.status} on ${name}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return decodeReport(buf);
}

export function decodeReport(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.swap16().subarray(2).toString('utf16le');
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  return buf.toString('utf8');
}

/** Minimal RFC 4180 CSV → array of objects keyed by header. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = String(text).replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Column names in Play's reports have drifted over the years; match loosely. */
export function column(row, ...candidates) {
  const keys = Object.keys(row || {});
  for (const c of candidates) {
    const k = keys.find((k2) => k2.toLowerCase().replace(/[^a-z]/g, '') === c.toLowerCase().replace(/[^a-z]/g, ''));
    if (k) return row[k];
  }
  for (const c of candidates) {
    const k = keys.find((k2) => k2.toLowerCase().includes(c.toLowerCase()));
    if (k) return row[k];
  }
  return undefined;
}
