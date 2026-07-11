import { NextResponse, type NextRequest, after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePayMongoWebhookSecrets } from '@/lib/integration-config';
import { finalizePaidOrder } from '@/lib/finalize-paid-order';
import { notifyVendorTokensCredited } from '@/lib/token-purchase-notify';

export const runtime = 'nodejs';

/**
 * PayMongo webhook → fulfill a one-time payment on `checkout_session.payment.paid`.
 *
 * Structurally mirrors /api/webhooks/token-purchase (fail-closed 503 when
 * unprovisioned · after() post-response notify · 200/401/500 discipline so the
 * provider retries only real server errors) — BUT the signature verify is
 * PayMongo's scheme, NOT the token webhook's simple x-setnayan-signature HMAC
 * (copying that verbatim would ACCEPT FORGED events).
 *
 * SIGNATURE (PayMongo):
 *   Header 'Paymongo-Signature: t=<timestamp>,te=<test-hmac>,li=<live-hmac>'.
 *   Compute HMAC-SHA256 over "<timestamp>.<raw-request-body>" using the WEBHOOK
 *   SIGNING SECRET (separate test vs live secret) and timing-safe compare against
 *   `te` (test-mode delivery) or `li` (live-mode delivery). A delivery is accepted
 *   iff EITHER the live secret verifies `li` OR the test secret verifies `te`.
 *   No secret configured (neither test nor live) → 503 (inert until provisioned).
 *   Bad/absent signature → 401.
 *
 * FULFILLMENT — branch on the echoed reference_number:
 *   • couple orders (SN…) → finalizePaidOrder(): the SAME shared fulfillment tail
 *     the admin manual-approve path uses, so manual + webhook are byte-identical.
 *   • vendor token packs (TKN…) → confirm_vendor_token_purchase_by_reference RPC
 *     (the exact idempotent credit core the admin "Confirm" button + the
 *     token-purchase webhook use).
 *
 * NEVER trusts the browser return_url as proof of payment — this webhook is the
 * only thing that flips an order to paid. Idempotent (webhooks retry): the order
 * lane no-ops when the order is already paid/fulfilled; the token RPC is
 * idempotent by contract.
 */

const ORDER_REF_RE = /SN[0-9A-F]{8}/;
const TOKEN_REF_RE = /TKN-[A-Z0-9]{8}/;

type Secrets = { test: string | null; live: string | null };

/**
 * Replay window (seconds). A captured valid delivery is only accepted if its
 * signed timestamp is within this tolerance of now (both directions), so a
 * sniffed-and-stored request can't be replayed indefinitely. Kept lenient
 * enough to absorb legit clock skew + PayMongo's own delivery retries.
 */
const SIGNATURE_FRESHNESS_TOLERANCE_S = 300;

/** Parse 't=..,te=..,li=..' into its parts (missing parts → ''). */
function parsePayMongoSignature(header: string): { t: string; te: string; li: string } {
  const out: { t: string; te: string; li: string } = { t: '', te: '', li: '' };
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === 't') out.t = val;
    else if (key === 'te') out.te = val;
    else if (key === 'li') out.li = val;
  }
  return out;
}

/** Timing-safe hex compare (false on any length/parse mismatch). */
function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex) return false;
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(aHex, 'hex');
    b = Buffer.from(bHex, 'hex');
  } catch {
    return false;
  }
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify the PayMongo signature. Accepts the delivery iff the LIVE secret
 * verifies `li` OR the TEST secret verifies `te` over "<t>.<rawBody>".
 */
function verifyPayMongoSignature(rawBody: string, header: string, secrets: Secrets): boolean {
  const { t, te, li } = parsePayMongoSignature(header);
  if (!t) return false;

  // Replay defense-in-depth: reject a delivery whose signed unix-seconds
  // timestamp is more than SIGNATURE_FRESHNESS_TOLERANCE_S from now (either
  // direction). A valid but captured request is otherwise replayable forever —
  // the HMAC below only proves authenticity, not freshness. Non-numeric or
  // stale `t` fails closed. (The order lane's status==='paid' idempotency guard
  // already no-ops a duplicate of an already-fulfilled order; this stops a
  // captured delivery from being replayed BEFORE the order is fulfilled, and
  // caps the token lane's replay window too.)
  const tSeconds = Number(t);
  if (!Number.isFinite(tSeconds)) return false;
  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - tSeconds) > SIGNATURE_FRESHNESS_TOLERANCE_S) return false;

  const signedPayload = `${t}.${rawBody}`;
  if (secrets.live && li) {
    const expected = createHmac('sha256', secrets.live).update(signedPayload).digest('hex');
    if (timingSafeEqualHex(expected, li)) return true;
  }
  if (secrets.test && te) {
    const expected = createHmac('sha256', secrets.test).update(signedPayload).digest('hex');
    if (timingSafeEqualHex(expected, te)) return true;
  }
  return false;
}

