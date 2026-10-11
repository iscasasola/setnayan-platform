/**
 * card-photo-fetch.ts — THE SHARE PICTURE NEVER WAITS FOREVER FOR A PHOTO.
 *
 * Every card under `/api/og/**` that wears somebody's own photo fetches it
 * before drawing. That fetch had no time limit, and the function's own limit
 * was the platform's 300 s — so one slow or stalled photo held a share picture
 * (and the crawler asking for it) for up to five minutes. Measured 2026-10-11:
 * a fresh Real Story picture takes 2.1 s warm, 3.98 s cold.
 *
 * The limit covers the WHOLE fetch — the headers and the body. When it passes,
 * the fetch throws; every card already catches a photo it could not get and
 * draws its branded card, the one it draws when there is no photo at all.
 * ⚠ So this changes HOW LONG a card may take, never WHAT it shows or to whom.
 */
export const CARD_PHOTO_TIMEOUT_MS = 4000;

/** The `signal` for one card-photo fetch. A fresh one per fetch — a signal times out once. */
export function cardPhotoSignal(timeoutMs: number = CARD_PHOTO_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
