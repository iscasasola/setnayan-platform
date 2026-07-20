import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePayMongoConfig } from '@/lib/integration-config';
import { buildPayMongoRefundBody } from '@/lib/paymongo-webhook-core';

/**
 * apps/web/lib/paymongo.ts
 *
 * PayMongo one-time payment — Phase 1 (Checkout Sessions).
 *
 * createPayMongoCheckout(orderId) opens a PayMongo Checkout Session for an
 * EXISTING pre-paid order and returns its hosted checkout_url. The client
 * redirects the buyer there; PayMongo collects the payment (Card / GCash / Maya /
 * GrabPay / QR Ph) and fires a `checkout_session.payment.paid` webhook
 * (/api/webhooks/paymongo) which is the ONLY thing that flips the order to paid.
 * The browser return_url is NEVER treated as proof of payment.
 *
 * GATING (nothing charges without BOTH):
 *   • resolvePayMongoConfig() must yield a secret key (DB or env) — else this
 *     returns { ok:false } and the caller falls back to the manual-QR rails.
 *   • The build-time NEXT_PUBLIC_PAYMONGO_STATUS='APPROVED' gate is checked at
 *     the CALL SITE (the checkout UI / server action), mirroring Maya.
 *
 * The charged amount is the order's PENDING payment row `amount_php` — the exact
 * VAT-inclusive gross the manual rails collect — so the online and manual paths
 * bill an identical figure. Auth is HTTP Basic base64("<secretKey>:") (empty
 * password, PayMongo's scheme).
 */

// Card, GCash, Maya (='paymaya'), GrabPay (='grab_pay'), QR Ph.
const PAYMONGO_METHODS = ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph'] as const;

export type PayMongoCheckoutResult =
  | { ok: true; checkoutUrl: string; checkoutSessionId: string | null }
  | { ok: false; reason: string };

/** Canonical app origin for the return/cancel URLs (no trailing slash). */
function appBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SETNAYAN_BASE_URL ||
    'https://www.setnayan.com';
  return base.replace(/\/+$/, '');
}

