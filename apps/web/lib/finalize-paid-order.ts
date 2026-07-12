import 'server-only';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { isVatInclusiveServiceKey } from '@/lib/orders';
import { computeVatFromBase, computeVatFromGross } from '@/lib/receipts';
import { captureEvent } from '@/lib/analytics';
import {
  computePayoutBreakdown,
  dispatchVendorPayouts,
  getSetnayanFeeBps,
  phpToCentavos,
  resolveVendorVerificationState,
} from '@/lib/payouts';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
import { qualifyReferralOnFirstPaidOrder } from '@/lib/referrals';
import { appendLedger } from '@/lib/ledger';
import { activateOrderSku } from '@/lib/sku-activation';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { runPostPaidEffects } from '@/lib/paymongo-webhook-core';

/**
 * apps/web/lib/finalize-paid-order.ts
 *
 * The SHARED order-fulfillment tail, extracted VERBATIM from the admin
 * approvePayment() promote block so that MANUAL (admin reconciliation) and
 * AUTOMATED (PayMongo gateway webhook) fulfillment are byte-identical.
 *
 * finalizePaidOrder() runs the exact sequence that flips an order to "paid" and
 * fans out every downstream effect a paid order must have:
 *
 *   [webhook only] payments → matched  (+ 'payment_approved' ledger)
 *   orders → paid
 *   order_paid in-app notification (best-effort)
 *   couple-referral qualify (after(), best-effort)
 *   order_paid analytics event (best-effort)
 *   issueReceiptForOrder  (idempotent app receipt)
 *   schedulePayoutsForOrder (vendor payouts — no-op for couple SKUs)
 *   activateOrderSku  (per-SKU capability provisioning — non-fatal, idempotent)
 *
 * Whoever CONFIRMED the payment differs by lane, and that reconciliation half is
 * NOT part of this helper:
 *   • MANUAL (approvePayment): the admin flips THE specific payment → matched
 *     (with admin_notes + reviewed_by_user_id) and writes the 'payment_approved'
 *     ledger BEFORE calling this with alreadyMatchedPayment=true — so this helper
 *     does NOT touch payment rows on that lane (byte-identical to the old inline
 *     promote block, which never re-flipped payments).
 *   • WEBHOOK (checkout_session.payment.paid): there is no admin + no pre-flip, so
 *     this helper flips the order's pending payment(s) → matched itself
 *     (alreadyMatchedPayment=false) and writes the 'payment_approved' ledger with a
 *     'system' actor. Idempotency is the CALLER's job (the webhook route no-ops
 *     when the order is already paid) + the pending-only WHERE below.
 *
 * The order→paid update purposely has NO status WHERE guard — it mirrors the old
 * inline promote block exactly; callers own idempotency.
 */

export type FinalizePaidOrderContext = {
  /** The order being finalized. */
  orderId: string;
  /** Pre-fetched order fields the fulfillment tail reads. */
  order: {
    event_id: string | null;
    public_id: string | null;
    service_key: string | null;
  };
  /** The buyer (payments.user_id / orders.user_id) — gets the order_paid notice. */
  buyerUserId: string;
  /**
   * Ledger + payout actor. Manual = the approving admin's user_id ('admin');
   * webhook = the buyer's user_id with role 'system' (no admin is involved, and
   * order_ledger.actor_user_id is a valid-FK column, so the buyer is the least-
   * surprising non-null actor for an automated confirmation).
   */
  actorUserId: string;
  actorRole: 'admin' | 'system';
  /**
   * MANUAL lane passes true — approvePayment already flipped its specific payment
   * → matched and wrote the 'payment_approved' ledger, so this helper skips the
   * payment reconciliation entirely (byte-identical to the old promote block).
   * WEBHOOK lane passes false — this helper flips the order's pending payment(s)
   * and writes the ledger.
   */
  alreadyMatchedPayment: boolean;
  /**
   * Fallback amount (centavos) for the 'payment_approved' ledger when
   * alreadyMatchedPayment=false and no pending payment row is found. Ignored on
   * the manual lane.
   */
  fallbackAmountCentavos?: number | null;
  /**
   * The paid amount (PHP) for the 'order_paid' analytics event's `amount_php`
   * property. Manual lane threads the matched payment's amount_php verbatim
   * (byte-identical to the old promote block); webhook threads the gross paid.
   */
  amountPhp?: number | null;
  /**
   * WEBHOOK lane only: the PayMongo payment id (pay_…) that settled this order.
   * Stamped onto the order's matched payment row (payments.gateway_payment_id)
   * so a later refund can be issued against it via the gateway. Ignored on the
   * manual lane (undefined) + when alreadyMatchedPayment=true.
   */
  gatewayPaymentId?: string | null;
  /**
   * WEBHOOK lane only (Gap 6): the PayMongo processor fee (centavos) for this
   * charge, booked onto orders.gateway_fee_centavos so Setnayan's gateway cost
   * is visible in the ledger even for couple SKUs (schedulePayoutsForOrder
   * early-returns for non-vendor orders, so it never sets the fee otherwise).
   * Does NOT touch the buyer's OR/receipt. Undefined on the manual lane.
   */
  gatewayFeeCentavos?: number | null;
};

