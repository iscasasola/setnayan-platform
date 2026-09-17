import { parseClientRef, pabuyaQrPolicy, type ClientRefPolicy } from '@/lib/r2-client-ref';
import type { R2BucketName } from '@/lib/r2';

/**
 * lib/pabuya-qr-ref.ts — which stored ref the gift-QR route is allowed to serve.
 * PURE: no I/O, no `server-only`, so its tests EXECUTE it.
 *
 * ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
 * The route used to resolve `event_egift_methods.qr_r2_key` with
 * `parseStoredAsset`, which answers two shapes and checks NEITHER against the
 * event:
 *
 *   · `r2://<any known bucket>/<any key>` — and the route then streamed those
 *     bytes with ADMIN credentials. `event_egift_methods_host_all` lets a host
 *     write their own row, and the column is plain text, so a signed-up
 *     stranger could point their own gift method at
 *     `r2://setnayan-vendor-verification/<somebody's ID scan>` and read it back
 *     through a route that had already decided they were a host. The ONLY thing
 *     standing in the way was that the legitimate value happened to be the
 *     public bucket — a coincidence, not a check, and one that evaporates the
 *     moment a private bucket becomes a legitimate home.
 *   · `legacy_url` — an arbitrary `https://…` the route answered with a 307.
 *     That is an open redirect on `setnayan.com` reachable by writing a URL
 *     into your own row. There are no legacy rows: the column was born with
 *     `r2://` (migration 20270725802892) and the writer has always gone through
 *     `parseClientRef`. It was a branch for a case that has never existed.
 *
 * 🔑 THE FIX IS TO ASK THE WRITE-SIDE QUESTION ON THE READ SIDE. The couple's
 * save path already validates the ref with `parseClientRef(…, pabuyaQrPolicy)`.
 * The route now asks the same thing of the same column, so a value the writer
 * would refuse can never be served — even if it reached the row another way.
 */

/**
 * The policies a gift QR may satisfy, most-preferred first.
 *
 * ⚠ A LIST, BECAUSE A BUCKET MOVE IS NOT ATOMIC. Objects uploaded before the
 * move live in the public media bucket and must keep serving while they are
 * migrated; objects uploaded after it live in the private bucket. Both are
 * legitimate during the transition, and neither is "any bucket".
 *
 * `pabuyaQrPolicy` is the private home (thread-files · `pabuya-qr/<id>/`) and
 * is now the ONLY accepted ref. The public-bucket read path existed for objects
 * written before the move and was deleted on 2026-09-17 once their count read
 * zero — the transition is over.
 */
export function pabuyaQrAcceptedPolicies(eventId: string): ClientRefPolicy[] {
  /*
    ONE home again, as of 2026-09-17.

    The public-bucket entry was removed once its count read zero — measured
    before deleting: `event_egift_methods` rows on `setnayan-media` = 0, rows
    anywhere but `pabuya-qr/<eventId>/` in the private bucket = 0. The WRITE
    side has refused the old home since the move, so nothing could reappear
    there; this list stops carrying a read path for objects that do not exist.
  */
  return [pabuyaQrPolicy(eventId)];
}

/**
 * Resolve a stored `qr_r2_key` to the object the route may stream, or null.
 *
 * Null means "not serveable", never "not found" — the caller must not report it
 * as an absent QR, because a refused ref and a missing upload are different
 * facts and only one of them is the couple's doing.
 */
export function resolvePabuyaQrRef(
  qrR2Key: string | null | undefined,
  eventId: string,
  policies: ClientRefPolicy[] = pabuyaQrAcceptedPolicies(eventId),
): { bucket: R2BucketName; key: string } | null {
  if (!qrR2Key) return null;
  for (const policy of policies) {
    const ref = parseClientRef(qrR2Key, policy);
    if (ref) return ref;
  }
  return null;
}
