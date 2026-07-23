/**
 * Guards the RLS guest-scope hardening migration
 * (supabase/migrations/20270831174208_rls_guest_scope.sql).
 *
 * The migration re-scopes sensitive policies off the guest-admitting
 * current_event_ids() helper. If any DROP/CREATE regresses back to
 * current_event_ids (or drops a policy), a plain guest regains read/write on
 * tokens, orders, payments, biometrics, or another guest's qr_token. This test
 * reads the real migration text and fails on any such regression.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  RESCOPED_POLICIES,
  auditMigrationSql,
  extractCreatePolicy,
  referencesUnscopedHelper,
} from './rls-guest-scope-audit';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20270831174208_rls_guest_scope.sql',
);

const SQL = readFileSync(MIGRATION_PATH, 'utf8');

// ── The real migration must pass the full audit ─────────────────────────────

test('every re-scoped policy uses its scoped helper and drops current_event_ids', () => {
  const results = auditMigrationSql(SQL);
  const failures = results.filter((r) => !r.ok);
  assert.deepEqual(
    failures,
    [],
    `Policies failing the guest-scope audit: ${failures
      .map((f) => `${f.policy} (${f.reason})`)
      .join('; ')}`,
  );
});

test('none of the re-scoped CREATE POLICY statements reference current_event_ids', () => {
  for (const { policy } of RESCOPED_POLICIES) {
    const stmt = extractCreatePolicy(SQL, policy);
    assert.ok(stmt, `missing CREATE POLICY for ${policy}`);
    assert.equal(
      referencesUnscopedHelper(stmt as string),
      false,
      `${policy} still references current_event_ids()`,
    );
  }
});

test('the migration keeps RLS assertions and never uses USING (true)', () => {
  assert.match(SQL, /pg_policies/, 'post-condition DO $$ block is missing');
  assert.doesNotMatch(SQL, /USING\s*\(\s*true\s*\)/i, 'introduces a USING (true)');
});

// ── Kwento block lever: WITH CHECK must match USING (no guest INSERT path) ───

test('guest_message_blocks_manage WITH CHECK is tightened off current_event_ids', () => {
  const stmt = extractCreatePolicy(SQL, 'guest_message_blocks_manage');
  assert.ok(stmt, 'guest_message_blocks_manage CREATE POLICY missing');
  // The whole statement (USING + WITH CHECK) must not re-admit a plain guest.
  assert.equal(
    referencesUnscopedHelper(stmt as string),
    false,
    'guest_message_blocks_manage still admits a guest on INSERT via current_event_ids()',
  );
  assert.match(
    stmt as string,
    /member_type IN \('couple','coordinator'\)/,
    'WITH CHECK no longer gates on the couple/coordinator member_type',
  );
});

// ── patiktok_oauth_grants: same OAuth-token leak class, re-scoped couple-only ─

test('patiktok_oauth_grants OAuth read is re-scoped couple-only', () => {
  const stmt = extractCreatePolicy(SQL, 'couple_reads_patiktok_oauth_grants');
  assert.ok(stmt, 'couple_reads_patiktok_oauth_grants CREATE POLICY missing');
  assert.equal(referencesUnscopedHelper(stmt as string), false);
  assert.match(stmt as string, /current_couple_event_ids/);
});

// ── Auditor unit behaviour (so the guard itself has teeth) ──────────────────

test('auditor flags a policy that regressed to current_event_ids', () => {
  const bad = `
    DROP POLICY IF EXISTS orders_owner_read ON public.orders;
    CREATE POLICY orders_owner_read ON public.orders
      FOR SELECT TO authenticated
      USING (event_id IN (SELECT public.current_event_ids()));
  `;
  const result = auditMigrationSql(bad).find((r) => r.policy === 'orders_owner_read');
  assert.equal(result?.ok, false);
  assert.match(result?.reason ?? '', /current_event_ids/);
});

test('auditor distinguishes current_couple_event_ids from current_event_ids', () => {
  assert.equal(
    referencesUnscopedHelper('USING (event_id IN (SELECT public.current_couple_event_ids()))'),
    false,
  );
  assert.equal(
    referencesUnscopedHelper(
      'USING (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()))',
    ),
    false,
  );
  assert.equal(
    referencesUnscopedHelper('USING (event_id IN (SELECT public.current_event_ids()))'),
    true,
  );
});
