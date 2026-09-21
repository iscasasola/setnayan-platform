/**
 * A SUPPLIER'S "ALSO COVERS" IS NEVER WHERE ITS MONEY LIVES.
 *
 * `event_vendors.covers_plan_groups` has two writers that mean different
 * things by it:
 *
 *   · the BUDGET COST writer (`budget/cost-actions.ts`) → `[planGroupId]`, the
 *     row's HOME, with `category` stamped from that group
 *     (`vendorCategoryForCostCategory`);
 *   · the ADD-MANUALLY sheet + workspace editor → the groups the supplier
 *     ALSO covers, never its own.
 *
 * `bucketForVendor` read `[0]` as the home for both, so a reception venue that
 * also covers catering filed its whole price under Catering. Measured in prod
 * 2026-09-21: exactly one row carries covers (that venue: covers
 * [catering, cake, accommodation], no price entered yet), so nothing was
 * misfiled yet — the rule is fixed before the first price lands.
 *
 * Every assertion below ENUMERATES the taxonomy rather than sampling it, and
 * prints how many cases it walked, so a shrunken taxonomy cannot pass vacuously.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { bucketForVendor, isHomeGroupFor, OTHER_BUCKET } from '@/lib/budget-truth';
import { attributeCommitted } from '@/lib/checklist-budget-attribution';
import { vendorCategoryForCostCategory } from '@/lib/event-costs';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

const GROUP_IDS = PLAN_GROUPS.map((g) => g.id as string);

test('writer 1 · a budget cost lands in the category the couple picked — for EVERY plan group', () => {
  let walked = 0;
  for (const g of GROUP_IDS) {
    const category = vendorCategoryForCostCategory(g);
    assert.equal(
      bucketForVendor({ covers_plan_groups: [g], category } as never),
      g,
      `a cost recorded under "${g}" (stamped category "${category}") landed elsewhere`,
    );
    walked += 1;
  }
  assert.ok(walked >= 30, `walked only ${walked} plan groups`);
  console.log(`# cost writer: ${walked} plan groups, each lands home`);
});

test('writer 2 · a hand-added supplier’s money stays home, whatever else it covers', () => {
  // The only pairs where "also covers" and "home" are indistinguishable from
  // (category, covers) alone. Listed EXACTLY, so a new one is a visible diff.
  const EXPECTED_AMBIGUOUS = new Set([
    'transportation→logistics', // `transportation` is listed by Bridal Car AND Logistics
    'misc→stylist',
    'misc→live_band',
    'misc→dance_instructor',
    'misc→after_party_music',
    'misc→guest_shuttle', // the five groups that list no category at all
  ]);
  const ambiguous = new Set<string>();
  let walked = 0;
  for (const category of VENDOR_CATEGORIES) {
    const home = bucketForVendor({ covers_plan_groups: null, category } as never);
    if (home === OTHER_BUCKET) continue; // a gap leaf with no plan group
    for (const also of GROUP_IDS) {
      if (also === home) continue; // the picker never offers the own group
      const got = bucketForVendor({ covers_plan_groups: [also], category } as never);
      walked += 1;
      if (got === home) continue;
      assert.ok(
        isHomeGroupFor(also, category),
        `"${category}" also covering "${also}" moved its money there`,
      );
      ambiguous.add(`${category}→${also}`);
    }
  }
  assert.deepEqual([...ambiguous].sort(), [...EXPECTED_AMBIGUOUS].sort());
  assert.ok(walked >= 1000, `walked only ${walked} (category, also-covers) pairs`);
  console.log(`# supplier writer: ${walked} pairs, ${ambiguous.size} known-ambiguous`);
});

test('the prod row: a reception venue that also covers catering, cake and accommodation', () => {
  const venue = {
    category: 'venue',
    covers_plan_groups: ['catering', 'cake', 'accommodation'],
  };
  assert.equal(bucketForVendor(venue as never), 'reception_venue');

  // The checklist health card attributes through the SAME rule — whole cost
  // at home, the covered groups marked committed at zero.
  const { byGroup } = attributeCommitted({
    enabled: true,
    vendors: [{ ...venue, total_cost_php: 250_000 }],
  });
  assert.equal(byGroup.get('reception_venue'), 25_000_000);
  assert.equal(byGroup.get('catering'), 0);
  assert.equal(byGroup.get('cake'), 0);
  assert.equal(byGroup.get('accommodation'), 0);
});

test('the picker dropping a row’s own group on re-save cannot move a cost’s money', () => {
  // services-covered-picker filters `planGroupForCategory(category)` out of what
  // it sends back. For every budget-cost row, that re-save must be a no-op for
  // the bucket.
  let walked = 0;
  for (const g of GROUP_IDS) {
    const category = vendorCategoryForCostCategory(g);
    const own = planGroupForCategory(category as never);
    const resaved = [g].filter((id) => id !== own);
    assert.equal(
      bucketForVendor({ covers_plan_groups: resaved, category } as never),
      g,
      `re-saving the "${g}" cost row through the picker moved its money`,
    );
    walked += 1;
  }
  console.log(`# picker re-save: ${walked} cost rows unchanged`);
});
