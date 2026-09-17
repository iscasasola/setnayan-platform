import 'server-only';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { vendorPaymentQrPolicy } from '@/lib/r2-client-ref';

/**
 * lib/vendor-payment-qr-url.server.ts — ONE way to display a supplier's
 * payment QR, imported by every surface that shows one.
 *
 * ⚖ OWNER RULING 2026-09-17: the couples' disclosure rule extends to suppliers.
 * A supplier's payment QR encodes their account exactly as a couple's does, and
 * it sat on the world-readable `setnayan-media` bucket for the same reason —
 * nobody had asked the question about it yet.
 *
 * ── WHY A SHARED HELPER AND NOT FOUR EDITS ─────────────────────────────────
 * Four surfaces render this image: the couple's vendor workspace, the public
 * proposal page, the supplier's own dashboard and the admin desk. They each
 * called `displayUrlForStoredAsset` — which serves the PUBLIC bucket only and
 * returns null for anything else. Fixing them one at a time means four chances
 * to miss one, and a missed one renders as a MISSING IMAGE, not an error: it
 * looks exactly like a supplier who never uploaded a QR.
 *
 * 🔑 A PRESIGNED URL IS CORRECT HERE, AND WAS WRONG FOR THE COUPLES' GIFT PAGE.
 * The difference is measured, not assumed: all four of these surfaces call
 * `createClient`, which reads `cookies()`, so Next renders them PER REQUEST and
 * every render mints a fresh URL. `/[slug]/pabuya` is a published page a couple
 * shares for months, which is why that one needed a permanent route instead.
 * Same class of object, different lifetime, different answer.
 */

/**
 * A short-lived display URL for a supplier payment QR, or null.
 *
 * Null means "not displayable" — never "this supplier has no QR". A caller that
 * renders an empty slot on null is telling the supplier their upload vanished.
 *
 * ⚠ THE POLICY IS THE CHECK. `displayUrlForPrivateStoredAsset` presigns only a
 * ref that satisfies the policy, so a key naming another bucket — or another
 * supplier's folder — is refused rather than signed. `qr_r2_key` is a column a
 * supplier can write, so the read side must ask the write side's question.
 */
export async function vendorPaymentQrDisplayUrl(
  qrR2Key: string | null | undefined,
  vendorProfileId: string | null | undefined,
): Promise<string | null> {
  if (!qrR2Key || !vendorProfileId) return null;

  /*
    ONE home. The legacy public-bucket arm was deleted 2026-09-17 once the count
    read zero — `vendor_payment_methods` holds 0 rows, so nothing was ever
    written to the old home in the first place.
  */
  return await displayUrlForPrivateStoredAsset(
    qrR2Key,
    vendorPaymentQrPolicy(vendorProfileId),
  );
}
