import { ReceiptText } from 'lucide-react';

import {
  EXPENSE_CATEGORIES,
  LEDGER_ROWS,
  fetchExpensesOverview,
  type ExpenseCategory,
} from '@/lib/admin/platform-expenses';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { Fold } from '@/app/_components/fold';
import { FormRows } from '@/app/_components/form-row';
import { CardPick, CardToggle } from '@/app/dashboard/[eventId]/guests/_components/guest-card-rows';

import { addExpense, attachReceipt, viewReceipt } from '../actions';
import { DeltaPct, StackedBars } from './charts';
import { Note, Row, Rows, Sec } from './insights-parts';

/**
 * Expenses & Receipts — Zone 2 of the App Performance cockpit (PR 3;
 * plan § 3 Zone 2). Every digital peso OUT with the receipt to prove it —
 * the BIR expense-substantiation trail (iteration 0026).
 *
 * Server-rendered; the log/attach forms post to server actions (no client JS).
 * Money is PESOS.
 *
 * ── Converted to <ConsoleTable> 2026-08-17 · ZERO IS THE LIE HERE ──────────
 * The fetcher already reported its error honestly in a banner at the top of
 * the zone. Underneath that banner every panel then carried on and printed the
 * placeholder numbers anyway: ₱0 spent this month, a 0% delta against last
 * month, "Nothing logged this month yet", "No dated renewals logged", and a
 * ledger saying it was waiting for your first expense. On a MONEY screen a
 * printed zero is not a smaller mistake than a wrong number — read past the
 * banner and the business looks like it stopped spending.
 *
 * So each panel now asks whether the read completed before it prints a figure,
 * and shows an em-dash where the figure would be. `ov.ledger` is NULL on a
 * refused read and the table reports it.
 *
 * (Measured in production 2026-08-17: `platform_expenses` holds 0 rows, so the
 * honest empty state is what actually renders today — which is exactly why the
 * two states had to stop looking alike.)
 *
 * ── Re-drawn onto the approved drawing 2026-11-14 (insights.html › Costs › Expenses & receipts) ──
 * No cards around read-only figures (T18): section heads with their ⓘ, hairline rows, one meter. "Log an expense" is
 * the one thing framed — a row that opens in place, holding the same form posting to the same `addExpense`; its
 * Category is the house dropdown (never a native select) and "recurs monthly" the house switch, both posting the
 * same field names. Exported API unchanged: `ExpensesZone()`, no props — the Overview cockpit draws it as before.
 */

/** Shown where a figure would be when the read did not complete. */
const UNMEASURED = '—';

const nf = new Intl.NumberFormat('en-PH');
const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/** The drawing's three series colours: infra in the accent, AI credits in blue-grey, the rest in the hairline grey. */
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  infra: 'var(--sn-accent)',
  ai_credits: 'var(--sn-info)',
  domains_fees: 'var(--sn-line)',
  tools: 'var(--sn-line)',
  permits_docs: 'var(--sn-line)',
};

/** The legend groups the three grey categories into one entry, as the drawing does. */
const LEGEND: { label: string; color: string }[] = [
  { label: 'Infra', color: CATEGORY_COLORS.infra },
  { label: 'AI credits', color: CATEGORY_COLORS.ai_credits },
  {
    label: EXPENSE_CATEGORIES.filter((c) => CATEGORY_COLORS[c.key] === 'var(--sn-line)')
      .map((c) => c.label)
      .join(' · '),
    color: 'var(--sn-line)',
  },
];

/** A native field, 44 px, on a hairline row — the date, text, amount and file inputs `addExpense` reads. */
const FIELD = 'input-field min-h-11 w-full text-[15px]';

