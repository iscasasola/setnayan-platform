/**
 * BADGE UPGRADES — the personal half of the approved table (owner 2026-11-06, `lib/badge-upgrades.ts`).
 *
 *   • the table IS the ruling: Verified → Papic Challenges · first booking → 3D Booth · 5 reviews → AI Chatbot ·
 *     Top Pick / Most Booked → any of the three; Rising gives none;
 *   • below Solo the booth becomes Papic Challenges, decided at Start (sabotage: return `choices` unchanged → red);
 *   • nothing is owed for an unread badge, and one award per month gives one upgrade;
 *   • the products and periods are the paid activation's own constants, never typed;
 *   • the booth floor here equals the booth's own floor in lib/seating-3d.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_UPGRADES,
  BADGE_UPGRADE_BOOTH_MIN_TIER,
  BADGE_UPGRADE_PRODUCT,
  startableChoices,
  upgradeKey,
  upgradeLineFor,
  upgradeSourceWords,
  upgradeWords,
  upgradesOwed,
  type BadgeUpgradeRow,
} from './badge-upgrades';
import type { BadgeRewardFacts } from './badge-rewards';
import { BOOTH_BRANDING_MIN_TIER } from './seating-3d';
import { VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS, VENDOR_PHOTO_CHALLENGE_SKU_CODE } from './vendor-photo-challenge';
import { VENDOR_3D_BOOTH_PERIOD_DAYS, VENDOR_3D_BOOTH_SKU_CODE } from './vendor-3d-booth-pricing';
import { VENDOR_AI_ADDON_PERIOD_DAYS, VENDOR_AI_ADDON_SKU_CODE } from './vendor-addon-pricing';

const NONE: BadgeRewardFacts = {
  verified: null,
  completedEvents: null,
  trustedReviews: null,
  firstSourcedBooking: null,
  branchIds: null,
  bookedCardIds: null,
  awards: null,
};

describe('the approved table (6 Nov)', () => {
  it('each badge gives the upgrade the owner approved', () => {
    assert.deepEqual([...BADGE_UPGRADES.verified.choices], ['photo_challenge']);
    assert.deepEqual([...BADGE_UPGRADES.first_booking.choices], ['3d_booth']);
    assert.equal(BADGE_UPGRADES.reviews.step, 5);
    assert.deepEqual([...BADGE_UPGRADES.reviews.choices], ['ai_chatbot']);
    assert.deepEqual([...BADGE_UPGRADES.award.types].sort(), ['most_booked', 'top_pick'], 'Rising gives no upgrade');
    assert.deepEqual([...BADGE_UPGRADES.award.choices], ['photo_challenge', '3d_booth', 'ai_chatbot']);
  });

  it('products and periods are the paid activation’s own constants', () => {
    assert.deepEqual(BADGE_UPGRADE_PRODUCT.photo_challenge, { skuCode: VENDOR_PHOTO_CHALLENGE_SKU_CODE, addon: 'papic_challenge', periodDays: VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS });
    assert.deepEqual(BADGE_UPGRADE_PRODUCT['3d_booth'], { skuCode: VENDOR_3D_BOOTH_SKU_CODE, addon: 'ads_3d_plan', periodDays: VENDOR_3D_BOOTH_PERIOD_DAYS });
    assert.deepEqual(BADGE_UPGRADE_PRODUCT.ai_chatbot, { skuCode: VENDOR_AI_ADDON_SKU_CODE, addon: 'ai_chatbot_basic', periodDays: VENDOR_AI_ADDON_PERIOD_DAYS });
  });

  it('the booth floor is the booth’s own floor', () => {
    assert.equal(BADGE_UPGRADE_BOOTH_MIN_TIER, BOOTH_BRANDING_MIN_TIER);
  });
});

describe('what a shop is owed', () => {
  it('nothing for unread facts — never a guess', () => {
    assert.deepEqual(upgradesOwed(NONE), []);
  });

  it('one upgrade per earned badge, keyed once; 4 reviews earn none; one award per month', () => {
    const owed = upgradesOwed({
      ...NONE,
      verified: true,
      firstSourcedBooking: true,
      trustedReviews: 4,
      awards: [
        { type: 'top_pick', periodMonth: '2026-11-01' },
        { type: 'top_pick', periodMonth: '2026-11-01' },
        { type: 'rising', periodMonth: '2026-11-01' },
        { type: 'most_booked', periodMonth: '2026-10-01' },
      ],
    });
    assert.deepEqual(
      owed.map((o) => o.key),
      ['upgrade:verified', 'upgrade:first_booking', 'upgrade:award:top_pick:2026-11-01', 'upgrade:award:most_booked:2026-10-01'],
    );
    assert.deepEqual(upgradesOwed({ ...NONE, trustedReviews: 5 }).map((o) => o.key), ['upgrade:reviews:5']);
    assert.deepEqual(upgradesOwed({ ...NONE, trustedReviews: 120 }).map((o) => o.key), ['upgrade:reviews:5'], 'more reviews never give a second');
  });

  it('keys are distinct from the gift-stock reward keys', () => {
    assert.equal(upgradeKey('verified'), 'upgrade:verified');
    assert.equal(upgradeKey('reviews', 5), 'upgrade:reviews:5');
    assert.equal(upgradeKey('award', 'most_booked', '2026-11-01T00:00:00Z'), 'upgrade:award:most_booked:2026-11-01');
  });
});

describe('below Solo the 3D Booth becomes Papic Challenges', () => {
  it('first booking', () => {
    assert.deepEqual(startableChoices(['3d_booth'], 'free'), ['photo_challenge']);
    assert.deepEqual(startableChoices(['3d_booth'], 'verified'), ['photo_challenge']);
    assert.deepEqual(startableChoices(['3d_booth'], null), ['photo_challenge'], 'an unread plan never offers the booth');
    assert.deepEqual(startableChoices(['3d_booth'], 'solo'), ['3d_booth']);
    assert.deepEqual(startableChoices(['3d_booth'], 'custom'), ['3d_booth']);
  });
  it('an award’s choice hides the booth below Solo, without a duplicate', () => {
    assert.deepEqual(startableChoices(['photo_challenge', '3d_booth', 'ai_chatbot'], 'verified'), ['photo_challenge', 'ai_chatbot']);
    assert.deepEqual(startableChoices(['photo_challenge', '3d_booth', 'ai_chatbot'], 'pro'), ['photo_challenge', '3d_booth', 'ai_chatbot']);
  });
});

describe('words', () => {
  it('reads like the screen', () => {
    assert.equal(upgradeWords(['photo_challenge']), '4 weeks of Papic Challenges');
    assert.equal(upgradeWords(['photo_challenge', 'ai_chatbot']), '4 weeks of your choice');
    assert.equal(upgradeSourceWords('upgrade:verified'), 'SETNAYAN Verified');
    assert.equal(upgradeSourceWords('upgrade:reviews:5'), '5 reviews');
    assert.equal(upgradeSourceWords('upgrade:award:top_pick:2026-11-01'), 'Top Pick · Nov 2026');
  });
  it('the badge row line says what it unlocks, and whether it waits', () => {
    const ready: BadgeUpgradeRow = {
      upgradeId: 'u1',
      key: 'upgrade:first_booking',
      grantedAt: '2026-11-06T00:00:00Z',
      startable: ['photo_challenge'],
      startedChoice: null,
      startedAt: null,
      endsAt: null,
    };
    assert.equal(upgradeLineFor('first_booking', null, 'solo'), 'Also → 4 weeks of 3D Booth');
    assert.equal(upgradeLineFor('first_booking', null, 'free'), 'Also → 4 weeks of Papic Challenges');
    assert.equal(upgradeLineFor('first_booking', [ready], 'free'), 'Also → 4 weeks of Papic Challenges · ready to start in Plan');
    assert.equal(upgradeLineFor('reviews', [], 'pro'), 'At 5 reviews also → 4 weeks of AI Chatbot');
    assert.equal(upgradeLineFor('award', [], 'pro'), 'Top Pick or Most Booked also → 4 weeks of your choice');
  });
});
