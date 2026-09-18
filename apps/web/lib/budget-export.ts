/**
 * SUP-64 · THE BUDGET, TAKEN AWAY — a CSV for a spreadsheet and a page to print.
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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
const php = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? '—'
    : `₱${Math.round(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

export function budgetExportHtml(input: BudgetExportInput & { csvHref: string }): string {
  const { eventName, money, ledger } = input;
  const label = categoryLabeller(money, ledger);
  const lines = exportableLines(money, label);
  const date = input.generatedAt.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });

  const categoryRows = ledger.rows
    .map(
      (r) => `<tr><td>${esc(r.label)}</td><td class="n">${php(r.plannedPhp)}${
        r.plannedSource === 'suggested' ? '<span class="src">suggested</span>' : ''
      }</td><td class="n">${php(r.agreedPhp)}</td><td class="n">${php(r.paidPhp)}</td><td class="n">${php(r.owedPhp)}</td></tr>`,
    )
    .join('');
  const itemRows = lines
    .map(
      (l) => `<tr><td>${esc(label(l.bucket))}</td><td>${esc(l.label)}${
        l.vendorName ? `<div class="sub">${esc(l.vendorName)}</div>` : ''
      }</td><td class="n">${php(l.amountPhp)}</td><td class="n">${php(l.paidPhp)}</td><td class="n">${php(l.stillOwedPhp)}</td><td>${esc(l.dueDate ?? '—')}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(eventName)} — budget</title>
<style>
  :root{color-scheme:light}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B1A17;background:#fff;margin:0;padding:24px 16px;max-width:880px;margin-inline:auto;font-size:13px}
  h1{font-size:22px;margin:0 0 2px} h2{font-size:15px;margin:24px 0 8px}
  .meta{color:#4F535B;margin:0 0 16px}
  .bar{display:flex;gap:8px;margin:0 0 16px}
  .bar a,.bar button{font:inherit;padding:6px 12px;border:1px solid #d6d3cc;border-radius:6px;background:#fff;color:#1B1A17;cursor:pointer;text-decoration:none}
  table{width:100%;border-collapse:collapse} th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#4F535B}
  .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .sub,.src{color:#4F535B;font-size:11px} .src{display:block}
  .sum td{font-size:14px} .note{color:#4F535B;font-size:12px;margin-top:16px}
  @media print{.bar{display:none} body{padding:0}}
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button><a href="${esc(input.csvHref)}">Download CSV</a></div>
<h1>${esc(eventName)} — budget</h1>
<p class="meta">As of ${esc(date)}</p>
<table class="sum"><tbody>
<tr><td>Budget target</td><td class="n">${php(money.targetPhp)}</td></tr>
<tr><td>Agreed</td><td class="n">${php(money.committed)}</td></tr>
<tr><td>Paid</td><td class="n">${php(money.paid)}</td></tr>
<tr><td>Still owed</td><td class="n">${php(money.stillOwed)}</td></tr>
</tbody></table>
<h2>By category</h2>
${
  ledger.rows.length
    ? `<table><thead><tr><th>Category</th><th class="n">Planned</th><th class="n">Agreed</th><th class="n">Paid</th><th class="n">Still owed</th></tr></thead><tbody>${categoryRows}</tbody></table>`
    : '<p class="meta">No categories planned or agreed yet.</p>'
}
<h2>What you've agreed to pay</h2>
${
  lines.length
    ? `<table><thead><tr><th>Category</th><th>Item</th><th class="n">Agreed</th><th class="n">Paid</th><th class="n">Still owed</th><th>Due</th></tr></thead><tbody>${itemRows}</tbody></table>`
    : '<p class="meta">Nothing agreed yet.</p>'
}
<p class="note">Agreed money only. Quotes you're still weighing aren't included; they're in the Merkado.</p>
</body></html>`;
}
