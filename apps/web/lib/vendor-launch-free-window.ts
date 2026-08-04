/**
 * vendor-launch-free-window.ts — the launch-era "free until Nov 30" window for
 * selected vendor paid features (owner 2026-07-25; see
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § "Launch posture").
 *
 * During the launch window, covered paid features are ₱0 so early vendors get
 * the full stack free while supply is seeded; the listed prices are the
 * post-launch steady state. WHICH features are covered is the caller's decision
 * (the model says "selected"), so this module only provides the WINDOW predicate
 * + a price-zeroing helper — it does not itself enumerate covered SKUs.
 *
 * PURE: no I/O, no clock — `nowMs` is passed in (callers use `Date.now()` at the
 * call site), so this unit-tests under `tsx --test`. The env flag that decides
 * whether consumers apply the window lives in `vendor-launch-free-window-flag.ts`.
 */

/** End of the launch free window — 2026-11-30, end of day, Manila (+08:00). */
export const VENDOR_LAUNCH_FREE_WINDOW_END_ISO = '2026-11-30T23:59:59+08:00';

/** The window end as epoch ms (parsed once from the fixed ISO above). */
export const VENDOR_LAUNCH_FREE_WINDOW_END_MS = Date.parse(
  VENDOR_LAUNCH_FREE_WINDOW_END_ISO,
);

/**
 * Is the launch free window currently active? True while `nowMs` is on or before
 * the window end. PURE.
 */
export function isVendorLaunchFreeWindowActive(nowMs: number): boolean {
  return Number.isFinite(nowMs) && nowMs <= VENDOR_LAUNCH_FREE_WINDOW_END_MS;
}

/**
 * The price (PHP) a COVERED paid feature should charge given the launch window:
 * ₱0 while the window is active, otherwise the base price unchanged. Only call
 * this for features the owner has chosen to cover — this helper does not decide
 * coverage. A non-finite/negative base coerces to 0. PURE.
 */
export function vendorLaunchAdjustedPricePhp(
  basePricePhp: number,
  nowMs: number,
): number {
  if (isVendorLaunchFreeWindowActive(nowMs)) return 0;
  const base = Number(basePricePhp);
  return Number.isFinite(base) && base > 0 ? base : 0;
}
