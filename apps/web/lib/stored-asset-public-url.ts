/**
 * stored-asset-public-url.ts — where a STORED value points, for the PUBLIC host.
 *
 * ## The bug this exists for (found live in prod, 2026-09-10)
 *
 * `<FileUpload>` persists `r2://bucket/key` (`app/api/upload/route.ts` →
 * `encodeR2Ref`), so `vendor_services.primary_photo_r2_key` holds
 *
 *     r2://setnayan-media/vendors/<id>/services/<uuid>-<name>.jpg
 *
 * Four couple-facing screens handed that WHOLE STRING to `r2PublicUrl()`, whose
 * second argument is an OBJECT KEY. `publicUrlFor` percent-encodes each path
 * segment, so the scheme became part of the path:
 *
 *     https://<public-host>/r2%3A//setnayan-media/vendors/…   → 404
 *     https://<public-host>/vendors/…                          → 200 image/jpeg
 *
 * The file is there. The address the app built was wrong. Every supplier is
 * forced to upload a cover before publishing a service card, so the ONE thing a
 * couple sees first — on Explore, in their vendors tab, in the wizard's picks —
 * was a broken image.
 *
 * ## Why this is a separate, pure module
 *
 * `lib/uploads.ts` (`parseStoredAsset`) and `lib/r2.ts` (`publicUrlFor`) both
 * start with `import 'server-only'`, and **`server-only` is not installed in
 * this repo** — so neither can be imported by a `node:test`, and any rule kept
 * there is untestable by behaviour. The decision therefore lives here, pure and
 * client-safe, and `publicUrlForStoredAsset` in `lib/uploads.ts` is a four-line
 * composition of this function with `publicUrlFor`.
 *
 * ## Why it also accepts a BARE KEY
 *
 * The two write paths disagree, and both are correct for their own surface:
 *   • `<FileUpload>` / `/api/upload` persist `r2://bucket/key` (a REF).
 *   • `uploadPublicAsset()` (lib/storage.ts) returns `key` — a BARE KEY —
 *     which is what `event_manual_vendors.photo_r2_key` and
 *     `homepage_background_videos.video_r2_key` hold.
 *
 * A resolver that handled only one of those would fix one screen and break
 * another, which is exactly how a column named `*_r2_key` ends up holding two
 * different things and nobody can tell by reading a call site. This accepts
 * both, and `refAndBareKeyAgree` in the guard pins that they resolve to the
 * SAME target.
 *
 * ⚠ `parseStoredAsset` reads a bare key as `{ kind: 'legacy_url' }`, i.e. as
 * something to render verbatim — for the PUBLIC-URL path that would put a
 * relative path in an `<img src>`. That is why this is not simply
 * `parseStoredAsset` + `publicUrlFor`: the legacy branch has to be split into
 * "an absolute URL to pass through" and "a key to build a URL from".
 *
 * ## Fail to nothing, never to a broken image
 *
 * A private bucket, an unknown bucket, a malformed ref → `null`. Every caller
 * already renders a placeholder for null; none of them can render a 404.
 */
import { PRIVATE_R2_BUCKETS, PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';
import { type R2BucketName } from '@/lib/r2';

const R2_SCHEME = 'r2://';

/** What the public host should be asked for. */
export type PublicAssetTarget =
  /** A legacy absolute URL already stored in the column — render it verbatim. */
  | { readonly kind: 'passthrough'; readonly url: string }
  /** Build the public URL for this object. */
  | { readonly kind: 'object'; readonly bucket: R2BucketName; readonly key: string };

/**
 * Any scheme-qualified or protocol-relative value is a URL somebody already
 * resolved (a Supabase Storage fallback URL, a Google avatar, a `data:` blob).
 * Everything else is an object key.
 */
function isAbsoluteAssetUrl(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
}

/**
 * Resolves a stored TEXT value to what the PUBLIC host should serve.
 *
 * Returns `null` for anything that cannot be rendered publicly — empty, a
 * private bucket, an unknown bucket, or a malformed `r2://` ref.
 */
export function publicAssetTarget(
  value: string | null | undefined,
): PublicAssetTarget | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith(R2_SCHEME)) {
    const rest = trimmed.slice(R2_SCHEME.length);
    const slash = rest.indexOf('/');
    // No bucket, or no key after it — nothing addressable.
    if (slash <= 0 || slash === rest.length - 1) return null;
    const bucket = rest.slice(0, slash) as R2BucketName;
    const key = rest.slice(slash + 1);
    // A public URL for a private bucket is a dead link with a misleading name:
    // it looks resolved and can never load. Refuse it here rather than let a
    // caller publish one.
    if (PRIVATE_R2_BUCKETS.has(bucket)) return null;
    if (bucket !== PUBLIC_R2_BUCKET) return null;
    return { kind: 'object', bucket, key };
  }

  if (isAbsoluteAssetUrl(trimmed)) return { kind: 'passthrough', url: trimmed };

  // A bare object key. Every bare key in this system belongs to the one bucket
  // bound to the public host.
  return { kind: 'object', bucket: PUBLIC_R2_BUCKET, key: trimmed };
}
