/**
 * checkOrderOwnership invariants (Node built-in test runner, run via tsx —
 * `pnpm test:unit`).
 *
 * Locks the behavior preserved verbatim from the 5 eventOwns* helpers + the 3
 * inline custom-qr-guest gates this helper replaced (PR3 entitlement-gate
 * hardening):
 *   • a live-status row confers ownership;
 *   • a relinquished-only row (cancelled/refunded/lapsed) does NOT;
 *   • 42P01 / 42703 → false (graceful pre-bootstrap default), never throws;
 *   • any other DB error THROWS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  checkOrderOwnership,
  checkOrderActive,
  eventOwnsSku,
  eventSkuActive,
  BUNDLE_CHILD_SKUS,
  RELINQUISHED_STATUSES,
  ACTIVE_STATUSES,
} from './entitlements';

type QueryResult = { data: { status: string }[] | null; error: { code?: string; message: string } | null };

/**
 * Minimal Supabase query-builder stub. The helper chains
 * .from().select().eq().eq().not() and awaits the final builder, so every
 * chained method returns `this` and the object is thenable, resolving to the
 * configured result. We also record the args so we can assert the canonical
 * query shape didn't drift.
 */
function makeSupabase(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {
    from(...args: unknown[]) {
      calls.push({ method: 'from', args });
      return builder;
    },
    select(...args: unknown[]) {
      calls.push({ method: 'select', args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: 'eq', args });
      return builder;
    },
    not(...args: unknown[]) {
      calls.push({ method: 'not', args });
      return builder;
    },
    in(...args: unknown[]) {
      calls.push({ method: 'in', args });
      return builder;
    },
    then(resolve: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  return { supabase: builder as unknown as SupabaseClient, calls };
}

test('owned: a paid row confers ownership', async () => {
  const { supabase } = makeSupabase({ data: [{ status: 'paid' }], error: null });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'PRO_WEBSITE'), true);
});

test('owned: a still-in-reconciliation submitted row confers ownership', async () => {
  const { supabase } = makeSupabase({ data: [{ status: 'submitted' }], error: null });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'CUSTOM_QR_GUEST'), true);
});

test('not owned: no rows', async () => {
  const { supabase } = makeSupabase({ data: [], error: null });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'PAPIC_SEATS'), false);
});

test('not owned: null data', async () => {
  const { supabase } = makeSupabase({ data: null, error: null });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'PAPIC_GUEST'), false);
});

test('defense-in-depth: a row that slipped through with a relinquished status is filtered client-side', async () => {
  // Simulates DB-side enum-filter drift — the .not() returned a cancelled row
  // anyway; the client-side filter must still exclude it.
  const { supabase } = makeSupabase({ data: [{ status: 'cancelled' }], error: null });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'ANIMATED_MONOGRAM'), false);
});

test('graceful-degrade: 42P01 undefined_table → false (no throw)', async () => {
  const { supabase } = makeSupabase({ data: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'INDOOR_BLUEPRINT'), false);
});

test('graceful-degrade: 42703 undefined_column → false (no throw)', async () => {
  const { supabase } = makeSupabase({ data: null, error: { code: '42703', message: 'undefined_column' } });
  assert.equal(await checkOrderOwnership(supabase, 'evt_1', 'INDOOR_BLUEPRINT'), false);
});

test('any other DB error throws (so we never silently mis-gate)', async () => {
  const { supabase } = makeSupabase({ data: null, error: { code: '08006', message: 'connection_failure' } });
  await assert.rejects(
    () => checkOrderOwnership(supabase, 'evt_1', 'PRO_WEBSITE'),
    /Failed to resolve ownership for PRO_WEBSITE: connection_failure/,
  );
});

test('canonical query shape is preserved (event_id + service_key + relinquished filter)', async () => {
  const { supabase, calls } = makeSupabase({ data: [{ status: 'paid' }], error: null });
  await checkOrderOwnership(supabase, 'evt_42', 'PRO_WEBSITE');
  assert.deepEqual(calls.find((c) => c.method === 'from')?.args, ['orders']);
  assert.deepEqual(calls.find((c) => c.method === 'select')?.args, ['status']);
  const eqCalls = calls.filter((c) => c.method === 'eq');
  assert.equal(eqCalls.length, 2);
  assert.deepEqual(eqCalls[0]?.args, ['event_id', 'evt_42']);
  assert.deepEqual(eqCalls[1]?.args, ['service_key', 'PRO_WEBSITE']);
  assert.deepEqual(calls.find((c) => c.method === 'not')?.args, [
    'status',
    'in',
    '("cancelled","refunded","lapsed")',
  ]);
});

