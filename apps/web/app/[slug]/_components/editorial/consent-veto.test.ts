/**
 * Unit suite for the editorial RA 10173 consent veto (gap audit B3). Proves that
 * the two DB reads translate into the right veto set / fail-closed signal:
 *   - nobody opted out → empty veto, not failed (and no second query needed);
 *   - an opted-out guest → every papic_photos capture tagging them is vetoed;
 *   - a DB error on EITHER read → failed=true (callers then withhold ALL papic).
 * Uses a chainable stub client (thenable builder) so no live DB is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { createAdminClient } from '@/lib/supabase/admin';

import { loadConsentVetoedPapicIds } from './consent-veto';

type Result = { data: unknown; error?: unknown };
type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Chainable stub: every query method returns the builder, and the builder is a
 * thenable that resolves to the table's configured result — so `await` at ANY
 * point in the chain (`.is(...)`, `.in(...)`) yields `{ data, error }`, exactly
 * like a supabase-js PostgrestFilterBuilder.
 */
function stubClient(byTable: Record<string, Result>): AdminClient {
  const build = (table: string) => {
    const result = byTable[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'neq']) {
      builder[m] = () => builder;
    }
    builder.then = (resolve: (r: Result) => unknown) => resolve(result);
    return builder;
  };
  return { from: (t: string) => build(t) } as unknown as AdminClient;
}

test('nobody opted out → empty veto, not failed', async () => {
  const c = stubClient({ guests: { data: [] } });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.equal(v.ids.size, 0);
});

test('an opted-out guest → every papic_photos capture tagging them is vetoed', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: [{ source_id: 'p1' }, { source_id: 'p2' }, { source_id: 'p1' }] },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.deepEqual([...v.ids].sort(), ['p1', 'p2']);
});

test('opted-out guest but no tagged captures → empty veto, not failed', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: [] },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.equal(v.ids.size, 0);
});

test('guests read error → failed (callers withhold ALL papic)', async () => {
  const c = stubClient({ guests: { data: null, error: { message: 'boom' } } });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
});

test('photo_tags read error → failed (fail closed on the second read too)', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: null, error: { message: 'boom' } },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
});
