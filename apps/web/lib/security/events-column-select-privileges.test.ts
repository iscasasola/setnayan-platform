/**
 * Build-time guard for the events column-SELECT migration
 * (supabase/migrations/20271007100000_events_column_select_privileges.sql) — SEC-2.
 *
 * Reads the REAL migration text. The bottom half is a META-TEST suite: it feeds
 * deliberately-neutralized variants of that same text through the same auditor and
 * asserts each one FAILS. Without those, a green run here would prove only that the
 * auditor is silent — not that it can speak.
 *
 * The actual enforcement proof (a real Postgres, a real `member_type='guest'` row,
 * `SET ROLE authenticated`, a real 42501) lives in
 * tests/db/events-guest-read-scope.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { LOCKED_COLUMNS } from './events-column-privileges';
import {
  CRITICAL_LOCKED_SELECT,
  GUEST_READABLE_SAMPLE,
  LOCKED_SELECT_COLUMNS,
  NOT_DENIED_FOR_SELECT,
  SELECT_MIGRATION_FILE,
  auditSelectMigrationSql,
  extractAssertedDeniedColumns,
  extractAssertedReadableColumns,
  extractLockedSelectColumns,
} from './events-column-select-privileges';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(HERE, '..', '..', '..', '..', 'supabase', 'migrations', SELECT_MIGRATION_FILE);
const SQL = readFileSync(MIGRATION_PATH, 'utf8');

// ── The real migration must pass the full audit ─────────────────────────────

test('the migration passes the column-SELECT audit', () => {
  const findings = auditSelectMigrationSql(SQL);
  assert.deepEqual(
    findings,
    [],
    `column-SELECT audit findings:\n${findings.map((f) => `  [${f.kind}] ${f.detail}`).join('\n')}`,
  );
});

test('every credential column is denied, named with its exploit', () => {
  const declared = extractLockedSelectColumns(SQL);
  assert.ok(declared, 'migration declares no locked_select_columns array');
  for (const { column, exploit } of CRITICAL_LOCKED_SELECT) {
    assert.ok(
      (declared as string[]).includes(column),
      `${column} was removed from the SELECT deny-set. Re-opened exploit: ${exploit}`,
    );
  }
});

test('the deny-set never swallows a column the guest surface reads', () => {
  const declared = extractLockedSelectColumns(SQL) as string[];
  for (const col of GUEST_READABLE_SAMPLE) {
    assert.ok(
      !declared.includes(col),
      `${col} is read by the guest's own event switcher / library — denying it breaks the guest experience`,
    );
  }
});

test('the deny-set never swallows a column a host reads with the authenticated client', () => {
  const declared = extractLockedSelectColumns(SQL) as string[];
  for (const { column, reader } of NOT_DENIED_FOR_SELECT) {
    assert.ok(
      !declared.includes(column),
      `${column} is read by ${reader} using the AUTHENTICATED client — a role-level grant cannot close it without breaking that surface`,
    );
  }
});

test('the migration asserts the guest surface survives', () => {
  const asserted = extractAssertedReadableColumns(SQL, 'lost-guest-read:');
  assert.ok(asserted, 'migration has no `lost-guest-read:` post-condition loop');
  for (const col of GUEST_READABLE_SAMPLE) {
    assert.ok(
      (asserted as string[]).includes(col),
      `${col} is not asserted still-readable by the migration — the guest switcher could silently go blank`,
    );
  }
});

test('the migration asserts the host-read surface survives', () => {
  const asserted = extractAssertedReadableColumns(SQL, 'lost-host-read:');
  assert.ok(asserted, 'migration has no `lost-host-read:` post-condition loop');
  for (const { column } of NOT_DENIED_FOR_SELECT) {
    assert.ok(
      (asserted as string[]).includes(column),
      `${column} is not asserted still-readable by the migration`,
    );
  }
});

test('the TS deny-set and the migration deny-set are identical', () => {
  const declared = extractLockedSelectColumns(SQL) as string[];
  assert.deepEqual(
    [...declared].sort(),
    [...LOCKED_SELECT_COLUMNS].sort(),
    'LOCKED_SELECT_COLUMNS drifted from the migration — update both together',
  );
});

test('the migration asserts the #3715 write grants are undisturbed', () => {
  // A REVOKE typo that also dropped UPDATE would break every host save. The
  // migration's own post-condition (e) is the guard; assert it exists.
  assert.match(
    SQL,
    /write-grants-disturbed/,
    'no post-condition proves 20271005100000 / 20271006100000 UPDATE grants survived',
  );
});

test('SELECT and WRITE deny-sets stay deliberately different', () => {
  // master_qr_token is host-WRITABLE (the rotate action) but must not be
  // host-READABLE. If someone ever "harmonises" the two lists, that distinction
  // — the whole reason two migrations exist — is lost.
  assert.ok(
    !LOCKED_COLUMNS.includes('master_qr_token'),
    'master_qr_token became write-locked — the rotate action (event-qr/actions.ts) needs UPDATE',
  );
  assert.ok(
    LOCKED_SELECT_COLUMNS.includes('master_qr_token'),
    'master_qr_token must be SELECT-denied — that is the SEC-2 finding',
  );
  assert.ok(
    LOCKED_COLUMNS.includes('photo_delivery_oauth_token_encrypted') &&
      LOCKED_SELECT_COLUMNS.includes('photo_delivery_oauth_token_encrypted'),
    'the Drive OAuth token must be denied on BOTH sides',
  );
});

// ── META-TESTS — prove the auditor actually fails on a broken migration ─────

test('META: auditor rejects a migration with no table-level REVOKE', () => {
  const broken = SQL.replace(
    /EXECUTE 'REVOKE SELECT ON public\.events FROM authenticated, anon';/,
    '-- neutralized',
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditSelectMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-table-revoke'), `expected missing-table-revoke, got ${kinds.join(',')}`);
});

test('META: auditor rejects a REVOKE that spares anon', () => {
  // The anon key is the PUBLIC one. Revoking from authenticated only would leave
  // the columns readable by any unauthenticated PostgREST caller the moment a
  // permissive anon SELECT policy is ever added.
  const broken = SQL.replace(
    /REVOKE SELECT ON public\.events FROM authenticated, anon/,
    'REVOKE SELECT ON public.events FROM authenticated',
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditSelectMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('missing-table-revoke'), `expected missing-table-revoke, got ${kinds.join(',')}`);
});

test('META: auditor rejects removal of a denied column', () => {
  const broken = SQL.replace(/^(\s*)'master_qr_token',$/m, '');
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditSelectMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('master_qr_token')),
    `expected unlocked-column for master_qr_token, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects a COMMENTED-OUT denied column', () => {
  const broken = SQL.replace(
    /^(\s*)'photo_delivery_oauth_token_encrypted',$/m,
    "$1-- 'photo_delivery_oauth_token_encrypted',",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditSelectMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unlocked-column' && f.detail.includes('photo_delivery_oauth_token_encrypted')),
    `commented-out entry was still counted as denied; got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects revoking from service_role', () => {
  const broken = SQL.replace(
    /FROM authenticated, anon';/,
    "FROM authenticated, anon, service_role';",
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditSelectMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('revokes-privileged-role'), `expected revokes-privileged-role, got ${kinds.join(',')}`);
});

test('META: auditor rejects collaterally revoking the write grants', () => {
  const broken = SQL.replace(
    /REVOKE SELECT ON public\.events FROM authenticated, anon/,
    'REVOKE SELECT, UPDATE ON public.events FROM authenticated, anon',
  );
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditSelectMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('revokes-write'), `expected revokes-write, got ${kinds.join(',')}`);
});

test('META: auditor rejects a hand-enumerated allow-list', () => {
  const broken = SQL.replace(/<> ALL \(locked_select_columns\)/, "<> ALL (ARRAY['nope'])");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const kinds = auditSelectMigrationSql(broken).map((f) => f.kind);
  assert.ok(kinds.includes('allowlist-not-computed'), `expected allowlist-not-computed, got ${kinds.join(',')}`);
});

test('META: auditor rejects denying a column the guest surface needs', () => {
  const broken = SQL.replace(/^(\s*)'master_qr_token',$/m, "$1'master_qr_token',\n    'display_name',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditSelectMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'denies-guest-surface' && f.detail.includes('display_name')),
    `expected denies-guest-surface for display_name, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects denying a column the host reads', () => {
  const broken = SQL.replace(/^(\s*)'master_qr_token',$/m, "$1'master_qr_token',\n    'wizard_state',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditSelectMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'denies-host-read' && f.detail.includes('wizard_state')),
    `expected denies-host-read for wizard_state, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: auditor rejects a deny-set that outgrows its post-condition', () => {
  const broken = SQL.replace(/^(\s*)'master_qr_token',$/m, "$1'master_qr_token',\n    'papic_style',");
  assert.notEqual(broken, SQL, 'meta-test failed to modify the SQL — update the pattern');
  const findings = auditSelectMigrationSql(broken);
  assert.ok(
    findings.some((f) => f.kind === 'unasserted-column' && f.detail.includes('papic_style')),
    `expected unasserted-column for papic_style, got ${findings.map((f) => f.kind).join(',')}`,
  );
});

test('META: the extractors are not silently returning empty', () => {
  const declared = extractLockedSelectColumns(SQL);
  const asserted = extractAssertedDeniedColumns(SQL);
  const guest = extractAssertedReadableColumns(SQL, 'lost-guest-read:');
  assert.ok(declared && declared.length === LOCKED_SELECT_COLUMNS.length, `got ${declared?.length}`);
  assert.ok(asserted && asserted.length === LOCKED_SELECT_COLUMNS.length, `got ${asserted?.length}`);
  assert.ok(guest && guest.length >= GUEST_READABLE_SAMPLE.length, `got ${guest?.length}`);
  assert.ok(declared?.includes('master_qr_token'));
  assert.ok(asserted?.includes('master_qr_token'));
  assert.ok(guest?.includes('display_name'));
});
