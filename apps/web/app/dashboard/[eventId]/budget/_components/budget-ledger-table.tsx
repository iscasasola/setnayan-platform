import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { formatPhp } from '@/lib/budget';
import {
  BUDGET_LEDGER_COLUMNS,
  BUDGET_LEDGER_COLUMN_HINTS,
  daysUntilDueLabel,
  type BudgetLedger,
  type BudgetLedgerRow,
  type LedgerDueTier,
} from '@/lib/budget-ledger';

/**
 * The plan and the ledger, one row per category (BA3).
 *
 * Four columns, owner-locked, spelled ONCE in `BUDGET_LEDGER_COLUMNS` and read
 * from there — Planned · Agreed · Paid · Owed. The bar under each row shows
 * paid inside owed inside agreed, with a mark at the plan and the overage
 * drawn past it, so "we signed for more than we budgeted" is a shape before it
 * is a number.
 *
 * Server component: the absorption plan opens in a native `<details>`, so it is
 * behind a tap without shipping a byte of JavaScript or a second copy of the
 * money in a client payload.
 *
 * ⚠ NO ESTIMATES (BA2, owner-locked). `BudgetLedgerRow.estimatedPhp` exists and
 * is deliberately NOT rendered here: quotes and shortlists live in the Merkado.
 *
 * ── What is due, and when (BA6) ──────────────────────────────────────────────
 * A roll-up under this section's own header — never the top-line meter, which
 * BA4 owns — says what is overdue and what falls in the next 30 days across
 * every row. Each row then carries its own most-urgent unpaid milestone as a
 * chip: a supplier, an amount, and the days spelled out ("5 days overdue",
 * "due in 6 days") rather than a bare date. Both read `row.nextDue` /
 * `ledger.totals`, which are themselves built from `MoneyLine.dueState` and
 * `MoneyBucket.due` (BA5) — this file never compares a day count itself.
 */

/** Comma-list with an Oxford "and" — mirrors the planner's `joinLabels`. */
function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function BudgetLedgerTable({ ledger }: { ledger: BudgetLedger }) {
  const { rows, totals, absorption, unplannedWithMoney } = ledger;
  if (rows.length === 0) return null;

  // A plain loop, not `rows.map(...)`: the guard counts the ONE map over `rows`
  // as the rendered list, and a second one here would blunt it.
  const labelByKey = new Map<string, string>();
  for (const r of rows) labelByKey.set(r.bucketId, r.label);

  return (
    <section aria-labelledby="budget-ledger-heading" className="space-y-4">
      <div className="space-y-2">
        <h2 id="budget-ledger-heading" className="sn-sec text-2xl sm:text-3xl">
          Category by category
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          What you budgeted, beside what you have actually signed for and paid.
          Only finalized bookings count here — suppliers you are still choosing
          between stay in the Merkado.
        </p>
      </div>

      <DueRollup totals={totals} />

      {/* Column key. The four names are read from BUDGET_LEDGER_COLUMNS, never
          spelled here — one place to change them, and a guard that can check it. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-ink/10 bg-white/45 p-3 sm:grid-cols-4">
        {BUDGET_LEDGER_COLUMNS.map((col) => (
          <div key={col} className="space-y-0.5">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {col}
            </dt>
            <dd className="text-xs text-ink/60">{BUDGET_LEDGER_COLUMN_HINTS[col]}</dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.bucketId}>
            <LedgerRow row={row} />
          </li>
        ))}
      </ul>

      {/* Totals — the same four names in the same order, so the foot of the
          table cannot start telling a different story from its head. */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-white/55 p-4 sm:grid-cols-4">
        <TotalCell
          label={BUDGET_LEDGER_COLUMNS[0]}
          value={totals.plannedPhp === null ? '—' : formatPhp(totals.plannedPhp)}
        />
        <TotalCell label={BUDGET_LEDGER_COLUMNS[1]} value={formatPhp(totals.agreedPhp)} />
        <TotalCell label={BUDGET_LEDGER_COLUMNS[2]} value={formatPhp(totals.paidPhp)} />
        <TotalCell label={BUDGET_LEDGER_COLUMNS[3]} value={formatPhp(totals.owedPhp)} />
      </div>

      {unplannedWithMoney.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-white/45 px-3 py-2.5 text-sm text-ink/70">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
          <span>
            {joinLabels(unplannedWithMoney.map((r) => r.label))}{' '}
            {unplannedWithMoney.length === 1 ? 'has' : 'have'} money agreed but no
            typical price published yet, so {unplannedWithMoney.length === 1 ? 'it is' : 'they are'}{' '}
            not measured against a plan. That is not ₱0 budgeted — it is unknown.
          </span>
        </p>
      ) : null}

      {absorption && absorption.hasOverspend ? (
        <AbsorptionDisclosure absorption={absorption} labelByKey={labelByKey} />
      ) : null}
    </section>
  );
}