export async function finalizePaidOrder(
  admin: ReturnType<typeof createAdminClient>,
  ctx: FinalizePaidOrderContext,
): Promise<void> {
  const { orderId, order, buyerUserId, actorUserId, actorRole } = ctx;

  // ── (Webhook lane only) payment reconciliation ──────────────────────────
  // Flip the order's pending payment(s) → matched and write the
  // 'payment_approved' ledger. On the manual lane approvePayment already did
  // this for its specific payment, so we skip it (alreadyMatchedPayment=true).
  if (!ctx.alreadyMatchedPayment) {
    const nowIso = new Date().toISOString();
    // Stamp the PayMongo payment id (pay_…) onto the matched row when the webhook
    // supplied one, so a later gateway refund can be issued against it. Only set
    // it when present — a null would wipe a value on a re-run.
    const paymentUpdate: Record<string, unknown> = {
      status: 'matched',
      reviewed_at: nowIso,
      updated_at: nowIso,
    };
    if (ctx.gatewayPaymentId) {
      paymentUpdate.gateway_payment_id = ctx.gatewayPaymentId;
    }
    const { data: matched } = await admin
      .from('payments')
      .update(paymentUpdate)
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .select('payment_id, amount_php');
    const matchedRow = (matched ?? [])[0] as
      | { payment_id: string; amount_php: number | string }
      | undefined;
    await appendLedger(admin, {
      order_id: orderId,
      event_type: 'payment_approved',
      actor_user_id: actorUserId,
      actor_role: actorRole,
      amount_centavos: matchedRow
        ? Math.round(Number(matchedRow.amount_php) * 100)
        : ctx.fallbackAmountCentavos ?? null,
      payment_id: matchedRow?.payment_id ?? null,
      metadata: { service_key: order.service_key ?? null, source: 'gateway_webhook' },
    });
  }

  // ── Order → paid ─────────────────────────────────────────────────────────
  // Capture the update result. If this silently failed we'd notify the buyer
  // "your order is paid" while the DB row still says pending — and downstream
  // payout / receipt logic would diverge. Fail loudly so the caller can re-run
  // rather than leaking a half-promoted order. (Verbatim from approvePayment.)
  // Book the gateway processor fee (Gap 6) in the SAME promote write when the
  // webhook supplied one. For couple SKUs schedulePayoutsForOrder early-returns
  // (no vendor_profile_id) so it never sets this — without booking it here the
  // gateway cost is invisible in the ledger for couple orders. For vendor orders
  // schedulePayoutsForOrder recomputes + overwrites from the payout breakdown, so
  // stamping it here is harmless. The service-role admin client bypasses the
  // orders money-column write guard; the buyer's OR/receipt is untouched.
  const orderPromote: Record<string, unknown> = {
    status: 'paid',
    updated_at: new Date().toISOString(),
  };
  if (typeof ctx.gatewayFeeCentavos === 'number' && ctx.gatewayFeeCentavos >= 0) {
    orderPromote.gateway_fee_centavos = Math.round(ctx.gatewayFeeCentavos);
  }
  const { error: promoteErr } = await admin
    .from('orders')
    .update(orderPromote)
    .eq('order_id', orderId);
  if (promoteErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Finalize paid order — promote order to paid',
      file_path: 'lib/finalize-paid-order.ts',
      error_message: promoteErr.message,
      payload_snapshot: { orderId, serviceKey: order.service_key ?? null, actorRole },
    });
    throw new Error(`Failed to promote order ${orderId} to paid: ${promoteErr.message}`);
  }

  // Best-effort: the order is already promoted to 'paid'; a notification failure
  // must not surface as a hard error to the caller.
  try {
    await emitNotification({
      userId: buyerUserId,
      type: 'order_paid',
      title: `Order ${order.public_id ?? ''} marked paid`,
      body: "Your order is fully paid. We'll start work right away.",
      relatedUrl: order.event_id
        ? `/dashboard/${order.event_id}/orders/${orderId}`
        : null,
    });
  } catch (e) {
    console.error('order_paid notification failed (non-fatal):', e);
  }

  // Couple referral rewards — QUALIFYING EVENT is this buyer's FIRST PAID ORDER.
  // after() runs post-response so it never delays the caller; the helper is
  // best-effort, never throws, and idempotent.
  after(() => qualifyReferralOnFirstPaidOrder(buyerUserId));

  // Funnel event — fires the moment an order flips to paid.
  try {
    await captureEvent({
      distinctId: buyerUserId,
      event: 'order_paid',
      properties: {
        order_id: orderId,
        amount_php: ctx.amountPhp ?? null,
        sku_key: order.service_key ?? null,
      },
    });
  } catch {
    // analytics never breaks fulfillment.
  }

  // Receipt → payouts → SKU-activation tail, run through the pure M1 orchestrator
  // (lib/paymongo-webhook-core.ts · runPostPaidEffects). The ordering guarantee —
  // a receipt or payout failure is SWALLOWED (best-effort, idempotent,
  // back-fillable) so it can NEVER strand SKU activation (the one step that
  // grants the capability the buyer paid for) — lives there and is unit-tested
  // independently of Supabase. Byte-identical to the prior inline try/catch tail:
  //   • receipt: idempotent (UNIQUE receipts.order_id), non-fatal.
  //   • payouts: no-op unless linked to a vendor_profile, non-fatal.
  //   • activation: non-fatal by contract (never throws) + idempotent; NOT
  //     swallowed here so a hypothetical throw still surfaces.
  await runPostPaidEffects({
    issueReceipt: () => issueReceiptForOrder({ admin, orderId }),
    schedulePayouts: () => schedulePayoutsForOrder({ admin, orderId, actorUserId }),
    activateSku: () =>
      activateOrderSku({
        admin,
        orderId,
        eventId: order.event_id ?? null,
        serviceKey: order.service_key ?? '',
        actorUserId,
      }),
    onReceiptError: (e) => console.error('issueReceiptForOrder failed (non-fatal):', e),
    onPayoutError: (e) => console.error('vendor payout scheduling failed (non-fatal):', e),
  });
}

