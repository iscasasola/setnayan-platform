/**
 * Unit suite for the schedule seed engine — specifically the overlay-aware
 * Tea-ceremony (敬茶) injection for Chinese / Chinese-overlay weddings.
 *
 * The whole point: a couple expresses a Chinese wedding EITHER as the primary
 * rite (`ceremony_type='chinese'`) OR — far more common for Tsinoy couples — as
 * a church/civil PRIMARY plus `secondary_ceremony_type='chinese'`. The seed used
 * to see only the primary column, so the overlay case never got a tea beat.
 * These tests pin both paths AND assert non-Chinese seeds are unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildScheduleSeed, type SeedCeremonyType } from './schedule';

const TEA = 'Tea ceremony (敬茶)';
const EVENT_DATE = '2026-12-12';
const DUMMY_PARENTS = { ceremony: 'ceremony-uuid', reception: 'reception-uuid' };

/** Labels of the ceremony-parent children for a given seed call. */
function ceremonyPartLabels(
  ceremonyType: SeedCeremonyType | null,
  overlay?: { ceremony_type?: string | null; secondary_ceremony_type?: string | null } | null,
): string[] {
  const seed = buildScheduleSeed(ceremonyType, EVENT_DATE, overlay);
  return seed
    .buildChildren(DUMMY_PARENTS)
    .filter((c) => c.parent_key === 'ceremony')
    .map((c) => c.label);
}

test('buildScheduleSeed: chinese PRIMARY rite includes a Tea-ceremony beat', () => {
  const labels = ceremonyPartLabels('chinese', {
    ceremony_type: 'chinese',
    secondary_ceremony_type: null,
  });
  assert.ok(labels.includes(TEA), `chinese primary spine should contain "${TEA}"`);
});

test('buildScheduleSeed: catholic PRIMARY + chinese SECONDARY (overlay) injects the Tea beat', () => {
  const labels = ceremonyPartLabels('catholic', {
    ceremony_type: 'catholic',
    secondary_ceremony_type: 'chinese',
  });
  assert.ok(labels.includes(TEA), `overlay should inject "${TEA}" into the Catholic spine`);
  // The Catholic spine must remain intact — the tea beat is ADDED, not a swap.
  assert.ok(labels.includes('Homily'), 'Catholic liturgy parts must be preserved');
  assert.ok(labels.includes('Vows + ring exchange'), 'Catholic vows must be preserved');
  // Injected right after the vows/ring exchange.
  assert.equal(labels[labels.indexOf('Vows + ring exchange') + 1], TEA);
});

test('buildScheduleSeed: civil PRIMARY + chinese SECONDARY (overlay) injects the Tea beat', () => {
  const labels = ceremonyPartLabels('civil', {
    ceremony_type: 'civil',
    secondary_ceremony_type: 'chinese',
  });
  assert.ok(labels.includes(TEA), `overlay should inject "${TEA}" into the civil spine`);
  assert.ok(labels.includes('Welcome by judge or registrar'), 'civil spine must be preserved');
});

test('buildScheduleSeed: chinese-overlay never DOUBLE-adds the tea beat', () => {
  const labels = ceremonyPartLabels('catholic', {
    ceremony_type: 'catholic',
    secondary_ceremony_type: 'chinese',
  });
  assert.equal(
    labels.filter((l) => l === TEA).length,
    1,
    'exactly one tea beat in the overlay spine',
  );
});

test('buildScheduleSeed: chinese PRIMARY spine never double-adds the tea beat (overlay self-match)', () => {
  // ceremony_type='chinese' makes both isChineseWedding && (NOT isChineseOverlay),
  // so the injection branch must be skipped and the spine keeps its single beat.
  const labels = ceremonyPartLabels('chinese', {
    ceremony_type: 'chinese',
    secondary_ceremony_type: null,
  });
  assert.equal(labels.filter((l) => l === TEA).length, 1, 'exactly one tea beat, no double-add');
});

test('buildScheduleSeed: non-Chinese seed is unchanged (no tea beat, byte-identical to 2-arg call)', () => {
  // No overlay arg — must reproduce the pre-overlay behaviour exactly.
  const labelsNoOverlay = ceremonyPartLabels('catholic');
  assert.ok(!labelsNoOverlay.includes(TEA), 'plain Catholic seed must NOT contain a tea beat');

  // A non-Chinese overlay (e.g. muslim secondary) must also leave the spine alone.
  const labelsMuslimSecondary = ceremonyPartLabels('catholic', {
    ceremony_type: 'catholic',
    secondary_ceremony_type: 'muslim',
  });
  assert.deepEqual(
    labelsMuslimSecondary,
    labelsNoOverlay,
    'non-Chinese overlay must not alter the ceremony parts',
  );

  // The 3-arg call with a null overlay must be byte-identical to the 2-arg call.
  const seed2 = buildScheduleSeed('catholic', EVENT_DATE);
  const seed3 = buildScheduleSeed('catholic', EVENT_DATE, null);
  assert.deepEqual(
    seed3.buildChildren(DUMMY_PARENTS),
    seed2.buildChildren(DUMMY_PARENTS),
    'null overlay must be byte-identical to omitting the overlay arg',
  );
  assert.deepEqual(seed3.topLevel, seed2.topLevel, 'top-level rows must match too');
});
