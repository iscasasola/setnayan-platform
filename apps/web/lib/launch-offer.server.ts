import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { LaunchOfferSettings } from '@/lib/launch-offer';

/**
 * THE LAUNCH OFFER AS THE DATABASE HOLDS IT — `platform_settings` row 1 plus
 * the live count of bookings that took a place (migration 20271268832636).
 *
 * ⚠ NULL MEANS "WE COULD NOT READ IT", never "the offer is off". A caller that
 * must decide money (the supplier's forecast) says it could not check; a caller
 * that only shows (the admin page) says the read failed. The DECISION is never
 * made here — the SQL lock RPC makes it at the supplier's yes.
 *
 * Service-role: `platform_settings` is config, and the ledger count spans every
 * shop.
 */
export async function readLaunchOffer(admin: SupabaseClient): Promise<LaunchOfferSettings | null> {
  const [settings, count] = await Promise.all([
    admin
      .from('platform_settings')
      .select(
        'launch_offer_enabled, launch_offer_booking_cap, launch_offer_papic_credits, launch_offer_cycle_days, launch_offer_started_at, launch_offer_closed_at, launch_offer_pro_ends_at',
      )
      .eq('id', 1)
      .maybeSingle(),
    admin
      .from('booking_fee_ledger')
      .select('ledger_id', { count: 'exact', head: true })
      .eq('launch_offer', true),
  ]);
  if (settings.error) {
    logQueryError('launch-offer.settings', settings.error);
    return null;
  }
  if (count.error || typeof count.count !== 'number') {
    if (count.error) logQueryError('launch-offer.count', count.error);
    return null;
  }
  const r = (settings.data ?? {}) as Record<string, unknown>;
  const int = (v: unknown): number | null => {
    const n = Number(v);
    return v == null || !Number.isFinite(n) ? null : Math.trunc(n);
  };
  const ts = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    enabled: r.launch_offer_enabled === true,
    cap: int(r.launch_offer_booking_cap),
    papicCredits: int(r.launch_offer_papic_credits),
    cycleDays: int(r.launch_offer_cycle_days),
    startedAt: ts(r.launch_offer_started_at),
    closedAt: ts(r.launch_offer_closed_at),
    proEndsAt: ts(r.launch_offer_pro_ends_at),
    used: count.count,
  };
}

/** One read per render, for pages and the tier resolver. NULL on any failure. */
export const getLaunchOffer = cache(async (): Promise<LaunchOfferSettings | null> => {
  try {
    return await readLaunchOffer(createAdminClient());
  } catch {
    return null;
  }
});
