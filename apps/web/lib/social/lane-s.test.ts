/**
 * lane-s.test.ts — the pure rules of BUILD 6 · LANE S (owner 2026-11-10): which badge posts, which shop may be
 * featured, what the post says, and how the milestone numbers are read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BADGE_POST_PRIORITY,
  MILESTONE_CAPTIONS,
  MILESTONE_METRICS,
  badgePostCopy,
  badgePostIsNamed,
  badgeSourceRef,
  isBadgeShopPostable,
  milestoneToCelebrate,
  parseRealCounts,
  pickBadgeToPost,
  vendorIdFromBadgeRef,
  type BadgeShopRow,
} from '@/lib/social/lane-s';

const VID = '3f0c8a52-1b9e-4c55-9a0e-1f2d3c4b5a69';

const LIVE: BadgeShopRow = {
  vendor_profile_id: VID,
  user_id: 'u-1',
  business_name: 'Liwanag Studio',
  business_slug: 'liwanag-studio',
  services: ['photographer'],
  location_city: 'Cebu City',
  hq_region: 'Cebu',
  tier_state: 'pro',
  tier_expires_at: null,
  public_visibility: 'verified',
  verification_state: 'verified',
  is_demo: false,
  social_feature_opt_out: false,
};

/* ── which badge posts ─────────────────────────────────────────────────────── */

test('one sweep posts ONE badge: the most newsworthy, and the highest step of its ladder', () => {
  assert.equal(pickBadgeToPost(['first_review', 'reviews:5', 'reviews:10']), 'reviews:10');
  assert.equal(pickBadgeToPost(['service_cards:3', 'events:50', 'reviews:25']), 'events:50');
  assert.equal(pickBadgeToPost(['events:10', 'award:top_pick:2026-11-01']), 'award:top_pick:2026-11-01');
  assert.equal(
    pickBadgeToPost(['award:rising:2026-10-01', 'award:rising:2026-11-01']),
    'award:rising:2026-11-01',
    'within monthly awards the latest month wins',
  );
});

test('verified never posts as a badge — the vendor_feature sweep already announces it', () => {
  assert.ok(!BADGE_POST_PRIORITY.includes('verified'));
  assert.equal(pickBadgeToPost(['verified']), null);
  assert.equal(pickBadgeToPost(['verified', 'first_booking']), 'first_booking');
});

test('nothing granted, or nothing known, posts nothing', () => {
  assert.equal(pickBadgeToPost([]), null);
  assert.equal(pickBadgeToPost(['upgrade:verified', 'mystery:3']), null);
});

test('the source_ref is deterministic per (supplier, badge step) and gives the supplier back', () => {
  const ref = badgeSourceRef(VID, 'award:top_pick:2026-11-01');
  assert.equal(ref, `${VID}:award:top_pick:2026-11-01`);
  assert.equal(badgeSourceRef(VID, 'award:top_pick:2026-11-01'), ref);
  assert.equal(vendorIdFromBadgeRef(ref), VID);
  assert.equal(vendorIdFromBadgeRef(badgeSourceRef(VID, 'reviews:5')), VID);
});

/* ── which shop may be featured ────────────────────────────────────────────── */

test('a published, real, opted-in shop whose owner is not internal may be featured', () => {
  assert.equal(isBadgeShopPostable(LIVE, false), true);
});

test('never a sample shop, an internal owner, an opted-out shop, or an unpublished one', () => {
  assert.equal(isBadgeShopPostable({ ...LIVE, is_demo: true }, false), false, 'sample (demo) shop');
  assert.equal(isBadgeShopPostable(LIVE, true), false, 'owner is_internal');
  assert.equal(isBadgeShopPostable({ ...LIVE, social_feature_opt_out: true }, false), false, 'opted out');
  assert.equal(isBadgeShopPostable({ ...LIVE, public_visibility: 'hidden' }, false), false, 'not listed');
  assert.equal(isBadgeShopPostable({ ...LIVE, verification_state: 'pending_review' }, false), false, 'not verified');
  assert.equal(isBadgeShopPostable({ ...LIVE, public_visibility: 'archived' }, false), false, 'archived');
});

test('every unknown fails CLOSED', () => {
  assert.equal(isBadgeShopPostable(LIVE, null), false, 'owner unread');
  assert.equal(isBadgeShopPostable(null, false), false, 'shop unread');
  assert.equal(isBadgeShopPostable({ ...LIVE, is_demo: null }, false), false, 'is_demo unread');
  assert.equal(isBadgeShopPostable({ ...LIVE, social_feature_opt_out: null }, false), false, 'opt-out unread');
});

