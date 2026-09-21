/**
 * A TEMPORARY APPROVAL HAS A DATE, AND THE DATE CAN PASS.
 *
 * The rule under test is the one thing about `review_by` that can be got wrong:
 * three states, a string date compare, and a timezone. It lives in a pure module
 * precisely so this file can EXECUTE it — `lib/data-privacy-controls.ts` reaches
 * for Supabase and could only ever be grepped.
 *
 * Every case that matters here is a NEGATIVE — something that must NOT read as
 * settled. A test that only checked "a future date is provisional" would pass
 * against a resolver that returned 'provisional' unconditionally.
 *
 * Run from apps/web:  npx tsx --test lib/provisional-approval.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  approvalStanding,
  isOverdue,
  manilaToday,
  reviewBanner,
  summariseReviews,
} from './provisional-approval';

/** 2026-09-22T04:00:00Z = 12:00 noon in Manila. Mid-day, so no edge ambiguity. */
const NOON_MANILA = Date.parse('2026-09-22T04:00:00Z');

test('an inactive control owes no review, whatever its date says', () => {
  assert.equal(
    approvalStanding({ status: 'inactive', reviewBy: '2020-01-01' }, NOON_MANILA),
    'inactive',
  );
  assert.equal(approvalStanding({ status: 'blocked', reviewBy: null }, NOON_MANILA), 'inactive');
});

test('active with no date is settled, not provisional', () => {
  for (const reviewBy of [null, undefined, '', '   ']) {
    assert.equal(
      approvalStanding({ status: 'active', reviewBy }, NOON_MANILA),
      'settled',
      `reviewBy ${JSON.stringify(reviewBy)} should read as settled`,
    );
  }
});

test('the January the owner named is still ahead of us today', () => {
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2027-01-31' }, NOON_MANILA),
    'provisional',
  );
});

test('a date that has passed is overdue — this is the whole point', () => {
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2026-09-21' }, NOON_MANILA),
    'overdue',
  );
  assert.ok(isOverdue({ status: 'active', reviewBy: '2026-01-31' }, NOON_MANILA));
});

test('due TODAY is still in hand — you have until the end of the day', () => {
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2026-09-22' }, NOON_MANILA),
    'provisional',
  );
});

test('an unreadable date is overdue, never settled', () => {
  // "I cannot tell when this was due" must mean go and look. Failing the other
  // way lets one bad row leave the board silently.
  for (const junk of ['soon', 'January', '31-01-2027', '2027-13-45x']) {
    assert.equal(
      approvalStanding({ status: 'active', reviewBy: junk }, NOON_MANILA),
      'overdue',
      `${JSON.stringify(junk)} must not read as settled`,
    );
  }
});

test('a full ISO timestamp is compared as a calendar date, not as a string', () => {
  // '2026-09-21T00:00:00+00:00' <= '2026-09-22' is FALSE as a raw string
  // compare, so an unnormalised timestamp would read as not-yet-due forever.
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2026-09-21T00:00:00+00:00' }, NOON_MANILA),
    'overdue',
  );
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2027-01-31T00:00:00+00:00' }, NOON_MANILA),
    'provisional',
  );
});

test('the Manila day rolls eight hours before the UTC one', () => {
  // 2026-09-22T17:00Z is already the 23rd in Manila. A UTC-based "today" would
  // still say the 22nd and call a review due on the 22nd not-yet-overdue.
  assert.equal(manilaToday(Date.parse('2026-09-22T17:00:00Z')), '2026-09-23');
  assert.equal(manilaToday(Date.parse('2026-09-22T15:59:00Z')), '2026-09-22');
  assert.equal(
    approvalStanding({ status: 'active', reviewBy: '2026-09-22' }, Date.parse('2026-09-22T17:00:00Z')),
    'overdue',
  );
});

test('the summary counts each row once and never calls a passed date "next"', () => {
  const rows = [
    { status: 'active', reviewBy: '2027-01-31' },
    { status: 'active', reviewBy: '2026-12-01' },
    { status: 'active', reviewBy: '2026-01-01' }, // overdue
    { status: 'active', reviewBy: null }, // settled
    { status: 'inactive', reviewBy: '2026-01-01' }, // not switched on
  ];
  const s = summariseReviews(rows, NOON_MANILA);
  assert.equal(s.provisional, 2);
  assert.equal(s.overdue, 1);
  // The soonest one STILL AHEAD — not the January that already went by.
  assert.equal(s.nextDue, '2026-12-01');
});

test('the banner says nothing when there is nothing to say', () => {
  assert.equal(reviewBanner({ provisional: 0, overdue: 0, nextDue: null }), null);
});

test('overdue outranks provisional in the banner', () => {
  const b = reviewBanner({ provisional: 5, overdue: 2, nextDue: '2027-01-31' })!;
  assert.match(b, /past their review date/);
  assert.doesNotMatch(b, /2027-01-31/, 'a future date must not soften an overdue banner');
});

test('the provisional banner names the deadline', () => {
  const b = reviewBanner({ provisional: 20, overdue: 0, nextDue: '2027-01-31' })!;
  assert.match(b, /20 approvals are temporary/);
  assert.match(b, /2027-01-31/);
});
