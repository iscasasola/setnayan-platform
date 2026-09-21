import {
  computeMonthlySubtotals,
  type MonthlySubtotal,
  type VendorEarningRow,
} from '@/lib/vendor-earnings';

/**
 * WHAT THE EARNINGS PAGE IS ALLOWED TO SAY ABOUT MONEY IT DID NOT READ.
 *
 * `fetchVendorLedgerEarnings` throws rather than return `[]` on a refused or
 * short read — correct, and half a mechanism. The Earnings page awaited it with
 * no catch, so a refusal took the WHOLE route to `vendor-dashboard/error.tsx`:
 * the supplier lost the payouts section that already degrades honestly, the
 * booking-fee bills that say what they owe, and the verification chip. And the
 * day somebody "fixes" that crash the obvious way — `.catch(() => [])` — the
 * page reads **₱0 year-to-date · 0 payments confirmed · "No confirmed payments
 * yet."** to a supplier who was paid, which is the defect this whole file
 * exists to make unreachable: a failure that renders identically to emptiness.
 *
 * ⚠ THIS MODULE IS PURE ON PURPOSE. The page is a server component; a guard
 * can only grep it. So the decision that can be got wrong lives here, where a
 * test EXECUTES it: unread money is `null`, never `0`, and the ledger's state
 * is `'unreadable'`, never `'empty'`. `formatPhp(null)` is an em-dash, so the
 * null reaches the pixels.
 */

/** The outcome of asking for this shop's ledger — read, or not read. */
export type EarningsRead =
  | { ok: true; rows: VendorEarningRow[] }
  | { ok: false; error: string };

/**
 * What the ledger list renders. `'unreadable'` and `'empty'` are DIFFERENT
 * sentences: one says the read failed, the other says this shop has not been
 * paid yet. Collapsing them is the bug.
 */
export type EarningsLedgerState = 'unreadable' | 'empty' | 'rows';

export type EarningsView = {
  /** FALSE when the ledger read was refused or stopped short. */
  measured: boolean;
  /** Why it was not measured — logged by the caller, never shown raw. */
  error: string | null;
  /** Year-to-date pesos. `null` = not measured. NEVER 0 for an unread ledger. */
  ytdPhp: number | null;
  /** This calendar month's pesos. `null` = not measured. */
  thisMonthPhp: number | null;
  /** Payments behind `thisMonthPhp`. `null` = not measured. */
  thisMonthCount: number | null;
  /** Confirmed payments behind `ytdPhp`. `null` = not measured. */
  paymentCount: number | null;
  /** The last 12 months. Empty when unmeasured — the page says why instead. */
  months: MonthlySubtotal[];
  /** The rows to page through. Empty when unmeasured. */
  rows: VendorEarningRow[];
  ledger: EarningsLedgerState;
};

/**
 * Ask for the ledger without letting a refusal take the page down. The throw is
 * turned into `{ ok: false }` — a value the renderer must handle — and never
 * into `[]`, which no renderer can tell from "this shop has not been paid".
 */
export async function readVendorEarnings(
  load: () => Promise<VendorEarningRow[]>,
): Promise<EarningsRead> {
  try {
    return { ok: true, rows: await load() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The ledger read → every figure the Earnings page prints. An unread ledger
 * yields nulls and `'unreadable'`; it can never yield a zero.
 */
export function earningsView(read: EarningsRead, now: Date = new Date()): EarningsView {
  if (!read.ok) {
    return {
      measured: false,
      error: read.error,
      ytdPhp: null,
      thisMonthPhp: null,
      thisMonthCount: null,
      paymentCount: null,
      months: [],
      rows: [],
      ledger: 'unreadable',
    };
  }
  const { ytdTotal, months } = computeMonthlySubtotals(read.rows, now);
  const current = months[months.length - 1];
  return {
    measured: true,
    error: null,
    ytdPhp: ytdTotal,
    thisMonthPhp: current?.total_php ?? 0,
    thisMonthCount: current?.order_count ?? 0,
    paymentCount: read.rows.length,
    months,
    rows: read.rows,
    ledger: read.rows.length === 0 ? 'empty' : 'rows',
  };
}
