/**
 * EVERY SELLABLE PAPIC RUNG MUST HAVE SOMEWHERE FOR ITS SHOTS TO COME FROM.
 *
 * 🚨 THE FAILURE THIS EXISTS TO STOP. `activateOrderSku` dispatches on an EXACT
 * `service_key` map and ends:
 *
 *     const hook = exact ?? PREFIX_HOOKS.find(...)?.run;
 *     if (!hook) return; // default no-op
 *
 * So a rung that is live in `papic_pass_tiers` + `platform_retail_catalog_v2`
 * but absent from `EXACT_HOOKS` is fully purchasable and grants NOTHING. The
 * couple pays ₱9,000, an admin approves the transfer, the order goes `paid` —
 * and the pool stays empty. Nothing throws, nothing logs, no alert fires,
 * because a no-op is the designed behaviour for a service_key that owns no
 * capability. It is the same shape as every other silent decline on this
 * codebase's board: the dispatcher DECLINES and the only symptom is an absence.
 *
 * It came within one commit of shipping when the Pool ladder was extended from
 * three rungs to nine (owner 2026-08-11) — the migration alone would have put
 * six unfunded rungs on sale.
 *
 * ── WHY IT READS THE DATABASE *AND* THE SOURCE ─────────────────────────────
 * Neither half can see this alone. A unit test over `EXACT_HOOKS` cannot know
 * which rungs are on sale; a db test over the tier tables cannot know which
 * keys have hooks. The bug lives precisely in the gap, so the assertion has to
 * span it: replayed migrations for what is SELLABLE, the module source for what
 * is FUNDED.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVATION_SRC = readFileSync(join(HERE, '../../lib/sku-activation.ts'), 'utf8');

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
 * Is this service_code wired to an activation hook?
 *
 * Deliberately a SOURCE scan and not an import: `sku-activation.ts` pulls the
 * admin Supabase client and half the billing chain through its import graph,
 * which a db test has no business booting. The map is a frozen object literal
 * of `KEY: hook` / `[CONST]: hook` lines, so matching the key is exact enough —
 * and a rung that is only mentioned in a COMMENT must not count, which is why
 * this requires the colon.
 */
function isWired(serviceCode: string): boolean {
  // `PAPIC_GUEST_13K: grantPapicPassPoints,` — a bare key.
  if (new RegExp(`^\\s*${serviceCode}\\s*:`, 'm').test(ACTIVATION_SRC)) return true;
  // `[PAPIC_ONE_SKU]: grantPapicCameraPoints,` — a computed key. Resolve the
  // constant's VALUE from papic-one.ts rather than trusting the name.
  const one = readFileSync(join(HERE, '../../lib/papic-one.ts'), 'utf8');
  for (const m of one.matchAll(/export const (\w+) = '([^']+)'/g)) {
    if (m[2] === serviceCode && new RegExp(`\\[\\s*${m[1]}\\s*\\]\\s*:`).test(ACTIVATION_SRC)) {
      return true;
    }
  }
  return false;
}

/** Every rung a couple can actually put money on: live tier AND live price. */
async function sellableRungs(table: 'papic_pass_tiers' | 'papic_one_tiers') {
  const r = await db.query<{ service_code: string; points: number; php: string }>(
    `SELECT t.service_code, t.points, c.retail_price_php AS php
       FROM public.${table} t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active AND c.retail_price_php > 0
      ORDER BY c.retail_price_php`,
  );
  return r.rows;
}

test('every sellable Papic POOL rung has an activation hook', async () => {
  const rungs = await sellableRungs('papic_pass_tiers');
  assert.ok(rungs.length > 0, 'no sellable Pool rung at all — the ladder is dead');
  const unfunded = rungs.filter((r) => !isWired(r.service_code));
  assert.deepEqual(
    unfunded.map((r) => r.service_code),
    [],
    `these Pool rungs are ON SALE and grant NOTHING on approval — add them to ` +
      `EXACT_HOOKS in lib/sku-activation.ts. A couple would pay and get an empty pool, ` +
      `with no error anywhere.`,
  );
});

