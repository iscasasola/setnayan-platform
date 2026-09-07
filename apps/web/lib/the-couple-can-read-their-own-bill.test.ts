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
 *
 *     🔑 AND THE FIX FOR #1 IS NOT A GRANT EITHER. The first draft opened the
 *     table to `authenticated` with a policy through `orders`, and two shipped
 *     guards refused it: `onboarding-basket-one-bill.db.test.ts` ("no session
 *     role can read or write a bill's contents") and
 *     `couple-host-policy-scope.db.test.ts` T1/T7c (a `*_couple_*` policy must
 *     not resolve through the MEMBER-wide `current_event_ids()` — that draft's
 *     did, which would have shown every invited guest the couple's bill). The
 *     table stays shut; `public.event_basket_orders_granting` answers the
 *     question instead. Its behaviour is proved against a real database in
 *     `tests/db/the-couple-can-read-their-own-bill.db.test.ts`; what this file
 *     holds is the SOURCE half — that the reader still goes through the RPC.
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
 * Scoped to the CREATE FUNCTION statement itself. An earlier draft asserted
 * against the whole file and passed on the `COMMENT ON …` text — the mutation
 * that swapped the helper for a hand-rolled membership subquery went completely
 * undetected. A guard that reads prose is measuring the wrong thing.
 */
const functionBody = (() => {
  const i = migration.search(/CREATE OR REPLACE FUNCTION public\.event_basket_orders_granting/i);
  assert.ok(i > -1, 'the RPC is gone');
  const end = migration.indexOf('$$;', i);
  assert.ok(end > i, 'the function body is unterminated');
  return migration.slice(i, end);
})();

test('the RPC resolves the COUPLE, not any event member', () => {
  assert.match(functionBody, /public\.current_couple_event_ids\(\)/, 'it invented a membership rule');
  assert.ok(
    !/current_event_ids\(\)/.test(functionBody.replace(/current_couple_event_ids\(\)/g, '')),
    'it resolves through the MEMBER-wide helper — an invited guest would see the bill',
  );
  assert.ok(
    !/event_members/i.test(functionBody),
    'it hand-rolls membership instead of using the canonical helper',
  );
});

test('the authority check comes BEFORE the read, and admits only three callers', () => {
  const gate = functionBody.slice(0, functionBody.search(/RETURN QUERY/i));
  assert.ok(gate.length > 0, 'there is no gate ahead of the read');
  assert.match(gate, /current_couple_event_ids\(\)/);
  assert.match(gate, /public\.is_admin\(\)/);
  assert.match(gate, /service_role/);
});

test('SELECT only — a couple learns what they were billed, never authors it', () => {
  assert.match(functionBody, /\bSTABLE\b/, 'the function is not marked STABLE');
  assert.ok(
    !/\b(INSERT INTO|UPDATE |DELETE FROM)\b/i.test(functionBody),
    'the RPC writes to billing line items',
  );
});

test('🔑 the table itself stays shut — no grant, no policy', () => {
  assert.ok(
    !/GRANT[^;]*\bON\s+(TABLE\s+)?public\.onboarding_order_items/i.test(migration),
    'the migration grants a table privilege on a bill’s contents',
  );
  assert.ok(
    !/CREATE POLICY/i.test(migration),
    'the migration adds a policy to a table that is meant to have none',
  );
});

test('the RPC is executable by the couple, and never by anon', () => {
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.event_basket_orders_granting\(UUID, TEXT\)\s*\n?\s*TO authenticated, service_role;/i,
    'the RPC is not granted to the couple — every call would be refused',
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.event_basket_orders_granting\(UUID, TEXT\) FROM PUBLIC, anon;/i,
    'anon is not revoked',
  );
});

test('source · the ownership reader goes through the RPC, not the table', () => {
  const src = stripComments(readFileSync(resolve(HERE, 'onboarding-order-items.ts'), 'utf8'));
  const i = src.indexOf('export async function eventBasketOrdersGranting');
  assert.ok(i > -1, 'the ownership reader is gone — re-point this guard');
  const body = src.slice(i, src.indexOf('\n}', i));
  assert.match(
    body,
    /\.rpc\('event_basket_orders_granting'/,
    'the ownership reader queries the table again — that read 42501s for every couple',
  );
  assert.ok(
    !/from\('onboarding_order_items'\)/.test(body),
    'the ownership reader still reaches for the table directly',
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
