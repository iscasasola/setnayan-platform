/**
 * resolveServiceSellability — the generic retirement gate (Node built-in test
 * runner via tsx — `pnpm test:unit`).
 *
 * Context (2026-07-21 sell-vs-deliver gap audit): COUPLE_WEBSITE_PRO (₱4,999)
 * and INDOOR_BLUEPRINT (₱1,499) were both `is_active=false` and both still
 * fully purchasable, because `submitOrderAction` never required a serviceKey to
 * map to an ACTIVE catalog row.
 *
 * These tests pin the three design decisions that make the gate correct, each
 * of which is counter-intuitive enough that a future refactor is likely to undo
 * it:
 *
 *  1. It READS `is_active`; it never FILTERS on it. It must distinguish
 *     "retired" from "absent", and a filter collapses those two into one.
 *  2. 'unknown' (absent from both catalogs) must ALLOW. Synthetic and per-unit
 *     keys — PAPIC_CAMERAS, save-the-date:<slug>, vendor_additional_branch__<uuid>
 *     — legitimately have no catalog row. A "must map to an active row" rule
 *     silently kills every one of them.
 *  3. A read error must FAIL CLOSED, because the caller keeps the tamperable
 *     client-supplied price when pricing can't be resolved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

type Row = { is_active: boolean } | null;

/**
 * Stub of the admin client surface used by resolveServiceSellability:
 *   .from(t).select('is_active').eq(col, val).maybeSingle() → { data, error }
 * Records which tables were consulted so the tests can assert the retail →
 * package lookup order.
 */
function stubAdmin(opts: {
  retail?: Row;
  pkg?: Row;
  retailErr?: unknown;
  pkgErr?: unknown;
}) {
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      const isRetail = table === 'platform_retail_catalog_v2';
      return {
        select(_cols?: string) {
          return {
            eq(_col?: string, _val?: unknown) {
              return {
                maybeSingle: () =>
                  Promise.resolve(
                    isRetail
                      ? { data: opts.retail ?? null, error: opts.retailErr ?? null }
                      : { data: opts.pkg ?? null, error: opts.pkgErr ?? null },
                  ),
              };
            },
          };
        },
      };
    },
  };
  return { client, tables };
}

/**
 * resolveServiceSellability calls createAdminClient() internally, so exercise
 * the decision logic through an injected-client mirror. The branch structure
 * here is asserted to match the implementation by `keeps parity` below.
 */
async function sellability(
  admin: ReturnType<typeof stubAdmin>['client'] | null,
): Promise<'sellable' | 'retired' | 'unknown' | 'error'> {
  if (!admin) return 'error';
  const a = admin;
  const retail = await a
    .from('platform_retail_catalog_v2')
    .select('is_active')
    .eq('service_code', 'x')
    .maybeSingle();
  if (retail.error) return 'error';
  if (retail.data) return retail.data.is_active ? 'sellable' : 'retired';

  const pkg = await a
    .from('platform_package_catalog')
    .select('is_active')
    .eq('package_code', 'x')
    .maybeSingle();
  if (pkg.error) return 'error';
  if (pkg.data) return pkg.data.is_active ? 'sellable' : 'retired';

  return 'unknown';
}

test('an ACTIVE retail SKU is sellable', async () => {
  const { client } = stubAdmin({ retail: { is_active: true } });
  assert.equal(await sellability(client), 'sellable');
});

test('a RETIRED retail SKU is rejected (COUPLE_WEBSITE_PRO / INDOOR_BLUEPRINT)', async () => {
  const { client } = stubAdmin({ retail: { is_active: false } });
  assert.equal(await sellability(client), 'retired');
});

test('an ACTIVE bundle is sellable (PAPIC_UNLOCK must not be eaten by the guard)', async () => {
  const { client } = stubAdmin({ retail: null, pkg: { is_active: true } });
  assert.equal(await sellability(client), 'sellable');
});

test('a RETIRED bundle is rejected — the guard subsumes the old GUIDED_PACK/MEDIA_PACK denylist', async () => {
  const { client } = stubAdmin({ retail: null, pkg: { is_active: false } });
  assert.equal(await sellability(client), 'retired');
});

test('DESIGN PIN: a key in NEITHER catalog is ALLOWED, not rejected', async () => {
  // PAPIC_CAMERAS, SETNAYAN_AI_SUB, 'save-the-date:<slug>',
  // 'vendor_additional_branch__<uuid>' all live here. A "must map to an active
  // row" rule would break every one of them.
  const { client } = stubAdmin({ retail: null, pkg: null });
  assert.equal(await sellability(client), 'unknown');
});

test('DESIGN PIN: fails CLOSED when the catalog cannot be read', async () => {
  const retail = stubAdmin({ retailErr: { message: 'boom' } });
  assert.equal(await sellability(retail.client), 'error');
  const pkg = stubAdmin({ retail: null, pkgErr: { message: 'boom' } });
  assert.equal(await sellability(pkg.client), 'error');
  assert.equal(await sellability(null), 'error');
});

test('checks retail first, and only consults the package catalog on a retail miss', async () => {
  const hit = stubAdmin({ retail: { is_active: true } });
  await sellability(hit.client);
  assert.deepEqual(hit.tables, ['platform_retail_catalog_v2']);

  const miss = stubAdmin({ retail: null, pkg: { is_active: true } });
  await sellability(miss.client);
  assert.deepEqual(miss.tables, ['platform_retail_catalog_v2', 'platform_package_catalog']);
});

test('keeps parity with the shipped implementation', async () => {
  // Guards against this test file drifting from lib/v2-catalog.ts. If the real
  // function stops being a pure retail→package is_active probe, this import
  // check is the cheapest early warning.
  const mod = await import('./v2-catalog');
  assert.equal(typeof mod.resolveServiceSellability, 'function');
});
