/**
 * WHAT HAS ALREADY BEEN PAID — one pure shaping rule for the payment history
 * both ends of a booking read: the couple's "Amount to pay" card (Payments tab
 * AND the chat quote card, which mounts it) and the supplier's client page +
 * chat card.
 *
 * ── THE DEFECT THIS CLOSES (owner, live as testnayan4, 2026-09-20) ──────────
 * "show the current payments done as well."
 *
 * ₱3,350 had been recorded on Sep 20 and confirmed by the supplier, and NO
 * surface showed it. The card named only the next installment, so the couple
 * could not tell a booking they had paid into from one they had not, and the
 * supplier could not see what they had already been sent.
 *
 * ── A REFUSED READ IS NOT AN EMPTY LEDGER ──────────────────────────────────
 * `rowsOrNull === null` means the `event_vendor_payments` read was REFUSED.
 * It returns `{ state: 'unreadable' }`, never `{ state: 'none' }` — the two
 * have different sentences, and only one of them is a claim about money. This
 * is the same rule #5724 put on the guest list, for the same reason: "no
 * payments yet" is byte-identical to a genuinely new booking, and it is the
 * one sentence a couple who has paid ₱3,350 must never be shown.
 *
 * ⚠ A DATE IS FORMATTED FROM ITS STRING, NEVER THROUGH `new Date(...)`.
 * `paid_at` is a Postgres DATE ('YYYY-MM-DD'); `new Date('2026-09-20')` is
 * midnight UTC, which is still the 19th in Manila.
 *
 * Pure: no I/O, no clock, no `Date`. Executed by `lib/not-due-yet.test.ts`.
 */
import { pesoFromCentavos } from './accepted-quote-terms';

/** One `event_vendor_payments` row, in the shape the reader selects. */
export type PaymentLedgerRow = {
  payment_id?: string | null;
  amount_php: number | string | null;
  paid_at: string | null;
  method: string | null;
  vendor_confirmed_at: string | null;
  payment_refused_at?: string | null;
  is_deposit_record?: boolean | null;
};

export type PaymentHistoryRow = {
  id: string;
  /** "Sep 20, 2026", or "Date not recorded" when `paid_at` is missing. */
  paidOn: string;
  amountCentavos: number;
  /** The couple's typed method ("GCash"), or null when they gave none. */
  method: string | null;
  confirmed: boolean;
  refused: boolean;
  isFirstPayment: boolean;
  /** "Confirmed by Saysay" · "Awaiting Saysay's confirmation" · refused. */
  statusLine: string;
};

export type PaymentHistory =
  /** The ledger read was refused. NOT "no payments" — see the header. */
  | { state: 'unreadable'; sentence: string }
  | { state: 'none'; sentence: string }
  | {
      state: 'rows';
      rows: PaymentHistoryRow[];
      paidCentavos: number;
      /** The accepted quote's total; null when no quote states one. */
      totalCentavos: number | null;
      remainingCentavos: number | null;
      /** "₱3,350 paid of ₱16,750 · ₱13,400 remaining". */
      summary: string;
    };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09-20' → 'Sep 20, 2026', with no `Date` anywhere near it. */
export function paidOnLabel(raw: string | null | undefined): string {
  const m = typeof raw === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim()) : null;
  if (!m) return 'Date not recorded';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return 'Date not recorded';
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

const centavos = (v: number | string | null): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * The history, shaped for whichever end is reading it.
 *   • `rowsOrNull` null → 'unreadable' (the read was refused).
 *   • `totalCentavos` null → the summary states what was paid and stops; it
 *     never invents a total, and never prints "₱0 remaining".
 */
export function paymentHistory(args: {
  rowsOrNull: readonly PaymentLedgerRow[] | null;
  totalCentavos: number | null;
  viewer: 'couple' | 'vendor';
  /** The OTHER party's name — the supplier for a couple, "the couple" for a supplier. */
  otherName: string;
}): PaymentHistory {
  const { rowsOrNull, viewer, otherName } = args;
  if (rowsOrNull === null) {
    return {
      state: 'unreadable',
      sentence:
        viewer === 'couple'
          ? `We couldn't load your payments to ${otherName}, so what you have already paid isn't shown. Refresh to try again.`
          : `We couldn't load this booking's payments, so what the couple has already paid isn't shown. Refresh to try again.`,
    };
  }
  if (rowsOrNull.length === 0) {
    return {
      state: 'none',
      sentence:
        viewer === 'couple'
          ? `No payments recorded yet for ${otherName}.`
          : 'The couple has recorded no payments yet.',
    };
  }

  const rows: PaymentHistoryRow[] = rowsOrNull.map((r, i) => {
    const confirmed = Boolean(r.vendor_confirmed_at);
    const refused = Boolean(r.payment_refused_at);
    const statusLine = refused
      ? viewer === 'couple'
        ? `${otherName} says it hasn't reached them`
        : "You said it hasn't reached you"
      : confirmed
        ? viewer === 'couple'
          ? `Confirmed by ${otherName}`
          : 'You confirmed it'
        : viewer === 'couple'
          ? `Awaiting ${otherName}'s confirmation`
          : 'Not confirmed yet';
    return {
      id: String(r.payment_id ?? `row-${i}`),
      paidOn: paidOnLabel(r.paid_at),
      amountCentavos: centavos(r.amount_php),
      method: typeof r.method === 'string' && r.method.trim() ? r.method.trim() : null,
      confirmed,
      refused,
      isFirstPayment: r.is_deposit_record === true,
      statusLine,
    };
  });

  const paidCentavos = rows.reduce((s, r) => s + r.amountCentavos, 0);
  const total = args.totalCentavos !== null && args.totalCentavos > 0 ? args.totalCentavos : null;
  const remaining = total === null ? null : Math.max(0, total - paidCentavos);
  const summary =
    total === null
      ? `${pesoFromCentavos(paidCentavos)} paid`
      : remaining === null || remaining === 0
        ? `${pesoFromCentavos(paidCentavos)} paid of ${pesoFromCentavos(total)} · paid in full`
        : `${pesoFromCentavos(paidCentavos)} paid of ${pesoFromCentavos(total)} · ${pesoFromCentavos(remaining)} remaining`;

  return { state: 'rows', rows, paidCentavos, totalCentavos: total, remainingCentavos: remaining, summary };
}

/** The heading both ends put above the list. One string, so they cannot drift. */
export const PAYMENT_HISTORY_HEADING = 'Payments so far';
