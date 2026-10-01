/**
 * HYBRID tier feature gate — FLAG-DARK (owner 2026-07-01).
 *
 * The full-catalog audit found most Solo/Pro benefits were BUILT but ungated,
 * so a free vendor already got them. The owner chose HYBRID: gate the premium
 * few (Demand Radar + Theft Watch → Pro · funnel time-series → Solo) and keep
 * the ops spine free. The caps live in `vendor-tier-caps.ts`
 * (marketIntel / theftWatch / performanceTrends) with `canSee*` helpers.
 *
 * WHY DARK BY DEFAULT: exactly the `vendor-search-gate.ts` situation — today the
 * one real founder vendor + every demo/test vendor are `tier_state='free'`, so
 * activating the gates now would lock them out of surfaces they use. The gates
 * ship fully wired but dark; the owner flips `VENDOR_TIER_FEATURE_GATE=true`
 * the day paid vendors exist in prod. Default OFF → behaviour is unchanged.
 *
 * The `canSee*` cap helpers stay pure and always correct; ONLY the page-level
 * enforcement is flag-guarded, so any surface can adopt the gate by combining
 * `isVendorFeatureGateEnabled()` with the relevant `canSee*` helper.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { asVendorTier, type VendorTier } from './vendor-tier-caps';
import {
  applyVendorTierPromotion,
  getPromotedVendorTierFor,
  type VendorDealFacts,
} from './promo-free-windows';
import { envFlagEnabled } from '@/lib/env-flag';

export function isVendorFeatureGateEnabled(): boolean {
  return envFlagEnabled(process.env.VENDOR_TIER_FEATURE_GATE);
}

/**
 * 💳 THE ONE QUESTION EVERY SUPPLIER UPSELL ASKS — "does the plan paywall apply
 * to this shop for this feature, right now?"
 *
 * `hasIt` is the shop's MEASURED entitlement (its tier's cap, a promo, a paid
 * add-on). The answer is `true` only when the switch is ON **and** the shop
 * lacks the feature. While `VENDOR_TIER_FEATURE_GATE` is off (production today)
 * it is `false` for everyone — no "Upgrade", no ◆ mark, no refusal, no sentence
 * claiming the shop is hidden. That is the whole contract of the switch; a
 * surface that checks the tier WITHOUT asking here is a paywall the owner cannot
 * turn off (Creators was exactly that until 2026-09-30).
 *
 * When it answers `true`, a surface stays TRY-FIRST: the supplier may browse,
 * preview and draft; the ◆ mark is information, and only the final action
 * (Save / Send / Add / Run) asks for the plan.
 *
 * Server-only in practice: the switch is a server env var, so a client
 * component must receive this answer as a prop, never compute it.
 * Held by `app/vendor-dashboard/upsells-obey-the-switch.test.ts`.
 */
export function vendorPaywallApplies(hasIt: boolean): boolean {
  return !hasIt && isVendorFeatureGateEnabled();
}

/**
 * The allowance a shop gets for a COUNTED feature (team seats, waitlist places)
 * once the paywall question above is asked. A plan that includes the feature
 * keeps its own number, always. A plan whose number is 0 — i.e. the feature is
 * simply not in it — gets `entryAllowance` while the switch is off, because a
 * 0 there IS the paywall. `entryAllowance` is read from the tier table by the
 * caller (the smallest plan that includes the feature), never typed in.
 */
export function vendorAllowance(planAllowance: number, entryAllowance: number): number {
  if (planAllowance > 0) return planAllowance;
  return vendorPaywallApplies(false) ? planAllowance : entryAllowance;
}

/**
 * Resolve a vendor's EFFECTIVE feature tier. Base is `tier_state` (deliberately
 * NOT part of the shared `FULL_VENDOR_PROFILE_SELECT` — keeps the gate additive —
 * so read with a targeted single-column query on the PK). Defaults to `free`.
 *
 * Then a live admin vendor DEAL (promo_free_windows · flag
 * PROMO_FREE_WINDOWS_ENABLED) upgrades that tier for free while it lasts —
 * never a downgrade. Resolved PER VENDOR: only a vendor whose
 * `verification_state` is 'verified' ever qualifies (owner 2026-09-05: "all
 * vendors" means all VERIFIED vendors), and the `new_verified_vendors` cohort
 * needs sign-up (`created_at`) AND approval (`last_verified_at`) inside the
 * window — so those three facts ride the same single-row read as tier_state.
 * All 7 callers are feature gates (theft-watch, recaps, earnings, creators,
 * performance, calls, help routing), so the promotion is exactly the tier those
 * gates should see; billing/subscription surfaces read vendor_subscriptions
 * directly, not this. The promo read short-circuits to null when the flag is
 * off → byte-identical to today. See lib/promo-free-windows.ts.
 */
export async function resolveVendorTier(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorTier> {
  const { data } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state, created_at, last_verified_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const row = data as
    | ({ tier_state?: string | null } & Partial<VendorDealFacts>)
    | null;
  const realTier = asVendorTier(row?.tier_state);
  const facts: VendorDealFacts = {
    verification_state: row?.verification_state ?? null,
    created_at: row?.created_at ?? null,
    last_verified_at: row?.last_verified_at ?? null,
  };
  return applyVendorTierPromotion(realTier, await getPromotedVendorTierFor(facts));
}
