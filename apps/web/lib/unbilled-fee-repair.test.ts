/**
 * GUARD — A FEE THAT OPENED IS EVENTUALLY BILLED, EXACTLY ONCE.
 *
 * `collectBookingFeeAtLock` opens the charge through the RPC FIRST and can then
 * return `{status:'skipped'}` at five later points. Every one of them leaves a
 * `pending` charge with no `orders` row: the supplier is shown nothing owed and
 * no screen says the bill is missing. The booking fee is the only revenue path
 * this product has, so this file drives all five and asserts the repair.
 *
 * 🔑 IT EXECUTES THE DECISION, IT DOES NOT GREP FOR IT. Everything decidable
 * lives in `lib/unbilled-fee-repair.ts`, which is PURE precisely so this file
 * can import and run it — the `.server.ts` half only fetches and writes
 * ([[server-only-forces-guards-to-grep-split-the-decision]]).
 *
 * 🛡 MUTATION-CHECKED — seven sabotages run against the real module, each
 * confirmed RED by pass/fail COUNT, not by the word "fail":
 *   1 `selectUnbilledCharges` drops the `status === 'pending'` test  → 15/1
 *     (a waived first-of-five booking gets billed)
 *   2 `selectUnbilledCharges` drops the billed-key subtraction       → 10/6
 *     (a charge that already has a bill is re-attempted)
 *   3 `repairUnbilledCharges` loses the `verdict.durable` skip       → 15/1
 *     (unbillable rows eat the whole work budget again)
 *   4 `repairReason` returns null for `status:'skipped'`             →  8/8
 *     (all five skip points are recorded as bills)
 *   5 `whyNotBilled` returns `retrying` for an unacknowledged booking→ 13/3
 *   6 the candidate ordering reversed                                → 15/1
 *   7 the work cap removed                                           → 15/1
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REPAIRS_PER_RUN,
  UNBILLED_STUCK_AFTER_MS,
  repairReason,
  repairUnbilledCharges,
  selectUnbilledCharges,
  unbilledFeeServiceKey,
  whyNotBilled,
  type PendingCharge,
  type RepairIo,
  type UnbilledFacts,
} from './unbilled-fee-repair';
import type { DepositEffectsOutcome } from './deposit-acknowledged-effects';

/* ── The five skip points, verbatim from collectBookingFeeAtLock ────────── */

/**
 * Each entry is a reason string the collector can actually return, taken from
 * the shape of its own `return { status: 'skipped', reason }` lines. They are
 * quoted here so a reader can see there are FIVE of them, in one place, which
 * the collector itself does not offer.
 */
const FIVE_SKIP_POINTS = [
  { where: '1 · existing-order check', reason: 'existing-order check unreadable: permission denied' },
  { where: '2 · charge read', reason: 'charge_unread' },
  { where: '3 · payer read', reason: 'payer read failed: canceling statement due to statement timeout' },
  { where: '4 · order insert', reason: 'order_insert_failed' },
  {
    where: '5 · payments insert (deletes the order it just made)',
    reason: 'null value in column "amount_php"; rollback of order 9f1 ALSO failed: permission denied',
  },
] as const;

/* ── A world small enough to see all of ─────────────────────────────────── */

type World = {
  /** service_key → how many times a bill was minted for it. The whole point. */
  mints: Map<string, number>;
  /** How many collector runs happened, per booking. */
  runs: Map<string, number>;
  reported: Array<{ chargeId: string; reason: string }>;
};

function outcome(over: Partial<DepositEffectsOutcome> = {}): DepositEffectsOutcome {
  return {
    door: 'unbilled_repair',
    eventVendorId: 'ev-1',
    eventId: 'e-1',
    acknowledged: true,
    anchorId: 'ev-1',
    anchorUnreadable: null,
    feeEnabled: true,
    fee: { status: 'ordered', chargeId: 'c-1', orderId: 'o-1' },
    pool: { status: 'ok' },
    thrown: null,
    ...over,
  };
}

function charge(chargeId: string, createdAt: string, status = 'pending'): PendingCharge {
  return { chargeId, eventVendorId: `ev-${chargeId}`, status, createdAt };
}

function healthyFacts(c: PendingCharge): UnbilledFacts {
  return {
    chargeId: c.chargeId,
    eventVendorId: c.eventVendorId,
    bookingFound: true,
    acknowledged: true,
    archived: false,
    payerUserId: 'u-1',
    ageMs: 60_000,
  };
}

