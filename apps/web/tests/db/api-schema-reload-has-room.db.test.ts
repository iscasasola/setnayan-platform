/**
 * Migration 20271269636634 gives PostgREST's `authenticator` 30 s so a slow
 * schema-cache reload finishes instead of failing every API call with PGRST002
 * (measured outages 2026-10-15 16:37 and 2026-10-16 07:35).
 *
 * service_role has no timeout of its own and falls back to authenticator's.
 * The migration pins it at 8 s, so raising authenticator never quietly lets
 * service-role calls run 30 s. This test holds that pin. The replay has no
 * `authenticator` role, so that half is checked in production:
 *   select rolname, rolconfig from pg_roles
 *   where rolname in ('authenticator','service_role');
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the migration applied, not skipped', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file.includes('api_schema_reload_has_room')),
    'api_schema_reload_has_room was skipped by the replay',
  );
});

test('service_role keeps its own 8 s, so it never inherits authenticator’s 30 s', async () => {
  const r = await db.query<{ cfg: string[] | null }>(
    `SELECT rolconfig AS cfg FROM pg_roles WHERE rolname = 'service_role'`,
  );
  assert.ok((r.rows[0]?.cfg ?? []).includes('statement_timeout=8s'), JSON.stringify(r.rows[0]?.cfg));
});
