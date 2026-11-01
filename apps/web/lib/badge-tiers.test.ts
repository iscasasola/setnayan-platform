/**
 * 🥉 Badges improve as their ladder goes up — and every tier READS (WCAG AA, 4.5 : 1) on a light ground and a dark one.
 * The foil is a gradient, so every stop is measured, not an average. Broken on purpose once and seen red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, stepGlyph, tierForStep } from './badge-tiers';
import { MILESTONE_THRESHOLDS } from './service-card-record';
import { contrastRatio } from './hub-legibility';
import { shopBadges } from './shop-badges';

const AA = 4.5;

test('one tier per shipped step, in order — no step without a material, no material without a step', () => {
  assert.deepEqual(TIERS.map((t) => t.step), [...MILESTONE_THRESHOLDS]);
  assert.equal(new Set(TIERS.map((t) => t.key)).size, TIERS.length);
  assert.equal(tierForStep(25), null, '25 is not a step');
  assert.ok(TIERS[TIERS.length - 1]!.laurel, 'the top step wears the laurel');
  assert.equal(TIERS.filter((t) => t.laurel).length, 1);
  assert.deepEqual(
    TIERS.map((t) => t.name),
    ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby', 'Black Diamond'],
    'the names the owner approved on 2026-10-28, in ladder order',
  );
});

for (const t of TIERS) {
  for (const mode of ['light', 'dark'] as const) {
    test(`tier at ${t.step} on ${mode}: lettering, line and number all read at AA`, () => {
      const p = t[mode];
      for (const stop of p.foil) {
        const r = contrastRatio(stop, p.bg);
        assert.ok(r >= AA, `foil stop ${stop} on ${p.bg} = ${r.toFixed(2)} : 1 (< ${AA})`);
      }
      const fg = contrastRatio(p.fg, p.bg);
      assert.ok(fg >= AA, `line ${p.fg} on ${p.bg} = ${fg.toFixed(2)} : 1`);
      const mk = contrastRatio(p.mkc, p.mk);
      assert.ok(mk >= AA, `number ${p.mkc} on circle ${p.mk} = ${mk.toFixed(2)} : 1`);
    });
  }
}

test('the badge upgrades itself the moment the count crosses a step', () => {
  const tierAt = (n: number) => shopBadges({ verified: false, completedEvents: n, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 })[0]?.tier;
  assert.equal(tierAt(9), undefined);
  assert.equal(tierAt(10), 'tier1');
  assert.equal(tierAt(49), 'tier1');
  assert.equal(tierAt(50), 'tier2');
  assert.equal(tierAt(100), 'tier3');
  assert.equal(tierAt(10000), 'tier7');
});

test('the circle shows the number', () => {
  assert.equal(stepGlyph(500), '500');
  assert.equal(stepGlyph(1000), '1K');
  assert.equal(stepGlyph(10000), '10K');
});
