/**
 * SEC-4b — `lib/order-mint-identity.ts`, the check that replaces the RLS
 * `WITH CHECK (user_id = auth.uid())` we revoked.
 *
 * Migration 20271008178212 makes `service_role` the only role that may INSERT
 * into orders / payments — and service_role bypasses EVERY policy. These tests
 * hold the three properties that keep that from being a downgrade:
 *
 *   1. The identity columns are STAMPED from the server-derived identity, so a
 *      caller cannot smuggle a foreign user_id / event_id / vendor_profile_id.
 *   2. A missing identity FAILS CLOSED — it throws rather than inserting.
 *   3. The refusal message is CONSTANT, so it cannot be read as an oracle.
 *
 * There is a fourth property that is enforced by the COMPILER, not here: the
 * `Forbid<…>` type makes passing `user_id` in `fields` a type error. See the
 * "type error" test at the bottom for the `@ts-expect-error` proof.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MINT_IDENTITY_REFUSED,
  MintIdentityRefused,
  orderRowFor,
  compOrderRowFor,
  paymentRowFor,
} from './order-mint-identity';

/* ── 1 · STAMPING ───────────────────────────────────────────────────────────── */

test('orderRowFor stamps all three identity columns from the server identity', () => {
  const row = orderRowFor(
    { userId: 'user-1', eventId: 'event-1', vendorProfileId: 'vendor-1' },
    { service_key: 'PAPIC_GUEST', requested_total_php: 2999, status: 'submitted' },
  );
  assert.equal(row.user_id, 'user-1');
  assert.equal(row.event_id, 'event-1');
  assert.equal(row.vendor_profile_id, 'vendor-1');
  // …and the caller's own fields survive untouched.
  assert.equal(row.service_key, 'PAPIC_GUEST');
  assert.equal(row.requested_total_php, 2999);
  assert.equal(row.status, 'submitted');
});

test('an eventless / vendorless purchase writes explicit NULLs, never undefined', () => {
  // `undefined` would be dropped from the JSON body and the column would take
  // its default rather than the value the author intended — a silent divergence
  // between "no event" and "forgot the event".
  const row = orderRowFor(
    { userId: 'user-1', eventId: null, vendorProfileId: null },
    { service_key: 'SETNAYAN_AI_SUB', requested_total_php: 499 },
  );
  assert.equal(row.event_id, null);
  assert.equal(row.vendor_profile_id, null);
  assert.ok('event_id' in row && 'vendor_profile_id' in row);
});

test('the stamp WINS — a payload cannot smuggle a foreign identity past it', () => {
  // TypeScript already rejects this (see the compiler test below); this proves
  // the RUNTIME behaviour too, for a payload that reached the helper untyped —
  // e.g. widened through `Record<string, unknown>` on its way in.
  const smuggled = {
    service_key: 'PAPIC_GUEST',
    requested_total_php: 1,
    user_id: 'victim-user',
    event_id: 'victim-event',
    vendor_profile_id: 'victim-vendor',
  } as unknown as { service_key: string; requested_total_php: number };

  const row = orderRowFor(
    { userId: 'attacker', eventId: null, vendorProfileId: null },
    smuggled,
  ) as Record<string, unknown>;

  assert.equal(row.user_id, 'attacker', 'the payload overrode the server identity');
  assert.equal(row.event_id, null, 'a forged event_id survived the stamp');
  assert.equal(row.vendor_profile_id, null, 'a forged vendor_profile_id survived the stamp');
});

test('paymentRowFor binds the row to the verified order and the server user', () => {
  const row = paymentRowFor(
    { userId: 'user-1', verifiedOrderId: 'order-1' },
    { amount_php: 2999, channel: 'gcash' },
  );
  assert.equal(row.user_id, 'user-1');
  assert.equal(row.order_id, 'order-1');
  assert.equal(row.amount_php, 2999);
});

test("paymentRowFor's order binding wins over a smuggled order_id", () => {
  // The pre-fix hole: payments_owner_insert checked the PAYER only, and the FK
  // validated that order_id EXISTS — not that it is yours. So a payment could
  // be pinned onto a stranger's order.
  const smuggled = { amount_php: 1, channel: 'gcash', order_id: 'someone-elses-order' } as unknown as {
    amount_php: number;
    channel: string;
  };
  const row = paymentRowFor(
    { userId: 'user-1', verifiedOrderId: 'my-order' },
    smuggled,
  ) as Record<string, unknown>;
  assert.equal(row.order_id, 'my-order', "a stranger's order_id survived the stamp");
});

/* ── 2 · FAIL CLOSED ────────────────────────────────────────────────────────── */