export async function createPayMongoCheckout(
  orderId: string,
): Promise<PayMongoCheckoutResult> {
  // (1) Gate — no secret key resolvable → inert (caller keeps the manual rails).
  const { secretKey, endpoint } = await resolvePayMongoConfig();
  if (!secretKey) {
    return { ok: false, reason: 'Online payment is not configured yet.' };
  }

  // (2) Auth — the caller must own the order.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'Please sign in to continue.' };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('order_id, user_id, service_key, description, reference_code, status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, reason: 'Order not found.' };
  if (order.user_id !== user.id) {
    return { ok: false, reason: 'You can only pay for your own order.' };
  }
  // Only a pre-paid order can open a checkout — never re-charge a paid /
  // fulfilled / cancelled / refunded one.
  const PAYABLE = new Set(['draft', 'submitted', 'awaiting_payment']);
  if (!PAYABLE.has(String(order.status))) {
    return { ok: false, reason: 'This order can no longer be paid online.' };
  }
  if (!order.reference_code) {
    return { ok: false, reason: 'This order is missing a reference code.' };
  }

  // (3) Amount — the order's pending payment (VAT-inclusive gross), the SAME
  // figure the manual GCash/BDO rails collect.
  const { data: pay } = await admin
    .from('payments')
    .select('amount_php')
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const amountPhp = Number(pay?.amount_php ?? 0);
  if (!(amountPhp > 0)) {
    return { ok: false, reason: 'Could not resolve the amount to charge.' };
  }
  const amountCentavos = Math.round(amountPhp * 100);

  const title =
    (order.description && String(order.description).trim()) ||
    String(order.service_key || 'Setnayan order');
  const ref = String(order.reference_code);
  const base = appBaseUrl();

  const payload = {
    data: {
      attributes: {
        line_items: [
          {
            name: title.slice(0, 255),
            amount: amountCentavos,
            currency: 'PHP',
            quantity: 1,
          },
        ],
        payment_method_types: [...PAYMONGO_METHODS],
        // reference_number is echoed back on the webhook — we key fulfillment on
        // it (couple SN… → order; vendor TKN… → token pack).
        reference_number: ref,
        description: title.slice(0, 255),
        metadata: { reference_code: ref, order_id: String(order.order_id) },
        success_url: `${base}/checkout/return?ref=${encodeURIComponent(ref)}`,
        cancel_url: `${base}/checkout/cancel?ref=${encodeURIComponent(ref)}`,
        show_line_items: true,
        show_description: false,
        send_email_receipt: false,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${endpoint.replace(/\/+$/, '')}/v1/checkout_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // HTTP Basic: base64("<secretKey>:") — empty password (PayMongo scheme).
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ok: false,
      reason: 'Could not reach the payment gateway. Please try again.',
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[paymongo] checkout_sessions failed', res.status, text.slice(0, 300));
    return {
      ok: false,
      reason: 'The payment gateway rejected the request. Please try again or pay manually.',
    };
  }

  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
  } | null;
  const checkoutUrl = json?.data?.attributes?.checkout_url;
  if (typeof checkoutUrl !== 'string' || !checkoutUrl) {
    return { ok: false, reason: 'The payment gateway did not return a checkout link.' };
  }
  return { ok: true, checkoutUrl, checkoutSessionId: json?.data?.id ?? null };
}

// ============================================================================
// createPayMongoRefund — move money back through the gateway (Gap 4)
// ============================================================================

export type PayMongoRefundResult =
  | { ok: true; refundId: string | null; status: string | null }
  | { ok: false; reason: string };

/**
 * Issue a PayMongo refund against a settled payment (POST /v1/refunds). This is
 * the ONLY code path that actually returns money to the buyer's card/e-wallet;
 * `refundOrder` calls it for orders paid on the gateway and keeps the manual
 * off-platform reversal for manually-paid orders.
 *
 * `paymongoPaymentId` is the `pay_…` id the webhook stored on the matched
 * payment row at fulfillment (payments.gateway_payment_id). Auth is the same
 * HTTP Basic base64("<secretKey>:") scheme as checkout. Amount is in centavos
 * (PayMongo supports partial refunds). Inert when unconfigured (no key → the
 * caller falls back to recording a manual reversal). `metadata.reference_code`
 * is echoed on the refund.* webhook so the reconciliation lane can map it back.
 */
export async function createPayMongoRefund(args: {
  paymongoPaymentId: string;
  amountCentavos: number;
  reason?: string | null;
  metadata?: Record<string, string>;
}): Promise<PayMongoRefundResult> {
  const { secretKey, endpoint } = await resolvePayMongoConfig();
  if (!secretKey) {
    return { ok: false, reason: 'Online refunds are not configured (no PayMongo key).' };
  }
  if (!args.paymongoPaymentId) {
    return { ok: false, reason: 'Missing PayMongo payment id to refund against.' };
  }
  if (!(args.amountCentavos > 0)) {
    return { ok: false, reason: 'Refund amount must be greater than zero.' };
  }

  const body = buildPayMongoRefundBody({
    paymentId: args.paymongoPaymentId,
    amountCentavos: args.amountCentavos,
    reason: args.reason,
    metadata: args.metadata,
  });

  let res: Response;
  try {
    res = await fetch(`${endpoint.replace(/\/+$/, '')}/v1/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'Could not reach the payment gateway to issue the refund.' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[paymongo] refunds failed', res.status, text.slice(0, 300));
    return {
      ok: false,
      reason: `The payment gateway rejected the refund (HTTP ${res.status}).`,
    };
  }

  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; attributes?: { status?: string } };
  } | null;
  return {
    ok: true,
    refundId: json?.data?.id ?? null,
    status: json?.data?.attributes?.status ?? null,
  };
}
