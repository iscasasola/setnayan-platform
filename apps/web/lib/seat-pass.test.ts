/**
 * seat-pass entitlement + activation-hook contract (Node built-in test runner,
 * run via tsx — `pnpm test:unit`). Seat-finding PR 4/6.
 *
 * Two halves:
 *
 *   1. eventOwnsCustomQrGuest / eventOwnsPakanta — eventOwnsCustomQrGuest gates
 *      a PAID feature surface, so it delegates to the bundle-aware, admin-approved
 *      eventSkuActive reader (paid/fulfilled only). We lock: a paid/fulfilled row
 *      → active; a still-pending 'submitted' row → NOT active (needs approval);
 *      no row → not active; a relinquished (refunded) row → not active; 42P01 →
 *      false (graceful pre-bootstrap); Pakanta stub ALWAYS false.
 *
 *   2. The CUSTOM_QR_GUEST activation hook contract. NOTE: we DON'T import
 *      lib/sku-activation.ts here — it transitively imports a `'use server'`
 *      module (the concierge action → next/headers) that throws outside a Next
 *      request scope, so it isn't importable under the plain node test runner
 *      (every other tested lib in lib/*.test.ts is kept dependency-light for
 *      the same reason). Instead we exercise a dependency-free REPLICA of the
 *      hook body that mirrors lib/sku-activation.ts EXACT_HOOKS['CUSTOM_QR_GUEST']
 *      line-for-line, locking the three invariants the dispatcher contract
 *      requires: (a) it stamps qr_published_at on null-only rows, (b) it appends
 *      a service_activated ledger row, (c) it never throws. If the real hook
 *      drifts from this replica, update both together.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CUSTOM_QR_GUEST_SERVICE_KEY,
  eventOwnsCustomQrGuest,
  eventOwnsPakanta,
  eventSeatingPublished,
} from './seat-pass';

// ── Shared Supabase query-builder stub (same shape as entitlements.test.ts) ──
type QueryResult = {
  data: { status: string }[] | null;
  error: { code?: string; message: string } | null;
};

function makeOwnershipSupabase(result: QueryResult) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    in: () => builder,
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
    // Gates now consult the comp-grant SECURITY DEFINER fns; default = no comp
    // (`data: null` → eventHasCompGrant false, eventCompActiveSkus []).
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return builder as unknown as SupabaseClient;
}

// ── 1. ownership helpers ─────────────────────────────────────────────────────

test('CUSTOM_QR_GUEST_SERVICE_KEY is the canonical literal', () => {
  assert.equal(CUSTOM_QR_GUEST_SERVICE_KEY, 'CUSTOM_QR_GUEST');
});

/*
  ─── THE SIX ORDER-STATUS CASES BELOW COLLAPSED INTO ONE ON 2026-09-06 ──────
  Owner: *"keep custom QR per guest free"*. `CUSTOM_QR_GUEST` joined
  `FREE_FOR_ALL_SKUS`, so `eventSkuActive` — which `eventOwnsCustomQrGuest`
  delegates to — short-circuits TRUE before it reads a single order.

  🔑 SO THE OLD ASSERTIONS DID NOT BECOME WRONG, THEY BECAME UNREACHABLE. They
  pinned real behaviour of a PAID gate: submitted-not-yet-approved → false,
  no row → false, refunded → false, a missing table → false. Every one of those
  paths still exists in `eventSkuActive` and is still tested by
  `entitlements.test.ts` against SKUs that are actually sold. What changed is
  that this SKU no longer reaches them.

  ⚠ REWRITTEN RATHER THAN DELETED, and asserted across the SAME six inputs, so
  the free-for-all short-circuit is proven to hold in every state an order could
  be in — including the two where a paid gate would have said no. If somebody
  re-gates this SKU, this fails and its replacement has to be argued for.
*/
test('eventOwnsCustomQrGuest: TRUE in every order state — the SKU is free for everyone', async () => {
  const states: Array<[string, QueryResult]> = [
    ['a paid row', { data: [{ status: 'paid' }], error: null }],
    ['a fulfilled row', { data: [{ status: 'fulfilled' }], error: null }],
    // The two a PAID gate refused. Both now pass, and that IS the change.
    ['a still-in-reconciliation submitted row', { data: [{ status: 'submitted' }], error: null }],
    ['a refunded-only row', { data: [{ status: 'refunded' }], error: null }],
    ['no rows at all', { data: [], error: null }],
    [
      '42P01 undefined_table (pre-bootstrap)',
      { data: null, error: { code: '42P01', message: 'undefined_table' } },
    ],
  ];

  for (const [label, result] of states) {
    assert.equal(
      await eventOwnsCustomQrGuest(makeOwnershipSupabase(result), 'evt_1'),
      true,
      `${label} → the branded QR should be owned: CUSTOM_QR_GUEST is in ` +
        'FREE_FOR_ALL_SKUS, so ownership never consults an order',
    );
  }
});

