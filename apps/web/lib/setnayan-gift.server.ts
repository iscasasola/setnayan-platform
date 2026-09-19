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
  type GiftQuoteBasis,
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
  if (error) {
    console.error('[supabase-error] setnayan-gift: setnayan_gift_quote_applies (quote)', error);
    return null;
  }
  if (applies !== 'applies') return null;

  const [schedule, ladder] = await Promise.all([
    getBookingFeeSchedule(admin),
    fetchGiftLadder(admin),
  ]);
  if (!ladder) return null;

  const feeCentavos = Math.round(bookingFeePhp(args.amountCentavos / 100, schedule) * 100);
  const gift = setnayanGiftForFee(feeCentavos, ladder);
  return gift.credits > 0 ? gift : null;
}

/**
 * THE COMPOSER'S BASIS — everything the gift needs except the amount.
 *
 * `quoteSetnayanGift` above answers for ONE finished total. While a supplier is
 * still typing there is no finished total, and re-asking the server on every
 * keystroke would be both slow and wrong (the number would lag the field it is
 * describing). So the eligibility question — which only the database can answer
 * — is asked ONCE here, and the arithmetic travels to the browser with it.
 *
 * 🔑 THE ELIGIBILITY GATE IS NOT RELAXED BY MOVING THE MATHS. Every condition
 * `quoteSetnayanGift` applies is applied here, in the same order and with the
 * same failure direction: the fee flag, `setnayan_gift_quote_applies` (the
 * card's yes, a Setnayan-sourced client, outside the first five free bookings),
 * and a readable ladder. Any doubt returns `null` and the composer then says
 * NOTHING — never "0 photos", which would advertise an absence.
 *
 * ⚠ WHAT TRAVELS IS NOT SECRET. The fee schedule is owner-set and already shown
 * to suppliers, and the ladder is the public retail catalogue. No per-couple or
 * per-account fact crosses to the client — the one such fact, `applies`, is
 * consumed here and leaves only as the presence or absence of this object.
 *
 * MUST be called with the service-role client, and only after the caller has
 * proved the viewer is the supplier on this thread.
 */
export async function giftQuoteBasis(
  admin: SupabaseClient,
  args: { eventId: string; vendorProfileId: string },
): Promise<GiftQuoteBasis | null> {
  if (!isBookingFeeEnabled()) return null;
  if (!args.eventId || !args.vendorProfileId) return null;

  const { data: applies, error } = await admin.rpc('setnayan_gift_quote_applies', {
    p_event_id: args.eventId,
    p_vendor_profile_id: args.vendorProfileId,
  });
  // ⚠ Supabase RESOLVES with { error } — it does not throw.
  if (error) {
    console.error('[supabase-error] setnayan-gift: setnayan_gift_quote_applies (ladder)', error);
    return null;
  }
  if (applies !== 'applies') return null;

  const [schedule, ladder] = await Promise.all([
    getBookingFeeSchedule(admin),
    fetchGiftLadder(admin),
  ]);
  if (!ladder || ladder.length === 0) return null;
  return { schedule, ladder };
}
