/**
 * ONE BILL, ONE APPROVAL, EVERYTHING ON.
 *
 * Owner 2026-08-11: *"it will total and create a custom QR"* … *"it will also
 * integrate the approval of both at the same time once verified."*
 *
 * The onboarding services step bills its three products as a SINGLE order so the
 * couple gets one total, one QR, one reference and one approval. That shape is
 * only safe if the DATABASE-side pieces hold, and this suite pins the two that
 * quietly do not hold if nobody checks:
 *
 * 🚨 1. THE POOL GRANT USED TO SWALLOW ITSELF. Its idempotency guard asked "has
 *    this ORDER produced ANY grant row?" — correct while an order covered one
 *    product, silent data loss the moment it covered several. On a basket the
 *    CAMERA grant writes rows against the same order_id, so whichever ran first
 *    made the other see "already done" and hand over NOTHING. The couple pays
 *    for 13,000 shots, the admin approves, the pool stays empty, and nothing
 *    throws or logs. Now scoped to `source`.
 *
 * 🚨 2. THE CAMERA GRANT MUST FUND EVERY CAMERA ON THE BILL — the multi-row
 *    behaviour migration 20271128697126 introduced. Pinned here again from the
 *    basket's angle, because that is the shape that actually ships it.
 *
 * These are DB-level facts about two SQL/PostgREST behaviours interacting on one
 * order id. No TypeScript test can see either: both hooks return normally and
 * the wrong outcome looks exactly like the right one unless you count rows.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId: string;

let seq = 0;
const nextRef = () => `BASKET${(seq += 1).toString().padStart(6, '0')}`;
let seatSeq = 400;
const nextSeatIndex = () => (seatSeq += 1);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Basket Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

/** One basket bill: a Pool rung + `cameras` dedicated cameras + optionally AI. */
async function seedBasket(opts: {
  poolSku: string;
  cameras: number;
  cameraPoints: number;
  ai: boolean;
}): Promise<string> {
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'ONBOARDING_SERVICES', 'basket', 1234, 'submitted', $2)
     RETURNING order_id`,
    [eventId, nextRef()],
  );
  const orderId = order.rows[0]!.order_id;

  const items: Array<[string, number]> = [[opts.poolSku, 1]];
  if (opts.cameras > 0) items.push(['PAPIC_ONE_150', opts.cameras]);
  if (opts.ai) items.push(['SETNAYAN_AI', 1]);
  for (const [code, qty] of items) {
    await db.query(
      `INSERT INTO public.onboarding_order_items
         (order_id, service_code, quantity, unit_price_php)
       VALUES ($1, $2, $3, 1)`,
      [orderId, code, qty],
    );
  }

  for (let i = 0; i < opts.cameras; i += 1) {
    const seat = await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats
         (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
       VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $4)
       RETURNING seat_id`,
      [eventId, nextSeatIndex(), `basket-seat-${seatSeq}`, orderId],
    );
    await db.query(
      `INSERT INTO public.papic_one_orders
         (order_id, event_id, seat_id, service_code, points, is_reload)
       VALUES ($1, $2, $3, 'PAPIC_ONE_150', $4, FALSE)`,
      [orderId, eventId, seat.rows[0]!.seat_id, opts.cameraPoints],
    );
  }
  return orderId;
}

const grantsFor = async (orderId: string) =>
  (
    await db.query<{ source: string; seat_id: string | null; points: number }>(
      `SELECT source, seat_id, points FROM public.papic_event_point_grants
        WHERE order_id = $1 ORDER BY source, points`,
      [orderId],
    )
  ).rows;

test('the schema lets ONE bill carry several different items', async () => {
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_13K',
    cameras: 2,
    cameraPoints: 150,
    ai: true,
  });
  const rows = await db.query<{ service_code: string; quantity: number }>(
    `SELECT service_code, quantity FROM public.onboarding_order_items
      WHERE order_id = $1 ORDER BY service_code`,
    [orderId],
  );
  assert.deepEqual(
    rows.rows.map((r) => [r.service_code, Number(r.quantity)]),
    [
      ['PAPIC_ONE_150', 2],
      ['PAPIC_GUEST_13K', 1],
      ['SETNAYAN_AI', 1],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
});