test('eventOwnsCustomQrGuest never touches the database — it answers before the read', async () => {
  /*
    The sharper half of the ruling, and the one the loop above cannot show: a
    free-for-all SKU must short-circuit BEFORE any query, so the branded QR
    cannot be withheld by a failing read. A client that throws on any property
    access proves it — the same technique `eventOwnsPakanta` uses below.
  */
  const exploding = new Proxy(
    {},
    {
      get() {
        throw new Error('eventOwnsCustomQrGuest queried the DB for a free-for-all SKU');
      },
    },
  ) as unknown as SupabaseClient;
  assert.equal(await eventOwnsCustomQrGuest(exploding, 'evt_1'), true);
});

test('eventOwnsPakanta: ALWAYS false (Pakanta is not_built · inert stub)', async () => {
  // Pass a deliberately-throwing client to prove the stub never touches the DB.
  const exploding = new Proxy(
    {},
    {
      get() {
        throw new Error('eventOwnsPakanta must NOT query the database (stub)');
      },
    },
  ) as unknown as SupabaseClient;
  assert.equal(await eventOwnsPakanta(exploding, 'evt_1'), false);
  assert.equal(await eventOwnsPakanta(exploding, 'evt_999'), false);
});

// ── 1b. publication gate (FIX 1 — privacy boundary) ─────────────────────────

type SingleResult = {
  data: { published_at: string | null } | null;
  error: { code?: string; message: string } | null;
};

// from().select().eq().maybeSingle() — resolves to { data, error }.
function makePublishedSupabase(result: SingleResult) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
  };
  return builder as unknown as SupabaseClient;
}

test('eventSeatingPublished: published_at set → true (roster may render)', async () => {
  const supabase = makePublishedSupabase({
    data: { published_at: '2026-06-13T00:00:00Z' },
    error: null,
  });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), true);
});

test('eventSeatingPublished: published_at null (DRAFT) → false (no leak)', async () => {
  const supabase = makePublishedSupabase({ data: { published_at: null }, error: null });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), false);
});

test('eventSeatingPublished: no floor-plan row → false', async () => {
  const supabase = makePublishedSupabase({ data: null, error: null });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), false);
});

test('eventSeatingPublished: 42P01 undefined_table → false (graceful, no throw)', async () => {
  const supabase = makePublishedSupabase({
    data: null,
    error: { code: '42P01', message: 'undefined_table' },
  });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), false);
});

test('eventSeatingPublished: 42703 undefined_column → false (graceful)', async () => {
  const supabase = makePublishedSupabase({
    data: null,
    error: { code: '42703', message: 'undefined_column' },
  });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), false);
});

test('eventSeatingPublished: any other read error → false (fail closed, no leak)', async () => {
  const supabase = makePublishedSupabase({
    data: null,
    error: { code: '08006', message: 'connection_failure' },
  });
  assert.equal(await eventSeatingPublished(supabase, 'evt_1'), false);
});

// ── 2. activation-hook contract (dependency-free replica) ────────────────────

type LedgerRow = { order_id: string; event_type: string; metadata: Record<string, unknown> };

/**
 * Dependency-free replica of lib/sku-activation.ts EXACT_HOOKS['CUSTOM_QR_GUEST'].
 * Records the update filter chain + the ledger append into the provided sinks so
 * the test can assert idempotent (null-only) stamping + ledger semantics without
 * importing the server-only dispatcher.
 */
