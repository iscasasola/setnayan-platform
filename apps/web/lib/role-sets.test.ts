import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEDDING_ROLE_SET,
  GENERIC_ROLE_SET,
  SIMPLE_ROLE_SET,
  resolveRoleSet,
} from './role-sets';
import { roleTier, ROLE_TIER_LABELS } from './seating';

// --- resolveRoleSet routing ------------------------------------------------
test('resolveRoleSet routes wedding → wedding, simple → simple, everything else → generic', () => {
  assert.equal(resolveRoleSet('wedding'), WEDDING_ROLE_SET);
  assert.equal(resolveRoleSet('generic'), GENERIC_ROLE_SET);
  assert.equal(resolveRoleSet('simple'), SIMPLE_ROLE_SET);
  assert.equal(resolveRoleSet(null), GENERIC_ROLE_SET);
  assert.equal(resolveRoleSet(undefined), GENERIC_ROLE_SET);
  assert.equal(resolveRoleSet('birthday'), GENERIC_ROLE_SET); // no row yet → generic
});

// --- SIMPLE_ROLE_SET: a single flat 'guest' role ---------------------------
test('SIMPLE_ROLE_SET offers only guest and has no tiers/singletons', () => {
  assert.deepEqual(SIMPLE_ROLE_SET.offeredRoles, ['guest']);
  assert.deepEqual(SIMPLE_ROLE_SET.selfClaimableRoles, ['guest']);
  assert.deepEqual(SIMPLE_ROLE_SET.singletonRoles, []);
  assert.equal(SIMPLE_ROLE_SET.tier1Roles.size, 0);
  assert.equal(SIMPLE_ROLE_SET.tier2Roles.size, 0);
  assert.equal(SIMPLE_ROLE_SET.tier3Roles.size, 0);
  assert.equal(SIMPLE_ROLE_SET.coupleRoles.size, 0);
  // No ROLE promotes anyone (all tier sets empty), so guests fall to tier 4 —
  // except the universal group_category==='family' → tier 3 rule in roleTier,
  // which is role-set-independent (same as wedding/generic).
  assert.equal(roleTier('guest', 'friends', SIMPLE_ROLE_SET), 4);
  assert.equal(roleTier('guest', 'family', SIMPLE_ROLE_SET), 3);
});

// --- WEDDING_ROLE_SET byte-identity anchors --------------------------------
test('WEDDING_ROLE_SET reproduces the pre-0053 wedding role data', () => {
  // Picker: 24 roles, 'guest' first, includes the couple.
  assert.equal(WEDDING_ROLE_SET.offeredRoles.length, 24);
  assert.equal(WEDDING_ROLE_SET.offeredRoles[0], 'guest');
  assert.ok(WEDDING_ROLE_SET.offeredRoles.includes('bride'));
  assert.ok(WEDDING_ROLE_SET.offeredRoles.includes('groom'));
  // Self-claim: 18 roles, excludes couple + the 4 VIP-family roles.
  assert.equal(WEDDING_ROLE_SET.selfClaimableRoles.length, 18);
  for (const excluded of [
    'bride',
    'groom',
    'bride_parents',
    'groom_parents',
    'bride_immediate_family',
    'groom_immediate_family',
  ]) {
    assert.ok(!WEDDING_ROLE_SET.selfClaimableRoles.includes(excluded as never));
  }
  // Singletons + tier labels verbatim.
  assert.deepEqual(WEDDING_ROLE_SET.singletonRoles, ['bride', 'groom']);
  assert.equal(WEDDING_ROLE_SET.tierLabels[1], 'Family & principal sponsors');
  assert.equal(WEDDING_ROLE_SET.tierLabels[2], 'Entourage');
  assert.equal(WEDDING_ROLE_SET.tierLabels[3], 'Extended family');
  assert.equal(WEDDING_ROLE_SET.tierLabels[4], 'Friends & others');
  // Tier sets: spot-check membership + the empty tier3 invariant.
  assert.ok(WEDDING_ROLE_SET.tier1Roles.has('principal_sponsor'));
  assert.ok(WEDDING_ROLE_SET.tier1Roles.has('bride_parents'));
  assert.ok(WEDDING_ROLE_SET.tier2Roles.has('bridesmaid'));
  assert.equal(WEDDING_ROLE_SET.tier3Roles.size, 0);
  assert.deepEqual([...WEDDING_ROLE_SET.coupleRoles].sort(), ['bride', 'groom']);
});

test('seating ROLE_TIER_LABELS is the wedding labels (re-export unchanged)', () => {
  assert.deepEqual(ROLE_TIER_LABELS, WEDDING_ROLE_SET.tierLabels);
});

// --- roleTier with the wedding (default) set: byte-identical ---------------
test('roleTier default (wedding) tiers are unchanged', () => {
  assert.equal(roleTier('principal_sponsor', 'family'), 1);
  assert.equal(roleTier('bridesmaid', 'friends'), 2);
  assert.equal(roleTier('guest', 'family'), 3); // group_category drives tier 3
  assert.equal(roleTier('guest', 'friends'), 4);
});

// --- roleTier with the generic set -----------------------------------------
test('roleTier with the generic set tiers host/vip→1, family→3, rest→4', () => {
  const g = GENERIC_ROLE_SET;
  assert.equal(roleTier('host', 'friends', g), 1);
  assert.equal(roleTier('vip', 'friends', g), 1);
  // 'family' role lands in tier 3 via tier3Roles WITHOUT a family group_category.
  assert.equal(roleTier('family', 'friends', g), 3);
  // group_category 'family' still maps to tier 3 too.
  assert.equal(roleTier('guest', 'family', g), 3);
  assert.equal(roleTier('helper', 'friends', g), 4);
  assert.equal(roleTier('guest', 'friends', g), 4);
});
