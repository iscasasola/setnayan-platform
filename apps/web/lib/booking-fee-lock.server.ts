import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBookingFeeEnabled, BOOKING_FEE_SCHEDULE_VERSION } from '@/lib/booking-fee-gate';
import { bookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
// `booking-fee.ts` is a pure value → value module (no I/O, no `server-only`),
// so importing it from this `.server.ts` file is fine in both directions.
import { bookingFeeScheduleSummary } from '@/lib/booking-fee';

/**
 * Collect the vendor Booking Fee AT LOCK — the DB-touching half of the LOCK
 * path. Composes the free-5 charge RPC with a vendor-payer `orders` row on the
 * existing manual GCash/BDO QR rail.
 *
 * SHIP-DARK CONTRACT: a pure NO-OP unless NEXT_PUBLIC_BOOKING_FEE_ENABLED is on.
 * When off it returns immediately without touching the DB, so finalizeVendor is
 * byte-behaviour-identical to today. It is ALSO a no-op for off-platform vendors
 * (no marketplace_vendor_id → the RPC returns skipped:'not_verified_vendor') and
 * for a verified vendor's first 5 booked customers (free-5 → a waived charge,
 * NO order). Only booking 6+ with a positive fee mints an order.
 *
 * Idempotent by construction:
 *   • the RPC opens at most ONE live charge per (vendor × event) — a re-lock
 *     returns the SAME charge (reused:true) with the SAME frozen ordinal;
 *   • the order is keyed on service_key = `vendor_booking_fee__{chargeId}`, so a
 *     re-lock (same charge) resolves the SAME service_key and we skip re-issuing.
 *
 * MUST be called with the SERVICE-ROLE admin client (the RPC is service_role-only
 * and the order is written for the VENDOR as payer, bypassing couple-scoped RLS).
 * Fully fail-soft at the call site: the lock already committed, so any hiccup here
 * must never roll it back.
 */
export type CollectBookingFeeResult =
  | { status: 'disabled' }
  | { status: 'skipped'; reason: string }
  | { status: 'free'; chargeId: string; bookingOrdinal: number }
  | { status: 'zero_fee'; chargeId: string }
  | { status: 'order_exists'; chargeId: string; orderId: string }
  | { status: 'no_payer'; chargeId: string }
  | { status: 'ordered'; chargeId: string; orderId: string; referenceCode: string; amountPhp: number };

/** 'SN' + 8 uppercase hex — the shared reference-code shape (createOrder / ai-addon). */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export async function collectBookingFeeAtLock(
  admin: SupabaseClient,
  args: { eventVendorId: string },
): Promise<CollectBookingFeeResult> {
  // ⚠ ONE KEY, NOT TWO. This path is gated by NEXT_PUBLIC_BOOKING_FEE_ENABLED
  // ALONE. `isBookingFeeEnforced()` — the genuine two-key check (flag AND
  // RAIL_LIVE) — belongs to the DORMANT PayMongo send-gate and is not consulted
  // here, deliberately: the manual QR rail is always live, so this path needs no
  // rail flag. Flipping that single env var therefore starts billing vendors on
  // the next lock of a sourced booking — it writes a real `orders` row plus a
  // `payments` row into /admin/payments (see below). Treat the flag as the whole
  // safety margin.
  //
  // This comment used to OPEN with "Two-key belt:" and only then walk it back.
  // A spec written from it inherited the wrong claim (corrected 2026-07-27,
  // Integration_Contract_Booking_x_Explore §4). A comment that opens with a
  // reassurance it then contradicts is worse than no comment — the reader stops
  // at the reassurance.
  if (!isBookingFeeEnabled()) return { status: 'disabled' };

  const { data, error } = await admin.rpc('booking_fee_open_lock_charge', {
    p_event_vendor_id: args.eventVendorId,
    p_schedule_version: BOOKING_FEE_SCHEDULE_VERSION,
  });
  if (error || !data) {
    // Fail-open: a transient RPC error must never trap the (already committed)
    // lock. The next lock/re-lock re-attempts; nothing double-charges.
    return { status: 'skipped', reason: error?.message ?? 'rpc_null' };
  }

  const res = data as {
    skipped?: string;
    charge_id?: string;
    status?: string;
    amount_charged_centavos?: number;
    booking_ordinal?: number;
  };

  if (res.skipped) return { status: 'skipped', reason: res.skipped };
  const chargeId = res.charge_id!;

  // Free-5 / ₱0 booking → a charge row exists for audit, but no money, no order.
  if (res.status === 'waived_free5') {
    return { status: 'free', chargeId, bookingOrdinal: res.booking_ordinal ?? 0 };
  }
  if (res.status !== 'pending' || !res.amount_charged_centavos || res.amount_charged_centavos <= 0) {
    return { status: 'zero_fee', chargeId };
  }

  const serviceKey = bookingFeeLockServiceKey(chargeId);

  // Idempotency: one order per charge. A re-lock returns the same chargeId →
  // same serviceKey → skip re-issuing (belt over the RPC's own one-live-charge).
  const { data: existingOrder } = await admin
    .from('orders')
    .select('order_id')
    .eq('service_key', serviceKey)
    .limit(1)
    .maybeSingle();
  if (existingOrder) {
    return { status: 'order_exists', chargeId, orderId: (existingOrder as { order_id: string }).order_id };
  }

  // Resolve the (vendor, event) + the VENDOR user as payer.
  const { data: charge } = await admin
    .from('booking_fee_charges')
    .select('event_id, vendor_profile_id')
    .eq('charge_id', chargeId)
    .maybeSingle();
  const eventId = (charge as { event_id?: string } | null)?.event_id ?? null;
  const vendorProfileId = (charge as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;

  let payerUserId: string | null = null;
  if (vendorProfileId) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    payerUserId = (vp as { user_id?: string | null } | null)?.user_id ?? null;
  }
  // Unclaimed (admin-owned) vendor profile → no payer. Charge stays pending for
  // ops to resolve once the vendor claims; never strand the lock.
  if (!payerUserId) return { status: 'no_payer', chargeId };

  const amountPhp = Math.round(res.amount_charged_centavos) / 100;
  const referenceCode = generateReferenceCode();

  // Vendor-payer order on the manual QR rail. `vendor_`-prefixed service_key →
  // VAT-INCLUSIVE (isVatInclusiveServiceKey): the fee IS the gross the vendor
  // pays, no VAT built on top. Description carries the 24-hr verification SLA.
  //
  // ⚠ The parenthetical is DERIVED from the fee constants, never typed. It used
  // to read a hard-coded "(5%)", which is only true at or below ₱100,000 — past
  // the 2026-07-25 taper a ₱1M booking is billed ₱14,000 (1.40%), so the money
  // document the vendor reads overstated its own rate. Keep it derived: a
  // reprice must move the copy with the math, in one place.
  const { data: orderRow, error: oErr } = await admin
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: payerUserId,
      vendor_profile_id: vendorProfileId,
      service_key: serviceKey,
      description: `Setnayan booking fee (${bookingFeeScheduleSummary()}) — up for verification, confirmation within 24 hrs`,
      requested_total_php: amountPhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    // The charge remains pending; a re-lock re-attempts the order. Non-fatal.
    return { status: 'skipped', reason: oErr?.message ?? 'order_insert_failed' };
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  // A pending payment row so the order lands in the /admin/payments queue and
  // the existing reconcile → approvePaymentCore → activateOrderSku settle bridge
  // fires on approval (mirrors ai-addon-actions). Channel 'manual' (BDO/GCash).
  const { error: pErr } = await admin.from('payments').insert({
    order_id: orderId,
    user_id: payerUserId,
    amount_php: amountPhp,
    channel: 'manual',
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    // Roll back the just-created order so a retry re-mints cleanly (the charge
    // stays live; the next lock re-issues). Best-effort.
    await admin.from('orders').delete().eq('order_id', orderId);
    return { status: 'skipped', reason: pErr.message };
  }

  return { status: 'ordered', chargeId, orderId, referenceCode, amountPhp };
}
