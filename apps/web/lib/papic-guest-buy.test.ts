import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPIC_GUEST_ACCESS_TOKEN_MIN_LENGTH,
  PAPIC_GUEST_PAYER_NAME_MAX,
  guestOneRungs,
  guestOrderDescription,
  guestPoolRungs,
  guestReceiptName,
  hasOpenGuestOrder,
  mintPapicGuestAccessToken,
  normalisePayerName,
  papicGuestOrderRow,
  resolveGuestReloadTarget,
  resolveGuestRung,
} from './papic-guest-buy';
import type { PapicPassTier } from './papic-pass-tiers';
import type { PapicOneTier } from './papic-one';

/**
 * GUESTS CAN BUY PAPIC — the decisions, pinned without a database.
 *
 * Each block below is one way a guest purchase could go wrong with money or
 * with somebody else's camera. Run: `pnpm test:unit`.
 */

const POOL: PapicPassTier[] = [
  { serviceCode: 'PAPIC_GUEST', points: 3_000, isTopup: false, sortOrder: 10 },
  { serviceCode: 'PAPIC_GUEST_6K', points: 6_000, isTopup: false, sortOrder: 20 },
  { serviceCode: 'PAPIC_GUEST_10K', points: 10_000, isTopup: false, sortOrder: 30 },
  { serviceCode: 'PAPIC_GUEST_TOPUP', points: 10_000, isTopup: true, sortOrder: 40 },
];

const ONE: PapicOneTier[] = [
  { serviceCode: 'PAPIC_CAMERA_MINI_DAY', points: 50, sortOrder: 10 },
  { serviceCode: 'PAPIC_ONE_100', points: 100, sortOrder: 20 },
];

/* ── the ladders a guest may see ────────────────────────────────────────── */

test('the guest pool ladder is exactly the three owner-named rungs', () => {
  assert.deepEqual(
    guestPoolRungs(POOL).map((r) => r.serviceCode),
    ['PAPIC_GUEST', 'PAPIC_GUEST_6K', 'PAPIC_GUEST_10K'], // gitleaks:allow — Papic Pool SKU service_codes, not secrets
    'the owner named three pool rungs for guests; this list must reproduce them',
  );
});

test('the repeatable top-up rung is NOT offered to a guest', () => {
  // PAPIC_GUEST_TOPUP only unlocks once the EVENT already holds 10,000 points —
  // a fact about the couple's purchase history that a guest cannot know and has
  // no business being shown. Offering it would be a button that fails for
  // reasons the buyer cannot see.
  assert.ok(
    !guestPoolRungs(POOL).some((r) => r.serviceCode === 'PAPIC_GUEST_TOPUP'),
    'the is_topup rung leaked into the guest ladder',
  );
});

test('the One ladder is both reload rungs', () => {
  assert.deepEqual(
    guestOneRungs(ONE).map((r) => r.points),
    [50, 100],
  );
});

test('a rung with zero points is dropped from both ladders', () => {
  assert.equal(
    guestPoolRungs([{ serviceCode: 'X', points: 0, isTopup: false, sortOrder: 1 }]).length,
    0,
  );
  assert.equal(guestOneRungs([{ serviceCode: 'X', points: 0, sortOrder: 1 }]).length, 0);
});

/* ── the client sends a CHOICE, never an amount ─────────────────────────── */

test('a live rung resolves to its kind and its points', () => {
  const pool = resolveGuestRung('PAPIC_GUEST_6K', POOL, ONE);
  assert.ok(pool.ok);
  assert.equal(pool.rung.kind, 'pool_topup');
  assert.equal(pool.rung.points, 6_000);

  const one = resolveGuestRung('PAPIC_ONE_100', POOL, ONE);
  assert.ok(one.ok);
  assert.equal(one.rung.kind, 'one_reload');
  assert.equal(one.rung.points, 100);
});

/* ⚠ The placeholder here must be a code that can NEVER be minted. It used to
   be PAPIC_GUEST_50K, which became a REAL rung on 2026-08-26 — at which point
   this test was still green while asserting that a live product is unknown.
   A negative fixture borrowed from the real namespace rots the day the
   namespace grows into it. */