test('RELINQUISHED_STATUSES is the canonical exported set', () => {
  assert.equal(RELINQUISHED_STATUSES.has('cancelled'), true);
  assert.equal(RELINQUISHED_STATUSES.has('refunded'), true);
  assert.equal(RELINQUISHED_STATUSES.has('lapsed'), true);
  assert.equal(RELINQUISHED_STATUSES.has('paid'), false);
  assert.equal(RELINQUISHED_STATUSES.size, 3);
});

// ──────────────────────────────────────────────────────────────────────────
// eventOwnsSku — bundle-aware ownership (PR4 dead-unlock repair).
//
// eventOwnsSku issues up to two sequential checkOrderOwnership() queries (the
// child SKU, then each granting bundle), so the stub below resolves PER
// service_key — it records the second .eq('service_key', X) arg and returns the
// caller-configured row set for X (default: no rows = not owned).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Supabase stub whose result depends on the `service_key` filter value.
 * `owned` is the set of service_keys that should resolve to a live 'paid' row;
 * everything else resolves to zero rows.
 */
function makeOwnedSupabase(owned: Set<string>, status = 'paid') {
  let currentServiceKey: string | null = null;
  const builder: Record<string, unknown> = {
    from() {
      return builder;
    },
    select() {
      return builder;
    },
    eq(col: string, val: string) {
      if (col === 'service_key') currentServiceKey = val;
      return builder;
    },
    not() {
      return builder;
    },
    in() {
      return builder;
    },
    then(resolve: (value: QueryResult) => unknown) {
      const data = currentServiceKey && owned.has(currentServiceKey)
        ? [{ status }]
        : [];
      // Reset for the next chained query (each check rebuilds).
      currentServiceKey = null;
      return Promise.resolve({ data, error: null } as QueryResult).then(resolve);
    },
  };
  return builder as unknown as SupabaseClient;
}

test('eventOwnsSku: direct à-la-carte order confers ownership (LIVE_WALL)', async () => {
  const supabase = makeOwnedSupabase(new Set(['LIVE_WALL']));
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'LIVE_WALL'), true);
});

test('eventOwnsSku: MEDIA_PACK bundle grants a media child (PANOOD_SYSTEM)', async () => {
  // No direct PANOOD_SYSTEM order — only the MEDIA_PACK bundle order exists.
  const supabase = makeOwnedSupabase(new Set(['MEDIA_PACK']));
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'PANOOD_SYSTEM'), true);
});

test('eventOwnsSku: MEDIA_PACK bundle grants LIVE_WALL', async () => {
  const supabase = makeOwnedSupabase(new Set(['MEDIA_PACK']));
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'LIVE_WALL'), true);
});

test('eventOwnsSku: GUIDED_PACK bundle grants its member but NOT a media-only child', async () => {
  const supabase = makeOwnedSupabase(new Set(['GUIDED_PACK']));
  // PRO_WEBSITE is in GUIDED_PACK → owned.
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'PRO_WEBSITE'), true);
  // PANOOD_SYSTEM is NOT in GUIDED_PACK (media-only, MEDIA_PACK) → not owned.
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'PANOOD_SYSTEM'), false);
});

test('eventOwnsSku: no direct order and no owned bundle → not owned', async () => {
  const supabase = makeOwnedSupabase(new Set()); // owns nothing
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'LIVE_WALL'), false);
});

test('eventOwnsSku: a non-bundleable SKU with no direct order → not owned (no bundle fallback)', async () => {
  const supabase = makeOwnedSupabase(new Set()); // owns nothing
  // TODAYS_FOCUS is not a member of any bundle map → only the direct check runs.
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'TODAYS_FOCUS'), false);
});

test('eventOwnsSku: passing a bundle code directly works via the direct check', async () => {
  const supabase = makeOwnedSupabase(new Set(['MEDIA_PACK']));
  assert.equal(await eventOwnsSku(supabase, 'evt_1', 'MEDIA_PACK'), true);
});

