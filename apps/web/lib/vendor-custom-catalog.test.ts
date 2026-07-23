/**
 * selectActivatableCustomPlan — the binding rule a freshly-PAID Custom-tier order
 * uses to pick which vendor_custom_plans row goes 'active' (lib/sku-activation.ts
 * vendor_custom_plan__ hook). AUTHZ/lifecycle fix: the old "most-recently-updated
 * quoted|pending|active row" selection let a vendor pay a CHEAP quote and receive
 * whatever composition the row was last edited to, or bind to a stale active
 * plan. Binding on the order's paid PRICE + a payable state closes both.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectActivatableCustomPlan,
  type CustomPlanCandidate,
} from './vendor-custom-catalog';

test('picks the pending_payment plan whose quoted price matches the paid amount', () => {
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: 5000, updated_at: '2026-01-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 5000), 'p1');
});

test('accepts a quoted (admin-sent) plan too — the admin-quote path never flips to pending_payment', () => {
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'quoted', quoted_28d_php: 8000, updated_at: '2026-01-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 8000), 'p1');
});

test('SECURITY: pay a CHEAP order after the plan was re-composed to EXPENSIVE → no match, refuse', () => {
  // Vendor quoted small (order paid 5000), then edited the row to an expensive
  // composition (quoted_28d_php now 50000). Approving the cheap order must NOT
  // bind — the price no longer matches.
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: 50000, updated_at: '2026-02-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 5000), null);
});

test('SECURITY: never binds to an already-ACTIVE plan (even if its price matches)', () => {
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'active', quoted_28d_php: 5000, updated_at: '2026-03-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 5000), null);
});

test('SECURITY: a newer expensive ACTIVE row does not shadow the matching payable one', () => {
  // The old "most-recently-updated among quoted|pending|active" would pick p2
  // (active, newest). The price+state binding picks p1 (the one this order paid).
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: 5000, updated_at: '2026-01-01T00:00:00Z' },
    { custom_plan_id: 'p2', status: 'active', quoted_28d_php: 99000, updated_at: '2026-05-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 5000), 'p1');
});

test('among multiple price-matching payable plans, the most-recently-updated wins', () => {
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'old', status: 'pending_payment', quoted_28d_php: 6000, updated_at: '2026-01-01T00:00:00Z' },
    { custom_plan_id: 'new', status: 'pending_payment', quoted_28d_php: 6000, updated_at: '2026-04-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 6000), 'new');
});

test('numeric-string quoted_28d_php (PostgREST numeric) still matches', () => {
  const plans: CustomPlanCandidate[] = [
    { custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: '7000', updated_at: '2026-01-01T00:00:00Z' },
  ];
  assert.equal(selectActivatableCustomPlan(plans, 7000), 'p1');
});

test('no candidates, or a non-positive amount → null (caller refuses to activate)', () => {
  assert.equal(selectActivatableCustomPlan([], 5000), null);
  assert.equal(
    selectActivatableCustomPlan(
      [{ custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: 0, updated_at: null }],
      0,
    ),
    null,
  );
});
