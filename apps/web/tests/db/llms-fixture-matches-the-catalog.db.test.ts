/**
 * THE llms.txt GUARDS' FIXTURE MUST NOT DESCRIBE A PRODUCT THAT DOES NOT EXIST.
 *
 * 🚨 THE FAILURE THIS EXISTS TO STOP, MEASURED 2026-08-31. `lib/llms-txt-guard-input.ts`
 * is the reference reality for BOTH llms.txt guards. It was hand-written, it had
 * no provenance line, and it had rotted silently through a whole reprice:
 *   · every one of the seventeen Papic rungs was ~40% UNDER the catalog
 *     (₱50 where the row says ₱70; ₱11,200 where the row says ₱15,000),
 *   · every Papic title used the retired currency word, and
 *   · the Setnayan AI ladder sat a whole rung out (1499/899/499/99 against
 *     2499/1499/899/199) — with `llms-txt.test.ts` hard-coding the same stale
 *     ladder, so the assertion and the fixture agreed with each other and with
 *     nothing else.
 *
 * 🔑 NOTHING SHIPPED WAS WRONG, AND THAT IS THE POINT. Every figure in
 * `llms-txt.ts` resolves from the catalog at render. The defect was a GUARD THAT
 * COULD NOT DETECT A WRONG PRICE, because its reference was a reprice behind.
 * A unit test cannot catch that — its fixture IS the thing that is wrong. Only a
 * check with the real schema in front of it can, which is why this lives here.
 *
 * ⛔ THIS IS THE THIRD TIME A HAND-TYPED SECOND COPY OF THE CATALOG HAS DRIFTED
 * in this repo (see `fallback-prices-match-the-catalog.db.test.ts`'s three cases,
 * and `llms-txt.ts`'s own docblock). The fix has never been "be more careful".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { RETAIL, VENDOR } from '../../lib/llms-txt-guard-input';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/**
 * ⚠ FOUR ROWS WHERE THE MIGRATIONS AND PRODUCTION GENUINELY DISAGREE — measured
 * 2026-08-31, and NOT a fixture bug.
 *
 * The fixture follows PRODUCTION, on the owner's instruction, because production
 * is what a customer is actually charged. This replay follows the MIGRATIONS,
 * which is what a fresh environment would come up with. For 37 of the 41 rows
 * those are the same thing and this guard compares them. For these four they are
 * not, and pretending otherwise would either make the fixture follow migrations
 * (wrong — it would re-introduce prices nobody pays) or turn this guard red on
 * arrival (which is how a guard gets deleted).
 *
 *   row                    migrations        production
 *   CUSTOM_QR_GUEST        ₱999              ₱0        (the QR is free)
 *   SEATING_3D             NO ROW            ₱1,500 active
 *   pro_vendor_monthly     ₱2,499            ₱2,500
 *   pro_vendor_annual      ₱24,999           ₱26,000
 *
 * 🔑 THIS IS A REAL FINDING AND IT IS NOT THIS PR'S TO FIX. It means a database
 * seeded only from `supabase/migrations/` comes up charging Pro ₱2,499/₱24,999
 * and selling a QR that is free in production, with the 3D Plan missing
 * altogether. The 2026-08-27 owner price sheet migration
 * (20271171000513) records pro_vendor_annual at ₱26,000 in its own header, so
 * something later puts it back — worth an owner's eye, separately.
 *
 * ⛔ DO NOT ADD A ROW HERE TO GO GREEN. Every entry costs coverage of a real
 * price. If a fifth appears, that is the finding, not the paperwork.
 */
const MIGRATIONS_DISAGREE_WITH_PRODUCTION: Record<string, string> = {
  CUSTOM_QR_GUEST: 'migrations ₱999, production ₱0 — the per-guest QR is free',
  SEATING_3D: 'no migration row; production sells it at ₱1,500',
  pro_vendor_monthly: 'migrations ₱2,499, production ₱2,500',
  pro_vendor_annual: 'migrations ₱24,999, production ₱26,000',
};

type Row = { title: string; php: string; is_active: boolean };

