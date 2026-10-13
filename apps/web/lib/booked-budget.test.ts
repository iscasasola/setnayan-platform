/**
 * booked-budget.test.ts — the small Budget block under the Booked rows (plan row
 * B4 of the approved Budget design, `BUDGET_PAGE_2026-10-08_fable.md` § 2),
 * EXECUTED over the real resolver core. The block's rule is "one reader": every
 * figure is the Budget page's own reading of the SAME `EventMoney`, so these
 * tests compare against the Budget page's functions, not against typed numbers
 * alone — and a refused read must never print ₱0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeEventMoney, knownMoneyTotals, type MoneyInputs, type MoneyReadStatus } from './budget-truth';
import { budgetMeter, pickNextPayment } from './budget-page-view';
import { bookedBudgetBlock } from './booked-budget';
import { stripComments } from './strip-comments';

const E = '00000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-10-01T04:00:00Z');
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));

const INPUTS: MoneyInputs = {
  targetCentavos: 225_000_000,
  vendors: [
    { vendor_id: 'sv', event_id: E, category: 'venue', vendor_name: 'Seda Vertis North', status: 'contracted', total_cost_php: 1_056_000 },
    { vendor_id: 'sd', event_id: E, category: 'religious_venue', vendor_name: 'Santuario', status: 'contracted', total_cost_php: 26_499 },
    // Asked, not booked: never part of Paid, Owed or the Next line.
    { vendor_id: 'h', event_id: E, category: 'catering', vendor_name: 'Hiraya', status: 'shortlisted', total_cost_php: 216_000 },
  ],
  lineItems: [
    { line_item_id: 'a', vendor_id: 'sv', label: 'First payment', amount_php: 528_000, due_date: '2026-10-05' },
    { line_item_id: 'b', vendor_id: 'sv', label: 'Balance', amount_php: 528_000, due_date: '2026-12-11' },
  ],
  payments: [
    { payment_id: 'p0', vendor_id: 'sd', line_item_id: null, amount_php: 26_499, paid_at: '2026-09-20T03:00:00Z' },
  ],
  orders: [{ order_id: 'o1', description: 'Event Hub Pro', service_key: 'EVENT_HUB_PRO', requested_total_php: 2_500, confirmed_total_php: 2_500, status: 'paid', created_at: '2026-09-14T03:00:00Z' }],
  costs: [],
  pricing: new Map(),
  packageLockedCentavos: new Map(),
  benchmarks: [],
  now: NOW,
};
const money = (over: Partial<MoneyInputs> = {}, reads?: MoneyReadStatus) => computeEventMoney({ ...INPUTS, ...over, reads });

test('the prototype’s Suppliers frame: Paid · Owed · the meter · the Next line — each the Budget page’s own reading', () => {
  const m = money();
  const b = bookedBudgetBlock(m, 2_250_000);
  const t = knownMoneyTotals(m);
  assert.equal(b.paidPhp, t.paidPhp);
  assert.equal(b.paidPhp, 26_499 + 2_500, 'Paid is everything paid — suppliers AND what was bought on Setnayan');
  assert.deepEqual(b.owed, { php: t.owedAtLeastPhp, atLeast: false });
  assert.equal(b.owed?.php, 1_056_000);
  assert.deepEqual(b.meter, budgetMeter({ targetPhp: 2_250_000, agreedPhp: t.agreedPhp, paidPhp: t.paidPhp }));
  assert.deepEqual(b.next, pickNextPayment(m.lines));
  assert.equal(b.next?.name, 'Seda Vertis North');
  assert.equal(b.next?.amountPhp, 528_000);
  assert.equal(b.next?.dueDate, '2026-10-05');
  assert.equal(b.next?.vendorId, 'sv', 'the Next line must carry the supplier so Pay opens THEIR sheet');
  assert.equal(b.partial, false);
});

test('a recorded payment moves Paid, Owed and the Next line — from the ledger, never a typed field', () => {
  const b = bookedBudgetBlock(
    money({ payments: [...INPUTS.payments, { payment_id: 'p1', vendor_id: 'sv', line_item_id: 'a', amount_php: 528_000, paid_at: '2026-10-01T03:00:00Z' }] }),
    2_250_000,
  );
  assert.equal(b.owed?.php, 528_000);
  assert.equal(b.next?.dueDate, '2026-12-11', 'the balance is the next dated payment');
});

test('A REFUSED SOURCE: Paid unknown (never ₱0), Owed a floor with "+", no bar, no Next line', () => {
  const b = bookedBudgetBlock(money({ orders: [] }, { suppliers: 'ok', orders: 'failed', costs: 'ok' }), 2_250_000);
  assert.equal(b.paidPhp, null, 'a partial ledger printed a Paid figure');
  assert.deepEqual(b.owed, { php: 1_056_000, atLeast: true });
  assert.deepEqual(b.meter, { agreedPct: 0, paidPct: 0, overPct: 0 }, 'a bar drawn over an unknown figure');
  assert.equal(b.next, null, 'a Next line stated over a ledger that lost a source');
  assert.equal(b.partial, true);
});

test('NOTHING ANSWERED: Owed is unknown too — a floor of nothing is not ₱0', () => {
  const b = bookedBudgetBlock(
    money({ vendors: [], lineItems: [], payments: [], orders: [], costs: [] }, { suppliers: 'failed', orders: 'failed', costs: 'failed' }),
    2_250_000,
  );
  assert.equal(b.paidPhp, null);
  assert.equal(b.owed, null, '"₱0+" drawn for a ledger that never answered');
});

test('no target: the bar is scaled to what is agreed, and nothing is invented', () => {
  const b = bookedBudgetBlock(money(), null);
  assert.equal(b.meter.agreedPct, 100);
  assert.equal(b.meter.overPct, 0);
});

test('the block and the rows are ONE read: the slot hands the block the SAME money object, and the page makes no second call', () => {
  const slot = read('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx');
  assert.equal((slot.match(/resolveEventMoney\w*\(/g) ?? []).length, 1, 'the Booked slot resolves the money more than once');
  assert.match(slot, /const budget = bookedBudgetBlock\(money, targetPhp\);/);
  assert.match(slot, /buildBudgetList\(money\)/, 'the rows no longer read the same object');
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.doesNotMatch(page, /resolveEventMoney/, 'the Suppliers page resolves the money a second time');
  // The block draws; it computes nothing of its own.
  const block = read('app/dashboard/[eventId]/vendors/_components/booked-budget.tsx');
  assert.doesNotMatch(block, /\.reduce\(|knownMoneyTotals|pickNextPayment|budgetMeter|resolveEventMoney/, 'the block sums money itself');
  assert.match(block, /<NextPayButton\b/, 'the Next line’s Pay must open the same Pay sheet as the row');
  assert.doesNotMatch(block, /Buffer|If you book these|Setnayan orders/, 'the superseded six-figure block is back');
});