test('an unknown service code is REFUSED, never defaulted to a rung', () => {
  for (const code of ['', '   ', 'PAPIC_GUEST_999K', 'SETNAYAN_AI', 'PAPIC_GUEST_TOPUP']) {
    const r = resolveGuestRung(code, POOL, ONE);
    assert.equal(r.ok, false, `"${code}" resolved to a rung`);
  }
});

test('resolveGuestRung never returns a price — the catalog owns the peso figure', () => {
  const r = resolveGuestRung('PAPIC_GUEST', POOL, ONE);
  assert.ok(r.ok);
  assert.ok(
    !('pricePhp' in r.rung) && !('amount' in r.rung),
    'a rung carrying a price is a second billing source; the catalog is the only one',
  );
});

/* ── "their own camera ONLY" ────────────────────────────────────────────── */

test('a blank request reloads the camera the guest is holding', () => {
  assert.deepEqual(resolveGuestReloadTarget('', 'seat-a'), { ok: true, seatId: 'seat-a' });
  assert.deepEqual(resolveGuestReloadTarget(null, 'seat-a'), { ok: true, seatId: 'seat-a' });
  assert.deepEqual(resolveGuestReloadTarget(undefined, 'seat-a'), { ok: true, seatId: 'seat-a' });
});

test('naming your own camera explicitly is fine', () => {
  assert.deepEqual(resolveGuestReloadTarget('  seat-a  ', 'seat-a'), {
    ok: true,
    seatId: 'seat-a',
  });
});

test('⭐ naming SOMEBODY ELSE-S camera is refused, not silently redirected', () => {
  // The whole security property of the One reload. Honouring the holder's own
  // seat here would be indistinguishable, to the buyer, from us having done
  // what they asked — so a request we did not understand is refused outright.
  const r = resolveGuestReloadTarget('seat-b', 'seat-a');
  assert.deepEqual(r, { ok: false, reason: 'not_your_camera' });
});

test('holding no camera at all cannot resolve to one', () => {
  assert.deepEqual(resolveGuestReloadTarget('seat-b', ''), { ok: false, reason: 'no_camera' });
  assert.deepEqual(resolveGuestReloadTarget('seat-b', null), { ok: false, reason: 'no_camera' });
  assert.deepEqual(resolveGuestReloadTarget(null, null), { ok: false, reason: 'no_camera' });
});

/* ── one open order per (buyer, rung) ───────────────────────────────────── */

test('an open order at the same rung blocks a second one', () => {
  for (const status of ['draft', 'submitted', 'awaiting_payment']) {
    assert.equal(
      hasOpenGuestOrder([{ service_code: 'PAPIC_GUEST', status }], 'PAPIC_GUEST'),
      true,
      `status ${status} should count as open`,
    );
  }
});

test('a SETTLED order at the same rung does not block a second one', () => {
  // A guest who bought 3,000 shots an hour ago is allowed to buy 3,000 more.
  for (const status of ['paid', 'fulfilled', 'cancelled', 'refunded', 'lapsed']) {
    assert.equal(
      hasOpenGuestOrder([{ service_code: 'PAPIC_GUEST', status }], 'PAPIC_GUEST'),
      false,
      `status ${status} should not block`,
    );
  }
});

test('an open order at a DIFFERENT rung does not block', () => {
  assert.equal(
    hasOpenGuestOrder([{ service_code: 'PAPIC_GUEST', status: 'submitted' }], 'PAPIC_ONE_100'),
    false,
  );
});

test('a missing status or code never counts as open', () => {
  assert.equal(hasOpenGuestOrder([{ service_code: 'PAPIC_GUEST', status: null }], 'PAPIC_GUEST'), false);
  assert.equal(hasOpenGuestOrder([{ service_code: null, status: 'submitted' }], 'PAPIC_GUEST'), false);
  assert.equal(hasOpenGuestOrder([], 'PAPIC_GUEST'), false);
});

/* ── the row that says whose order this is ──────────────────────────────── */

test('a seat buyer stamps seat_id and no guest_id', () => {
  const row = papicGuestOrderRow({
    orderId: 'o1',
    buyer: { kind: 'seat', eventId: 'e1', seatId: 's1' },
    seatId: 's1',
    kind: 'one_reload',
    serviceCode: 'PAPIC_ONE_100',
    points: 100,
    payerName: null,
    accessToken: 'T'.repeat(32),
  });
  assert.equal(row.event_id, 'e1');
  assert.equal(row.seat_id, 's1');
  assert.equal(row.guest_id, null);
  assert.equal(row.purchase_kind, 'one_reload');
  assert.equal(row.points, 100);
});

