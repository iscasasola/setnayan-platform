/**
 * Shop › Analytics, growing — the words over the numbers (lib/analytics-growing.ts). Owner-approved 6 Nov 2026.
 * The owner's guard first: A TIE NEVER CLAIMS THE BEST MONTH.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aheadLine,
  askingLine,
  bestMonthClaim,
  bookingLine,
  bucketInstants,
  compareLine,
  dayBuckets,
  findingLine,
  growthSentence,
  monthBuckets,
  railMarker,
  repLine,
  replyGauge,
  replyRow,
  ordinal,
  segText,
  stripMarks,
  stripMonths,
} from './analytics-growing';
import type { SourceSlice } from './vendor-funnel';

const S = (input: Parameters<typeof growthSentence>[0]) => segText(growthSentence(input));

test('🔒 a TIE never says "your best month" — it says "matching"', () => {
  const tie = S({ figures: { views: 410, inquiries: 38, booked: 9 }, viewsChange: null, unit: 'month', booked: [0, 2, 0, 1, 2] });
  assert.match(tie, /2 this month, matching your best month so far/);
  assert.doesNotMatch(tie, /this month, your best month/);
  assert.deepEqual(bestMonthClaim('month', [0, 2, 0, 1, 2]), { last: 2, tie: true });
});

test('the best month is claimed only when the last month beats EVERY earlier one', () => {
  assert.match(S({ figures: { views: 410, inquiries: 38, booked: 9 }, viewsChange: null, unit: 'month', booked: [0, 1, 0, 1, 0, 2, 0, 1, 1, 0, 1, 3] }), /— 3 this month, your best month so far\.$/);
  // last month lower than an earlier month → no claim at all
  const lower = S({ figures: { views: 410, inquiries: 38, booked: 9 }, viewsChange: null, unit: 'month', booked: [0, 3, 1] });
  assert.doesNotMatch(lower, /best/);
  // nothing this month → no claim
  assert.equal(bestMonthClaim('month', [2, 1, 0]), null);
  // 30 days NEVER claims best, even with a rising day series
  assert.equal(bestMonthClaim('day', [0, 0, 1, 2]), null);
  assert.doesNotMatch(S({ figures: { views: 48, inquiries: 6, booked: 2 }, viewsChange: 12, unit: 'day', booked: [0, 0, 1, 2] }), /best/);
});

test('the sentence uses only the page’s own numbers — the prototype’s two lines, word for word', () => {
  assert.equal(
    S({ figures: { views: 67, inquiries: 0, booked: 0 }, viewsChange: -16, unit: 'day', booked: Array(30).fill(0) }),
    '67 couples opened your page · 16 fewer than the 30 days before · no inquiries yet.',
  );
  assert.equal(
    S({ figures: { views: 48, inquiries: 6, booked: 2 }, viewsChange: 12, unit: 'day', booked: [] }),
    '48 couples opened your page · 12 more than the 30 days before · 6 asked · 2 booked.',
  );
  assert.equal(S({ figures: { views: 5, inquiries: 0, booked: 0 }, viewsChange: 0, unit: 'day', booked: [] }), '5 couples opened your page · no inquiries yet.');
  assert.equal(S({ figures: { views: 410, inquiries: 38, booked: 9 }, viewsChange: null, unit: 'month', booked: [1, 0] }), '410 couples opened your page over 12 months · 38 asked · 9 booked.');
  // the numbers are bold runs
  const b = growthSentence({ figures: { views: 67, inquiries: 0, booked: 0 }, viewsChange: -16, unit: 'day', booked: [] }).filter((s) => s.b).map((s) => s.t);
  assert.deepEqual(b, ['67', '16']);
});

test('an unread sentence says so — never "0 couples"', () => {
  assert.equal(S({ figures: null, viewsChange: null, unit: 'day', booked: null }), 'Couldn’t load your numbers just now.');
});

const sl = (key: string, label: string, count: number): SourceSlice => ({ key, label, count, shown: count >= 5 });

test('§1 line: the prototype’s three lines from the slices', () => {
  assert.equal(findingLine([sl('profile_direct', 'Profile (direct)', 66), sl('explore_card', 'Explore card', 1)], 67), 'Almost all came straight to your profile link');
  assert.equal(findingLine([sl('profile_direct', 'Profile (direct)', 31), sl('host_marketplace_search', 'Marketplace search', 12), sl('explore_card', 'Explore card', 5)], 48), 'Direct first, then search, then the Explore card');
  assert.equal(
    findingLine([sl('profile_direct', '', 266), sl('host_marketplace_search', '', 98), sl('explore_card', '', 31), sl('host_manual', '', 15)], 410),
    'Direct first, then search, Explore, and couples adding you',
  );
  // a hidden source is never named; unread is said
  assert.doesNotMatch(findingLine([sl('profile_direct', '', 20), sl('explore_card', '', 3)], 23), /Explore/);
  assert.equal(findingLine(null, 10), 'Couldn’t load');
  assert.equal(findingLine([], 0), 'No profile views in this window yet');
});

test('§2–§6 lines', () => {
  assert.equal(askingLine({ shown: false, reason: 'no_median' }, 0), 'No inquiries yet · couples see nothing yet about your replies');
  assert.equal(askingLine({ shown: true, label: 'Usually responds in 2h', medianMinutes: 100, sample: 5 }, 6), 'You reply in about 2h · couples see it');
  assert.equal(askingLine(null, 3), 'Couldn’t load');
  assert.equal(bookingLine(0, { revenuePhp: 0, setnayanBookings: 0 }), 'Nothing booked in these days yet');
  assert.equal(bookingLine(2, { revenuePhp: 86000, setnayanBookings: 1 }), '₱86,000 booked · 1 from Setnayan');
  assert.equal(bookingLine(2, null), 'Couldn’t load');
  assert.equal(aheadLine({ bookedDays: 0, waitingCouples: 0, waitingDates: 0 }), 'Nothing booked ahead · no couples waiting');
  assert.equal(aheadLine({ bookedDays: 4, waitingCouples: 3, waitingDates: 2 }), '4 days booked ahead · 3 couples waiting on 2 dates');
  assert.equal(repLine('No reviews yet', { verified: true, milestone: null }), 'No reviews yet · SETNAYAN Verified');
  assert.equal(repLine('4.8 ★ · 12 reviews', { verified: true, milestone: '10 events Bronze' }), '4.8 ★ · 12 reviews · Verified · 10 events Bronze');
  assert.equal(compareLine({ composite: null, bandLabel: 'NEW', unread: false }, null), 'Not enough shops like yours yet');
  assert.equal(
    compareLine({ composite: 72, bandLabel: 'STEADY', unread: false }, [{ key: 'conversion', tier: 'above_median' }, { key: 'reply_mins', tier: 'top' }]),
    'Health 72 · Steady · reply time in the top quarter',
  );
  assert.equal(compareLine({ composite: null, bandLabel: 'Couldn’t load', unread: true }, null), 'Couldn’t load');
});

test('the reply row and gauge follow the public verdict', () => {
  assert.deepEqual(replyRow({ shown: true, label: 'Usually responds in 2h', medianMinutes: 100, sample: 5 }), { line: 'From your 5 answered conversations', chip: { tone: 'ok', word: 'Shown' } });
  assert.deepEqual(replyRow({ shown: false, reason: 'no_median' }), { line: 'Answered conversations · 3 make a habit', chip: { tone: 'quiet', word: 'Not shown yet' } });
  assert.equal(replyRow(null).chip.word, 'Couldn’t load');
  assert.deepEqual(replyGauge({ shown: false, reason: 'not_enough_replies', sample: 2 }), { minutes: null, answered: 2, shown: false });
  assert.deepEqual(replyGauge({ shown: true, label: '', medianMinutes: 100, sample: 9 }), { minutes: 100, answered: 3, shown: true });
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 45, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '45th', '101st']);
});

test('buckets are Manila days and months, oldest first, matching the booked series’ keys', () => {
  const now = Date.parse('2026-11-06T02:00:00Z'); // 10:00 Manila, 6 Nov
  const days = dayBuckets(now, 30);
  assert.equal(days.length, 30);
  assert.deepEqual(days[29], { key: '2026-11-06', label: '6 Nov', count: 0 });
  assert.equal(days[0]!.key, '2026-10-08');
  const months = monthBuckets(now, 12);
  assert.deepEqual(months.map((m) => m.label).join(''), 'DecJanFebMarAprMayJunJulAugSepOctNov');
  assert.equal(months[0]!.key, '2025-12-01');
  // 23:30 UTC on 5 Nov is 07:30 on 6 Nov in Manila
  const b = bucketInstants(['2026-11-05T23:30:00Z', '2026-11-05T15:00:00Z', '2020-01-01T00:00:00Z', 'nonsense'], days, 'day');
  assert.equal(b[29]!.count, 1);
  assert.equal(b[28]!.count, 1);
  assert.equal(b.reduce((s, x) => s + x.count, 0), 2, 'an instant outside the window is dropped, never folded into an edge');
});

test('the 13-week strip and the price rail', () => {
  const m = stripMarks('2026-11-06', [{ date: '2026-11-15', bookings: 1 }, { date: '2026-11-29', bookings: 2 }, { date: '2027-06-01', bookings: 1 }], [{ date: '2026-12-13' }]);
  assert.deepEqual(m, { booked: [{ at: 9, many: false }, { at: 23, many: true }], waiting: [37] });
  assert.deepEqual(stripMonths('2026-11-06'), ['Nov', '', '', '', 'Dec', '', '', '', 'Jan', '', '', '', '']);
  assert.equal(railMarker(38000, { lowPhp: 25000, highPhp: 65000 }, 45), 45);
  assert.equal(railMarker(null, { lowPhp: 1, highPhp: 2 }, null), null);
  assert.equal(railMarker(10, { lowPhp: 25, highPhp: 65 }, null), 0);
});
