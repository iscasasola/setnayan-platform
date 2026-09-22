/**
 * a-free-fee-window-fails-closed.test.ts
 *
 * The free-fee window gives money away. Every way it can be wrong gives it away
 * to the wrong people, or refuses it to the right ones — so this runs the rule
 * rather than reading it.
 *
 * The cases here are also the EXACT table the db-test replays against the SQL
 * function (`tests/db/a-free-fee-window-waives-the-charge.db.test.ts`), which is
 * what stops the pure twin and the real rule drifting apart. Add a case here and
 * add it there.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBookingFeeFreeWindowActive,
  freeWindowEndsLabel,
  type BookingFeeFreeWindow,
} from './booking-fee-free-window';

/**
 * Shared with the db-test. `at` is the instant judged; `open` is the answer both
 * implementations must give.
 */
export const WINDOW_CASES: ReadonlyArray<{
  name: string;
  window: BookingFeeFreeWindow;
  at: string;
  open: boolean;
}> = [
  // ── the off state ──────────────────────────────────────────────────────
  { name: 'both bounds unset is NOT a window', window: { from: null, until: null }, at: '2026-10-01T00:00:00Z', open: false },

  // ── a closed window, both ends ─────────────────────────────────────────
  { name: 'inside a closed window', window: { from: '2026-10-01T00:00:00Z', until: '2026-10-31T23:59:59Z' }, at: '2026-10-15T12:00:00Z', open: true },
  { name: 'before it opens', window: { from: '2026-10-01T00:00:00Z', until: '2026-10-31T23:59:59Z' }, at: '2026-09-30T23:59:59Z', open: false },
  { name: 'after it closes', window: { from: '2026-10-01T00:00:00Z', until: '2026-10-31T23:59:59Z' }, at: '2026-11-01T00:00:01Z', open: false },
  { name: 'the first instant is INSIDE', window: { from: '2026-10-01T00:00:00Z', until: '2026-10-31T23:59:59Z' }, at: '2026-10-01T00:00:00Z', open: true },
  { name: 'the last instant is INSIDE', window: { from: '2026-10-01T00:00:00Z', until: '2026-10-31T23:59:59Z' }, at: '2026-10-31T23:59:59Z', open: true },

  // ── open-ended on one side ─────────────────────────────────────────────
  { name: 'only an end — free from now until then', window: { from: null, until: '2026-11-30T23:59:59Z' }, at: '2026-10-15T00:00:00Z', open: true },
  { name: 'only an end, already past', window: { from: null, until: '2026-09-01T00:00:00Z' }, at: '2026-10-15T00:00:00Z', open: false },
  { name: 'only a start — runs until somebody closes it', window: { from: '2026-10-01T00:00:00Z', until: null }, at: '2027-05-01T00:00:00Z', open: true },
  { name: 'only a start, not yet reached', window: { from: '2026-12-01T00:00:00Z', until: null }, at: '2026-10-15T00:00:00Z', open: false },

  // ── an inverted window is not a window ─────────────────────────────────
  { name: 'end before start can never be open', window: { from: '2026-11-01T00:00:00Z', until: '2026-10-01T00:00:00Z' }, at: '2026-10-15T00:00:00Z', open: false },
];

test('the window answers the same way the money does', () => {
  for (const c of WINDOW_CASES) {
    assert.equal(
      isBookingFeeFreeWindowActive(c.window, new Date(c.at)),
      c.open,
      `${c.name}: expected ${c.open ? 'OPEN' : 'CLOSED'}`,
    );
  }
});

test('an unparseable bound does nothing rather than everything', () => {
  /*
    🔴 A TYPO MUST NOT HAND EVERY SUPPLIER A FREE BOOKING. The tempting
    implementation treats an unreadable date as "no constraint on that side",
    which turns `until: "30 Nov"` — a perfectly natural thing for a person to
    type — into a promotion with no end.
  */
  assert.equal(
    isBookingFeeFreeWindowActive({ from: null, until: '30 Nov' }, new Date('2026-10-15T00:00:00Z')),
    false,
    'an unparseable end opened the window',
  );
  assert.equal(
    isBookingFeeFreeWindowActive({ from: 'soon', until: '2026-11-30T00:00:00Z' }, new Date('2026-10-15T00:00:00Z')),
    false,
    'an unparseable start opened the window',
  );
  assert.equal(
    isBookingFeeFreeWindowActive({ from: null, until: '2026-11-30T00:00:00Z' }, new Date(NaN)),
    false,
    'an invalid "now" opened the window',
  );
});

test('the end date is said in Manila, not in the server’s zone', () => {
  /*
    The server runs in UTC and every supplier reading this line is in the
    Philippines. 2026-11-30T17:00Z is already 1 December in Manila — a label
    formatted in UTC would promise a day that has passed for the reader.
  */
  // ⚠ THE ORDER IS THE LOCALE'S, NOT MINE. `en-PH` renders "December 1".
  // Asserting a hand-typed "1 December" would fail on a runtime whose ICU
  // data is perfectly correct. The ZONE is what this test is about: 30 Nov
  // 17:00 UTC is already the 1st in Manila, and a UTC label would say the 30th.
  assert.equal(freeWindowEndsLabel('2026-11-30T17:00:00Z'), 'December 1');
  assert.equal(freeWindowEndsLabel('2026-11-30T09:00:00Z'), 'November 30');
  assert.equal(freeWindowEndsLabel(null), null, 'an open-ended window named a date');
  assert.equal(freeWindowEndsLabel('not a date'), null, 'an unparseable end produced a label');
});