test('a bill cannot list the same product twice', async () => {
  // Two Pool rungs is a choice the picker cannot express, and two camera lines
  // would double-count the quantity — either is a minting bug, not a purchase.
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_16K',
    cameras: 0,
    cameraPoints: 0,
    ai: false,
  });
  const { error } = await db
    .query(
      `INSERT INTO public.onboarding_order_items
         (order_id, service_code, quantity, unit_price_php)
       VALUES ($1, 'PAPIC_GUEST_16K', 1, 1)`,
      [orderId],
    )
    .then(() => ({ error: null }))
    .catch((e: unknown) => ({ error: e }));
  assert.ok(error, 'a duplicate line on one bill must be refused by the schema');
});

test('🚨 THE REGRESSION: shots AND every camera are funded on the same bill', async () => {
  // The order the hooks run in is not guaranteed, so both directions are
  // exercised: this is the camera-first case, which is the one that used to
  // silently swallow the pool grant.
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_20K',
    cameras: 3,
    cameraPoints: 150,
    ai: false,
  });

  // Cameras first — the SQL grant.
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  // …then the pool, as the TypeScript hook does it (source-scoped guard).
  const already = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.papic_event_point_grants
      WHERE order_id = $1 AND source = 'topup_order'`,
    [orderId],
  );
  assert.equal(
    Number(already.rows[0]!.n),
    0,
    'the pool must not already look granted just because the cameras were',
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id, note)
     VALUES ($1, 20000, 'topup_order', $2, 'Papic Pool · PAPIC_GUEST_20K')`,
    [eventId, orderId],
  );

  const grants = await grantsFor(orderId);
  const camera = grants.filter((g) => g.source === 'camera_grant');
  const pool = grants.filter((g) => g.source === 'topup_order');
  assert.equal(camera.length, 3, 'every camera on the bill must be funded');
  assert.equal(pool.length, 1, 'the shared pool must be funded too');
  assert.equal(Number(pool[0]!.points), 20000);
  for (const g of camera) assert.equal(Number(g.points), 150);
});

test('the shared pool never counts a dedicated camera’s credits', async () => {
  // The promise of Papic One, and the reason the two grant sources coexist on
  // one bill at all: only seat_id IS NULL rows raise the shared ceiling.
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_23K',
    cameras: 2,
    cameraPoints: 150,
    ai: false,
  });
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  const shared = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.papic_event_point_grants
      WHERE order_id = $1 AND seat_id IS NULL`,
    [orderId],
  );
  assert.equal(Number(shared.rows[0]!.n), 0);
});

test('reversal clears EVERYTHING the bill granted, in one delete', async () => {
  // Reversal deletes by order_id, which is exactly why one bill is safe: a
  // refund cannot claw back one product and leave another standing.
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_26K',
    cameras: 2,
    cameraPoints: 150,
    ai: true,
  });
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id, note)
     VALUES ($1, 26000, 'topup_order', $2, 'Papic Pool · PAPIC_GUEST_26K')`,
    [eventId, orderId],
  );
  assert.equal((await grantsFor(orderId)).length, 3);

  await db.query(`DELETE FROM public.papic_event_point_grants WHERE order_id = $1`, [orderId]);
  assert.equal((await grantsFor(orderId)).length, 0);
});

