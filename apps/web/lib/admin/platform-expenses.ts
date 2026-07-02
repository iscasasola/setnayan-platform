import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Expenses & Receipts — fetcher for Zone 2 of the App Performance cockpit
 * (plan § 3 Zone 2 · migration 20270504100000_platform_expenses.sql).
 *
 * One bounded read over the trailing 6 calendar months + every future-dated
 * next_due_on, grouped in JS (soft-launch ledger volume is tiny). Money is
 * PESOS. Receipt coverage = rows with receipt_r2_key ÷ all rows — the BIR
 * substantiation number (iteration 0026).
 */

export const EXPENSE_CATEGORIES = [
  { key: 'infra', label: 'Infra' },
  { key: 'ai_credits', label: 'AI credits' },
  { key: 'domains_fees', label: 'Domains & fees' },
  { key: 'tools', label: 'Tools' },
  { key: 'permits_docs', label: 'Permits & docs' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['key'];

export type ExpenseRow = {
  expense_id: string;
  expensed_on: string;
  vendor_name: string;
  category: ExpenseCategory;
  amount_php: number;
  note: string | null;
  receipt_r2_key: string | null;
  recurs_monthly: boolean;
  next_due_on: string | null;
};

export type MonthBucket = {
  /** 'YYYY-MM' */
  month: string;
  byCategory: Record<ExpenseCategory, number>;
  total: number;
};

export type ExpensesOverview = {
  months: MonthBucket[];
  /** Current calendar month, by vendor, descending peso. */
  byVendorThisMonth: { vendor: string; php: number }[];
  receiptCoverage: { withReceipt: number; total: number; missing: ExpenseRow[] };
  /** Known future charges: explicit next_due_on rows, soonest first. */
  upcoming: ExpenseRow[];
  /** Recent ledger rows, newest first (capped for the table). */
  ledger: ExpenseRow[];
  totalThisMonth: number;
  totalPrevMonth: number;
  error: string | null;
};

const ROW_CAP = 4000;
const LEDGER_ROWS = 12;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function emptyByCategory(): Record<ExpenseCategory, number> {
  return {
    infra: 0,
    ai_credits: 0,
    domains_fees: 0,
    tools: 0,
    permits_docs: 0,
  };
}

/** The trailing `n` month keys ending at the current month, oldest first. */
function trailingMonths(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export async function fetchExpensesOverview(): Promise<ExpensesOverview> {
  const empty: ExpensesOverview = {
    months: [],
    byVendorThisMonth: [],
    receiptCoverage: { withReceipt: 0, total: 0, missing: [] },
    upcoming: [],
    ledger: [],
    totalThisMonth: 0,
    totalPrevMonth: 0,
    error: null,
  };
  try {
    const admin = createAdminClient();
    const now = new Date();
    const monthKeys = trailingMonths(now, 6);
    const since = `${monthKeys[0] ?? now.toISOString().slice(0, 7)}-01`;

    // One read: everything in the 6-month window OR carrying a future due date
    // (an annual renewal logged last year must still surface in Upcoming).
    const { data, error } = await admin
      .from('platform_expenses')
      .select(
        'expense_id, expensed_on, vendor_name, category, amount_php, note, receipt_r2_key, recurs_monthly, next_due_on',
      )
      .or(`expensed_on.gte.${since},next_due_on.gte.${now.toISOString().slice(0, 10)}`)
      .order('expensed_on', { ascending: false })
      .limit(ROW_CAP);
    if (error) throw new Error(error.message);

    const rows: ExpenseRow[] = (data ?? []).map((r) => ({
      expense_id: String(r.expense_id),
      expensed_on: String(r.expensed_on),
      vendor_name: String(r.vendor_name),
      category: (r.category ?? 'tools') as ExpenseCategory,
      amount_php: Number(r.amount_php ?? 0),
      note: r.note ?? null,
      receipt_r2_key: r.receipt_r2_key ?? null,
      recurs_monthly: Boolean(r.recurs_monthly),
      next_due_on: r.next_due_on ?? null,
    }));

    const byMonth = new Map<string, MonthBucket>(
      monthKeys.map((m) => [m, { month: m, byCategory: emptyByCategory(), total: 0 }]),
    );
    const byVendor = new Map<string, number>();
    const thisMonth = monthKey(now.toISOString());
    const prevMonth = monthKeys[monthKeys.length - 2] ?? '';
    const inWindow = rows.filter((r) => r.expensed_on >= since);

    for (const r of inWindow) {
      const bucket = byMonth.get(monthKey(r.expensed_on));
      if (bucket) {
        bucket.byCategory[r.category] += r.amount_php;
        bucket.total += r.amount_php;
      }
      if (monthKey(r.expensed_on) === thisMonth) {
        byVendor.set(r.vendor_name, (byVendor.get(r.vendor_name) ?? 0) + r.amount_php);
      }
    }

    const withReceipt = inWindow.filter((r) => r.receipt_r2_key !== null).length;
    const todayIso = now.toISOString().slice(0, 10);

    return {
      months: monthKeys.map(
        (m) => byMonth.get(m) ?? { month: m, byCategory: emptyByCategory(), total: 0 },
      ),
      byVendorThisMonth: [...byVendor.entries()]
        .map(([vendor, php]) => ({ vendor, php }))
        .sort((a, b) => b.php - a.php),
      receiptCoverage: {
        withReceipt,
        total: inWindow.length,
        missing: inWindow.filter((r) => r.receipt_r2_key === null).slice(0, 8),
      },
      upcoming: rows
        .filter((r) => r.next_due_on !== null && r.next_due_on >= todayIso)
        .sort((a, b) => (a.next_due_on ?? '').localeCompare(b.next_due_on ?? ''))
        .slice(0, 10),
      ledger: inWindow.slice(0, LEDGER_ROWS),
      totalThisMonth: byMonth.get(thisMonth)?.total ?? 0,
      totalPrevMonth: byMonth.get(prevMonth)?.total ?? 0,
      error: null,
    };
  } catch (e) {
    // The table may not exist yet on an environment that hasn't run the
    // migration — degrade to the honest empty state, never blank the page.
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}