async function retailRow(code: string): Promise<Row | null> {
  const r = await db.query<Row>(
    `SELECT title, retail_price_php::text AS php, is_active
       FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
    [code],
  );
  return r.rows[0] ?? null;
}

async function vendorRow(code: string): Promise<Row | null> {
  const r = await db.query<Row>(
    `SELECT title, price_php::text AS php, is_active
       FROM public.vendor_billing_catalog WHERE sku_code = $1`,
    [code],
  );
  return r.rows[0] ?? null;
}

test('the divergence list is small, and every entry still diverges', async () => {
  /*
    🔑 AN EXEMPTION LIST IS A GUARD'S BLIND SPOT, so it is itself guarded. If an
    entry stops diverging — somebody reconciled the migration — it must be
    DELETED, or it silently hides that row from every comparison below forever.
  */
  const codes = Object.keys(MIGRATIONS_DISAGREE_WITH_PRODUCTION);
  assert.ok(codes.length <= 6, `${codes.length} rows exempted — the migrations and production are drifting apart, not a paperwork problem`);
  const reconciled: string[] = [];
  for (const code of codes) {
    const fixtureRetail = RETAIL.find((r) => r.service_code === code && r.is_active);
    const fixtureVendor = VENDOR.find((r) => r.sku_code === code && r.is_active);
    const live = fixtureRetail ? await retailRow(code) : await vendorRow(code);
    const want = Number(fixtureRetail?.retail_price_php ?? fixtureVendor?.price_php);
    if (live && live.is_active && Number(live.php) === want) reconciled.push(code);
  }
  assert.deepEqual(
    reconciled,
    [],
    `these no longer diverge and must be REMOVED from MIGRATIONS_DISAGREE_WITH_PRODUCTION, ` +
      `or they stay uncompared forever: ${reconciled.join(', ')}`,
  );
});

test('the fixture is not empty — this guard is not vacuous', () => {
  // 🔑 Every assertion below loops over the fixture. If the import ever resolved
  // to an empty array (a rename, a barrel file, a bad merge), the whole file
  // would pass while testing NOTHING.
  assert.ok(RETAIL.length >= 30, `only ${RETAIL.length} retail fixture rows — the import has stopped seeing them`);
  assert.ok(VENDOR.length >= 5, `only ${VENDOR.length} vendor fixture rows — the import has stopped seeing them`);
});

test('every ACTIVE retail fixture row matches its catalog row exactly', async () => {
  const wrong: string[] = [];
  for (const row of RETAIL.filter((r) => r.is_active)) {
    if (MIGRATIONS_DISAGREE_WITH_PRODUCTION[row.service_code]) continue;
    const live = await retailRow(row.service_code);
    if (!live) {
      wrong.push(`${row.service_code}: fixture says ACTIVE, the catalog has NO ROW`);
      continue;
    }
    if (Number(live.php) !== Number(row.retail_price_php)) {
      wrong.push(`${row.service_code}: fixture ₱${row.retail_price_php}, catalog ₱${Number(live.php)}`);
    }
    if (live.title !== row.title) {
      wrong.push(`${row.service_code}: fixture title ${JSON.stringify(row.title)}, catalog ${JSON.stringify(live.title)}`);
    }
    if (!live.is_active) {
      wrong.push(`${row.service_code}: fixture says ACTIVE, the catalog says is_active = FALSE`);
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `the llms.txt fixture disagrees with the catalog:\n  ${wrong.join('\n  ')}\n\n` +
      `Fix the FIXTURE, not this test. Re-read it with:\n` +
      `  select service_code, title, retail_price_php, is_active from public.platform_retail_catalog_v2 order by service_code;`,
  );
});

test('every vendor fixture row matches its billing-catalog row exactly', async () => {
  const wrong: string[] = [];
  for (const row of VENDOR.filter((r) => r.is_active)) {
    if (MIGRATIONS_DISAGREE_WITH_PRODUCTION[row.sku_code]) continue;
    const live = await vendorRow(row.sku_code);
    if (!live) {
      wrong.push(`${row.sku_code}: fixture says ACTIVE, the billing catalog has NO ROW`);
      continue;
    }
    if (Number(live.php) !== Number(row.price_php)) {
      wrong.push(`${row.sku_code}: fixture ₱${row.price_php}, catalog ₱${Number(live.php)}`);
    }
    if (!live.is_active) {
      wrong.push(`${row.sku_code}: fixture says ACTIVE, the catalog says is_active = FALSE`);
    }
  }
  assert.deepEqual(wrong, [], `the llms.txt vendor fixture disagrees with the catalog:\n  ${wrong.join('\n  ')}`);
});

test('a row the fixture calls RETIRED is never live in the catalog', async () => {
  /*
    ⚠ THE INACTIVE ROWS ARE NEGATIVE FIXTURES, NOT A MIRROR. Ten of them
    (EVENT_SUBDOMAIN, CAMERA_BRIDGE, PANOOD_SYSTEM*, LIVE_STUDIO_ROAM,
    PAPIC_SEATS, KWENTO, LIVE_WALL, PAPIC_ADDON_STORIES, PAPIC_ONE_100,
    PAPIC_CAMERA_UNLIMITED_DAY) have no catalog row at all — they are fed in
    deliberately so the guards can prove the renderer never surfaces a retired
    product. So "absent" is CORRECT here and must not be asserted away.

    🔑 WHAT WOULD ACTUALLY BE WRONG is the reverse: a product the fixture treats
    as dead having come BACK on sale. Then the negative test is asserting the
    renderer hides something we are selling, and the prose is under-describing a
    live SKU. That is the only direction this checks.
  */
  const resurrected: string[] = [];
  for (const row of RETAIL.filter((r) => !r.is_active)) {
    const live = await retailRow(row.service_code);
    if (live?.is_active) {
      resurrected.push(`${row.service_code} (₱${Number(live.php)}) — the fixture calls it retired, the catalog is SELLING it`);
    }
  }
  assert.deepEqual(
    resurrected,
    [],
    `a SKU came back on sale while the llms.txt fixture still treats it as retired:\n  ${resurrected.join('\n  ')}\n\n` +
      `Its prose line and REQUIRED_RETAIL entry must come back together, or llms.txt under-describes a live product.`,
  );
});
