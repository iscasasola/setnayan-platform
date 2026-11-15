import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import type { GiftsToBookings } from '@/lib/graph-unlocks';

/**
 * The two J5 reads (migration 20271348267938). Both take the ADMIN client and a shop id the page has already resolved
 * from the session (the `readShopTrackerFacts` pattern); both functions are service_role only.
 *
 * 🔑 A refused read is `null`, never zeros: the adapter (`graphUnlocks`) treats an unread fact as "we don't know" and
 * keeps the graphs showing; the gifts graph shows its "Couldn't load" state. 🔒 lib/graph-unlocks.test.ts
 */

export type UnlockRead = { kept: boolean; trustedBy: number | null; earned: string[] };

/** The keep marker, the Trusted-by count and every badge step ever earned — one round trip. */
export async function readGraphUnlockFacts(admin: SupabaseClient, vendorProfileId: string): Promise<UnlockRead | null> {
  const { data, error } = await admin.rpc('shop_graph_unlock_facts', { p_vendor_profile_id: vendorProfileId });
  if (error || !data || typeof data !== 'object') {
    if (error) logQueryError('graphUnlocks.facts', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const f = data as { kept?: unknown; trusted_by?: unknown; earned?: unknown };
  return {
    kept: f.kept === true,
    trustedBy: typeof f.trusted_by === 'number' ? f.trusted_by : null,
    earned: Array.isArray(f.earned) ? f.earned.filter((k): k is string => typeof k === 'string') : [],
  };
}

/** The "Gifts given → bookings" graph for one window; read only when Gifts given Bronze has opened it. */
export async function readGiftsToBookings(admin: SupabaseClient, vendorProfileId: string, sinceIso: string): Promise<GiftsToBookings | null> {
  const { data, error } = await admin.rpc('shop_gifts_to_bookings', {
    p_vendor_profile_id: vendorProfileId,
    p_since: sinceIso,
    p_booked_statuses: [...BOOKED_EVENT_VENDOR_STATUSES],
  });
  if (error || !data || typeof data !== 'object') {
    if (error) logQueryError('graphUnlocks.gifts', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const g = data as Record<string, unknown>;
  const n = (k: string): number | null => (typeof g[k] === 'number' && Number.isFinite(g[k]) ? (g[k] as number) : null);
  const giftedBooked = n('gifted_booked');
  const giftedDeciding = n('gifted_deciding');
  const plainBooked = n('plain_booked');
  const plainDeciding = n('plain_deciding');
  const freeStock = n('free_stock');
  // Any one number missing = the whole graph is unread — never a part drawn as 0.
  if (giftedBooked === null || giftedDeciding === null || plainBooked === null || plainDeciding === null || freeStock === null) return null;
  return { giftedBooked, giftedDeciding, plainBooked, plainDeciding, freeStock };
}
