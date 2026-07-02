/**
 * Per-EVENT Setnayan AI charge resolver (node:test via tsx).
 *
 * Locks the server wrapper: it reads the event's stored intro-used state + both
 * catalog prices and returns the right charge in centavos — ₱499 (49900) on the
 * first cycle, ₱799 (79900) after — falling back safely and returning null when
 * the event can't be read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveSetnayanAiEventChargeCentavos } from './setnayan-ai-event-pricing';

type Row = { service_code: string; retail_price_php: number | null };

/** Minimal fake admin client matching the two query shapes the resolver uses. */
function fakeAdmin(opts: {
  introUsed: boolean | null; // null → event row absent
  prices: Row[];
}): SupabaseClient {
  const client = {
    from(table: string) {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.introUsed === null ? null : { setnayan_ai_intro_used: opts.introUsed },
              }),
            }),
          }),
        };
      }
      if (table === 'platform_retail_catalog_v2') {
        return { select: () => ({ in: async () => ({ data: opts.prices }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client as unknown as SupabaseClient;
}

const PRICES: Row[] = [
  { service_code: 'SETNAYAN_AI', retail_price_php: 499 },
  { service_code: 'SETNAYAN_AI_RENEW', retail_price_php: 799 },
];

test('first cycle (intro not used) → ₱499 = 49900 centavos', async () => {
  const c = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ introUsed: false, prices: PRICES }),
    'S89E-abc',
  );
  assert.equal(c, 49900);
});

test('renewal (intro used) → ₱799 = 79900 centavos', async () => {
  const c = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ introUsed: true, prices: PRICES }),
    'S89E-abc',
  );
  assert.equal(c, 79900);
});

test('event row absent → null (caller keeps the normal catalog charge)', async () => {
  const c = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ introUsed: null, prices: PRICES }),
    'S89E-missing',
  );
  assert.equal(c, null);
});

test('missing renewal catalog row → safe fallback ₱799 on a renewal', async () => {
  const c = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ introUsed: true, prices: [{ service_code: 'SETNAYAN_AI', retail_price_php: 499 }] }),
    'S89E-abc',
  );
  assert.equal(c, 79900); // renewal price falls back to 799 when the row is absent
});
