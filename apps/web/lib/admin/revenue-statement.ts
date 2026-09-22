/**
 * revenue-statement.ts — what Setnayan has actually earned, in one read.
 *
 * ── THE DEFECT (register M16, measured 2026-09-22) ──────────────────────────
 * `/admin/money` is **a nav landing of cards** — 63 lines, a ledger component
 * and a grid of links. There is no revenue statement, no period total, no
 * fee/receipt/refund roll-up. **The owner cannot state revenue without writing
 * SQL**, with real money already collected.
 *
 * ── THE THREE NUMBERS, AND WHY THEY ARE THREE ──────────────────────────────
 * 🔑 THEY ARE NOT INTERCHANGEABLE AND MUST NEVER BE ADDED TOGETHER.
 *
 *   · **Software** — `orders` that reached `paid`/`fulfilled`. What customers
 *     bought from Setnayan directly.
 *   · **Booking fees** — `booking_fee_charges` at `paid`. What suppliers were
 *     billed for an introduction. A *different* revenue line with a different
 *     payer, which is exactly the distinction the 0% commission ruling turns on.
 *   · **Refunds** — `order_refunds`, SUBTRACTED. Money given back is not
 *     revenue, and a statement that omits it overstates every period.
 *
 * ⚠ `receipts` is reported SEPARATELY and never summed into the total. A
 * receipt is a document issued about money, not a second receipt of it —
 * counting both would double every peso. It is here because the gap between
 * "orders paid" and "receipts issued" is the thing an accountant asks about.
 *
 * ── PURE, SO IT IS EXECUTED ────────────────────────────────────────────────
 * The page is a server component and cannot be imported by a test. The
 * arithmetic — the part that can be got wrong — lives here.
 */

export type RevenueInput = {
  /** PHP from orders that reached paid/fulfilled. */
  softwarePhp: number;
  /** PHP from booking-fee charges at `paid`. */
  bookingFeePhp: number;
  /** PHP returned, as a POSITIVE number. */
  refundedPhp: number;
  /** How many receipts have been issued, and for how much. */
  receiptCount: number;
  receiptPhp: number;
  /** Counts, so a zero total can be told from a zero-row read. */
  paidOrderCount: number;
  paidFeeCount: number;
};

export type RevenueStatement = RevenueInput & {
  /** software + booking fees − refunds. Never includes receipts. */
  netPhp: number;
  /** Gross before refunds, so the refund line has something to be a share of. */
  grossPhp: number;
  /**
   * Orders paid but not receipted. **The number an accountant asks for**, and
   * the reason `receipts` is reported beside the total rather than inside it.
   */
  unreceiptedOrderCount: number;
};

/** Round to the centavo, never to the peso. ₱837.50 must not read ₱838. */
function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function revenueStatement(input: RevenueInput): RevenueStatement {
  const gross = money(input.softwarePhp + input.bookingFeePhp);
  return {
    ...input,
    softwarePhp: money(input.softwarePhp),
    bookingFeePhp: money(input.bookingFeePhp),
    refundedPhp: money(input.refundedPhp),
    receiptPhp: money(input.receiptPhp),
    grossPhp: gross,
    netPhp: money(gross - input.refundedPhp),
    unreceiptedOrderCount: Math.max(0, input.paidOrderCount - input.receiptCount),
  };
}

/**
 * The sentence under the total.
 *
 * 🔑 IT SAYS WHAT IS **NOT** IN THE NUMBER. A total with no scope is the thing
 * that sends somebody to the database — which is the whole defect. Every
 * exclusion this statement makes is named here rather than assumed.
 */
export function revenueScopeNote(s: RevenueStatement): string {
  const parts = [
    'Software sales plus booking fees, less refunds.',
    'Receipts are shown separately and are NOT added in — a receipt is a document about money, not a second receipt of it.',
  ];
  if (s.unreceiptedOrderCount > 0) {
    parts.push(
      `${s.unreceiptedOrderCount} paid order${s.unreceiptedOrderCount === 1 ? '' : 's'} ${s.unreceiptedOrderCount === 1 ? 'has' : 'have'} no receipt issued.`,
    );
  }
  parts.push('Setnayan is not VAT-registered, so every figure is VAT-exclusive at 0%.');
  return parts.join(' ');
}