test('a guest-QR buyer stamps guest_id and no seat', () => {
  const row = papicGuestOrderRow({
    orderId: 'o2',
    buyer: { kind: 'guest', eventId: 'e1', guestId: 'g1' },
    seatId: null,
    kind: 'pool_topup',
    serviceCode: 'PAPIC_GUEST',
    points: 3_000,
    payerName: 'Tita Baby',
    accessToken: 'T'.repeat(32),
  });
  assert.equal(row.guest_id, 'g1');
  assert.equal(row.seat_id, null);
  assert.equal(row.payer_name, 'Tita Baby');
});

test('every row carries at least one owner axis — the DB CHECK, in code', () => {
  for (const buyer of [
    { kind: 'seat', eventId: 'e1', seatId: 's1' } as const,
    { kind: 'guest', eventId: 'e1', guestId: 'g1' } as const,
  ]) {
    const row = papicGuestOrderRow({
      orderId: 'o',
      buyer,
      seatId: buyer.kind === 'seat' ? buyer.seatId : null,
      kind: 'pool_topup',
      serviceCode: 'PAPIC_GUEST',
      points: 3_000,
      payerName: null,
      accessToken: 'T'.repeat(32),
    });
    assert.ok(
      row.seat_id !== null || row.guest_id !== null,
      'papic_guest_orders_owner_axis_chk would reject this row',
    );
  }
});

/* ── the bearer token ───────────────────────────────────────────────────── */

test('the access token is long, unguessable and unique across mints', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const t = mintPapicGuestAccessToken();
    assert.ok(
      t.length >= PAPIC_GUEST_ACCESS_TOKEN_MIN_LENGTH,
      'shorter than the DB CHECK allows — the insert would fail',
    );
    assert.match(t, /^[0-9A-HJKMNP-TV-Z]+$/, 'Crockford base32 only');
    assert.ok(!seen.has(t), 'the token minter collided');
    seen.add(t);
  }
});

/* ── the receipt line ───────────────────────────────────────────────────── */

test('a payer name is cleaned, capped and never carries control characters', () => {
  assert.equal(normalisePayerName('  Maria   Reyes  '), 'Maria Reyes');
  assert.equal(normalisePayerName('Maria\nReyes'), 'Maria Reyes');
  assert.equal(normalisePayerName('Maria\u0007\u0000Reyes'), 'Maria Reyes');
  assert.equal(normalisePayerName('Maria\u007FReyes'), 'Maria Reyes');
  assert.equal(normalisePayerName('x'.repeat(400))?.length, PAPIC_GUEST_PAYER_NAME_MAX);
});

test('no name is a legitimate answer, not an error', () => {
  for (const v of ['', '   ', null, undefined, 42, {}]) {
    assert.equal(normalisePayerName(v), null);
  }
});

test('an anonymous receipt names the event, not "unknown"', () => {
  assert.equal(guestReceiptName(null, 'Reyes–Cruz Wedding'), 'Guest of Reyes–Cruz Wedding');
  assert.equal(guestReceiptName('Maria Reyes', 'Reyes–Cruz Wedding'), 'Maria Reyes');
  assert.equal(guestReceiptName(null, null), 'Guest');
});

/* ── the description the admin reads ────────────────────────────────────── */

test('the order description says GUEST out loud, so a blank buyer reads as intent', () => {
  const pool = guestOrderDescription({
    kind: 'pool_topup',
    serviceCode: 'PAPIC_GUEST',
    points: 3_000,
  });
  const one = guestOrderDescription({
    kind: 'one_reload',
    serviceCode: 'PAPIC_ONE_100',
    points: 100,
  });
  // The word GUEST is the load-bearing part: an admin reconciling a transfer
  // has to see at a glance that a guest paid, not the couple.
  for (const d of [pool, one]) assert.match(d, /guest/i);
  // "shared pool" became "shared pot" when Papic Pool stopped being a product
  // name (2026-08-11) — the two descriptions must still say WHERE the shots
  // land, or a top-up and a single-camera reload read identically on a bank line.
  assert.match(pool, /shared pot/i);
  assert.match(one, /one camera/i);
});
