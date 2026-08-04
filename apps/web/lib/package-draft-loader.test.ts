/**
 * PACKAGE DRAFT LOADER — the destructive-save guard.
 *
 * THE DEFECT THIS SUITE EXISTS TO MAKE IMPOSSIBLE TO REINTRODUCE:
 * the loader destructured only `{ data }`, so a PostgREST 400 on the item
 * select (the real one, verified against the live project:
 * `column "parent_option_id" does not exist`) became `data: null`, then
 * `(items ?? [])`, then an EMPTY draft. `validatePackageDraft` only objects to
 * ZERO items, so the vendor adds one line, presses Save, and `savePackage`'s
 * `scope === 'full'` branch DELETES every existing item and writes back the
 * single new one — reporting success. A read failure became data loss.
 *
 * Driven with a hand-rolled fake Supabase client rather than a mock library, so
 * the failure path is exercised for real: `loadPackageDraft` takes its client
 * as an argument and touches no env, no Next internals and no network.
 *
 * NEUTRALISATION: delete the `if (itemsErr)` guard in package-draft-loader.ts
 * and the first test below goes red — it gets `{ ok: true }` with zero items.
 *
 * Pure module: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadPackageDraft, countActiveBookings } from './package-draft-loader';

/** The exact message PostgREST returns when the migration has not landed. */
const MISSING_COLUMN = 'column "parent_option_id" does not exist';

type Resp = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

const PKG_ROW = {
  package_id: 'pkg-1',
  package_name: 'Complete Wedding Catering',
  total_price_centavos: 10_000_00,
  consumable_budget_centavos: 0,
  is_consumable_flexible: false,
  is_active: true,
};

const ITEM_ROWS = [
  {
    item_id: 'item-main',
    canonical_service: 'catering',
    service_description: 'Main course',
    is_default_included: true,
    is_required: true,
    replacement_value_centavos: 5_000_00,
    display_order: 0,
    parent_option_id: null,
    pick_min: null,
    pick_max: null,
    max_extra_hours: null,
  },
  {
    item_id: 'item-side',
    canonical_service: 'catering',
    service_description: 'Choose your side',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 50_000,
    display_order: 1,
    parent_option_id: 'opt-fish',
    pick_min: 1,
    pick_max: 2,
    max_extra_hours: 3,
  },
];

const OPTION_ROWS = [
  {
    option_id: 'opt-beef',
    item_id: 'item-main',
    option_label: 'Beef caldereta',
    price_delta_centavos: 0,
    is_default: true,
    is_available: true,
    display_order: 0,
  },
  {
    option_id: 'opt-fish',
    item_id: 'item-main',
    option_label: 'Fish fillet',
    price_delta_centavos: 500,
    is_default: false,
    is_available: true,
    display_order: 1,
  },
];

/**
 * A fake PostgREST query builder: every chainable method returns itself, and
 * awaiting it (or calling `.maybeSingle()`) yields the canned response for the
 * table. Deliberately hand-rolled — a mocking library would let a typo in a
 * method name pass silently, whereas an unimplemented method here throws.
 */
function fakeClient(responses: Record<string, Resp>): SupabaseClient {
  const chainFor = (table: string) => {
    const resp: Resp = responses[table] ?? { data: [], error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve(resp),
      then: <T>(
        onOk: (r: Resp) => T,
        onErr?: (e: unknown) => T,
      ): Promise<T> => Promise.resolve(resp).then(onOk, onErr),
    };
    return chain;
  };
  return { from: (table: string) => chainFor(table) } as unknown as SupabaseClient;
}

const healthy = (over: Partial<Record<string, Resp>> = {}) =>
  fakeClient({
    vendor_packages: { data: PKG_ROW, error: null },
    vendor_package_items: { data: ITEM_ROWS, error: null },
    vendor_package_item_options: { data: OPTION_ROWS, error: null },
    event_vendor_packages: { data: null, error: null, count: 0 },
    ...over,
  });

/* ── THE NAMED GUARD ────────────────────────────────────────────────────────*/

test('a failed item read is NEVER degraded to an empty saveable draft', async () => {
  const res = await loadPackageDraft(
    healthy({ vendor_package_items: { data: null, error: { message: MISSING_COLUMN } } }),
    'vendor-1',
    'pkg-1',
  );

  assert.equal(res.ok, false, 'a 400 on the item select must NOT read as a valid package');
  assert.equal(res.ok === false ? res.reason : null, 'read_failed');
  assert.match(
    res.ok === false && res.reason === 'read_failed' ? res.message : '',
    /parent_option_id/,
    'the real cause must reach the caller, not be swallowed',
  );

  // The load-bearing half: there is no draft ANYWHERE on a failed result, so no
  // caller can save on top of one. An empty `items` array is exactly what made
  // the next save delete every real row.
  assert.equal(
    'loaded' in res,
    false,
    'a failed read must carry no draft at all — an empty one is what gets saved over the real rows',
  );
});

