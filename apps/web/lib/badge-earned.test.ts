/**
 * 🏅💌 "You earned …" — the owner's warm copy (controller build map 2026-11-15, "Make the suppliers feel loved"), and
 * ONE notice per sweep. Since the reward is claimed AUTOMATICALLY (e5ec685d pick 2) the body says it is in the shop's
 * gifts, the button is "See it", and it opens Today — never Shop › Promote. Sabotage seen red: put "tap to claim" back
 * → red; point the notice at /shop/promote → red; pick the first paid instead of the highest tier → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_EARNED_CTA, BADGE_EARNED_HREF, badgeEarnedNotice, pickBadgeToTell } from './badge-earned';

const BODY = (r: string) =>
  `Every family you served got you here. Thank you for making their day. Your ${r} is in your gifts.`;

test('a laddered badge: "You earned {Tier} {Badge}, {Shop}!" and the body verbatim', () => {
  const n = badgeEarnedNotice({ key: 'completed_bookings:tier3', badge: 'completed_bookings', tier: 'tier3', shopName: 'Lumen Studio', reward: 'Papic 1000' });
  assert.equal(n.title, 'You earned Gold Completed bookings, Lumen Studio!');
  assert.doesNotMatch(n.body, /tap to claim/i, 'the reward is claimed automatically — nothing to tap');
  assert.equal(n.body, BODY('Papic 1000'));
  assert.equal(
    badgeEarnedNotice({ key: 'trusted_by:tier2', badge: 'trusted_by', tier: 'tier2', shopName: 'Lumen', reward: 'Papic 150' }).title,
    'You earned Silver Trusted by, Lumen!',
  );
});

test('a once-badge and an award have no tier; a nameless shop is not given a stand-in name', () => {
  assert.equal(badgeEarnedNotice({ key: 'verified', badge: 'verified', shopName: 'Lumen', reward: 'Papic 150' }).title, 'You earned SETNAYAN Verified, Lumen!');
  assert.equal(
    badgeEarnedNotice({ key: 'award:most_booked:2026-11-01', badge: 'award', shopName: '  ', reward: 'Event Plus' }).title,
    'You earned Most Booked!',
  );
});

test('one notice per sweep: the highest tier it paid', () => {
  assert.equal(pickBadgeToTell([]), null);
  const paid = [{ key: 'first_review' }, { key: 'reviews:5', tier: 'tier1' as const }, { key: 'trusted_by:10', tier: 'tier3' as const }];
  assert.equal(pickBadgeToTell(paid)!.key, 'trusted_by:10');
  const onceOnly: { key: string; tier?: 'tier1' }[] = [{ key: 'verified' }];
  assert.equal(pickBadgeToTell(onceOnly)!.key, 'verified');
});

test('it opens Today, where the award plays — never Shop › Promote — and its button is "See it"', () => {
  assert.equal(BADGE_EARNED_HREF, '/vendor-dashboard');
  assert.doesNotMatch(BADGE_EARNED_HREF, /promote/);
  assert.equal(BADGE_EARNED_CTA, 'See it');
});

test('the five shop badges carry their names exactly (a33fd894) — never "Events", "Reviews" or "Gift points"', () => {
  for (const [badge, name] of [
    ['completed_bookings', 'Completed bookings'],
    ['five_star_reviews', 'Five-star reviews'],
    ['gifts_given', 'Gifts given'],
    ['trusted_by', 'Trusted by'],
    ['invites', 'Invites'],
  ] as const) {
    const t = badgeEarnedNotice({ key: `${badge}:tier1`, badge, tier: 'tier1', shopName: null, reward: 'Papic 150' }).title;
    assert.equal(t, `You earned Bronze ${name}!`);
  }
});
