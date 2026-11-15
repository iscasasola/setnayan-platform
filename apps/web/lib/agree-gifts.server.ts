import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp } from '@/lib/booking-fee';
import { feeBaseTotalPhp, resolveBookingFeeStanding } from '@/lib/booking-fee-disclosure.server';
import { getGiftLimitPct } from '@/lib/gift-limit-settings.server';
import { fetchEventGiftHolds, fetchShopGiftPacks, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind } from '@/lib/shop-gifts';
import type { AgreeGiftBasis } from '@/lib/agree-gifts';

/**
 * GIFT FOR SERVICES — the I/O half of `lib/agree-gifts.ts`.
 *
 * The picker opens only where the yes will raise a BILL: a billable booking that is not a free, promo or badge-reward
 * one ("no fee, no gift", 2026-09-09 — there is nothing to add a bought gift to, and nothing to size it by). Every
 * other answer is null and the Agree step looks exactly as it did. A failed read is null too — the picker then says
 * nothing rather than offer a limit computed from half the inputs; the SQL door would refuse the pick anyway.
 *
 * MUST be called with the service-role client (the catalogue's `retired_at` is not granted to a session), after the
 * page proved the caller owns this shop.
 */
export async function fetchAgreeGiftBasis(
  admin: SupabaseClient,
  args: { vendorProfileId: string | null | undefined; eventVendorId: string },
): Promise<AgreeGiftBasis | null> {
  if (!args.vendorProfileId) return null;
  try {
    const { totalPhp, eventId } = await feeBaseTotalPhp(admin, args.eventVendorId);
    const total = Number(totalPhp);
    if (!eventId || !Number.isFinite(total) || total <= 0) return null;
    const standing = await resolveBookingFeeStanding(admin, { vendorProfileId: args.vendorProfileId, eventId });
    if (standing.kind !== 'billable' || standing.badgeReward) return null;
    const feeCentavos = Math.round(bookingFeePhp(total, standing.schedule) * 100);
    if (feeCentavos <= 0) return null;

    const [packs, limitPct, stock, eventHas] = await Promise.all([
      fetchShopGiftPacks(admin),
      getGiftLimitPct(admin),
      // Every event's holds counted (no exception): this event's own quote holds are already promised to it.
      fetchShopGiftStock(admin, args.vendorProfileId, null),
      fetchEventGiftHolds(admin, eventId, 'owned'),
    ]);
    if (!packs || packs.length === 0) return null;
    return { packs, feeCentavos, limitPct, free: freeByKind(stock), eventHas };
  } catch (e) {
    console.error('[agree-gifts] basis read failed', e);
    return null;
  }
}

/** The SQL door's answers this file knows. Anything else is reported as `error`. */
const PICK_STATUSES = new Set([
  'ok',
  'none',
  'already',
  'no_booking',
  'not_agreed',
  'no_bill',
  'unknown_pack',
  'already_has',
  'one_plan',
  'over_limit',
  'too_many',
  'bad_input',
]);

/**
 * Record the gifts picked at the yes — called by `vendorAgreeToLock` AFTER the booking is agreed and its fee minted,
 * with the codes the picker posted (`gift`, one per pack). The door re-prices and re-judges everything from a fresh
 * read; what the screen drew is never trusted. Never throws: the booking is already agreed, and a gift hiccup must not
 * undo it — the answer is said back on the card instead.
 */
export async function recordAgreeGifts(
  admin: SupabaseClient,
  args: { eventVendorId: string; codes: readonly string[] },
): Promise<string> {
  const codes = args.codes.filter((c) => typeof c === 'string' && /^[A-Z0-9_]{1,64}$/.test(c));
  if (codes.length === 0) return 'none';
  try {
    const { data: ev, error: evError } = await admin
      .from('event_vendors')
      .select('event_id')
      .eq('vendor_id', args.eventVendorId)
      .maybeSingle();
    const eventId = (ev as { event_id?: string | null } | null)?.event_id ?? null;
    if (evError || !eventId) return 'error';
    const eventHas = await fetchEventGiftHolds(admin, eventId, 'owned');
    const { data, error } = await admin.rpc('booking_gift_pick', {
      p_event_vendor_id: args.eventVendorId,
      p_codes: codes,
      p_event_has: eventHas,
    });
    if (error) {
      console.error('[agree-gifts] booking_gift_pick failed', error);
      return 'error';
    }
    const status = (data as { status?: string } | null)?.status ?? '';
    return PICK_STATUSES.has(status) ? status : 'error';
  } catch (e) {
    console.error('[agree-gifts] booking_gift_pick threw', e);
    return 'error';
  }
}