test('COMPILE-TIME: the destructive branch cannot reach a draft on a failed read', async () => {
  const res = await loadPackageDraft(
    healthy({ vendor_package_items: { data: null, error: { message: MISSING_COLUMN } } }),
    'vendor-1',
    'pkg-1',
  );
  if (res.ok) {
    assert.fail('fixture should have failed');
  }
  // `savePackage` deletes every item row and rewrites it from `stored`. It can
  // only obtain `stored` from `res.loaded.draft`, and THIS LINE IS A TYPE ERROR
  // — the union member with `ok: false` has no `loaded` field. So the delete is
  // unreachable on a failed read by construction, not by reviewer vigilance.
  // Remove the `@ts-expect-error` and `tsc --noEmit` fails.
  // @ts-expect-error — `loaded` does not exist on a failed LoadPackageResult
  assert.equal(res.loaded, undefined);
});

/* ── the guard is not vacuous: the happy path still loads everything ────────*/

test('a healthy read returns the real items — the guard does not just always fail', async () => {
  const res = await loadPackageDraft(healthy(), 'vendor-1', 'pkg-1');
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.loaded.draft.items.length, 2);
  assert.equal(res.loaded.draft.package_name, 'Complete Wedding Catering');
  assert.equal(res.loaded.isActive, true);
  assert.equal(res.loaded.draft.items[0]!.options.length, 2);
});

test('a follow-up round-trips as a parentRef, not as a top-level line', async () => {
  // Dropping this is the other data-loss shape: savePackage rebuilds from the
  // draft, so a flattened follow-up is PUBLISHED to every couple on next save.
  const res = await loadPackageDraft(healthy(), 'vendor-1', 'pkg-1');
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const side = res.loaded.draft.items.find((i) => i.ref === 'item-side')!;
  assert.deepEqual(side.parentRef, { itemRef: 'item-main', optionRef: 'opt-fish' });
  assert.equal(side.pickMin, 1);
  assert.equal(side.pickMax, 2);
  assert.equal(side.maxExtraHours, 3);

  const main = res.loaded.draft.items.find((i) => i.ref === 'item-main')!;
  assert.equal(main.parentRef, null, 'a top-level line has no parent');
});

/* ── the other two reads are the same class ─────────────────────────────────*/

test('a failed PACKAGE read is read_failed, never not_found', async () => {
  // Reporting a database outage as "no such package" sends the vendor to build
  // a replacement of a package that still exists.
  const res = await loadPackageDraft(
    healthy({ vendor_packages: { data: null, error: { message: 'connection reset' } } }),
    'vendor-1',
    'pkg-1',
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.reason : null, 'read_failed');
});

test('a failed OPTIONS read is refused too — a choice line would save back plain', async () => {
  const res = await loadPackageDraft(
    healthy({
      vendor_package_item_options: {
        data: null,
        error: { message: 'column "pricing_basis" does not exist' },
      },
    }),
    'vendor-1',
    'pkg-1',
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.reason : null, 'read_failed');
});

test('a package that genuinely does not exist is not_found', async () => {
  const res = await loadPackageDraft(
    healthy({ vendor_packages: { data: null, error: null } }),
    'vendor-1',
    'pkg-1',
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.reason : null, 'not_found');
});

/* ── the booking count is the same fail-open shape, one level out ───────────*/

test('an unreadable booking count is NULL, never 0 — 0 unfreezes a booked package', async () => {
  // `?? 0` here is what let a BOOKED package open in structural-edit mode, and
  // the `full` scope it unlocks is the branch that deletes every item row.
  const failed = await countActiveBookings(
    healthy({
      event_vendor_packages: { data: null, error: { message: 'statement timeout' }, count: null },
    }),
    'pkg-1',
  );
  assert.equal(failed, null);

  const missingCount = await countActiveBookings(
    healthy({ event_vendor_packages: { data: null, error: null, count: null } }),
    'pkg-1',
  );
  assert.equal(missingCount, null, 'a null count is unknown, not zero');

  const real = await countActiveBookings(
    healthy({ event_vendor_packages: { data: null, error: null, count: 3 } }),
    'pkg-1',
  );
  assert.equal(real, 3, 'a real count still comes through — the guard is not vacuous');
});