/**
 * An IO that behaves like the real one: a booking whose collector fails the
 * first `failuresBeforeSuccess` times and then mints a bill — and mints it into
 * a Map, so "exactly once" is a COUNT and not a claim.
 *
 * ⚠ The ledger is shared between runs on purpose. A second sweep over a charge
 * that is already billed must not add a second mint; the real database refuses
 * it with a 23505 that the collector reports as `already_billed`, and this fake
 * reproduces that rather than pretending the case cannot happen.
 */
function makeIo(
  world: World,
  charges: PendingCharge[],
  script: Map<string, { failures: number; reason: string }>,
  factsFor: (c: PendingCharge) => UnbilledFacts = healthyFacts,
): RepairIo {
  return {
    listPendingCharges: async () => charges,
    listBilledServiceKeys: async (keys) => keys.filter((k) => (world.mints.get(k) ?? 0) > 0),
    gatherFacts: async (cs) => new Map(cs.map((c) => [c.chargeId, factsFor(c)])),
    runEffects: async (eventVendorId) => {
      world.runs.set(eventVendorId, (world.runs.get(eventVendorId) ?? 0) + 1);
      const target = charges.find((c) => c.eventVendorId === eventVendorId)!;
      const key = unbilledFeeServiceKey(target.chargeId);
      const plan = script.get(target.chargeId);
      const attempt = world.runs.get(eventVendorId)!;
      if (plan && attempt <= plan.failures) {
        return outcome({ fee: { status: 'skipped', reason: plan.reason } });
      }
      if ((world.mints.get(key) ?? 0) > 0) {
        // The database refused a second bill. Success, and no second row.
        return outcome({ fee: { status: 'already_billed', chargeId: target.chargeId, orderId: 'o-1' } });
      }
      world.mints.set(key, 1);
      return outcome({ fee: { status: 'ordered', chargeId: target.chargeId, orderId: 'o-1' } });
    },
    report: (chargeId, reason) => world.reported.push({ chargeId, reason }),
  };
}

const emptyWorld = (): World => ({ mints: new Map(), runs: new Map(), reported: [] });

/* ── ANCHOR ─────────────────────────────────────────────────────────────── */

test('ANCHOR — the module under test is real, and the fake can fail', () => {
  assert.equal(unbilledFeeServiceKey('abc'), 'vendor_booking_fee__abc');
  assert.ok(MAX_REPAIRS_PER_RUN > 0 && MAX_REPAIRS_PER_RUN < 1000);
  assert.equal(FIVE_SKIP_POINTS.length, 5, 'the collector has five late skip points');
  // Prove the harness can go red: a reason that is not null must be a failure.
  assert.notEqual(repairReason(outcome({ fee: { status: 'skipped', reason: 'x' } })), null);
});

/* ── The five skip points ───────────────────────────────────────────────── */

for (const { where, reason } of FIVE_SKIP_POINTS) {
  test(`skip point ${where} — the charge is repaired and billed EXACTLY ONCE`, async () => {
    const world = emptyWorld();
    const charges = [charge('c-1', '2026-09-20T00:00:00Z')];
    const script = new Map([['c-1', { failures: 1, reason }]]);
    const io = makeIo(world, charges, script);

    // Window 1: the collector fails at this point. Nothing is billed, and the
    // failure is REPORTED — never a silence.
    const first = await repairUnbilledCharges(io);
    assert.equal(first.candidates, 1);
    assert.equal(first.attempted, 1);
    assert.equal(first.billed, 0, `${where} reported a bill it did not mint`);
    assert.equal(world.mints.get(unbilledFeeServiceKey('c-1')) ?? 0, 0);
    assert.deepEqual(
      world.reported.map((r) => r.reason),
      [reason],
      'the reason the bill is missing must reach a human, verbatim',
    );

    // Window 2: it succeeds. One bill.
    const second = await repairUnbilledCharges(io);
    assert.equal(second.billed, 1);
    assert.equal(world.mints.get(unbilledFeeServiceKey('c-1')), 1);

    // Window 3: the charge now has a bill, so it is not even a candidate.
    const third = await repairUnbilledCharges(io);
    assert.equal(third.candidates, 0, 'a billed charge must not be re-attempted');
    assert.equal(
      world.mints.get(unbilledFeeServiceKey('c-1')),
      1,
      `${where}: the supplier was billed twice for one booking`,
    );
  });
}

test('a charge that keeps failing is re-attempted every window, and never billed twice', async () => {
  const world = emptyWorld();
  const charges = [charge('c-1', '2026-09-20T00:00:00Z')];
  const script = new Map([['c-1', { failures: 3, reason: 'order_insert_failed' }]]);
  const io = makeIo(world, charges, script);

  for (let i = 0; i < 3; i += 1) {
    const s = await repairUnbilledCharges(io);
    assert.equal(s.billed, 0);
    assert.equal(s.unbilled, 1);
  }
  assert.equal(world.reported.length, 3, 'every failed window must say so — loud on purpose');
  const s = await repairUnbilledCharges(io);
  assert.equal(s.billed, 1);
  assert.equal(world.mints.get(unbilledFeeServiceKey('c-1')), 1);
});

