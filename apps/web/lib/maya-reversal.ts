/**
 * lib/maya-reversal.ts — handing a Maya payment back FROM Setnayan, for as long as Maya allows it
 * (owner 2026-11-22 "make it possible to allow refund until maya allow refund" · specs DECISION_LOG 86f20253).
 *
 * Pure: no fetch, no database, no key. lib/maya-api.ts does the HTTP and lib/maya-reversal.server.ts the reads.
 *
 * ── WHAT MAYA DOCUMENTS (developers.maya.ph, read 2026-11-22) ───────────────────────────────────────────────────────
 * · GET /payments/v1/payments/{paymentId} (secret key) returns `canVoid` and `canRefund` booleans, `status`
 *   (PaymentStates: … PAYMENT_SUCCESS, VOIDED, REFUNDED, CAPTURED …), `amount`, `currency`, `createdAt` (UTC).
 *   That is the verdict this module reads first.
 * · /docs/voids-and-refunds and /reference/voids-and-refunds: "You can void a transaction on the same day before
 *   midnight or 12am (GMT+8) of the transaction date." · "You can issue refunds the day after the transaction date,
 *   starting after midnight or 12am (GMT+8)." · "…within 180 days from the date of the transaction." · "Void and
 *   refund requests are processed synchronously and the status or outcome determined by the API response is final."
 *   · "To enable this functionality reach out to your Maya Relationship Manager."
 *   That is the FALLBACK, used only when Maya's answer carries neither flag.
 * · /reference/understanding-payment-statuses-in-maya-checkout: PAYMENT_SUCCESS is "still reversible (void/refund)".
 * · /reference/payment-related-errors: PY0045 · PY0047 · PY0048 · PY0072 · PY0073 · PY0082 · PY0093 · PY0113 ·
 *   PY0019 ("an API key that does not have the necessary permissions … confirm that the feature … has been
 *   activated") — the lines below say each one plainly.
 *
 * ⚠ WHAT THE PUBLIC PAGES DO NOT SHOW: the void/refund ROUTES and their BODIES. No page read on 2026-11-22 lists
 * them (the reference index has only the separate P3 product's /p3/void and /p3/refund). The routes are the ones the
 * controller cited as Maya's (POST /payments/v2/payments/{paymentId}/voids · /refunds); the body is `reason`, plus
 * the full amount for a refund. If either is wrong, Maya refuses it, the desk shows the refusal, and NOTHING is
 * recorded — the failure is a refusal, never a wrong payout. Confirm both with the Maya Relationship Manager when
 * the account is switched on.
 */
import { mayaAmountValue, toCentavos, type MayaPaymentLike } from '@/lib/maya-checkout';

export type MayaReversalKind = 'void' | 'refund';

export type MayaReversalRead =
  /** Maya allows this one, now, for exactly this amount (the whole payment). */
  | { kind: MayaReversalKind; amountPhp: number }
  /** Maya already shows it handed back — record it if Setnayan has not (a record lost after Maya's yes). */
  | { kind: 'already'; status: 'VOIDED' | 'REFUNDED'; amountPhp: number }
  /** Maya allows neither any more. */
  | { kind: 'neither' }
  /** Maya could not be read, or its answer does not hold together — never shown as "not refundable". */
  | { kind: 'error' };

export const MAYA_REVERSAL_ROUTE: Record<MayaReversalKind, string> = { void: 'voids', refund: 'refunds' };

export function mayaReversalPath(mayaPaymentId: string, kind: MayaReversalKind): string {
  return `/payments/v2/payments/${encodeURIComponent(mayaPaymentId)}/${MAYA_REVERSAL_ROUTE[kind]}`;
}

