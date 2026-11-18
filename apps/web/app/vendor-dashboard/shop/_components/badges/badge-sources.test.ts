/**
 * badge-sources.test.ts — 🔌 J4's ONE ADAPTER and the badge page's claims (controller 15 Nov 2026; prototype
 * `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`).
 *
 *   (1) the mirror of J0's ladder is not a second source: the day `lib/badge-tiers.ts` exports the five badges' steps,
 *       keys or the seven tier names, they must equal the adapter's — or this fails, and the adapter becomes one line;
 *   (2) only the adapter reaches into the parallel jobs' helpers — no page file imports them directly;
 *   (3) the five badges, exactly, and seven tiers Bronze → Black Diamond;
 *   (4) an award fact names the STEP REACHED, never the running count;
 *   (5) locked says what it takes; an unread count says so — never locked, never zero;
 *   (6) the page says what does not count (owner 16 Nov): imports, and gifts a badge reward paid for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS, tierName } from './badge-sources';
import { BADGE_WORDS, awardFact, badgeCard, badgePage } from './badge-page-model';

const HERE = __dirname;
const WEB = join(HERE, '..', '..', '..', '..', '..');

test('(1) the J0 mirror equals lib/badge-tiers.ts the day it exports the same names', async () => {
  const tiers = (await import('@/lib/badge-tiers')) as Record<string, unknown>;
  if ('SHOP_BADGE_STEPS' in tiers) assert.deepEqual(tiers.SHOP_BADGE_STEPS, SHOP_BADGE_STEPS, 'J0 landed with different steps — make the adapter one line');
  if ('SHOP_BADGE_KEYS' in tiers) assert.deepEqual(tiers.SHOP_BADGE_KEYS, SHOP_BADGE_KEYS, 'J0 landed with different badge keys');
  if (typeof tiers.tierName === 'function') {
    for (const k of TIER_KEYS) assert.equal((tiers.tierName as (k: string) => string)(k), tierName(k), `J0 names ${k} differently`);
  }
});

test('(2) only the adapter reaches into the parallel jobs’ helpers', () => {
  const others = readdirSync(HERE).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'badge-sources.ts');
  assert.ok(others.length > 0, 'anti-vacuity: no badge page file to check');
  for (const f of others) {
    const src = stripComments(readFileSync(join(HERE, f), 'utf8'));
    assert.doesNotMatch(src, /from '@\/lib\/(badge-tiers|badge-earned|award-queue|gift-points|badge-seals?|card-badges?)'/, `${f} imports a parallel job's helper past the adapter`);
  }
  assert.ok(existsSync(join(WEB, 'app/vendor-dashboard/shop/_components/badges/badge-sources.ts')));
});

test('(3) the five badges, exactly, and seven tiers Bronze → Black Diamond', () => {
  assert.deepEqual(badgePage({}).map((c) => c.name), ['Completed bookings', 'Five-star reviews', 'Gifts given', 'Trusted by', 'Invites']);
  assert.deepEqual(TIER_KEYS.map(tierName), ['Bronze', 'Silver', 'Gold', 'Ruby', 'Emerald', 'Diamond', 'Black Diamond']);
  for (const k of SHOP_BADGE_KEYS) assert.equal(SHOP_BADGE_STEPS[k].length, 7, `${k} does not have seven tiers`);
});

test('(4) an award fact names the step reached, never the running count', () => {
  const c = badgeCard('completed_bookings', 63);
  assert.equal(c.state, 'earned');
  assert.equal(c.line, 'Gold · 50 bookings');
  assert.doesNotMatch(c.line, /63/, 'the running count leaked into the award');
  assert.equal(awardFact('gifts_given', 'tier7'), 'Black Diamond · 20,000 points');
  assert.equal(badgeCard('trusted_by', 1).line, 'Bronze · 1 client');
  if (c.state === 'earned') assert.equal(c.next, 'Ruby at 100 bookings');
  const top = badgeCard('invites', 999);
  assert.equal(top.state === 'earned' ? top.next : 'x', null, 'Black Diamond offers a tier past itself');
});

test('(5) locked says what it takes; unread says so — never locked, never zero', () => {
  assert.deepEqual(badgeCard('completed_bookings', 4), { key: 'completed_bookings', name: 'Completed bookings', state: 'locked', line: 'Bronze at 5 bookings' });
  assert.equal(badgeCard('invites', 0).line, 'Bronze when 1 supplier you added has a completed booking');
  const unread = badgeCard('five_star_reviews', null);
  assert.equal(unread.state, 'unread');
  assert.doesNotMatch(unread.line, /\b0\b|Bronze at/, 'an unread count reads as zero or as locked');
});

test('(6) the page says what does not count: imports, and gifts a badge reward paid for', () => {
  assert.match(BADGE_WORDS.completed_bookings.counts, /Bookings you import don’t count\./, 'imported bookings read as counting');
  assert.match(BADGE_WORDS.gifts_given.counts, /A gift your badge reward paid for doesn’t count\./, 'a reward-paid gift reads as counting');
});
