/**
 * vendor-launch-free-window-coverage.ts — WHICH vendor-side paid SKUs the launch
 * free window (`vendor-launch-free-window.ts`) actually covers, and the single
 * predicate every buy action / price display asks.
 *
 * The window module deliberately stops at "is the window open + zero a price";
 * it says coverage "is the caller's decision (the model says *selected*)". This
 * module is that decision, written down ONCE so the card and the charge can
 * never disagree.
 *
 * ── COVERED (owner 2026-07-25 launch posture) ───────────────────────────────
 *   • `vendor_subscription`  — Solo / Pro / Enterprise plan cycles
 *   • `vendor_ai_addon`      — AI Chatbot add-on (28-day cycle)
 *   • `vendor_3d_booth`      — 3D Plan Ads / branded booth (28-day cycle)
 *   • `papic_challenge`      — Papic Challenges sponsorship (per event)
 * These are ACCESS features: our marginal cost per vendor is ~₱0, so giving them
 * away to seed supply costs nothing but foregone revenue.
 *
 * ── DELIBERATELY NOT COVERED ────────────────────────────────────────────────
 *   • Deep Search (About You / Market Scan) — METERED, with a real per-run cash
 *     cost (~₱10 / ~₱30 of search + model spend per the locked model § 9). An
 *     unbounded free window on it is a money-out-the-door abuse vector, and its
 *     free allowance is already an atomic once-per-cycle CLAIM that a blanket ₱0
 *     would either burn or bypass. Left paid; flagged for owner sign-off.
 *   • Vendor token packs — a wallet top-up (stored value), not a feature.
 *   • The sourced-lead booking fee — a separate revenue stream with its own
 *     first-5-free rule; not an "access feature" price.
 *
 * PURE: no I/O, no clock, no env. `nowMs` and the flag value are passed in, so
 * this runs under `tsx --test`. The env flag lives in
 * `vendor-launch-free-window-flag.ts`.
 */
import {
  isVendorLaunchFreeWindowActive,
  vendorLaunchAdjustedPricePhp,
} from './vendor-launch-free-window';

/** The vendor-side paid SKUs the launch free window covers. */
export type VendorLaunchFreeSku =
  | 'vendor_subscription'
  | 'vendor_ai_addon'
  | 'vendor_3d_booth'
  | 'papic_challenge';

/** The coverage set, as data — the drift guard in the test loops over this. */
export const VENDOR_LAUNCH_FREE_SKUS: readonly VendorLaunchFreeSku[] = [
  'vendor_subscription',
  'vendor_ai_addon',
  'vendor_3d_booth',
  'papic_challenge',
] as const;

/** Is `sku` inside the launch-free coverage set? PURE. */
export function isVendorLaunchFreeCoveredSku(
  sku: string,
): sku is VendorLaunchFreeSku {
  return (VENDOR_LAUNCH_FREE_SKUS as readonly string[]).includes(sku);
}

export type VendorLaunchFreeInput = {
  /** The SKU being priced. Anything outside the coverage set is never free. */
  sku: string;
  /**
   * The `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW` flag, read at the CALL SITE
   * (`isVendorLaunchFreeWindowEnabled()`) so this module stays env-free.
   */
  enabled: boolean;
  /** `Date.now()` at the call site. A non-finite value fails CLOSED (charges). */
  nowMs: number;
};

/**
 * THE decision: is this vendor SKU free right now because of the launch window?
 * Requires all three — flag on, SKU covered, window open. Fails CLOSED in every
 * other case, so a missing flag / unknown SKU / broken clock CHARGES rather than
 * gives away. PURE.
 *
 * ⚠ Callers must treat a `true` here as a REPEATABLE GRANT, not as a trial: it
 * must NOT consume a one-time trial stamp (`*_addon_trial_used_at`) or an
 * atomic once-per-cycle allowance claim. The whole point is that the vendor
 * still holds their free first cycle when the window closes on 2026-11-30.
 */
export function isVendorLaunchFreeNow(input: VendorLaunchFreeInput): boolean {
  if (!input.enabled) return false;
  if (!isVendorLaunchFreeCoveredSku(input.sku)) return false;
  return isVendorLaunchFreeWindowActive(input.nowMs);
}

/**
 * The price a covered vendor SKU should charge: ₱0 while the launch window is
 * live for it, otherwise `basePricePhp` unchanged.
 *
 * ⚠ WHY this wraps rather than injects. The add-on price resolvers
 * (`resolveVendor3dBoothPricePhp`, `resolveVendorAiAddonPricePhp`,
 * `resolveVendorPhotoChallengePricePhp`) all run their `cyclePricePhp` INPUT
 * through a `coercePrice(value, FALLBACK)` that treats any non-positive number
 * as "missing" and substitutes the ₱1,500 / ₱400 fallback. So feeding ₱0 in as
 * the input does NOT produce ₱0 — it produces the fallback price. The launch
 * window therefore has to be applied to the RESOLVED price, and the only reason
 * that is safe here (where a tier-band price injected the same way would not be)
 * is that this can only ever move the price DOWN to ₱0: it can never overwrite a
 * ₱0 trial/allowance price with a positive number, so no trial is billed and no
 * free run is deleted. Callers must still route the ₱0 to a
 * non-trial-consuming grant path — see {@link isVendorLaunchFreeNow}.
 *
 * PURE.
 */
export function vendorLaunchFreePricePhp(
  basePricePhp: number,
  input: VendorLaunchFreeInput,
): number {
  if (!isVendorLaunchFreeNow(input)) {
    const base = Number(basePricePhp);
    return Number.isFinite(base) && base > 0 ? base : 0;
  }
  return vendorLaunchAdjustedPricePhp(basePricePhp, input.nowMs);
}

/**
 * Human date the window closes, for vendor-facing copy ("free through …"). Kept
 * beside the coverage set so no surface hardcodes its own wording of the date.
 */
export const VENDOR_LAUNCH_FREE_WINDOW_END_LABEL = '30 Nov 2026';
