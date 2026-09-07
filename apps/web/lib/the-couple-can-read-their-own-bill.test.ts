/**
 * the-couple-can-read-their-own-bill.test.ts
 *
 * Two refused reads, both found in production logs on 2026-09-07 and both
 * silent by construction.
 *
 * 1 · `onboarding_order_items` — 403 since 2026-08-11. RLS on, ZERO grants,
 *     ZERO policies. `lib/entitlements.ts` reads the refusal as "does not own
 *     it", so a couple who bought Setnayan AI inside an onboarding basket read
 *     as not owning it.
 * 2 · `platform_settings` — 401, because `/onboarding/wedding` passed the
 *     ANONYMOUS caller's client into a read of PLATFORM CONFIG. Wrapped in a
 *     try/catch that degraded to the default discount, so the owner's
 *     admin-set discount was silently not honoured and nothing looked broken.
 *
 * 🔑 The fix for #2 is NOT a grant. `platform_settings` holds the business TIN
 * and both bank account numbers; the error message's own advice
 * (`GRANT SELECT … TO anon`) would have published them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, '../../../supabase/migrations');

const migration = (() => {
  const f = readdirSync(MIGRATIONS).find((n) => n.includes('onboarding_order_items_couple_read'));
  assert.ok(f, 'the onboarding_order_items migration is gone');
  return readFileSync(join(MIGRATIONS, f!), 'utf8');
})();

/**
 * Scoped to the CREATE POLICY statement itself. An earlier draft asserted
 * against the whole file and passed on the `COMMENT ON POLICY` text — the
 * mutation that swapped the helper for a hand-rolled membership subquery went
 * completely undetected. A guard that reads prose is measuring the wrong thing.
 */
const policyBody = (() => {
  const i = migration.search(/CREATE POLICY onboarding_order_items_couple_read/i);
  assert.ok(i > -1, 'the policy statement is gone');
  const end = migration.indexOf(';', i);
  return migration.slice(i, end);
})();

test('the policy reaches membership through orders, using the canonical helper', () => {
  assert.match(policyBody, /public\.current_event_ids\(\)/, 'it invented a membership rule');
  assert.match(policyBody, /FROM public\.orders/i, 'it does not reach through orders');
  assert.ok(
    !/event_members/i.test(policyBody),
    'it hand-rolls membership instead of using the canonical helper',
  );
});

test('SELECT only — a couple reads what they were billed, never authors it', () => {
  assert.match(migration, /FOR SELECT/i);
  assert.ok(
    !/FOR (INSERT|UPDATE|DELETE|ALL)/i.test(migration),
    'the migration grants write access to billing line items',
  );
  assert.ok(
    !/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(migration),
    'the migration grants a write privilege',
  );
});

test('the grant is present too — a policy alone is still refused at the privilege layer', () => {
  assert.match(
    migration,
    /GRANT SELECT ON public\.onboarding_order_items TO authenticated/i,
    'PostgREST refuses before RLS is consulted; both are required',
  );
});

test('🔑 nothing here widens platform_settings — that would publish bank details', () => {
  assert.ok(
    !/platform_settings/i.test(migration),
    'the migration touches platform_settings; that table holds business_tin, ' +
      'bdo_account_number and gcash_number — it must never be granted to anon',
  );
});

test('source · the onboarding services step reads platform config as ADMIN, not as the caller', () => {
  const src = stripComments(
    readFileSync(resolve(HERE, 'onboarding/services-step-server.ts'), 'utf8'),
  );
  const i = src.indexOf("from('platform_settings')");
  assert.ok(i > -1, 'the settings read is gone — re-point this guard');
  const before = src.slice(Math.max(0, i - 200), i);
  assert.match(
    before,
    /createAdminClient\(\)/,
    'platform_settings is being read with the caller’s client again — on ' +
      '/onboarding/wedding that caller is ANONYMOUS and the read 401s, then ' +
      'degrades silently to the default discount',
  );
  assert.ok(
    !/\bclient\s*\n?\s*\.from\('platform_settings'\)/.test(src),
    'a caller-scoped client still reads platform_settings',
  );
});
