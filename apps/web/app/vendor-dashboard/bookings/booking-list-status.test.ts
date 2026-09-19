import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  bookingListStatus,
  bookingPillLabel,
  parseBookingFilter,
  type BookingListFacts,
} from './booking-list-status';

/**
 * S43 · 2 — the Bookings list tags a row from the BOOKING, not from chat
 * activity. Before: "New" = an unread chat notification, "Stale" = 30 days
 * without a message. A paid, quiet booking read as Stale.
 */

const base: BookingListFacts = { inquiryStatus: 'accepted', booked: false, quoted: false, completed: false };

test('an unanswered ask is New, whatever the chat did', () => {
  assert.equal(bookingListStatus({ ...base, inquiryStatus: 'pending' }), 'new');
  assert.equal(bookingPillLabel({ ...base, inquiryStatus: 'pending' }), 'New');
});

test('an accepted conversation, a quote and a booking are In progress, each with its own pill', () => {
  assert.equal(bookingListStatus(base), 'in_progress');
  assert.equal(bookingPillLabel(base), 'In conversation');
  assert.equal(bookingListStatus({ ...base, quoted: true }), 'in_progress');
  assert.equal(bookingPillLabel({ ...base, quoted: true }), 'Quoted');
  assert.equal(bookingListStatus({ ...base, booked: true }), 'in_progress');
  assert.equal(bookingPillLabel({ ...base, booked: true }), 'Booked');
});

test('a booking wins over a pending thread status — a booked couple is never "New"', () => {
  assert.equal(bookingListStatus({ ...base, inquiryStatus: 'pending', booked: true }), 'in_progress');
  assert.equal(bookingPillLabel({ ...base, inquiryStatus: 'pending', booked: true }), 'Booked');
});

test('a finished job and an ended conversation are Closed', () => {
  assert.equal(bookingListStatus({ ...base, booked: true, completed: true }), 'closed');
  assert.equal(bookingPillLabel({ ...base, booked: true, completed: true }), 'Completed');
  for (const s of ['declined', 'withdrawn', 'expired', 'displaced']) {
    assert.equal(bookingListStatus({ ...base, inquiryStatus: s }), 'closed', s);
    assert.equal(bookingPillLabel({ ...base, inquiryStatus: s }), 'Cancelled', s);
  }
});

test('the retired ?status=stale link lands on All, not on a bucket it never meant', () => {
  assert.equal(parseBookingFilter('stale'), 'all');
  assert.equal(parseBookingFilter(undefined), 'all');
  assert.equal(parseBookingFilter('closed'), 'closed');
  assert.equal(parseBookingFilter('new'), 'new');
  assert.equal(parseBookingFilter('in_progress'), 'in_progress');
});

test('the surface derives the tag from the booking facts, and no longer from chat timing', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/vendor-dashboard/bookings/surface.tsx'), 'utf8'),
  );
  assert.ok(src.length > 2000, 'read the real surface (an empty read is a green lie)');
  const statusAssign = [...src.matchAll(/status: bookingListStatus\(facts\)/g)].length;
  assert.equal(statusAssign, 1, `the row status must come from bookingListStatus — found ${statusAssign}`);
  // `…Detailed` is the same room read, plus whether it reached the end.
  assert.equal(
    [...src.matchAll(/fetchVendorRoomEvents(?:Detailed)?\(/g)].length,
    1,
    'Booked must come from the room read',
  );
  assert.ok(!/THIRTY_DAYS_MS/.test(src), 'the 30-days-quiet timer is back');
  assert.ok(!/if \(unread\) status/.test(src), 'an unread notification is deciding the tag again');
  assert.ok(!/'stale'/.test(src), 'the chat-timing Stale bucket is back');
});
