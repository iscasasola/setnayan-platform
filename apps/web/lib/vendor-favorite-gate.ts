import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';

/**
 * Vendor-favorites subscription gate — the SINGLE SOURCE OF TRUTH for "may this
 * vendor be shown as a favorite / saved right now?"
 *
 * Owner-locked 2026-07-18 (corpus DECISION_LOG): a vendor may be SEEN as a
 * favorite / saved only while they hold an ACTIVE PAID subscription (Solo ₱999+
 * / Pro / Enterprise / Custom). The moment a subscription lapses to a free tier
 * the vendor's favorite is hidden from every couple/coordinator saved list —
 * IMMEDIATELY, no grace — but the underlying favorite ROW is never deleted, so
 * it reappears automatically when the vendor re-subscribes ("will only return if
 * subscribed again"). The favoriter sees the card silently disappear (no
 * placeholder); the vendor stays discoverable via normal search score.
 *
 * DESIGN — hiding is a READ-TIME FILTER, never a write. Lapse does NOTHING to
 * favorites data; visibility is recomputed on every read from the vendor's live
 * subscription state. That makes restore a no-op (re-subscribe just flips the
 * predicate back) and leaves no cron/batch window in which a lapsed vendor's
 * favorite could leak. Every couple/coordinator favorites-display loader MUST
 * run its vendor ids through {@link filterFavoritableVendorIds}; the source-scan
 * guard in `vendor-favorite-gate.test.ts` fails CI if a Library favorites loader
 * skips it.
 *
 * The vendor-side "Saved" COUNT is deliberately NOT gated — it reads the raw
 * tables via the `count_saves_for_vendor` SECURITY DEFINER RPC, so the vendor
 * keeps seeing the TRUE, preserved count (that count is the N in the
 * re-subscribe nudge email).
 *
 * ACTIVATION — server-only flag `VENDOR_FAVORITES_SUBSCRIPTION_GATE`, default
 * OFF. While OFF every vendor is favoritable. This is load-bearing: during
 * free-during-launch every vendor is on a free tier, so an active gate would
 * make NO vendor favoritable and blank the marketplace. Flip to 'true' only once
 * paid vendor subscriptions are mandatory (owner sign-off pending).
 *
 * Kept free of `import 'server-only'` on purpose: the predicate is pure and the
 * client is passed in (never constructed here), so the module carries no secret
 * and stays unit-testable under `tsx --test`. Its only callers are server-only
 * data loaders.
 */

/** Server-only activation flag. Default OFF → no vendor is ever hidden. */
export function favoritesSubscriptionGateEnabled(): boolean {
  return process.env.VENDOR_FAVORITES_SUBSCRIPTION_GATE === 'true';
}

export type VendorSubRow = {
  tier_state: string | null;
  tier_expires_at: string | null;
};

/**
 * The predicate: does this vendor hold an ACTIVE PAID subscription as of `now`?
 *
 * Paid = Solo or above (Solo / Pro / Enterprise / Custom). `free` and `verified`
 * are free tiers. `tier_expires_at` is checked EXPLICITLY because lapse is
 * login-driven (`sweep_vendor_tier_expiry` runs on the vendor's next dashboard
 * visit), so a past-due vendor can still carry a paid `tier_state` with an
 * elapsed expiry until they next log in — mirrors `enterprise-vendor-gate.ts`. A
 * NULL expiry = never expires (admin-granted / off-platform comp tier).
 */
export function vendorHoldsActivePaidSub(
  row: VendorSubRow,
  now: number = Date.now(),
): boolean {
  if (!isTierAtLeast(row.tier_state, 'solo')) return false;
  return !row.tier_expires_at || new Date(row.tier_expires_at).getTime() > now;
}

/**
 * Given a set of vendor_profile_ids, return the subset that may be shown as a
 * favorite. When the gate flag is OFF this is the identity (every id passes —
 * launch-safe): no read, no filtering. When ON, only vendors holding an active
 * paid subscription pass; the rest are silently dropped from the caller's
 * favorites list (their favorite rows are untouched and return on re-subscribe).
 *
 * The caller passes its already-constructed admin (service-role) client — the
 * favorites loaders already read these vendors through the admin path for card
 * hydration, so this adds only one narrow `tier_state, tier_expires_at` read and
 * opens no new RLS surface.
 *
 * Fail-OPEN on a read error: a transient DB blip must not blank a couple's
 * deliberately-saved list. The gate is a monetization nudge, not a security
 * boundary, so "show" beats "wrongly hide" when the subscription state can't be
 * read. (Ids absent from the result — e.g. a deleted profile — are treated as
 * not-favoritable, matching card hydration, which drops unknown ids anyway.)
 */
export async function filterFavoritableVendorIds(
  admin: SupabaseClient,
  vendorIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(vendorIds)].filter(Boolean);
  if (ids.length === 0) return new Set();
  if (!favoritesSubscriptionGateEnabled()) return new Set(ids);

  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, tier_state, tier_expires_at')
    .in('vendor_profile_id', ids);

  if (error || !data) return new Set(ids); // fail-open — see doc above

  const now = Date.now();
  const visible = new Set<string>();
  for (const r of data as (VendorSubRow & { vendor_profile_id: string })[]) {
    if (vendorHoldsActivePaidSub(r, now)) visible.add(r.vendor_profile_id);
  }
  return visible;
}
