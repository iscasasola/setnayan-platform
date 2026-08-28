/**
 * anchor → celebration date math — unit tests.
 *
 * The nearby-Saturday derivation is plain UTC arithmetic with no library, so
 * the cases that actually break such code are the ones asserted here: an anchor
 * that IS already a Saturday, a Sunday (the longest hop), month / year rollover,
 * and a leap day.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  activeCelebrationPick,
  celebrationOptionsFor,
  formatCelebrationDay,
  ordinal,
  saturdayAfterISO,
} from './anchor-celebration-dates';

test('saturdayAfterISO moves a weekday forward to that same week’s Saturday', () => {
  // 2026-06-09 is a Tuesday; the Saturday after is 2026-06-13.
  assert.equal(saturdayAfterISO('2026-06-09'), '2026-06-13');
  // Friday → the very next day.
  assert.equal(saturdayAfterISO('2026-07-31'), '2026-08-01');
});

test('a Sunday anchor hops the full six days, not zero', () => {
  // 2026-06-14 is a Sunday → 2026-06-20.
  assert.equal(saturdayAfterISO('2026-06-14'), '2026-06-20');
});

test('an anchor that IS a Saturday has no "Saturday after"', () => {
  // 2026-06-13 and 2026-12-26 are both Saturdays. Returning +7 here would push
  // the party a full week off the day it marks — the chip is dropped instead.
  assert.equal(saturdayAfterISO('2026-06-13'), null);
  assert.equal(saturdayAfterISO('2026-12-26'), null);
});

test('the hop rolls over month and year boundaries', () => {
  // 2026-12-31 is a Thursday → Saturday 2027-01-02 (new year).
  assert.equal(saturdayAfterISO('2026-12-31'), '2027-01-02');
  // 2027-02-24 is a Wednesday → 2027-02-27, still February.
  assert.equal(saturdayAfterISO('2027-02-24'), '2027-02-27');
  // 2027-02-25 is a Thursday → 2027-02-27 (2027 is not a leap year).
  assert.equal(saturdayAfterISO('2027-02-25'), '2027-02-27');
});

test('the hop survives a leap day', () => {
  // 2028-02-29 is a Tuesday → 2028-03-04.
  assert.equal(saturdayAfterISO('2028-02-29'), '2028-03-04');
});

test('malformed or missing anchors yield null, never a guessed date', () => {
  assert.equal(saturdayAfterISO(null), null);
  assert.equal(saturdayAfterISO(''), null);
  assert.equal(saturdayAfterISO('not-a-date'), null);
  assert.equal(saturdayAfterISO('2026-02-31'), null); // rollover rejected
});

test('celebrationOptionsFor uses the anchor’s NEXT return, never the original year', () => {
  // A 2015 union date on 2026-07-31 means the 2027 anniversary, not 2015.
  const opts = celebrationOptionsFor('2015-06-09', '2026-07-31');
  assert.deepEqual(opts, { onTheDayISO: '2027-06-09', saturdayAfterISO: '2027-06-12' });
});

test('celebrationOptionsFor keeps an anchor still ahead in this same year', () => {
  const opts = celebrationOptionsFor('2015-12-26', '2026-07-31');
  // 2026-12-26 is a Saturday → the weekend chip is dropped.
  assert.deepEqual(opts, { onTheDayISO: '2026-12-26', saturdayAfterISO: null });
});

test('celebrationOptionsFor returns null with no readable anchor', () => {
  assert.equal(celebrationOptionsFor(null, '2026-07-31'), null);
  assert.equal(celebrationOptionsFor('', '2026-07-31'), null);
  assert.equal(celebrationOptionsFor('nope', '2026-07-31'), null);
});

test('the active chip is DERIVED from the field, so the calendar re-lights it', () => {
  const opts = celebrationOptionsFor('2015-06-09', '2026-07-31')!;
  assert.equal(activeCelebrationPick(opts, ''), null);
  assert.equal(activeCelebrationPick(opts, null), null);
  assert.equal(activeCelebrationPick(opts, '2027-06-09'), 'on_the_day');
  assert.equal(activeCelebrationPick(opts, '2027-06-12'), 'saturday_after');
  assert.equal(activeCelebrationPick(opts, '2027-07-04'), 'other');
});

test('the day label is locale-free, so server and client agree', () => {
  assert.equal(formatCelebrationDay('2027-06-12'), 'Sat 12 Jun 2027');
  assert.equal(formatCelebrationDay('2026-01-01'), 'Thu 1 Jan 2026');
  assert.equal(formatCelebrationDay(null), null);
  assert.equal(formatCelebrationDay('2026-02-31'), null);
});

test('ordinals handle the teens', () => {
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(4), '4th');
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(12), '12th');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(112), '112th');
  assert.equal(ordinal(101), '101st');
});

test('with no weekend chip, landing on that Saturday is just "another day"', () => {
  const opts = celebrationOptionsFor('2015-12-26', '2026-07-31')!;
  assert.equal(activeCelebrationPick(opts, '2026-12-26'), 'on_the_day');
  assert.equal(activeCelebrationPick(opts, '2027-01-02'), 'other');
});

// ── the chips write the list that commits ─────────────────────────────────
import { celebrationDatesAfterPick } from './anchor-celebration-dates';

const OPTS = { onTheDayISO: '2026-12-16', saturdayAfterISO: '2026-12-19' };

test('🔴 the owner’s exact state: tapping the Saturday moves the day', () => {
  // What he was looking at on 2026-08-28: Dec 16 (the chip's own day, seeded)
  // plus a Dec 18 he had picked himself. Tapping "The Saturday after" used to
  // change nothing on the calendar and commit Dec 16 regardless.
  const next = celebrationDatesAfterPick(OPTS, ['2026-12-16', '2026-12-18'], '2026-12-19', 4);
  assert.deepEqual(next, ['2026-12-18', '2026-12-19']);
});

test('the two chips are two answers to ONE question', () => {
  // Tapping the other chip replaces this chip's day rather than adding to it.
  assert.deepEqual(
    celebrationDatesAfterPick(OPTS, ['2026-12-16'], '2026-12-19', 4),
    ['2026-12-19'],
  );
  assert.deepEqual(
    celebrationDatesAfterPick(OPTS, ['2026-12-19'], '2026-12-16', 4),
    ['2026-12-16'],
  );
});

test('days the person chose on the calendar are never taken away', () => {
  const next = celebrationDatesAfterPick(OPTS, ['2026-12-11', '2026-12-18'], '2026-12-16', 4);
  assert.deepEqual(next, ['2026-12-11', '2026-12-16', '2026-12-18']);
});

test('the list comes back in date order, whatever order it went in', () => {
  const next = celebrationDatesAfterPick(OPTS, ['2026-12-28', '2026-12-02'], '2026-12-16', 4);
  assert.deepEqual(next, ['2026-12-02', '2026-12-16', '2026-12-28']);
});

test('tapping the chip for a day already in the list is a no-op, not a duplicate', () => {
  assert.deepEqual(
    celebrationDatesAfterPick(OPTS, ['2026-12-16', '2026-12-18'], '2026-12-16', 4),
    ['2026-12-16', '2026-12-18'],
  );
});

test('🪤 it REFUSES rather than silently dropping a day the person chose', () => {
  // Four days of their own and no chip day among them: there is no room. Null
  // is the signal to DISABLE the chip — dropping one of their four to make
  // space would be the same defect wearing the opposite coat.
  const theirs = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
  assert.equal(celebrationDatesAfterPick(OPTS, theirs, '2026-12-16', 4), null);
  // With a chip day among them there IS room, because that one gives way.
  assert.deepEqual(
    celebrationDatesAfterPick(OPTS, ['2026-12-01', '2026-12-02', '2026-12-16'], '2026-12-19', 4),
    ['2026-12-01', '2026-12-02', '2026-12-19'],
  );
});

test('with no anchor options it still adds the day, owning nothing', () => {
  assert.deepEqual(celebrationDatesAfterPick(null, ['2026-12-18'], '2026-12-16', 4),
    ['2026-12-16', '2026-12-18']);
});

test('an empty string is never admitted as a date', () => {
  assert.deepEqual(celebrationDatesAfterPick(OPTS, ['', '2026-12-18'], '2026-12-16', 4),
    ['2026-12-16', '2026-12-18']);
});