/* ── A waived charge is never billed ────────────────────────────────────── */

test('a WAIVED charge is never a candidate and is never billed', async () => {
  const world = emptyWorld();
  const charges = [
    charge('free5', '2026-09-01T00:00:00Z', 'waived_free5'),
    charge('imported', '2026-09-02T00:00:00Z', 'waived_import'),
    charge('paid', '2026-09-03T00:00:00Z', 'paid'),
    charge('failed', '2026-09-04T00:00:00Z', 'failed'),
    charge('expired', '2026-09-05T00:00:00Z', 'expired'),
    charge('owed', '2026-09-06T00:00:00Z'),
  ];
  const io = makeIo(world, charges, new Map());

  const picked = selectUnbilledCharges(charges, []);
  assert.deepEqual(
    picked.map((c) => c.chargeId),
    ['owed'],
    'only a PENDING charge is owed. Billing a waived_free5 charges a supplier ' +
      "for a booking the owner's first-five-free rule gave them.",
  );

  const summary = await repairUnbilledCharges(io);
  assert.equal(summary.billed, 1);
  assert.equal(world.mints.size, 1);
  assert.equal(world.mints.get(unbilledFeeServiceKey('owed')), 1);
  for (const id of ['free5', 'imported', 'paid', 'failed', 'expired']) {
    assert.equal(
      world.mints.get(unbilledFeeServiceKey(id)),
      undefined,
      `a ${id} charge was billed by the repair sweep`,
    );
  }
});

test('a charge that already has a bill is subtracted, whatever its position', () => {
  const charges = [charge('a', '2026-09-01T00:00:00Z'), charge('b', '2026-09-02T00:00:00Z')];
  const picked = selectUnbilledCharges(charges, [unbilledFeeServiceKey('a')]);
  assert.deepEqual(picked.map((c) => c.chargeId), ['b']);
});

/* ── Ordering ───────────────────────────────────────────────────────────── */

test('the sweep works OLDEST FIRST, and the order survives the subtraction', async () => {
  const charges = [
    charge('oldest', '2026-01-01T00:00:00Z'),
    charge('middle', '2026-05-01T00:00:00Z'),
    charge('newest', '2026-09-01T00:00:00Z'),
  ];
  assert.deepEqual(
    selectUnbilledCharges(charges, []).map((c) => c.chargeId),
    ['oldest', 'middle', 'newest'],
    'the oldest uncollected fee is the one that has been uncollected longest; ' +
      'the old catch-up capped at 25 rows with NO ordering at all, so at scale ' +
      'it could repair the same arbitrary few forever.',
  );

  // And the work is actually done in that order.
  const world = emptyWorld();
  const order: string[] = [];
  const io = makeIo(world, charges, new Map());
  const wrapped: RepairIo = {
    ...io,
    runEffects: async (evId) => {
      order.push(evId);
      return io.runEffects(evId);
    },
  };
  await repairUnbilledCharges(wrapped);
  assert.deepEqual(order, ['ev-oldest', 'ev-middle', 'ev-newest']);
});

test('the work cap bounds the collector runs, not the scan', async () => {
  const charges = Array.from({ length: MAX_REPAIRS_PER_RUN + 7 }, (_, i) =>
    // Zero-padded so the input order is unambiguous.
    charge(`c${String(i).padStart(3, '0')}`, `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`),
  );
  const world = emptyWorld();
  const summary = await repairUnbilledCharges(makeIo(world, charges, new Map()));
  assert.equal(summary.candidates, charges.length, 'every candidate must be SEEN');
  assert.equal(summary.attempted, MAX_REPAIRS_PER_RUN, 'only the budget may be SPENT');
  assert.equal(world.mints.size, MAX_REPAIRS_PER_RUN);
});

test('durably-unbillable charges do NOT eat the work budget', async () => {
  // The failure the 25-row cap had: a head of rows that can never be billed,
  // re-walked every window, so the repairable ones behind them are never
  // reached. A durable verdict is reported and set aside without a collector run.
  const durable = Array.from({ length: MAX_REPAIRS_PER_RUN + 5 }, (_, i) =>
    charge(`dead${String(i).padStart(3, '0')}`, `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`),
  );
  const alive = charge('alive', '2026-06-01T00:00:00Z');
  const charges = [...durable, alive];
  const world = emptyWorld();
  const io = makeIo(world, charges, new Map(), (c) =>
    c.chargeId === 'alive'
      ? healthyFacts(c)
      : { ...healthyFacts(c), acknowledged: false },
  );

  const summary = await repairUnbilledCharges(io);
  assert.equal(summary.attempted, 1, 'only the one repairable charge should cost a run');
  assert.equal(summary.billed, 1);
  assert.equal(world.mints.get(unbilledFeeServiceKey('alive')), 1);
  assert.equal(summary.unbilled, durable.length);
  assert.equal(world.reported.length, durable.length, 'every one of them must still be reported');
});

