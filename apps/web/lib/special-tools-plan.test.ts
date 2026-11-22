/**
 * 🎂 SPECIAL TOOLS ARE PRO AND UP (owner, specs DECISION_LOG "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP").
 * Walks the plan ladder in its own order: every plan ranked at or above Pro has the flag, every plan below has not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIER_CAPS, VENDOR_TIERS, tierRank } from './vendor-tier-caps';

test('every plan at or above Pro has special tools; every plan below has not', () => {
  const pro = tierRank('pro');
  assert.ok(VENDOR_TIERS.some((t) => tierRank(t) < pro), 'nothing ranks below Pro — the ladder is wrong');
  for (const tier of VENDOR_TIERS) {
    const rank = tierRank(tier);
    assert.equal(TIER_CAPS[tier].specialTools, rank >= pro, `${tier} (rank ${rank}) has specialTools=${TIER_CAPS[tier].specialTools}`);
  }
});