// ============================================================================
// issueReceiptForOrder — moved VERBATIM from app/admin/payments/actions.ts.
// ============================================================================
export async function issueReceiptForOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
}): Promise<void> {
  const { admin, orderId } = args;

  // Skip if a receipt was already issued for this order.
  const { data: existing } = await admin
    .from('receipts')
    .select('receipt_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return;

  const { data: order } = await admin
    .from('orders')
    .select('user_id, service_key, confirmed_total_php, requested_total_php, voucher_discount_centavos')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!order) return;

  // For customer SKUs the order's *_total_php fields are the **pre-VAT base**
  // (the value Setnayan quotes); VAT is added on top, so the buyer paid
  // base + 12%. For vendor charm prices the stored total is ALREADY the
  // all-in gross (VAT baked in) — see isVatInclusiveServiceKey.
  //
  // A BIR Official Receipt must reflect the amount actually paid.
  // `requested_total_php` is the PRE-voucher base, so a voucher-discounted order
  // whose `confirmed_total_php` is still NULL was getting a receipt overstating
  // the pre-VAT/VAT/gross. Mirror `orderGrossOwed`: net the voucher discount off
  // the requested base when not yet confirmed.
  const voucherDiscountPhp = Number(order.voucher_discount_centavos ?? 0) / 100;
  const storedTotal =
    order.confirmed_total_php != null
      ? Number(order.confirmed_total_php)
      : Math.max(0, Number(order.requested_total_php ?? 0) - voucherDiscountPhp);
  if (storedTotal <= 0) return;

  const { data: buyer } = await admin
    .from('users')
    .select('email, display_name')
    .eq('user_id', order.user_id)
    .maybeSingle();

  // VAT-inclusive vendor orders: back the VAT OUT of the gross so the receipt's
  // pre_vat + vat sum to the amount actually paid. Customer orders: build VAT UP
  // from the pre-VAT base, unchanged.
  const { preVat, vat, gross } = isVatInclusiveServiceKey(order.service_key)
    ? computeVatFromGross(storedTotal)
    : computeVatFromBase(storedTotal);

  // or_serial defaults from public.or_serial_seq (atomic) — don't pass it.
  await admin.from('receipts').insert({
    order_id: orderId,
    user_id: order.user_id,
    issued_to_email: buyer?.email ?? 'unknown@setnayan.com',
    issued_to_name: buyer?.display_name ?? null,
    pre_vat_php: preVat,
    vat_amount_php: vat,
    gross_total_php: gross,
  });
}

