import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * apps/web/lib/paymongo-webhook-core.ts
 *
 * PURE, client-safe core of the PayMongo webhook + refund path. Deliberately has
 * NO `import 'server-only'`, NO Supabase, NO next/* imports — everything here is
 * a deterministic function of its inputs (the crypto uses node:crypto, which is
 * fine under the Node test runner). The route (`app/api/webhooks/paymongo/route.ts`)
 * and `lib/paymongo.ts` import these helpers; the money-path unit suite
 * (`paymongo-webhook-core.test.ts`) imports them directly.
 *
 * Extracted from the inline route helpers so the signature verify, event
 * classification, reference/payment extraction, fee derivation, refund-mode
 * branching, and idempotency primitives are testable without a DB or a running
 * Next server.
 */

// ── Reference regexes (couple SN… order codes · vendor TKN… token packs) ──────
export const ORDER_REF_RE = /SN[0-9A-F]{8}/;
export const TOKEN_REF_RE = /TKN-[A-Z0-9]{8}/;

/**
 * Replay window (seconds). A captured valid delivery is only accepted if its
 * signed timestamp is within this tolerance of now (both directions), so a
 * sniffed-and-stored request can't be replayed indefinitely. Lenient enough to
 * absorb legit clock skew + PayMongo's own delivery retries.
 */
export const SIGNATURE_FRESHNESS_TOLERANCE_S = 300;

/**
 * DEFAULT fallback processor-fee rate (basis points) used ONLY when a
 * checkout_session.payment.paid payload does NOT carry an explicit per-payment
 * `fee` (rare — PayMongo almost always includes it) AND the payment method is
 * unknown. 2.5% (250 bps) is the GCash/e-wallet rate, the most common PH rail;
 * the real fee is read off the payload first. This is a cost-visibility estimate
 * for the ledger, NOT a charge to the buyer (the buyer's OR/receipt is never
 * touched by fee booking).
 */
export const PAYMONGO_FALLBACK_FEE_BPS = 250;

/**
 * Method-aware fallback processor-fee rates (basis points), used ONLY when a
 * paid payload omits the explicit per-payment `fee`. Real PH gateway pricing
 * differs materially by rail — cards run ~3.5%, e-wallets ~2.5%, QR Ph ~1.5% —
 * so booking a single flat 2.5% over-/under-estimates card + QR Ph orders. The
 * payload `fee` is ALWAYS preferred; this only sharpens the estimate when it is
 * absent. Cost-visibility only — never a charge to the buyer.
 */
export const PAYMONGO_FALLBACK_FEE_BPS_BY_METHOD: Record<string, number> = {
  card: 350,
  gcash: 250,
  paymaya: 250,
  grab_pay: 250,
  qrph: 150,
};

/**
 * Pick the fallback fee bps for a PayMongo payment-method / source type
 * (card · gcash · paymaya · grab_pay · qrph). Unknown / missing → the flat
 * PAYMONGO_FALLBACK_FEE_BPS default.
 */
export function fallbackFeeBpsForMethod(method: string | null | undefined): number {
  const key = (method ?? '').toLowerCase();
  return PAYMONGO_FALLBACK_FEE_BPS_BY_METHOD[key] ?? PAYMONGO_FALLBACK_FEE_BPS;
}

export type PayMongoWebhookSecretPair = { test: string | null; live: string | null };

