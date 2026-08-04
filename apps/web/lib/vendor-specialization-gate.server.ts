import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { asVendorTier, tierRank } from '@/lib/vendor-tier-caps';
import {
  resolveVendorSpecializationAccess,
  type VendorSpecializationAccess,
  type VendorSubscriptionState,
} from '@/lib/vendor-specialization-gate';

/**
 * Vendor specialization gate — the DB-touching half. Composes the pure rules in
 * `lib/vendor-specialization-gate.ts` over the vendor's REAL subscription row.
 *
 * WHICH RESOLVER. `resolveVendorTier` (lib/vendor-feature-gate.ts) — the
 * repo's existing "resolve a vendor's EFFECTIVE feature tier" function, already
 * the resolver behind every other vendor feature gate (theft-watch, recaps,
 * earnings, creators, performance, calls, help routing). Reusing it rather than
 * re-reading `tier_state` by hand is what makes this gate inherit the admin
 * FREE-WINDOW promotion (PROMOTED_VENDOR_TIER · PROMO_FREE_WINDOWS_ENABLED) for
 * free — load-bearing while free-during-launch is active, since a promoted
 * vendor must not lose specializations the promotion is meant to hand them.
 *
 * WHY A SECOND, NARROW READ. `resolveVendorTier` answers "what tier", not "is it
 * still in force" — it does not look at `tier_expires_at`. Lapse is login-driven
 * (`sweep_vendor_tier_expiry` runs on the vendor's next dashboard visit), so a
 * past-due vendor can still be carrying a paid `tier_state`. The owner's
 * mid-event-lapse requirement makes that case load-bearing, so we read the
 * expiry explicitly — one more single-row PK lookup, the same
 * `tier_state, tier_expires_at` pair `vendor-favorite-gate.ts` and
 * `enterprise-vendor-gate.ts` already read. No new table, no new column.
 *
 * READ-ONLY. Nothing here writes, and no state is derived from anything a
 * client can set.
 */

type TierRow = { tier_state: string | null; tier_expires_at: string | null };

/**
 * The vendor's live subscription state, ready to feed the pure gate.
 *
 * PROMOTION BEATS EXPIRY. When the resolver returns a tier ABOVE the row's own
 * `tier_state`, an admin free window is promoting this vendor. A promotion is a
 * GRANT, not a subscription — it carries no per-vendor expiry — so the row's
 * stale `tier_expires_at` must not cancel it. In that case we hand the gate a
 * null expiry. Otherwise the row's own expiry applies verbatim.
 *
 * Graceful degrade: a failed/missing read leaves `resolveVendorTier` at its own
 * `'free'` default and the expiry at null, so the gate returns the generic kit —
 * never an error, never a blank console.
 */
export async function fetchVendorSpecializationSubscription(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorSubscriptionState> {
  const effectiveTier = await resolveVendorTier(supabase, vendorProfileId);

  const { data } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();

  const row = (data as TierRow | null) ?? null;
  const rowTier = asVendorTier(row?.tier_state);
  const promoted = tierRank(effectiveTier) > tierRank(rowTier);

  return {
    tier_state: effectiveTier,
    tier_expires_at: promoted ? null : (row?.tier_expires_at ?? null),
  };
}

/**
 * One-call server gate: does this vendor get their category's specializations
 * right now? Resolves the live subscription, then applies the pure rules.
 *
 * Callers MUST gate the DATA on `access.unlockedSet` — hiding a tab is not a
 * boundary (2026-07-26 security review).
 */
export async function resolveVendorSpecializationAccessForVendor(
  supabase: SupabaseClient,
  vendorProfileId: string,
  args: {
    /** The vendor's canonical taxonomy tiles — `vendor_profiles.services[]`. */
    services: readonly string[] | null | undefined;
    /** Optional: narrow to the tiles booked on this event. */
    eventTiles?: readonly string[] | null;
  },
): Promise<VendorSpecializationAccess> {
  const subscription = await fetchVendorSpecializationSubscription(
    supabase,
    vendorProfileId,
  );
  return resolveVendorSpecializationAccess({
    subscription,
    services: args.services,
    eventTiles: args.eventTiles ?? null,
  });
}
