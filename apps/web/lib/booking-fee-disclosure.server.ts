import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { chargeIdFromBookingFeeLockServiceKey, isFreeBooking } from '@/lib/booking-fee-lock';
import { agreedTotalNow, type ChangeLineRow } from '@/lib/agreed-total-and-its-changes';
import {
  fetchVendorFeeOrders,
  FEE_ORDERS_UNREADABLE,
} from '@/lib/vendor-booking-fees.server';
import { isFeeOrderPayable } from '@/lib/vendor-booking-fees';
import {
  bookingFeeForecast,
  type BookingFeeStanding,
  type DueFeeBill,
  type WaivedFeeCharge,
} from '@/lib/booking-fee-disclosure';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The DB half of the booking-fee disclosure — resolves WHERE A SUPPLIER STANDS
 * and WHAT THEY OWE. Every sentence and every peso figure is composed by the
 * pure `lib/booking-fee-disclosure.ts`; this module only fetches the facts it
 * needs and never formats one itself.
 *
 * READ-ONLY with respect to the fee: it opens no charge, mints no order and
 * mutates no fee table. The charge path is `lib/booking-fee-lock.server.ts`.
 */

/** Sentinel for "the read failed" — never `[]`, which renders as "you owe nothing". */
export const FEE_BILLS_UNREADABLE = 'unreadable' as const;

/**
 * WHERE THIS SHOP STANDS on one booking, mirroring the arms of
 * `booking_fee_open_lock_charge` (verified against the LIVE function with
 * `pg_get_functiondef`, 2026-09-20 — not against the migration file).
 *
 * The ordinal is read the way the RPC assigns it:
 *   · a `booking_fee_ledger` row already exists for (vendor, event) → its
 *     `booking_ordinal` is FROZEN and is the answer;
 *   · otherwise the next booking's ordinal is this vendor's lock-ledger row
 *     count + 1, exactly the `count(*) … <= (created_at, ledger_id)` the RPC
 *     runs for a new row.
 *
 * ⚠ THE LEDGER, NOT `event_vendors`. `lib/vendor-addon-first5-free.ts` counts
 * bookings instead and documents why (the ledger was empty while the fee flag
 * was off). That reasoning is right for an ADD-ON price and wrong here: this
 * function must agree with the number the supplier is actually BILLED on, and
 * that number comes off the ledger.
 *
 * ⚠ A refused read returns `'unreadable'`, never `'free'`. Telling a supplier a
 * booking is free because a query failed is the exact shape of failure this
 * whole lane exists to remove.
 */