/** Parse 't=..,te=..,li=..' into its parts (missing parts → ''). */
export function parsePayMongoSignature(header: string): { t: string; te: string; li: string } {
  const out: { t: string; te: string; li: string } = { t: '', te: '', li: '' };
  for (const part of (header ?? '').split(',')) {
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
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
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
 * verifies `li` OR the TEST secret verifies `te` over "<t>.<rawBody>", AND the
 * signed timestamp is within SIGNATURE_FRESHNESS_TOLERANCE_S of `nowMs`
 * (freshness / replay defense). `nowMs` is injectable for deterministic tests.
 */
export function verifyPayMongoSignature(
  rawBody: string,
  header: string,
  secrets: PayMongoWebhookSecretPair,
  nowMs: number = Date.now(),
): boolean {
  const { t, te, li } = parsePayMongoSignature(header);
  if (!t) return false;

  const tSeconds = Number(t);
  if (!Number.isFinite(tSeconds)) return false;
  const nowSeconds = nowMs / 1000;
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

// ── Event classification ─────────────────────────────────────────────────────

export type PayMongoEventClass = 'paid' | 'failed' | 'refund' | 'dispute' | 'ignore';

/** Map a PayMongo event `type` to the lane that handles it. */
export function classifyPayMongoEvent(eventType: unknown): PayMongoEventClass {
  if (typeof eventType !== 'string') return 'ignore';
  if (eventType === 'checkout_session.payment.paid') return 'paid';
  if (eventType === 'payment.failed') return 'failed';
  // refund.updated / refund.refunded (PayMongo uses both spellings across
  // API versions). Anything under the refund resource reconciles the same way.
  if (eventType.startsWith('refund.')) return 'refund';
  // dispute.created / dispute.updated / chargeback.* — flag for admin.
  if (eventType.startsWith('dispute.') || eventType.startsWith('chargeback.')) return 'dispute';
  return 'ignore';
}

/** Read the event envelope id (`evt_…`) + inner event type from a raw payload. */
export function extractEventEnvelope(payload: unknown): { eventId: string | null; eventType: string | null } {
  const p = payload as { data?: { id?: unknown; attributes?: { type?: unknown } } };
  const id = p?.data?.id;
  const type = p?.data?.attributes?.type;
  return {
    eventId: typeof id === 'string' && id ? id : null,
    eventType: typeof type === 'string' && type ? type : null,
  };
}

// ── Reference + payment extraction ───────────────────────────────────────────

/** Pull the SN…/TKN… reference from the payload, else deep-walk the body. */
export function extractReference(payload: unknown): string | null {
  const p = payload as {
    data?: {
      attributes?: {
        data?: { attributes?: { reference_number?: unknown; metadata?: { reference_code?: unknown } } };
      };
    };
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

export type GatewayPaymentInfo = {
  /** PayMongo payment id (pay_…) — the handle a refund is issued against. */
  paymentId: string | null;
  /** Processor fee for the payment, in centavos (null when absent). */
  feeCentavos: number | null;
  /** Gross amount charged, in centavos (null when absent). */
  amountCentavos: number | null;
  /**
   * Payment method / source type (card · gcash · paymaya · grab_pay · qrph …),
   * used to pick a method-aware fallback fee rate when the explicit `fee` is
   * absent. Null when the payload doesn't carry one.
   */
  methodType: string | null;
};

/**
 * Pull the settled payment's id + fee + amount + method type from a
 * checkout_session.payment.paid payload. Path:
 *   data.attributes.data.attributes.payments[] →
 *     { id, attributes:{ amount, fee, source:{ type }, payment_method_type } }
 * Prefers a payment whose status is 'paid'; falls back to the first entry.
 */
export function extractGatewayPaymentInfo(payload: unknown): GatewayPaymentInfo {
  const p = payload as {
    data?: { attributes?: { data?: { attributes?: { payments?: unknown } } } };
  };
  const payments = p?.data?.attributes?.data?.attributes?.payments;
  const empty: GatewayPaymentInfo = {
    paymentId: null,
    feeCentavos: null,
    amountCentavos: null,
    methodType: null,
  };
  if (!Array.isArray(payments) || payments.length === 0) return empty;

  const rows = payments as Array<{
    id?: unknown;
    attributes?: {
      amount?: unknown;
      fee?: unknown;
      status?: unknown;
      source?: { type?: unknown };
      payment_method_type?: unknown;
    };
  }>;
  const paid = rows.find((r) => r?.attributes?.status === 'paid');
  const chosen = paid ?? rows[0];
  if (!chosen) return empty;

  const idVal = chosen.id;
  const feeVal = chosen.attributes?.fee;
  const amtVal = chosen.attributes?.amount;
  // PayMongo carries the rail on the payment's source.type (e-wallets/card) and/or
  // payment_method_type — prefer source.type, fall back to payment_method_type.
  const srcType = chosen.attributes?.source?.type;
  const pmType = chosen.attributes?.payment_method_type;
  const methodType =
    (typeof srcType === 'string' && srcType ? srcType : null) ??
    (typeof pmType === 'string' && pmType ? pmType : null);
  return {
    paymentId: typeof idVal === 'string' && idVal ? idVal : null,
    feeCentavos: typeof feeVal === 'number' && Number.isFinite(feeVal) ? Math.round(feeVal) : null,
    amountCentavos: typeof amtVal === 'number' && Number.isFinite(amtVal) ? Math.round(amtVal) : null,
    methodType,
  };
}

/**
 * Pull the underlying payment id (pay_…) a payment.failed / refund.* / dispute.*
 * event references. For failed events the resource IS the payment (data.id);
 * for refund/dispute the payment id lives under attributes.payment_id.
 */
export function extractReferencedPaymentId(payload: unknown): string | null {
  const p = payload as {
    data?: { attributes?: { data?: { id?: unknown; attributes?: { payment_id?: unknown } } } };
  };
  const inner = p?.data?.attributes?.data;
  const viaAttr = inner?.attributes?.payment_id;
  if (typeof viaAttr === 'string' && viaAttr) return viaAttr;
  const viaId = inner?.id;
  if (typeof viaId === 'string' && viaId && viaId.startsWith('pay_')) return viaId;
  return null;
}

/** Refund id (ref_…) from a refund.* event payload. */
export function extractRefundId(payload: unknown): string | null {
  const p = payload as { data?: { attributes?: { data?: { id?: unknown } } } };
  const id = p?.data?.attributes?.data?.id;
  return typeof id === 'string' && id ? id : null;
}

/** Status string of the inner resource (e.g. a refund's 'succeeded'/'pending'/'failed'). */
export function extractInnerStatus(payload: unknown): string | null {
  const p = payload as { data?: { attributes?: { data?: { attributes?: { status?: unknown } } } } };
  const s = p?.data?.attributes?.data?.attributes?.status;
  return typeof s === 'string' && s ? s : null;
}

// ── Fee derivation (Gap 6) ───────────────────────────────────────────────────

/**
 * Book the processor fee for the order: use the payload's explicit fee when
 * present, else estimate from the known rate. Never negative; rounded to whole
 * centavos. This is a ledger cost-visibility figure — it does NOT change the
 * buyer's charge or receipt.
 */
export function deriveGatewayFeeCentavos(args: {
  amountCentavos: number | null;
  providedFeeCentavos: number | null;
  feeBps?: number;
  /** Payment method / source type (card · gcash · qrph …) for a method-aware estimate. */
  methodType?: string | null;
}): number {
  const { amountCentavos, providedFeeCentavos } = args;
  if (typeof providedFeeCentavos === 'number' && Number.isFinite(providedFeeCentavos) && providedFeeCentavos >= 0) {
    return Math.round(providedFeeCentavos);
  }
  // No explicit fee → estimate. An explicit feeBps wins; else a method-aware rate
  // (card/e-wallet/QR Ph) derived from the payment method; else the flat fallback.
  const bps = args.feeBps ?? fallbackFeeBpsForMethod(args.methodType);
  if (typeof amountCentavos === 'number' && Number.isFinite(amountCentavos) && amountCentavos > 0) {
    return Math.max(0, Math.round((amountCentavos * bps) / 10000));
  }
  return 0;
}

// ── Refund branching (Gap 4) ─────────────────────────────────────────────────

export type RefundMode = 'gateway' | 'manual';

/**
 * Decide whether a refund moves money back through PayMongo (the order was paid
 * on the gateway) or is recorded as an off-platform manual bank reversal (the
 * legacy apply-then-pay path). A gateway refund needs BOTH the 'paymongo'
 * channel AND a stored gateway payment id (pay_…) to call the API against.
 */
export function resolveRefundMode(args: {
  channel: string | null | undefined;
  gatewayPaymentId: string | null | undefined;
}): RefundMode {
  const isPayMongoChannel = (args.channel ?? '').toLowerCase() === 'paymongo';
  const hasPaymentId = typeof args.gatewayPaymentId === 'string' && args.gatewayPaymentId.length > 0;
  return isPayMongoChannel && hasPaymentId ? 'gateway' : 'manual';
}

/** Minimal success/failure shape of a gateway refund attempt (createPayMongoRefund). */
export type RefundOutcome = { ok: true; refundId?: string | null } | { ok: false; reason?: string };

/**
 * API-first ordering contract for refundOrder (Fix #2). The IRREVERSIBLE state
 * mutation — flip order→refunded · deactivateOrderSku · write the order_refunds
 * row — may proceed ONLY when the money is known-returned:
 *   • MANUAL  → unconditional: the owner already moved the money off-platform,
 *               this action just records it.
 *   • GATEWAY → TRUE iff the PayMongo /v1/refunds call SUCCEEDED. A FAILED gateway
 *               refund must leave the order fully untouched (still 'paid', access
 *               intact, no blocking order_refunds row) so it is retryable with no
 *               manual Studio surgery.
 * Pure + deterministic so the ordering guarantee is unit-tested without a DB.
 */
export function shouldProceedToRefundStateMutation(args: {
  mode: RefundMode;
  gatewayOutcome?: RefundOutcome | null;
}): boolean {
  if (args.mode === 'manual') return true;
  return args.gatewayOutcome?.ok === true;
}

/**
 * Build the order_refunds insert row for refundOrder. The row shape is
 * CONDITIONAL on the refund rail (Fix #1, deploy-ordering) so the code survives a
 * deploy that lands BEFORE the hardening migration (Vercel auto-deploys on merge;
 * the owner runs `supabase db push` after):
 *   • 'manual'  → byte-shape-identical to the pre-gateway insert: NO refund_mode /
 *                 gateway_refund_id keys (those columns don't exist yet
 *                 pre-migration), so a manual GCash/BDO refund still succeeds.
 *   • 'gateway' → adds refund_mode='gateway' + gateway_refund_id (only reachable
 *                 once PayMongo is live, which itself requires the migration).
 * Pure + deterministic so the shape invariant is unit-tested without a DB.
 */
export function buildOrderRefundRow(args: {
  orderId: string;
  refundCentavos: number;
  reason: string;
  adminUserId: string;
  proofUrl: string | null;
  mode: RefundMode;
  gatewayRefundId: string | null;
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    order_id: args.orderId,
    refund_amount_centavos: args.refundCentavos,
    reason: args.reason,
    refunded_by_admin_id: args.adminUserId,
    proof_url: args.proofUrl,
    status: 'sent',
  };
  if (args.mode === 'gateway') {
    row.refund_mode = 'gateway';
    row.gateway_refund_id = args.gatewayRefundId;
  }
  return row;
}

/** PayMongo's accepted refund `reason` enum. */
export const PAYMONGO_REFUND_REASONS = [
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'others',
] as const;
export type PayMongoRefundReason = (typeof PAYMONGO_REFUND_REASONS)[number];

/** Coerce an arbitrary admin reason to a valid PayMongo enum value. */
export function normalizePayMongoRefundReason(reason?: string | null): PayMongoRefundReason {
  const r = (reason ?? '').toLowerCase();
  if ((PAYMONGO_REFUND_REASONS as readonly string[]).includes(r)) {
    return r as PayMongoRefundReason;
  }
  if (r.includes('duplicate')) return 'duplicate';
  if (r.includes('fraud')) return 'fraudulent';
  return 'requested_by_customer';
}

/** Build the POST /v1/refunds request body. amount is in centavos. */
export function buildPayMongoRefundBody(args: {
  paymentId: string;
  amountCentavos: number;
  reason?: string | null;
  metadata?: Record<string, string>;
}): { data: { attributes: Record<string, unknown> } } {
  return {
    data: {
      attributes: {
        amount: Math.round(args.amountCentavos),
        payment_id: args.paymentId,
        reason: normalizePayMongoRefundReason(args.reason),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      },
    },
  };
}

// ── Idempotency primitives (Gap 4 webhook dedup) ─────────────────────────────

/** Order statuses that are already fulfilled — a duplicate delivery no-ops. */
export function isTerminalPaidOrderStatus(status: unknown): boolean {
  return status === 'paid' || status === 'fulfilled';
}

/** Postgres unique-violation (23505) detection across supabase-js error shapes. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === '23505') return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return msg.includes('duplicate key') || msg.includes('unique constraint');
}

/** Minimal duck-typed client for the dedup insert/delete (testable with a fake). */
export type WebhookDedupClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>;
    delete(): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): PromiseLike<{ error: unknown }>;
      };
    };
  };
};

