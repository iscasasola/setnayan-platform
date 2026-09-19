/**
 * paid-to-vendor.ts — ONE answer to "how much has the couple handed this
 * supplier?" and "how much was the deposit?". The AMOUNT half of the deposit
 * fact; `lib/booking-money-moved.ts` is the YES/NO half (has money moved at
 * all). Every reader of `event_vendors.deposit_paid_php` goes through one of
 * the two — `lib/deposit-fact-has-one-reader.test.ts` fails the build if a new
 * one does not.
 *
 * WHY (DEPOSIT-TRUTH, 2026-09-19): the couple's own "Record deposit"
 * (`recordDeposit`) writes the amount to the payment log
 * (`event_vendor_payments` — the database stamps that row
 * `is_deposit_record = true` at insert) and stamps `deposit_recorded_at` — it NEVER writes
 * `deposit_paid_php`. Screens that read the column showed no deposit on a
 * recorded, supplier-confirmed ₱2,000 (rosa-ben · Saysay, prod): the workspace
 * costing row ("Deposit paid —", fixed by #5670) and Setnayan's own deposit
 * dispute queue ("Couple recorded —"), the one screen whose whole job is to
 * judge that deposit.
 *
 * WHY THE LOG, AND NOT "ALSO WRITE THE COLUMN" — fewer moving parts:
 *   · the log already carries EVERY deposit ever recorded (measured on prod
 *     2026-09-19: all 3 rows with `deposit_paid_php > 0` have a log row of
 *     exactly the same amount; the 1 recorded deposit has its log row and a
 *     NULL column). No backfill, no migration.
 *   · writing the column too would be two copies of one number, one of which a
 *     couple can still edit on its own (the vendors-list form writes
 *     `deposit_paid_php`), and `computeEventMoney` already says which wins:
 *     "the itemized log WINS whenever it exists; the legacy field is a
 *     fallback, never additive" — R6 measured that a backfill the other way
 *     DOUBLE-COUNTS. This file is that sentence, lifted out of
 *     `lib/budget-truth.ts` so the other readers stop re-deriving it.
 *
 * Pure and dependency-free so a test can EXECUTE it.
 */

export type LoggedPayment = {
  amount_php: number | string | null | undefined;
  /**
   * WHICH ledger row is the deposit — stamped once, at INSERT, by the database
   * (`stamp_event_vendor_payment_deposit_record`, migration 20271222394035).
   * Read it; never re-derive it from the notes string.
   */
  is_deposit_record?: boolean | null;
};

const centavosOf = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * Money handed to one supplier, in integer centavos. The log wins whenever it
 * has any row; the legacy `deposit_paid_php` counts only for a booking with no
 * logged payment at all. Never the sum of the two.
 */
export function paidToVendorCentavos(
  payments: readonly LoggedPayment[],
  legacyDepositPhp: number | string | null | undefined,
): number {
  if (payments.length > 0) {
    return payments.reduce((acc, p) => acc + centavosOf(p.amount_php), 0);
  }
  return Math.max(0, centavosOf(legacyDepositPhp));
}

/** `paidToVendorCentavos` in pesos. */
export function paidToVendorPhp(
  payments: readonly LoggedPayment[],
  legacyDepositPhp: number | string | null | undefined,
): number {
  return paidToVendorCentavos(payments, legacyDepositPhp) / 100;
}

/**
 * The deposit on one booking, in pesos, or `null` when none is on file.
 *
 * The deposit is the ledger row the database stamped `is_deposit_record`. With
 * no such row, the legacy `deposit_paid_php` is the couple's typed figure. Never
 * zero-as-a-deposit: `null` means "none on file", so a screen can say so.
 */
export function recordedDepositPhp(
  payments: readonly LoggedPayment[],
  legacyDepositPhp: number | string | null | undefined,
): number | null {
  const depositRows = payments.filter((p) => p.is_deposit_record === true);
  if (depositRows.length > 0) {
    return depositRows.reduce((acc, p) => acc + centavosOf(p.amount_php), 0) / 100;
  }
  const legacy = centavosOf(legacyDepositPhp);
  return legacy > 0 ? legacy / 100 : null;
}
