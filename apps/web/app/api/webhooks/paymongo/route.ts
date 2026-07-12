import { NextResponse, type NextRequest, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePayMongoWebhookSecrets } from '@/lib/integration-config';
import { finalizePaidOrder } from '@/lib/finalize-paid-order';
import { notifyVendorTokensCredited } from '@/lib/token-purchase-notify';
import { emitNotification } from '@/lib/notification-emit';
import { deactivateOrderSku } from '@/lib/sku-activation';
import { formatPhp } from '@/lib/orders';
import {
  verifyPayMongoSignature,
  classifyPayMongoEvent,
  extractEventEnvelope,
  extractReference,
  extractGatewayPaymentInfo,
  extractReferencedPaymentId,
  extractRefundId,
  extractInnerStatus,
  deriveGatewayFeeCentavos,
  isTerminalPaidOrderStatus,
  markWebhookEventProcessed,
  unmarkWebhookEventProcessed,
} from '@/lib/paymongo-webhook-core';

export const runtime = 'nodejs';

/**
 * PayMongo webhook → one-time payment fulfillment + money-path reconciliation.
 *
 * Structurally mirrors /api/webhooks/token-purchase (fail-closed 503 when
 * unprovisioned · after() post-response notify · 200/401/500 discipline so the
 * provider retries only real server errors) — BUT the signature verify is
 * PayMongo's scheme (see lib/paymongo-webhook-core.ts), NOT the token webhook's
 * simple x-setnayan-signature HMAC (copying that verbatim would ACCEPT FORGED
 * events).
 *
 * SIGNATURE (PayMongo): header 'Paymongo-Signature: t=<ts>,te=<test-hmac>,
 *   li=<live-hmac>'. HMAC-SHA256 over "<ts>.<raw-body>" with the WEBHOOK SIGNING
 *   SECRET (test vs live), timing-safe compared against te / li, AND the signed
 *   timestamp must be within the freshness tolerance (replay defense). No secret
 *   configured → 503 (inert). Bad/absent/stale signature → 401.
 *
 * DEDUP (hardening): every signature-verified delivery is check-and-inserted
 *   into public.processed_webhook_events keyed by (provider,event_id). A second
 *   delivery of the same evt_… id is deduped by DELIVERY ID and acked 200 with
 *   no re-processing — not only by order status (which the paid lane also guards
 *   on). A RETRYABLE (5xx) failure UNMARKS the id so PayMongo's retry isn't
 *   dedup-swallowed.
 *
 * LANES (classifyPayMongoEvent):
 *   • paid    → checkout_session.payment.paid → finalizePaidOrder (couple SN…)
 *               or confirm_vendor_token_purchase_by_reference (vendor TKN…). The
 *               couple lane also books the gateway payment id + processor fee.
 *   • failed  → payment.failed → record + notify the buyer (NO fulfillment).
 *   • refund  → refund.updated/refunded → reconcile order_refunds + order status.
 *   • dispute → dispute.* / chargeback.* → flag for admin + notify.
 *   • ignore  → any other event → ack 200 so PayMongo stops retrying.
 *
 * NEVER trusts the browser return_url as proof of payment — this webhook is the
 * only thing that flips an order to paid. Idempotent throughout.
 */

