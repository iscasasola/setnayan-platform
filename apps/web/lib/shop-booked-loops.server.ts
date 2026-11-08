import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🔁 BOOKED LOOP — the counter the badge needs (THE ONE BUILD, spec plans/supplier_one_build_2026-11-08 §9 #11).
 *
 * `public.shop_booked_loop_count(vendor)` (migration 20271327129110): how many FAMILIES booked this shop on two or more
 * events — a booking is a live, non-fraud, non-self booking linked to the shop; two partners of one wedding are one
 * family. service_role only, so call it with the ADMIN client (the badge readers already do).
 *
 * NULL = unread — the badge is then HIDDEN, never shown as "not yet reached" (spec §9 #11). C4 flips Booked Loop to
 * `measured: true` only where it reads this.
 */
export async function readShopBookedLoopCount(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { data, error } = await admin.rpc('shop_booked_loop_count', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError('badges.bookedLoopCount', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const n = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}