export type WebhookDedupResult = 'new' | 'duplicate' | 'skipped';

/**
 * Check-and-insert a processed-webhook-events row keyed by (provider, eventId).
 *   • 'new'       → first time we've seen this delivery id → proceed.
 *   • 'duplicate' → the unique (provider,event_id) already exists → the caller
 *                   should ack 200 without re-fulfilling.
 *   • 'skipped'   → no event id, or an unexpected insert error → fail OPEN
 *                   (proceed); the order-status idempotency guard still prevents
 *                   a double-fulfill, so a dedup miss never blocks a real event.
 */
export async function markWebhookEventProcessed(
  client: WebhookDedupClient,
  args: { provider: string; eventId: string | null; eventType?: string | null },
): Promise<WebhookDedupResult> {
  if (!args.eventId) return 'skipped';
  const { error } = await client.from('processed_webhook_events').insert({
    provider: args.provider,
    event_id: args.eventId,
    event_type: args.eventType ?? null,
  });
  if (!error) return 'new';
  if (isUniqueViolation(error)) return 'duplicate';
  return 'skipped';
}

/**
 * Roll back a dedup marker so a RETRYABLE (5xx) failure isn't dedup-swallowed on
 * PayMongo's next retry. Best-effort — a failed delete just leaves the marker,
 * which at worst turns a subsequent retry into a no-op ack.
 */