function categoryLabel(key: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export async function ExpensesZone() {
  const ov = await fetchExpensesOverview();
  // One question, asked once: did the read complete? Every figure below is
  // gated on it, because the placeholder for "we do not know" is an em-dash,
  // never a zero.
  const measured = ov.error === null;
  const coveragePct =
    measured && ov.receiptCoverage.total > 0
      ? Math.round((ov.receiptCoverage.withReceipt / ov.receiptCoverage.total) * 100)
      : null;

  return (
    <section className="mb-12 max-w-3xl" aria-labelledby="apx-expenses">
      <Sec
        id="apx-expenses"
        title="Expenses & Receipts"
        about="Every digital peso out, with the receipt to prove it — feeds BIR expense substantiation."
      />

      {ov.error ? (
        <p role="alert" className="mb-2 rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
          We couldn&rsquo;t load the expense ledger just now. Nothing is lost &mdash; the reason is in the logs.
        </p>
      ) : null}

      {/* Log an expense — the one framed thing here (you press it). Same server-action form, no new action. */}
      <div className="my-2 rounded-xl border border-ink/15" data-expenses-log="">
        <Fold title="Log an expense" summary="Saved to the expense ledger · receipt optional" data="log-expense" popovers>
          <form action={addExpense} className="space-y-2 px-3 pb-3">
            <label className="block text-[13px] text-ink/65">
              Expense date
              <input type="date" name="expensed_on" required aria-label="Expense date" className={FIELD} />
            </label>
            <FormRows>
              <CardPick
                name="category"
                label="Category"
                value="infra"
                options={EXPENSE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
              />
            </FormRows>
            <label className="block text-[13px] text-ink/65">
              Supplier
              <input
                type="text"
                name="vendor_name"
                required
                placeholder="Supplier (Suno · Vercel · IPOPHL …)"
                aria-label="Supplier"
                className={FIELD}
              />
            </label>
            <label className="block text-[13px] text-ink/65">
              Amount ₱
              <input
                type="number"
                name="amount_php"
                min="0"
                step="0.01"
                required
                placeholder="Amount ₱"
                aria-label="Amount in pesos"
                className={FIELD}
              />
            </label>
            <label className="block text-[13px] text-ink/65">
              Next due date · optional
              <input type="date" name="next_due_on" aria-label="Next due date (optional)" className={FIELD} />
            </label>
            <label className="block text-[13px] text-ink/65">
              Receipt file · optional
              <input
                type="file"
                name="receipt"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                aria-label="Receipt file (optional)"
                className="block min-h-11 w-full py-2 text-[13px] text-ink/70"
              />
            </label>
            <FormRows>
              <CardToggle
                name="recurs_monthly"
                label="recurs monthly"
                defaultChecked={false}
                note="Repeats this expense every month."
              />
            </FormRows>
            <button type="submit" className="button-primary min-h-11 w-full">
              Log expense
            </button>
          </form>
        </Fold>
      </div>

      {/* E1 — monthly spend, stacked by category */}
      <section aria-labelledby="apx-exp-spend">
        <Sec
          id="apx-exp-spend"
          title="Monthly digital spend"
          about="Live · expenses in pesos, last 6 months, stacked by category. A month that was not read is not charted — that is not a month of zero spending."
          right={
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-[15px] font-semibold tabular-nums text-ink" data-countup="">
                {measured ? php.format(ov.totalThisMonth) : UNMEASURED}
              </span>
              <span className="text-[12px] text-ink/55">this month</span>
              {/* A delta against an unread month is a comparison of two numbers
                  we do not have — it read "0%", which looks like "flat". */}
              {measured ? (
                <DeltaPct current={ov.totalThisMonth} previous={ov.totalPrevMonth} inverseGood />
              ) : null}
            </span>
          }
        />
        {!measured ? (
          <p className="text-[13px] text-ink/60">
            The spend for these months was not read, so nothing is charted
            here — this is not a month of zero spending.
          </p>
        ) : ov.months.every((m) => m.total === 0) ? (
          <p className="text-[13px] text-ink/60">
            No expenses logged yet — use “Log an expense” above to start the
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
            <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink/65">
              {LEGEND.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                  {c.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* E3 — receipt coverage */}
      <section aria-labelledby="apx-exp-coverage">
        <Sec
          id="apx-exp-coverage"
          title="Receipt coverage"
          about="Live · receipt attached ÷ expenses, over the 6-month window."
          right={
            coveragePct === null ? undefined : (
              <span
                className={`text-[15px] font-semibold tabular-nums ${coveragePct >= 90 ? 'text-[var(--sn-success-deep)]' : 'text-ink'}`}
                data-countup=""
              >
                {coveragePct}%
              </span>
            )
          }
        />
        {!measured ? (
          <p className="text-[13px] text-ink/60">
            Coverage could not be worked out — the expenses it divides were
            not read. That is not the same as zero.
          </p>
        ) : coveragePct === null ? (
          <p className="text-[13px] text-ink/60">No expenses logged yet — coverage appears with the first row.</p>
        ) : (
          <>
            <div aria-hidden className="my-2 h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
              <span className="block h-full rounded-full bg-[var(--sn-accent)]" style={{ width: `${coveragePct}%` }} />
            </div>
            <p className="text-[13px] text-ink/70">
              {nf.format(ov.receiptCoverage.withReceipt)} of{' '}
              {nf.format(ov.receiptCoverage.total)} expenses have a receipt
            </p>
            {ov.receiptCoverage.missing.length > 0 ? (
              <p className="mt-1 text-[13px] font-medium text-[var(--sn-warning-deep)]">
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
      </section>

      {/* E2 — spend by supplier, current month */}
      <section aria-labelledby="apx-exp-by-service">
        <Sec id="apx-exp-by-service" title="Spend by service · this month" about="Live · expenses by supplier." />
        {!measured ? (
          <p className="text-[13px] text-ink/60">This month&rsquo;s spend was not read.</p>
        ) : ov.byVendorThisMonth.length === 0 ? (
          <p className="text-[13px] text-ink/60">Nothing logged this month yet.</p>
        ) : (
          <Rows label="Spend by service this month" data="expenses-by-service">
            {ov.byVendorThisMonth.slice(0, 8).map((v) => (
              <Row key={v.vendor} title={v.vendor} trail={php.format(v.php)} />
            ))}
          </Rows>
        )}
      </section>

      {/* E5 — upcoming charges */}
      <section aria-labelledby="apx-exp-upcoming">
        <Sec
          id="apx-exp-upcoming"
          title="Upcoming charges"
          about="Live · next due dates — renewals show before they hit."
          count={measured ? ov.upcoming.length : null}
        />
        {!measured ? (
          <p className="text-[13px] text-ink/60">
            Renewals were not read. Do not take this as a clear month — a
            charge due next week would look exactly like this.
          </p>
        ) : ov.upcoming.length === 0 ? (
          <p className="text-[13px] text-ink/60">
            No dated renewals logged. Give annual lines (domains · permits ·
            app-store fees) a next-due date so January never surprises you.
          </p>
        ) : (
          <Rows label="Upcoming charges" data="expenses-upcoming">
            {ov.upcoming.map((r) => (
              <Row
                key={r.expense_id}
                title={r.vendor_name}
                sub={`${r.next_due_on} · ${categoryLabel(r.category)}`}
                trail={php.format(r.amount_php)}
              />
            ))}
          </Rows>
        )}
      </section>

      {/* E4 — the ledger */}
      <section aria-labelledby="apx-exp-ledger">
        <Sec
          id="apx-exp-ledger"
          title="Expense ledger"
          about="Live · the latest rows. Attach the receipt on every line."
        />
        {/* The per-row receipt controls live INSIDE their own cell, which is the
            only way the archetype offers a button: this row genuinely settles
            on one press, and the server action refuses to run without the file
            it is attaching. Nothing bulk, nothing one-click across rows. */}
        <ConsoleTable
          rows={ov.ledger}
          readPermitted
          readError={ov.error ? { message: ov.error } : null}
          reads="the expense ledger"
          cap={LEDGER_ROWS}
          label="Expense ledger"
          minWidth="20rem"
          rowKey={(r) => r.expense_id}
          empty={{
            Icon: ReceiptText,
            title: 'The ledger starts with your first logged expense',
            blurb:
              'Use “Log an expense” above to start it. Every line you add here with its receipt attached is a line the BIR expense-substantiation trail can stand on.',
          }}
          columns={[
            {
              header: 'Date',
              mono: true,
              cell: (r) => <span className="text-ink/70">{r.expensed_on}</span>,
            },
            {
              header: 'Supplier',
              cell: (r) => <span className="font-medium text-ink">{r.vendor_name}</span>,
            },
            {
              header: 'Category',
              hideBelow: 'md',
              cell: (r) => <span className="text-ink/70">{categoryLabel(r.category)}</span>,
            },
            {
              header: 'Amount',
              align: 'right',
              mono: true,
              cell: (r) => <span className="text-ink">{php.format(r.amount_php)}</span>,
            },
            {
              header: 'Receipt',
              cell: (r) =>
                r.receipt_r2_key ? (
                  <form action={viewReceipt} className="inline">
                    <input type="hidden" name="expense_id" value={r.expense_id} />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full bg-[var(--sn-success-soft)] px-3 text-[13px] font-semibold text-[var(--sn-success-deep)]"
                    >
                      View receipt
                    </button>
                  </form>
                ) : (
                  <form action={attachReceipt} className="inline-flex flex-wrap items-center gap-1.5">
                    <input type="hidden" name="expense_id" value={r.expense_id} />
                    <span className="inline-flex min-h-6 items-center rounded-full bg-[var(--sn-warning-soft)] px-2 text-[12px] font-semibold text-[var(--sn-warning-deep)]">
                      Missing
                    </span>
                    <input
                      type="file"
                      name="receipt"
                      required
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      aria-label={`Receipt for ${r.vendor_name}`}
                      className="w-32 text-[12px] text-ink/70"
                    />
                    <button type="submit" className="button-secondary min-h-11 px-3 text-[13px]">
                      Attach
                    </button>
                  </form>
                ),
            },
          ]}
        />
      </section>

      <Note label="Receipts">
        PDF, JPG, PNG or WebP, up to 10 MB, kept in a private bucket; only admins open one, through a 10-minute signed link. Every line with
        its receipt attached is a line the BIR expense-substantiation trail can stand on.
      </Note>
    </section>
  );
}
