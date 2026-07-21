/**
 * isVendorProActive — the payment-links tier gate (Node built-in test runner
 * via tsx — `pnpm test:unit`).
 *
 * Regression cover for the 2026-07-21 sell-vs-deliver gap audit. The gate used
 * to match `orders.service_key` against two V1 SKU codes retired 2026-05-28
 * (`vendor_pro_weekly`, `all_tools_unlock_annual`). Prod had ZERO orders with
 * either code and FIVE vendor_profiles at tier_state='pro', so every Pro vendor
 * was permanently told to "upgrade" to reach a feature they already had.
 *
 * These tests pin the two prod realities that would break a naive rewrite:
 *   1. tier_expires_at IS NULL on all five real Pro rows → NULL means NO
 *      EXPIRY. A `.gt()`-style check reproduces the original lockout.
 *   2. One real user owns 46 vendor_profiles → the query must tolerate many
 *      rows (no .maybeSingle()) and pass if ANY row is Pro-or-better.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVendorProActive } from './vendor-payment-methods';

type Row = { tier_state: string | null; tier_expires_at: string | null };

/**
 * Minimal stand-in for the supabase client shape this function uses:
 * .from(table).select(cols).eq(col, val) → { data, error }.
 * Records the table + column so the test also proves we stopped reading
 * `orders` and started reading `vendor_profiles`.
 */
function stubClient(rows: Row[] | null, error: unknown = null) {
  const seen: { table?: string; column?: string } = {};
  const client = {
    from(table: string) {
      seen.table = table;
      return {
        select() {
          return {
            eq(column: string) {
              seen.column = column;
              return Promise.resolve({ data: rows, error });
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, seen };
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

test('reads vendor_profiles.tier_state, not the retired orders SKU codes', async () => {
  const { client, seen } = stubClient([{ tier_state: 'pro', tier_expires_at: null }]);
  await isVendorProActive(client, 'user-1');
  assert.equal(seen.table, 'vendor_profiles');
  assert.equal(seen.column, 'user_id');
});

test('PROD REALITY 1: pro with NULL tier_expires_at is ACTIVE', async () => {
  // All five real Pro vendors are in exactly this state. Treating NULL as
  // "expired" is the bug this whole test file exists to prevent.
  const { client } = stubClient([{ tier_state: 'pro', tier_expires_at: null }]);
  assert.equal(await isVendorProActive(client, 'u'), true);
});

test('PROD REALITY 2: one of 46 profiles being pro is enough', async () => {
  const rows: Row[] = Array.from({ length: 46 }, () => ({
    tier_state: 'free',
    tier_expires_at: null,
  }));
  rows[30] = { tier_state: 'pro', tier_expires_at: null };
  const { client } = stubClient(rows);
  assert.equal(await isVendorProActive(client, 'u'), true);
});

test('enterprise and custom inherit the Pro gate', async () => {
  for (const tier of ['enterprise', 'custom']) {
    const { client } = stubClient([{ tier_state: tier, tier_expires_at: null }]);
    assert.equal(await isVendorProActive(client, 'u'), true, `${tier} should pass`);
  }
});

test('tiers below pro are denied', async () => {
  for (const tier of ['free', 'verified', 'solo', null]) {
    const { client } = stubClient([{ tier_state: tier, tier_expires_at: null }]);
    assert.equal(await isVendorProActive(client, 'u'), false, `${tier} should fail`);
  }
});

test('a pro tier whose non-null expiry has passed is denied', async () => {
  const { client } = stubClient([{ tier_state: 'pro', tier_expires_at: PAST }]);
  assert.equal(await isVendorProActive(client, 'u'), false);
});

test('a pro tier with a future expiry is active', async () => {
  const { client } = stubClient([{ tier_state: 'pro', tier_expires_at: FUTURE }]);
  assert.equal(await isVendorProActive(client, 'u'), true);
});

test('an unparseable expiry is treated as inactive, never as no-expiry', async () => {
  const { client } = stubClient([{ tier_state: 'pro', tier_expires_at: 'not-a-date' }]);
  assert.equal(await isVendorProActive(client, 'u'), false);
});

test('fails closed on a query error or missing rows', async () => {
  const err = stubClient(null, { message: 'boom' });
  assert.equal(await isVendorProActive(err.client, 'u'), false);
  const empty = stubClient([]);
  assert.equal(await isVendorProActive(empty.client, 'u'), false);
});
