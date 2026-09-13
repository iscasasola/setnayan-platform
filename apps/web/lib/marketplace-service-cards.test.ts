/**
 * The marketplace lists services, and refuses to lie when it cannot.
 *
 * These are unit tests over the query builder's OBSERVABLE decisions — which
 * filters it applies, how it escapes visitor input, what it does on an error —
 * driven through a fake Supabase client. The live-database behaviour is a
 * separate concern; what is pinned here is the reasoning that would otherwise
 * be re-derived wrongly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMarketplaceServiceCards,
  type MarketplaceQuery,
} from '@/lib/marketplace-service-cards';

type Call = { fn: string; args: unknown[] };

/** A chainable stand-in that records every call and yields a fixed result. */
function fakeClient(result: { data?: unknown[]; error?: { message: string } }) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  for (const fn of ['select', 'eq', 'or', 'order']) {
    chain[fn] = (...args: unknown[]) => {
      calls.push({ fn, args });
      return chain;
    };
  }
  chain.range = (...args: unknown[]) => {
    calls.push({ fn: 'range', args });
    return Promise.resolve(result);
  };
  return {
    calls,
    client: {
      from: (t: string) => {
        calls.push({ fn: 'from', args: [t] });
        return chain;
      },
    } as never,
  };
}

async function run(query: MarketplaceQuery, result: Parameters<typeof fakeClient>[0] = { data: [] }) {
  const { client, calls } = fakeClient(result);
  const rows = await fetchMarketplaceServiceCards(client, query);
  return { rows, calls };
}

test('it lists SERVICES, not shops', async () => {
  const { calls } = await run({});
  assert.equal(calls[0]?.fn, 'from');
  assert.equal(
    calls[0]?.args[0],
    'vendor_services',
    'the marketplace went back to listing one row per vendor — which is what made ' +
      'a Host MC search answer with a Live Band card',
  );
});

test('⛔ it never gates on the DEAD is_published column', async () => {
  // Its only writer is an admin tick-box; approving a shop does not set it, and
  // the owner's own verified shop sat at false. Gating on it hides verified
  // shops and looks exactly like an empty marketplace.
  const { calls } = await run({});
  assert.ok(
    !calls.some((c) => c.fn === 'eq' && String(c.args[0]).includes('is_published')),
    'the marketplace filters on is_published — verified shops nobody ticked by ' +
      'hand would silently vanish from it',
  );
});

test('it states the public-visibility rule itself, not trusting the caller’s RLS', async () => {
  // It runs with whatever client the caller passes, and an admin client bypasses
  // `vendor_services_public_read` entirely. Stating the rule keeps the answer
  // the same for every caller.
  const { calls } = await run({});
  const eqs = calls.filter((c) => c.fn === 'eq').map((c) => `${c.args[0]}=${c.args[1]}`);
  for (const expected of [
    'is_active=true',
    'vendor_profiles.verification_state=verified',
    'vendor_profiles.public_visibility=verified',
  ]) {
    assert.ok(eqs.includes(expected), `missing visibility clause: ${expected}\ngot: ${eqs.join(' · ')}`);
  }
});

test('category is a FILTER, applied only when asked for', async () => {
  const without = await run({});
  assert.ok(
    !without.calls.some((c) => c.fn === 'eq' && c.args[0] === 'category'),
    'the marketplace filters by category with nothing selected — it is flat by ruling',
  );
  const withCat = await run({ category: 'host_mc' });
  assert.ok(
    withCat.calls.some((c) => c.fn === 'eq' && c.args[0] === 'category' && c.args[1] === 'host_mc'),
    'a chosen category is not applied',
  );
});

test('🔑 visitor text cannot inject extra PostgREST conditions', async () => {
  // `or()` is a comma-separated expression list. A comma in the value splits it
  // into new conditions and a `)` ends the group early — and this value arrives
  // from a query string.
  const { calls } = await run({ q: 'band, host) or is_active.eq.false' });
  const or = calls.find((c) => c.fn === 'or');
  assert.ok(or, 'free text stopped being searched at all');
  const expr = String(or!.args[0]);
  // The expression legitimately contains ONE comma — the separator between the
  // two conditions we build. What must not survive is a comma from the VALUE,
  // which would make a third. Counting is the assertion; "contains no comma"
  // was wrong and would have failed on a correct implementation.
  assert.equal(
    (expr.match(/,/g) ?? []).length,
    1,
    `visitor input added conditions to the or() list: ${expr}`,
  );
  assert.ok(!expr.includes(')'), `an escaped value still carries a paren: ${expr}`);
  assert.equal(
    expr.split(',').length,
    2,
    `expected exactly two conditions (title, business_name), got: ${expr}`,
  );
  assert.ok(/band/.test(expr), 'escaping destroyed the actual search terms');
});

test('empty text searches everything rather than for the empty string', async () => {
  const { calls } = await run({ q: '   ' });
  assert.ok(
    !calls.some((c) => c.fn === 'or'),
    'whitespace-only input became a LIKE %% filter instead of no filter',
  );
});

test('a failed query THROWS — it never renders as an empty marketplace', async () => {
  await assert.rejects(
    () => run({}, { error: { message: 'permission denied' } }).then((r) => r.rows),
    /permission denied/,
    'a refused query returned [], which draws exactly the same page as a genuinely ' +
      'empty marketplace — the failure mode this codebase keeps producing',
  );
});

test('it splits the shop off the service row instead of nesting it', async () => {
  const { rows } = await run(
    {},
    {
      data: [
        {
          vendor_service_id: 's1',
          category: 'host_mc',
          vendor_profiles: {
            vendor_profile_id: 'v1',
            business_name: 'Saysay',
            business_slug: 'saysay',
            location_city: null,
          },
        },
      ],
    },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.businessName, 'Saysay');
  assert.equal(rows[0]!.vendorProfileId, 'v1');
  assert.equal((rows[0]!.row as unknown as Record<string, unknown>).category, 'host_mc');
  assert.ok(
    !('vendor_profiles' in (rows[0]!.row as unknown as Record<string, unknown>)),
    'the joined shop is still hanging off the service row, so `toServiceCard` would ' +
      'receive a shape it does not expect',
  );
});
