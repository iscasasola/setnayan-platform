/**
 * SUP-64 · THE BUDGET, TAKEN AWAY — a CSV for a spreadsheet. (The PDF to share and print is `lib/budget-pdf.ts`,
 * which reads its lines through `categoryLabeller` + `exportableLines` below, so the two files list the same money.)
 *
 * Pure: the route (`app/api/budget/[eventId]/export/route.ts`) resolves the
 * money and hands it in; nothing here reads the database or the env.
 *
 * ── ONE SET OF BOOKS ────────────────────────────────────────────────────────
 * Every figure comes from the two things `/budget` itself prints:
 *   • `EventMoney` from `resolveEventMoney` — target, agreed, paid, owed, and
 *     the per-line ledger;
 *   • `BudgetLedger` from `buildBudgetLedger` — the per-category
 *     Planned · Agreed · Paid · Owed table.
 * An export that recomputed any of these would be a second answer, printed on
 * paper, to a question the page already answers.
 *
 * ── AGREED MONEY ONLY (BA2 holds on paper too) ──────────────────────────────
 * Owner 2026-09-02: "no quotes here. we only add the finalized budgets." Lines
 * with `kind === 'estimated'` are a supplier's list price or a quote the couple
 * has not agreed to — they are left out, exactly as the page leaves them out.
 *
 * ── A CELL IS NOT A FORMULA ─────────────────────────────────────────────────
 * Item labels and supplier names are typed by couples and suppliers. A label
 * beginning with `=`, `+`, `-` or `@` would run as a formula when the CSV is
 * opened in a spreadsheet, so text cells are prefixed with `'`. Amounts are
 * written as bare numbers and never go through that path.
 */
import type { EventMoney, MoneyLine } from './budget-truth';
import { bucketLabel } from './budget-truth';
import type { BudgetLedger } from './budget-ledger';

export type BudgetExportInput = {
  eventName: string;
  money: EventMoney;
  ledger: BudgetLedger;
  /** When the export was made — printed on the page so an old printout says so. */
  generatedAt: Date;
};

/**
 * A category's name as `/budget` prints it: the ledger row's label, else the
 * resolver's bucket label, else `bucketLabel` (which only knows the special
 * buckets — used alone it printed the raw id `photo_video`).
 */
export function categoryLabeller(money: EventMoney, ledger: BudgetLedger): (bucketId: string) => string {
  const labels = new Map<string, string>();
  for (const b of money.byBucket ?? []) labels.set(b.bucketId, b.label);
  for (const r of ledger.rows) labels.set(r.bucketId, r.label);
  return (id) => labels.get(id) ?? bucketLabel(id);
}

/** The lines that belong on a record of what was agreed. */
export function exportableLines(
  money: EventMoney,
  label: (bucketId: string) => string = bucketLabel,
): MoneyLine[] {
  return money.lines
    .filter((l) => l.kind === 'committed')
    .slice()
    .sort(
      (a, b) =>
        label(a.bucket).localeCompare(label(b.bucket)) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        a.label.localeCompare(b.label),
    );
}

/** Text cell: quoted when needed, and never executable in a spreadsheet. */
export function csvText(value: string | null | undefined): string {
  let s = value ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Number cell: whole pesos, bare, or empty when there is no figure. */
function csvNum(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '' : String(Math.round(n));
}

export function budgetExportCsv(input: BudgetExportInput): string {
  const { eventName, money, ledger } = input;
  const label = categoryLabeller(money, ledger);
  const rows: string[] = [];
  const row = (...cells: string[]) => rows.push(cells.join(','));

  row(csvText(`${eventName} — budget`), csvText(`Exported ${input.generatedAt.toISOString().slice(0, 10)}`));
  row('');
  row('Summary', 'Amount (PHP)');
  row('Budget target', csvNum(money.targetPhp));
  row('Agreed', csvNum(money.committed));
  row('Paid', csvNum(money.paid));
  row('Still owed', csvNum(money.stillOwed));
  if (money.overpaid > 0) row('Paid beyond what was agreed', csvNum(money.overpaid));
  row('');
  row('Category', 'Planned (PHP)', 'Plan source', 'Agreed (PHP)', 'Paid (PHP)', 'Still owed (PHP)');
  for (const r of ledger.rows) {
    row(
      csvText(r.label),
      csvNum(r.plannedPhp),
      r.plannedSource === 'saved' ? 'Your plan' : r.plannedSource === 'suggested' ? 'Suggested' : '',
      csvNum(r.agreedPhp),
      csvNum(r.paidPhp),
      csvNum(r.owedPhp),
    );
  }
  row('');
  row('Category', 'Item', 'Supplier', 'Agreed (PHP)', 'Paid (PHP)', 'Still owed (PHP)', 'Due date');
  for (const l of exportableLines(money, label)) {
    row(
      csvText(label(l.bucket)),
      csvText(l.label),
      csvText(l.vendorName),
      csvNum(l.amountPhp),
      csvNum(l.paidPhp),
      csvNum(l.stillOwedPhp),
      l.dueDate ?? '',
    );
  }
  // CRLF + a BOM: Excel on Windows otherwise reads "₱"/"ñ" as mojibake.
  return `﻿${rows.join('\r\n')}\r\n`;
}
