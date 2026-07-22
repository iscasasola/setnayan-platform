import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runAndRecordVendorDeepSearch } from './vendor-deep-search-run';
import { deepSearchAiConfigured } from './vendor-deep-search';

/**
 * H3/H4 unit coverage for the Deep Search run seam + the AI-configured gate.
 *
 * The heavy race (one-free-run-per-cycle) is enforced by a DB partial unique
 * index, which a unit test can't exercise — but the CODE PATH the claim relies on
 * is testable: with a PRE-CLAIMED usage row (claimUseId), the run must UPDATE that
 * row with the dossier id, NOT insert a second usage row (which would let the
 * allowance be double-minted). Without claimUseId it inserts, as before.
 *
 * The run takes the keyless Lite path (ANTHROPIC_API_KEY unset) with NO website in
 * the inputs, so runDeepSearchOrLite is fully hermetic (no network).
 */

const NO_WEBSITE_INPUTS = {
  business_name: 'Test Studio',
  website: null,
  social_url: null,
  location_city: null,
  claimed_services: [],
};

type Call = { table: string; op: string; payload?: unknown };

/** A per-op-logging fake admin client. Dossier INSERT→id; everything else resolves clean. */
function fakeAdmin(dossierId: number): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      let op = '';
      let payload: unknown;
      const builder: Record<string, unknown> = {
        insert(p: unknown) {
          op = 'insert';
          payload = p;
          calls.push({ table, op, payload });
          return builder;
        },
        update(p: unknown) {
          op = 'update';
          payload = p;
          calls.push({ table, op, payload });
          return builder;
        },
        delete() {
          op = 'delete';
          calls.push({ table, op });
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        maybeSingle: () =>
          table === 'vendor_web_dossiers' && op === 'insert'
            ? Promise.resolve({ data: { id: dossierId }, error: null })
            : Promise.resolve({ data: null, error: null }),
        // Awaiting a builder directly (update/eq, plain insert) resolves clean.
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test('deepSearchAiConfigured reflects ANTHROPIC_API_KEY presence', () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(deepSearchAiConfigured(), false);
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  assert.equal(deepSearchAiConfigured(), true);
  if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prev;
});

test('free-run with a PRE-CLAIMED row UPDATES it (never a second usage insert)', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY; // force the hermetic Lite path
  const { client, calls } = fakeAdmin(4242);

  const result = await runAndRecordVendorDeepSearch({
    admin: client,
    vendorProfileId: 'v-1',
    requestedByUserId: 'u-1',
    inputs: NO_WEBSITE_INPUTS,
    wasFree: true,
    orderId: null,
    claimUseId: 99, // the atomically-claimed usage row
  });

  assert.equal(result.status, 'complete');
  const usageOps = calls.filter((c) => c.table === 'vendor_deep_search_uses');
  // Exactly ONE usage op, and it is an UPDATE (the pre-claimed row), never an insert.
  assert.equal(usageOps.length, 1);
  const [usageOp] = usageOps;
  assert.ok(usageOp);
  assert.equal(usageOp.op, 'update');
  assert.deepEqual(usageOp.payload, { dossier_id: 4242 });

  if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prev;
});

test('paid-run WITHOUT a claim id INSERTs a usage row (legacy path preserved)', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { client, calls } = fakeAdmin(7);

  const result = await runAndRecordVendorDeepSearch({
    admin: client,
    vendorProfileId: 'v-1',
    requestedByUserId: 'u-1',
    inputs: NO_WEBSITE_INPUTS,
    wasFree: false,
    orderId: 'ord-1',
  });

  assert.equal(result.status, 'complete');
  const usageOps = calls.filter((c) => c.table === 'vendor_deep_search_uses');
  assert.equal(usageOps.length, 1);
  const [usageOp] = usageOps;
  assert.ok(usageOp);
  assert.equal(usageOp.op, 'insert');
  assert.deepEqual(usageOp.payload, {
    vendor_profile_id: 'v-1',
    was_free: false,
    order_id: 'ord-1',
    dossier_id: 7,
  });

  if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prev;
});
