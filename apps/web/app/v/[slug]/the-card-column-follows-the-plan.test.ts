/**
 * Supplier website by plan (owner-approved 2026-10-30) — slice 3 on the shop page itself: the reach line + ring, the
 * addresses and the pinned review are decided by `lib/shop-page-plan.ts` over the shipped caps, never a local number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('reach comes from shopReach over the effective tier and the shop\'s own ring', () => {
  assert.match(PAGE, /shopReach\(\{\s*verified: vendor\.verification_state === 'verified',\s*tier: effectiveTierState,/);
  assert.match(PAGE, /<ShopReachLine reach=\{reach\}/);
  assert.match(PAGE, /<ShopReachMap\s+reach=\{reach\}/);
  assert.doesNotMatch(PAGE, /serviceRadiusKm/, 'the page reads a radius cap itself — use lib/shop-page-plan.ts');
  assert.match(PAGE, /,outer_radius_km,created_at';/, 'the shop\'s own ring is not fetched');
});

test('the own address is read only on Pro+ and the pinned quote only where review words show', () => {
  assert.match(PAGE, /if \(premiumLayout\) \{\s*const \{ data: domainRow/);
  assert.match(PAGE, /pinnedReviewId && viewerTierCaps\.reviewCommentsViewable &&/);
  assert.match(PAGE, /<ShopAddresses setnayanAddress=\{setnayanAddress\} ownAddress=\{ownAddress\} \/>/);
});