/** Full amount only — a void is whole by Maya's rule, and a refund is sent for the whole payment. */
export function mayaReversalBody(input: { kind: MayaReversalKind; amountPhp: number; reason: string }): Record<string, unknown> {
  const reason = input.reason.trim().slice(0, 512);
  return input.kind === 'void'
    ? { reason }
    : { totalAmount: { amount: mayaAmountValue(input.amountPhp), currency: 'PHP' }, reason };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** GMT+8 has no daylight saving, so a fixed offset is the PH calendar. */
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
/** "within 180 days from the date of the transaction" (/docs/voids-and-refunds). */
export const MAYA_REFUND_DAYS = 180;

/** The PH calendar day (as a day number) an instant falls on. */
function phDay(ms: number): number {
  return Math.floor((ms + PH_OFFSET_MS) / MS_PER_DAY);
}

export type MayaPaymentWithFlags = MayaPaymentLike & { canVoid?: unknown; canRefund?: unknown; createdAt?: unknown };

/**
 * THE decision for one payment Maya's API returned. Maya's own flags first; the documented cut-off only when Maya
 * sent neither flag. An unreadable amount or a non-PHP payment is 'error': a full-amount reversal needs the amount.
 */
export function decideMayaReversal(p: MayaPaymentWithFlags, nowMs: number): MayaReversalRead {
  const centavos = toCentavos(p.amount);
  if (centavos === null || centavos <= 0) return { kind: 'error' };
  if (p.currency !== undefined && p.currency !== 'PHP') return { kind: 'error' };
  const amountPhp = centavos / 100;

  if (p.status === 'VOIDED' || p.status === 'REFUNDED') return { kind: 'already', status: p.status, amountPhp };

  if (p.canVoid === true) return { kind: 'void', amountPhp };
  if (p.canRefund === true) return { kind: 'refund', amountPhp };
  if (typeof p.canVoid === 'boolean' || typeof p.canRefund === 'boolean') return { kind: 'neither' };

  // ── Fallback: Maya sent no flags. Its own timestamp and the documented cut-off. ──
  if (p.status !== 'PAYMENT_SUCCESS' && p.status !== 'CAPTURED') return { kind: 'neither' };
  const created = typeof p.createdAt === 'string' ? Date.parse(p.createdAt) : NaN;
  if (!Number.isFinite(created)) return { kind: 'error' };
  const days = phDay(nowMs) - phDay(created);
  if (days < 0) return { kind: 'error' };
  if (days === 0) return { kind: 'void', amountPhp };
  if (days <= MAYA_REFUND_DAYS) return { kind: 'refund', amountPhp };
  return { kind: 'neither' };
}

/** The one line when Maya allows neither. */
export const MAYA_NO_LONGER_LINE = 'Maya no longer allows a void or a refund for this payment.';
/** The one line when Maya could not be read. */
export const MAYA_UNREACHABLE_LINE = 'Couldn’t reach Maya — try again.';
/** The refusal when the account is not switched on for it (controller 2026-11-22, verbatim). */
export const MAYA_NOT_ENABLED_LINE =
  'Maya hasn’t switched on refunds through the app for this account — ask your Maya account manager';

const PY_LINES: Record<string, string> = {
  PY0045: 'Maya says this payment can’t be voided.',
  PY0073: 'Maya’s void window closed at midnight — refresh the page to refund it instead.',
  PY0047: 'Maya says this payment can’t be refunded — it is past 180 days, or not yet eligible.',
  PY0048: 'Maya refused: the refund is more than the payment.',
  PY0072: 'Maya refunds only from the day after the payment — refresh the page to void it instead.',
  PY0082: 'Maya already has a refund for this payment — refresh the page.',
  PY0093: 'Maya is already updating this payment — refresh the page.',
  PY0113: 'Maya won’t take a partial refund on this payment.',
  PY0019: `${MAYA_NOT_ENABLED_LINE}.`,
};

/** One plain line for a refusal. Every refusal ends the same way: nothing was recorded. */
export function mayaRefusalLine(r: { status: number | null; code: string | null }): string {
  const tail = ' Nothing was recorded.';
  if (r.status === null) {
    // No answer to a POST is not a "no" — Maya may have done it. The page re-reads Maya and shows the truth.
    return 'Maya didn’t answer — refresh the page to see whether it went through.' + tail;
  }
  if (r.code && PY_LINES[r.code]) return PY_LINES[r.code] + tail;
  // A refusal of the key with no code of its own is the account not being switched on for this.
  if (r.status === 401 || r.status === 403) return `${MAYA_NOT_ENABLED_LINE}.${tail}`;
  return `Maya refused it${r.code ? ` (${r.code})` : ''}.${tail}`;
}

export type MayaReversalDeps = {
  /** GET /payments/v1/payments/{id}: the payment, null when Maya has none, 'error' when unreadable. */
  fetchPayment: (mayaPaymentId: string) => Promise<MayaPaymentWithFlags | null | 'error'>;
  /** POST the void/refund (lib/maya-api.ts postMayaReversal). */
  postReversal: (input: {
    mayaPaymentId: string;
    kind: MayaReversalKind;
    amountPhp: number;
    reason: string;
  }) => Promise<{ ok: true } | { ok: false; status: number | null; code: string | null }>;
  now: () => number;
};

/** What the desk draws for a Maya-paid order: read live, never cached. */
export async function readMayaReversal(deps: Pick<MayaReversalDeps, 'fetchPayment' | 'now'>, mayaPaymentId: string): Promise<MayaReversalRead> {
  try {
    const p = await deps.fetchPayment(mayaPaymentId);
    if (!p || p === 'error') return { kind: 'error' };
    return decideMayaReversal(p, deps.now());
  } catch {
    return { kind: 'error' };
  }
}

export type MayaReversalOutcome =
  /** Maya said yes (or already shows it handed back) — the ONLY outcome that may be recorded. */
  | { ok: true; kind: MayaReversalKind | 'already'; amountPhp: number }
  /** Maya said no, could not be read, or allows neither — `line` is what the admin reads. Record NOTHING. */
  | { ok: false; line: string };

/**
 * Re-read Maya at the moment of the press (a void allowed on the page at 11:58 pm is a refund at 12:01 am), then
 * POST exactly what Maya allows, for the whole payment. `expectAmountPhp`, when given (the two-admin path), must
 * equal Maya's amount: the second admin approved that number, not whatever the payment says now.
 */
export async function runMayaReversal(
  deps: MayaReversalDeps,
  input: { mayaPaymentId: string; reason: string; expectAmountPhp?: number },
): Promise<MayaReversalOutcome> {
  const read = await readMayaReversal(deps, input.mayaPaymentId);
  if (read.kind === 'error') return { ok: false, line: `${MAYA_UNREACHABLE_LINE} Nothing was recorded.` };
  if (read.kind === 'neither') return { ok: false, line: `${MAYA_NO_LONGER_LINE} Nothing was recorded.` };
  if (input.expectAmountPhp !== undefined && Math.round(input.expectAmountPhp * 100) !== Math.round(read.amountPhp * 100)) {
    return {
      ok: false,
      line: `Maya’s payment is ₱${read.amountPhp.toFixed(2)}, not the ₱${input.expectAmountPhp.toFixed(2)} approved. Nothing was sent or recorded.`,
    };
  }
  if (read.kind === 'already') return { ok: true, kind: 'already', amountPhp: read.amountPhp };
  let res: Awaited<ReturnType<MayaReversalDeps['postReversal']>>;
  try {
    res = await deps.postReversal({
      mayaPaymentId: input.mayaPaymentId,
      kind: read.kind,
      amountPhp: read.amountPhp,
      reason: input.reason,
    });
  } catch {
    res = { ok: false, status: null, code: null };
  }
  if (!res.ok) return { ok: false, line: mayaRefusalLine(res) };
  return { ok: true, kind: read.kind, amountPhp: read.amountPhp };
}
