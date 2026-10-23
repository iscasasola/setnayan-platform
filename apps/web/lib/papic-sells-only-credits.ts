/**
 * PAPIC SELLS CREDITS — AND NOTHING ELSE.
 *
 * ⚖ Owner 2026-09-16 (DECISION_LOG, "THE WHOLE PAPIC MODEL, SETTLED"): *"we do
 * not have papic seat. we only have papic with credits and shared amongst
 * everybody. no dedicated shots individually."* Credits bought in packs from the
 * catalogue (`lib/papic-pool-rungs.ts` → `purchasePapicPoolTopUp`) are the only
 * thing a couple can buy; every guest, the one shared code and the couple's own
 * uploads draw from that one pot.
 *
 * Asked again on 2026-10-23, over screenshots of his own Papic page still
 * selling "Limited ₱100/guest · Unlimited ₱200/guest" and offering crew-camera
 * tiers: *"why do i have these?"*
 *
 * 🔑 THIS FILE IS THE ONE PLACE THE REFUSAL IS SPOKEN. The three retired buy
 * actions redirect here; the page's banner reads the same code. Two copies of
 * "we don't sell that any more" is how a second one drifts into "something went
 * wrong".
 *
 * ✅ The 2026-09-22 "should stay" ruling (the FREE camera grant) and the
 * 2026-09-23 hand-out retirement are untouched by this: the free grant is
 * server machinery a couple never buys or hands out, and the hand-out is
 * already gone. Seats (`paparazzi_seats`) stay too — a seat is the camera CLAIM,
 * never a thing for sale.
 */

/** The `?papic_error=` code a retired camera sale redirects with. */
export const PAPIC_CAMERA_SALE_REFUSED = 'cameras_retired';

/** What a couple is told when an old page posts a retired camera sale. */
export const PAPIC_CAMERA_SALE_REFUSED_WORDS =
  'Cameras aren’t sold one at a time any more — Papic runs on one shared pot of credits. Buy credits above; every guest shoots from the same pot. Nothing was charged.';

/** Where a refused camera sale lands: back on the Papic page, with the sentence above. */
export function papicCameraSaleRefusedPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/papic?papic_error=${PAPIC_CAMERA_SALE_REFUSED}`;
}

/**
 * The order / service keys the retired per-camera, per-guest and seat model sold
 * under. Kept so the guard can prove no couple-facing surface starts a new one —
 * NOT so anything is deleted: every historical order under these keys stays
 * readable and its activation hook stays wired.
 */
export const RETIRED_PAPIC_CAMERA_SALE_KEYS = [
  'PAPIC_CAMERAS',
  'PAPIC_SEATS',
  'PAPIC_CAMERA_MINI_DAY',
  'PAPIC_CAMERA_LTD_DAY',
  'PAPIC_CAMERA_ROLL_DAY',
  'PAPIC_CAMERA_UNLIMITED_DAY',
  'PAPIC_UNLOCK',
  'PAPIC_UNLOCK_LTD',
] as const;
