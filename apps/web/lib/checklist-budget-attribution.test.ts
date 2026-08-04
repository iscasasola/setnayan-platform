/**
 * checklist-budget-attribution.test.ts — BUD-3's proof that R2 is closed.
 *
 * R2 is not "a total is a bit low". A committed vendor with an empty
 * `covers_plan_groups` was SKIPPED, which is wrong twice in the same
 * direction: the real money never reaches `committed`, AND the plan group
 * stays un-booked so a market GUESS is added for a service already paid for.
 * The buffer therefore subtracts an invented number instead of the real one.
 *
 * Both halves are asserted below, and — as in BUD-2 — flag OFF must still
 * reproduce the defect verbatim, or the fix ships to production unflipped and
 * nobody notices.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attributeCommitted,
  groupsCarryingMoney,
  vendorCostCentavos,
  type CommittedVendorRow,
} from './checklist-budget-attribution';
import { OTHER_BUCKET } from './budget-truth';
import { PLAN_GROUPS } from './wedding-plan-groups';

// A real category → its real plan group, resolved from the shipped taxonomy so
// this test cannot drift away from the mapping the app actually uses.
const GROUP_WITH_CATEGORIES = PLAN_GROUPS.find((g) => g.categories.length > 0)!;
const A_REAL_CATEGORY = GROUP_WITH_CATEGORIES.categories[0]!;

function row(over: Partial<CommittedVendorRow>): CommittedVendorRow {
  return {
    total_cost_php: null,
    transport_php: null,
    food_allowance_php: null,
    covers_plan_groups: null,
    category: null,
    ...over,
  };
}

// ── R2 · the money must survive ─────────────────────────────────────────────

test('R2 · flag ON: a committed vendor with NO covers_plan_groups still counts', () => {
  const vendors = [
    row({ total_cost_php: 80_000, covers_plan_groups: [], category: A_REAL_CATEGORY }),
  ];
  const { byGroup, recoveredCentavos, recoveredCount } = attributeCommitted({
    enabled: true,
    vendors,
  });
  assert.equal(recoveredCentavos, 8_000_000, '₱80,000 in centavos');
  assert.equal(recoveredCount, 1);
  assert.equal(
    byGroup.get(GROUP_WITH_CATEGORIES.id),
    8_000_000,
    'the vendor_category recovers the plan group the empty array lost',
  );
});

test('R2 · flag ON: recovering the group ALSO stops the market guess (the second half)', () => {
  // The health card only projects a benchmark range for a group that is NOT
  // committed. Recovering the mapping is what marks it committed.
  const { byGroup } = attributeCommitted({
    enabled: true,
    vendors: [row({ total_cost_php: 80_000, covers_plan_groups: [], category: A_REAL_CATEGORY })],
  });
  assert.equal(
    byGroup.has(GROUP_WITH_CATEGORIES.id),
    true,
    'a booked service must never also be projected at market rate',
  );
});

test('R2 · flag OFF: the defect is reproduced EXACTLY (byte-identical promise)', () => {
  const vendors = [
    row({ total_cost_php: 80_000, covers_plan_groups: [], category: A_REAL_CATEGORY }),
  ];
  const { byGroup, recoveredCentavos } = attributeCommitted({ enabled: false, vendors });
  assert.equal(byGroup.size, 0, 'the row vanishes — money and mapping both');
  assert.equal(recoveredCentavos, 0);
});

test('an unmappable category falls into "other" and is STILL counted, never skipped', () => {
  const { byGroup, recoveredCentavos } = attributeCommitted({
    enabled: true,
    vendors: [
      row({ total_cost_php: 12_500, covers_plan_groups: null, category: 'not-a-real-category' }),
    ],
  });
  assert.equal(byGroup.get(OTHER_BUCKET), 1_250_000);
  assert.equal(recoveredCentavos, 1_250_000);
});

test('a null category with no groups still lands somewhere countable', () => {
  const { byGroup } = attributeCommitted({
    enabled: true,
    vendors: [row({ total_cost_php: 5_000, category: null })],
  });
  assert.equal(byGroup.get(OTHER_BUCKET), 500_000);
});

// ── The parts that were never the bug must not change ───────────────────────

test('the primary group still takes the whole cost; secondaries are marked at zero', () => {
  for (const enabled of [false, true]) {
    const { byGroup } = attributeCommitted({
      enabled,
      vendors: [
        row({ total_cost_php: 100_000, covers_plan_groups: ['grp-a', 'grp-b', 'grp-c'] }),
      ],
    });
    assert.equal(byGroup.get('grp-a'), 10_000_000, `primary (enabled=${enabled})`);
    assert.equal(byGroup.get('grp-b'), 0, `secondary carries no additive cost`);
    assert.equal(byGroup.get('grp-c'), 0);
  }
});

test('transport + crew meals are part of the committed cost', () => {
  assert.equal(
    vendorCostCentavos(
      row({ total_cost_php: 100_000, transport_php: 5_000, food_allowance_php: 2_500 }),
    ),
    10_750_000,
  );
});

test('a non-numeric cost degrades to ₱0 rather than NaN-ing the whole buffer', () => {
  assert.equal(
    vendorCostCentavos(row({ total_cost_php: 'oops' as unknown as number })),
    0,
  );
});

test('blank strings in covers_plan_groups are not a plan group', () => {
  const { byGroup, recoveredCentavos } = attributeCommitted({
    enabled: true,
    vendors: [
      row({ total_cost_php: 9_000, covers_plan_groups: ['', ''], category: A_REAL_CATEGORY }),
    ],
  });
  assert.equal(recoveredCentavos, 900_000, 'an array of blanks is an EMPTY array');
  assert.equal(byGroup.get(GROUP_WITH_CATEGORIES.id), 900_000);
});

// ── The second half: money outside the couple's tier scope ──────────────────

test('R2b · money attributed OUTSIDE the tier scope is no longer dropped from the total', () => {
  const { byGroup } = attributeCommitted({
    enabled: true,
    vendors: [row({ total_cost_php: 45_000, covers_plan_groups: ['grp-offscope'] })],
  });
  const extra = groupsCarryingMoney({
    enabled: true,
    byGroup,
    inScope: ['grp-in-scope-1', 'grp-in-scope-2'],
  });
  assert.deepEqual(extra, ['grp-offscope'], 'the totalling loop must visit it');
});

test('R2b · flag OFF widens nothing — the loop is unchanged', () => {
  const byGroup = new Map([['grp-offscope', 4_500_000]]);
  assert.deepEqual(groupsCarryingMoney({ enabled: false, byGroup, inScope: [] }), []);
});

test('a secondary-only marker carries no money and must not create a line', () => {
  const byGroup = new Map([['grp-secondary', 0]]);
  assert.deepEqual(groupsCarryingMoney({ enabled: true, byGroup, inScope: [] }), []);
});

test('in-scope groups are never duplicated into the extra list', () => {
  const byGroup = new Map([['grp-a', 10_000_000]]);
  assert.deepEqual(groupsCarryingMoney({ enabled: true, byGroup, inScope: ['grp-a'] }), []);
});

test('"other" sorts last so named groups read first', () => {
  const byGroup = new Map([
    [OTHER_BUCKET, 100],
    ['zzz-group', 100],
    ['aaa-group', 100],
  ]);
  assert.deepEqual(groupsCarryingMoney({ enabled: true, byGroup, inScope: [] }), [
    'aaa-group',
    'zzz-group',
    OTHER_BUCKET,
  ]);
});

// ── The measured defect, end to end ─────────────────────────────────────────

test('the ₱810,000 shape: 12 unmapped commitments read as ₱0 under the old rule', () => {
  const vendors = Array.from({ length: 12 }, () =>
    row({ total_cost_php: 67_500, covers_plan_groups: [], category: A_REAL_CATEGORY }),
  );
  const off = attributeCommitted({ enabled: false, vendors });
  const on = attributeCommitted({ enabled: true, vendors });

  const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  assert.equal(total(off.byGroup), 0, 'today: twelve real commitments, ₱0 counted');
  assert.equal(total(on.byGroup), 81_000_000, '₱810,000');
  assert.equal(on.recoveredCount, 12);
});
