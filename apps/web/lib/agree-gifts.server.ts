import 'server-only';
import { isStoreShellRequest } from '@/lib/request-platform';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp } from '@/lib/booking-fee';
import { feeBaseTotalPhp, resolveBookingFeeStanding } from '@/lib/booking-fee-disclosure.server';
import { getGiftLimitPct } from '@/lib/gift-limit-settings.server';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { fetchEventGiftHolds, fetchShopGiftPacks, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind } from '@/lib/shop-gifts';
import type { AgreeGiftBasis } from '@/lib/agree-gifts';

/**
 * GIFT FOR SERVICES — the I/O half of `lib/agree-gifts.ts`.
 *
 * EVERY booking carries at least one gift (owner 20 Nov, no exceptions): found, imported, free-fee or paid-fee. So the
 * picker is offered on every Agree — the limit sized on the fee the booking carries or WOULD carry (a ₱0 booking's limit
 * is 0, and the smallest Papic pack alone still fits). Each gift comes from the shop's free stock or from a store
 * payment that was SENT ("Waiting for approval", `shop_gift_sent_order_lines`); anything else is bought in the
 * "Your gifts" store first (21 Nov). Nothing is ever bought on the booking-fee bill (16 Nov ee10c425).
 *
 * A failed read is null: the picker then says it could not read the gifts, and the yes is refused by the SQL door's
 * dry run anyway — never a booking with no gift.
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
    if (!eventId) return null;
    const total = Math.max(0, Number(totalPhp) || 0);
    const standing = await resolveBookingFeeStanding(admin, { vendorProfileId: args.vendorProfileId, eventId });
    if (standing.kind === 'unreadable') return null;
    const schedule = standing.kind === 'billable' ? standing.schedule : await getBookingFeeSchedule(admin);
    const feeCentavos = total > 0 ? Math.max(0, Math.round(bookingFeePhp(total, schedule) * 100)) : 0;

    const [packs, limitPct, stock, eventHas, sentRead] = await Promise.all([
      fetchShopGiftPacks(admin),
      getGiftLimitPct(admin),
      // Every event's holds counted (no exception): this event's own quote holds are already promised to it.
      fetchShopGiftStock(admin, args.vendorProfileId, null),
      fetchEventGiftHolds(admin, eventId, 'owned'),
      admin.rpc('shop_gift_sent_order_lines', { p_vendor_profile_id: args.vendorProfileId }),
    ]);
    if (!packs || packs.length === 0) return null;
    let sent: Record<string, number> | null = {};
    if (sentRead.error) {
      console.error('[supabase-error] agree-gifts: sent order lines', sentRead.error);
      sent = null;
    } else {
      for (const row of (sentRead.data ?? []) as Array<{ service_code?: string | null }>) {
        const code = row.service_code ?? '';
        if (code) sent[code] = (sent[code] ?? 0) + 1;
      }
    }
    const storeShell = await isStoreShellRequest();
    return { packs, feeCentavos, limitPct, free: freeByKind(stock), eventHas, sent, canBuy: !storeShell };
  } catch (e) {
    console.error('[agree-gifts] basis read failed', e);
    return null;
  }
}

/**
 * 🎁 AN AGREED BOOKING WITH NO GIFT LEFT (21 Nov, controller): its store payment was refused or refunded, so every pick
 * on it was cleared. Returns this shop's booking on this event in that state, with the basis its picker needs; null
 * when there is none, or when it cannot be read (the row then simply is not drawn — the admin clearing already told
 * the shop in-app). Service-role, after the page proved the caller owns the shop.
 */