export async function resolveBookingFeeStanding(
  admin: SupabaseClient,
  args: { vendorProfileId: string | null | undefined; eventId: string | null | undefined },
): Promise<BookingFeeStanding> {
  if (!isBookingFeeEnabled()) return { kind: 'silent' };
  if (!args.vendorProfileId) return { kind: 'silent' };

  // Attribution: 'import' (a client the shop brought) carries no fee, ever. The
  // SQL function IS the rule — re-implementing `inquiry_source` matching in TS
  // would be a second source of truth for who counts as Setnayan-sourced.
  if (args.eventId) {
    const { data: attribution, error: aErr } = await admin.rpc(
      'booking_fee_attribution_for',
      { p_vendor_profile_id: args.vendorProfileId, p_event_id: args.eventId },
    );
    if (aErr) {
      logQueryError('booking-fee-disclosure: attribution', aErr);
      return { kind: 'unreadable' };
    }
    if (attribution === 'import') return { kind: 'not_sourced' };
  }

  // The frozen ordinal for THIS booking, if the ledger already holds one.
  // ⚠ THE LEDGER IS ASKED FIRST, ALWAYS (owner, 2026-09-20: the position must
  // come from the real ordinal, not a count derived here). The count below is
  // reached ONLY when no ledger row exists yet — i.e. the booking has not been
  // agreed, so there is no real ordinal to read — and what it produces is
  // flagged as a projection, which the copy words differently.
  let ordinal: number | null = null;
  let ordinalIsFrozen = false;
  if (args.eventId) {
    const { data: row, error } = await admin
      .from('booking_fee_ledger')
      .select('booking_ordinal')
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('event_id', args.eventId)
      .maybeSingle();
    if (error) {
      logQueryError('booking-fee-disclosure: ledger row', error);
      return { kind: 'unreadable' };
    }
    const n = (row as { booking_ordinal?: number | null } | null)?.booking_ordinal;
    if (typeof n === 'number' && Number.isFinite(n)) {
      ordinal = n;
      ordinalIsFrozen = true;
    }
  }

  // No frozen ordinal → this booking would take the NEXT one.
  if (ordinal === null) {
    const { count, error } = await admin
      .from('booking_fee_ledger')
      .select('ledger_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('source', 'lock');
    if (error || typeof count !== 'number' || !Number.isFinite(count)) {
      if (error) logQueryError('booking-fee-disclosure: ledger count', error);
      return { kind: 'unreadable' };
    }
    ordinal = count + 1;
  }

  // ⚠ THE SCHEDULE IS READ FOR THE FREE ARM TOO. A waived booking must still
  // NAME the amount it would have cost (owner 2026-09-20), and without the live
  // schedule that figure cannot be computed — the copy would fall back to a
  // bare "Free", which is what the ruling forbids.
  const schedule = await getBookingFeeSchedule(admin);
  return isFreeBooking(ordinal)
    ? { kind: 'free', ordinal, ordinalIsFrozen, schedule }
    : { kind: 'billable', ordinal, ordinalIsFrozen, schedule };
}

/**
 * The agreed total NOW for one booking — the figure the RPC prices the fee on
 * (`total_cost_php` plus the `is_change_delta` lines, floored at zero).
 *
 * Returns null when the row or its change lines could not be read, and the
 * forecast then prints the schedule WITHOUT a peso figure rather than a figure
 * computed from half the inputs.
 */
export async function feeBaseTotalPhp(
  admin: SupabaseClient,
  eventVendorId: string,
): Promise<{ totalPhp: number | null; eventId: string | null }> {
  const { data: row, error } = await admin
    .from('event_vendors')
    .select('vendor_id,total_cost_php,event_id')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (error || !row) {
    if (error) logQueryError('booking-fee-disclosure: booking row', error);
    return { totalPhp: null, eventId: null };
  }
  const r = row as { total_cost_php?: number | string | null; event_id?: string | null };
  const { data: lines, error: lErr } = await admin
    .from('event_vendor_line_items')
    .select('amount_php,is_change_delta')
    .eq('vendor_id', eventVendorId)
    .eq('is_change_delta', true);
  if (lErr) {
    logQueryError('booking-fee-disclosure: change lines', lErr);
    return { totalPhp: null, eventId: r.event_id ?? null };
  }
  return {
    totalPhp: agreedTotalNow(r.total_cost_php ?? null, (lines ?? []) as ChangeLineRow[]),
    eventId: r.event_id ?? null,
  };
}

/**
 * THE ONE ENTRY POINT FOR "WHAT WILL THIS BOOKING COST ME?" — used by all three
 * Agree buttons (the Today feed card, the client page's answer panel and the
 * chat card), so the three cannot word or price it differently.
 *
 * Fails to a sentence, never to silence-by-accident: a throw anywhere resolves
 * to the `unreadable` disclosure, which says we could not check rather than
 * implying there is no fee.
 */
export async function forecastForBooking(
  admin: SupabaseClient,
  args: { vendorProfileId: string | null | undefined; eventVendorId: string },
) {
  try {
    const { totalPhp, eventId } = await feeBaseTotalPhp(admin, args.eventVendorId);
    const standing = await resolveBookingFeeStanding(admin, {
      vendorProfileId: args.vendorProfileId,
      eventId,
    });
    return bookingFeeForecast(standing, totalPhp);
  } catch {
    return bookingFeeForecast({ kind: 'unreadable' }, null);
  }
}

/**
 * The same forecast for several bookings at once, keyed by `event_vendors.vendor_id`
 * — the Today feed can carry more than one booking ask.
 */
export async function forecastsForBookings(
  admin: SupabaseClient,
  args: { vendorProfileId: string | null | undefined; eventVendorIds: readonly string[] },
): Promise<Record<string, ReturnType<typeof bookingFeeForecast>>> {
  const ids = Array.from(new Set(args.eventVendorIds.filter(Boolean)));
  const out: Record<string, ReturnType<typeof bookingFeeForecast>> = {};
  if (ids.length === 0) return out;
  const results = await Promise.all(
    ids.map((id) =>
      forecastForBooking(admin, { vendorProfileId: args.vendorProfileId, eventVendorId: id }),
    ),
  );
  ids.forEach((id, i) => {
    out[id] = results[i] ?? null;
  });
  return out;
}

/**
 * EVERY WAIVED BOOKING FEE THIS SHOP HAS HAD — the free-5 charges, with the
 * amount each WOULD have cost and the position the RPC stamped.
 *
 * 🔴 THESE HAD NO SUPPLIER SURFACE AT ALL. A waived charge mints no `orders`
 * row, and every fee surface read orders — so a shop's free bookings appeared
 * nowhere, and "free" was something the supplier had to infer from silence.
 *
 * ⚠ THE ORDINAL COMES OFF THE LEDGER, by join, never by counting rows here.
 * ⚠ `computed_fee_centavos` is the recorded "would have been" (prod's waived
 *   charge carries 50850 against `amount_charged_centavos` 0); a row whose
 *   column is missing or non-finite carries `computedPhp: null`, and the copy
 *   then prints no number rather than ₱0.
 *
 * Service-role read, explicitly scoped to this shop's `vendor_profile_id` —
 * `booking_fee_charges` is not readable from a supplier session. The caller has
 * already proven the profile is theirs (`fetchOwnVendorProfile`).
 */
export async function fetchWaivedFeeCharges(
  admin: SupabaseClient,
  vendorProfileId: string | null | undefined,
): Promise<WaivedFeeCharge[] | typeof FEE_BILLS_UNREADABLE> {
  if (!isBookingFeeEnabled()) return [];
  if (!vendorProfileId) return [];
  const { data, error } = await admin
    .from('booking_fee_charges')
    .select(
      'charge_id,event_id,computed_fee_centavos,created_at,ledger:booking_fee_ledger!inner(booking_ordinal)',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'waived_free5')
    .order('created_at', { ascending: false });
  if (error) {
    logQueryError('booking-fee-disclosure: waived charges', error);
    return FEE_BILLS_UNREADABLE;
  }
  const rows = (data ?? []) as Array<{
    charge_id: string;
    event_id: string | null;
    computed_fee_centavos: number | string | null;
    created_at: string | null;
    ledger: { booking_ordinal: number | null } | Array<{ booking_ordinal: number | null }> | null;
  }>;
  if (rows.length === 0) return [];

  const eventIds = Array.from(
    new Set(rows.map((r) => r.event_id).filter((id): id is string => !!id)),
  );
  const nameByEvent = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data: events, error: eErr } = await admin
      .from('events')
      .select('event_id,display_name')
      .in('event_id', eventIds);
    if (eErr) logQueryError('booking-fee-disclosure: waived event names', eErr);
    for (const e of (events ?? []) as Array<{ event_id: string; display_name: string | null }>) {
      nameByEvent.set(e.event_id, e.display_name);
    }
  }

  return rows.map((r): WaivedFeeCharge => {
    // PostgREST returns an embedded to-one as an object, but as an ARRAY when it
    // cannot prove the relationship is to-one. Both shapes are handled so the
    // ordinal does not silently vanish into `undefined`.
    const led = Array.isArray(r.ledger) ? r.ledger[0] : r.ledger;
    const ord = led?.booking_ordinal;
    const centavos = Number(r.computed_fee_centavos);
    return {
      chargeId: r.charge_id,
      eventId: r.event_id ?? null,
      coupleName: r.event_id ? (nameByEvent.get(r.event_id) ?? null) : null,
      computedPhp: Number.isFinite(centavos) ? centavos / 100 : null,
      ordinal: typeof ord === 'number' && Number.isFinite(ord) ? ord : null,
      waivedOn: r.created_at ? r.created_at.slice(0, 10) : null,
    };
  });
}

