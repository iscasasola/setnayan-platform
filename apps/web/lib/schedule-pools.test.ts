/**
 * Regression suite for the schedule-pool resolvers — guarding the package
 * capacity-gate fix (2026-06-20). The load-bearing invariant: a booked vendor
 * row that carries a CATEGORY but no service_id (every lockPackage cascade row)
 * still resolves to its pool, so the white→BOOKED gate in updateVendorStatus
 * acquires capacity instead of silently skipping it (the overbooking hole).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolvePoolIdsForCategory } from './schedule-pools';

/** Minimal supabase stub: resolvePoolIdsForCategory only touches `.rpc`. */
function mockSupabase(
  rpc: (name: string, args: Record<string, unknown>) => unknown,
): { client: SupabaseClient; calls: Array<{ name: string; args: Record<string, unknown> }> } {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: rpc(name, args), error: null };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const POOL = '11111111-1111-1111-1111-111111111111';

test('resolvePoolIdsForCategory: returns the category pool (the package-row path)', async () => {
  const { client, calls } = mockSupabase(() => POOL);
  const result = await resolvePoolIdsForCategory(client, 'vendor-1', 'photographer');
  assert.deepEqual(result, [POOL]);
  // It must resolve via the shared category resolver with the row's category.
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.name, 'resolve_schedule_pool');
  assert.equal(call.args.p_vendor_profile_id, 'vendor-1');
  assert.equal(call.args.p_category_key, 'photographer');
});

test('resolvePoolIdsForCategory: no category → no pool, no RPC call', async () => {
  for (const empty of [null, undefined, '']) {
    const { client, calls } = mockSupabase(() => POOL);
    const result = await resolvePoolIdsForCategory(client, 'vendor-1', empty);
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0, 'must not call the resolver for an empty category');
  }
});

test('resolvePoolIdsForCategory: junk-pool guard (resolver returns null) → [] (degrade open)', async () => {
  const { client } = mockSupabase(() => null);
  const result = await resolvePoolIdsForCategory(client, 'vendor-1', 'category-vendor-does-not-sell');
  assert.deepEqual(result, []);
});
