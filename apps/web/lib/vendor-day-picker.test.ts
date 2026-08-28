import test from 'node:test';
import assert from 'node:assert/strict';

import { collapseToPickerDays, pickConfigureDay } from './vendor-day-picker';

const TODAY = '2026-12-14';

/** Bianca & Paolo: the rehearsal dinner AND the wedding day, one celebration. */
const TWO_DAY = [
  { eventId: 'evt-bp', eventName: 'Bianca & Paolo', bookedDate: '2026-12-13' },
  { eventId: 'evt-bp', eventName: 'Bianca & Paolo', bookedDate: '2026-12-14' },
];

test('THE BUG: a supplier on two days of one celebration keeps BOTH days', () => {
  const days = collapseToPickerDays(TWO_DAY, TODAY);
  assert.equal(days.length, 2, 'the earlier day must not disappear');
  assert.deepEqual(
    days.map((d) => d.bookedDate),
    ['2026-12-13', '2026-12-14'],
  );
});

test('the OLD rule is reproduced here so the regression is visible, and it loses a day', () => {
  // The exact shape that shipped: a Map keyed on eventId alone.
  const old = [...new Map(TWO_DAY.map((b) => [b.eventId, b])).values()];
  assert.equal(old.length, 1, 'if this stops losing a day the guard below is vacuous');
  assert.ok(collapseToPickerDays(TWO_DAY, TODAY).length > old.length);
});

test('the LAUNCH-carrying row survives — today is still classified today', () => {
  const days = collapseToPickerDays(TWO_DAY, '2026-12-13');
  const rehearsal = days.find((d) => d.bookedDate === '2026-12-13');
  assert.equal(rehearsal?.when, 'today', 'the rehearsal day must be launchable on its own day');
  assert.equal(days.find((d) => d.bookedDate === '2026-12-14')?.when, 'upcoming');
});

test('a genuinely repeated (event, date) pair still folds to one row', () => {
  const days = collapseToPickerDays(
    [...TWO_DAY, { eventId: 'evt-bp', eventName: 'Bianca & Paolo', bookedDate: '2026-12-14' }],
    TODAY,
  );
  assert.equal(days.length, 2);
});

test('rows are oldest-first regardless of input order', () => {
  const days = collapseToPickerDays(
    [
      { eventId: 'b', eventName: 'B', bookedDate: '2027-02-14' },
      { eventId: 'a', eventName: 'A', bookedDate: '2026-11-01' },
      ...TWO_DAY,
    ],
    TODAY,
  );
  assert.deepEqual(
    days.map((d) => d.bookedDate),
    ['2026-11-01', '2026-12-13', '2026-12-14', '2027-02-14'],
  );
  assert.deepEqual(
    days.map((d) => d.when),
    ['past', 'past', 'today', 'upcoming'],
  );
});

test('dates are compared as STRINGS — no Date is ever built from YYYY-MM-DD', () => {
  // 2026-12-12 midnight UTC is the 11th in Manila. If anything in here ever
  // parses these into Dates, this classification flips.
  const days = collapseToPickerDays(
    [{ eventId: 'e', eventName: 'E', bookedDate: '2026-12-12' }],
    '2026-12-12',
  );
  assert.equal(days[0]?.when, 'today');
});

test('the setup view prefers TODAY over the other days of the same celebration', () => {
  assert.equal(pickConfigureDay(TWO_DAY, 'evt-bp', '2026-12-13')?.bookedDate, '2026-12-13');
  assert.equal(pickConfigureDay(TWO_DAY, 'evt-bp', '2026-12-14')?.bookedDate, '2026-12-14');
});

test('with no day today it prefers the NEAREST day still ahead', () => {
  assert.equal(pickConfigureDay(TWO_DAY, 'evt-bp', '2026-12-01')?.bookedDate, '2026-12-13');
});

test('with every day behind it falls back to the most recent one', () => {
  assert.equal(pickConfigureDay(TWO_DAY, 'evt-bp', '2027-01-01')?.bookedDate, '2026-12-14');
});

test('a celebration this shop holds no day on resolves to null, never a stray row', () => {
  assert.equal(pickConfigureDay(TWO_DAY, 'somebody-elses-event', TODAY), null);
  assert.equal(pickConfigureDay([], 'evt-bp', TODAY), null);
});