const BLANK_IDS = ['', '   ', '\n', undefined as unknown as string, null as unknown as string];

test('orderRowFor REFUSES when no server user could be resolved', () => {
  for (const bad of BLANK_IDS) {
    assert.throws(
      () => orderRowFor({ userId: bad, eventId: null, vendorProfileId: null }, { service_key: 'X' }),
      (e: unknown) => e instanceof MintIdentityRefused && e.fault === 'no-server-user',
      `a row was built with userId=${JSON.stringify(bad)} — that inserts an unattributed money row`,
    );
  }
});

test('paymentRowFor REFUSES without a server user or a verified order', () => {
  assert.throws(
    () => paymentRowFor({ userId: '', verifiedOrderId: 'order-1' }, { amount_php: 1 }),
    (e: unknown) => e instanceof MintIdentityRefused && e.fault === 'no-server-user',
  );
  assert.throws(
    () => paymentRowFor({ userId: 'user-1', verifiedOrderId: '  ' }, { amount_php: 1 }),
    (e: unknown) => e instanceof MintIdentityRefused && e.fault === 'no-verified-order',
    'a payment was built with no proven order — that is the "pin it on a stranger" hole',
  );
});

/* ── 3 · NOT AN ORACLE ──────────────────────────────────────────────────────── */

test('every refusal carries the SAME generic message, whatever the cause', () => {
  const messages = new Set<string>();
  const attempts: Array<() => unknown> = [
    () => orderRowFor({ userId: '', eventId: null, vendorProfileId: null }, {}),
    () => orderRowFor({ userId: '  ', eventId: 'e', vendorProfileId: 'v' }, {}),
    () => paymentRowFor({ userId: '', verifiedOrderId: 'order-1' }, {}),
    () => paymentRowFor({ userId: 'user-1', verifiedOrderId: '' }, {}),
  ];
  for (const run of attempts) {
    try {
      run();
      assert.fail('expected a refusal');
    } catch (e) {
      messages.add((e as Error).message);
    }
  }
  assert.deepEqual(
    [...messages],
    [MINT_IDENTITY_REFUSED],
    'refusal messages differ by cause — that turns the helper into an existence oracle. ' +
      'The machine-readable reason belongs on `.fault` (logs and tests), never in `.message`.',
  );
  // …and the message must not leak an id or name a table/column.
  assert.ok(
    !/user_id|order_id|event_id|vendor|orders|payments|uuid/i.test(MINT_IDENTITY_REFUSED),
    'the refusal string names internals',
  );
});

/* ── 4 · THE COMPILER HALF ──────────────────────────────────────────────────── */

/**
 * The strongest guarantee in this module is not runtime — it is that a call
 * site CANNOT write `user_id` itself. These are real assertions under
 * `tsc --noEmit`: if `Forbid<…>` is dropped from a signature, the widened key
 * starts accepting `string` and the `false` below stops being assignable, so
 * the typecheck fails with a pointer straight back here.
 *
 * (Deliberately NOT `@ts-expect-error` on the offending property: TypeScript
 * reports this particular `never` mismatch at the FIRST property of the object
 * literal, not the offending one, so the directive silently lands on the wrong
 * line and the "assertion" degrades into a comment.)
 */
type OrderFields = Parameters<typeof orderRowFor>[1];
type PaymentFields = Parameters<typeof paymentRowFor>[1];
/** `true` when a value of type V may be written to that key. */
type Accepts<K, V> = [V] extends [K] ? true : false;

const _orderRejectsUserId: Accepts<OrderFields['user_id'], string> = false;
const _orderRejectsEventId: Accepts<OrderFields['event_id'], string> = false;
const _orderRejectsVendorId: Accepts<OrderFields['vendor_profile_id'], string> = false;
const _paymentRejectsUserId: Accepts<PaymentFields['user_id'], string> = false;
const _paymentRejectsOrderId: Accepts<PaymentFields['order_id'], string> = false;

test('the compile-time forbid is in force on every identity column', () => {
  // The real assertions are the five `= false` bindings above, checked by tsc.
  // This test exists so the bindings are referenced (no unused-local warning)
  // and so a reader of the test output sees the guarantee named.
  assert.deepEqual(
    [
      _orderRejectsUserId,
      _orderRejectsEventId,
      _orderRejectsVendorId,
      _paymentRejectsUserId,
      _paymentRejectsOrderId,
    ],
    [false, false, false, false, false],
  );
});

/* ── 5 · SEC-4b · F1 — THE RESTORED STATUS GUARDS ───────────────────────────── */

