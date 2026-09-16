/**
 * apps/web/lib/pabuya-qr-url.ts
 *
 * THE ONE PLACE THAT KNOWS WHERE A PABUYA QR IMAGE LIVES.
 *
 * Pure (no 'server-only', no imports) so the reader that WRITES the URL
 * (lib/egift.ts) and the route that ANSWERS it
 * (app/api/pabuya/qr/[publicId]/route.ts) import the same function instead of
 * each spelling the path out. A guard on one side cannot see a typo on the
 * other; sharing the builder is what makes them impossible to disagree.
 *
 * ── WHY A ROUTE AND NOT A PRESIGNED URL (2026-09-16) ───────────────────────
 * Every Pabuya QR used to render through `displayUrlForStoredAsset`, i.e. an
 * R2 presigned GET with a 24-hour TTL. That is a wedding gift page: the couple
 * publishes it once and guests open it for months, so a URL with an expiry
 * baked in is wrong in kind, not merely short. `pabuya-card-list.tsx` even
 * carried the workaround in a comment — "presigned URL → raw img (next/image
 * would cache an expired URL)".
 *
 * 🔑 AND RAISING THE TTL CANNOT FIX IT. AWS SigV4 caps a presigned URL at
 * SEVEN DAYS. "No expiration" is not a bigger number; it is a different
 * mechanism — a stable path the server answers by streaming the object.
 *
 * The id in the path is the method's `public_id` (S89Y-<10 Crockford>), which
 * is random, not sequential — but it is NOT the access control. The route
 * applies the same visibility gate the public gift page applies. See the
 * route's own docblock.
 */

/** Path prefix the route is mounted at. Exported so tests can assert it. */
export const PABUYA_QR_ROUTE_PREFIX = '/api/pabuya/qr/';

/**
 * The permanent, non-expiring path for one e-gift method's QR image.
 *
 * Takes the method's `public_id` (never the internal UUID, never the r2 key —
 * an r2 key in a URL would leak the bucket layout and would change every time
 * the couple replaced the image, which is exactly the instability this
 * replaces).
 */
export function pabuyaQrPath(publicId: string): string {
  return `${PABUYA_QR_ROUTE_PREFIX}${encodeURIComponent(publicId)}`;
}
