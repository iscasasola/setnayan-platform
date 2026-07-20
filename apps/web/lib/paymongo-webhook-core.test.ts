/**
 * Money-path unit suite for the PayMongo webhook + refund core (Node built-in
 * test runner via tsx · `pnpm test:unit`).
 *
 * These lock the load-bearing money-path invariants of the PayMongo gateway
 * hardening pass — all against the PURE, client-safe core (no DB, no Next):
 *
 *   1. SIGNATURE — verifyPayMongoSignature ACCEPTS a correctly-signed delivery
 *      (test + live secret) and REJECTS a forged HMAC, a stale timestamp, a
 *      missing/garbage header, and a payload tampered after signing.
 *   2. DEDUP / IDEMPOTENCY — markWebhookEventProcessed returns 'duplicate' on a
 *      second delivery of the same event id (so it never double-fulfills), 'new'
 *      the first time, and 'skipped' on no-id / unexpected error;
 *      isTerminalPaidOrderStatus no-ops an already-paid order.
 *   3. M1 (receipt-failure-does-not-strand-activation) — runPostPaidEffects runs
 *      SKU activation even when the receipt (and payout) step throws.
 *   4. REFUND BRANCH — resolveRefundMode routes 'paymongo'+pay_… to the gateway
 *      and everything else to manual; buildPayMongoRefundBody + reason
 *      normalization emit a valid PayMongo /v1/refunds body.
 *   5. Extraction + fee derivation helpers the lanes depend on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
  verifyPayMongoSignature,
  parsePayMongoSignature,
  classifyPayMongoEvent,
  extractEventEnvelope,
  extractReference,
  extractGatewayPaymentInfo,
  extractReferencedPaymentId,
  deriveGatewayFeeCentavos,
  fallbackFeeBpsForMethod,
  resolveRefundMode,
  shouldProceedToRefundStateMutation,
  buildOrderRefundRow,
  normalizePayMongoRefundReason,
  buildPayMongoRefundBody,
  PAYMONGO_REFUND_REASONS,
  isTerminalPaidOrderStatus,
  isUniqueViolation,
  markWebhookEventProcessed,
  runPostPaidEffects,
  SIGNATURE_FRESHNESS_TOLERANCE_S,
  PAYMONGO_FALLBACK_FEE_BPS,
  type WebhookDedupClient,
} from './paymongo-webhook-core';

// Helper: build a valid Paymongo-Signature header for a body + secret.
function signHeader(rawBody: string, secret: string, mode: 'te' | 'li', tSeconds: number): string {
  const hmac = createHmac('sha256', secret).update(`${tSeconds}.${rawBody}`).digest('hex');
  return `t=${tSeconds},${mode}=${hmac}`;
}

const NOW_MS = 1_800_000_000_000; // fixed clock for determinism
const NOW_S = Math.floor(NOW_MS / 1000);

// ── 1. Signature ─────────────────────────────────────────────────────────────

test('signature: accepts a correctly-signed TEST-mode delivery', () => {
  const body = JSON.stringify({ data: { attributes: { type: 'checkout_session.payment.paid' } } });
  const header = signHeader(body, 'whsk_test', 'te', NOW_S);
  assert.equal(
    verifyPayMongoSignature(body, header, { test: 'whsk_test', live: null }, NOW_MS),
    true,
  );
});

test('signature: accepts a correctly-signed LIVE-mode delivery', () => {
  const body = JSON.stringify({ hello: 'world' });
  const header = signHeader(body, 'whsk_live', 'li', NOW_S);
  assert.equal(
    verifyPayMongoSignature(body, header, { test: null, live: 'whsk_live' }, NOW_MS),
    true,
  );
});

test('signature: REJECTS a forged HMAC', () => {
  const body = JSON.stringify({ a: 1 });
  const forged = `t=${NOW_S},li=${'0'.repeat(64)}`;
  assert.equal(
    verifyPayMongoSignature(body, forged, { test: 'whsk_test', live: 'whsk_live' }, NOW_MS),
    false,
  );
});

test('signature: REJECTS a delivery signed with the WRONG secret', () => {
  const body = JSON.stringify({ a: 1 });
  const header = signHeader(body, 'attacker_secret', 'li', NOW_S);
  assert.equal(
    verifyPayMongoSignature(body, header, { test: null, live: 'whsk_live' }, NOW_MS),
    false,
  );
});

test('signature: REJECTS a stale timestamp beyond the freshness window (replay)', () => {
  const body = JSON.stringify({ a: 1 });
  const staleS = NOW_S - (SIGNATURE_FRESHNESS_TOLERANCE_S + 60);
  const header = signHeader(body, 'whsk_live', 'li', staleS); // correctly signed but old
  assert.equal(
    verifyPayMongoSignature(body, header, { test: null, live: 'whsk_live' }, NOW_MS),
    false,
  );
});

test('signature: REJECTS when the body was tampered after signing', () => {
  const signed = JSON.stringify({ amount: 100 });
  const header = signHeader(signed, 'whsk_live', 'li', NOW_S);
  const tampered = JSON.stringify({ amount: 999999 });
  assert.equal(
    verifyPayMongoSignature(tampered, header, { test: null, live: 'whsk_live' }, NOW_MS),
    false,
  );
});

test('signature: REJECTS a missing / garbage header and a no-secret pair', () => {
  const body = '{}';
  assert.equal(verifyPayMongoSignature(body, '', { test: 't', live: 'l' }, NOW_MS), false);
  assert.equal(verifyPayMongoSignature(body, 'garbage', { test: 't', live: 'l' }, NOW_MS), false);
  const header = signHeader(body, 'whsk_live', 'li', NOW_S);
  assert.equal(verifyPayMongoSignature(body, header, { test: null, live: null }, NOW_MS), false);
});

test('signature: parse tolerates whitespace + out-of-order parts', () => {
  const p = parsePayMongoSignature(' li=abc , t=123 ,te=def ');
  assert.deepEqual(p, { t: '123', te: 'def', li: 'abc' });
});

// ── 2. Dedup / idempotency ───────────────────────────────────────────────────

// A fake insert client that records seen (provider,event_id) and returns a
// 23505 unique-violation the second time — mirroring the DB UNIQUE index.
function makeDedupClient(): WebhookDedupClient & { rows: string[] } {
  const rows: string[] = [];
  return {
    rows,
    from() {
      return {
        insert(row: Record<string, unknown>) {
          const key = `${row.provider}:${row.event_id}`;
          if (rows.includes(key)) {
            return Promise.resolve({ error: { code: '23505', message: 'duplicate key value' } });
          }
          rows.push(key);
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('dedup: first delivery is new, a duplicate delivery id is deduped (no double-fulfill)', async () => {
  const client = makeDedupClient();
  const first = await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: 'evt_1' });
  const second = await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: 'evt_1' });
  assert.equal(first, 'new');
  assert.equal(second, 'duplicate');
});

test('dedup: distinct event ids are each new', async () => {
  const client = makeDedupClient();
  assert.equal(await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: 'evt_1' }), 'new');
  assert.equal(await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: 'evt_2' }), 'new');
});

test('dedup: no event id → skipped (fail-open, status guard still protects)', async () => {
  const client = makeDedupClient();
  assert.equal(await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: null }), 'skipped');
});

test('dedup: an unexpected (non-unique) insert error → skipped (does not block fulfillment)', async () => {
  const client: WebhookDedupClient = {
    from() {
      return {
        insert() {
          return Promise.resolve({ error: { code: '08006', message: 'connection failure' } });
        },
        delete() {
          return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } };
        },
      };
    },
  };
  assert.equal(await markWebhookEventProcessed(client, { provider: 'paymongo', eventId: 'evt_x' }), 'skipped');
});

test('isUniqueViolation: matches 23505 + the duplicate-key message, not other errors', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation({ message: 'duplicate key value violates unique constraint' }), true);
  assert.equal(isUniqueViolation({ code: '23503' }), false);
  assert.equal(isUniqueViolation(null), false);
});

test('idempotency: a terminal-paid order status no-ops', () => {
  assert.equal(isTerminalPaidOrderStatus('paid'), true);
  assert.equal(isTerminalPaidOrderStatus('fulfilled'), true);
  assert.equal(isTerminalPaidOrderStatus('submitted'), false);
  assert.equal(isTerminalPaidOrderStatus('refunded'), false);
});

// ── 3. M1 — receipt failure does not strand activation ───────────────────────

test('M1: runPostPaidEffects STILL activates the SKU when the receipt step throws', async () => {
  const calls: string[] = [];
  await runPostPaidEffects({
    issueReceipt: async () => {
      calls.push('receipt');
      throw new Error('receipt boom');
    },
    schedulePayouts: async () => {
      calls.push('payouts');
    },
    activateSku: async () => {
      calls.push('activate');
    },
    onReceiptError: () => calls.push('receipt-caught'),
  });
  // Activation ran despite the receipt throw — the M1 guarantee.
  assert.ok(calls.includes('activate'), 'activateSku must run after a receipt failure');
  assert.ok(calls.includes('receipt-caught'), 'the receipt error must be swallowed');
});

test('M1: a payout failure is also swallowed and does not strand activation', async () => {
  const calls: string[] = [];
  await runPostPaidEffects({
    issueReceipt: async () => {
      calls.push('receipt');
    },
    schedulePayouts: async () => {
      throw new Error('payout boom');
    },
    activateSku: async () => {
      calls.push('activate');
    },
    onPayoutError: () => calls.push('payout-caught'),
  });
  assert.deepEqual(calls, ['receipt', 'payout-caught', 'activate']);
});

test('M1: an activation throw DOES propagate (never silently swallowed)', async () => {
  await assert.rejects(
    runPostPaidEffects({
      issueReceipt: async () => {},
      schedulePayouts: async () => {},
      activateSku: async () => {
        throw new Error('activation boom');
      },
    }),
    /activation boom/,
  );
});

// ── 4. Refund branch ─────────────────────────────────────────────────────────

test('refund branch: paymongo channel + pay_… id → gateway', () => {
  assert.equal(
    resolveRefundMode({ channel: 'paymongo', gatewayPaymentId: 'pay_abc123' }),
    'gateway',
  );
  assert.equal(
    resolveRefundMode({ channel: 'PayMongo', gatewayPaymentId: 'pay_abc123' }),
    'gateway',
  );
});

test('refund branch: manual rails (gcash/bdo) or missing pay id → manual', () => {
  assert.equal(resolveRefundMode({ channel: 'gcash', gatewayPaymentId: null }), 'manual');
  assert.equal(resolveRefundMode({ channel: 'bdo', gatewayPaymentId: 'pay_x' }), 'manual');
  // paymongo channel but no stored payment id (older row) → cannot call the API.
  assert.equal(resolveRefundMode({ channel: 'paymongo', gatewayPaymentId: null }), 'manual');
  assert.equal(resolveRefundMode({ channel: null, gatewayPaymentId: null }), 'manual');
});

test('refund branch: reason normalization always yields a valid PayMongo enum', () => {
  assert.equal(normalizePayMongoRefundReason('requested_by_customer'), 'requested_by_customer');
  assert.equal(normalizePayMongoRefundReason('Duplicate transfer'), 'duplicate');
  assert.equal(normalizePayMongoRefundReason('suspected fraud'), 'fraudulent');
  assert.equal(normalizePayMongoRefundReason('couple changed their mind'), 'requested_by_customer');
  assert.equal(normalizePayMongoRefundReason(null), 'requested_by_customer');
  assert.ok(PAYMONGO_REFUND_REASONS.includes(normalizePayMongoRefundReason('anything')));
});

test('refund branch: buildPayMongoRefundBody emits a valid /v1/refunds body', () => {
  const body = buildPayMongoRefundBody({
    paymentId: 'pay_abc',
    amountCentavos: 49900,
    reason: 'requested_by_customer',
    metadata: { reference_code: 'SN0A1B2C3D', order_id: 'o-1' },
  });
  assert.equal(body.data.attributes.amount, 49900);
  assert.equal(body.data.attributes.payment_id, 'pay_abc');
  assert.equal(body.data.attributes.reason, 'requested_by_customer');
  assert.deepEqual(body.data.attributes.metadata, { reference_code: 'SN0A1B2C3D', order_id: 'o-1' });
});

// ── 5. Extraction + fee derivation ───────────────────────────────────────────

test('classifyPayMongoEvent routes each lane', () => {
  assert.equal(classifyPayMongoEvent('checkout_session.payment.paid'), 'paid');
  assert.equal(classifyPayMongoEvent('payment.failed'), 'failed');
  assert.equal(classifyPayMongoEvent('refund.updated'), 'refund');
  assert.equal(classifyPayMongoEvent('refund.refunded'), 'refund');
  assert.equal(classifyPayMongoEvent('dispute.created'), 'dispute');
  assert.equal(classifyPayMongoEvent('chargeback.created'), 'dispute');
  assert.equal(classifyPayMongoEvent('source.chargeable'), 'ignore');
  assert.equal(classifyPayMongoEvent(undefined), 'ignore');
});

test('extractEventEnvelope reads the evt_ id + inner type', () => {
  const env = extractEventEnvelope({
    data: { id: 'evt_9', attributes: { type: 'checkout_session.payment.paid' } },
  });
  assert.deepEqual(env, { eventId: 'evt_9', eventType: 'checkout_session.payment.paid' });
});

test('extractReference finds the SN order code in reference_number', () => {
  const payload = {
    data: {
      attributes: {
        type: 'checkout_session.payment.paid',
        data: { attributes: { reference_number: 'SN0A1B2C3D' } },
      },
    },
  };
  assert.equal(extractReference(payload), 'SN0A1B2C3D');
});

test('extractGatewayPaymentInfo pulls the paid payment id + fee + amount + method type', () => {
  const payload = {
    data: {
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          attributes: {
            reference_number: 'SN0A1B2C3D',
            payments: [
              {
                id: 'pay_1',
                attributes: { amount: 49900, fee: 1747, status: 'paid', source: { type: 'gcash' } },
              },
            ],
          },
        },
      },
    },
  };
  const info = extractGatewayPaymentInfo(payload);
  assert.deepEqual(info, {
    paymentId: 'pay_1',
    feeCentavos: 1747,
    amountCentavos: 49900,
    methodType: 'gcash',
  });
});

test('extractGatewayPaymentInfo reads method from payment_method_type when no source.type', () => {
  const payload = {
    data: {
      attributes: {
        data: {
          attributes: {
            payments: [
              { id: 'pay_2', attributes: { amount: 100000, status: 'paid', payment_method_type: 'card' } },
            ],
          },
        },
      },
    },
  };
  assert.equal(extractGatewayPaymentInfo(payload).methodType, 'card');
});

test('extractGatewayPaymentInfo methodType is null when the payload carries none', () => {
  const payload = {
    data: { attributes: { data: { attributes: { payments: [{ id: 'pay_3', attributes: { amount: 5000 } }] } } } },
  };
  assert.equal(extractGatewayPaymentInfo(payload).methodType, null);
});

test('extractReferencedPaymentId reads a refund/dispute payment_id', () => {
  const payload = {
    data: { attributes: { type: 'refund.updated', data: { id: 'ref_1', attributes: { payment_id: 'pay_9' } } } },
  };
  assert.equal(extractReferencedPaymentId(payload), 'pay_9');
});

test('fee derivation: uses the payload fee when present', () => {
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: 49900, providedFeeCentavos: 1747 }),
    1747,
  );
});

test('fee derivation: falls back to the known rate when the payload omits the fee', () => {
  const amount = 100000; // ₱1,000.00
  const expected = Math.round((amount * PAYMONGO_FALLBACK_FEE_BPS) / 10000);
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: amount, providedFeeCentavos: null }),
    expected,
  );
});

test('fee derivation: no amount + no fee → 0 (never negative)', () => {
  assert.equal(deriveGatewayFeeCentavos({ amountCentavos: null, providedFeeCentavos: null }), 0);
});

// ── 5b. Method-aware fallback fee (cost-visibility) ──────────────────────────

test('fee fallback: bps is method-aware (card 350 / e-wallet 250 / qrph 150)', () => {
  assert.equal(fallbackFeeBpsForMethod('card'), 350);
  assert.equal(fallbackFeeBpsForMethod('gcash'), 250);
  assert.equal(fallbackFeeBpsForMethod('paymaya'), 250);
  assert.equal(fallbackFeeBpsForMethod('grab_pay'), 250);
  assert.equal(fallbackFeeBpsForMethod('qrph'), 150);
});

test('fee fallback: unknown / missing method → the flat default rate', () => {
  assert.equal(fallbackFeeBpsForMethod('dob'), PAYMONGO_FALLBACK_FEE_BPS);
  assert.equal(fallbackFeeBpsForMethod(null), PAYMONGO_FALLBACK_FEE_BPS);
  assert.equal(fallbackFeeBpsForMethod(undefined), PAYMONGO_FALLBACK_FEE_BPS);
});

test('fee derivation: no explicit fee → estimate uses the method-aware rate', () => {
  const amount = 100000; // ₱1,000.00
  // card = 3.5% → 3500 centavos; qrph = 1.5% → 1500; gcash = 2.5% → 2500.
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: amount, providedFeeCentavos: null, methodType: 'card' }),
    3500,
  );
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: amount, providedFeeCentavos: null, methodType: 'qrph' }),
    1500,
  );
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: amount, providedFeeCentavos: null, methodType: 'gcash' }),
    2500,
  );
});

test('fee derivation: the explicit payload fee STILL wins over the method-aware estimate', () => {
  // A card payment whose payload carries an explicit fee → use the fee verbatim,
  // NOT the 3.5% card estimate.
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: 100000, providedFeeCentavos: 1234, methodType: 'card' }),
    1234,
  );
});

test('fee derivation: an explicit feeBps overrides the method-aware rate', () => {
  assert.equal(
    deriveGatewayFeeCentavos({ amountCentavos: 100000, providedFeeCentavos: null, feeBps: 200, methodType: 'card' }),
    2000,
  );
});

// ── 6. Fix #1 — conditional order_refunds insert shape (deploy-ordering) ──────

test('refund row: MANUAL shape has NO gateway columns (byte-shape = pre-migration)', () => {
  const row = buildOrderRefundRow({
    orderId: 'o-1',
    refundCentavos: 49900,
    reason: 'Couple cancelled — full refund per policy.',
    adminUserId: 'admin-1',
    proofUrl: null,
    mode: 'manual',
    gatewayRefundId: null,
  });
  // EXACT pre-gateway key set — no refund_mode / gateway_refund_id so the insert
  // works before the hardening migration adds those columns.
  assert.deepEqual(row, {
    order_id: 'o-1',
    refund_amount_centavos: 49900,
    reason: 'Couple cancelled — full refund per policy.',
    refunded_by_admin_id: 'admin-1',
    proof_url: null,
    status: 'sent',
  });
  assert.equal('refund_mode' in row, false);
  assert.equal('gateway_refund_id' in row, false);
});

test('refund row: GATEWAY shape adds refund_mode + gateway_refund_id', () => {
  const row = buildOrderRefundRow({
    orderId: 'o-2',
    refundCentavos: 79900,
    reason: 'Gateway-paid order refunded to card per request.',
    adminUserId: 'admin-2',
    proofUrl: 'r2://proof.png',
    mode: 'gateway',
    gatewayRefundId: 'ref_abc123',
  });
  assert.deepEqual(row, {
    order_id: 'o-2',
    refund_amount_centavos: 79900,
    reason: 'Gateway-paid order refunded to card per request.',
    refunded_by_admin_id: 'admin-2',
    proof_url: 'r2://proof.png',
    status: 'sent',
    refund_mode: 'gateway',
    gateway_refund_id: 'ref_abc123',
  });
});

// ── 7. Fix #2 — API-first ordering contract (state mutation gated on success) ─

test('ordering: MANUAL proceeds to state mutation unconditionally', () => {
  assert.equal(shouldProceedToRefundStateMutation({ mode: 'manual', gatewayOutcome: null }), true);
});

test('ordering: GATEWAY proceeds ONLY after a successful refund', () => {
  // Success → proceed to flip/deactivate/insert.
  assert.equal(
    shouldProceedToRefundStateMutation({ mode: 'gateway', gatewayOutcome: { ok: true, refundId: 'ref_1' } }),
    true,
  );
  // Failure → DO NOT proceed (order stays paid, access intact, retryable).
  assert.equal(
    shouldProceedToRefundStateMutation({ mode: 'gateway', gatewayOutcome: { ok: false, reason: 'HTTP 402' } }),
    false,
  );
  // Defensive: gateway with a missing outcome is treated as "not confirmed".
  assert.equal(shouldProceedToRefundStateMutation({ mode: 'gateway', gatewayOutcome: null }), false);
  assert.equal(shouldProceedToRefundStateMutation({ mode: 'gateway' }), false);
});

// NOTE: the DB-dependent route wiring of refundOrder (the actual orders flip,
// deactivateOrderSku, the order_refunds INSERT + UNIQUE(order_id) mutex, and the
// admin_audit_log failure trail) is out of PURE unit scope — it needs Supabase +
// Next server. These pure helpers lock the DECISIONS refundOrder makes; the
// end-to-end route integration is covered separately.