/**
 * `orders_insert_status_guard` / `payments_insert_status_guard` (20270920010000)
 * are RESTRICTIVE `TO authenticated` and both begin `auth.role() =
 * 'service_role' OR …`, so they stopped constraining these paths the moment
 * SEC-4b moved them to `createAdminClient()`. The constraint is re-expressed in
 * the type system, and these `= true/false` bindings are the assertion — same
 * mechanism as § 4.
 *
 * The four accepted order statuses are EXACTLY the policy's allow-list. If
 * someone adds a fifth to make a call site compile, `_orderRejectsPaid` (or its
 * sibling) stops being `false` and tsc fails here.
 */
const _orderAcceptsDraft: Accepts<OrderFields['status'], 'draft'> = true;
const _orderAcceptsSubmitted: Accepts<OrderFields['status'], 'submitted'> = true;
const _orderAcceptsAwaiting: Accepts<OrderFields['status'], 'awaiting_payment'> = true;
const _orderAcceptsCancelled: Accepts<OrderFields['status'], 'cancelled'> = true;
/** The two that skip /admin/payments reconciliation entirely. */
const _orderRejectsPaid: Accepts<OrderFields['status'], 'paid'> = false;
const _orderRejectsRefunded: Accepts<OrderFields['status'], 'refunded'> = false;
/** payments has no allow-list at all — the helper stamps 'pending' itself. */
const _paymentRejectsStatus: Accepts<PaymentFields['status'], 'pending'> = false;
const _paymentRejectsPaid: Accepts<PaymentFields['status'], 'paid'> = false;

test('orderRowFor accepts exactly the four statuses the dropped policy allowed', () => {
  assert.deepEqual(
    [_orderAcceptsDraft, _orderAcceptsSubmitted, _orderAcceptsAwaiting, _orderAcceptsCancelled],
    [true, true, true, true],
  );
  assert.deepEqual([_orderRejectsPaid, _orderRejectsRefunded], [false, false]);
});

test('paymentRowFor stamps status=pending and forbids the call site setting one', () => {
  const row = paymentRowFor(
    { userId: 'user-1', verifiedOrderId: 'order-1' },
    { amount_php: 1500 },
  );
  assert.equal(row.status, 'pending');
  assert.deepEqual([_paymentRejectsStatus, _paymentRejectsPaid], [false, false]);
});

test("paymentRowFor's pending stamp wins over a smuggled status", () => {
  // The compile-time forbid is the real control; this proves the runtime
  // fallback too, for a caller that reaches the function through an `any`.
  const smuggled = { amount_php: 1500, status: 'paid' } as unknown as { amount_php: number };
  const row = paymentRowFor({ userId: 'user-1', verifiedOrderId: 'order-1' }, smuggled);
  assert.equal(row.status, 'pending');
});

test('compOrderRowFor mints a ₱0 paid comp and cannot express a charge', () => {
  const row = compOrderRowFor(
    { userId: 'user-1', eventId: null, vendorProfileId: 'vp-1' },
    { service_key: 'VENDOR_AI_ADDON', reference_code: 'SNDEADBEEF' },
  );
  assert.equal(row.status, 'paid');
  assert.equal(row.requested_total_php, 0);
  assert.equal(row.confirmed_total_php, 0);
  assert.equal(row.user_id, 'user-1');
  assert.equal(row.vendor_profile_id, 'vp-1');
  assert.equal(row.event_id, null);
});

test('compOrderRowFor overrides a smuggled non-zero amount', () => {
  const smuggled = {
    service_key: 'VENDOR_AI_ADDON',
    requested_total_php: 5000,
    confirmed_total_php: 5000,
  } as unknown as { service_key: string };
  const row = compOrderRowFor(
    { userId: 'user-1', eventId: null, vendorProfileId: 'vp-1' },
    smuggled,
  );
  assert.equal(row.requested_total_php, 0);
  assert.equal(row.confirmed_total_php, 0);
});

test('compOrderRowFor REFUSES when no server user could be resolved', () => {
  assert.throws(
    () => compOrderRowFor({ userId: '', eventId: null, vendorProfileId: null }, { service_key: 'X' }),
    (e: unknown) => e instanceof MintIdentityRefused && e.fault === 'no-server-user',
  );
});

/** The comp helper forbids the three columns it stamps. */
type CompFields = Parameters<typeof compOrderRowFor>[1];
const _compRejectsStatus: Accepts<CompFields['status'], 'paid'> = false;
const _compRejectsRequested: Accepts<CompFields['requested_total_php'], number> = false;
const _compRejectsConfirmed: Accepts<CompFields['confirmed_total_php'], number> = false;

test('compOrderRowFor forbids the call site setting status or either amount', () => {
  assert.deepEqual(
    [_compRejectsStatus, _compRejectsRequested, _compRejectsConfirmed],
    [false, false, false],
  );
});
