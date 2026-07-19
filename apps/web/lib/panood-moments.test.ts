/**
 * Panood moment-director data-layer invariants (Node built-in test runner, run via
 * tsx). Guards the pure, deterministic behaviors of lib/panood-moments.ts — the
 * half of the moment layer that doesn't touch Supabase, plus the seed-only-when-
 * empty provisioning logic exercised through a fake builder:
 *
 *   1. DEFAULT_MOMENTS — the seeded spine has the right 8 beats in order, every
 *      entry has a non-empty label + a valid ti-* icon, and macros are well-formed.
 *   2. PROVISIONING — provisionPanoodMomentsAdmin seeds the full spine ONLY when
 *      the event has no moments yet (idempotent; never re-seeds; never throws).
 *   3. CREATE/UPDATE — createPanoodMomentAdmin / updatePanoodMomentAdmin write the
 *      right shapes and return true/false on the right inputs (best-effort).
 *   4. GRACEFUL-DEGRADE — fetchPanoodMoments() returns [] on a missing table
 *      (42P01) / column (42703) instead of throwing.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MOMENTS,
  createPanoodMomentAdmin,
  fetchPanoodMoments,
  provisionPanoodMomentsAdmin,
  updatePanoodMomentAdmin,
} from './panood-moments';

// ── 1. DEFAULT_MOMENTS shape ─────────────────────────────────────────────────

test('DEFAULT_MOMENTS is the expected 8-beat ceremony→reception spine in order', () => {
  assert.deepEqual(
    DEFAULT_MOMENTS.map((m) => m.label),
    [
      'Processional',
      'Vows',
      'The Kiss',
      'Grand Entrance',
      'First Dance',
      'Speeches',
      'Cake Cutting',
      'Toast',
    ],
  );
});

test('every DEFAULT_MOMENTS entry has a non-empty label and a valid ti-* icon', () => {
  for (const m of DEFAULT_MOMENTS) {
    assert.equal(typeof m.label, 'string');
    assert.ok(m.label.length > 0, `moment label is empty`);
    assert.match(m.icon, /^ti-[a-z0-9-]+$/, `icon "${m.icon}" is not a valid ti-* name`);
  }
});

test('every DEFAULT_MOMENTS macro is well-formed (known keys, right types)', () => {
  for (const m of DEFAULT_MOMENTS) {
    const c = m.config;
    assert.equal(typeof c, 'object');
    if (c.program_source !== undefined) assert.equal(typeof c.program_source, 'string');
    if (c.walls_source !== undefined) assert.equal(typeof c.walls_source, 'string');
    if (c.audio_duck !== undefined) assert.equal(typeof c.audio_duck, 'boolean');
    if (c.banner_label !== undefined) assert.equal(typeof c.banner_label, 'string');
    if (c.banner_icon !== undefined) {
      assert.match(c.banner_icon, /^ti-[a-z0-9-]+$/, `banner_icon "${c.banner_icon}" invalid`);
    }
    if (c.overlays !== undefined) {
      assert.ok(Array.isArray(c.overlays), 'overlays is not an array');
      for (const o of c.overlays) assert.equal(typeof o, 'string');
    }
  }
});

test('every DEFAULT_MOMENTS entry sets a program_source (a moment always cuts a feed)', () => {
  for (const m of DEFAULT_MOMENTS) {
    assert.equal(typeof m.config.program_source, 'string');
    assert.ok((m.config.program_source ?? '').length > 0);
  }
});

// ── 2. Provisioning (seed-only-when-empty) ───────────────────────────────────

// Minimal Supabase stub for provisionPanoodMomentsAdmin: a head/count select on
// panood_moments then (conditionally) an insert. `countResult` drives the
// existing-rows check; `insertResult` drives the seed write. Records the inserted
// payload so the test can assert the seeded shape.
function fakeProvisionSupabase(
  countResult: { count: number | null; error: unknown },
  insertResult: { error: unknown } = { error: null },
) {
  const calls: { insert?: unknown } = {};
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => Promise.resolve(countResult),
    insert: (payload: unknown) => {
      calls.insert = payload;
      return Promise.resolve(insertResult);
    },
  };
  return {
    admin: { from: () => builder } as unknown as Parameters<typeof provisionPanoodMomentsAdmin>[0],
    calls,
  };
}

test('provisionPanoodMomentsAdmin seeds the full spine when the event has no moments', async () => {
  const { admin, calls } = fakeProvisionSupabase({ count: 0, error: null });
  const n = await provisionPanoodMomentsAdmin(admin, 'evt-1');
  assert.equal(n, DEFAULT_MOMENTS.length);
  const rows = calls.insert as Array<Record<string, unknown>>;
  assert.equal(rows.length, DEFAULT_MOMENTS.length);
  assert.equal(rows[0]?.event_id, 'evt-1');
  assert.equal(rows[0]?.label, 'Processional');
  assert.equal(rows[0]?.sort_order, 0);
  assert.equal(rows[0]?.is_default, true);
});

test('provisionPanoodMomentsAdmin is a no-op when the event already has moments', async () => {
  const { admin, calls } = fakeProvisionSupabase({ count: 3, error: null });
  const n = await provisionPanoodMomentsAdmin(admin, 'evt-1');
  assert.equal(n, 0);
  assert.equal(calls.insert, undefined, 'no seed should be attempted when moments exist');
});

test('provisionPanoodMomentsAdmin returns 0 on a missing table (42P01) without throwing', async () => {
  const { admin } = fakeProvisionSupabase({ count: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.equal(await provisionPanoodMomentsAdmin(admin, 'evt-1'), 0);
});

test('provisionPanoodMomentsAdmin returns 0 on bad input', async () => {
  const { admin } = fakeProvisionSupabase({ count: 0, error: null });
  assert.equal(await provisionPanoodMomentsAdmin(admin, ''), 0);
});

test('provisionPanoodMomentsAdmin returns 0 when the seed insert fails (never throws)', async () => {
  const { admin } = fakeProvisionSupabase({ count: 0, error: null }, { error: { code: '23505', message: 'dup' } });
  assert.equal(await provisionPanoodMomentsAdmin(admin, 'evt-1'), 0);
});

// ── 3. Create / update ───────────────────────────────────────────────────────

// Minimal insert/update builder stub: records the written payload and resolves to
// a PostgREST-style { error } payload.
function fakeWriteSupabase(result: { error: unknown }) {
  const calls: { insert?: unknown; update?: unknown } = {};
  const builder: Record<string, unknown> = {
    insert: (payload: unknown) => {
      calls.insert = payload;
      return Promise.resolve(result);
    },
    update: (payload: unknown) => {
      calls.update = payload;
      return builder;
    },
    eq: () => Promise.resolve(result),
  };
  return {
    admin: { from: () => builder } as unknown as Parameters<typeof createPanoodMomentAdmin>[0],
    calls,
  };
}

test('createPanoodMomentAdmin inserts a non-default custom moment and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  const ok = await createPanoodMomentAdmin(admin, 'evt-1', {
    label: 'Bouquet Toss',
    icon: 'ti-flower',
    config: { program_source: 'cam1' },
    sortOrder: 9,
  });
  assert.equal(ok, true);
  const row = calls.insert as Record<string, unknown>;
  assert.equal(row.event_id, 'evt-1');
  assert.equal(row.label, 'Bouquet Toss');
  assert.equal(row.icon, 'ti-flower');
  assert.equal(row.sort_order, 9);
  assert.equal(row.is_default, false);
});

test('createPanoodMomentAdmin rejects a missing label without touching the DB', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await createPanoodMomentAdmin(admin, 'evt-1', { label: '' }), false);
  assert.equal(calls.insert, undefined);
});

test('createPanoodMomentAdmin returns false on a DB error (never throws)', async () => {
  const { admin } = fakeWriteSupabase({ error: { code: '08006', message: 'connection failure' } });
  assert.equal(await createPanoodMomentAdmin(admin, 'evt-1', { label: 'X' }), false);
});

test('updatePanoodMomentAdmin patches label/config + updated_at and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  const ok = await updatePanoodMomentAdmin(admin, 5, { label: 'Renamed', config: { audio_duck: true } });
  assert.equal(ok, true);
  const payload = calls.update as Record<string, unknown>;
  assert.equal(payload.label, 'Renamed');
  assert.deepEqual(payload.config, { audio_duck: true });
  assert.equal(typeof payload.updated_at, 'string');
});

test('updatePanoodMomentAdmin rejects a bad id and an empty patch without touching the DB', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await updatePanoodMomentAdmin(admin, 0, { label: 'X' }), false);
  assert.equal(await updatePanoodMomentAdmin(admin, 5, {}), false);
  assert.equal(calls.update, undefined, 'no update should be attempted on bad input / empty patch');
});

// ── 4. Graceful-degrade ──────────────────────────────────────────────────────

// Minimal Supabase query-builder stub that resolves the awaited builder to a
// PostgREST-style { data, error } payload — same fake-builder shape the prior
// panood reads expect.
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(result),
  };
  return { from: () => builder } as unknown as Parameters<typeof fetchPanoodMoments>[0];
}

test('fetchPanoodMoments returns [] when the table is missing (42P01)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.deepEqual(await fetchPanoodMoments(supabase, 'evt-1'), []);
});

test('fetchPanoodMoments returns [] when a column is missing (42703)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42703', message: 'undefined_column' } });
  assert.deepEqual(await fetchPanoodMoments(supabase, 'evt-1'), []);
});

test('fetchPanoodMoments throws on an unexpected error', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '08006', message: 'connection failure' } });
  await assert.rejects(() => fetchPanoodMoments(supabase, 'evt-1'), /connection failure/);
});

test('fetchPanoodMoments passes rows through on success', async () => {
  const rows = [{ id: 1, sort_order: 0, label: 'Processional' }];
  const supabase = fakeSupabase({ data: rows, error: null });
  assert.deepEqual(await fetchPanoodMoments(supabase, 'evt-1'), rows);
});