test('BUNDLE_CHILD_SKUS: media children are in MEDIA_PACK; both bundles share Essentials members', () => {
  // The crew-delivered media children the dead DB fan-out used to grant.
  for (const child of ['LIVE_WALL', 'PANOOD_SYSTEM', 'SDE', 'PAPIC_SEATS', 'CAMERA_BRIDGE', 'PABATI', 'PAKANTA']) {
    assert.ok(
      BUNDLE_CHILD_SKUS.MEDIA_PACK.includes(child),
      `MEDIA_PACK should include ${child}`,
    );
  }
  // Essentials members appear in both bundles (Complete is a superset for these).
  for (const shared of ['SETNAYAN_AI', 'ANIMATED_MONOGRAM', 'CUSTOM_QR_GUEST', 'PRO_RSVP', 'PAPIC_GUEST', 'EVENT_WEBSITE', 'PRO_WEBSITE']) {
    assert.ok(BUNDLE_CHILD_SKUS.GUIDED_PACK.includes(shared), `GUIDED_PACK should include ${shared}`);
    assert.ok(BUNDLE_CHILD_SKUS.MEDIA_PACK.includes(shared), `MEDIA_PACK should include ${shared}`);
  }
});

// ── PR4b: the Essentials-tier digital children whose gates were left on the
// bare checkOrderOwnership() reader after PR4. A bundle buyer (single
// bundle-keyed order, no child decomposition) MUST own each of these via
// eventOwnsSku — the exact regression that denied them the feature / showed a
// double-buy CTA. These lock the gate helpers (animated-monogram.ts,
// custom-qr-guest gates, the setnayan-ai add-on `owns` check) to the
// bundle-aware reader. SETNAYAN_AI also needs the activateBundleChildren()
// hook in sku-activation.ts to stamp events.setnayan_ai_active for the feature
// gates that read the stored boolean (not unit-testable here — it imports
// next/cache via the concierge action).
for (const sku of ['ANIMATED_MONOGRAM', 'CUSTOM_QR_GUEST', 'SETNAYAN_AI']) {
  test(`eventOwnsSku: a GUIDED_PACK (Essentials) buyer owns ${sku}`, async () => {
    const supabase = makeOwnedSupabase(new Set(['GUIDED_PACK']));
    assert.equal(await eventOwnsSku(supabase, 'evt_1', sku), true);
  });
  test(`eventOwnsSku: a MEDIA_PACK (Complete) buyer owns ${sku}`, async () => {
    const supabase = makeOwnedSupabase(new Set(['MEDIA_PACK']));
    assert.equal(await eventOwnsSku(supabase, 'evt_1', sku), true);
  });
}

// Recursion-safety invariant the bundle activation fan-out
// (activateBundleChildren in lib/sku-activation.ts) depends on: a bundle code
// must NEVER appear as a CHILD of any bundle, or the fan-out (which calls each
// child's activation hook, and bundle codes have hooks) would recurse forever.
// Also enforced cross-file by lint-entitlement-gates GUARD 2; asserted here so
// the contract lives next to the data it constrains.
test('BUNDLE_CHILD_SKUS: no bundle code is itself a child (activation fan-out cannot recurse)', () => {
  for (const bundleKey of ['GUIDED_PACK', 'MEDIA_PACK'] as const) {
    for (const code of ['GUIDED_PACK', 'MEDIA_PACK']) {
      assert.ok(
        !BUNDLE_CHILD_SKUS[bundleKey].includes(code),
        `${bundleKey} must not list the bundle code ${code} as a child`,
      );
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// checkOrderActive + eventSkuActive — the HANDSHAKE gate (owner 2026-06-18:
// "must be approved by admin before they can access it"). A paid feature
// unlocks ONLY when the order is ADMIN-APPROVED (paid/fulfilled); a pending
// 'submitted' order must NOT count (it would leak access before payment is
// verified) — even though eventOwnsSku still counts it (double-buy prevention).
// ──────────────────────────────────────────────────────────────────────────

test('ACTIVE_STATUSES is exactly {paid, fulfilled}', () => {
  assert.equal(ACTIVE_STATUSES.has('paid'), true);
  assert.equal(ACTIVE_STATUSES.has('fulfilled'), true);
  assert.equal(ACTIVE_STATUSES.has('submitted'), false);
  assert.equal(ACTIVE_STATUSES.has('awaiting_payment'), false);
  assert.equal(ACTIVE_STATUSES.size, 2);
});

test('checkOrderActive: a paid order is active', async () => {
  const { supabase } = makeSupabase({ data: [{ status: 'paid' }], error: null });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'PRO_WEBSITE'), true);
});

test('checkOrderActive: a fulfilled order is active', async () => {
  const { supabase } = makeSupabase({ data: [{ status: 'fulfilled' }], error: null });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'PRO_WEBSITE'), true);
});

