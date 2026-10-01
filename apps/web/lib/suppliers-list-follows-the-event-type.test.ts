/**
 * GUARD — the Suppliers page's plan list shows only THIS event type's
 * categories (P3, 2026-10-01).
 *
 * `buildPlanBudgetModel` spread every PLAN_GROUP, so a birthday was shown
 * Bridal car / Rings / Honeymoon and every type was shown the wake's three
 * farewell cards (EVENT_TYPE_RELIGION_AUDIT footnote 13). It now reads the ONE
 * resolver, `planGroupsForEventType` (code floor + the DB tile scope).
 *
 * Three directions (1 and 3 sabotaged when written — dropping the scope filter,
 * dropping the pick keeper — each went red; 2 is also pinned by
 * plan-groups-by-event-type.test.ts):
 *   1. a birthday loses a wedding-only category;
 *   2. 🔒 a wedding's list is unchanged by the scope (every prod allow-list
 *      names 'wedding');
 *   3. a category that already holds a pick never vanishes, in scope or not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanBudgetModel } from './vendors-plan-budget';
import type { PlanGroupScope } from './plan-groups-by-event-type';
import type { EventVendorRowInput } from './wedding-plan-groups';

const scope: PlanGroupScope = new Map<string, readonly string[] | null>([
  ['bridal_car', ['wedding']],
  ['ceremony_venue', ['wedding', 'christening']],
  ['cake', ['wedding', 'birthday']],
]);

const base = {
  estimatedBudgetCentavos: null,
  daysUntilWedding: null,
  ceremonyType: null,
  venueSetting: null,
};

const ids = (m: ReturnType<typeof buildPlanBudgetModel>) =>
  m.folders.flatMap((f) => f.children.map((c) => c.groupId as string));

test('1 · a birthday is not shown a wedding-only category', () => {
  const got = ids(
    buildPlanBudgetModel({ ...base, vendorRows: [], eventType: 'birthday', planGroupScope: scope }),
  );
  assert.equal(got.includes('bridal_car'), false, 'a birthday is shown Bridal Car');
  assert.equal(got.includes('ceremony_venue'), false, 'a birthday is shown a ceremony venue');
  assert.ok(got.includes('cake'), 'a birthday lost its cake');
  for (const f of ['farewell_home', 'farewell_cremation', 'farewell_memorial_park']) {
    assert.equal(got.includes(f), false, `a birthday is shown ${f}`);
  }
});

test('2 · 🔒 a wedding keeps every category it had (scope or no scope)', () => {
  const scoped = ids(
    buildPlanBudgetModel({ ...base, vendorRows: [], eventType: 'wedding', planGroupScope: scope }),
  );
  const unscoped = ids(buildPlanBudgetModel({ ...base, vendorRows: [], eventType: 'wedding' }));
  assert.deepEqual(scoped, unscoped);
  assert.ok(scoped.includes('bridal_car') && scoped.includes('ceremony_venue'));
  assert.ok(scoped.length >= 25, `only ${scoped.length} wedding categories — the list collapsed`);
});

test('3 · a pick never vanishes, even outside the type', () => {
  const row: EventVendorRowInput = {
    vendor_id: 'v-1',
    vendor_name: 'Vintage Car Co.',
    category: 'transportation',
    status: 'considering',
  };
  const got = ids(
    buildPlanBudgetModel({ ...base, vendorRows: [row], eventType: 'birthday', planGroupScope: scope }),
  );
  assert.ok(got.includes('bridal_car'), "a birthday's own Bridal Car pick vanished from its list");
});
