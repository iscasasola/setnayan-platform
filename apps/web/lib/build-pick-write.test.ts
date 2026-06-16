/**
 * Unit suite for the build-pick WRITE cores (`pinBuildPickRow`,
 * `removeBuildPickRow`). Where `build-pick-rules.test.ts` proves the DECISION is
 * right, this file proves the write PATH honors it — using a fake recorder
 * client that captures every delete/upsert and its filters. The load-bearing
 * assertions:
 *   • pinning into a MULTI-pick category issues NO delete (can't wipe siblings)
 *   • pinning into a single-pick category clears OTHER vendors only (scoped .neq)
 *   • removing a pick targets EXACTLY one vendor (three .eq, never a bare clear)
 * If a future edit drops the guard in the write path, the first assertion fails.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pinBuildPickRow, removeBuildPickRow, BUILD_PICK_ON_CONFLICT } from './build-pick-write';

const NOW = '2026-01-01T00:00:00.000Z';
const MULTI = 'attire'; // catalogFolder 'look' → multi-pick
const SINGLE = 'catering'; // single-pick

type Filter = { op: 'eq' | 'neq'; col: string; val: string };
type RecordedOp = {
  kind: 'delete' | 'upsert';
  table: string;
  filters: Filter[];
  values?: Record<string, unknown>;
  onConflict?: string;
};

/** A minimal stand-in for the Supabase server client that records every write
 *  this module makes (and can be told to fail a given op). */
function recorderClient(failOn?: 'delete' | 'upsert') {
  const ops: RecordedOp[] = [];
  const awaitable = (op: RecordedOp) => {
    const result = { error: failOn === op.kind ? { message: `${op.kind} failed` } : null };
    const builder = {
      eq(col: string, val: string) {
        op.filters.push({ op: 'eq', col, val });
        return builder;
      },
      neq(col: string, val: string) {
        op.filters.push({ op: 'neq', col, val });
        return builder;
      },
      then(resolve: (v: typeof result) => void) {
        resolve(result);
      },
    };
    return builder;
  };
  const client = {
    from(table: string) {
      return {
        delete() {
          const op: RecordedOp = { kind: 'delete', table, filters: [] };
          ops.push(op);
          return awaitable(op);
        },
        upsert(values: Record<string, unknown>, options: { onConflict: string }) {
          const op: RecordedOp = {
            kind: 'upsert',
            table,
            filters: [],
            values,
            onConflict: options.onConflict,
          };
          ops.push(op);
          return awaitable(op);
        },
      };
    },
  };
  return { client, ops };
}

// The cores type their client against the generated DB schema; the recorder is a
// structural stand-in, so cast through `unknown` at the seam.
const asClient = (c: unknown) => c as Parameters<typeof pinBuildPickRow>[0];

/** Read a recorded op, asserting it exists (narrows away `T | undefined` from
 *  the indexed access under noUncheckedIndexedAccess). */
function opAt(ops: RecordedOp[], i: number): RecordedOp {
  const op = ops[i];
  if (!op) throw new Error(`expected a recorded op at index ${i}`);
  return op;
}

test('pinning into a MULTI-pick category issues NO delete (sibling picks survive)', async () => {
  const { client, ops } = recorderClient();
  const err = await pinBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: MULTI,
    vendorId: 'v1',
    pickedBy: 'u1',
    now: NOW,
  });
  assert.equal(err, null);
  assert.equal(ops.filter((o) => o.kind === 'delete').length, 0, 'multi-pick pin must not delete');
  assert.equal(ops.length, 1);
  assert.equal(opAt(ops, 0).kind, 'upsert');
  assert.equal(opAt(ops, 0).onConflict, BUILD_PICK_ON_CONFLICT);
  assert.deepEqual(opAt(ops, 0).values, {
    event_id: 'e1',
    plan_group_id: MULTI,
    vendor_id: 'v1',
    picked_by: 'u1',
    updated_at: NOW,
  });
});

test('pinning into a single-pick category clears OTHER vendors only, then upserts', async () => {
  const { client, ops } = recorderClient();
  const err = await pinBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: SINGLE,
    vendorId: 'v9',
    pickedBy: 'u1',
    now: NOW,
  });
  assert.equal(err, null);
  assert.equal(ops.length, 2);
  assert.equal(opAt(ops, 0).kind, 'delete');
  assert.deepEqual(opAt(ops, 0).filters, [
    { op: 'eq', col: 'event_id', val: 'e1' },
    { op: 'eq', col: 'plan_group_id', val: SINGLE },
    { op: 'neq', col: 'vendor_id', val: 'v9' }, // keeps the vendor being pinned
  ]);
  assert.equal(opAt(ops, 1).kind, 'upsert');
  assert.equal(opAt(ops, 1).onConflict, BUILD_PICK_ON_CONFLICT);
});

test('removeBuildPickRow targets EXACTLY one vendor (never a whole-category clear)', async () => {
  const { client, ops } = recorderClient();
  const err = await removeBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: MULTI,
    vendorId: 'v2',
  });
  assert.equal(err, null);
  assert.equal(ops.length, 1);
  assert.equal(opAt(ops, 0).kind, 'delete');
  assert.deepEqual(opAt(ops, 0).filters, [
    { op: 'eq', col: 'event_id', val: 'e1' },
    { op: 'eq', col: 'plan_group_id', val: MULTI },
    { op: 'eq', col: 'vendor_id', val: 'v2' },
  ]);
  assert.ok(
    !opAt(ops, 0).filters.some((f) => f.op === 'neq'),
    'remove must scope to one vendor, not clear the category',
  );
});

test('pin surfaces a single-pick delete error and skips the upsert', async () => {
  const { client, ops } = recorderClient('delete');
  const err = await pinBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: SINGLE,
    vendorId: 'v9',
    pickedBy: 'u1',
    now: NOW,
  });
  assert.equal(err, 'delete failed');
  assert.equal(ops.length, 1, 'must bail before upserting when the clear fails');
});

test('pin surfaces an upsert error', async () => {
  const { client } = recorderClient('upsert');
  const err = await pinBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: MULTI,
    vendorId: 'v1',
    pickedBy: 'u1',
    now: NOW,
  });
  assert.equal(err, 'upsert failed');
});

test('removeBuildPickRow surfaces a delete error', async () => {
  const { client } = recorderClient('delete');
  const err = await removeBuildPickRow(asClient(client), {
    eventId: 'e1',
    planGroupId: MULTI,
    vendorId: 'v2',
  });
  assert.equal(err, 'delete failed');
});
