/**
 * lib/maya-checkout.ts — the Maya Checkout rail's RULES, pure (no I/O), so the
 * pay page, the webhook, the admin pages and the tests ask one module.
 *
 * ⚖ OWNER 2026-11-21 (Setnayan-specs DECISION_LOG "MAYA CHECKOUT — BUILD IT"):
 *   1 · Maya Checkout is an ADDITIONAL rail beside the BDO QR. BDO stays the
 *       default and unchanged.
 *   2 · It is on when the admin switch `platform_settings.maya_checkout_enabled`
 *       is ON **and** both Maya keys are present. Switch on with a key missing =
 *       rail hidden, and the admin page says which key (`mayaRailState`).
 *   3 · The payer pays the order total EXACTLY. Setnayan absorbs Maya's fee —
 *       there is no surcharge line anywhere (`mayaCheckoutBody` sends the total
 *       and nothing else).
 *   5 · Automatic approval ONLY when Maya's API, called server-side with our
 *       SECRET key, says PAYMENT_SUCCESS for the exact reference and the exact
 *       amount in PHP (`judgeMayaPayment`). Anything else is not a "yes".
 *
 * ── MAYA'S API, AS DOCUMENTED (read 2026-11-21) ──────────────────────────────
 *   · Auth: HTTP Basic, the key as username and an EMPTY password — base64 of
 *     `key:` (developers.maya.ph/reference/how-api-authentication-works-in-maya-checkout).
 *   · Create checkout: POST /checkout/v1/checkouts, PUBLIC key. Body
 *     totalAmount{value,currency} + requestReferenceNumber (1–36 chars) + items[]
 *     {name,quantity,totalAmount} + redirectUrl{success,failure,cancel}; returns
 *     {checkoutId, redirectUrl} (developers.maya.ph/reference/createv1checkout).
 *   · Retrieve payment: GET /payments/v1/payments/{paymentId}, SECRET key; and
 *     GET /payments/v1/payment-rrns/{rrn} (an ARRAY) — fields id, isPaid,
 *     status, amount, currency, requestReferenceNumber
 *     (developers.maya.ph/reference/getpaymentviapaymentid-1,
 *      developers.maya.ph/reference/getpaymentviarequestreferencenumber-1).
 *     Maya's guide says the checkoutId IS the paymentId; we never rely on that
 *     alone — the payment is also looked up by our reference.
 *   · Webhooks: POST/GET /payments/v1/webhooks, DELETE /payments/v1/webhooks/{id},
 *     SECRET key, body {name, callbackUrl}
 *     (developers.maya.ph/reference/createv1webhook-1). The POST body Maya sends
 *     is a payment object.
 *   · Sandbox base https://pg-sandbox.paymaya.com. Production: the docs name
 *     BOTH https://pg.paymaya.com and https://pg.maya.ph, so the base is never
 *     typed here — it is the ORIGIN of the endpoint the admin saved
 *     (`mayaApiBase`).
 */

import { formatPhp } from '@/lib/php';

/** The `payments.channel` (and `client_idempotency_key` prefix) of a Maya payment. */
export const MAYA_CHANNEL = 'maya';

/** The webhook events we register — Maya says PAYMENT_* supersede CHECKOUT_*. */
export const MAYA_WEBHOOK_EVENTS = [
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PAYMENT_EXPIRED',
  'PAYMENT_CANCELLED',
] as const;

/**
 * Maya's published webhook source addresses (developers.maya.ph/reference/api-environments,
 * read 2026-11-21). The webhook route answers anything else with a silent 200 and does
 * nothing (`isMayaWebhookSource`, ship review 21 Nov). The server-side re-verify is still
 * what approves money; the IPs only keep strangers from making us ask Maya.
 */
export const MAYA_WEBHOOK_SOURCE_IPS = {
  sandbox: ['13.229.160.234', '3.1.199.75'],
  production: ['18.138.50.235', '3.1.207.200'],
} as const;

export type MayaEnvironment = 'sandbox' | 'production';

