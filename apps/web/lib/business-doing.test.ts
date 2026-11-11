/**
 * "How is my business doing" — the words over the SAME reads (simpler supplier dashboard step 6).
 * Held: a shop nobody found is told what to do (no three zeros); the reply line never prints a time the public
 * badge would not; an unread review row says so (never "No reviews"); bars are empty when nothing was booked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { barHeights, businessSentence, fromLine, ratingLine, replyLine, unmeasuredStats } from './business-doing';
import { buildVendorHealthComposite, unmeasuredVendorHealthComposite } from './vendor-health-composite';
import { stripComments } from './strip-comments';

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

test('reply: a REFUSED stats read has no verdict — "Couldn’t load", never "No inquiry yet"', () => {
  assert.deepEqual(replyLine(null), { line: 'Couldn’t load', good: false });
});

test('rating: an unread row is not "no reviews"', () => {
  assert.equal(ratingLine(unmeasuredStats()), 'Couldn’t load');
  assert.equal(ratingLine({ measured: true, row: { review_avg_bayesian: 4.62, review_count: 40 } }), '4.6 ★ · 40 reviews');
  assert.equal(ratingLine({ measured: true, row: { review_avg_bayesian: null, review_count: 0 } }), 'No reviews yet');
});

test('rating: a NEW SHOP has no stats row, and that is not a failure (SetnaProd, 6 Nov)', () => {
  // The three cases the page used to collapse into one `null`.
  assert.equal(ratingLine({ measured: false, row: null }), 'Couldn’t load'); // refused
  assert.equal(ratingLine({ measured: true, row: null }), 'No reviews yet'); // no row yet
  assert.equal(ratingLine({ measured: true, row: { review_avg_bayesian: 4.8, review_count: 3 } }), '4.8 ★ · 3 reviews');
  assert.equal(ratingLine({ measured: true, row: { review_avg_bayesian: 5, review_count: 1 } }), '5.0 ★ · 1 review');
});

test('health: a refused read is "Couldn’t load", a new shop is "New" — never one for the other', () => {
  const newShop = buildVendorHealthComposite(null);
  const refused = unmeasuredVendorHealthComposite();
  assert.equal(newShop.bandLabel, 'NEW');
  assert.match(newShop.coaching, /fills in as couples find you/);
  assert.equal(refused.bandLabel, 'Couldn’t load');
  assert.match(refused.coaching, /couldn’t load/i);
  assert.equal(refused.composite, null);
  assert.ok(refused.pillars.every((p) => p.score === null));
  assert.deepEqual(refused.pillars.map((p) => p.key), newShop.pillars.map((p) => p.key)); // same layout
});

test('from: Setnayan vs your own, or why there is nothing', () => {
  assert.equal(fromLine({ setnayan: { bookingCount: 9 }, offPlatform: { bookingCount: 12 } }), 'Setnayan 9 · your own 12');
  assert.equal(fromLine(null), 'Couldn’t load');
});

test('bars: relative to the busiest; none when nothing booked', () => {
  assert.deepEqual(barHeights([{ bookings: 1 }, { bookings: 2 }, { bookings: 4 }]), [25, 50, 100]);
  assert.deepEqual(barHeights([{ bookings: 0 }, { bookings: 0 }]), []);
});

/*
 * SOURCE GUARD — the Analytics page may not fold the stats read's `error` into `data` again. That one
 * `.then((r) => r.data)` is what told a brand-new shop its data failed to load. Comments are stripped first,
 * because the page's own comment quotes the old line.
 */
const PAGE = join(dirname(fileURLToPath(import.meta.url)), '../app/vendor-dashboard/performance/_components/one-analytics-section.tsx');

test('the Analytics page keeps the stats read’s refusal apart from a missing row', () => {
  const page = stripComments(readFileSync(PAGE, 'utf8'));
  const start = page.indexOf(".from('vendor_activity_stats')");
  assert.ok(start > 0, 'the vendor_activity_stats read moved — re-point this guard, do not delete it');
  const end = page.indexOf("'activity_stats'", start);
  assert.ok(end > start, 'the activity_stats safeRead label moved — re-point this guard');
  const read = page.slice(start, end);

  assert.doesNotMatch(read, /\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.data\s*\)/, 'the error is collapsed into `r.data` again');
  assert.match(read, /\{\s*data\s*,\s*error\s*\}/, 'the stats read must bind `error`');
  assert.match(read, /if\s*\(\s*error\s*\)/, 'a refused stats read must branch on `error`');
  assert.match(read, /unmeasuredStats/, 'a refused (or thrown) stats read must become `measured: false`');
  assert.match(read, /measured:\s*true/, 'a read that happened must say so, row or no row');

  // Every consumer that states something about the shop's data branches on the measurement.
  assert.match(page, /ratingLine\(\s*statsRead\s*\)/, 'ratingLine must receive the measured read, not a bare row');
  assert.match(page, /const\s+health\s*=\s*statsRead\.measured\s*\?/, 'health must say "Couldn’t load" only when refused');
  assert.match(page, /const\s+replyVerdict\s*=\s*statsRead\.measured\s*\?/, 'the reply verdict must not be computed from a refused read');
});
