/**
 * ⭐ The pure halves of the 6 Nov reviews work: the host's "Shown as" (§ 2), a card's own review block (§ 4 / § 9) and
 * the guest hub's "after the day" gate (§ 8, door 2). The database halves live in
 * `tests/db/host-and-guest-reviews.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coupleInitials, parseReviewerDisplay, shownCoupleName } from '@/lib/reviews';
import { buildCardReviews, clipQuote } from '@/lib/card-reviews';
import { isAfterTheDay } from '@/lib/who-made-the-day';
import type { GuestReviewRow } from '@/lib/guest-reviews';

test('Shown as: initials keep the couple, drop the names', () => {
  assert.equal(coupleInitials('Ana & Miguel'), 'A. & M.');
  assert.equal(coupleInitials('Ana and Miguel'), 'A. & M.');
  assert.equal(coupleInitials('Ana + Miguel'), 'A. & M.');
  assert.equal(coupleInitials('Maria Santos'), 'M. S.');
  assert.equal(coupleInitials('   '), null);
  assert.equal(shownCoupleName('Ana & Miguel', 'names'), 'Ana & Miguel');
  assert.equal(shownCoupleName('Ana & Miguel', 'initials'), 'A. & M.');
  assert.equal(shownCoupleName(null, 'initials'), null);
});

test('Shown as: anything but "initials" reads as names (the column default)', () => {
  assert.equal(parseReviewerDisplay('initials'), 'initials');
  assert.equal(parseReviewerDisplay('anonymous'), 'names');
  assert.equal(parseReviewerDisplay(null), 'names');
});

test('a quote is clipped at a word, never mid-word', () => {
  const long = 'word '.repeat(40).trim();
  const q = clipQuote(long, 120)!;
  assert.ok(q.endsWith('…'));
  assert.ok(!q.slice(0, -1).endsWith('wor'));
  assert.equal(clipQuote('  '), null);
});

const guest = (o: Partial<GuestReviewRow>): GuestReviewRow =>
  ({
    review_id: 'g', vendor_profile_id: 'v', event_id: 'e', service_id: 's1', rating_overall: 5, line: 'Lovely',
    capture_id: null, shown_as: 'name', vendor_reply: null, vendor_reply_at: null, hidden_at: null,
    created_at: '2026-12-14T00:00:00Z', shown_name: 'Gabriel D.', service_title: 'Bouquet', ...o,
  }) as GuestReviewRow;

test('a card shows its OWN reviews, hosts and guests apart', () => {
  const m = buildCardReviews({
    serviceIds: ['s1', 's2', 's3'],
    hostStats: new Map([['s1', { count: 2, average: 4.5 }], ['s2', { count: 1, average: 5 }]]),
    guestStats: new Map([['s1', { count: 40, average: 4.9 }]]),
    hostReviews: [
      { service_id: 's1', body: 'Old words', created_at: '2026-01-01T00:00:00Z', couple_display_name: 'A. & M.', booked_through_setnayan: true },
      { review_id: 'hr-new', service_id: 's1', body: 'New words', created_at: '2026-12-01T00:00:00Z', couple_display_name: 'A. & M.', booked_through_setnayan: true },
      { service_id: 's3', body: 'Another card', created_at: '2026-12-02T00:00:00Z', couple_display_name: 'X', booked_through_setnayan: false },
    ],
    guestRows: [guest({ created_at: '2026-12-10T00:00:00Z', line: 'older' }), guest({ line: 'newest' })],
    guestPhotoUrls: new Map(),
    readAllHref: '#guest-reviews',
  });
  const s1 = m.get('s1')!;
  assert.equal(s1.hosts?.quote, 'New words');
  assert.match(s1.hosts?.by ?? '', /^A\. & M\. · /);
  assert.equal(s1.guests?.count, 40);
  assert.equal(s1.guests?.newest?.line, 'newest');
  // 🃏 The shown review's id rides along, so the shop can hide it on this card (`lib/service-card-hides.ts`).
  assert.equal(s1.hosts?.reviewId, 'hr-new');
  assert.equal(s1.guests?.newest?.reviewId, 'g');
  assert.equal(s1.guests?.readAllHref, '#guest-reviews');
  // s2: the number alone — no quote borrowed from another card
  assert.equal(m.get('s2')!.hosts?.quote, null);
  assert.equal(m.get('s2')!.guests, null);
  // s3: no trusted number → no block at all, even with a review row loaded
  assert.equal(m.has('s3'), false);
});

test('a refused stats read draws no line — never "0 reviews"', () => {
  const m = buildCardReviews({
    serviceIds: ['s1'], hostStats: null, guestStats: null,
    hostReviews: [], guestRows: [guest({})], guestPhotoUrls: new Map(), readAllHref: '#guest-reviews',
  });
  assert.equal(m.size, 0);
});

test('"Who made the day?" waits until the day is over', () => {
  assert.equal(isAfterTheDay('2026-12-14', '2026-12-14'), false);
  assert.equal(isAfterTheDay('2026-12-14', '2026-12-15'), true);
  assert.equal(isAfterTheDay('2026-12-14T10:00:00Z', '2026-12-15'), true);
  assert.equal(isAfterTheDay(null, '2026-12-15'), false);
  assert.equal(isAfterTheDay('soon', '2026-12-15'), false);
});
