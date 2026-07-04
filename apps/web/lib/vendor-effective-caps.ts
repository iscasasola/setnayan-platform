import type { SupabaseClient } from '@supabase/supabase-js';
import {
  tierCaps,
  asVendorTier,
  type TierCaps,
  type VendorTier,
} from './vendor-tier-caps';
import type { CustomComposition } from './vendor-custom-pricing';

/**
 * Effective vendor capability caps = the static tier caps, with an ACTIVE
 * Custom plan's composition overlaid on the numeric ceilings.
 *
 * For every tier EXCEPT `custom`, this is exactly `tierCaps(tier)` — no overlay.
 * For `custom` (which runs as an Enterprise clone, see vendor-tier-caps.ts), an
 * active `vendor_custom_plans` row RAISES the numeric axes the vendor composed:
 *   - seats   (agentAccounts)   = base 10 + extra seats
 *   - reach   (serviceRadiusKm) = nationwide → Infinity, else the composed km
 *   - slots   (slotsPerDay)     = the composed slots/category
 *   - photos  (portfolioPhotos) = the composed photo total
 * Feature/boolean axes are untouched — Custom already has them all via the clone.
 *
 * The overlay is a pure function of (tier, composition); {@link fetchEffectiveCaps}
 * does the DB read (active plan) and defers to it. Missing/!custom → base caps.
 */

/**
 * Overlay an (optional) Custom composition onto a tier's caps. Pure. Only the
 * `custom` tier reads the composition; every other tier returns its base caps
 * unchanged even if a composition is (nonsensically) passed.
 */
export function vendorEffectiveCaps(
  tier: string | null | undefined,
  composition?: CustomComposition | null,
): TierCaps {
  const t: VendorTier = asVendorTier(tier);
  const base = tierCaps(t);
  if (t !== 'custom' || !composition) return base;

  const c = composition;

  // seats: base agentAccounts (10) + composed extra seats above the base 10.
  const composedSeats = Number.isFinite(c.seats) ? Math.floor(c.seats) : base.agentAccounts;
  const agentAccounts = Number.isFinite(base.agentAccounts)
    ? Math.max(base.agentAccounts, composedSeats)
    : base.agentAccounts;

  // reach: nationwide → Infinity; else the composed km (never below the base).
  const composedReach = Number.isFinite(c.reachKm) ? c.reachKm : base.serviceRadiusKm;
  const serviceRadiusKm = c.nationwide
    ? Infinity
    : Math.max(base.serviceRadiusKm, composedReach);

  // slots per category → slotsPerDay axis (never below base).
  const composedSlots = Number.isFinite(c.slotsPerCategory)
    ? Math.floor(c.slotsPerCategory)
    : base.slotsPerDay;
  const slotsPerDay = Math.max(base.slotsPerDay, composedSlots);

  // photos (never below base).
  const composedPhotos = Number.isFinite(c.photos) ? Math.floor(c.photos) : base.portfolioPhotos;
  const portfolioPhotos = Math.max(base.portfolioPhotos, composedPhotos);

  return {
    ...base,
    agentAccounts,
    serviceRadiusKm,
    slotsPerDay,
    portfolioPhotos,
  };
}

/**
 * DB-backed effective caps: reads the vendor's ACTIVE Custom plan (if any) and
 * overlays its composition. Soft: any read failure (table missing pre-migration,
 * RLS, no active plan) falls back to the base tier caps rather than throwing.
 *
 * Non-`custom` tiers skip the read entirely — they can never have an overlay.
 */
export async function fetchEffectiveCaps(
  supabase: SupabaseClient,
  vendorProfileId: string,
  tier: string | null | undefined,
): Promise<TierCaps> {
  const t = asVendorTier(tier);
  if (t !== 'custom') return tierCaps(t);
  try {
    const { data, error } = await supabase
      .from('vendor_custom_plans')
      .select('composition')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return tierCaps(t);
    const composition = (data as { composition?: CustomComposition | null }).composition ?? null;
    return vendorEffectiveCaps(t, composition);
  } catch {
    return tierCaps(t);
  }
}
