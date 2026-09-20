/**
 * THE ONE PROPERTY: an ERROR never reads as "this person has no shop".
 *
 * `/vendor-dashboard/shop` redirects a shopless account to `/open-shop`, the
 * brand-new-shop wizard. Shown to somebody who already HAS a shop, that screen
 * invites them to create a second one. The redirect is therefore only safe
 * downstream of a PROVEN absence, and `classifyShopRead` is the only place
 * that decides what counts as proven.
 *
 * This file EXECUTES that decision instead of grepping for it — including
 * through the real `fetchOwnVendorProfile`, driven by a stub Supabase client,
 * so the property is asserted at the call site that actually feeds the
 * redirect and not only on the helper in isolation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyShopRead, type ShopPresence } from '@/lib/shop-presence';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

// Every error shape a PostgREST read can hand back, including the ones that
// arrive WITH a data value — a partial result cannot prove the zero-row case.
const ERRORS: Array<[string, unknown]> = [
  ['42501 permission denied', { code: '42501', message: 'permission denied for table vendor_team_members' }],
  ['42P01 undefined table', { code: '42P01', message: 'relation does not exist' }],
  ['PGRST205 schema cache miss', { code: 'PGRST205', message: 'Could not find the table in the schema cache' }],
  ['a thrown Error', new Error('fetch failed')],
  ['a bare string', 'boom'],
];

const ROWS_WITH_AN_ERROR: Array<readonly unknown[] | null | undefined> = [
  null,
  undefined,
  [],
  [{ vendor_profile_id: 'v1' }],
];

test('an error NEVER yields no-shop, whatever came back with it', () => {
  let checked = 0;
  for (const [label, error] of ERRORS) {
    for (const rows of ROWS_WITH_AN_ERROR) {
      const verdict: ShopPresence = classifyShopRead(rows, error);
      assert.equal(
        verdict,
        'unreadable',
        `${label} with rows=${JSON.stringify(rows ?? null)} classified as "${verdict}" — an error must never be an absence`,
      );
      assert.notEqual(verdict, 'no-shop');
      checked += 1;
    }
  }
  // FLOOR — a shrunken table must not read as a pass (green-shaped nothing).
  assert.ok(checked >= 20, `only ${checked} (rows, error) pairs were classified`);
});

test('a SUCCESSFUL read is the only thing that can prove an absence', () => {
  assert.equal(classifyShopRead([], null), 'no-shop');
  assert.equal(classifyShopRead([], undefined), 'no-shop');
  assert.equal(classifyShopRead([{ vendor_profile_id: 'v1' }], null), 'has-shop');
  assert.equal(classifyShopRead([{ a: 1 }, { b: 2 }], null), 'has-shop');
  // No error AND no rows array: nothing was read. PostgREST returns exactly
  // this for a refused single-row read, so it is not an absence either.
  assert.equal(classifyShopRead(null, null), 'unreadable');
  assert.equal(classifyShopRead(undefined, null), 'unreadable');
});

// ── The same property, through the function that actually feeds the redirect ──

type ReadResult = { data: unknown; error: unknown };

/**
 * A stub Supabase client shaped like the two reads `fetchOwnVendorProfile`
 * makes: the own-shop read (`.maybeSingle()` on `vendor_profiles_self`) and
 * the membership read (a thenable ending in `.limit()`).
 */
function stubClient(self: ReadResult, memberships: ReadResult) {
  const builder = (result: ReadResult) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit']) {
      chain[method] = () => chain;
    }
    chain.maybeSingle = async () => result;
    // Awaiting the builder itself resolves the read (PostgREST thenable).
    chain.then = (resolve: (v: ReadResult) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };
  return {
    from: (table: string) =>
      builder(table === 'vendor_team_members' ? memberships : self),
  } as never;
}

const EMPTY_OK: ReadResult = { data: null, error: null };
const REFUSED: ReadResult = {
  data: null,
  error: { code: '42501', message: 'permission denied for table vendor_team_members' },
};

test('a REFUSED membership read throws — it never returns the null that means "no shop"', async () => {
  await assert.rejects(
    () => fetchOwnVendorProfile(stubClient(EMPTY_OK, REFUSED), 'user-with-a-shop'),
    /vendor_team_members read unreadable/,
    'a refused membership read returned instead of throwing — it would reach /open-shop as a proven absence',
  );
});

test('a SUCCESSFUL empty membership read still returns null — the proven absence is preserved', async () => {
  const result = await fetchOwnVendorProfile(
    stubClient(EMPTY_OK, { data: [], error: null }),
    'user-with-no-shop',
  );
  assert.equal(result, null, 'a genuinely shopless account must still resolve to null');
});
