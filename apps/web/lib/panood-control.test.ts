/**
 * Panood live control-plane data-layer invariants (Node built-in test runner, run
 * via tsx). Guards the deterministic behaviors of lib/panood-control.ts — the
 * single-row-per-event program/preview/routing state, exercised through a fake
 * Supabase builder:
 *
 *   1. GET-OR-INIT — fetchOrInitControlStateAdmin upserts the row (idempotent on
 *      event_id) then reads it back; returns null on a pre-bootstrap DB.
 *   2. SETTERS — setProgramSource / setPreviewSource / setDirectorMode / setLive /
 *      applyMoment each upsert the right field + a fresh updated_at, return
 *      true/false on the right shapes, and never throw.
 *   3. INPUT GUARDS — bad eventId / bad momentId are rejected without touching DB.
 *   4. GRACEFUL-DEGRADE — a missing table (42P01) returns null / false, not a throw.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMomentAdmin,
  fetchOrInitControlStateAdmin,
  setDirectorModeAdmin,
  setLiveAdmin,
  setPreviewSourceAdmin,
  setProgramSourceAdmin,
} from './panood-control';

// ── Fakes ────────────────────────────────────────────────────────────────────

// Builder for the SETTERS + get-or-init upsert: records the upserted payload and
// resolves the awaited upsert to a PostgREST-style { error }. select/eq/maybeSingle
// support the read-back leg of fetchOrInitControlStateAdmin.
function fakeWriteSupabase(
  upsertResult: { error: unknown },
  readResult: { data: unknown; error: unknown } = { data: null, error: null },
) {
  const calls: { upsert?: unknown } = {};
  const builder: Record<string, unknown> = {
    upsert: (payload: unknown) => {
      calls.upsert = payload;
      return Promise.resolve(upsertResult);
    },
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(readResult),
  };
  return {
    admin: { from: () => builder } as unknown as Parameters<typeof setProgramSourceAdmin>[0],
    calls,
  };
}

// ── 1. Get-or-init ───────────────────────────────────────────────────────────

test('fetchOrInitControlStateAdmin upserts on event_id then returns the row', async () => {
  const row = {
    id: 1,
    event_id: 'evt-1',
    program_source: null,
    preview_source: null,
    director_mode: false,
    is_live: false,
    active_moment_id: null,
    updated_at: '2026-06-26T00:00:00Z',
  };
  const { admin, calls } = fakeWriteSupabase({ error: null }, { data: row, error: null });
  const got = await fetchOrInitControlStateAdmin(admin, 'evt-1');
  assert.deepEqual(got, row);
  const payload = calls.upsert as Record<string, unknown>;
  assert.equal(payload.event_id, 'evt-1');
});

test('fetchOrInitControlStateAdmin returns null on a missing table (42P01)', async () => {
  const { admin } = fakeWriteSupabase({ error: { code: '42P01', message: 'undefined_table' } });
  assert.equal(await fetchOrInitControlStateAdmin(admin, 'evt-1'), null);
});

test('fetchOrInitControlStateAdmin returns null on a missing eventId', async () => {
  const { admin } = fakeWriteSupabase({ error: null }, { data: null, error: null });
  assert.equal(await fetchOrInitControlStateAdmin(admin, ''), null);
});

// ── 2. Setters ───────────────────────────────────────────────────────────────

test('setProgramSourceAdmin upserts program_source + event_id + updated_at and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  const ok = await setProgramSourceAdmin(admin, 'evt-1', 'cam2');
  assert.equal(ok, true);
  const payload = calls.upsert as Record<string, unknown>;
  assert.equal(payload.event_id, 'evt-1');
  assert.equal(payload.program_source, 'cam2');
  assert.equal(typeof payload.updated_at, 'string');
});

test('setPreviewSourceAdmin upserts preview_source and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await setPreviewSourceAdmin(admin, 'evt-1', 'cam1'), true);
  assert.equal((calls.upsert as Record<string, unknown>).preview_source, 'cam1');
});

test('setDirectorModeAdmin coerces to a real boolean', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await setDirectorModeAdmin(admin, 'evt-1', true), true);
  assert.equal((calls.upsert as Record<string, unknown>).director_mode, true);
});

test('setLiveAdmin upserts is_live and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await setLiveAdmin(admin, 'evt-1', true), true);
  assert.equal((calls.upsert as Record<string, unknown>).is_live, true);
});

test('applyMomentAdmin upserts active_moment_id and returns true', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await applyMomentAdmin(admin, 'evt-1', 7), true);
  assert.equal((calls.upsert as Record<string, unknown>).active_moment_id, 7);
});

test('applyMomentAdmin accepts null to clear the active moment (back to manual)', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await applyMomentAdmin(admin, 'evt-1', null), true);
  assert.equal((calls.upsert as Record<string, unknown>).active_moment_id, null);
});

// ── 3. Input guards ──────────────────────────────────────────────────────────

test('setters reject a missing eventId without touching the DB', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await setProgramSourceAdmin(admin, '', 'cam1'), false);
  assert.equal(await setLiveAdmin(admin, '', true), false);
  assert.equal(calls.upsert, undefined, 'no upsert should be attempted on a missing eventId');
});

test('applyMomentAdmin rejects a non-positive momentId without touching the DB', async () => {
  const { admin, calls } = fakeWriteSupabase({ error: null });
  assert.equal(await applyMomentAdmin(admin, 'evt-1', 0), false);
  assert.equal(await applyMomentAdmin(admin, 'evt-1', -3), false);
  assert.equal(calls.upsert, undefined, 'no upsert should be attempted on a bad momentId');
});

// ── 4. Graceful-degrade ──────────────────────────────────────────────────────

test('setters return false on a DB error (never throw)', async () => {
  const { admin } = fakeWriteSupabase({ error: { code: '42P01', message: 'undefined_table' } });
  assert.equal(await setProgramSourceAdmin(admin, 'evt-1', 'cam1'), false);
  assert.equal(await setDirectorModeAdmin(admin, 'evt-1', true), false);
  assert.equal(await applyMomentAdmin(admin, 'evt-1', 4), false);
});
