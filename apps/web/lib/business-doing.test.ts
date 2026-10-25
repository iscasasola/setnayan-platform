/**
 * "How is my business doing" — the words over the SAME reads (simpler supplier dashboard step 6).
 * Held: a shop nobody found is told what to do (no three zeros); the reply line never prints a time the public
 * badge would not; an unread review row says so (never "No reviews"); bars are empty when nothing was booked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { barHeights, businessSentence, fromLine, ratingLine, replyLine } from './business-doing';

test('the sentence: counts when found, a next step when not', () => {
  assert.deepEqual(businessSentence({ views: 48, inquiries: 6, booked: 2 }), { lead: '48 couples looked at you', rest: '6 asked · 2 booked' });
  assert.deepEqual(businessSentence({ views: 1, inquiries: 0, booked: 0 }).lead, '1 couple looked at you');
  assert.deepEqual(businessSentence({ views: 0, inquiries: 0, booked: 0 }), { lead: 'Nobody has found you yet', rest: 'put up a service and share your QR' });
});

test('reply: the badge’s own label when shown; never a time when the badge withholds it for no data', () => {
  assert.deepEqual(replyLine({ shown: true, label: 'Usually responds in 2h', medianMinutes: 120, sample: 9 }), { line: 'Usually responds in 2h · couples see this', good: true });
  assert.equal(replyLine({ shown: false, reason: 'no_median' }).line, 'No inquiry yet');
  assert.doesNotMatch(replyLine({ shown: false, reason: 'away' }).line, /\d/);
});

test('rating: an unread row is not "no reviews"', () => {
  assert.equal(ratingLine(null), 'Couldn’t load');
  assert.equal(ratingLine({ review_avg_bayesian: 4.62, review_count: 40 }), '4.6 ★ · 40 reviews');
  assert.equal(ratingLine({ review_avg_bayesian: null, review_count: 0 }), 'No reviews yet');
});

test('from: Setnayan vs your own, or why there is nothing', () => {
  assert.equal(fromLine({ setnayan: { bookingCount: 9 }, offPlatform: { bookingCount: 12 } }), 'Setnayan 9 · your own 12');
  assert.equal(fromLine(null), 'Couldn’t load');
});

test('bars: relative to the busiest; none when nothing booked', () => {
  assert.deepEqual(barHeights([{ bookings: 1 }, { bookings: 2 }, { bookings: 4 }]), [25, 50, 100]);
  assert.deepEqual(barHeights([{ bookings: 0 }, { bookings: 0 }]), []);
});
