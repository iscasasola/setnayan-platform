/**
 * PAPIC IS CREDITS. IT IS NOT SEATS, AND IT IS NOT PER-CAMERA-PER-DAY.
 *
 * Owner, 2026-09-18: *"papic only has papic credits that can be for unlimited
 * seats. they can also alot specific shots and the rest will be shared as
 * needed."* One shared pool per event · unlimited cameras · an optional
 * per-guest allotment which is a CEILING on the pool, never a reservation.
 * `/pricing` says it in those words — "no per-camera math, no seat limit".
 *
 * ── THE MODELS THAT CAME BEFORE, AND MUST NOT COME BACK ────────────────────
 * `DECISION_LOG.md` 2026-06-26: the ₱2,999 crew-pack was **fully retired** —
 * last code surface removed, then `PAPIC_SEATS` flipped `is_active=false` in
 * `platform_retail_catalog_v2`. The SKU ROW was deliberately KEPT, for legacy
 * owner entitlement and reversibility. The per-camera/per-day model that
 * replaced it was itself retired later (`..._MINI_DAY` carries "superseded
 * 2026-08-11" in its own title; `..._ROLL_DAY` reads "legacy roll").
 *
 * 🛑 **WHY A CODE-SIDE LIST EXISTS AT ALL.** Until this file, the ONLY thing
 * standing between a retired model and a live one was an `is_active` boolean in
 * an admin-editable table. One toggle in `/admin/pricing` — a mis-click, a
 * "let's try it again", a restore from an old row — and the seat product is
 * selling and granting once more, with no code review and no PR. Now a retired
 * code cannot become a tier no matter what the catalogue says: bringing one
 * back requires editing THIS FILE, which is a diff somebody reads.
 *
 * ⚠ THIS IS A DENYLIST OF STABLE IDENTIFIERS, NOT A PHRASING BAN. Service codes
 * are opaque keys, not prose — the usual objection ("a reword defeats it") does
 * not apply, because a reworded SKU is a DIFFERENT SKU and grants nothing.
 *
 * ⚠ AND IT DOES NOT TOUCH ENTITLEMENT. A couple who bought a crew-pack in 2026
 * still owns it: `entitlements.ts` reads their historical order rows and is
 * deliberately not filtered here. This file governs what can be SOLD and
 * GRANTED going forward, never what was already paid for.
 */

/** Papic service codes that are retired and may never grant again. */
export const RETIRED_PAPIC_SERVICE_CODES: readonly string[] = [
  // The ₱2,999 crew-pack. DECISION_LOG 2026-06-26, is_active=false.
  'PAPIC_SEATS',
  // The per-camera/per-day model that replaced seats, itself retired.
  'PAPIC_CAMERA_LTD_DAY',
  'PAPIC_CAMERA_MINI_DAY', // title: "superseded 2026-08-11"
  'PAPIC_CAMERA_ROLL_DAY', // title: "legacy roll"
  'PAPIC_CAMERA_UNLIMITED_DAY',
] as const;

/** Is this code one of the retired Papic models? Exact match, case-sensitive. */
export function isRetiredPapicServiceCode(serviceCode: string): boolean {
  return RETIRED_PAPIC_SERVICE_CODES.includes(serviceCode);
}

/**
 * Drop any retired model from a tier list, whatever its source. Called by
 * `papic-pass-tiers.ts` at its single normalise choke point, so the catalogue,
 * the fallback table and any future caller are all covered by one filter.
 */
export function dropRetiredPapicTiers<T extends { serviceCode: string }>(
  tiers: readonly T[],
): T[] {
  return tiers.filter((t) => !isRetiredPapicServiceCode(t.serviceCode));
}
