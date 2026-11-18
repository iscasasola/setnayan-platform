/** 🏅 Today's earned line announces only the approved badges (lib/badge-earned-news.ts) — owner 17 Nov "old badges". */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { awardNews, isApprovedAward } from './badge-earned-news';

const at = (d: number) => `2026-11-${String(d).padStart(2, '0')}T00:00:00Z`;

test('only Verified and the five badges’ tiers are news; the newest unseen leads', () => {
  assert.equal(isApprovedAward({ key: 'events:10' }), false);
  assert.equal(isApprovedAward({ key: 'booked_loop:3' }), false);
  assert.equal(isApprovedAward({ key: 'award:most-booked' }), false);
  assert.equal(isApprovedAward({ key: 'gifts_given:tier2' }), true);
  const q = [
    { kind: 'seal' as const, key: 'verified', title: 'SETNAYAN Verified', earnedAt: at(1) },
    { kind: 'badge' as const, key: 'completed_bookings:tier3', title: 'Gold Completed bookings', earnedAt: at(9) },
    { kind: 'badge' as const, key: 'events:10', title: 'Events 10', earnedAt: at(12) },
  ];
  const n = awardNews(q, [])!;
  assert.equal(n.key, 'completed_bookings:tier3');
  assert.equal(n.sentence, 'Earned: Gold Completed bookings');
  assert.deepEqual(n.art, { kind: 'tier', src: '/badges/v84/calendar-3.webp' });
  assert.ok(!n.keys.includes('events:10'));
  assert.equal(awardNews(q, n.keys), null, 'a seen award is news again');
  assert.equal(awardNews(null, []), null, 'an unread queue is news');
  assert.equal(awardNews(q, ['completed_bookings:tier3'])!.key, 'verified');
});

test('every sentence is one short line', () => {
  const n = awardNews([{ kind: 'badge', key: 'five_star_reviews:tier7', title: 'Black Diamond Five-star reviews', earnedAt: at(1) }], [])!;
  assert.ok(n.sentence.length <= 40, n.sentence);
});

test('the line no longer announces the old shelf', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/vendor-dashboard/_components/badge-earned-line.tsx'), 'utf8'));
  assert.doesNotMatch(src, /newlyEarned|ShopBadgePill/, 'the line still reads the retired badges');
  assert.match(src, /awardNews\(/);
});