const PROVIDER = 'paymongo';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secrets = await resolvePayMongoWebhookSecrets();
  if (!secrets.test && !secrets.live) {
    // Inert until provisioned — fail closed (never fulfill without a secret).
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const raw = await request.text();
  const provided = request.headers.get('paymongo-signature') ?? '';
  if (!verifyPayMongoSignature(raw, provided, secrets)) {
    return NextResponse.json({ ok: false, reason: 'bad_signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const { eventId, eventType } = extractEventEnvelope(payload);
  const admin = createAdminClient();

  // ── Dedup (hardening): dedup by DELIVERY ID before any side effect ─────────
  const dedup = await markWebhookEventProcessed(admin, {
    provider: PROVIDER,
    eventId,
    eventType,
  });
  if (dedup === 'duplicate') {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  // Any 5xx (retryable) response must UNMARK the delivery so PayMongo's retry
  // isn't dedup-swallowed. 200/4xx are terminal — keep the marker.
  const retryable = async (bodyStatus: { ok: false; reason: string }, status: number) => {
    await unmarkWebhookEventProcessed(admin, { provider: PROVIDER, eventId });
    return NextResponse.json(bodyStatus, { status });
  };

  const lane = classifyPayMongoEvent(eventType);

  // ── payment.failed → record + notify (NO fulfillment) ──────────────────────
  if (lane === 'failed') {
    Sentry.addBreadcrumb({
      category: 'webhook',
      level: 'warning',
      message: 'paymongo payment.failed',
      data: { eventId },
    });
    const reference = extractReference(payload);
    if (reference && reference.startsWith('SN')) {
      const { data: order } = await admin
        .from('orders')
        .select('order_id, event_id, public_id, user_id, status')
        .eq('reference_code', reference)
        .maybeSingle();
      // Only ping the buyer while the order is still pre-paid — never contradict
      // an order another payment already settled.
      if (order && !isTerminalPaidOrderStatus(order.status)) {
        after(async () => {
          try {
            await emitNotification({
              userId: order.user_id as string,
              type: 'payment_rejected',
              title: `A payment attempt didn't go through`,
              body: 'Your online payment could not be completed. You can try again, or pay via GCash / BDO from the order page.',
              relatedUrl: order.event_id
                ? `/dashboard/${order.event_id}/orders/${order.order_id}`
                : null,
            });
          } catch (e) {
            console.error('payment.failed notify (non-fatal):', e);
          }
        });
      }
    }
    return NextResponse.json({ ok: true, recorded: 'payment_failed' }, { status: 200 });
  }

  // ── refund.* → reconcile order_refunds + order status ──────────────────────
  if (lane === 'refund') {
    const status = extractInnerStatus(payload); // succeeded / pending / failed
    // Only a settled refund reconciles the order; pending/failed just ack.
    if (status !== 'succeeded' && status !== 'refunded') {
      return NextResponse.json({ ok: true, ignored: 'refund_not_settled', status }, { status: 200 });
    }
    const order = await lookupOrderForRefundOrDispute(admin, payload);
    if (!order) {
      return NextResponse.json({ ok: true, ignored: 'refund_unmapped' }, { status: 200 });
    }
    const refundId = extractRefundId(payload);
    try {
      await reconcileGatewayRefund(admin, { order, refundId, payload });
    } catch (e) {
      Sentry.captureException(e, { tags: { webhook: 'paymongo', lane: 'refund' } });
      return retryable({ ok: false, reason: 'refund_reconcile_failed' }, 500);
    }
    return NextResponse.json({ ok: true, reconciled: 'refund' }, { status: 200 });
  }

  // ── dispute.* / chargeback.* → flag for admin + notify ─────────────────────
  if (lane === 'dispute') {
    const order = await lookupOrderForRefundOrDispute(admin, payload);
    try {
      await flagDisputeForAdmins(admin, { order, eventType, payload });
    } catch (e) {
      Sentry.captureException(e, { tags: { webhook: 'paymongo', lane: 'dispute' } });
      return retryable({ ok: false, reason: 'dispute_flag_failed' }, 500);
    }
    return NextResponse.json({ ok: true, flagged: 'dispute' }, { status: 200 });
  }

  // ── ignore → ack so PayMongo stops retrying an event we don't handle ───────
  if (lane === 'ignore') {
    return NextResponse.json(
      { ok: true, ignored: 'unhandled_event', type: eventType },
      { status: 200 },
    );
  }

  // ── paid → fulfill (the ONLY lane that flips an order to paid) ──────────────
  const reference = extractReference(payload);
  if (!reference) {
    Sentry.addBreadcrumb({
      category: 'webhook',
      level: 'warning',
      message: 'paymongo webhook: no SN/TKN reference found',
    });
    // 200 so the provider doesn't retry-storm a payload we can't map.
    return NextResponse.json({ ok: true, ignored: 'no_reference' }, { status: 200 });
  }

  // ── Vendor token packs (TKN…) → the existing idempotent credit RPC ────────
  if (reference.startsWith('TKN-')) {
    const { data, error } = await admin.rpc('confirm_vendor_token_purchase_by_reference', {
      p_reference_code: reference,
    });
    if (error) {
      const msg = (error.message ?? '').toUpperCase();
      if (msg.includes('NOT_FOUND')) {
        return NextResponse.json({ ok: true, ignored: 'unknown_reference' }, { status: 200 });
      }
      Sentry.captureException(error, { tags: { webhook: 'paymongo', reference } });
      return retryable({ ok: false, reason: 'confirm_failed' }, 500);
    }
    const result = (data ?? {}) as { paid?: boolean; already?: boolean };
    if (result.paid) {
      after(async () => {
        const { data: p } = await admin
          .from('vendor_token_purchases')
          .select('purchase_id')
          .eq('reference_code', reference)
          .maybeSingle();
        if (p?.purchase_id) await notifyVendorTokensCredited(p.purchase_id);
      });
    }
    return NextResponse.json(
      { ok: true, credited: Boolean(result.paid), already: Boolean(result.already) },
      { status: 200 },
    );
  }

  // ── Couple orders (SN…) → the shared finalizePaidOrder fulfillment tail ────
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('order_id, event_id, public_id, service_key, user_id, status')
    .eq('reference_code', reference)
    .maybeSingle();
  if (orderErr) {
    Sentry.captureException(orderErr, { tags: { webhook: 'paymongo', reference } });
    return retryable({ ok: false, reason: 'order_lookup_failed' }, 500);
  }
  if (!order) {
    // Unknown reference → ack so PayMongo stops retrying a code we'll never map.
    return NextResponse.json({ ok: true, ignored: 'unknown_reference' }, { status: 200 });
  }

  // Idempotency (webhooks retry): a terminal-paid order is a no-op.
  if (isTerminalPaidOrderStatus(order.status)) {
    return NextResponse.json({ ok: true, already: true }, { status: 200 });
  }

  // Paid amount (PHP) for the 'order_paid' analytics event + the gateway payment
  // id / processor fee for booking. The order's pending payment row carries the
  // VAT-inclusive gross the buyer paid via PayMongo.
  const { data: pendingPayments } = await admin
    .from('payments')
    .select('amount_php')
    .eq('order_id', order.order_id)
    .eq('status', 'pending');
  const pendingPaymentRow = (pendingPayments ?? [])[0] as
    | { amount_php: number | string }
    | undefined;
  const paidAmountPhp = pendingPaymentRow ? Number(pendingPaymentRow.amount_php) : null;

  // Gap 6 — derive the gateway processor fee (payload fee first, else known rate)
  // + the pay_… id for a future refund.
  const gwInfo = extractGatewayPaymentInfo(payload);
  const gatewayFeeCentavos = deriveGatewayFeeCentavos({
    amountCentavos:
      gwInfo.amountCentavos ??
      (paidAmountPhp != null ? Math.round(paidAmountPhp * 100) : null),
    providedFeeCentavos: gwInfo.feeCentavos,
    // Method-aware fallback when the payload omits an explicit fee (card ~3.5% /
    // e-wallet ~2.5% / QR Ph ~1.5%). The explicit fee, when present, still wins.
    methodType: gwInfo.methodType,
  });

  try {
    await finalizePaidOrder(admin, {
      orderId: order.order_id,
      order: {
        event_id: order.event_id,
        public_id: order.public_id,
        service_key: order.service_key,
      },
      buyerUserId: order.user_id,
      // No admin actor on the automated lane — the buyer is the least-surprising
      // valid-FK actor for the ledger, tagged with the 'system' role.
      actorUserId: order.user_id,
      actorRole: 'system',
      alreadyMatchedPayment: false,
      amountPhp: paidAmountPhp,
      gatewayPaymentId: gwInfo.paymentId,
      gatewayFeeCentavos,
    });
  } catch (e) {
    // Real server error → 500 so PayMongo retries (which is what we want; the
    // order is not yet paid). finalizePaidOrder throws only when the order→paid
    // write itself fails. Unmark the dedup id so the retry isn't swallowed.
    Sentry.captureException(e, { tags: { webhook: 'paymongo', reference } });
    return retryable({ ok: false, reason: 'fulfillment_failed' }, 500);
  }

  return NextResponse.json({ ok: true, paid: true }, { status: 200 });
}

// ============================================================================
// Refund / dispute helpers
// ============================================================================

type MinimalOrder = {
  order_id: string;
  event_id: string | null;
  public_id: string | null;
  user_id: string;
  service_key: string | null;
  status: string;
};

/**
 * Map a refund.* / dispute.* event to its order: prefer the echoed SN reference
 * (we set metadata.reference_code when we create a refund), else fall back to the
 * referenced pay_… id → payments.gateway_payment_id → order.
 */
async function lookupOrderForRefundOrDispute(
  admin: ReturnType<typeof createAdminClient>,
  payload: unknown,
): Promise<MinimalOrder | null> {
  const cols = 'order_id, event_id, public_id, user_id, service_key, status';
  const reference = extractReference(payload);
  if (reference && reference.startsWith('SN')) {
    const { data } = await admin
      .from('orders')
      .select(cols)
      .eq('reference_code', reference)
      .maybeSingle();
    if (data) return data as unknown as MinimalOrder;
  }
  const paymentId = extractReferencedPaymentId(payload);
  if (paymentId) {
    const { data: pay } = await admin
      .from('payments')
      .select('order_id')
      .eq('gateway_payment_id', paymentId)
      .maybeSingle();
    if (pay?.order_id) {
      const { data } = await admin
        .from('orders')
        .select(cols)
        .eq('order_id', pay.order_id)
        .maybeSingle();
      if (data) return data as unknown as MinimalOrder;
    }
  }
  return null;
}

/**
 * Reconcile a settled gateway refund against the order. When our own admin
 * refundOrder ran first the order is ALREADY 'refunded' → we just stamp the
 * gateway_refund_id onto the existing order_refunds row. When the refund was
 * initiated OUTSIDE our flow (e.g. the PayMongo dashboard) we flip the order,
 * record order_refunds, revoke the SKU, and notify the buyer. Idempotent.
 */
async function reconcileGatewayRefund(
  admin: ReturnType<typeof createAdminClient>,
  args: { order: MinimalOrder; refundId: string | null; payload: unknown },
): Promise<void> {
  const { order, refundId } = args;

  // Already reconciled by admin refundOrder → best-effort stamp the gateway id.
  if (order.status === 'refunded') {
    if (refundId) {
      const { data: existing } = await admin
        .from('order_refunds')
        .select('refund_id, gateway_refund_id')
        .eq('order_id', order.order_id)
        .maybeSingle();
      if (existing && !existing.gateway_refund_id) {
        await admin
          .from('order_refunds')
          .update({ gateway_refund_id: refundId, refund_mode: 'gateway', updated_at: new Date().toISOString() })
          .eq('refund_id', existing.refund_id);
      }
    }
    return;
  }

  // Only paid/fulfilled orders can be flipped to refunded (guard + race-safe).
  if (!isTerminalPaidOrderStatus(order.status)) return;

  const { data: flipped } = await admin
    .from('orders')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('order_id', order.order_id)
    .in('status', ['paid', 'fulfilled'])
    .select('order_id')
    .maybeSingle();
  if (!flipped) return; // lost the race — another path already refunded it.

  // Revoke flag-backed entitlements (symmetric with admin refundOrder).
  await deactivateOrderSku({
    admin,
    orderId: order.order_id,
    eventId: order.event_id ?? null,
    serviceKey: order.service_key ?? '',
    actorUserId: order.user_id,
  });

  // Record the audit row (best-effort — UNIQUE(order_id) makes a race a no-op).
  const refundAmountCentavos = refundAmountFromPayload(args.payload);
  await admin
    .from('order_refunds')
    .insert({
      order_id: order.order_id,
      refund_amount_centavos: refundAmountCentavos,
      reason: 'Gateway-initiated refund reconciled from the PayMongo webhook.',
      refunded_by_admin_id: order.user_id,
      status: 'sent',
      refund_mode: 'gateway',
      gateway_refund_id: refundId,
    })
    .then(
      () => undefined,
      (e: unknown) => console.error('order_refunds insert (webhook, non-fatal):', e),
    );

  after(async () => {
    try {
      await emitNotification({
        userId: order.user_id,
        type: 'payment_refunded',
        title: `Refund processed for order ${order.public_id ?? ''}`.trim(),
        body: 'Your refund was returned to your card or e-wallet. Allow a few banking days for it to appear.',
        relatedUrl: order.event_id
          ? `/dashboard/${order.event_id}/orders/${order.order_id}`
          : null,
      });
    } catch (e) {
      console.error('refund reconcile notify (non-fatal):', e);
    }
  });
}

function refundAmountFromPayload(payload: unknown): number {
  const p = payload as { data?: { attributes?: { data?: { attributes?: { amount?: unknown } } } } };
  const amt = p?.data?.attributes?.data?.attributes?.amount;
  const n = typeof amt === 'number' && Number.isFinite(amt) ? Math.round(amt) : 0;
  return n > 0 ? n : 1; // order_refunds CHECK requires > 0
}

/**
 * Flag a dispute/chargeback for the admin team + notify the affected buyer.
 * Best-effort fan-out to every internal/team/admin account (same OR-filter as
 * notifyAdminsOrderAwaitingReconciliation). Fires in after() so it never delays
 * the webhook ack.
 */
async function flagDisputeForAdmins(
  admin: ReturnType<typeof createAdminClient>,
  args: { order: MinimalOrder | null; eventType: string | null; payload: unknown },
): Promise<void> {
  const { order, eventType } = args;
  Sentry.captureMessage('paymongo dispute event', {
    level: 'warning',
    tags: { webhook: 'paymongo', lane: 'dispute', eventType: eventType ?? 'unknown' },
  });

  after(async () => {
    try {
      const { data: admins } = await admin
        .from('users')
        .select('user_id')
        .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
      const label = order?.public_id ? `order ${order.public_id}` : 'a PayMongo payment';
      const amountCentavos = refundAmountFromPayload(args.payload);
      const amountLabel = amountCentavos > 1 ? ` (${formatPhp(amountCentavos / 100)})` : '';
      await Promise.all(
        (admins ?? []).map((row) =>
          emitNotification({
            userId: row.user_id as string,
            type: 'dispute_filed',
            title: `Payment dispute opened on ${label}`,
            body: `PayMongo reported a ${eventType ?? 'dispute'} on ${label}${amountLabel}. Review it in the payments console and respond before the deadline.`,
            relatedUrl: '/admin/payments',
          }),
        ),
      );
    } catch (e) {
      console.error('dispute admin flag (non-fatal):', e);
    }
  });
}
