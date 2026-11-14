/**
 * 🏅💌 "You earned …" — the owner's warm copy, verbatim (controller build map 2026-11-15, "Make the suppliers feel
 * loved"), and ONE notice per sweep. Sabotage seen red: swap "tap to claim it" for "claim it" → red; pick the first
 * paid instead of the highest tier → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_EARNED_HREF, badgeEarnedNotice, pickBadgeToTell } from './badge-earned';

const BODY = (r: string) =>
  `Every family you served got you here. Thank you for making their day. Your ${r} is waiting — tap to claim it.`;

test('a laddered badge: "You earned {Tier} {Badge}, {Shop}!" and the body verbatim', () => {
  const n = badgeEarnedNotice({ key: 'events:100', badge: 'events', tier: 'tier3', shopName: 'Lumen Studio', reward: 'Papic 1000' });
  assert.equal(n.title, 'You earned Gold Events, Lumen Studio!');
  assert.equal(n.body, BODY('Papic 1000'));
  assert.equal(
    badgeEarnedNotice({ key: 'trusted_by:5', badge: 'trusted_by', tier: 'tier2', shopName: 'Lumen', reward: 'Papic 150' }).title,
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

test('it opens where the reward waits to be claimed', () => {
  assert.equal(BADGE_EARNED_HREF, '/vendor-dashboard/shop/promote#gifts');
});
