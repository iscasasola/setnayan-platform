import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PAPIC_FREE_POOL_POINTS,
  PAPIC_FREE_GRANT_SOURCE,
  freePapicGrantRow,
  isAlreadyArmedError,
} from './papic-free-grant';

const MIGRATION = join(
  process.cwd(),
  '..',
  '..',
  'supabase',
  'migrations',
  '20271017100000_papic_free_pool_grant_arm.sql',
);

test('the free pool is 50 points (owner-locked 2026-07-27)', () => {
  assert.equal(PAPIC_FREE_POOL_POINTS, 50);
});

test('the grant row is shaped for papic_event_point_grants', () => {
  const row = freePapicGrantRow('evt-1');
  assert.equal(row.event_id, 'evt-1');
  assert.equal(row.points, 50);
  // Must be one of the CHECK-constrained sources on the table, and must be the
  // one the partial unique index keys on — anything else silently disables the
  // once-per-event guarantee.
  assert.equal(row.source, 'free_grant');
  assert.equal(PAPIC_FREE_GRANT_SOURCE, 'free_grant');
});

test('DRIFT GUARD — the migration writes the same 50 the code does', () => {
  // The point count lives in two places by necessity: the backfill runs in SQL
  // before any app code, and the app arms new events. If they ever disagree,
  // events created before and after a deploy get different free allowances and
  // the card prints a number the meter does not honour. Pin them together.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(
    sql,
    new RegExp(`\\n\\s*${PAPIC_FREE_POOL_POINTS},\\n\\s*'free_grant'`),
    `Migration 20271017100000 must grant exactly ${PAPIC_FREE_POOL_POINTS} points with source 'free_grant'`,
  );
});

test('DRIFT GUARD — the migration keeps the once-per-event index PARTIAL', () => {
  // A plain unique on (event_id, source) would also cap topup_order and
  // camera_grant at one row per event, but Pool top-ups are repeatable and
  // Papic One is sold per camera — those legitimately stack. Only the free
  // grant is once-per-event, so the predicate is load-bearing.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*?papic_event_point_grants \(event_id\)\s*\n\s*WHERE source = 'free_grant'/);
});

test('a 23505 unique violation means ALREADY ARMED, not a failure', () => {
  assert.equal(isAlreadyArmedError({ code: '23505' }), true);
});

test('any other error is a real failure — the event may still be unmetered', () => {
  assert.equal(isAlreadyArmedError({ code: '42P01' }), false); // undefined_table
  assert.equal(isAlreadyArmedError({ code: '42501' }), false); // insufficient_privilege
  assert.equal(isAlreadyArmedError({ code: null }), false);
  assert.equal(isAlreadyArmedError({}), false);
  assert.equal(isAlreadyArmedError(null), false);
});