function makeActivationHarness(opts: { updateThrows?: boolean } = {}) {
  const updateCalls: { table: string; patch: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const ledger: LedgerRow[] = [];

  const admin = {
    from(table: string) {
      const call = { table, patch: {} as Record<string, unknown>, filters: [] as [string, unknown][] };
      const chain: Record<string, unknown> = {
        update(patch: Record<string, unknown>) {
          call.patch = patch;
          updateCalls.push(call);
          return chain;
        },
        eq(col: string, val: unknown) {
          call.filters.push([col, val]);
          return chain;
        },
        is(col: string, val: unknown) {
          call.filters.push([col, val]);
          if (opts.updateThrows) return Promise.reject(new Error('db down'));
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  // Mirrors appendLedger's best-effort, never-throws posture.
  async function appendLedgerStub(_db: SupabaseClient, row: { order_id: string; event_type: string; metadata?: Record<string, unknown> }) {
    ledger.push({ order_id: row.order_id, event_type: row.event_type, metadata: row.metadata ?? {} });
  }

  // EXACT replica of the real hook body (keep in sync with lib/sku-activation.ts).
  const hook = async (ctx: { admin: SupabaseClient; eventId: string | null; orderId: string; serviceKey: string; actorUserId: string }) => {
    if (!ctx.eventId) return;
    await ctx.admin
      .from('event_tables')
      .update({ qr_published_at: new Date().toISOString() })
      .eq('event_id', ctx.eventId)
      .is('qr_published_at', null);
    await appendLedgerStub(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      metadata: { service_key: ctx.serviceKey, event_id: ctx.eventId },
    });
  };

  // Never-throws wrapper mirrors activateOrderSku's try/catch.
  const run = async (ctx: { admin: SupabaseClient; eventId: string | null; orderId: string; serviceKey: string; actorUserId: string }) => {
    try {
      await hook(ctx);
    } catch (e) {
      void e; // swallowed, like the dispatcher
    }
  };

  return { admin, updateCalls, ledger, run };
}

test('activation hook: stamps qr_published_at on null-only event_tables rows', async () => {
  const h = makeActivationHarness();
  await h.run({ admin: h.admin, eventId: 'evt_7', orderId: 'ord_1', serviceKey: 'CUSTOM_QR_GUEST', actorUserId: 'adm_1' });
  assert.equal(h.updateCalls.length, 1);
  const call = h.updateCalls[0]!;
  assert.equal(call.table, 'event_tables');
  assert.ok('qr_published_at' in call.patch, 'patch sets qr_published_at');
  // Idempotency: scoped to this event AND only rows still null.
  assert.deepEqual(call.filters, [
    ['event_id', 'evt_7'],
    ['qr_published_at', null],
  ]);
});

test('activation hook: appends exactly one service_activated ledger row', async () => {
  const h = makeActivationHarness();
  await h.run({ admin: h.admin, eventId: 'evt_7', orderId: 'ord_9', serviceKey: 'CUSTOM_QR_GUEST', actorUserId: 'adm_1' });
  assert.equal(h.ledger.length, 1);
  assert.equal(h.ledger[0]!.event_type, 'service_activated');
  assert.equal(h.ledger[0]!.order_id, 'ord_9');
  assert.deepEqual(h.ledger[0]!.metadata, { service_key: 'CUSTOM_QR_GUEST', event_id: 'evt_7' });
});

test('activation hook: no eventId → no-op (no update, no ledger)', async () => {
  const h = makeActivationHarness();
  await h.run({ admin: h.admin, eventId: null, orderId: 'ord_1', serviceKey: 'CUSTOM_QR_GUEST', actorUserId: 'adm_1' });
  assert.equal(h.updateCalls.length, 0);
  assert.equal(h.ledger.length, 0);
});

test('activation hook: NEVER throws even when the update rejects (dispatcher contract)', async () => {
  const h = makeActivationHarness({ updateThrows: true });
  await assert.doesNotReject(() =>
    h.run({ admin: h.admin, eventId: 'evt_7', orderId: 'ord_1', serviceKey: 'CUSTOM_QR_GUEST', actorUserId: 'adm_1' }),
  );
});