test('every sellable Papic ONE rung has an activation hook', async () => {
  const rungs = await sellableRungs('papic_one_tiers');
  assert.ok(rungs.length > 0, 'no sellable Papic One rung at all');
  const unfunded = rungs.filter((r) => !isWired(r.service_code));
  assert.deepEqual(unfunded.map((r) => r.service_code), []);
});

test('the ladder the owner set is exactly what is on sale', async () => {
  // Owner 2026-08-11: "3000, 6000, 10000, 13000, 16000, 20000 23000, 26000, 30000"
  // at ₱1,000 per step. Pinned as a set, not as prose in a doc — the corpus has
  // been wrong about a live price before, and a number in a sentence cannot fail.
  const rungs = await sellableRungs('papic_pass_tiers');
  assert.deepEqual(
    rungs.map((r) => [Number(r.points), Number(r.php)]),
    [
      [3_000, 1_000],
      [6_000, 2_000],
      [10_000, 3_000],
      [13_000, 4_000],
      [16_000, 5_000],
      [20_000, 6_000],
      [23_000, 7_000],
      [26_000, 8_000],
      [30_000, 9_000],
    ],
    'the Pool ladder drifted from the owner-set one',
  );
});

test('Papic One is ONE rung: 150 credits for ₱50', async () => {
  // Owner 2026-08-11: one price for Papic One, corrected the same session to
  // "150 papic credits for 50 pesos". A SECOND sellable rung is the regression —
  // it would put a superseded offer back on the ladder beside the live one.
  const rungs = await sellableRungs('papic_one_tiers');
  assert.equal(rungs.length, 1, 'Papic One must have exactly one price');
  assert.equal(Number(rungs[0]!.points), 150);
  assert.equal(Number(rungs[0]!.php), 50);
});

test('a reload costs the same as the camera — it is the same rung', async () => {
  // "can top up … credits for 50 pesos" — the reload path resolves the SAME
  // service_code, so this is true by construction rather than by a second row.
  // Asserted anyway: if a separate reload SKU is ever added, that is a product
  // change and it should have to come past this line.
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.papic_one_tiers WHERE is_active`,
  );
  assert.equal(Number(r.rows[0]!.n), 1, 'a second active One rung means reload ≠ buy');
});

test('the retired rungs keep their hooks — old orders must still convert', async () => {
  // Deactivating a rung stops NEW sales. It must not strand an order minted
  // before the change: the hook has to stay wired, and the deactivated tier row
  // is what makes the conversion resolve to what it was sold at.
  for (const retired of ['PAPIC_GUEST_TOPUP', 'PAPIC_CAMERA_MINI_DAY', 'PAPIC_ONE_100']) {
    assert.equal(
      isWired(retired),
      true,
      `${retired} lost its activation hook — an order minted before it was retired ` +
        `would now be approved and grant nothing`,
    );
  }
});

test('the legacy multi-camera grant still funds its seats after the MINI rung retired', async () => {
  // papic_grant_camera_points branch (B) reads PAPIC_CAMERA_MINI_DAY's points
  // `AND is_active`, then COALESCEs to 50. Deactivating the row makes that
  // lookup miss — so this pins that the fallback carries it, rather than
  // assuming it. Checked, not asserted in prose.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Legacy grant check', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_CAMERAS', 'legacy', 60, 'submitted', 'LEGACYFUND01')
     RETURNING order_id`,
    [eventId],
  );
  const orderId = order.rows[0]!.order_id;
  await db.query(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
     VALUES ($1, 611, 'PAPIC_CAMERA_MINI_DAY', 'legacy-fund-1', 'mini', $2)`,
    [eventId, orderId],
  );

  const granted = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );
  assert.ok(
    Number(granted.rows[0]!.papic_grant_camera_points) > 0,
    'a legacy multi-camera order granted NOTHING after the MINI rung was deactivated',
  );
});
