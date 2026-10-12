/**
 * entitlements-in-render-asks-together.test.ts — `eventSkuActive`, IN A RENDER,
 * ASKS ITS LAST THREE QUESTIONS TOGETHER AND STILL ANSWERS THEM IN ORDER.
 *
 * THE ANSWERS are pinned elsewhere, and that file was not touched by this
 * change: `lib/entitlements-ask-once.test.ts` compares the in-render path with
 * the per-product queries (which every action, route handler and job still
 * uses, byte for byte) across 27 scenarios × 3 viewers × 10 products — statuses,
 * purchase-key aliases, bundles, baskets, both comp scopes, internal and founder
 * hosts. It passes unchanged.
 *
 * WHAT THIS FILE HOLDS is what that matrix cannot see:
 *   1 · TOGETHER — the comp question and the internal-host question have both
 *       LEFT before either is answered (they used to be a round trip each).
 *   2 · IN ORDER — the first "yes" still decides: a comp grant unlocks even when
 *       the internal-host read is refused, and nothing is left unhandled.
 *       A refused comp read is still thrown, even when the host is internal.
 *   3 · THE COUNT — an event that owns nothing, and an internally hosted one,
 *       send exactly the requests they sent before. A comped event sends ONE
 *       more (the internal-host question it used to stop short of).
 *
 * ⚠ The promo window is the third question, and it is OFF here
 * (`PROMO_FREE_WINDOWS_ENABLED` unset), as it is in every unit test — its read
 * needs a database. With it on, an event inside a live window also asks comp and
 * internal-host (+2). Read from the code, not executed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { eventSkuActive } from './entitlements';
import { markServiceRoleClient, withRenderScopeForTest } from './request-once';

type Rpc = (args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function standIn(opts: { orders?: Array<{ service_key: string; status: string }>; rpc: Record<string, Rpc> }) {
  const sent: string[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => unknown) => {
                sent.push(table);
                const data = table === 'orders' ? (opts.orders ?? []) : [];
                return Promise.resolve({ data, error: null }).then(resolve);
              };
            }
            return () => chain;
          },
        },
      );
      return chain;
    },
    rpc(name: string, args: Record<string, unknown>) {
      sent.push(name);
      const answer = opts.rpc[name];
      if (!answer) return Promise.resolve({ data: null, error: { message: `no stand-in for ${name}` } });
      return answer(args);
    },
  };
  return { db: markServiceRoleClient(client) as unknown as SupabaseClient, sent };
}

const answers = (data: unknown): Rpc => async () => ({ data, error: null });
const SKU = 'COUPLE_WEBSITE_PRO';
const EVENT = 'event-1';

test('the promo flag is off here — this file exercises comp → internal → founder', () => {
  assert.ok(!process.env.PROMO_FREE_WINDOWS_ENABLED, 'unset PROMO_FREE_WINDOWS_ENABLED to run this file');
});

test('1 · comp and internal-host have both left before either is answered', async () => {
  let releaseComp: (v: { data: unknown; error: unknown }) => void = () => {};
  let releaseInternal: (v: { data: unknown; error: unknown }) => void = () => {};
  const { db, sent } = standIn({
    rpc: {
      event_comp_active_skus: () => new Promise((r) => (releaseComp = r)),
      event_host_is_internal: () => new Promise((r) => (releaseInternal = r)),
      event_host_holds_founder_seat: answers(false),
    },
  });
  const asked = withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU));
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(
    sent,
    ['bundle_components', 'orders', 'event_comp_active_skus', 'event_host_is_internal'],
    'the internal-host question waited for the comp answer — they are a round trip each again',
  );
  releaseComp({ data: [], error: null });
  releaseInternal({ data: false, error: null });
  assert.equal(await asked, false);
  assert.equal(sent[sent.length - 1], 'event_host_holds_founder_seat', 'the founder seat is asked last, and only when the three said no');
});

test('2 · a comp grant still decides first — even when the internal-host read is refused, and nothing is left unhandled', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const { db } = standIn({
      rpc: {
        event_comp_active_skus: answers([SKU]),
        event_host_is_internal: () => Promise.reject(new Error('connection refused')),
      },
    });
    assert.equal(await withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU)), true);
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(unhandled, [], 'the question nobody waited for failed out loud');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('2b · a refused comp read is still thrown — an internal host does not paper over it', async () => {
  const { db } = standIn({
    rpc: {
      event_comp_active_skus: () => Promise.reject(new Error('comp read refused')),
      event_host_is_internal: answers(true),
    },
  });
  await assert.rejects(
    withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU)),
    /comp read refused/,
    'the answers are no longer read in order: internal-host decided before the comp read was looked at',
  );
});

test('2c · an order still decides first — the only other request is the bundle list that left beside it', async () => {
  const { db, sent } = standIn({ orders: [{ service_key: SKU, status: 'paid' }], rpc: {} });
  assert.equal(await withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU)), true);
  // 2026-10-12: the bundle composition (one list per render) leaves with the
  // orders read instead of waiting behind it. Nothing else is asked.
  assert.deepEqual([...sent].sort(), ['bundle_components', 'orders'], 'a paid order now asks more than its orders and the bundle list');
});

test('3 · an event that owns nothing sends the five requests it always sent', async () => {
  const { db, sent } = standIn({
    rpc: {
      event_comp_active_skus: answers([]),
      event_host_is_internal: answers(false),
      event_host_holds_founder_seat: answers(false),
    },
  });
  const result = await withRenderScopeForTest(async () => [
    await eventSkuActive(db, EVENT, SKU),
    await eventSkuActive(db, EVENT, 'ANIMATED_MONOGRAM'),
    await eventSkuActive(db, EVENT, 'PAPIC_UNLOCK'),
  ]);
  assert.deepEqual(result, [false, false, false]);
  assert.deepEqual(
    [...sent].sort(),
    ['bundle_components', 'event_comp_active_skus', 'event_host_holds_founder_seat', 'event_host_is_internal', 'orders'],
  );
});

test('3b · an internally hosted event sends the four it always sent — the founder seat is not asked', async () => {
  const { db, sent } = standIn({
    rpc: { event_comp_active_skus: answers([]), event_host_is_internal: answers(true) },
  });
  assert.equal(await withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU)), true);
  assert.deepEqual([...sent].sort(), ['bundle_components', 'event_comp_active_skus', 'event_host_is_internal', 'orders']);
});

test('3c · a comped event sends ONE more than before: the internal-host question it used to stop short of', async () => {
  const { db, sent } = standIn({
    rpc: { event_comp_active_skus: answers([SKU]), event_host_is_internal: answers(false) },
  });
  assert.equal(await withRenderScopeForTest(() => eventSkuActive(db, EVENT, SKU)), true);
  assert.deepEqual([...sent].sort(), ['bundle_components', 'event_comp_active_skus', 'event_host_is_internal', 'orders']);
});

test('outside a render nothing changed: the questions are still asked one at a time, and stop at the first yes', async () => {
  const { db, sent } = standIn({
    rpc: {
      event_has_comp_for_sku: answers(true),
      event_host_is_internal: answers(true),
    },
  });
  assert.equal(await eventSkuActive(db, EVENT, SKU), true);
  assert.ok(!sent.includes('event_host_is_internal'), 'an action’s gate asked a question past its first yes');
});