/** The API origin, taken from the saved checkout endpoint. Null when it is not a URL. */
export function mayaApiBase(checkoutEndpoint: string): string | null {
  try {
    const u = new URL(checkoutEndpoint.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Sandbox when the endpoint's host says so; anything else is treated as real money. */
export function mayaEnvironment(checkoutEndpoint: string): MayaEnvironment {
  const base = mayaApiBase(checkoutEndpoint);
  return base && /sandbox/i.test(new URL(base).hostname) ? 'sandbox' : 'production';
}

/** `Authorization` value for a Maya key: Basic base64(`key:`). */
export function mayaBasicAuth(key: string): string {
  return `Basic ${Buffer.from(`${key}:`, 'utf8').toString('base64')}`;
}

export type MayaRailReason = 'off' | 'missing_public_key' | 'missing_secret_key' | 'missing_both_keys';

export type MayaRailState = { open: true } | { open: false; reason: MayaRailReason };

/**
 * Is the rail on? ON = the admin switch AND both keys. The switch is read
 * fail-CLOSED by the caller (an unreadable switch is OFF): Maya is an extra
 * rail, so "off" leaves the BDO QR exactly as it was.
 */
export function mayaRailState(args: {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
}): MayaRailState {
  if (!args.enabled) return { open: false, reason: 'off' };
  const pub = args.publicKey.trim().length > 0;
  const sec = args.secretKey.trim().length > 0;
  if (!pub && !sec) return { open: false, reason: 'missing_both_keys' };
  if (!pub) return { open: false, reason: 'missing_public_key' };
  if (!sec) return { open: false, reason: 'missing_secret_key' };
  return { open: true };
}

/** What the admin page says when the switch is on but the rail is hidden. */
export function mayaRailReasonLine(reason: MayaRailReason): string | null {
  switch (reason) {
    case 'off':
      return null;
    case 'missing_public_key':
      return 'Hidden from payers: the Maya public key is not set. Add it in Integrations.';
    case 'missing_secret_key':
      return 'Hidden from payers: the Maya secret key is not set. Add it in Integrations.';
    case 'missing_both_keys':
      return 'Hidden from payers: no Maya keys are set. Add both in Integrations.';
  }
}

/** A peso figure as Maya's two-decimal value, from whole centavos (never float drift). */
export function mayaAmountValue(amountPhp: number): string {
  return (Math.round(amountPhp * 100) / 100).toFixed(2);
}

/** Pesos → whole centavos, or null for anything that is not a finite number. */
export function toCentavos(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** The pay page's return address for one outcome. */
export function mayaReturnUrl(origin: string, reference: string, outcome: 'success' | 'failure' | 'cancel'): string {
  // A cancel or fail lands back ON the pay stage (v3: "back on the same choices with one line").
  const step = outcome === 'success' ? '' : '&step=2';
  return `${origin.replace(/\/+$/, '')}/pay/${encodeURIComponent(reference)}?maya=${outcome}${step}`;
}

/**
 * The create-checkout body. ONE item — the order's own description — at the
 * order total; no fee, no surcharge, no second line (owner ruling 3).
 */
export function mayaCheckoutBody(args: {
  amountPhp: number;
  reference: string;
  description: string;
  origin: string;
}): Record<string, unknown> {
  const value = mayaAmountValue(args.amountPhp);
  const name = args.description.trim().slice(0, 120) || 'Setnayan order';
  return {
    totalAmount: { value, currency: 'PHP' },
    requestReferenceNumber: args.reference,
    items: [{ name, quantity: '1', totalAmount: { value } }],
    redirectUrl: {
      success: mayaReturnUrl(args.origin, args.reference, 'success'),
      failure: mayaReturnUrl(args.origin, args.reference, 'failure'),
      cancel: mayaReturnUrl(args.origin, args.reference, 'cancel'),
    },
  };
}

/** The fields of Maya's payment object this module reads. Everything is optional: it came over a wire. */
export type MayaPaymentLike = {
  id?: unknown;
  status?: unknown;
  isPaid?: unknown;
  amount?: unknown;
  currency?: unknown;
  requestReferenceNumber?: unknown;
  /** How it was paid (Maya's own words) — read only for the payer's receipt row, never for the verdict. */
  fundSource?: { type?: unknown; description?: unknown } | null;
};

const FAILED: Record<string, 'failed' | 'expired' | 'cancelled'> = {
  PAYMENT_FAILED: 'failed',
  AUTH_FAILED: 'failed',
  PAYMENT_INVALID: 'failed',
  ACCOUNT_ABUSE: 'failed',
  VOIDED: 'failed',
  REFUNDED: 'failed',
  PAYMENT_EXPIRED: 'expired',
  CAPTURE_HOLD_EXPIRED: 'expired',
  PAYMENT_CANCELLED: 'cancelled',
};

export type MayaVerdict =
  /** Paid, for this reference, this amount, in PHP — the ONLY verdict that may approve. */
  | { kind: 'paid'; mayaPaymentId: string; amountPhp: number; paidWith: string | null }
  /** Maya says it is paid, but something does not agree — the admin decides. */
  | { kind: 'mismatch'; mayaPaymentId: string | null; amountPhp: number | null; reason: string }
  /** Not paid and never will be. */
  | { kind: 'closed'; mayaPaymentId: string | null; status: 'failed' | 'expired' | 'cancelled' }
  /** Not settled yet (processing, awaiting authentication, …). */
  | { kind: 'pending'; mayaPaymentId: string | null };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * THE judgement on one payment object that came from Maya's API (never from a
 * webhook body — the caller fetches it with the secret key first).
 *
 * 🔑 A "yes" needs all four: status PAYMENT_SUCCESS (with `isPaid` not false),
 * currency PHP, our exact reference, and the exact amount to the centavo. Each
 * miss is named, so the admin reads why it was not approved.
 */
export function judgeMayaPayment(
  payment: MayaPaymentLike,
  expected: { reference: string; amountPhp: number },
): MayaVerdict {
  const id = str(payment.id);
  const status = str(payment.status)?.toUpperCase() ?? '';
  const closed = FAILED[status];
  if (closed) return { kind: 'closed', mayaPaymentId: id, status: closed };
  if (status !== 'PAYMENT_SUCCESS') return { kind: 'pending', mayaPaymentId: id };

  const amountC = toCentavos(payment.amount);
  const amountPhp = amountC == null ? null : amountC / 100;
  const mismatch = (reason: string): MayaVerdict => ({ kind: 'mismatch', mayaPaymentId: id, amountPhp, reason });

  if (!id) return mismatch('Maya says paid but gave no payment id.');
  if (payment.isPaid === false) return mismatch('Maya says PAYMENT_SUCCESS but isPaid is false.');
  const currency = str(payment.currency)?.toUpperCase() ?? null;
  if (currency !== 'PHP') return mismatch(`Paid in ${currency ?? 'an unknown currency'}, not PHP.`);
  const rrn = str(payment.requestReferenceNumber);
  if (rrn !== expected.reference) {
    return mismatch(`Maya's reference ${rrn ?? '(none)'} is not this order's ${expected.reference}.`);
  }
  const expectedC = Math.round(expected.amountPhp * 100);
  if (amountC == null) return mismatch('Maya gave no amount for this payment.');
  if (amountC !== expectedC) {
    return mismatch(`Maya received ${formatPhp(amountC / 100)}; the order is ${formatPhp(expectedC / 100)}.`);
  }
  return { kind: 'paid', mayaPaymentId: id, amountPhp: amountC / 100, paidWith: mayaPaidWith(payment) };
}

/**
 * Pick the verdict for an order from every Maya payment carrying its reference
 * (GET /payment-rrns/{rrn} returns a list). A paid one wins; then a paid-but-
 * wrong one (the admin must see it); then pending; then closed.
 */
export function judgeMayaPayments(
  payments: readonly MayaPaymentLike[],
  expected: { reference: string; amountPhp: number },
): MayaVerdict {
  const verdicts = payments.map((p) => judgeMayaPayment(p, expected));
  return (
    verdicts.find((v) => v.kind === 'paid') ??
    verdicts.find((v) => v.kind === 'mismatch') ??
    verdicts.find((v) => v.kind === 'pending') ??
    verdicts.find((v) => v.kind === 'closed') ?? { kind: 'pending', mayaPaymentId: null }
  );
}

/**
 * How the payer paid, in Maya's own words, for the receipt row ("Paid with … · through Maya"). Maya's `fundSource`
 * carries a description and a type; neither is mapped to a label of ours (no guessed method names) — the description
 * wins, else the type, else nothing and the row reads "through Maya" alone.
 */
export function mayaPaidWith(payment: MayaPaymentLike): string | null {
  const fs = payment.fundSource;
  if (!fs || typeof fs !== 'object') return null;
  return (str(fs.description) ?? str(fs.type))?.slice(0, 80) ?? null;
}

/**
 * The line on the BDO safety route when Maya would not open (v3 drawing, verbatim). Never an error, never a retry
 * button, never a link back to Maya.
 */
export const MAYA_BUSY_LINE = 'Maya is busy — pay by BDO QR. Nothing has been charged.';

/**
 * The short-lived cookie the busy fallback sets (value = the order id) — the only thing that makes `?maya=busy` show
 * the BDO QR (ship review item 2: a typed `?maya=busy` must not route around Maya while Maya is up).
 */
export const MAYA_BUSY_COOKIE = 'sn_maya_busy';
export const MAYA_BUSY_COOKIE_SECONDS = 15 * 60;

/**
 * Is this request from one of Maya's published webhook addresses? (Ship review 21 Nov: the IPs are the gate on the
 * webhook route, on top of the API re-verify.) The client address is the FIRST entry of `x-forwarded-for`, which
 * Vercel's edge sets; anything unreadable is "no".
 */
export function isMayaWebhookSource(
  forwardedFor: string | null,
  realIp: string | null,
  /** The environment of the saved endpoint — production hears only production's addresses (ship review item 6). */
  env: MayaEnvironment,
): boolean {
  const ip = (forwardedFor?.split(',')[0] ?? realIp ?? '').trim();
  if (!ip) return false;
  return (MAYA_WEBHOOK_SOURCE_IPS[env] as readonly string[]).includes(ip);
}

/** The one line a payer reads on returning from Maya without paying. */
export function mayaReturnLine(outcome: string | undefined): string | null {
  if (outcome === 'failure') return 'Maya didn’t take the payment. Nothing was charged.';
  if (outcome === 'cancel') return 'You left Maya before paying. Nothing was charged.';
  return null;
}

/** The admin note on a payment Maya confirmed and we approved. */
export function mayaApprovedNote(mayaPaymentId: string, env: MayaEnvironment): string {
  return env === 'sandbox'
    ? `Paid via Maya · ${mayaPaymentId} · SANDBOX: a test payment, no money moved.`
    : `Paid via Maya · ${mayaPaymentId} · confirmed with Maya's API.`;
}

/** Is this payment row one that came through Maya? (The admin tag reads this.) */
export function isMayaPayment(channel: string | null | undefined): boolean {
  return channel === MAYA_CHANNEL;
}

/** What the Integrations card says after "Register webhooks" (from the redirect's `maya_webhooks`). */
export function mayaWebhookNotice(code: string | undefined): { ok: boolean; text: string } | null {
  switch (code) {
    case 'ok':
      return { ok: true, text: 'Registered. Maya will tell us about every payment.' };
    case 'no_secret_key':
      return { ok: false, text: 'Add the secret key first.' };
    case 'bad_endpoint':
      return { ok: false, text: 'The checkout endpoint is not a valid address.' };
    case 'refused':
      return { ok: false, text: 'Maya refused or did not answer. Check the keys and try again.' };
    default:
      return null;
  }
}