test('checkOrderActive: a SUBMITTED (pending) order is NOT active — the handshake', async () => {
  // Defense-in-depth: if the DB-side filter ever leaked a submitted row, the
  // client-side ACTIVE filter must still reject it. Pending != approved.
  const { supabase } = makeSupabase({ data: [{ status: 'submitted' }], error: null });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'ANIMATED_MONOGRAM'), false);
});

test('checkOrderActive: awaiting_payment is NOT active', async () => {
  const { supabase } = makeSupabase({ data: [{ status: 'awaiting_payment' }], error: null });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'ANIMATED_MONOGRAM'), false);
});

test('checkOrderActive: no rows → not active', async () => {
  const { supabase } = makeSupabase({ data: [], error: null });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'PAPIC_SEATS'), false);
});

test('checkOrderActive: queries status IN (paid, fulfilled)', async () => {
  const { supabase, calls } = makeSupabase({ data: [{ status: 'paid' }], error: null });
  await checkOrderActive(supabase, 'evt_9', 'STD_PREMIUM_OPENINGS');
  assert.deepEqual(calls.find((c) => c.method === 'in')?.args, [
    'status',
    ['paid', 'fulfilled'],
  ]);
});

test('checkOrderActive: 42P01 → false (graceful)', async () => {
  const { supabase } = makeSupabase({ data: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.equal(await checkOrderActive(supabase, 'evt_1', 'INDOOR_BLUEPRINT'), false);
});

test('checkOrderActive: any other DB error throws', async () => {
  const { supabase } = makeSupabase({ data: null, error: { code: '08006', message: 'connection_failure' } });
  await assert.rejects(
    () => checkOrderActive(supabase, 'evt_1', 'PRO_WEBSITE'),
    /Failed to resolve active entitlement for PRO_WEBSITE: connection_failure/,
  );
});

test('eventSkuActive: a paid direct order is active', async () => {
  const supabase = makeOwnedSupabase(new Set(['LIVE_WALL']), 'paid');
  assert.equal(await eventSkuActive(supabase, 'evt_1', 'LIVE_WALL'), true);
});

test('eventSkuActive: a SUBMITTED direct order is NOT active (the gate), but IS a live order (no double-buy)', async () => {
  const a = makeOwnedSupabase(new Set(['LIVE_WALL']), 'submitted');
  assert.equal(await eventSkuActive(a, 'evt_1', 'LIVE_WALL'), false);
  const b = makeOwnedSupabase(new Set(['LIVE_WALL']), 'submitted');
  assert.equal(await eventOwnsSku(b, 'evt_1', 'LIVE_WALL'), true);
});

test('eventSkuActive: a PAID MEDIA_PACK bundle activates a child (PANOOD_SYSTEM)', async () => {
  const supabase = makeOwnedSupabase(new Set(['MEDIA_PACK']), 'paid');
  assert.equal(await eventSkuActive(supabase, 'evt_1', 'PANOOD_SYSTEM'), true);
});

test('eventSkuActive: a SUBMITTED bundle does NOT activate its children', async () => {
  const a = makeOwnedSupabase(new Set(['MEDIA_PACK']), 'submitted');
  assert.equal(await eventSkuActive(a, 'evt_1', 'PANOOD_SYSTEM'), false);
  // ...but the bundle order is still a live order (double-buy prevention).
  const b = makeOwnedSupabase(new Set(['MEDIA_PACK']), 'submitted');
  assert.equal(await eventOwnsSku(b, 'evt_1', 'PANOOD_SYSTEM'), true);
});

test('eventSkuActive: GUIDED_PACK (paid) activates a member but not a media-only child', async () => {
  const a = makeOwnedSupabase(new Set(['GUIDED_PACK']), 'paid');
  assert.equal(await eventSkuActive(a, 'evt_1', 'PRO_WEBSITE'), true);
  const b = makeOwnedSupabase(new Set(['GUIDED_PACK']), 'paid');
  assert.equal(await eventSkuActive(b, 'evt_1', 'PANOOD_SYSTEM'), false);
});

test('eventSkuActive: nothing owned → not active', async () => {
  const supabase = makeOwnedSupabase(new Set(), 'paid');
  assert.equal(await eventSkuActive(supabase, 'evt_1', 'STD_PREMIUM_OPENINGS'), false);
});