// ============================================================================
// schedulePayoutsForOrder — moved VERBATIM from app/admin/payments/actions.ts.
// ============================================================================
export async function schedulePayoutsForOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  actorUserId: string;
}): Promise<void> {
  const { admin, orderId, actorUserId } = args;

  // Pull the order + linked vendor + linked event date in one round-trip.
  const { data: orderRow } = await admin
    .from('orders')
    .select(
      `order_id, vendor_profile_id, confirmed_total_php, requested_total_php,
       setnayan_fee_bps, gateway_fee_centavos, payment_method_key, event_id,
       service_key,
       vendor:vendor_profiles!orders_vendor_profile_id_fkey(public_visibility),
       event:events!orders_event_id_fkey(event_date)`,
    )
    .eq('order_id', orderId)
    .maybeSingle();

  if (!orderRow) return;
  const row = orderRow as unknown as {
    order_id: string;
    vendor_profile_id: string | null;
    confirmed_total_php: number | null;
    requested_total_php: number;
    setnayan_fee_bps: number | null;
    gateway_fee_centavos: number | null;
    payment_method_key: string | null;
    event_id: string | null;
    service_key: string | null;
    vendor: { public_visibility: string | null } | null;
    event: { event_date: string | null } | null;
  };

  // Skip non-vendor orders silently — couples buying Setnayan SKUs don't
  // generate a vendor payout schedule.
  if (!row.vendor_profile_id) return;

  // MONEY-DIRECTION GUARD (M1): a vendor payout must only ever be dispatched for
  // a COUPLE BOOKING. A vendor BRANCH activation order runs the OTHER direction
  // (the vendor pays Setnayan). Those orders carry vendor_profile_id but NO
  // event_id, so both signals below mean "not a couple booking".
  const isBranchOrder =
    !!row.service_key && branchIdFromServiceKey(row.service_key) !== null;
  if (!row.event_id || isBranchOrder) return;

  const basePhp = Number(row.confirmed_total_php ?? row.requested_total_php ?? 0);
  if (basePhp <= 0) return;

  // Gross = pre-VAT base + 12% VAT (the customer pays gross).
  const { gross } = computeVatFromBase(basePhp);
  const grossCentavos = phpToCentavos(gross);

  // Effective convenience-fee bps: a per-order snapshot wins; otherwise the
  // admin-set platform fee (which falls back to the 5.0% constant when unset).
  const effectiveFeeBps = row.setnayan_fee_bps ?? (await getSetnayanFeeBps(admin));

  const breakdown = computePayoutBreakdown({
    grossCentavos,
    setnayanFeeBps: effectiveFeeBps,
    gatewayFeeCentavos: row.gateway_fee_centavos ?? undefined,
  });

  // Write the breakdown back onto the order row so receipts / vendor surfaces
  // can read it without re-computing.
  await admin
    .from('orders')
    .update({
      gateway_fee_centavos: breakdown.gatewayFeeCentavos,
      bir_withholding_centavos: breakdown.birWithholdingCentavos,
      vendor_net_centavos: breakdown.vendorNetCentavos,
      disbursement_fee_centavos: breakdown.disbursementFeeCentavos,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  const verificationState = resolveVendorVerificationState({
    public_visibility: row.vendor?.public_visibility ?? null,
  });

  await dispatchVendorPayouts(admin, {
    orderId,
    vendorProfileId: row.vendor_profile_id,
    verificationState,
    paidAt: new Date().toISOString(),
    eventDate: row.event?.event_date ?? null,
    breakdown,
    payoutMethod: 'maya_account',
    actorUserId,
  });
}
