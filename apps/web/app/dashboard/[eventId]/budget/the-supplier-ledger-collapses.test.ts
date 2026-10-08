/**
 * the-supplier-ledger-collapses.test.ts — on the Budget page a supplier is a
 * LEDGER ROW: the money shows without being asked, the history opens on a tap.
 *
 * ── What this pins ───────────────────────────────────────────────────────
 * "Summary first, history on demand. Each row expands to its dated payments …
 * collapsed, the ledger stays one screen of truth." (Ledger archetype,
 * 2026-08-01, note 3.) The owner's Budget page of 2026-10-08 keeps exactly
 * that, and changes what "expands" means: a booked supplier is ONE row —
 * agreed, and what is still owed or "paid ✓" — and a tap opens a bottom SHEET
 * with every payment, Chat, and Record a payment.
 *
 * ── REWRITTEN FOR THE SHEET (2026-10-08, plan row B2) ─────────────────────
 * Until B2 this guard read `_components/vendor-itemization-card.tsx` and held
 * its `<details>` disclosure shut. That card no longer renders on this page
 * (it is the supplier workspace's), so the same four promises are now held
 * where they are kept:
 *
 *   1 · the collapsed ROW carries the money (not just a name);
 *   2 · the history is genuinely shut — not in the row, not on the page, and
 *       not even in the page's first load of JavaScript;
 *   3 · the row is a real control that opens THAT supplier's sheet;
 *   4 · recording a payment has one writer, and a refusal is said in the
 *       sheet instead of closing it.
 *
 * The lessons the old guard paid for still apply, so each rule anchors on the
 * component that RENDERS the thing (never on where an identifier appears), and
 * every slice is floor-checked so a mis-cut region cannot pass in silence.
 *
 * ⚠ EVIDENCE GRADE: source-derived, plus the `/dev/budget-lab` screenshots in
 * the PR. The signed-in page was not driven in a browser.
 *
 * 🛡 Each rule was sabotaged and seen red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));
const screen = () => read('_components/budget-screen.tsx');
const sheets = () => read('_components/budget-sheets.tsx');
const page = () => read('page.tsx');

/** The body of one top-level `function Name(` in a file, up to the next one. */
function fn(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is gone or renamed — teach this guard the new name rather than deleting it.`);
  const next = src.indexOf('\nfunction ', at + 10);
  const nextExport = src.indexOf('\nexport function ', at + 10);
  const ends = [next, nextExport].filter((n) => n > 0);
  const body = src.slice(at, ends.length ? Math.min(...ends) : src.length);
  assert.ok(body.length > 200, `could not bound ${name} — the slice is too small to hold a render`);
  return body;
}

// ── 1 · the collapsed row carries the money ────────────────────────────────

test('a supplier row shows what was agreed and what is owed — without being opened', () => {
  const row = fn(screen(), 'SupplierGroup');
  assert.match(row, /<Peso value=\{s\.agreedPhp\}/, 'the row no longer prints the agreed amount');
  assert.match(
    row,
    /<OwedLine owedPhp=\{s\.owedPhp\}/,
    'the row no longer prints what is owed (or "paid ✓") — collapsed, it would be a name and nothing else',
  );
  assert.match(row, /\{s\.name\}/, 'the row no longer names the supplier');

  const owed = fn(screen(), 'OwedLine');
  assert.match(owed, /if \(owedPhp > 0\)/, 'OwedLine must branch on money still owed');
  assert.match(owed, /<Peso value=\{owedPhp\}/, 'the owed figure is not printed');
  assert.match(owed, /paid ✓/, 'a supplier paid in full must say so');
});

// ── 2 · the history is genuinely shut ──────────────────────────────────────

test('the page draws no payment history until a row is opened', () => {
  const src = screen();
  // The row list knows nothing about individual payments or due rows.
  assert.doesNotMatch(src, /\.payments\.map\(|\.dues\.map\(/, 'a payment or due list is rendered on the page itself');
  assert.doesNotMatch(src, /<details\b/, 'a disclosure crept back onto the row — the history opens in the sheet');

  // The history lives in the supplier sheet…
  const sheet = fn(sheets(), 'SupplierSheet');
  assert.match(sheet, /payments\.map\(/, 'the supplier sheet no longer lists the payments made');
  assert.match(sheet, /supplier\.dues\.map\(/, 'the supplier sheet no longer lists the payments due');

  // …and that sheet is rendered ONLY for an opened supplier.
  const host = fn(sheets(), 'BudgetSheets');
  assert.match(
    host,
    /\{sheet\?\.kind === 'pay' && supplier \? \(\s*<SupplierSheet/,
    'the supplier sheet is rendered without a supplier having been opened',
  );
});

test('the sheets are not in the first load — they arrive on the first tap', () => {
  const src = screen();
  assert.match(
    src,
    /dynamic\(\(\) => import\('\.\/budget-sheets'\)/,
    'budget-sheets is no longer a dynamic import: four sheets, the dropdown and three server actions would join the first load',
  );
  assert.doesNotMatch(
    src,
    /import\s+\{[^}]*\}\s+from '\.\/budget-sheets'/,
    'a static value import of ./budget-sheets defeats the dynamic one',
  );
  assert.match(src, /\{sheetsWanted \? \(\s*<BudgetSheets/, 'the sheets mount before anything has been opened');
  assert.match(src, /const \[sheet, setSheet\] = useState<BudgetSheetState>\(null\)/, 'the page must open with every sheet shut');
});

// ── 3 · the row opens THAT supplier's sheet ────────────────────────────────

test('a supplier row is a button that opens its own sheet', () => {
  const row = fn(screen(), 'SupplierGroup');
  assert.match(
    row,
    /<button[\s\S]{0,200}?onClick=\{\(\) => onOpen\(s\.vendorId\)\}/,
    'the supplier row is not a button wired to its own supplier',
  );
  assert.match(
    screen(),
    /<SupplierGroup rows=\{list\.suppliers\} onOpen=\{\(vendorId\) => open\(\{ kind: 'pay', vendorId \}\)\} \/>/,
    'opening a supplier row must open the PAYMENTS sheet for that supplier',
  );
});

test('"Pay ›" on the Next line opens the same sheet', () => {
  const src = screen();
  assert.match(src, /if \(next\.vendorId\) open\(\{ kind: 'pay', vendorId: next\.vendorId \}\)/);
});

// ── 4 · one writer, and a refusal is said ──────────────────────────────────

test('recording a payment has ONE writer — the shipped action, and only for a supplier paid here', () => {
  const src = sheets();
  assert.match(src, /logScheduledPayment\(fd\)/, 'the record sheet no longer posts through logScheduledPayment');
  assert.doesNotMatch(src, /\blogPayment\(/, 'logPayment is called directly — its thrown refusal would crash the sheet');
  assert.doesNotMatch(src, /from\('event_vendor_payments'\)/, 'the sheet writes the payments table itself: a second writer');

  // A supplier ON SETNAYAN is paid under "Amount to pay"; the button goes there.
  const sheet = fn(src, 'SupplierSheet');
  assert.match(
    sheet,
    /door === 'amount_to_pay' \? \(\s*<ActionButton[^>]*href=\{extras\.amountToPayHref\}/,
    'a supplier on Setnayan is offered a second payment form instead of the Amount to pay door',
  );
  assert.match(
    sheet,
    /\{!canEdit \|\| !extras \|\| door === 'unknown' \? null :/,
    'an unchecked door (or a reader who may not write) is offered Record a payment — never log blind',
  );
});

test('a refused payment is said in the sheet — the sheet does not close on it', () => {
  const record = fn(sheets(), 'RecordSheet');
  const refusedAt = record.indexOf('setRefused(message);');
  const closeAt = record.indexOf('onClose();');
  assert.ok(refusedAt > 0, 'the refusal is no longer shown');
  assert.ok(closeAt > 0, 'the sheet no longer closes on success');
  assert.ok(
    refusedAt < closeAt && /setRefused\(message\);\s*return;/.test(record),
    'on a refusal the sheet must show the reason and RETURN before it closes — a sheet that closes on failure is a failure rendering as success',
  );
  assert.match(record, /role="alert"/, 'the refusal is not announced');
});

// ── and the old cards are gone from this page ──────────────────────────────

test('the Budget page no longer mounts the per-supplier itemization cards', () => {
  const src = page();
  assert.doesNotMatch(src, /\bVendorItemizationCard\b/, 'the itemization card is back on the Budget page beside the list that replaced it');
  assert.match(src, /buildBudgetList\(/, 'the list must be built from the resolver');
  assert.doesNotMatch(src, /from\('event_costs'\)|from\('orders'\)[\s\S]{0,400}created_at/, 'the page reads a list source itself instead of the resolver');
});