/**
 * The live owner-set schedule for the JOIN disclosure — three outcomes, kept
 * distinct on purpose:
 *   · `'off'`  — the fee system is dark. There is nothing to disclose; say
 *                nothing. (Not the same as a failed read.)
 *   · schedule — the owner's live numbers.
 *   · `null`   — the read FAILED. The disclosure then still runs and says so,
 *                because "we could not load the rate" is a true sentence and
 *                silence would imply there is no fee.
 */
export async function readBookingFeeJoinSchedule(): Promise<
  BookingFeeSchedule | 'off' | null
> {
  if (!isBookingFeeEnabled()) return 'off';
  try {
    return await getBookingFeeSchedule(createAdminClient());
  } catch {
    return null;
  }
}

/**
 * EVERY UNPAID BOOKING-FEE BILL THIS SHOP HOLDS, enriched with the due date and
 * the couple's name so a row can say WHO it is for and WHEN it is due.
 *
 * The orders themselves come from `fetchVendorFeeOrders`, which uses the
 * CALLER-scoped client — RLS (`user_id = auth.uid()`) is what makes "only your
 * own fees" true rather than a filter anyone could forget. The two enrichment
 * reads use the service-role client because `booking_fee_charges` and `events`
 * are not readable by a supplier session, and both are explicitly narrowed to
 * the ids the caller's own orders named.
 *
 * ⚠ UNREADABLE IS NOT EMPTY. A refused read returns the sentinel so the mounts
 * render nothing rather than an implicit "you owe nothing" — and a missing
 * ENRICHMENT (no charge row, no event name) degrades the ROW, never the list:
 * a bill with an unknown due date still says the supplier owes the money.
 */
