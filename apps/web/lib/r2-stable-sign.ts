import { createHash, createHmac } from 'node:crypto';

/**
 * 📸 ONE PHOTO, ONE ADDRESS ALL DAY — the signing rules for a media-bucket GET (owner 2026-10-20: *"we want all
 * pages to load at its fastest."*).
 *
 * 🔴 MEASURED on the live guest invitation (read-only, 2026-10-20): 13 R2 files ≈ 20 MB, and EVERY one was asked
 * for again on the next visit. A presigned URL carries the moment it was signed (`X-Amz-Date`) and R2 sent no
 * `Cache-Control`, so each render minted a NEW address for the SAME object — and a browser caches by address. No
 * guest ever had a photo in their cache, however many times they opened the invitation.
 *
 * So, here, two pure rules and one pure signer:
 *
 *   · `stableSigningWindow` — the signing moment is the START of a fixed window, not "now". Every render inside a
 *     window signs the same object to the same bytes. The expiry is stretched by that one window, so the URL handed
 *     out at the END of a window still lives the full TTL the caller asked for (a page left open overnight keeps
 *     its pictures, as before). Worst case a URL lives TTL + window (≤ 1.5 × TTL); never less than TTL from the
 *     render that handed it out.
 *   · `mediaCacheControl` — the `Cache-Control` R2 answers with (the signed `response-cache-control` parameter).
 *     Every upload path names its object `<folder>/<randomUUID()>-<file>` (app/api/upload, lib/storage.ts), so a
 *     key whose last segment starts with a UUID is never written twice: immutable. Anything else could be replaced
 *     in place (an admin's favicon, a fixed render key) and gets one hour.
 *   · `presignR2GetSync` — SigV4 query signing for one GET, synchronously. The AWS SDK's presigner is async, and the
 *     theme loops a guest page wears are resolved on synchronous paths (`resolveThemeGround`). It is held to the
 *     SDK BYTE FOR BYTE by `lib/a-photo-keeps-one-address.test.ts` — same inputs, same URL — so there is one
 *     signing answer, not two.
 *
 * 🔒 PRIVACY IS UNCHANGED. Nothing here decides WHO gets a URL — the callers' fences (`publicBucketServeRef`) still
 * do, and this is only ever used for the public media bucket; every private bucket keeps the SDK signer and its
 * own TTL untouched (`presignDisplayUrl`).
 *
 * Pure (no `server-only`, no env): the credentials are passed in, so the rule is testable with fake keys.
 */

/** The longest a signing window runs. 12 h: the same address for half a day, and a URL lives at most TTL + 12 h. */
export const STABLE_SIGN_WINDOW_MAX_SECONDS = 12 * 60 * 60;
/** SigV4's own ceiling on `X-Amz-Expires` (7 days). */
export const PRESIGN_MAX_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

export function stableSigningWindow(
  ttlSeconds: number,
  nowMs: number,
): { signingDate: Date; expiresIn: number; windowSeconds: number } {
  const ttl = Math.max(2, Math.floor(ttlSeconds));
  // A short TTL gets a short window (half of it), so a five-minute link never becomes a twelve-hour one.
  const windowSeconds = Math.max(1, Math.min(STABLE_SIGN_WINDOW_MAX_SECONDS, Math.floor(ttl / 2)));
  const nowS = Math.floor(nowMs / 1000);
  const startS = nowS - (nowS % windowSeconds);
  return {
    signingDate: new Date(startS * 1000),
    expiresIn: Math.min(PRESIGN_MAX_EXPIRES_SECONDS, ttl + windowSeconds),
    windowSeconds,
  };
}

/** `<uuid>-…` as the last path segment — the shape every upload path writes, never overwritten. */
const UUID_NAMED_OBJECT = /(?:^|\/)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^/]*$/i;

export const IMMUTABLE_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const REPLACEABLE_MEDIA_CACHE_CONTROL = 'public, max-age=3600';

export function mediaCacheControl(key: string): string {
  return UUID_NAMED_OBJECT.test(key) ? IMMUTABLE_MEDIA_CACHE_CONTROL : REPLACEABLE_MEDIA_CACHE_CONTROL;
}

/** RFC 3986 — what SigV4 (and the SDK) encode: everything but A–Z a–z 0–9 - _ . ~ */
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDate(d: Date): { stamp: string; day: string } {
  const stamp = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { stamp, day: stamp.slice(0, 8) };
}

/**
 * A presigned GET for `bucket/key` on R2's S3 endpoint (virtual-hosted, region `auto`), exactly as
 * `getSignedUrl(new S3Client({ region: 'auto', endpoint: 'https://<account>.r2.cloudflarestorage.com' }),
 * new GetObjectCommand({ Bucket, Key, ResponseCacheControl }), { expiresIn, signingDate })` would produce it.
 */
export function presignR2GetSync(args: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  signingDate: Date;
  expiresIn: number;
  responseCacheControl?: string;
}): string {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(args.bucket)) {
    throw new Error(`presignR2GetSync: bucket name is not virtual-host safe: ${args.bucket}`);
  }
  const host = `${args.bucket}.${args.accountId}.r2.cloudflarestorage.com`;
  const path = `/${args.key.split('/').map(rfc3986).join('/')}`;
  const { stamp, day } = amzDate(args.signingDate);
  const scope = `${day}/auto/s3/aws4_request`;

  const params: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', `${args.accessKeyId}/${scope}`],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', String(args.expiresIn)],
    ['X-Amz-SignedHeaders', 'host'],
    ['x-id', 'GetObject'],
  ];
  if (args.responseCacheControl) params.push(['response-cache-control', args.responseCacheControl]);
  const encoded = params.map(([k, v]) => [rfc3986(k), rfc3986(v)] as const);
  const byKey = (a: readonly [string, string], b: readonly [string, string]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const canonicalQuery = [...encoded].sort(byKey).map(([k, v]) => `${k}=${v}`).join('&');

  const canonicalRequest = ['GET', path, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${args.secretAccessKey}`, day), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const finalQuery = [...encoded, ['X-Amz-Signature', signature] as const]
    .sort(byKey)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `https://${host}${path}?${finalQuery}`;
}
