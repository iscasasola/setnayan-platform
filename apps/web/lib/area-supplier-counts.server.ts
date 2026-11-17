import 'server-only';
import { createAdminClient } from './supabase/admin';
import { logQueryError } from './supabase/error-detect';
import { countSuppliersByArea, type AreaPoint, type AreaShop } from './area-supplier-counts';

/**
 * 📍 THE ONE GROUPED READ behind "Areas that fit" (owner 2026-11-17): every live shop's pin (verified + publicly visible), tier and
 * declared rings, counted against the areas the Where step offers (`countSuppliersByArea`). The rows are public facts
 * of public shops; the admin client is used because `vendor_profiles` rings are not all on the public projection.
 *
 * 🔴 A REFUSED READ IS NULL, NEVER AN EMPTY MAP — the step then says it could not count, instead of ranking every area
 * at zero (the "a failure that renders as emptiness" rule, lib/guests.ts).
 */
export async function readAreaSupplierCounts(areas: readonly AreaPoint[]): Promise<Record<string, number> | null> {
  const { data, error } = await createAdminClient()
    .from('vendor_profiles')
    .select('hq_latitude, hq_longitude, tier_state, inner_radius_km, outer_radius_km')
    // A LIVE shop, in the one definition (lib/one-definition-of-live.test.ts) — what /admin/verify writes and what
    // /explore and the public-read policy filter on. Never the dead `is_published`.
    .eq('public_visibility', 'verified')
    .eq('verification_state', 'verified');
  if (error || !data) {
    logQueryError('readAreaSupplierCounts', error, {}, 'graceful_degrade');
    return null;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const shops: AreaShop[] = (data as Array<Record<string, unknown>>).map((r) => ({
    lat: num(r.hq_latitude),
    lon: num(r.hq_longitude),
    tier: typeof r.tier_state === 'string' ? r.tier_state : null,
    innerKm: num(r.inner_radius_km),
    outerKm: num(r.outer_radius_km),
  }));
  return Object.fromEntries(countSuppliersByArea(shops, areas));
}
