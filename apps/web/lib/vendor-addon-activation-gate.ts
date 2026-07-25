import { isTierAtLeast, type VendorTier } from './vendor-tier-caps';

/**
 * vendor-addon-activation-gate.ts — the PURE decision behind the S2
 * defence-in-depth check that runs when a vendor add-on order is ACTIVATED
 * (admin approves the payment → `lib/sku-activation.ts`).
 *
 * Extracted so the invariant that actually protects money can be unit-tested:
 * **the tier floor may lift, verification never does.** `sku-activation.ts` keeps
 * the DB read; this module owns the verdict.
 *
 * WHY THE TIER FLOOR LIFTS (2026-07-25 tiered add-on model, owner-locked):
 * Papic Challenge (#3692/#3697) and 3D Plan Ads (#3699) now SELL to every tier at
 * the entry price. Their activation hooks previously hardcoded a Pro+ floor, so a
 * verified Free/Solo vendor could pay and then have activation throw on approval —
 * money taken, entitlement never granted. That combination is not exotic:
 * verification does not set `tier_state`, so **verified-and-Free is the common
 * shape** for a real vendor. The floor must therefore move in lock-step with the
 * buy gate, both reading `isVendorAddonTieredPricingEnabled()`.
 *
 * WHY VERIFICATION IS THE HALF THAT MUST NOT RELAX: the price band is fixed when
 * the order is created, so a tier that changes during the 24-hour approval window
 * must not retroactively void a paid entitlement (that bug bites a Pro vendor
 * whose subscription lapses mid-review, independent of any flag). Losing
 * verification is different in kind — it genuinely should block provisioning.
 */

export type VendorAddonActivationGateInput = {
  /** vendor_profiles.tier_state of the PAYING vendor, as stored. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state of the paying vendor, as stored. */
  verification: string | null | undefined;
  /** The add-on's tier floor when the tiered model is OFF (e.g. 'pro', 'solo'). */
  minTier: VendorTier;
  /**
   * TRUE for an add-on whose BUY path is open to every tier — skips the TIER half
   * only. Callers set it from `isVendorAddonTieredPricingEnabled()`; keeping it a
   * plain input keeps this module pure (no env read), mirroring
   * `boothCanBrand`'s `allTiersAllowed` and `photoChallengeEligibility`'s.
   */
  allTiersAllowed?: boolean;
};

/**
 * May this paid add-on order provision its entitlement? PURE.
 *
 * Verification is required unconditionally. The tier floor applies unless
 * `allTiersAllowed` lifts it.
 */
export function vendorAddonActivationAllowed(
  input: VendorAddonActivationGateInput,
): boolean {
  if (input.verification !== 'verified') return false;
  return input.allTiersAllowed === true || isTierAtLeast(input.tier, input.minTier);
}

/**
 * The operator-facing reason an activation was blocked — used verbatim in the
 * thrown error so `/admin/payments` + Sentry show what to fix. PURE.
 */
export function vendorAddonActivationBlockedReason(
  input: VendorAddonActivationGateInput,
): string {
  const tierPart = input.allTiersAllowed === true ? 'any tier' : `${input.minTier}+`;
  return (
    `requires ${tierPart} and verified ` +
    `(tier=${input.tier ?? 'null'}, verification=${input.verification ?? 'null'})`
  );
}
