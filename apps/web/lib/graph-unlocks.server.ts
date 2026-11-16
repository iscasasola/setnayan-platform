import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { GIFT_POINT_EXAMPLES, type GiftsToBookings } from '@/lib/graph-unlocks';
import { giftPointsForPrice } from '@/lib/gift-points';

/**
 * The two J5 reads (migration 20271348267938). Both take the ADMIN client and a shop id the page has already resolved
 * from the session (the `readShopTrackerFacts` pattern); both functions are service_role only.
 *
 * 🔑 A refused read is `null`, never zeros: the adapter (`graphUnlocks`) treats an unread fact as "we don't know" and
 * keeps the graphs showing; the gifts graph shows its "Couldn't load" state. 🔒 lib/graph-unlocks.test.ts
 */

export type UnlockRead = { kept: boolean; earned: string[] };

/**
 * The keep marker and every badge step ever earned — one round trip. The COUNTS are main's own readers
 * (badge-rewards.server.ts), never re-derived here. A malformed answer (no `earned` list, a non-string key) is a failed
 * read — null, "Couldn’t load" — never `[]`, which would read as "earned nothing" and lock graphs.
 */
export async function readGraphUnlockFacts(admin: SupabaseClient, vendorProfileId: string): Promise<UnlockRead | null> {
  const { data, error } = await admin.rpc('shop_graph_unlock_facts', { p_vendor_profile_id: vendorProfileId });
  if (error || !data || typeof data !== 'object') {
    if (error) logQueryError('graphUnlocks.facts', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const f = data as { kept?: unknown; earned?: unknown };
  if (typeof f.kept !== 'boolean' || !Array.isArray(f.earned) || !f.earned.every((k) => typeof k === 'string')) {
    console.error('[graphUnlocks.facts] malformed answer', { vendorProfileId });
    return null;
  }
  return { kept: f.kept, earned: f.earned as string[] };
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

/**
 * The drawing's worked examples ("a Papic 1000 is 50 points, an Event Plus 300"), each from its catalog price
 * (`platform_retail_catalog_v2` — the only price) through `giftPointsForPrice`. null = unread: the line leaves them out.
 */
export async function readGiftPointExamples(admin: SupabaseClient): Promise<Array<{ name: string; points: number }> | null> {
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, retail_price_php')
    .in('service_code', GIFT_POINT_EXAMPLES.map((e) => e.code));
  if (error) {
    logQueryError('graphUnlocks.giftExamples', error, {}, 'graceful_degrade');
    return null;
  }
  const priceOf = new Map(((data ?? []) as Array<{ service_code: string; retail_price_php: number | string | null }>).map((r) => [r.service_code, Number(r.retail_price_php)]));
  const out: Array<{ name: string; points: number }> = [];
  for (const e of GIFT_POINT_EXAMPLES) {
    const points = giftPointsForPrice(priceOf.get(e.code));
    if (points === null) return null;
    out.push({ name: e.name, points });
  }
  return out;
}
