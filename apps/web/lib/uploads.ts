import 'server-only';
import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  R2_BUCKETS,
  type R2BucketKey,
  type R2BucketName,
  getR2Client,
  publicUrlFor,
} from '@/lib/r2';

/**
 * Encoding for R2-backed assets stored in TEXT columns.
 *
 * We coexist with legacy http(s) URLs in the same column (logo_url,
 * payment_screenshot_url, evidence_urls[]) by tagging new uploads with the
 * `r2://` scheme:
 *
 *     r2://setnayan-media/vendors/abc-123/logo/uuid-photo.jpg
 *
 * Any legacy value that doesn't start with `r2://` is returned verbatim by
 * `displayUrlForStoredAsset` — so old vendor logos that point at an external
 * image host keep rendering exactly as they did before R2 upload existed.
 *
 * Why not store the bucket + key as separate columns? Two reasons:
 *   1. The four surfaces this ships against already have a single TEXT
 *      column (`logo_url`, `screenshot_url`, `evidence_urls[]`). Splitting
 *      to two columns per surface is a much larger migration and we'd still
 *      need a tagged-URL convention for the TEXT[] cases.
 *   2. The same convention extends to anywhere else that takes a URL —
 *      message attachments, contract uploads, etc. — without bespoke
 *      column changes.
 */
const R2_SCHEME = 'r2://';

export type StoredAssetRef =
  | { kind: 'r2'; bucket: R2BucketName; key: string }
  | { kind: 'legacy_url'; url: string };

/**
 * Parses a stored TEXT value into a discriminated reference.
 *
 * Returns `null` only for empty / null / undefined. Anything else falls into
 * one of the two `StoredAssetRef` shapes so callers can branch on `kind`.
 *
 * For `r2://` strings we additionally validate that the bucket is one of the
 * four we use — an unknown bucket falls back to `legacy_url` so a typo can
 * still render through a CDN if it happens to be a valid URL elsewhere.
 */
export function parseStoredAsset(
  value: string | null | undefined,
): StoredAssetRef | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith(R2_SCHEME)) {
    return { kind: 'legacy_url', url: trimmed };
  }
  const rest = trimmed.slice(R2_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) {
    // Malformed `r2://` — treat the raw value as legacy so we don't crash
    // the renderer over a single bad row.
    return { kind: 'legacy_url', url: trimmed };
  }
  const bucket = rest.slice(0, slash) as R2BucketName;
  const key = rest.slice(slash + 1);
  const knownBuckets: string[] = Object.values(R2_BUCKETS);
  if (!knownBuckets.includes(bucket)) {
    return { kind: 'legacy_url', url: trimmed };
  }
  return { kind: 'r2', bucket, key };
}

/**
 * Encodes a `(bucket, key)` pair into the `r2://bucket/key` string we
 * persist in TEXT columns. Used by the upload API route after the client
 * finishes its PUT.
 */
export function encodeR2Ref(bucket: R2BucketName, key: string): string {
  return `${R2_SCHEME}${bucket}/${key}`;
}

/**
 * Resolves a stored value to a presigned GET URL suitable for `<img src>` or
 * `<a href>`.
 *
 * Legacy values pass through unchanged. R2-backed values are signed with a
 * default 24-hour TTL — long enough for a page render + a couple of
 * navigations, short enough that a leaked URL stops working within a day.
 *
 * Surfaces that render many assets in a list (vendor portfolio, evidence
 * thumbnails) should call this in parallel via `Promise.all` rather than
 * sequentially — each call is a separate signing round trip on the AWS SDK.
 */
export async function displayUrlForStoredAsset(
  value: string | null | undefined,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const ref = parseStoredAsset(value);
  if (!ref) return null;
  if (ref.kind === 'legacy_url') return ref.url;
  return await presignDisplayUrl(ref.bucket, ref.key, opts.ttlSeconds);
}

/**
 * Generates a presigned GET URL for an R2 object.
 *
 * If `R2_PUBLIC_URL` is set the bucket may already be publicly readable —
 * in that case we still issue a presigned URL because (a) public-read isn't
 * guaranteed for every bucket we surface (thread-files in particular holds
 * sensitive evidence) and (b) a single helper keeps the call sites simple.
 *
 * Default TTL is 24 hours (86_400 seconds). Most renders happen within
 * minutes of the request, but couples sometimes leave a tab open overnight
 * and we'd rather their portfolio still load than greet them with broken
 * images.
 */
export async function presignDisplayUrl(
  bucket: R2BucketName,
  key: string,
  ttlSeconds = 60 * 60 * 24,
): Promise<string> {
  const client = getR2Client();
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

/**
 * Generates a presigned PUT URL for an R2 object — what `/api/upload` hands
 * back to the browser so the file can be uploaded direct-to-R2 without
 * round-tripping bytes through the Next.js server.
 *
 * `Content-Type` is bound into the signature, so the browser MUST send the
 * same value on its PUT. `Content-Length` is signed when we know the exact
 * size so a client can't sneak past our size-cap check.
 */
export async function presignUploadUrl(args: {
  bucket: R2BucketName;
  key: string;
  contentType: string;
  sizeBytes: number;
  ttlSeconds?: number;
}): Promise<string> {
  const client = getR2Client();
  return await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      ContentType: args.contentType,
      ContentLength: args.sizeBytes,
    }),
    { expiresIn: args.ttlSeconds ?? 60 * 5, signableHeaders: new Set(['content-type', 'content-length']) },
  );
}

/**
 * Backwards-compatible helper for rendering a vendor's logo.
 *
 * Vendor profiles may hold either:
 *   - A legacy external `https://…` URL the vendor pasted in the old text
 *     input (still works as before)
 *   - An `r2://…` tag emitted by the new upload flow (returns a signed GET
 *     URL with 24h TTL)
 *   - NULL (returns null — caller falls back to the initials placeholder)
 *
 * Server-only because presigning requires the R2 credentials.
 */
export async function displayLogoUrl(profile: {
  logo_url: string | null | undefined;
}): Promise<string | null> {
  return await displayUrlForStoredAsset(profile.logo_url ?? null);
}

/**
 * Same as `displayUrlForStoredAsset` but for an array of stored values —
 * portfolio_r2_keys, evidence_urls, etc. Drops null entries from the output
 * so the caller can map directly into `<img>` or `<a>` lists.
 */
export async function displayUrlsForStoredAssets(
  values: ReadonlyArray<string | null | undefined>,
  opts: { ttlSeconds?: number } = {},
): Promise<string[]> {
  const resolved = await Promise.all(
    values.map((v) => displayUrlForStoredAsset(v, opts)),
  );
  return resolved.filter((u): u is string => u !== null);
}

/**
 * Re-export so callers don't have to import from both `r2` and `uploads`.
 */
export { R2_BUCKETS, publicUrlFor };
export type { R2BucketKey, R2BucketName };