/* ── what the post says ────────────────────────────────────────────────────── */

test('an active Pro / Ultra shop is named; Free and lapsed plans are not (the vendor_feature hybrid)', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(badgePostIsNamed({ tier_state: 'pro', tier_expires_at: null }, now), true);
  assert.equal(badgePostIsNamed({ tier_state: 'enterprise', tier_expires_at: '2026-12-01T00:00:00Z' }, now), true);
  assert.equal(badgePostIsNamed({ tier_state: 'pro', tier_expires_at: '2026-11-01T00:00:00Z' }, now), false);
  assert.equal(badgePostIsNamed({ tier_state: 'free', tier_expires_at: null }, now), false);
});

test('a named post names the shop, the badge in the gifts list\'s words, and links to the shop', () => {
  const copy = badgePostCopy({
    rewardKey: 'events:50',
    named: true,
    businessName: 'Liwanag Studio',
    businessSlug: 'liwanag-studio',
    categoryLabel: 'Photographer',
    region: 'Cebu',
    origin: 'https://www.setnayan.com/',
  });
  assert.match(copy.body, /Liwanag Studio/);
  assert.match(copy.body, /50 events/);
  assert.equal(copy.linkUrl, 'https://www.setnayan.com/v/liwanag-studio');
  assert.match(copy.body, /#Setnayan/);
  assert.match(copy.title, /^Liwanag Studio · 50 events/);
});

test('an unnamed post never carries the shop name — category and region only', () => {
  const copy = badgePostCopy({
    rewardKey: 'reviews:25',
    named: false,
    businessName: 'Liwanag Studio',
    businessSlug: 'liwanag-studio',
    categoryLabel: 'Photographer',
    region: 'Cebu',
    origin: 'https://www.setnayan.com',
  });
  assert.doesNotMatch(copy.body + copy.title + copy.linkUrl, /Liwanag|liwanag/);
  assert.match(copy.body, /a photographer in Cebu/);
  assert.match(copy.body, /25 reviews/);
  assert.equal(copy.linkUrl, 'https://www.setnayan.com/vendors');
});

test('a monthly award is named by its award and month', () => {
  const copy = badgePostCopy({
    rewardKey: 'award:top_pick:2026-11-01',
    named: true,
    businessName: 'Liwanag Studio',
    businessSlug: null,
    categoryLabel: 'Photographer',
    region: 'Cebu',
    origin: 'https://www.setnayan.com',
  });
  assert.match(copy.body, /Top Pick · Nov 2026/);
  assert.equal(copy.linkUrl, 'https://www.setnayan.com/vendors', 'no slug → the marketplace, never a broken /v/ link');
});

/* ── milestones ────────────────────────────────────────────────────────────── */

test('users_joined is a milestone metric with its own caption', () => {
  assert.deepEqual([...MILESTONE_METRICS], ['events_created', 'vendors_verified', 'guests_invited', 'users_joined']);
  assert.match(MILESTONE_CAPTIONS.users_joined(1000), /1,000\+ people have joined Setnayan/);
});

test('the real counts are read strictly — anything not a count is null, never 0', () => {
  assert.deepEqual(parseRealCounts({ events_created: 12, vendors_verified: 0, guests_invited: '480', users_joined: 31 }), {
    events_created: 12,
    vendors_verified: 0,
    guests_invited: 480,
    users_joined: 31,
  });
  assert.deepEqual(parseRealCounts(null), {
    events_created: null,
    vendors_verified: null,
    guests_invited: null,
    users_joined: null,
  });
  const odd = parseRealCounts({ events_created: -1, vendors_verified: 2.5, guests_invited: 'many' });
  assert.deepEqual(odd, { events_created: null, vendors_verified: null, guests_invited: null, users_joined: null });
});

test('only the highest crossed rung is celebrated, once', () => {
  const none = new Set<string>();
  assert.equal(milestoneToCelebrate('users_joined', 9, none), null);
  assert.equal(milestoneToCelebrate('users_joined', 10, none), 10);
  assert.equal(milestoneToCelebrate('users_joined', 260, none), 250);
  assert.equal(milestoneToCelebrate('users_joined', 260, new Set(['users_joined:250'])), null);
  assert.equal(milestoneToCelebrate('users_joined', 260, new Set(['events_created:250'])), 250, 'watermarks are per metric');
  assert.equal(milestoneToCelebrate('users_joined', null, none), null, 'an unread count is skipped');
});
