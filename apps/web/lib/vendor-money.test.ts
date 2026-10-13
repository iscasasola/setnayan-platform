/**
 * vendor-money.test.ts — Customers › Money's figures, EXECUTED (S-PR4; `lib/vendor-money.ts`).
 *
 * The page is a server component; this is where its decisions run:
 *   1. an unread payday is NO figure — never "₱0 to come in" (frame 15);
 *   2. Received · To come in · the meter add up from the shipped timeline, and an amount that never resolved is
 *      counted, not summed as 0;
 *   3. "Next in ▾" windows: This month holds what is overdue too; Next month only next month; All the undated;
 *   4. overdue rows lead, and every row's state is a WORD (Overdue · Due today · Due soon · No date);
 *   5. Log a payment lists who still owes first, with what comes next;
 *   6. the year is null when the ledger was not read, and drops the months that carry nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PaydayInstallmentRow } from './vendor-cashflow';
import { inWindow, moneyBadge, moneyPicture, moneyWindowOf, moneyYear } from './vendor-money';

const TODAY = '2026-10-02';

const row = (over: Partial<PaydayInstallmentRow>): PaydayInstallmentRow => ({
  event_vendor_id: 'ev-1',
  event_id: 'e1',
  event_name: 'Cruz wedding',
  event_date: null,
  seq: 1,
  label: 'Deposit',
  amount_php: 10_000,
  due_date: '2026-10-03',
  confirmed: false,
  ...over,
});

const ROWS: PaydayInstallmentRow[] = [
  row({ event_id: 'cruz', event_vendor_id: 'ev-c', event_name: 'Cruz', seq: 1, amount_php: 43_000, due_date: '2026-08-20', confirmed: true }),
  row({ event_id: 'cruz', event_vendor_id: 'ev-c', event_name: 'Cruz', seq: 2, label: 'Balance', amount_php: 42_000, due_date: '2026-10-03' }),
  row({ event_id: 'ocampo', event_vendor_id: 'ev-o', event_name: 'Ocampo', seq: 1, amount_php: 15_000, due_date: '2026-09-28' }),
  row({ event_id: 'ocampo', event_vendor_id: 'ev-o', event_name: 'Ocampo', seq: 2, label: 'Balance', amount_php: 35_000, due_date: '2026-11-20' }),
  row({ event_id: 'reyes', event_vendor_id: 'ev-r', event_name: 'Reyes', seq: 1, label: 'Full', amount_php: 134_000, due_date: '2026-09-15', confirmed: true }),
  row({ event_id: 'santos', event_vendor_id: 'ev-s', event_name: 'Santos', seq: 1, amount_php: null, due_date: null }),
];

// SABOTAGE: return `totals: { receivedPhp: 0, … }` for an unread payday → RED.
test('1 · an unread payday is no figure, no row and nobody to log for — never ₱0', () => {
  const p = moneyPicture(null, 'month', TODAY);
  assert.equal(p.totals, null);
  assert.deepEqual(p.rows, []);
  assert.deepEqual(p.customers, []);
  // …and an empty read IS a measured nothing: the figures are there, at zero, with no meter.
  const empty = moneyPicture([], 'month', TODAY);
  assert.ok(empty.totals);
  assert.equal(empty.totals.receivedPhp, 0);
  assert.equal(empty.totals.pct, null, 'no booking, no meter — 0 % of ₱0 is not a figure');
});

// SABOTAGE: sum `amount_php ?? 0` into toComePhp, or drop the unresolved count → RED.
test('2 · Received · To come in · the meter add up; an amount never set is counted, not summed', () => {
  const t = moneyPicture(ROWS, 'month', TODAY).totals!;
  assert.equal(t.receivedPhp, 177_000);
  assert.equal(t.toComePhp, 92_000);
  assert.equal(t.bookedPhp, 269_000);
  assert.equal(t.pct, Math.round((177_000 / 269_000) * 100));
  assert.equal(t.unresolved, 1, 'Santos has no amount — said, never a ₱0 row');
  assert.equal(t.overdue, 1, 'Ocampo’s deposit was due Sep 28');
  assert.equal(t.bookings, 4);
});

// SABOTAGE: drop `inst.overdue ||` from the This-month window → RED (a late deposit vanishes from "this month").
test('3 · the windows: This month holds what is overdue; Next month only next; All the undated', () => {
  const titles = (w: 'month' | 'next' | 'all') => moneyPicture(ROWS, w, TODAY).rows.map((r) => `${r.title} ${r.line}`);
  assert.deepEqual(titles('month'), ['Ocampo Deposit · due Sep 28', 'Cruz Balance · due Oct 3']);
  assert.deepEqual(titles('next'), ['Ocampo Balance · due Nov 20']);
  assert.deepEqual(titles('all'), ['Ocampo Deposit · due Sep 28', 'Cruz Balance · due Oct 3', 'Ocampo Balance · due Nov 20', 'Santos Deposit · no date yet']);
  // A confirmed instalment is never "to come in", in any window.
  for (const w of ['month', 'next', 'all'] as const) {
    assert.ok(!titles(w).some((t) => t.startsWith('Reyes')), `${w} lists money already received`);
  }
  // December rolls into January of the next year.
  assert.equal(inWindow({ due_date: '2027-01-05', overdue: false }, 'next', '2026-12-30'), true);
  assert.equal(inWindow({ due_date: '2026-01-05', overdue: false }, 'next', '2026-12-30'), false);
  // An unknown window opens This month.
  assert.equal(moneyWindowOf('soon'), 'month');
  assert.equal(moneyWindowOf(['all']), 'all');
});

// SABOTAGE: return null for an overdue row (colour alone would carry it) → RED.
test('4 · every row’s state is a word: Overdue · Due today · Due soon · No date', () => {
  assert.deepEqual(moneyBadge({ due_date: '2026-09-28', overdue: true }, TODAY), { tone: 'no', word: 'Overdue' });
  assert.deepEqual(moneyBadge({ due_date: TODAY, overdue: false }, TODAY), { tone: 'wait', word: 'Due today' });
  assert.deepEqual(moneyBadge({ due_date: '2026-10-09', overdue: false }, TODAY), { tone: 'wait', word: 'Due soon' });
  assert.equal(moneyBadge({ due_date: '2026-10-20', overdue: false }, TODAY), null, 'a far date needs no word');
  assert.deepEqual(moneyBadge({ due_date: null, overdue: false }, TODAY), { tone: 'quiet', word: 'No date' });
  // The rows carry them, and an unresolved amount stays null (a dash), never 0.
  const all = moneyPicture(ROWS, 'all', TODAY).rows;
  assert.equal(all[0]!.badge?.word, 'Overdue');
  assert.equal(all.at(-1)!.amountPhp, null);
});

// SABOTAGE: sort the customers by name only → RED (Reyes, paid in full, would sit above two who owe).
test('5 · Log a payment lists who still owes first, with what comes next', () => {
  const c = moneyPicture(ROWS, 'month', TODAY).customers;
  assert.deepEqual(
    c.map((x) => `${x.name}: ${x.line}`),
    ['Cruz: ₱42,000 due Oct 3', 'Ocampo: ₱15,000 overdue', 'Santos: An amount not set no date yet', 'Reyes: Paid in full'],
  );
  assert.deepEqual(c.map((x) => x.open), [true, true, true, false]);
});

// SABOTAGE: return `{ receivedPhp: view.ytdPhp ?? 0, … }` for an unmeasured view → RED.
test('6 · the year is null when the ledger was not read, and keeps only months that carry money', () => {
  assert.equal(moneyYear({ measured: false, ytdPhp: null, months: [] }, TODAY), null);
  const y = moneyYear(
    {
      measured: true,
      ytdPhp: 186_000,
      months: [
        { ym: '2025-12', label: 'Dec 2025', total_php: 9_000, order_count: 1 },
        { ym: '2026-08', label: 'Aug 2026', total_php: 43_000, order_count: 1 },
        { ym: '2026-09', label: 'Sep 2026', total_php: 143_000, order_count: 2 },
        { ym: '2026-10', label: 'Oct 2026', total_php: 0, order_count: 0 },
      ],
    },
    TODAY,
  )!;
  assert.equal(y.receivedPhp, 186_000);
  assert.equal(y.payments, 3, 'last December is not this year');
  assert.deepEqual(y.months.map((m) => `${m.label} ${m.php}`), ['Sep 143000', 'Aug 43000']);
});
