import 'server-only';
import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { publicAssetTarget } from '@/lib/stored-asset-public-url';
import { publicBucketServeRef } from '@/lib/site-media-ref';
import { catalogueArtPolicy, parseClientRef, type ClientRefPolicy } from '@/lib/r2-client-ref';
import {
  R2_BUCKETS,
  type R2BucketKey,
  type R2BucketName,
  publicUrlFor,
  requireR2Client,
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
 * `<a href>` — FOR THE PUBLIC MEDIA BUCKET ONLY.
 *
 * Legacy values pass through unchanged. R2-backed values are signed with a
 * default 24-hour TTL — long enough for a page render + a couple of
 * navigations, short enough that a leaked URL stops working within a day.
 *
 * 🔒 PUBLIC-BUCKET-ONLY (N4 part 3, 2026-09-11). This used to sign an `r2://`
 * ref in ANY bucket, with the admin R2 credentials, for whoever's page asked —
 * and 171 call sites hand it values that a browser can write (a guest's photo,
 * a shop's logo, an editorial draft, a dispute's evidence). One such value
 * naming `setnayan-thread-files` (payment proofs, chat files) or
 * `setnayan-vendor-verification` (government IDs) made the server hand the
 * viewer a signed link to somebody else's private file. Now a private, unknown
 * or malformed ref returns `null` — every caller already has a placeholder for
 * null. The rule is `publicBucketServeRef` (lib/site-media-ref.ts), the same
 * allow-list the database CHECK on the website media uses.
 *
 * A PRIVATE file is read through `displayUrlForPrivateStoredAsset(value,
 * policy)` instead, whose caller must name the bucket AND the tenant folder it
 * has already authorised.
 *
 * Surfaces that render many assets in a list (vendor portfolio, evidence
 * thumbnails) should call this in parallel via `Promise.all` rather than
 * sequentially — each call is a separate signing round trip on the AWS SDK.
 */
export async function displayUrlForStoredAsset(
  value: string | null | undefined,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const servable = publicBucketServeRef(value);
  if (!servable) return null;
  const ref = parseStoredAsset(servable);
  if (!ref) return null;
  if (ref.kind === 'legacy_url') return ref.url;
  return await presignDisplayUrl(ref.bucket, ref.key, opts.ttlSeconds);
}

/**
 * The DEDICATED signer for a file in a PRIVATE bucket — payment proofs,
 * dispute evidence, scanned paperwork, a shop's verification papers, the
 * catalogue's sample art.
 *
 * The caller passes the `ClientRefPolicy` it has ALREADY authorised (built from
 * the order, event or shop the session was proven to own — never from the
 * stored value), and a ref is signed only when it names exactly that bucket and
 * sits under one of that policy's tenant folders (`parseClientRef`: strict,
 * case-sensitive, no `..`, no control characters). Anything else is `null`, so
 * a browser-writable column can no longer be pointed at a stranger's receipt.
 *
 * A non-`r2://` legacy value passes through verbatim, exactly as the public
 * signer's does — it is never signed. (Production, 2026-09-11: no private
 * column holds one.)
 *
 * TTL defaults to the public signer's 24 h so a converted surface behaves as it
 * did; pass `ttlSeconds` to shorten it.
 */
export async function displayUrlForPrivateStoredAsset(
  value: string | null | undefined,
  policy: ClientRefPolicy,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const ref = parseStoredAsset(value);
  if (!ref) return null;
  if (ref.kind === 'legacy_url') return ref.url;
  const allowed = parseClientRef(typeof value === 'string' ? value.trim() : null, policy);
  if (!allowed) return null;
  return await presignDisplayUrl(allowed.bucket, allowed.key, opts.ttlSeconds);
}

/**
 * The catalogue's sample art — category tiles and onboarding refinement photos.
 * The taxonomy studio uploads to the PRIVATE `setnayan-samples` bucket, while
 * older rows hold a `/public` path or a media ref; all three render, and the
 * private one only from the studio's own two roots (`catalogueArtPolicy`).
 */
export async function displayUrlForCatalogueArt(
  value: string | null | undefined,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  return (
    (await displayUrlForStoredAsset(value, opts)) ??
    (await displayUrlForPrivateStoredAsset(value, catalogueArtPolicy(), opts))
  );
}

/** `displayUrlForPrivateStoredAsset` over a list (evidence arrays); refusals dropped. */
export async function displayUrlsForPrivateStoredAssets(
  values: ReadonlyArray<string | null | undefined>,
  policy: ClientRefPolicy,
  opts: { ttlSeconds?: number } = {},
): Promise<string[]> {
  const resolved = await Promise.all(
    values.map((v) => displayUrlForPrivateStoredAsset(v, policy, opts)),
  );
  return resolved.filter((u): u is string => u !== null);
}

/**
 * Resolves a stored value to a PUBLIC, unsigned URL on the media host.
 *
 * The sibling of `displayUrlForStoredAsset`, for the surfaces that render a
 * PUBLIC image (the Explore marketplace grid, the couple's vendors tab, the
 * wizard's picks). Those must not presign: a presigned URL carries a signature
 * and a 24h expiry, so `next/image` re-transforms it on every render (billed
 * per transformation) and a cached page outlives its own URLs. `setnayan-media`
 * is served unsigned by design — see `lib/r2-client-ref.ts`.
 *
 * ⚠ THE ARGUMENT IS THE STORED VALUE, NOT AN OBJECT KEY. That is the whole
 * point: `r2PublicUrl`'s second argument is a key, and handing it the stored
 * `r2://bucket/key` ref produced `https://<host>/r2%3A//setnayan-media/…`,
 * which 404s. `lib/public-url-takes-a-key-not-a-ref.test.ts` now refuses any
 * call to `r2PublicUrl` / `publicUrlFor` outside the storage layer, so a future
 * caller cannot reach the raw builder to make that mistake again.
 *
 * Accepts either write path's output — an `r2://` ref (`<FileUpload>`) or a
 * bare key (`uploadPublicAsset`) — and passes a legacy absolute URL through
 * untouched. Returns `null` rather than a broken address for a private bucket,
 * an unknown bucket, or a malformed ref; every caller already has a
 * placeholder for null.
 *
 * Synchronous: no signing round trip, so a list of a hundred covers costs
 * nothing and needs no `Promise.all`.
 */
export function publicUrlForStoredAsset(
  value: string | null | undefined,
): string | null {
  const target = publicAssetTarget(value);
  if (!target) return null;
  if (target.kind === 'passthrough') return target.url;
  return publicUrlFor(target.bucket, target.key);
}

/**
 * Every stored photo ref in a guest list → a display URL, keyed by the STORED
 * value so a caller looks each row up by the same string the database holds.
 *
 * ── WHY THIS EXISTS (2026-08-19) ───────────────────────────────────────────
 * This exact block was hand-copied, byte for byte, in FOUR loaders — the guest
 * list, the seating chart, the 3D lab and the plan-3D demo. And THREE other
 * loaders that also hand a guest photo to a client component never wrote it at
 * all: the check-in desk, the souvenir desk and the Patiktok booth tag sheet.
 * Those three put a raw `r2://…` string into an `<img src>`, which renders a
 * broken-image glyph and nothing else.
 *
 * 🔑 THE OMISSION IS THE DEFECT, AND FOUR COPIES ARE HOW IT HAPPENS. There was
 * nothing to import, so writing the resolution was something each author had to
 * remember. Two of them left an eslint-disable for "arbitrary R2/OAuth photo
 * hosts" beside the raw ref — they believed a stored reference would render.
 *
 * It is guaranteed to fail for an RSVP selfie, not merely possible: the selfie
 * writers refuse anything that is not an `r2://` ref, and a selfie REPLACES the
 * Google avatar that would otherwise have been a passthrough URL.
 *
 * A Google avatar passes through verbatim; a ref that cannot be signed is
 * dropped, so a caller's lookup misses and it falls back to initials — never a
 * broken image.
 */
export async function guestPhotoDisplayUrls(
  rows: ReadonlyArray<{ photo_url: string | null }>,
): Promise<Record<string, string>> {
  return Object.fromEntries(
    (
      await Promise.all(
        rows
          .filter((g) => g.photo_url)
          .map(
            async (g) =>
              [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const,
          ),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );
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
  const client = requireR2Client();
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
  const client = requireR2Client();
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
