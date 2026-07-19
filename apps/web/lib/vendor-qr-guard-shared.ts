/**
 * QR-in-media integrity guard — constants shared by the server scanner
 * (lib/vendor-qr-media-guard.ts), the /api/vendor/qr-guard verdict route, and
 * the client-side upload validators (lib/vendor-qr-guard-client.ts).
 *
 * THE RULE (owner-locked 2026-07-03): the QR generators are the only free
 * customer-import channel, and they are for in-person clients — a vendor may
 * NOT embed their QR codes in the photos/videos they upload to their public
 * website. Media containing such a QR is invalid.
 *
 * Deliberately NOT 'server-only': this module is pure data + string checks so
 * the client validators can share the exact same path rules and error copy.
 */

/**
 * URL path prefixes that mark a vendor-funnel QR:
 *   /vendor-invite/<slug>  — the Shortlist/invite QR (buildVendorInviteUrl)
 *   /vendor/lock/<token>   — the Locked QR (buildVendorLockUrl)
 *
 * Matched on ANY host (not just setnayan.com) — slug bare-root aliases and
 * future custom domains route the same paths, and no legitimate wedding photo
 * contains a QR encoding these paths on any host.
 */
export const VENDOR_QR_GUARDED_PATHS = [
  '/vendor-invite/',
  '/vendor/lock/',
] as const;

/** True when a decoded QR payload contains a guarded funnel path DIRECTLY.
 *  Substring (not URL-parse) on purpose: QR payloads often omit the scheme
 *  ("setnayan.com/vendor-invite/x"), which `new URL()` refuses to parse. */
export function payloadHitsGuardedPath(payload: string): boolean {
  return VENDOR_QR_GUARDED_PATHS.some((p) => payload.includes(p));
}

/** The vendor-facing rejection copy (public-surface hygiene: says what to do,
 *  not how detection works). One string so save-time, client validators, and
 *  the API route never drift. */
export const VENDOR_QR_MEDIA_ERROR =
  'This file contains your Setnayan invite QR, so it can’t go on your website — QR invites are for clients you meet in person. Remove the QR from the photo or video and upload it again.';
