/**
 * Papic ONE — the PURE half of the two-type model (owner-locked 2026-07-29).
 *
 * Everything here runs without a database: rung→points resolution, the
 * reload-vs-new decision, the order row's shape, and the tri-state decode of the
 * shared-pool reserve. The DB half (dedicated metering, idempotency, the catalog
 * being the price source) is papic-dedicated-camera-metering.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPIC_ONE_LEGACY_MINI_SKU,
  PAPIC_ONE_SKU,
  fetchPapicOneTiers,
  isPapicOneSku,
  normalisePapicOneTiers,
  papicOneOrderRow,
  papicOnePointsForSkuIn,
  resolvePapicOneTarget,
} from './papic-one';
import {
  papicCaptureCost,
  resolveEventPoolReserve,
  PAPIC_POINTS_PER_CLIP,
  PAPIC_POINTS_PER_PHOTO,
} from './papic-cameras';
import {
  papicOneRungPhrase,
  papicPoolRungPhrase,
  papicBucketPhrase,
  papicRungDiscountPercent,
} from './papic-tier-copy';

// ── the currency ───────────────────────────────────────────────────────────

test('point currency: 1 photo = 1 credit · a Snippet = 8 credits', () => {
  // ONE currency for BOTH balances (owner-locked 2026-07-29). A clip costs the
  // same 8 whether it is spent from the shared Papic Pool or from a Papic One
  // camera's dedicated bucket — two weights would mean the same 10 seconds of
  // video cost different amounts depending on which camera shot it.
  assert.equal(PAPIC_POINTS_PER_PHOTO, 1);
  assert.equal(PAPIC_POINTS_PER_CLIP, 8);
  assert.equal(papicCaptureCost('photo'), 1);
  assert.equal(papicCaptureCost('clip'), 8);
});

// ── rung → points ──────────────────────────────────────────────────────────

const TIERS = normalisePapicOneTiers([
  { service_code: PAPIC_ONE_SKU, points: 100, sort_order: 20 },
  { service_code: PAPIC_ONE_LEGACY_MINI_SKU, points: 50, sort_order: 10 },
]);

test('One rungs resolve to their points, cheapest first', () => {
  assert.deepEqual(
    TIERS.map((t) => [t.serviceCode, t.points]),
    [
      [PAPIC_ONE_LEGACY_MINI_SKU, 50],
      [PAPIC_ONE_SKU, 100],
    ],
  );
  assert.equal(papicOnePointsForSkuIn(TIERS, PAPIC_ONE_LEGACY_MINI_SKU), 50);
  assert.equal(papicOnePointsForSkuIn(TIERS, PAPIC_ONE_SKU), 100);
});

test('a non-One SKU resolves to NULL, never 0', () => {
  // The distinction is load-bearing: 0 would read as "a One order that grants
  // nothing" and silently activate a Papic POOL order as a dead camera.
  assert.equal(papicOnePointsForSkuIn(TIERS, 'PAPIC_GUEST_6K'), null);
  assert.equal(papicOnePointsForSkuIn(TIERS, ''), null);
  assert.equal(isPapicOneSku('PAPIC_GUEST_6K', TIERS), false);
  assert.equal(isPapicOneSku(PAPIC_ONE_LEGACY_MINI_SKU, TIERS), true);
});

test('unusable rung rows are dropped rather than sold', () => {
  const messy = normalisePapicOneTiers([
    { service_code: PAPIC_ONE_LEGACY_MINI_SKU, points: 50, sort_order: 10 },
    { service_code: '', points: 999, sort_order: 1 }, // no code
    { service_code: 'PAPIC_ONE_ZERO', points: 0, sort_order: 2 }, // no shots
    { service_code: 'PAPIC_ONE_NULL', points: null, sort_order: 3 },
  ]);
  assert.deepEqual(messy.map((t) => t.serviceCode), [PAPIC_ONE_LEGACY_MINI_SKU]);
});

test('₱1 per photo, flat — the owner ratio holds on both rungs', () => {
  // Pinned as a RATIO against the catalog prices the migration asserts, so a
  // reprice of one rung without the other is visible here and not only in prod.
  const priceFor = new Map([
    [PAPIC_ONE_LEGACY_MINI_SKU, 50],
    [PAPIC_ONE_SKU, 100],
  ]);
  for (const t of TIERS) {
    assert.equal(priceFor.get(t.serviceCode)! / t.points, 1);
  }
});

// ── reload vs new camera ───────────────────────────────────────────────────

const SEAT_A = '11111111-1111-4111-8111-111111111111';
const SEAT_B = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '99999999-9999-4999-8999-999999999999';

test('no seat named → a NEW camera', () => {
  assert.deepEqual(resolvePapicOneTarget(null, [SEAT_A]), { mode: 'new' });
  assert.deepEqual(resolvePapicOneTarget('', [SEAT_A]), { mode: 'new' });
  assert.deepEqual(resolvePapicOneTarget('   ', [SEAT_A]), { mode: 'new' });
  assert.deepEqual(resolvePapicOneTarget(undefined, []), { mode: 'new' });
});

test("one of the event's own cameras → a RELOAD of that camera", () => {
  assert.deepEqual(resolvePapicOneTarget(SEAT_B, [SEAT_A, SEAT_B]), {
    mode: 'reload',
    seatId: SEAT_B,
  });
  // whitespace from a form post must not turn a reload into a second camera
  assert.deepEqual(resolvePapicOneTarget(` ${SEAT_A} `, [SEAT_A]), {
    mode: 'reload',
    seatId: SEAT_A,
  });
});

test('a seat from ANOTHER event is REFUSED, not silently demoted to a new camera', () => {
  // Demoting would charge the couple for something they did not ask for;
  // honouring it would top up a stranger's camera on their money. Both are
  // worse than an error, so this is the one branch that must not "do something
  // reasonable".
  assert.deepEqual(resolvePapicOneTarget(FOREIGN, [SEAT_A, SEAT_B]), {
    mode: 'rejected',
    reason: 'unknown_seat',
  });
});

test('the order row snapshots the rung, and records which mode it was', () => {
  const reload = papicOneOrderRow({
    orderId: 'o1',
    eventId: 'e1',
    seatId: SEAT_A,
    serviceCode: PAPIC_ONE_SKU,
    points: 100,
    isReload: true,
  });
  assert.deepEqual(reload, {
    order_id: 'o1',
    event_id: 'e1',
    seat_id: SEAT_A,
    service_code: PAPIC_ONE_SKU,
    points: 100,
    is_reload: true,
  });
  assert.equal(
    papicOneOrderRow({
      orderId: 'o2',
      eventId: 'e1',
      seatId: SEAT_B,
      serviceCode: PAPIC_ONE_LEGACY_MINI_SKU,
      points: 50,
      isReload: false,
    }).is_reload,
    false,
  );
});

// ── the shared-pool reserve's tri-state ────────────────────────────────────

test('shared-pool reserve: booked · refused · not-applicable are three states', () => {
  assert.deepEqual(resolveEventPoolReserve(null, 1), { gate: 'allow', booked: true });
  assert.deepEqual(resolveEventPoolReserve(null, 0), { gate: 'exhausted', booked: false });
  // -1 = a DEDICATED camera. It allows, but nothing was booked — and that half
  // is the point: releasing points that were never booked would refund the
  // couple's shared pool every time a One camera's upload aborted.
  assert.deepEqual(resolveEventPoolReserve(null, -1), { gate: 'allow', booked: false });
});

test('shared-pool reserve fails CLOSED, except on function-not-found', () => {
  assert.deepEqual(resolveEventPoolReserve('XX000', 1), { gate: 'blocked', booked: false });
  assert.deepEqual(resolveEventPoolReserve('57014', null), { gate: 'blocked', booked: false });
  // the seam-cutover carve-out: app code can briefly run ahead of the migration
  assert.deepEqual(resolveEventPoolReserve('42883', null), { gate: 'allow', booked: false });
  assert.deepEqual(resolveEventPoolReserve('PGRST202', null), { gate: 'allow', booked: false });
  // an indeterminate shape is blocked, never a silent allow
  assert.deepEqual(resolveEventPoolReserve(null, 'yes'), { gate: 'blocked', booked: false });
  assert.deepEqual(resolveEventPoolReserve(null, null), { gate: 'blocked', booked: false });
  assert.deepEqual(resolveEventPoolReserve(null, 7), { gate: 'blocked', booked: false });
});

// ── copy is DERIVED, both types ────────────────────────────────────────────

test('rung copy takes its numbers as arguments and names what makes One different', () => {
  assert.equal(
    papicOneRungPhrase(50, 50),
    "₱50 — 50 credits, that camera's own",
  );
  assert.equal(
    papicPoolRungPhrase(3000, 1200),
    '₱1,200 — adds 3,000 credits to your shared pool · 60% off ₱3,000',
  );
  // Reprice either side and the sentence follows — nothing is spelled.
  assert.match(papicOneRungPhrase(100, 100), /₱100 — 100 credits/);
  assert.match(papicPoolRungPhrase(10000, 3200), /₱3,200 — adds 10,000 credits/);

  // ⚠ THE SAVING IS ONLY SHOWN WHEN IT IS REAL. A rung at or above ₱1 a shot
  // must say nothing rather than print "0% off" or a negative one — the ladder
  // is a discount off ₱1 = 1 credit, and a rung that is not a discount is a
  // pricing mistake, not a badge.
  assert.equal(
    papicPoolRungPhrase(100, 100),
    '₱100 — adds 100 credits to your shared pool',
    'a rung priced at exactly ₱1 a shot advertised a discount',
  );
  assert.equal(papicRungDiscountPercent(100, 100), null);
  assert.equal(papicRungDiscountPercent(100, 150), null);
  assert.equal(papicRungDiscountPercent(50_000, 10_000), 80);
  assert.equal(papicRungDiscountPercent(40_000, 10_000), 75);
});

test('a bucket never promises an exact photo+clip split, and discloses the clip cost', () => {
  const phrase = papicBucketPhrase(5); // the free One camera
  assert.match(phrase, /about 5 photographs/);
  assert.match(phrase, new RegExp(`Snippet counts as ${PAPIC_POINTS_PER_CLIP}`));
  // "N photos + M clips" is unkeepable — one purse, and clips eat the photos.
  assert.equal(/\d+\s*photos?\s*\+\s*\d+\s*clips?/i.test(phrase), false);
  assert.match(papicBucketPhrase(1), /about 1 photograph\b/);
  assert.match(papicBucketPhrase(3000), /about 3,000 photographs/);
});

test('🚨 an EMPTY rung table means nothing is on sale — it must not re-arm the seed', async () => {
  // THE REGRESSION THIS EXISTS TO STOP. Papic One is retired (owner 2026-08-11)
  // and every papic_one_tiers row is is_active=false, so the live query returns
  // ZERO ROWS. The old code treated `data.length === 0` as "unreadable" and
  // answered with FALLBACK_ONE_TIERS — a seeded rung that looks completely live,
  // on a path the GUEST BUY action reads. A retired product would have walked
  // back onto sale at a price that came from a constant, not the catalog.
  const readableButEmpty = {
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [], error: null }) }),
      }),
    }),
  } as unknown as Parameters<typeof fetchPapicOneTiers>[0];
  assert.deepEqual(await fetchPapicOneTiers(readableButEmpty), []);

  // …but a genuine read FAILURE still falls back, because then we truly cannot
  // see what is on sale and refusing everything would break a working shop.
  const unreadable = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: null, error: { message: 'permission denied' } }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof fetchPapicOneTiers>[0];
  assert.ok(
    (await fetchPapicOneTiers(unreadable)).length > 0,
    'a failed read must still fall back — an empty answer and a broken answer are different things',
  );
});