export async function unmarkWebhookEventProcessed(
  client: WebhookDedupClient,
  args: { provider: string; eventId: string | null },
): Promise<void> {
  if (!args.eventId) return;
  try {
    await client.from('processed_webhook_events').delete().eq('provider', args.provider).eq('event_id', args.eventId);
  } catch {
    // best-effort
  }
}

// ── Post-paid fulfillment tail ordering (M1) ─────────────────────────────────

/**
 * Run the receipt → payouts → SKU-activation tail with the EXACT try/catch
 * discipline the money-path audit (M1) requires: a receipt or payout failure is
 * swallowed (best-effort, idempotent, back-fillable) so it can NEVER strand SKU
 * activation — the one step that grants the capability the buyer just paid for.
 * Extracted here as a pure orchestrator so the ordering guarantee is unit-tested
 * independently of Supabase; `lib/finalize-paid-order.ts` injects the real steps.
 */
export async function runPostPaidEffects(steps: {
  issueReceipt: () => Promise<void>;
  schedulePayouts: () => Promise<void>;
  activateSku: () => Promise<void>;
  onReceiptError?: (e: unknown) => void;
  onPayoutError?: (e: unknown) => void;
}): Promise<void> {
  try {
    await steps.issueReceipt();
  } catch (e) {
    steps.onReceiptError?.(e);
  }
  try {
    await steps.schedulePayouts();
  } catch (e) {
    steps.onPayoutError?.(e);
  }
  // Activation is NOT wrapped: it never throws by contract, and if it ever did
  // the caller must see it (a silently-unactivated paid order is the worst
  // outcome). Mirrors the original inline `await activateOrderSku(...)`.
  await steps.activateSku();
}
