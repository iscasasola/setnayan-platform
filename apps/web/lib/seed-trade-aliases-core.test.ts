/**
 * GUARD — the pure/testable half of scripts/seed-trade-aliases.ts (C2,
 * 2026-08-28). Split into lib/ specifically so this file runs in CI —
 * test:unit globs lib/** and app/** ONLY; a test dropped under scripts/
 * would silently never execute (see the module's own docblock).
 *
 * 🛑 parseProposals is gone — the alias list is mined from our own
 * attribute schemas now, not asked of a model. See
 * lib/trade-alias-miner.test.ts for the mining logic's own tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { humanize, fetchSchemaAttributeRows } from './seed-trade-aliases-core';

test('humanize turns a snake_case key into Title Case', () => {
  assert.equal(humanize('generator_rental'), 'Generator Rental');
});

/** The smallest object satisfying the one call fetchSchemaAttributeRows makes. */
function fakeAdmin(data: unknown): SupabaseClient {
  return {
    from: () => ({
      select: async () => ({ data, error: null }),
    }),
  } as unknown as SupabaseClient;
}

test('fetchSchemaAttributeRows hands back exactly what the query returns', async () => {
  const rows = [
    { canonical_service: 'photo_booth', category_specific_attributes: { booth_types: { options: ['360_booth'] } } },
    { canonical_service: 'sorbetes_cart', category_specific_attributes: {} },
  ];
  const out = await fetchSchemaAttributeRows(fakeAdmin(rows));
  assert.deepEqual(out, rows);
});

test('fetchSchemaAttributeRows returns [] rather than throwing when the query answers no data', async () => {
  const out = await fetchSchemaAttributeRows(fakeAdmin(null));
  assert.deepEqual(out, []);
});
