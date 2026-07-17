/**
 * Wiring suite for the vendor Papic tier DERIVATION (lib/vendor-papic-grants.ts).
 * Unlike vendor-papic-tier.test.ts (the pure model), this proves the DB reads
 * translate correctly: vendor_event_unlocks / lead_token_holds → base tier, and
 * a vendor_papic_capture_grants 'unli' row (money-verified) → Unli. Uses a stub
 * Supabase client so no live DB is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deriveVendorPapicTier,
  fetchVendorAcceptProvenance,
  hasPaidUnliUpgrade,
} from './vendor-papic-grants';

type Result = { data: unknown; error?: unknown };

/**
 * A chainable stub: every query method returns the builder; the terminal
 * `.maybeSingle()` resolves to the result configured for that table. Each table
 * is read at most once per derivation, so keying by table name is sufficient.
 */
function stubClient(byTable: Record<string, Result>): SupabaseClient {
  const build = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gt', 'is', 'order', 'limit']) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = async () => byTable[table] ?? { data: null, error: null };
    return builder;
  };
  return { from: (t: string) => build(t) } as unknown as SupabaseClient;
}

test('derive: no unlock row → Lite (the floor)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('derive: founder-comped accept → Ltd (as-if-paid)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: 'founder', tokens_burned: 0 } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'ltd');
});

test('derive: token burned → Ltd', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 2 } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'ltd');
});

test('derive: unlock but no token + not founder → Lite', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: null },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('derive: a reserved (held) token → Ltd', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: { status: 'held' } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'ltd');
});

test('derive: an admin-comped unli grant (no order) → Unli', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: null },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: null } },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'unli');
});

test('derive: an unli grant with a PAID order → Unli', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: null },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: 'o1' } },
    orders: { data: { status: 'paid' } },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'unli');
});

test('derive: an unli grant with an UNPAID order does NOT open Unli (fail-closed)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: null },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: 'o1' } },
    orders: { data: { status: 'submitted' } },
  });
  // Falls back to the derived base tier (Lite here), never Unli.
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('provenance: a read error fails closed to no-unlock', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null, error: { message: 'boom' } },
  });
  const p = await fetchVendorAcceptProvenance(c, 'v1', 'e1');
  assert.deepEqual(p, {
    hasUnlock: false,
    founderComp: false,
    tokensBurned: 0,
    hasActiveHold: false,
  });
});

test('hasPaidUnliUpgrade: a non-unli grant row → false', async () => {
  const c = stubClient({
    vendor_papic_capture_grants: { data: { tier: 'ltd', upgrade_order_id: null } },
  });
  assert.equal(await hasPaidUnliUpgrade(c, 'v1', 'e1'), false);
});
