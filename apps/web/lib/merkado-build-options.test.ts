/**
 * Unit suite for the one-click build options (2026-07-10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBuildOptions, type OptionCandidate } from './merkado-build-options';

function cand(p: Partial<OptionCandidate> & { groupId: string; vendorId: string }): OptionCandidate {
  return { groupLabel: p.groupId, vendorName: p.vendorId, costPhp: null, rating: null, ...p };
}

test('no candidates → no options', () => {
  assert.deepEqual(selectBuildOptions(new Map()), []);
  assert.deepEqual(selectBuildOptions(new Map([['g', []]])), []);
});

test('three options, labelled Option 1/2/3 (never good/better/best), cheapest→priciest', () => {
  const m = new Map<string, OptionCandidate[]>([
    [
      'venue',
      [
        cand({ groupId: 'venue', vendorId: 'cheap', costPhp: 200000, rating: 4.3 }),
        cand({ groupId: 'venue', vendorId: 'lux', costPhp: 400000, rating: 4.9 }),
      ],
    ],
    [
      'photo',
      [
        cand({ groupId: 'photo', vendorId: 'budget', costPhp: 40000, rating: 4.5 }),
        cand({ groupId: 'photo', vendorId: 'top', costPhp: 120000, rating: 4.9 }),
      ],
    ],
  ]);
  const opts = selectBuildOptions(m);
  assert.equal(opts.length, 3);
  assert.deepEqual(opts.map((o) => o.name), ['Option 1', 'Option 2', 'Option 3'], 'neutral labels');
  // cheapest → priciest
  assert.ok(opts[0]!.totalPhp <= opts[1]!.totalPhp && opts[1]!.totalPhp <= opts[2]!.totalPhp);
  // Option 1 (cheapest tier) picks the cheapest in each group
  assert.equal(opts[0]!.totalPhp, 200000 + 40000);
  // Option 3 (top-rated tier) picks the highest-rated in each group
  assert.equal(opts[2]!.totalPhp, 400000 + 120000);
});

test('each option fills every non-empty group', () => {
  const m = new Map<string, OptionCandidate[]>([
    ['a', [cand({ groupId: 'a', vendorId: 'a1', costPhp: 100, rating: 4 })]],
    ['b', [cand({ groupId: 'b', vendorId: 'b1', costPhp: 200, rating: 5 })]],
    ['c', []], // empty → skipped
  ]);
  const opts = selectBuildOptions(m);
  for (const o of opts) {
    assert.deepEqual(o.picks.map((p) => p.groupId).sort(), ['a', 'b'], 'only non-empty groups filled');
  }
});

test('a pick carries its group label, vendor name/id, and cost', () => {
  const m = new Map<string, OptionCandidate[]>([
    ['venue', [cand({ groupId: 'venue', groupLabel: 'Reception', vendorId: 'v1', vendorName: 'Villa', costPhp: 250000, rating: 4.8 })]],
  ]);
  const p = selectBuildOptions(m)[0]!.picks[0]!;
  assert.equal(p.label, 'Reception');
  assert.equal(p.vendorName, 'Villa');
  assert.equal(p.vendorId, 'v1');
  assert.equal(p.costPhp, 250000);
});

test('best-value tier prefers rating-per-peso', () => {
  // Same group: a pricey-top and a great-value option.
  const m = new Map<string, OptionCandidate[]>([
    [
      'g',
      [
        cand({ groupId: 'g', vendorId: 'value', costPhp: 50000, rating: 4.7 }), // 4.7/50k best ratio
        cand({ groupId: 'g', vendorId: 'pricey', costPhp: 200000, rating: 4.9 }),
      ],
    ],
  ]);
  const opts = selectBuildOptions(m);
  // Option totals: cheapest=value(50k), value=value(50k), top=pricey(200k) → sorted [50,50,200]
  // The value pick appears in the mid option; the top option is the pricey one.
  assert.equal(opts[2]!.picks[0]!.vendorId, 'pricey', 'top-rated tier → the pricey 4.9');
  assert.ok(opts.slice(0, 2).every((o) => o.picks[0]!.vendorId === 'value'), 'cheapest + value tiers → the value pick');
});
