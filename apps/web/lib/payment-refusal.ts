/**
 * payment-refusal — a supplier's "it never reached me" on a payment the couple
 * logged, and Setnayan's settlement of it, read ONE way on every surface. H4.
 *
 * ⚖ Owner 2026-09-11: one path for every payment. The DEPOSIT's refusal lives
 * on `event_vendors` (reject_vendor_deposit → settle_vendor_deposit_dispute) —
 * even though the deposit is also a row on the ledger. An INSTALLMENT's lives
 * on its own `event_vendor_payments` row (migration 20271222394035). So the
 * deposit's ledger row carries NO refusal columns of its own, and a surface
 * that read them would report "no answer" while the booking says "refused".
 * This module is the one place that knows which columns belong to which row.
 *
 * PURE. The readers select the two column sets below and hand the rows in.
 */

export type PaymentSettlement = {
  outcome: 'payment_stands' | 'not_received';
  /** Setnayan's reason, shown to both parties. */
  note: string | null;
  atMs: number;
};

export type PaymentDispute = {
  /** Non-null while the supplier's refusal stands on the row. */
  refusedAtMs: number | null;
  /** The supplier's own words, when they gave any. */
  reason: string | null;
  /**
   * Setnayan's ruling. `payment_stands` outlives the refusal it settled (the
   * refusal is lifted and the payment confirmed); `not_received` sits beside it.
   */
  settlement: PaymentSettlement | null;
};

/** The ledger's own columns — an installment's refusal. */
export const LEDGER_DISPUTE_COLUMNS =
  'is_deposit_record, payment_refused_at, payment_refusal_reason, payment_dispute_settled_at, payment_dispute_outcome, payment_dispute_note';

/** The booking's columns — the deposit's refusal. */
export const DEPOSIT_DISPUTE_COLUMNS =
  'deposit_declined_at, deposit_decline_reason, deposit_dispute_settled_at, deposit_dispute_outcome, deposit_dispute_note';

export type LedgerDisputeRow = {
  is_deposit_record?: boolean | null;
  payment_refused_at?: string | null;
  payment_refusal_reason?: string | null;
  payment_dispute_settled_at?: string | null;
  payment_dispute_outcome?: string | null;
  payment_dispute_note?: string | null;
};

export type DepositDisputeRow = {
  deposit_declined_at?: string | null;
  deposit_decline_reason?: string | null;
  deposit_dispute_settled_at?: string | null;
  deposit_dispute_outcome?: string | null;
  deposit_dispute_note?: string | null;
};

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function text(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t.length > 0 ? t : null;
}

function settlementOf(
  at: string | null | undefined,
  outcome: string | null | undefined,
  note: string | null | undefined,
): PaymentSettlement | null {
  const atMs = ms(at);
  if (atMs == null) return null;
  if (outcome !== 'payment_stands' && outcome !== 'not_received') return null;
  return { outcome, note: text(note), atMs };
}

/**
 * The dispute on one payment, or null when there has never been one on the row
 * as it stands. `booking` is the payment's `event_vendors` row; it is read ONLY
 * when the payment is the deposit's record.
 */
export function readPaymentDispute(
  payment: LedgerDisputeRow,
  booking: DepositDisputeRow | null | undefined,
): PaymentDispute | null {
  const d =
    payment.is_deposit_record === true
      ? {
          refusedAtMs: ms(booking?.deposit_declined_at),
          reason: text(booking?.deposit_decline_reason),
          settlement: settlementOf(
            booking?.deposit_dispute_settled_at,
            booking?.deposit_dispute_outcome,
            booking?.deposit_dispute_note,
          ),
        }
      : {
          refusedAtMs: ms(payment.payment_refused_at),
          reason: text(payment.payment_refusal_reason),
          settlement: settlementOf(
            payment.payment_dispute_settled_at,
            payment.payment_dispute_outcome,
            payment.payment_dispute_note,
          ),
        };
  if (d.refusedAtMs == null && d.settlement == null) return null;
  // Words without a standing refusal are the residue of a lifted one — the
  // columns are cleared together, so this only guards a half-written row.
  return d.refusedAtMs == null ? { ...d, reason: null } : d;
}

/** Refused and not yet ruled on — the definition /admin/disputes counts. */
export function isOpenDispute(d: PaymentDispute | null): boolean {
  return d != null && d.refusedAtMs != null && d.settlement == null;
}

/**
 * Is this unconfirmed payment still waiting on the SUPPLIER? Not once they have
 * said it never arrived — it is Setnayan's then, and every "N awaiting your
 * confirmation" count must stop counting it (H4).
 */
export function awaitsTheSupplier(p: { dispute?: PaymentDispute | null }): boolean {
  return p.dispute?.refusedAtMs == null;
}
