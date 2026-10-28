/**
 * 🏅 The badges say only what the shipped rules decide (lib/shop-badges.ts). Each assertion below was broken on purpose
 * once and seen red before this file was committed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeTracker,
  badgesForPrint,
  earnedKeys,
  milestoneLadder,
  newlyEarned,
  nextToEarnLine,
  shopBadges,
  trackerSummary,
  type ShopBadgeFacts,
} from './shop-badges';
import { MILESTONE_THRESHOLDS } from './service-card-record';

const base: ShopBadgeFacts = {
  verified: true,
  completedEvents: 96,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 31 },
  inBusinessSinceYear: 2014,
  awards: [],
  nowYear: 2026,
};

test('a 0.0 rating draws no badge — no reviews, no ★', () => {
  for (const trusted of [
    { trusted_avg_rating: 0, trusted_review_count: 0 },
    { trusted_avg_rating: 0, trusted_review_count: 3 },
    { trusted_avg_rating: 4.5, trusted_review_count: 0 },
    null,
  ]) {
    const kinds = shopBadges({ ...base, trusted }).map((b) => b.kind);
    assert.ok(!kinds.includes('rating'), `a ★ badge was drawn for ${JSON.stringify(trusted)}`);
  }
  const r = shopBadges(base).find((b) => b.kind === 'rating');
  assert.equal(r?.line1, '4.8 STARS');
  assert.equal(r?.line2, '31 REVIEWS');
});

test('a voided booking drops a medal — the medal is a pure function of the count, never stored', () => {
  const at50 = shopBadges({ ...base, completedEvents: 50 }).find((b) => b.kind === 'milestone');
  assert.equal(at50?.glyph, '50');
  assert.equal(at50?.tier, 'tier2');
  // One of the fifty is voided: the view no longer counts it, and the medal steps down on the next read — its
  // material steps down with it.
  const at49 = shopBadges({ ...base, completedEvents: 49 }).find((b) => b.kind === 'milestone');
  assert.equal(at49?.glyph, '10');
  assert.equal(at49?.tier, 'tier1');
  assert.ok(!earnedKeys({ ...base, completedEvents: 49 }).includes('milestone:50'));
  // Below the first rung: no medal at all.
  assert.equal(shopBadges({ ...base, completedEvents: 9 }).find((b) => b.kind === 'milestone'), undefined);
  // An unread count claims nothing either way.
  assert.equal(shopBadges({ ...base, completedEvents: null }).find((b) => b.kind === 'milestone'), undefined);
});

test('Next to earn uses the shipped thresholds — never a new number', () => {
  assert.deepEqual([...MILESTONE_THRESHOLDS], [10, 50, 100, 500, 1000, 5000, 10000]);
  assert.equal(nextToEarnLine(96), 'Next to earn: 100 events · Gold · 4 to go');
  assert.equal(nextToEarnLine(0), 'Next to earn: 10 events · Bronze · 10 to go');
  assert.equal(nextToEarnLine(25), 'Next to earn: 50 events · Silver · 25 to go');
  assert.equal(nextToEarnLine(100), 'Next to earn: 500 events · Platinum · 400 to go');
  assert.equal(nextToEarnLine(4200), 'Next to earn: 5,000 events · Ruby · 800 to go');
  assert.equal(nextToEarnLine(10000), null, 'there is no rung above 10,000');
  assert.equal(nextToEarnLine(null), null);
  for (let n = 0; n <= 12000; n += 7) {
    const l = milestoneLadder(n);
    if (l.next !== null) assert.ok((MILESTONE_THRESHOLDS as readonly number[]).includes(l.next), `next ${l.next} is not a shipped threshold`);
    if (l.earned !== null) assert.ok((MILESTONE_THRESHOLDS as readonly number[]).includes(l.earned));
  }
});

test('the tracker: Earned / N to go / Live — and the rating carries NO bar and NO goal', () => {
  const rows = badgeTracker({ ...base, unreviewed: 3 });
  const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
  assert.equal(by.verified!.stateWord, 'Earned');
  assert.equal(by.milestone!.line, '96 of 100 → next badge: 100 events · Gold');
  assert.equal(by.milestone!.stateWord, '4 to go');
  assert.equal(by.milestone!.bar, 96);
  assert.equal(by.milestone!.door?.href, '/vendor-dashboard/customers?lane=waiting#customers');
  assert.equal(by.rating!.stateWord, 'Live');
  assert.equal(by.rating!.bar, undefined, 'a rating has no ruling target, so no bar');
  assert.match(by.rating!.line, /★ 4\.8 from 31 · 3 couples haven’t reviewed yet/);
  assert.equal(by.rating!.door?.label, 'Ask for reviews');
  assert.equal(by.years!.stateWord, 'Earned');
  assert.equal(by.years!.line, 'Since 2014 · grows by itself each year');
});

test('a refused read says so — never "0 of 10", never "No reviews yet"', () => {
  const rows = badgeTracker({ ...base, completedEvents: null, trusted: null, unreviewed: null });
  const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
  assert.equal(by.milestone!.state, 'unread');
  assert.equal(by.rating!.state, 'unread');
  assert.doesNotMatch(by.milestone!.line, /0 of/);
});

test('print takes the badges as they are on the day — the same list the page draws', () => {
  assert.deepEqual(badgesForPrint(base), shopBadges(base));
  assert.deepEqual(
    badgesForPrint(base).map((b) => b.key),
    ['verified', 'milestone:50', 'rating', 'years'],
  );
  assert.deepEqual(badgesForPrint({ ...base, verified: false, completedEvents: 1001 }).map((b) => b.key), ['milestone:1000', 'rating', 'years']);
  const k = badgesForPrint({ ...base, completedEvents: 10000 }).find((b) => b.kind === 'milestone');
  assert.equal(k?.glyph, '10K');
  assert.equal(k?.line1, '10,000 EVENTS');
  assert.equal(k?.line2, 'BLACK DIAMOND · ON SETNAYAN', 'the approved name sits under the number');
});

test('awards wear the pill in their own words', () => {
  const b = shopBadges({ ...base, awards: ["Setnayan's Top Pick", 'Most Booked'] }).filter((x) => x.kind === 'award');
  assert.deepEqual(b.map((x) => [x.line1, x.line2]), [['SETNAYAN', 'TOP PICK'], ['SETNAYAN', 'MOST BOOKED']]);
});

test('years: none in the first year, none without a year', () => {
  assert.equal(shopBadges({ ...base, inBusinessSinceYear: 2026 }).find((b) => b.kind === 'years'), undefined);
  assert.equal(shopBadges({ ...base, inBusinessSinceYear: null }).find((b) => b.kind === 'years'), undefined);
  assert.equal(shopBadges(base).find((b) => b.kind === 'years')?.glyph, '12');
});

test('newly earned: the highest new milestone, once; dismissed keys keep it quiet until the next rung', () => {
  const f = { ...base, completedEvents: 50 };
  const first = newlyEarned(f, []);
  assert.equal(first?.key, 'milestone:50');
  assert.equal(first?.sentence, 'You earned 50 events · Silver ✓ — your tarp and card can show it');
  assert.equal(newlyEarned(f, first!.keys), null, 'dismissed — nothing new');
  const later = newlyEarned({ ...base, completedEvents: 100 }, first!.keys);
  assert.equal(later?.key, 'milestone:100');
  assert.equal(newlyEarned({ ...base, completedEvents: 99 }, first!.keys), null, 'no "within reach" line — only earned');
  // A rating never announces itself as "earned".
  assert.ok(!earnedKeys(base).includes('rating'));
});

test('the fold line', () => {
  assert.equal(trackerSummary(base), 'Verified · 50 events · ★ 4.8 · next: 100 events');
  assert.equal(trackerSummary({ ...base, verified: false, completedEvents: 0, trusted: null, awards: [] }), 'next: 10 events');
});
