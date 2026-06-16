/**
 * Unit suite for the multi-pick data-loss GUARD decision (`replacesSiblingsOnPin`).
 *
 * The invariant this file exists to defend: pinning a vendor into a MULTI-pick
 * category (Look / Booths / Prints) must NEVER clear that category's other picks.
 * If a refactor ever makes a multi-pick group "replace", a couple loses every
 * other photographer / booth / print they had pinned — the exact data-loss bug
 * these tests stand guard against.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replacesSiblingsOnPin } from './build-pick-rules';
import { PLAN_GROUPS, isMultiPickGroup, MULTI_PICK_FOLDERS } from './wedding-plan-groups';

test('multi-pick categories NEVER replace siblings (the data-loss guard)', () => {
  const multiPickGroups = PLAN_GROUPS.filter((g) => MULTI_PICK_FOLDERS.has(g.catalogFolder));
  // Sanity: the multi-pick folders must actually map to live plan groups, or the
  // guard would be guarding nothing.
  assert.ok(multiPickGroups.length > 0, 'expected at least one live multi-pick plan group');
  for (const g of multiPickGroups) {
    assert.equal(
      replacesSiblingsOnPin(g.id),
      false,
      `multi-pick group "${g.id}" (${g.catalogFolder}) must KEEP its other picks`,
    );
  }
});

test('single-pick categories replace siblings (one vendor per category)', () => {
  const singlePickGroups = PLAN_GROUPS.filter((g) => !MULTI_PICK_FOLDERS.has(g.catalogFolder));
  assert.ok(singlePickGroups.length > 0, 'expected single-pick plan groups');
  for (const g of singlePickGroups) {
    assert.equal(
      replacesSiblingsOnPin(g.id),
      true,
      `single-pick group "${g.id}" (${g.catalogFolder}) must REPLACE on pin`,
    );
  }
});

test('decision is exactly the inverse of isMultiPickGroup for every plan group', () => {
  for (const g of PLAN_GROUPS) {
    assert.equal(
      replacesSiblingsOnPin(g.id),
      !isMultiPickGroup(g.id),
      `mismatch for "${g.id}"`,
    );
  }
});

test('the multi-pick folder set is exactly {look, booths, prints} (locked)', () => {
  // Locked deliberately: widening the multi-pick set means more categories where
  // a stray replace would lose data, so adding a folder here should be a
  // conscious change that updates this assertion.
  assert.deepEqual([...MULTI_PICK_FOLDERS].sort(), ['booths', 'look', 'prints']);
});

test('unknown group ids default to the conservative single-pick (replace) behavior', () => {
  assert.equal(replacesSiblingsOnPin('not-a-real-group'), true);
  assert.equal(replacesSiblingsOnPin(''), true);
});
