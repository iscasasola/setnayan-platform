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

import { checkOrderOwnership, RELINQUISHED_STATUSES } from './entitlements';

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
