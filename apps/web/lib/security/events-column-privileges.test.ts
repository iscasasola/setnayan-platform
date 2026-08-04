/**
 * Build-time guard for the events column-privilege migration
 * (supabase/migrations/20271005100000_events_column_update_privileges.sql).
 *
 * Reads the REAL migration text. The bottom half is a META-TEST suite: it feeds
 * deliberately-neutralized variants of that same text through the same auditor
 * and asserts each one FAILS. Without those, a green run here would prove only
 * that the auditor is silent — not that it can speak.
 *
 * The actual enforcement proof (a real Postgres, `SET ROLE authenticated`, a
 * real 42501) lives in tests/db/events-column-privileges.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CRITICAL_LOCKED,
  HOST_EDITABLE_SAMPLE,
  LOCKED_COLUMNS,
  auditMigrationSql,
  extractAssertedLockedColumns,
  extractLockedColumns,
  stripSqlComments,
} from './events-column-privileges';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20271005100000_events_column_update_privileges.sql',
);
const SQL = readFileSync(MIGRATION_PATH, 'utf8');

// ── The real migration must pass the full audit ─────────────────────────────

test('the migration passes the column-privilege audit', () => {
  const findings = auditMigrationSql(SQL);
  assert.deepEqual(
    findings,
    [],
    `column-privilege audit findings:\n${findings.map((f) => `  [${f.kind}] ${f.detail}`).join('\n')}`,
  );
});

test('every critical column is locked, named with its exploit', () => {
  const declared = extractLockedColumns(SQL);
  assert.ok(declared, 'migration declares no locked_columns array');
  for (const { column, exploit } of CRITICAL_LOCKED) {
    assert.ok(
      (declared as string[]).includes(column),
      `${column} was removed from the deny-set. Re-opened exploit: ${exploit}`,
    );
  }
});

test('the deny-set does not lock a column a host legitimately edits', () => {
  const declared = extractLockedColumns(SQL) as string[];
  for (const col of HOST_EDITABLE_SAMPLE) {
    assert.ok(
      !declared.includes(col),
      `${col} is written by a server action using the AUTHENTICATED client — locking it breaks that feature`,
    );
  }
});

test('the migration re-grants the host-editable sample in its post-condition', () => {
  // (b) of the migration's DO block. If a host-editable column is not asserted
  // there, a future edit could silently drop it from the allow-list.
  const clean = stripSqlComments(SQL);
  const idx = clean.indexOf('lost-host-write:');
  assert.notEqual(idx, -1, 'migration has no `lost-host-write:` post-condition loop');
  const head = clean.slice(0, idx);
  const open = head.lastIndexOf('ARRAY[');
  const asserted = [...clean.slice(open, idx).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const col of HOST_EDITABLE_SAMPLE) {
    assert.ok(asserted.includes(col), `${col} is not asserted still-writable by the migration`);
  }
});

test('the TS deny-set and the migration deny-set are identical', () => {
  const declared = extractLockedColumns(SQL) as string[];
  assert.deepEqual(
    [...declared].sort(),
    [...LOCKED_COLUMNS].sort(),
    'LOCKED_COLUMNS drifted from the migration — update both together',
  );
});

test('the master_qr_token collision fix ships with the migration', () => {
  const clean = stripSqlComments(SQL);
  assert.match(
    clean,
    /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+events_master_qr_token_key/i,
    'master_qr_token is host-writable and has no UNIQUE index — a host can collide with another event and break its crew registration',
  );
});

// ── META-TESTS — prove the auditor actually fails on a broken migration ─────
//
// Each case neutralizes the real SQL the way a careless edit would, and asserts
// the auditor reports the specific finding. If the auditor were vacuous (e.g. a
// regex that never matches, or an extractor that returns []), these fail.

test('META: auditor rejects a migration with no table-level REVOKE', () => {
  // Only GRANTing columns while a table-level UPDATE grant survives enforces
  // NOTHING — Postgres cannot subtract a column from a table-level privilege.
  const broken = SQL.replace(
    /EXECUTE 'REVOKE UPDATE, INSERT ON public\.events FROM authenticated, anon';/,
    "-- neutralized",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-table-revoke'), `expected missing-table-revoke, got ${kinds.join(',')}`);
});

test('META: auditor rejects a migration that forgets INSERT', () => {
  const broken = SQL.replace(/GRANT INSERT \(%s\)/, 'GRANT SELECT (%s)');
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-column-grant-insert'), `expected missing-column-grant-insert, got ${kinds.join(',')}`);
});

test('META: auditor rejects removal of a locked column', () => {
  const broken = SQL.replace(/'kwento_free_grandfathered',/, '');
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('kwento_free_grandfathered')),
    `expected unlocked-column for kwento_free_grandfathered, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects a COMMENTED-OUT locked column', () => {
  // The subtle one: a reviewer comments an entry out rather than deleting it.
  // stripSqlComments must make it invisible to the extractor.
  const broken = SQL.replace(/^(\s*)'is_sample',/m, "$1-- 'is_sample',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('is_sample')),
    `commented-out entry was still counted as locked; got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects revoking from service_role', () => {
  const broken = SQL.replace(
    /FROM authenticated, anon';/,
    "FROM authenticated, anon, service_role';",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('revokes-privileged-role'), `expected revokes-privileged-role, got ${kinds.join(',')}`);
});

test('META: auditor rejects a hand-enumerated allow-list', () => {
  const broken = SQL.replace(/<> ALL \(locked_columns\)/, "<> ALL (ARRAY['nope'])");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('allowlist-not-computed'), `expected allowlist-not-computed, got ${kinds.join(',')}`);
});

test('META: auditor rejects a deny-set that outgrows its post-condition', () => {
  // Add a column to the ARRAY but not to the assert list — it would be locked
  // without anything verifying the lock took.
  const broken = SQL.replace(/'kwento_free_grandfathered',/, "'kwento_free_grandfathered',\n    'timezone',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unasserted-column' && f.detail.includes('timezone')),
    `expected unasserted-column for timezone, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: the extractors are not silently returning empty', () => {
  // Guards the whole suite: if extractLockedColumns ever returned [], every
  // "is X locked?" assertion above would still pass for the real file only
  // because auditMigrationSql compares against it. Pin real, non-trivial sizes.
  const declared = extractLockedColumns(SQL);
  const asserted = extractAssertedLockedColumns(SQL);
  assert.ok(declared && declared.length >= 40, `expected >=40 locked columns, got ${declared?.length}`);
  assert.ok(asserted && asserted.length >= 40, `expected >=40 asserted columns, got ${asserted?.length}`);
  assert.ok(declared?.includes('live_studio_roam_manifest'));
  assert.ok(asserted?.includes('live_studio_roam_manifest'));
});
