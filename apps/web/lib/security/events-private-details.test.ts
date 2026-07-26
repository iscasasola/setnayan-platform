/**
 * SEC-2b — static audit of migration 20271008731642 (the SQL text itself).
 *
 * The load-bearing suite is tests/db/events-private-details.db.test.ts, which
 * replays the whole corpus into PGlite and proves ENFORCEMENT as a genuinely
 * unprivileged role. This file is the cheap, always-runs companion: it proves
 * the migration cannot be quietly HOLLOWED OUT while still looking like it does
 * the job — a column dropped from the deny-set, an `anon` spared by the revoke,
 * a hand-typed allow-list, a host view that forgot security_invoker=false.
 *
 * Every "the auditor rejects X" test below MUTATES the real migration text and
 * asserts the auditor complains. That is what stops this file from becoming the
 * third vacuous test in this repo's history: an auditor that returns [] for
 * everything would fail all nine META tests.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import {
  CRITICAL_PRIVATE,
  GUEST_READABLE_SAMPLE,
  MIGRATED_HOST_READERS,
  PRIVATE_MIGRATION_FILE,
  PRIVATE_SELECT_COLUMNS,
  SEC2_LOCKED_COLUMNS,
  auditPrivateDetailsMigrationSql,
  extractAssertedColumns,
  extractPrivateColumns,
} from './events-private-details';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '../../../../supabase/migrations');
const SQL = readFileSync(join(MIGRATIONS_DIR, PRIVATE_MIGRATION_FILE), 'utf8');

test('the migration passes the private-details audit', () => {
  const findings = auditPrivateDetailsMigrationSql(SQL);
  assert.deepEqual(
    findings,
    [],
    `audit findings:\n  ${findings.map((f) => `${f.kind}: ${f.detail}`).join('\n  ')}`,
  );
});

test('the TS deny-set and the migration deny-set are identical', () => {
  const declared = extractPrivateColumns(SQL);
  assert.ok(declared, 'private_columns ARRAY[…] not found in the migration');
  assert.deepEqual(
    [...declared].sort(),
    [...PRIVATE_SELECT_COLUMNS].sort(),
    'PRIVATE_SELECT_COLUMNS drifted from the migration — update both together',
  );
});

test('every private column is named with the concrete harm a leak does', () => {
  for (const { column, harm } of CRITICAL_PRIVATE) {
    assert.ok(
      PRIVATE_SELECT_COLUMNS.includes(column),
      `${column} was removed from the deny-set. It leaks: ${harm}`,
    );
  }
  assert.ok(CRITICAL_PRIVATE.length >= 4, 'the harm catalogue was gutted');
});

test('the deny-set never swallows a column the guest surface reads', () => {
  // The owner's requirement has two halves. "Guests cannot see budget and
  // birthdate" is the deny-set; "just event date" is this — the guest keeps a
  // working switcher, library and event date.
  for (const col of GUEST_READABLE_SAMPLE) {
    assert.ok(
      !PRIVATE_SELECT_COLUMNS.includes(col),
      `${col} is on the guest surface — denying it blanks the guest's switcher and library`,
    );
  }
  assert.ok(GUEST_READABLE_SAMPLE.includes('event_date'), 'the "just event date" guarantee was dropped');
});

test('the migration asserts the guest surface survives', () => {
  const asserted = extractAssertedColumns(SQL, 'lost-guest-read:');
  assert.ok(asserted, 'post-condition (c) is gone — nothing stops a future edit blanking the guest');
  for (const col of GUEST_READABLE_SAMPLE) {
    assert.ok(asserted.includes(col), `${col} is not covered by post-condition (c)`);
  }
});

test('the migration re-asserts the SEC-2 deny-set (the union property)', () => {
  const asserted = extractAssertedColumns(SQL, 'sec2-regressed:');
  assert.ok(asserted, 'post-condition (b) is gone — a recomputed allow-list could silently undo SEC-2');
  for (const col of SEC2_LOCKED_COLUMNS) {
    assert.ok(asserted.includes(col), `${col} is not covered by post-condition (b)`);
  }
});

test('SEC-2b and SEC-2 deny-sets stay deliberately disjoint', () => {
  // Different problems. SEC-2's three are CREDENTIALS with no authenticated
  // reader at all — a bare revoke was enough. SEC-2b's eleven are PERSONAL DATA
  // the couple reads every day, which is why they needed the host view.
  for (const col of SEC2_LOCKED_COLUMNS) {
    assert.ok(!PRIVATE_SELECT_COLUMNS.includes(col), `${col} is claimed by both deny-sets`);
  }
});

test('the migrated reader list covers the surfaces that render these columns', () => {
  // A regression tell: if someone points one of these back at .from('events')
  // it will 42501 in production. The list is the review checklist.
  for (const f of [
    'app/dashboard/[eventId]/details/page.tsx',
    'app/dashboard/[eventId]/budget/page.tsx',
    'app/dashboard/[eventId]/wizard-actions.ts',
    'app/dashboard/[eventId]/studio/photo-delivery/page.tsx',
    'app/api/profile/export/route.ts',
  ]) {
    assert.ok(MIGRATED_HOST_READERS.includes(f), `${f} dropped off the migrated-reader list`);
  }
});

// ── META: the auditor must actually reject things ───────────────────────────
// Each test neutralises the REAL migration text one way and asserts a finding.
// Without these, an auditor that returned [] unconditionally would pass
// everything above.

function expectFinding(mutated: string, kind: string): void {
  const kinds = auditPrivateDetailsMigrationSql(mutated).map((f) => f.kind);
  assert.ok(kinds.includes(kind), `expected a "${kind}" finding, got: ${kinds.join(', ') || '(none)'}`);
}

test('META: auditor rejects a migration with no table-level REVOKE', () => {
  expectFinding(SQL.replace(/REVOKE SELECT ON public\.events FROM/g, 'SELECT 1 --'), 'no-revoke');
});

test('META: auditor rejects a revoke that never names anon', () => {
  expectFinding(SQL.replace(/'anon'/g, "'authenticated'"), 'role-spared');
});

test('META: auditor rejects revoking from service_role', () => {
  expectFinding(
    SQL.replace(
      "EXECUTE 'GRANT SELECT ON public.events TO service_role';",
      "EXECUTE 'REVOKE SELECT ON public.events FROM service_role';",
    ),
    'revokes-service-role',
  );
});

test('META: auditor rejects a hand-enumerated allow-list', () => {
  expectFinding(SQL.replace(/has_column_privilege\(\s*role_name/g, 'FALSE AND (role_name'), 'hand-enumerated-grant');
});

test('META: auditor rejects removal of a denied column', () => {
  expectFinding(SQL.replace("    'wizard_state',\n", ''), 'missing-denial');
});

test('META: auditor rejects a COMMENTED-OUT denied column', () => {
  // stripSqlComments is what makes this detectable; a naive substring search
  // would still "find" the column inside the comment and pass.
  expectFinding(SQL.replace("    'wizard_state',", "    -- 'wizard_state',"), 'missing-denial');
});

test('META: auditor rejects denying a column the guest surface needs', () => {
  expectFinding(SQL.replace("    'wizard_state',", "    'event_date',\n    'wizard_state',"), 'denies-guest-read');
});

test('META: auditor rejects a host view that is not a definer view', () => {
  expectFinding(SQL.replace(/security_invoker\s*=\s*false/gi, 'security_invoker = true'), 'view-not-definer');
});

test('META: auditor rejects an unscoped host view', () => {
  expectFinding(SQL.replace(/current_moderator_event_ids\(\)/g, 'FALSE --'), 'view-unscoped');
});

test('META: auditor rejects a WRITABLE host view', () => {
  expectFinding(
    SQL.replace(
      'GRANT SELECT ON public.events_host TO authenticated, service_role;',
      'GRANT SELECT ON public.events_host TO authenticated, service_role;\nGRANT UPDATE ON public.events_host TO authenticated;',
    ),
    'view-writable',
  );
});

test('META: auditor rejects a host view left open to anon', () => {
  expectFinding(SQL.replace('REVOKE ALL ON public.events_host FROM anon;', ''), 'view-open-to-anon');
});

test('META: auditor rejects a deny-set that outgrows its post-condition', () => {
  // Adding a column to private_columns without also adding it to (a) means the
  // migration would "succeed" while enforcing nothing for that column.
  expectFinding(SQL.replace("    'wizard_state',", "    'mahr_description',\n    'wizard_state',"), 'unasserted-denial');
});

test('META: the extractors are not silently returning empty', () => {
  // Every assertion above rests on these. If an extractor started returning []
  // or null, the tests would pass by finding nothing to complain about.
  const declared = extractPrivateColumns(SQL);
  const deniedAssert = extractAssertedColumns(SQL, 'still-readable:');
  const guestAssert = extractAssertedColumns(SQL, 'lost-guest-read:');
  const sec2Assert = extractAssertedColumns(SQL, 'sec2-regressed:');
  assert.equal(declared?.length, PRIVATE_SELECT_COLUMNS.length, `declared: ${declared?.length}`);
  assert.equal(deniedAssert?.length, PRIVATE_SELECT_COLUMNS.length, `(a): ${deniedAssert?.length}`);
  assert.ok((guestAssert?.length ?? 0) >= GUEST_READABLE_SAMPLE.length, `(c): ${guestAssert?.length}`);
  assert.equal(sec2Assert?.length, SEC2_LOCKED_COLUMNS.length, `(b): ${sec2Assert?.length}`);
});
