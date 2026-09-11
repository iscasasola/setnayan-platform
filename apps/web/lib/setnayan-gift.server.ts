import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp } from '@/lib/booking-fee';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import {
  giftLadderFrom,
  setnayanGiftForFee,
  type GiftCatalogRow,
  type GiftRung,
  type GiftTierRow,
  type SetnayanGift,
} from '@/lib/setnayan-gift';

/**
 * The Setnayan gift, as a QUOTE shows it — the I/O half of lib/setnayan-gift.ts.
 *
 * ⚖ Owner 2026-09-09: *"the NUMBER appears on the QUOTE, not the card … the
 * moment a price exists — the proposal or the agreed figure — the exact photo
 * count is known and is the strongest line on it."*
 *
 * The count is shown ONLY when the bill will really carry it, which the
 * database answers (`setnayan_gift_quote_applies`, migration 20271222508050):
 * the booking's own card said yes, the client is Setnayan-sourced, and the
 * booking falls outside the supplier's first five free ones — "no fee. no
 * gift." A count promised on a booking that will never be billed for it would
 * be exactly the silent broken promise the owner warned about, so every doubt
 * (flag off, a refused read, an empty ladder) answers NOTHING, never a number.
 *
 * The arithmetic is the SAME as the bill's: the fee from lib/booking-fee.ts
 * under the LIVE owner-set schedule, the ladder read now from the catalog, and
 * `setnayanGiftForFee` — the mirror the db test pins to the SQL that prices
 * the supplier's order.
 *
 * MUST be called with the service-role client, and only AFTER the caller has
 * proved the viewer may see the quote (the proposal page's own RLS read does).
 */

/** The live gift ladder, or null when either table could not be read. */
export async function fetchGiftLadder(admin: SupabaseClient): Promise<GiftRung[] | null> {
  const [catalog, tiers] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active, retired_at')
      .like('service_code', 'PAPIC_GUEST%'),
    admin
      .from('papic_pass_tiers')
      .select('service_code, points, is_active, is_topup')
      .like('service_code', 'PAPIC_GUEST%'),
  ]);
  // ⚠ Supabase RESOLVES with { error } — it does not throw.
  if (catalog.error || tiers.error) return null;
  return giftLadderFrom(
    (catalog.data ?? []) as GiftCatalogRow[],
    (tiers.data ?? []) as GiftTierRow[],
  );
}

/**
 * The gift a quote of `amountCentavos` from this supplier to this event would
 * carry — or null when the quote must say nothing about a gift.
 */
export async function quoteSetnayanGift(
  admin: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; amountCentavos: number },
): Promise<SetnayanGift | null> {
  if (!isBookingFeeEnabled()) return null; // no fee is ever billed ⇒ no gift
  if (!Number.isFinite(args.amountCentavos) || args.amountCentavos <= 0) return null;

  const { data: applies, error } = await admin.rpc('setnayan_gift_quote_applies', {
    p_event_id: args.eventId,
    p_vendor_profile_id: args.vendorProfileId,
  });
  if (error || applies !== 'applies') return null;

  const [schedule, ladder] = await Promise.all([
    getBookingFeeSchedule(admin),
    fetchGiftLadder(admin),
  ]);
  if (!ladder) return null;

  const feeCentavos = Math.round(bookingFeePhp(args.amountCentavos / 100, schedule) * 100);
  const gift = setnayanGiftForFee(feeCentavos, ladder);
  return gift.credits > 0 ? gift : null;
}
