import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as suppliers from '@/app/for-suppliers/_components/supplier-front-data';
import * as coordinators from '@/app/(shell)/for-coordinators/_facts';
import { GROW_TIERS } from '@/app/for-suppliers/_components/supplier-front-data';

/**
 * /for-suppliers AND /for-coordinators SAY THE SAME PLAN CAPS (Controller, 14 Nov 2026, ahead of the owner's ads).
 *
 * An outside read claimed the two pages disagree on reach, categories, service cards, team seats and branches. Measured
 * that day: they DO NOT — both lines are built from `TIER_CAPS` (lib/vendor-tier-caps.ts), and every plan's spec and
 * the reach ladder render byte-for-byte the same. But each page carries its OWN copy of the helpers
 * (`supplier-front-data.ts` and `for-coordinators/_facts.ts`), so a wording or rounding fix made on one page alone
 * would split them silently. This guard fails the day they diverge.
 *
 * SABOTAGE: change `many()`/`countNoun()`, the reach words, or the branch/waiting-list rule on one side only → RED.
 */

test('Free and Verified read the same on both pages', () => {
  assert.equal(coordinators.freeSpec(), suppliers.freeSpec());
  assert.equal(coordinators.verifiedSpec(), suppliers.verifiedSpec());
});

test('every paid plan reads the same caps on both pages', () => {
  assert.ok(GROW_TIERS.length >= 3, 'the paid ladder shrank — re-point this guard');
  for (const t of GROW_TIERS) {
    assert.equal(coordinators.growSpec(t), suppliers.growSpec(t), `${t}: the two pages disagree`);
  }
});

test('the search-reach ladder reads the same on both pages', () => {
  assert.equal(coordinators.reachLadderSentence(), suppliers.reachSentence());
});
