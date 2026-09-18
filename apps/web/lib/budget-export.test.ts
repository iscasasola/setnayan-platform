/**
 * SUP-64 · the budget export says what `/budget` says, and nothing it doesn't.
 * The rules are executed; the route is then pinned to its doors and its source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { budgetExportCsv, budgetExportHtml, csvText, exportableLines } from '@/lib/budget-export';
import type { EventMoney, MoneyLine } from '@/lib/budget-truth';
import type { BudgetLedger } from '@/lib/budget-ledger';

const here = dirname(fileURLToPath(import.meta.url));
const ROUTE = resolve(here, '../app/api/budget/[eventId]/export/route.ts');

function line(p: Partial<MoneyLine>): MoneyLine {
  return {
    costKey: p.label ?? 'k',
    label: 'Line',
    bucket: 'catering',
    amountPhp: 0,
    kind: 'committed',
    paidPhp: 0,
    stillOwedPhp: 0,
    source: 'vendor_package',
    sourceRef: 'x',
    vendorId: null,
    vendorName: null,
    readOnly: false,
    dueDate: null,
    daysUntilDue: null,
    dueState: 'none',
    ...p,
  } as MoneyLine;
}

const money = {
  targetPhp: 1_000_000,
  estimated: 800_000,
  committed: 250_000,
  paid: 50_000,
  stillOwed: 200_000,
  overpaid: 0,
  lines: [
    line({ label: 'Catering package', amountPhp: 250_000, paidPhp: 50_000, stillOwedPhp: 200_000, vendorName: 'Kusina Co.', dueDate: '2026-10-01' }),
    line({ label: 'A QUOTE NOBODY AGREED TO', amountPhp: 800_000, kind: 'estimated', bucket: 'photo_video' }),
    line({ label: '=HYPERLINK("http://evil","x")', amountPhp: 0, vendorName: '+cmd' }),
  ],
} as unknown as EventMoney;

const ledger = {
  rows: [
    { bucketId: 'catering', label: 'Catering', plannedPhp: 300_000, plannedSource: 'saved', agreedPhp: 250_000, paidPhp: 50_000, owedPhp: 200_000 },
  ],
} as unknown as BudgetLedger;

const input = { eventName: 'Rosa & <Ben>', money, ledger, generatedAt: new Date('2026-09-18T00:00:00Z') };

test('estimates never reach the export — BA2 holds on paper', () => {
  assert.equal(exportableLines(money).length, 2);
  assert.ok(!budgetExportCsv(input).includes('A QUOTE NOBODY AGREED TO'), 'a quote leaked into the CSV');
  assert.ok(!budgetExportHtml({ ...input, csvHref: '/x' }).includes('A QUOTE NOBODY AGREED TO'), 'a quote leaked into the print page');
  assert.ok(!budgetExportCsv(input).includes('800000'), 'the estimated total leaked into the CSV');
});

test('the CSV carries the resolver’s own totals and the ledger’s rows', () => {
  const csv = budgetExportCsv(input);
  assert.match(csv, /\r\nAgreed,250000\r\n/);
  assert.match(csv, /\r\nPaid,50000\r\n/);
  assert.match(csv, /\r\nStill owed,200000\r\n/);
  assert.match(csv, /\r\nCatering,300000,Your plan,250000,50000,200000\r\n/);
  assert.match(csv, /Catering package,Kusina Co\.,250000,50000,200000,2026-10-01/);
});

test('a typed label can never run as a spreadsheet formula', () => {
  for (const bad of ['=1+1', '+cmd', '-2', '@SUM(A1)']) {
    assert.ok(csvText(bad).replace(/^"/, '').startsWith("'"), `${bad} was left executable`);
  }
  assert.equal(csvText('Kusina, Co.'), '"Kusina, Co."');
  const csv = budgetExportCsv(input);
  assert.ok(!/(^|,)=HYPERLINK/m.test(csv) && !/(^|,)"=HYPERLINK/m.test(csv), 'a formula cell survived');
  assert.ok(!/(^|,)\+cmd/m.test(csv), 'a formula cell survived in the supplier column');
});

test('the print page escapes what couples and suppliers typed', () => {
  const html = budgetExportHtml({ ...input, csvHref: '/x' });
  assert.ok(html.includes('Rosa &amp; &lt;Ben&gt;'));
  assert.ok(!html.includes('<Ben>'));
});

test('the route checks budget access before it reads any money, and never prints ₱0 for "unknown"', () => {
  const s = stripComments(readFileSync(ROUTE, 'utf8'));
  const gate = s.indexOf('resolveBudgetVisibility(');
  const read = s.indexOf('resolveEventMoney(');
  assert.ok(gate > 0 && read > 0, 'route no longer calls resolveBudgetVisibility / resolveEventMoney');
  assert.ok(gate < read, 'money is read before the access check — a refusal on the screen only');
  assert.match(s, /if \(!access\.mayRead\)[\s\S]{0,200}?status: 403/);
  assert.match(s, /if \(!money\)[\s\S]{0,200}?status: 503/, 'a missing resolver must refuse, not export zeroes');
  assert.match(s, /buildBudgetLedger\(\{[\s\S]*?suggestedPlanByBucket\(\{/, 'the export stopped using the page’s ledger');
});
