import crypto from 'crypto';

/**
 * PayMongo webhook signature verification — the SDK-authoritative scheme.
 *
 * ⚠ The PayMongo prose docs are WRONG here (they describe HMAC of the raw body
 * alone). The real scheme, per PayMongo's own `paymongo-node` SDK
 * (src/services/Webhook.js → constructEvent), is:
 *   • Header `Paymongo-Signature: t=<unix>,te=<test-hmac>,li=<live-hmac>`
 *   • Signed string = `${t}.${rawBody}` (timestamp, a dot, then the RAW body)
 *   • HMAC-SHA256, hex digest, keyed with the WEBHOOK's own secret (`whsk_…`,
 *     returned once when the webhook is registered) — NOT the `sk_` API key.
 *   • Compare to `li` when present (live), else `te` (test).
 * Verify against the RAW request body (never a re-serialized JSON).
 *
 * Pure + dependency-light so it is unit-testable without a live gateway.
 */
export function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret: string | null | undefined,
): boolean {
  if (!webhookSecret || !signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const seg of signatureHeader.split(',')) {
    const eq = seg.indexOf('=');
    if (eq > 0) parts[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
  }

  const timestamp = parts.t;
  // Live signature wins when present; else the test-mode signature.
  const provided = parts.li && parts.li !== '' ? parts.li : parts.te;
  if (!timestamp || !provided) return false;

  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  // timingSafeEqual throws on length mismatch — guard first. Genuine SHA-256 hex
  // digests are both 64 chars, so a length mismatch is already a rejection.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type PaymongoPaidEvent = {
  /** The event id (evt_…) — dedupe key. */
  eventId: string;
  /** The event type, e.g. 'checkout_session.payment.paid'. */
  type: string;
  livemode: boolean;
  /** Our reconciliation handle from checkout metadata. */
  chargeId: string | null;
  referenceNumber: string | null;
  /** The settled payment id (pay_…), for the audit trail. */
  paymentId: string | null;
  paymentSource: string | null; // 'gcash' | 'card' | …
};

/**
 * Parse a verified PayMongo event body into the fields we reconcile against.
 * For `checkout_session.payment.paid` the resource at
 * event.data.attributes.data is the checkout_session, carrying our metadata +
 * reference_number, with the payment in attributes.payments[0]. Returns null if
 * the shape is unexpected (fail-closed at the caller: no settle).
 */
export function parsePaymongoEvent(rawBody: string): PaymongoPaidEvent | null {
  try {
    const evt = JSON.parse(rawBody);
    const data = evt?.data;
    const attrs = data?.attributes;
    if (!data?.id || !attrs?.type) return null;

    const resource = attrs.data; // the checkout_session (for our event type)
    const rAttrs = resource?.attributes ?? {};
    const meta = rAttrs.metadata ?? {};
    const payment = Array.isArray(rAttrs.payments) ? rAttrs.payments[0] : null;

    return {
      eventId: String(data.id),
      type: String(attrs.type),
      livemode: Boolean(attrs.livemode),
      chargeId: typeof meta.charge_id === 'string' ? meta.charge_id : null,
      referenceNumber:
        typeof rAttrs.reference_number === 'string' ? rAttrs.reference_number : null,
      paymentId: payment?.id ? String(payment.id) : null,
      paymentSource:
        typeof payment?.attributes?.source?.type === 'string'
          ? payment.attributes.source.type
          : null,
    };
  } catch {
    return null;
  }
}
