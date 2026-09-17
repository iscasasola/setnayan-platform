import {
  parseClientRef,
  pabuyaQrPolicy,
  pabuyaQrLegacyPolicy,
  type ClientRefPolicy,
} from '@/lib/r2-client-ref';
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
 * `pabuyaQrPolicy` is the PRIVATE home (thread-files · `pabuya-qr/<id>/`) and
 * is the only thing the WRITE side accepts; `pabuyaQrLegacyPolicy` is the old
 * PUBLIC one (media · `events/<id>/pabuya/`), read-only, kept until the
 * migration count reads zero and then deleted along with its entry below. That
 * is the whole transition, in one list, in one file.
 */
export function pabuyaQrAcceptedPolicies(eventId: string): ClientRefPolicy[] {
  return [
    // The home new uploads land in: private bucket, own root prefix.
    pabuyaQrPolicy(eventId),
    // ⚠ TEMPORARY. Objects written before 2026-09-17 sit in the PUBLIC bucket
    // under `events/<id>/pabuya/`. They keep serving until the migration moves
    // them; delete this entry, and `pabuyaQrLegacyPolicy`, once its count reads
    // zero. Read-only by construction — the WRITE side accepts only the policy
    // above, so nothing new can choose the old home.
    pabuyaQrLegacyPolicy(eventId),
  ];
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