export async function fetchDueFeeBills(
  supabase: SupabaseClient,
  userId: string,
): Promise<DueFeeBill[] | typeof FEE_BILLS_UNREADABLE> {
  if (!isBookingFeeEnabled()) return [];
  const orders = await fetchVendorFeeOrders(supabase, userId);
  if (orders === FEE_ORDERS_UNREADABLE) return FEE_BILLS_UNREADABLE;

  const due = orders.filter((o) => isFeeOrderPayable(o.status));
  if (due.length === 0) return [];

  const admin = createAdminClient();

  const chargeIds = due
    .map((o) => chargeIdFromBookingFeeLockServiceKey(o.service_key))
    .filter((id): id is string => !!id);
  const dueByCharge = new Map<string, string | null>();
  if (chargeIds.length > 0) {
    const { data, error } = await admin
      .from('booking_fee_charges')
      .select('charge_id,expires_at')
      .in('charge_id', chargeIds);
    if (error) logQueryError('booking-fee-disclosure: charge expiry', error);
    for (const c of (data ?? []) as Array<{ charge_id: string; expires_at: string | null }>) {
      dueByCharge.set(c.charge_id, c.expires_at ? c.expires_at.slice(0, 10) : null);
    }
  }

  const eventIds = Array.from(
    new Set(due.map((o) => o.event_id).filter((id): id is string => !!id)),
  );
  const nameByEvent = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data, error } = await admin
      .from('events')
      .select('event_id,display_name')
      .in('event_id', eventIds);
    if (error) logQueryError('booking-fee-disclosure: event names', error);
    for (const e of (data ?? []) as Array<{ event_id: string; display_name: string | null }>) {
      nameByEvent.set(e.event_id, e.display_name);
    }
  }

  return due.map((o): DueFeeBill => {
    const chargeId = chargeIdFromBookingFeeLockServiceKey(o.service_key);
    return {
      orderId: o.order_id,
      amountPhp: Number(o.confirmed_total_php ?? o.requested_total_php ?? 0),
      eventId: o.event_id ?? null,
      coupleName: o.event_id ? (nameByEvent.get(o.event_id) ?? null) : null,
      dueOn: chargeId ? (dueByCharge.get(chargeId) ?? null) : null,
    };
  });
}