/** Pull the reference from the checkout-session payload, else scan the body. */
function extractReference(payload: unknown): string | null {
  const p = payload as {
    data?: { attributes?: { data?: { attributes?: { reference_number?: unknown; metadata?: { reference_code?: unknown } } } } };
  };
  const attrs = p?.data?.attributes?.data?.attributes;
  const candidates = [attrs?.reference_number, attrs?.metadata?.reference_code];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const m = c.match(ORDER_REF_RE) ?? c.match(TOKEN_REF_RE);
      if (m) return m[0];
    }
  }
  // Fallback: walk the object for any SN…/TKN… code.
  let found: string | null = null;
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (found || node == null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const val of Object.values(node as Record<string, unknown>)) {
      if (found) return;
      if (typeof val === 'string') {
        const m = val.match(ORDER_REF_RE) ?? val.match(TOKEN_REF_RE);
        if (m) {
          found = m[0];
          return;
        }
      } else if (typeof val === 'object') {
        walk(val);
      }
    }
  };
  walk(payload);
  return found;
}

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

  // We only fulfill on a fully-paid checkout session. Every other event
  // (payment.failed, source.chargeable, refunds, the transient post-redirect
  // "processing" states, etc.) is acked so PayMongo stops retrying it.
  const eventType = (payload as { data?: { attributes?: { type?: unknown } } })?.data?.attributes
    ?.type;
  if (eventType !== 'checkout_session.payment.paid') {
    return NextResponse.json(
      { ok: true, ignored: 'not_a_paid_event', type: typeof eventType === 'string' ? eventType : null },
      { status: 200 },
    );
  }

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

  const admin = createAdminClient();

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
      return NextResponse.json({ ok: false, reason: 'confirm_failed' }, { status: 500 });
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
    return NextResponse.json({ ok: false, reason: 'order_lookup_failed' }, { status: 500 });
  }
  if (!order) {
    // Unknown reference → ack so PayMongo stops retrying a code we'll never map.
    return NextResponse.json({ ok: true, ignored: 'unknown_reference' }, { status: 200 });
  }

  // Idempotency (webhooks retry): a terminal-paid order is a no-op.
  if (order.status === 'paid' || order.status === 'fulfilled') {
    return NextResponse.json({ ok: true, already: true }, { status: 200 });
  }

  // Paid amount (PHP) for the 'order_paid' analytics event. The manual admin
  // lane threads the matched payment's amount_php; mirror that here so gateway
  // orders don't record amount_php:null. The order's pending payment row carries
  // the VAT-inclusive gross the buyer was instructed to pay (and did, via
  // PayMongo) — the same value finalizePaidOrder flips to 'matched' below.
  const { data: pendingPayments } = await admin
    .from('payments')
    .select('amount_php')
    .eq('order_id', order.order_id)
    .eq('status', 'pending');
  const pendingPaymentRow = (pendingPayments ?? [])[0] as
    | { amount_php: number | string }
    | undefined;
  const paidAmountPhp = pendingPaymentRow ? Number(pendingPaymentRow.amount_php) : null;

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
      // Analytics parity with the manual lane's `amountPhp: Number(payment.amount_php)`.
      amountPhp: paidAmountPhp,
    });
  } catch (e) {
    // Real server error → 500 so PayMongo retries (which is what we want; the
    // order is not yet paid). finalizePaidOrder throws only when the order→paid
    // write itself fails.
    Sentry.captureException(e, { tags: { webhook: 'paymongo', reference } });
    return NextResponse.json({ ok: false, reason: 'fulfillment_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paid: true }, { status: 200 });
}