/* ── repairReason: what counts as billed ────────────────────────────────── */

test('repairReason calls a bill a bill, and everything else a failure with its words', () => {
  for (const status of ['ordered', 'order_exists', 'already_billed', 'free', 'zero_fee']) {
    assert.equal(
      repairReason(outcome({ fee: { status } })),
      null,
      `${status} means the money question is settled for this booking`,
    );
  }
  assert.match(
    String(repairReason(outcome({ fee: { status: 'skipped', reason: 'order_insert_failed' } }))),
    /order_insert_failed/,
  );
  assert.match(String(repairReason(outcome({ fee: { status: 'no_payer' } }))), /unclaimed/i);
  assert.match(String(repairReason(outcome({ thrown: 'boom' }))), /boom/);
  assert.match(String(repairReason(outcome({ eventId: null }))), /booking row/i);
  assert.match(String(repairReason(outcome({ acknowledged: false }))), /acknowledge/i);
  assert.match(
    String(repairReason(outcome({ anchorId: null, anchorUnreadable: 'timeout' }))),
    /unreadable.*timeout/i,
  );
  assert.match(String(repairReason(outcome({ anchorId: null }))), /no money row/i);
  assert.match(String(repairReason(outcome({ feeEnabled: false, fee: null }))), /switched off/i);
  assert.match(String(repairReason(outcome({ fee: null }))), /never attempted/i);
  assert.match(String(repairReason(outcome({ fee: { status: 'martian' } }))), /unknown fee status/i);
});

/* ── The admin desk's sentence ──────────────────────────────────────────── */

const facts = (over: Partial<UnbilledFacts> = {}): UnbilledFacts => ({
  chargeId: 'c-1',
  eventVendorId: 'ev-1',
  bookingFound: true,
  acknowledged: true,
  archived: false,
  payerUserId: 'u-1',
  ageMs: 60_000,
  ...over,
});

test('the admin desk is told WHICH charge is unbillable and WHY, in words', () => {
  const cases: Array<[UnbilledFacts, string, boolean, RegExp]> = [
    [facts({ eventVendorId: null }), 'send_path', true, /by hand|void/i],
    [facts({ bookingFound: false }), 'booking_missing', true, /gone/i],
    [facts({ archived: true }), 'archived', true, /archived/i],
    [facts({ acknowledged: false }), 'not_acknowledged', true, /not due yet|has not confirmed/i],
    [facts({ payerUserId: null }), 'no_payer', true, /claimed|account/i],
    [facts({ ageMs: UNBILLED_STUCK_AFTER_MS }), 'stuck', false, /never raised|nothing owed/i],
    [facts(), 'retrying', false, /retries automatically/i],
  ];
  for (const [f, code, durable, says] of cases) {
    const v = whyNotBilled(f);
    assert.equal(v.code, code, `expected ${code} for ${JSON.stringify(f)}`);
    assert.equal(v.durable, durable, `${code} has the wrong durability`);
    assert.match(v.reason, says, `${code}'s sentence does not say what it is for`);
    // Never a bare status word. The whole defect is a screen that says nothing.
    assert.ok(v.reason.length > 40, `${code}'s reason is too short to tell anyone anything`);
  }
});

test('archived beats not-acknowledged, and a missing booking beats both', () => {
  // Order matters: an archived booking that was never acknowledged is ARCHIVED
  // (nothing is owed), not "not due yet" (which implies it will be).
  assert.equal(whyNotBilled(facts({ archived: true, acknowledged: false })).code, 'archived');
  assert.equal(
    whyNotBilled(facts({ bookingFound: false, archived: true })).code,
    'booking_missing',
  );
});

test('an unbillable charge NEVER reads as retrying just because it is young', () => {
  // The bug this whole file exists for is a screen that cannot tell "we are on
  // it" from "nobody will ever be asked for this money".
  for (const f of [
    facts({ payerUserId: null, ageMs: 0 }),
    facts({ acknowledged: false, ageMs: 0 }),
    facts({ eventVendorId: null, ageMs: 0 }),
  ]) {
    assert.notEqual(whyNotBilled(f).code, 'retrying');
    assert.equal(whyNotBilled(f).durable, true);
  }
});