export async function fetchGiftNeeded(
  admin: SupabaseClient,
  args: { vendorProfileId: string | null | undefined; eventId: string },
): Promise<{ eventVendorId: string; basis: AgreeGiftBasis } | null> {
  if (!args.vendorProfileId) return null;
  try {
    const { data: rows, error } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', args.eventId)
      .eq('marketplace_vendor_id', args.vendorProfileId)
      .not('lock_agreed_at', 'is', null);
    if (error) throw error;
    const ids = ((rows ?? []) as Array<{ vendor_id: string }>).map((r) => r.vendor_id);
    if (ids.length === 0) return null;
    const { data: lines, error: lErr } = await admin
      .from('booking_gift_lines')
      .select('event_vendor_id, cleared_at')
      .in('event_vendor_id', ids);
    if (lErr) throw lErr;
    const live = new Set<string>();
    const cleared = new Set<string>();
    for (const l of (lines ?? []) as Array<{ event_vendor_id: string; cleared_at: string | null }>) {
      (l.cleared_at ? cleared : live).add(l.event_vendor_id);
    }
    const needs = ids.find((id) => cleared.has(id) && !live.has(id));
    if (!needs) return null;
    const basis = await fetchAgreeGiftBasis(admin, { vendorProfileId: args.vendorProfileId, eventVendorId: needs });
    return basis ? { eventVendorId: needs, basis } : null;
  } catch (e) {
    console.error('[agree-gifts] gift-needed read failed', e);
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
  'unknown_pack',
  'already_has',
  'one_plan',
  'over_limit',
  'too_many',
  'needs_stock',
  'bad_input',
]);

/**
 * Judge (`dryRun`) or record the gifts picked at the yes, with the codes the picker posted (`gift`, one per pack).
 *
 *   · BEFORE the yes, `dryRun: true` — the door judges everything from a fresh read and writes nothing; anything but
 *     `ok` refuses Agree with nothing booked (20 Nov: every booking needs at least 1 gift).
 *   · AFTER the yes (the fee is minted), the real pick. It can only fail now if stock moved in between; the booking
 *     stands and its gift row asks again ("Needs at least 1 gift. Buy one ›").
 *
 * Never throws; an unknown answer is `error`.
 */
export async function recordAgreeGifts(
  admin: SupabaseClient,
  args: { eventVendorId: string; codes: readonly string[]; dryRun?: boolean },
): Promise<{ status: string; codes: string[] }> {
  const codes = args.codes.filter((c) => typeof c === 'string' && /^[A-Z0-9_]{1,64}$/.test(c));
  if (codes.length === 0) return { status: 'none', codes: [] };
  try {
    const { data: ev, error: evError } = await admin
      .from('event_vendors')
      .select('event_id')
      .eq('vendor_id', args.eventVendorId)
      .maybeSingle();
    const eventId = (ev as { event_id?: string | null } | null)?.event_id ?? null;
    if (evError || !eventId) return { status: 'error', codes: [] };
    const eventHas = await fetchEventGiftHolds(admin, eventId, 'owned');
    const { data, error } = await admin.rpc('booking_gift_pick', {
      p_event_vendor_id: args.eventVendorId,
      p_codes: codes,
      p_event_has: eventHas,
      p_dry_run: args.dryRun === true,
    });
    if (error) {
      console.error('[agree-gifts] booking_gift_pick failed', error);
      return { status: 'error', codes: [] };
    }
    const res = (data ?? {}) as { status?: string; codes?: unknown };
    const status = PICK_STATUSES.has(res.status ?? '') ? res.status! : 'error';
    const missing = Array.isArray(res.codes) ? res.codes.filter((c): c is string => typeof c === 'string') : [];
    return { status, codes: missing };
  } catch (e) {
    console.error('[agree-gifts] booking_gift_pick threw', e);
    return { status: 'error', codes: [] };
  }
}

/**
 * The codes the yes judges: the picker's `gift` fields, or — on a form with no picker (Today's card, the chat's blocker
 * row) — the PRE-FILL, the smallest Papic pack on sale (owner 20 Nov: "pre-filled with the smallest Papic pack"). Never
 * empty while a pack is on sale; empty only when none is, and the door then refuses (`none`).
 */
export async function agreeGiftCodesOrPrefill(admin: SupabaseClient, formData: FormData): Promise<string[]> {
  const posted = formData.getAll('gift').filter((v): v is string => typeof v === 'string' && /^[A-Z0-9_]{1,64}$/.test(v));
  if (posted.length > 0) return posted;
  const { data, error } = await admin.rpc('shop_gift_smallest_papic_pack');
  if (error) {
    console.error('[supabase-error] agree-gifts: smallest pack', error);
    return [];
  }
  const row = (Array.isArray(data) ? data[0] : data) as { service_code?: string | null } | null;
  return row?.service_code ? [row.service_code] : [];
}
