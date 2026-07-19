import {
  EXPENSE_CATEGORIES,
  fetchExpensesOverview,
  type ExpenseCategory,
} from '@/lib/admin/platform-expenses';

import { addExpense, attachReceipt, viewReceipt } from '../actions';
import { ChartCard, DeltaPct, StackedBars } from './charts';

/**
 * Expenses & Receipts — Zone 2 of the App Performance cockpit (PR 3;
 * plan § 3 Zone 2). Every digital peso OUT with the receipt to prove it —
 * the BIR expense-substantiation trail (iteration 0026).
 *
 * Server-rendered; the log/attach forms post to server actions (no client
 * JS). Money is PESOS. If the migration hasn't run on this environment the
 * fetcher degrades and the zone says so honestly.
 */

const nf = new Intl.NumberFormat('en-PH');
const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  infra: 'var(--m-slate-3)',
  ai_credits: 'var(--m-orange)',
  domains_fees: 'var(--m-mulberry-3)',
  tools: 'var(--m-slate-4)',
  permits_docs: 'var(--m-sage-deep)',
};

function categoryLabel(key: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export async function ExpensesZone() {
  const ov = await fetchExpensesOverview();
  const coveragePct =
    ov.receiptCoverage.total > 0
      ? Math.round((ov.receiptCoverage.withReceipt / ov.receiptCoverage.total) * 100)
      : null;

  return (
    <section className="mb-12" aria-labelledby="apx-expenses">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="apx-expenses" className="text-base font-semibold text-ink">
          Expenses &amp; Receipts
        </h2>
        <p className="text-xs text-ink/55">
          Every digital peso out, with the receipt to prove it — feeds BIR expense
          substantiation (iteration 0026).
        </p>
      </header>

      {ov.error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Expense ledger unavailable: {ov.error} (has the platform_expenses
          migration run on this environment?)
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* E1 — monthly spend, stacked by category */}
        <ChartCard
          title="Monthly digital spend"
          pill="live"
          source="platform_expenses · pesos · trailing 6 months"
          className="lg:col-span-2"
        >
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <p
              className="text-2xl font-semibold tabular-nums"
              data-countup=""
              style={{ color: 'var(--m-ink)' }}
            >
              {php.format(ov.totalThisMonth)}
            </p>
            <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
              this month
            </span>
            <DeltaPct current={ov.totalThisMonth} previous={ov.totalPrevMonth} inverseGood />
          </div>
          {ov.months.every((m) => m.total === 0) ? (
            <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              No expenses logged yet — use “Log an expense” below to start the
              ledger.
            </p>
          ) : (
            <>
              <StackedBars
                series={EXPENSE_CATEGORIES.map((c) => ({
                  label: c.label,
                  color: CATEGORY_COLORS[c.key],
                  values: ov.months.map((m) => m.byCategory[c.key]),
                }))}
                ariaLabel={`Monthly spend by category. ${ov.months
                  .map((m) => `${m.month}: ${php.format(m.total)}`)
                  .join('; ')}.`}
                formatTitle={(label, v) => `${label}: ${php.format(v)}`}
              />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {EXPENSE_CATEGORIES.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--m-slate)' }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CATEGORY_COLORS[c.key] }}
                    />
                    {c.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>

        {/* E3 — receipt coverage */}
        <ChartCard
          title="Receipt coverage"
          pill="live"
          source="receipt attached ÷ expenses · 6-month window"
        >
          {coveragePct === null ? (
            <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              No expenses logged yet — coverage appears with the first row.
            </p>
          ) : (
            <>
              <p
                className="text-3xl font-semibold tabular-nums"
                data-countup=""
                style={{
                  color: coveragePct >= 90 ? 'var(--m-sage-deep)' : 'var(--m-ink)',
                }}
              >
                {coveragePct}%
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
                {nf.format(ov.receiptCoverage.withReceipt)} of{' '}
                {nf.format(ov.receiptCoverage.total)} expenses have a receipt
              </p>
              {ov.receiptCoverage.missing.length > 0 ? (
                <p className="mt-2 text-xs font-medium" style={{ color: 'var(--m-blush-deep)' }}>
                  {nf.format(ov.receiptCoverage.total - ov.receiptCoverage.withReceipt)}{' '}
                  missing — collect before the BIR quarter closes:{' '}
                  {ov.receiptCoverage.missing
                    .slice(0, 4)
                    .map((r) => r.vendor_name)
                    .join(' · ')}
                </p>
              ) : null}
            </>
          )}
        </ChartCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* E2 — spend by vendor, current month */}
        <ChartCard
          title="Spend by service — this month"
          pill="live"
          source="platform_expenses grouped by vendor"
        >
          {ov.byVendorThisMonth.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              Nothing logged this month yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {ov.byVendorThisMonth.slice(0, 8).map((v) => {
                const max = ov.byVendorThisMonth[0]?.php ?? 1;
                return (
                  <li key={v.vendor} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span style={{ color: 'var(--m-ink)' }}>{v.vendor}</span>
                      <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
                        {php.format(v.php)}
                      </span>
                    </div>
                    <span
                      aria-hidden
                      className="apx-lb block h-2 rounded-full"
                      style={{
                        width: `${Math.max(2, (v.php / Math.max(1, max)) * 100)}%`,
                        background: 'var(--m-orange)',
                        opacity: 0.55,
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        {/* E5 — upcoming charges */}
        <ChartCard
          title="Upcoming charges"
          pill="live"
          source="next_due_on — renewals surface before they hit"
        >
          {ov.upcoming.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              No dated renewals logged. Give annual lines (domains · permits ·
              app-store fees) a next-due date so January never surprises you.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ov.upcoming.map((r) => (
                <li
                  key={r.expense_id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span style={{ color: 'var(--m-ink)' }}>
                    <span
                      className="mr-2 rounded-full px-1.5 py-0.5 font-mono text-[10px]"
                      style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate-2)' }}
                    >
                      {r.next_due_on}
                    </span>
                    {r.vendor_name}
                  </span>
                  <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
                    {php.format(r.amount_php)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        {/* Log an expense — server-action form, no client JS */}
        <ChartCard title="Log an expense" pill="live" source="writes platform_expenses · receipt optional">
          <form action={addExpense} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                name="expensed_on"
                required
                aria-label="Expense date"
                className="input-field h-9 py-0 text-sm"
              />
              <select
                name="category"
                required
                aria-label="Category"
                className="input-field h-9 py-0 text-sm"
                defaultValue="infra"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              name="vendor_name"
              required
              placeholder="Vendor (Suno · Vercel · IPOPHL …)"
              aria-label="Vendor"
              className="input-field h-9 w-full py-0 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="amount_php"
                min="0"
                step="0.01"
                required
                placeholder="Amount ₱"
                aria-label="Amount in pesos"
                className="input-field h-9 py-0 text-sm"
              />
              <input
                type="date"
                name="next_due_on"
                aria-label="Next due date (optional)"
                className="input-field h-9 py-0 text-sm"
              />
            </div>
            <input
              type="file"
              name="receipt"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              aria-label="Receipt file (optional)"
              className="block w-full text-xs"
              style={{ color: 'var(--m-slate)' }}
            />
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--m-slate)' }}>
              <input type="checkbox" name="recurs_monthly" /> recurs monthly
            </label>
            <button type="submit" className="button-secondary h-9 px-3 text-xs">
              Log expense
            </button>
          </form>
        </ChartCard>
      </div>

      {/* E4 — the ledger */}
      <ChartCard
        title="Expense ledger"
        pill="live"
        source="latest rows · attach the receipt on every line"
      >
        {ov.ledger.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            The ledger starts with your first logged expense.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Expense ledger">
              <thead>
                <tr
                  className="text-left font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: 'var(--m-slate-2)' }}
                >
                  <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Vendor</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Category</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">Amount</th>
                  <th scope="col" className="py-1.5 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {ov.ledger.map((r) => (
                  <tr key={r.expense_id} style={{ borderTop: '1px solid var(--m-line-soft)' }}>
                    <td className="py-2 pr-3 tabular-nums" style={{ color: 'var(--m-slate)' }}>
                      {r.expensed_on}
                    </td>
                    <td className="py-2 pr-3" style={{ color: 'var(--m-ink)' }}>
                      {r.vendor_name}
                    </td>
                    <td className="py-2 pr-3" style={{ color: 'var(--m-slate)' }}>
                      {categoryLabel(r.category)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--m-ink)' }}>
                      {php.format(r.amount_php)}
                    </td>
                    <td className="py-2">
                      {r.receipt_r2_key ? (
                        <form action={viewReceipt} className="inline">
                          <input type="hidden" name="expense_id" value={r.expense_id} />
                          <button
                            type="submit"
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: 'var(--m-sage)', color: '#2E4A2A' }}
                          >
                            View receipt
                          </button>
                        </form>
                      ) : (
                        <form action={attachReceipt} className="inline-flex items-center gap-1.5">
                          <input type="hidden" name="expense_id" value={r.expense_id} />
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: 'var(--m-blush)', color: '#A0502F' }}
                          >
                            Missing
                          </span>
                          <input
                            type="file"
                            name="receipt"
                            required
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            aria-label={`Receipt for ${r.vendor_name}`}
                            className="w-32 text-[11px]"
                            style={{ color: 'var(--m-slate)' }}
                          />
                          <button type="submit" className="button-secondary h-7 px-2 text-[11px]">
                            Attach
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </section>
  );
}