/**
 * What is overdue, and what falls in the next 30 days — across every row.
 * Lives in the ledger's own header, not the top-line meter (BA4's file, out
 * of scope here): this section summarises exactly the rows below it, so that
 * is its right home.
 */
function DueRollup({ totals }: { totals: BudgetLedger['totals'] }) {
  const next30Php = totals.dueSoonPhp + totals.upcomingPhp;
  const next30Count = totals.dueSoonCount + totals.upcomingCount;
  if (totals.overdueCount === 0 && next30Count === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-ink/10 bg-white/45 px-3 py-2.5 text-sm">
      {totals.overdueCount > 0 ? (
        <p className="flex items-center gap-1.5 text-terracotta-700">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            <span className="font-mono font-semibold tabular-nums">
              {formatPhp(totals.overduePhp)}
            </span>{' '}
            overdue across {totals.overdueCount}{' '}
            {totals.overdueCount === 1 ? 'payment' : 'payments'}
          </span>
        </p>
      ) : null}
      {next30Count > 0 ? (
        <p className="flex items-center gap-1.5 text-ink/70">
          <Clock aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
          <span>
            <span className="font-mono font-semibold tabular-nums">{formatPhp(next30Php)}</span>{' '}
            due in the next 30 days across {next30Count}{' '}
            {next30Count === 1 ? 'payment' : 'payments'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Text color per tier — overdue reads loudest, upcoming barely raises its voice. */
function tierToneClass(state: LedgerDueTier): string {
  if (state === 'overdue') return 'text-terracotta-700';
  if (state === 'due_soon') return 'text-amber-700';
  return 'text-ink/60';
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function LedgerRow({ row }: { row: BudgetLedgerRow }) {
  const over = row.overByPhp > 0;
  // The bar spans whichever is bigger — the plan or what was actually signed —
  // so an overage has somewhere to be drawn.
  const span = Math.max(row.plannedPhp ?? 0, row.agreedPhp, 1);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / span) * 100))}%`;

  return (
    <article className="sn-row space-y-2.5 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium text-ink">{row.label}</h3>
        {over ? (
          <p className="font-mono text-xs font-medium tabular-nums text-terracotta-700">
            {formatPhp(row.overByPhp)} over plan
          </p>
        ) : row.unplanned ? (
          <p className="text-xs text-ink/50">No typical price yet</p>
        ) : row.headroomPhp > 0 ? (
          <p className="font-mono text-xs tabular-nums text-ink/55">
            {formatPhp(row.headroomPhp)} {row.nothingAgreedYet ? 'not spent yet' : 'under plan'}
          </p>
        ) : null}
      </header>

      {row.nextDue ? (
        <p className={`flex items-center gap-1.5 text-xs ${tierToneClass(row.nextDue.state)}`}>
          <span className="font-mono font-medium tabular-nums">
            {formatPhp(row.nextDue.amountPhp)}
          </span>
          <span>
            {row.nextDue.vendorName ? `to ${row.nextDue.vendorName} — ` : ''}
            {daysUntilDueLabel(row.nextDue.daysUntilDue)}
          </span>
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Cell
          label={BUDGET_LEDGER_COLUMNS[0]}
          /* §18.5 rule 5 — an unplanned leaf prints "—", never ₱0. */
          value={row.plannedPhp === null ? '—' : formatPhp(row.plannedPhp)}
          note={
            row.plannedSource === 'suggested'
              ? 'Suggested — not yet saved'
              : row.plannedSource === 'saved'
                ? 'Your saved plan'
                : 'No typical price yet'
          }
        />
        <Cell label={BUDGET_LEDGER_COLUMNS[1]} value={formatPhp(row.agreedPhp)} tone={over ? 'warn' : 'default'} />
        <Cell label={BUDGET_LEDGER_COLUMNS[2]} value={formatPhp(row.paidPhp)} />
        <Cell
          label={BUDGET_LEDGER_COLUMNS[3]}
          value={formatPhp(row.owedPhp)}
          tone={row.overduePhp > 0 ? 'warn' : 'default'}
          note={
            row.overduePhp > 0
              ? `${formatPhp(row.overduePhp)} past its due date`
              : undefined
          }
        />
      </dl>

      {/* paid ▸ owed ▸ overage, with a tick at the plan. */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-ink/10"
        role="img"
        aria-label={`${row.label}: ${formatPhp(row.paidPhp)} paid of ${formatPhp(
          row.agreedPhp,
        )} agreed${row.plannedPhp === null ? ', no plan to compare' : `, ${formatPhp(row.plannedPhp)} planned`}${
          over ? `, ${formatPhp(row.overByPhp)} over plan` : ''
        }`}
      >
        <div className="absolute inset-y-0 left-0 bg-ink/25" style={{ width: pct(row.agreedPhp) }} />
        <div className="absolute inset-y-0 left-0 bg-success-600" style={{ width: pct(row.paidPhp) }} />
        {over ? (
          <div
            className="absolute inset-y-0 bg-terracotta"
            style={{ left: pct(row.plannedPhp ?? 0), width: pct(row.overByPhp) }}
          />
        ) : null}
        {row.plannedPhp !== null ? (
          <div
            className="absolute inset-y-0 w-px bg-ink/70"
            style={{ left: pct(row.plannedPhp) }}
          />
        ) : null}
      </div>

      {row.overpaidPhp > 0 ? (
        <p className="text-xs text-terracotta-700">
          {formatPhp(row.overpaidPhp)} has been handed over beyond what was agreed.
        </p>
      ) : null}
    </article>
  );
}

function Cell({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="space-y-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{label}</dt>
      <dd
        className={`font-mono text-base font-semibold tabular-nums ${
          tone === 'warn' ? 'text-terracotta-700' : 'text-ink'
        }`}
      >
        {value}
      </dd>
      {note ? <p className="text-[11px] leading-tight text-ink/50">{note}</p> : null}
    </div>
  );
}

/**
 * The absorption plan — behind a tap, never on the row (BA3 scope).
 *
 * ⚠ IT NAMES WHAT IS NOT BANKED. `computeBudgetOverspend` reads any category
 * under its plan as headroom, and a category with nothing agreed yet shows its
 * WHOLE plan that way — which is not savings, it is money not spent yet. The
 * copy says so rather than promising cover that will mostly disappear the
 * moment the couple books.
 */
function AbsorptionDisclosure({
  absorption,
  labelByKey,
}: {
  absorption: NonNullable<BudgetLedger['absorption']>;
  labelByKey: Map<string, string>;
}) {
  const overLabels = absorption.overspent.map((c) => c.label);
  const absorbLabels = Array.from(new Set(absorption.transfers.map((t) => t.fromLabel)));
  const unbankedLabels = absorption.unbankedSourceKeys.map((k) => labelByKey.get(k) ?? k);
  const covered = absorption.fullyAbsorbable;

  return (
    <details className="group rounded-xl border border-ink/12 bg-white/55">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 text-sm text-ink/80">
        {covered ? (
          <CheckCircle2
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
            strokeWidth={1.75}
          />
        ) : (
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700"
            strokeWidth={1.75}
          />
        )}
        <span className="flex-1">
          {joinLabels(overLabels)} {overLabels.length === 1 ? 'is' : 'are'}{' '}
          <strong className="font-medium text-ink">
            {formatPhp(absorption.totalOverspendPhp)}
          </strong>{' '}
          more than you planned.{' '}
          <span className="text-ink/55 group-open:hidden">See what could cover it</span>
          <span className="hidden text-ink/55 group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-ink/10 px-4 py-3 text-sm text-ink/75">
        {absorbLabels.length > 0 ? (
          <p>
            {covered ? (
              <>
                Room left on {joinLabels(absorbLabels)} covers all of it, so your
                total is still inside your plan.
              </>
            ) : (
              <>
                Room left on {joinLabels(absorbLabels)} covers part of it;{' '}
                <strong className="font-medium text-ink">
                  {formatPhp(absorption.netOverPhp)}
                </strong>{' '}
                is not covered anywhere.
              </>
            )}
          </p>
        ) : (
          <p>
            No category is under its plan, so there is nothing to move —{' '}
            <strong className="font-medium text-ink">
              {formatPhp(absorption.netOverPhp)}
            </strong>{' '}
            is over your plan outright.
          </p>
        )}

        {unbankedLabels.length > 0 ? (
          <p className="rounded-lg bg-ink/[0.04] px-3 py-2 text-[13px] text-ink/70">
            {formatPhp(absorption.unbankedCoverPhp)} of that cover comes from{' '}
            {joinLabels(unbankedLabels)}, where you have not booked anyone yet.
            That is money you have not spent, not money you have saved — most of
            it goes when you book.
          </p>
        ) : null}

        {absorption.transfers.length > 0 ? (
          <ul className="space-y-1">
            {absorption.transfers.map((t, i) => (
              <li key={`${t.fromKey}-${t.toKey}-${i}`} className="flex flex-wrap gap-x-1.5 text-[13px]">
                <span className="font-mono font-medium text-ink">{formatPhp(t.amountPhp)}</span>
                <span className="text-ink/60">
                  from {t.fromLabel} could cover {t.toLabel}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-[13px] text-ink/55">
          Nothing here moves your money. It is a suggestion about where the room
          is — the plan above is yours to change.
        </p>
      </div>
    </details>
  );
}
