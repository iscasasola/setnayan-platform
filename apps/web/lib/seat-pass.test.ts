/**
 * seat-pass entitlement + activation-hook contract (Node built-in test runner,
 * run via tsx — `pnpm test:unit`). Seat-finding PR 4/6.
 *
 * Two halves:
 *
 *   1. eventOwnsCustomQrGuest / eventOwnsPakanta — delegate to the shared
 *      checkOrderOwnership reader, so we lock: a live row → owned; no row →
 *      not owned; a relinquished (refunded) row → not owned; 42P01 → false
 *      (graceful pre-bootstrap); Pakanta stub ALWAYS false.
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
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder as unknown as SupabaseClient;
}

// ── 1. ownership helpers ─────────────────────────────────────────────────────

test('CUSTOM_QR_GUEST_SERVICE_KEY is the canonical literal', () => {
  assert.equal(CUSTOM_QR_GUEST_SERVICE_KEY, 'CUSTOM_QR_GUEST');
});

test('eventOwnsCustomQrGuest: a paid row confers ownership (true)', async () => {
  const supabase = makeOwnershipSupabase({ data: [{ status: 'paid' }], error: null });
  assert.equal(await eventOwnsCustomQrGuest(supabase, 'evt_1'), true);
});

test('eventOwnsCustomQrGuest: a still-in-reconciliation submitted row → true', async () => {
  const supabase = makeOwnershipSupabase({ data: [{ status: 'submitted' }], error: null });
  assert.equal(await eventOwnsCustomQrGuest(supabase, 'evt_1'), true);
});

test('eventOwnsCustomQrGuest: no rows → false', async () => {
  const supabase = makeOwnershipSupabase({ data: [], error: null });
  assert.equal(await eventOwnsCustomQrGuest(supabase, 'evt_1'), false);
});

test('eventOwnsCustomQrGuest: a refunded-only row → false (refund-aware)', async () => {
  const supabase = makeOwnershipSupabase({ data: [{ status: 'refunded' }], error: null });
  assert.equal(await eventOwnsCustomQrGuest(supabase, 'evt_1'), false);
});

test('eventOwnsCustomQrGuest: 42P01 undefined_table → false (graceful, no throw)', async () => {
  const supabase = makeOwnershipSupabase({
    data: null,
    error: { code: '42P01', message: 'undefined_table' },
  });
  assert.equal(await eventOwnsCustomQrGuest(supabase, 'evt_1'), false);
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
