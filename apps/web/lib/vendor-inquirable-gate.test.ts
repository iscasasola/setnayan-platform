import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchVendorIdsWithActiveService } from '@/lib/vendor-inquirable-gate';

/**
 * B2 guard — a shop with zero active vendor_services rows must never come
 * back from fetchVendorIdsWithActiveService, and a shop with at least one
 * must. This is the ONE predicate both /explore's vendor-grid and the shared
 * wizard-recommendations pool rely on to keep an unbookable shop off every
 * listing surface — so a regression here silently reopens B2 everywhere at
 * once.
 */

type FakeRow = { vendor_profile_id: string };

function fakeAdmin(rows: FakeRow[] | null, errored = false) {
  return {
    from(table: string) {
      assert.equal(table, 'vendor_services');
      return {
        select(_cols: string) {
          return {
            eq(col: string, val: boolean) {
              assert.equal(col, 'is_active');
              assert.equal(val, true);
              return errored
                ? Promise.resolve({ data: null, error: new Error('boom') })
                : Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
    // Cast target only needs `.from` — see the Pick<SupabaseClient, 'from'> param type.
  } as unknown as Parameters<typeof fetchVendorIdsWithActiveService>[0];
}

test('a shop with zero active services is excluded — the SetnaProd case', async () => {
  // SetnaProd has rows in vendor_services but none active, OR no rows at all;
  // either way, is_active=true never returns it.
  const admin = fakeAdmin([{ vendor_profile_id: 'saysay-fixture' }]);
  const ids = await fetchVendorIdsWithActiveService(admin);
  assert.deepEqual(ids, ['saysay-fixture']);
  assert.equal(ids.includes('setnaprod'), false);
});

test('a shop with at least one active service is included', async () => {
  const admin = fakeAdmin([
    { vendor_profile_id: 'saysay-fixture' },
    { vendor_profile_id: 'saysay-fixture' }, // two active cards, one shop
  ]);
  const ids = await fetchVendorIdsWithActiveService(admin);
  // Deduped — a two-card shop appears once, so an `.in()` filter built from
  // this list doesn't inflate a downstream count.
  assert.deepEqual(ids, ['saysay-fixture']);
});

test('a query error fails CLOSED — empty set, never every vendor', async () => {
  const admin = fakeAdmin(null, true);
  const ids = await fetchVendorIdsWithActiveService(admin);
  assert.deepEqual(ids, []);
});

test('no active services anywhere returns an empty set (not null/undefined)', async () => {
  const admin = fakeAdmin([]);
  const ids = await fetchVendorIdsWithActiveService(admin);
  assert.deepEqual(ids, []);
});
