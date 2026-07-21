/**
 * Setnayan AI snapshot adapter — pure mapping invariants (node:test via tsx).
 *
 * Locks the row→snapshot mappings that feed the trigger engine: line items +
 * payments → payment reminders (incl. per-line settlement), the Overview
 * committed-vs-target formula → the budget the over-budget trigger reads,
 * paperwork rows → statutory deadlines, and pending inquiry threads →
 * name-masked vendor-quiet inputs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  paymentsFromBudget,
  budgetFromCommitted,
  statutoryFromPaperwork,
  inquiriesFromThreads,
  scheduleClashesFromBlocks,
  clashBlocksFromScheduleRows,
  type BudgetLineItem,
  type ScheduleClashBlock,
} from './setnayan-ai-snapshot';

const items: BudgetLineItem[] = [
  { vendorName: 'Bloom Florals', amountPhp: 20000, dueDate: '2026-02-01', lineItemId: 'li-1' },
  { vendorName: 'Bloom Florals', amountPhp: 10000, dueDate: null, lineItemId: 'li-2' }, // no due date → not a reminder
  { vendorName: 'Grand Venue', amountPhp: 80000, dueDate: '2026-03-01', lineItemId: 'li-3' },
];

test('paymentsFromBudget: due-dated items become reminders; unpaid while owing', () => {
  const out = paymentsFromBudget(items, 0); // nothing paid
  assert.equal(out.length, 2); // only the two with a due_date
  assert.ok(out.every((p) => p.paid === false));
  assert.deepEqual(
    out.map((p) => p.vendor),
    ['Bloom Florals', 'Grand Venue'],
  );
});

test('paymentsFromBudget: fully-settled event marks everything paid (trigger goes quiet)', () => {
  const out = paymentsFromBudget(items, 110000); // total due = 110000, paid in full
  assert.ok(out.every((p) => p.paid === true));
});

test('paymentsFromBudget: partial payment still leaves items unpaid', () => {
  const out = paymentsFromBudget(items, 20000); // paid less than total due
  assert.ok(out.every((p) => p.paid === false));
});

test('paymentsFromBudget: a line covered by ITS OWN linked payments is paid (per-line settlement)', () => {
  const paidByLine = new Map([['li-1', 20000]]); // Bloom's due-dated line fully covered
  const out = paymentsFromBudget(items, 20000, paidByLine);
  const bloom = out.find((p) => p.dueDate === '2026-02-01')!;
  const venue = out.find((p) => p.dueDate === '2026-03-01')!;
  assert.equal(bloom.paid, true); // linked payments cover it → quiet
  assert.equal(venue.paid, false); // still owed → still a reminder
});

test('paymentsFromBudget: partially-covered linked line stays unpaid', () => {
  const paidByLine = new Map([['li-3', 40000]]); // half of Grand Venue's 80000
  const out = paymentsFromBudget(items, 40000, paidByLine);
  assert.equal(out.find((p) => p.dueDate === '2026-03-01')!.paid, false);
});

// ---- budgetFromCommitted (the Overview committed-vs-target formula) ---------

const paidOrders = [
  { confirmedTotalPhp: 2999, requestedTotalPhp: 3999 }, // confirmed wins
  { confirmedTotalPhp: null, requestedTotalPhp: 1499 }, // falls back to requested
];
const vendors = [
  { status: 'contracted', totalCostPhp: 80000, category: 'reception_venue', vendorName: 'Grand Venue' },
  { status: 'deposit_paid', totalCostPhp: 30000, category: 'photography', vendorName: 'Studio A' },
  { status: 'considering', totalCostPhp: 500000, category: 'catering', vendorName: 'Feast Co' }, // NOT locked → excluded
];

test('budgetFromCommitted: null target → no budget guard', () => {
  assert.equal(
    budgetFromCommitted({ targetPhp: null, paidOrders, vendors, pendingOrdersPhp: 0 }),
    null,
  );
});

test('budgetFromCommitted: committed = paid orders (confirmed-else-requested) + locked vendors', () => {
  const b = budgetFromCommitted({ targetPhp: 200000, paidOrders, vendors, pendingOrdersPhp: 2499 })!;
  assert.equal(b.totalPhp, 200000);
  assert.equal(b.committedPhp, 2999 + 1499 + 80000 + 30000); // considering excluded
  assert.equal(b.pendingPhp, 2499);
  assert.equal(b.topDriverCategory, 'reception_venue'); // costliest LOCKED vendor
});

test('budgetFromCommitted: over-budget shape (committed+pending exceeds target)', () => {
  const b = budgetFromCommitted({ targetPhp: 100000, paidOrders, vendors, pendingOrdersPhp: 0 })!;
  assert.ok(b.committedPhp + b.pendingPhp > b.totalPhp); // the GRD-05 trigger will fire
});

// ---- statutoryFromPaperwork (GRD-02 feed) ------------------------------------

test('statutoryFromPaperwork: unreceived docs get a completeByDate deadline; received are quiet', () => {
  const out = statutoryFromPaperwork(
    [
      { documentType: 'marriage_license', status: 'not_started' },
      { documentType: 'cenomar_partner_1', status: 'received' },
    ],
    '2026-09-15',
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.document, 'Marriage License'); // brand-voice label, not the slug
  // completeMonthsBefore for the license is statute-anchored — just assert it's
  // a real ISO date strictly before the event.
  assert.match(out[0]!.deadline, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(out[0]!.deadline < '2026-09-15');
});

test('statutoryFromPaperwork: no event date → no deadlines (nothing to count down to)', () => {
  const out = statutoryFromPaperwork(
    [{ documentType: 'marriage_license', status: 'not_started' }],
    null,
  );
  assert.deepEqual(out, []);
});

// ---- inquiriesFromThreads (SEC-04 feed, name-masked) --------------------------

const NOW = new Date('2026-06-10T12:00:00.000Z');

test('inquiriesFromThreads: pending threads become unanswered inquiries with day counts', () => {
  const out = inquiriesFromThreads(
    [
      { createdAt: '2026-06-05T12:00:00.000Z', vendorCategory: 'photography' },
      { createdAt: '2026-06-09T18:00:00.000Z', vendorCategory: null },
    ],
    NOW,
  );
  assert.equal(out.length, 2);
  assert.equal(out[0]!.sentDaysAgo, 5);
  assert.equal(out[0]!.replied, false);
  assert.equal(out[1]!.sentDaysAgo, 0);
});

test('inquiriesFromThreads: NEVER leaks a vendor name — masked category label only', () => {
  const out = inquiriesFromThreads(
    [{ createdAt: '2026-06-01T00:00:00.000Z', vendorCategory: 'photography' }],
    NOW,
  );
  assert.equal(out[0]!.vendor, 'A photography vendor');
  assert.equal(out[0]!.service, 'photography');
  const masked = inquiriesFromThreads(
    [{ createdAt: '2026-06-01T00:00:00.000Z', vendorCategory: null }],
    NOW,
  );
  assert.equal(masked[0]!.vendor, 'A vendor you inquired with');
});

// ---- GRD-06 schedule clash (overlap detection + row mapper) -----------------

const clashBlock = (label: string, startMs: number, endMs: number): ScheduleClashBlock => ({
  label,
  timeLabel: `t${startMs}`,
  startMs,
  endMs,
});

test('scheduleClashesFromBlocks: a genuine overlap clashes, carrying both labels + start slot', () => {
  const out = scheduleClashesFromBlocks([
    clashBlock('Ceremony', 0, 10),
    clashBlock('Cocktails', 5, 15), // overlaps Ceremony
    clashBlock('Dinner', 20, 30), // clear of both
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { itemA: 'Ceremony', itemB: 'Cocktails', slot: 't0' });
});

test('scheduleClashesFromBlocks: touching endpoints do NOT clash; invalid/zero-length dropped', () => {
  // back-to-back (one ends exactly when the next starts) is not a clash
  assert.equal(
    scheduleClashesFromBlocks([clashBlock('A', 0, 10), clashBlock('B', 10, 20)]).length,
    0,
  );
  // zero-length + NaN bounds are dropped → the valid block has no partner
  assert.equal(
    scheduleClashesFromBlocks([
      clashBlock('Zero', 5, 5),
      clashBlock('NaN', Number.NaN, 10),
      clashBlock('Solo', 0, 100),
    ]).length,
    0,
  );
});

test('scheduleClashesFromBlocks: output is capped', () => {
  const allOverlap = [0, 1, 2, 3, 4].map((i) => clashBlock(`B${i}`, 0, 100));
  assert.equal(scheduleClashesFromBlocks(allOverlap, 3).length, 3);
});

test('clashBlocksFromScheduleRows: keeps top-level dated blocks, drops parts + open-ended', () => {
  const rows = clashBlocksFromScheduleRows([
    { label: 'Ceremony', start_at: '2026-05-09T15:00:00Z', end_at: '2026-05-09T16:00:00Z', parent_block_id: null },
    { label: 'A part', start_at: '2026-05-09T15:10:00Z', end_at: '2026-05-09T15:20:00Z', parent_block_id: 'blk-1' }, // child → drop
    { label: 'Open', start_at: '2026-05-09T18:00:00Z', end_at: null, parent_block_id: null }, // no end → drop
    { label: '  ', start_at: '2026-05-09T17:00:00Z', end_at: '2026-05-09T18:00:00Z', parent_block_id: null }, // blank → fallback label
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.label, 'Ceremony');
  assert.equal(rows[1]!.label, 'A schedule item');
  assert.ok(rows[0]!.timeLabel.length > 0);
  assert.ok(Number.isFinite(rows[0]!.startMs) && Number.isFinite(rows[0]!.endMs));
});
