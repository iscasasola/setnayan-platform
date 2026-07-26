/**
 * vendor-addon-free-grant.ts — WHICH free-grant a vendor add-on activation is,
 * and therefore whether it may burn the vendor's one-time free first cycle.
 *
 * Three different things can make a vendor add-on cycle cost ₱0, and they are
 * NOT interchangeable:
 *
 *   • `launch_window`     — the 2026-07-25 launch free window. REPEATABLE and
 *                           time-boxed. Must NOT consume the trial: when the
 *                           window closes on 2026-11-30 the vendor still holds
 *                           their free first cycle.
 *   • `first5_bookings`   — "free until your 6th booking". REPEATABLE while the
 *                           vendor is inside the window. Must NOT consume the
 *                           trial either, for the same reason (the policy can be
 *                           switched off).
 *   • `first_cycle_trial` — the legacy ONE-TIME free 28-day cycle. This is the
 *                           only kind that consumes `*_trial_used_at`, and the
 *                           only one that needs the atomic
 *                           `.is('*_trial_used_at', null)` claim to be
 *                           double-click-proof.
 *
 * Getting the kind wrong is a MONEY bug in both directions: mislabel a launch
 * grant as the trial and the vendor silently loses a cycle they paid nothing to
 * keep; mislabel the trial as repeatable and the atomic claim disappears, so two
 * tabs grant two free cycles. That decision used to live as three inline ternary
 * chains across `booth-addon-actions.ts` and `ai-addon-actions.ts` with no test
 * on any of them. It lives here now, once, under test.
 *
 * PURE: no env, no clock, no I/O. `launchFree` / `first5Free` are decided at the
 * call site (`isVendorLaunchFreeNow` · `addonIsFreeUnderFirst5`) and passed in.
 */

/** Why this cycle costs what it costs. */
export type VendorAddonGrantKind =
  | 'paid'
  | 'launch_window'
  | 'first5_bookings'
  | 'first_cycle_trial';

export type VendorAddonGrantInput = {
  /**
   * What this vendor would pay today, BEFORE the launch window — i.e. the
   * already-resolved price, with any first-5 / trial zeroing already applied by
   * the add-on's own resolver.
   *
   * ⚠ Deliberately NOT sanitised. A non-finite value must reach the caller
   * unchanged so `pricePhp <= 0` evaluates exactly as it did before this module
   * existed (`NaN <= 0` is false → the PAID path). Coercing a broken read to 0
   * here would fail OPEN and give the add-on away.
   */
  basePricePhp: number;
  /** `isVendorLaunchFreeNow({ sku, … })` for this add-on's SKU. */
  launchFree: boolean;
  /** `addonIsFreeUnderFirst5({ … })`. Absent = the policy is off. */
  first5Free?: boolean;
};

export type VendorAddonGrant = {
  /** What to charge. 0 on every free kind; `basePricePhp` untouched on 'paid'. */
  pricePhp: number;
  kind: VendorAddonGrantKind;
  /**
   * TRUE only for `first_cycle_trial`. When true the caller MUST take the
   * atomic `.is('<addon>_trial_used_at', null)` claim and stamp it; when false
   * the caller MUST NOT touch that column.
   */
  consumesTrial: boolean;
  /**
   * TRUE for the repeatable free kinds. The caller has no one-time claim to
   * serialise a double-click on, so it must clamp the new expiry with
   * `nonStackingFreeExpiry` instead of adding a cycle each press.
   */
  repeatable: boolean;
};

/**
 * Resolve the grant. The launch window can only ever move the price DOWN to ₱0;
 * it can never turn a ₱0 trial/first-5 price back into a charge. PURE.
 */
export function resolveVendorAddonGrant(
  input: VendorAddonGrantInput,
): VendorAddonGrant {
  const launchFree = input.launchFree === true;
  const pricePhp = launchFree ? 0 : input.basePricePhp;

  // Negated `>` rather than `<=` so NaN lands on the PAID side, matching every
  // call site's own `if (pricePhp <= 0)` test.
  if (!(pricePhp <= 0)) {
    return { pricePhp, kind: 'paid', consumesTrial: false, repeatable: false };
  }

  const first5Free = input.first5Free === true;
  const kind: VendorAddonGrantKind = launchFree
    ? 'launch_window'
    : first5Free
      ? 'first5_bookings'
      : 'first_cycle_trial';

  return {
    pricePhp: 0,
    kind,
    consumesTrial: kind === 'first_cycle_trial',
    repeatable: kind !== 'first_cycle_trial',
  };
}