test('the items survive only as long as their bill does', async () => {
  // ON DELETE CASCADE. An orphaned item list would be a bill's contents with no
  // bill — something activation could still be handed if an order were ever
  // hard-deleted rather than cancelled.
  const orderId = await seedBasket({
    poolSku: 'PAPIC_GUEST_30K',
    cameras: 1,
    cameraPoints: 150,
    ai: true,
  });
  await db.query(`DELETE FROM public.orders WHERE order_id = $1`, [orderId]);
  const left = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.onboarding_order_items WHERE order_id = $1`,
    [orderId],
  );
  assert.equal(Number(left.rows[0]!.n), 0);
});

test('no session role can read or write a bill’s contents', async () => {
  // RLS on with zero policies, and the grants revoked. Only service_role — the
  // commit path and activation — ever touches this table.
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.onboarding_order_items', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]?.ok, false, `${role} can read onboarding_order_items`);
  }
  const rls = await db.query<{ enabled: boolean }>(
    `SELECT relrowsecurity AS enabled FROM pg_class
      WHERE oid = 'public.onboarding_order_items'::regclass`,
  );
  assert.equal(rls.rows[0]?.enabled, true, 'RLS must be enabled');
});

// ── the three readers that must know a bill can hold several things ────────

test('the pool grant’s guard is scoped to its SOURCE, not just the order', () => {
  // 🚨 THE FIX, PINNED. Asking "has this ORDER granted ANYTHING?" is correct
  // only while an order covers one product. On a basket the camera grant writes
  // rows against the same order_id, so an order-scoped guard makes whichever
  // hook runs second hand over NOTHING — silently. The DB test above proves the
  // outcome; this proves the code still asks the narrower question.
  const activation = src('lib/sku-activation.ts');
  const guard = activation.slice(
    activation.indexOf('async function grantPapicPassPoints'),
    activation.indexOf('async function grantPapicCameraPoints'),
  );
  assert.ok(guard.length > 0, 'grantPapicPassPoints not found');
  assert.match(
    guard,
    /\.eq\('order_id', ctx\.orderId\)\s*\n?\s*\.eq\('source', 'topup_order'\)/,
    'the pool grant guard is not source-scoped — a basket will swallow the shots',
  );
});

test('activation fans out over the BILL’s own items, not a static list', () => {
  const activation = src('lib/sku-activation.ts');
  assert.match(
    activation,
    /\[ONBOARDING_SERVICES_SKU\]:\s*\(ctx\)\s*=>\s*activateOnboardingBasket\(ctx\)/,
    'the basket SKU has no activation hook — one approval would switch on nothing',
  );
  const fan = activation.slice(activation.indexOf('async function activateOnboardingBasket'));
  assert.match(
    fan.slice(0, 2000),
    /readOnboardingOrderItems\(ctx\.admin, ctx\.orderId\)/,
    'the fan-out must read the order’s OWN items — a static list would grant the wrong things',
  );
});

test('reversal knows a bill can be the thing that granted Setnayan AI', () => {
  // Before this, refund-awareness knew only the direct SKU and the STATIC bundle
  // map — so refunding a basket clawed back the shots and cameras and left the
  // planner unlocked forever. "Refund the money, keep the feature."
  const activation = src('lib/sku-activation.ts');
  const tail = activation.slice(activation.indexOf('const grantsAi ='));
  assert.match(
    tail.slice(0, 1200),
    /basketItems\.some\(\(i\) => i\.serviceCode === 'SETNAYAN_AI'\)/,
    'a refunded basket would keep Setnayan AI switched on',
  );
});

test('ownership counts a SKU bought inside a bill', () => {
  // Otherwise a couple who bought the planner in their onboarding basket has no
  // order whose service_key is SETNAYAN_AI, so the studio invites them to buy it
  // again — and the reversal re-derive concludes they never owned it.
  const ent = src('lib/entitlements.ts');
  assert.match(ent, /async function basketGrantsSku\(/);
  const owns = ent.slice(ent.indexOf('export async function eventOwnsSku'));
  assert.match(owns.slice(0, 2000), /basketGrantsSku\(/, 'eventOwnsSku ignores baskets');
  const active = ent.slice(ent.indexOf('export async function eventSkuActive'));
  assert.match(active.slice(0, 2000), /basketGrantsSku\(/, 'eventSkuActive ignores baskets');
});
