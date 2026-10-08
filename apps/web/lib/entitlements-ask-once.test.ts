/**
 * entitlements-ask-once.test.ts — 🧯 ONE RENDER ASKS EACH ENTITLEMENT FACT ONCE,
 * AND NEVER HANDS ONE EVENT OR ONE PERSON ANOTHER'S ANSWER.
 *
 * Production incident, 2026-10-08. One person in the Event Hub Maker took the
 * database from ~200 requests per five minutes to 3,000–11,000; PostgREST ran
 * out of pooled connections and plain reads came back 504. Measured on one
 * server render (a local run against a counting stand-in — never production):
 *
 *     the Maker page         37 entitlement requests   (COUPLE_WEBSITE_PRO asked 9 times)
 *     one guest page         32 entitlement requests   (7 products × the whole chain)
 *
 * and one Maker open drew the Maker page plus up to four guest pages.
 *
 * WHAT THIS HOLDS — by COUNTING the requests a stubbed client actually
 * receives, never by looking for a `cache(` in the source:
 *
 *   1. THE COUNT. Everything the Maker and the guest page ask, asked by many
 *      components through many service-role client objects, costs at most ONE
 *      request per entitlement shape per event.
 *   2. NO SHARING. Two events, two signed-in people, and a signed-in person vs
 *      the service role never receive each other's answer — and a second
 *      render never receives the first one's.
 *   3. THE SAME ANSWERS. The in-render path and the per-product queries (which
 *      every action, route handler and job still uses, untouched) agree on
 *      every case of a matrix: statuses, purchase-key aliases, bundles, basket
 *      lines, comp grants of both scopes, internal and founder hosts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  checkOrderActive,
  checkOrderOwnership,
  eventActiveSkus,
  eventCompActiveSkus,
  eventHasCompGrant,
  eventHasPapicUnlock,
  eventHostIsInternal,
  eventOwnsSku,
  eventSkuActive,
  fetchBundleComponents,
} from './entitlements';
import { askedOnce, authorityOf, insideRender, markServiceRoleClient, withRenderScopeForTest } from './request-once';
import { stripComments } from './strip-comments';

/* ── A stand-in database that answers each query shape the way the real one does ── */

type Order = { event_id: string; user_id: string; service_key: string; status: string | null; order_id?: string };
type Grant = { host: string; scope: 'all_services' | 'specific_skus'; skus?: string[]; event_id?: string | null };
type World = {
  orders: Order[];
  /** event → the users who host it (the couple). */
  hosts: Record<string, string[]>;
  grants: Grant[];
  internalUsers: string[];
  founderUsers: string[];
  /** order_id → the service codes on that bill. */
  basket: Record<string, string[]>;
  catalog: string[];
  bundles: Array<{ bundle_sku_code: string; component_service_code: string }>;
};

const emptyWorld = (): World => ({
  orders: [],
  hosts: {},
  grants: [],
  internalUsers: [],
  founderUsers: [],
  basket: {},
  catalog: ['COUPLE_WEBSITE_PRO', 'ANIMATED_MONOGRAM', 'SETNAYAN_AI', 'PAPIC_GUEST', 'LIVE_STUDIO', 'PANOOD_SYSTEM'],
  bundles: [
    { bundle_sku_code: 'GUIDED_PACK', component_service_code: 'SETNAYAN_AI' },
    { bundle_sku_code: 'GUIDED_PACK', component_service_code: 'ANIMATED_MONOGRAM' },
    { bundle_sku_code: 'MEDIA_PACK', component_service_code: 'SETNAYAN_AI' },
    { bundle_sku_code: 'MEDIA_PACK', component_service_code: 'PAPIC_GUEST' },
  ],
});

type Counter = Map<string, number>;
const bump = (c: Counter, shape: string) => c.set(shape, (c.get(shape) ?? 0) + 1);
const count = (c: Counter, shape: string) => c.get(shape) ?? 0;
const total = (c: Counter) => [...c.values()].reduce((a, b) => a + b, 0);

/**
 * A client. `viewer: null` is the service role (it sees every row); a viewer
 * sees only the orders they placed — `orders` RLS is purchaser-scoped.
 */
function client(world: World, calls: Counter, viewer: string | null): SupabaseClient {
  const grantsFor = (eventId: string) => {
    const hosts = world.hosts[eventId] ?? [];
    return world.grants.filter((g) => hosts.includes(g.host) && (g.event_id == null || g.event_id === eventId));
  };
  const from = (table: string) => {
    const f: { eq: Record<string, unknown>; in: Record<string, unknown[]>; notIn: Record<string, string[]>; cols: string } = {
      eq: {},
      in: {},
      notIn: {},
      cols: '',
    };
    const run = () => {
      if (table === 'bundle_components') {
        bump(calls, 'bundle_components');
        return { data: world.bundles, error: null };
      }
      if (table === 'orders') {
        // The SHAPE is what the database is asked: one read of the event's rows, or a per-product filter.
        bump(calls, f.in.service_key ? 'orders:per-product' : f.in.status ? 'orders:grid' : 'orders:of-event');
        const rows = world.orders.filter((o) => {
          if (viewer !== null && o.user_id !== viewer) return false;
          if (o.event_id !== f.eq.event_id) return false;
          if (f.in.service_key && !f.in.service_key.includes(o.service_key)) return false;
          if (f.in.status && !f.in.status.includes(o.status)) return false;
          // SQL: `status NOT IN (…)` is not true of NULL.
          if (f.notIn.status && (o.status === null || f.notIn.status.includes(o.status))) return false;
          return true;
        });
        return { data: rows.map((o) => ({ service_key: o.service_key, status: o.status })), error: null };
      }
      bump(calls, `table:${table}`);
      return { data: [], error: null };
    };
    const b: Record<string, unknown> = {
      select: (cols: string) => ((f.cols = cols), b),
      eq: (k: string, v: unknown) => ((f.eq[k] = v), b),
      in: (k: string, v: unknown[]) => ((f.in[k] = v), b),
      not: (k: string, _op: string, v: string) => ((f.notIn[k] = v.replace(/[()"]/g, '').split(',')), b),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return b;
  };
  const rpc = (name: string, args: Record<string, string>) => {
    bump(calls, `rpc:${name}`);
    const eventId = args.p_event_id as string;
    const hosts = world.hosts[eventId] ?? [];
    const answer = (() => {
      switch (name) {
        case 'event_has_comp_for_sku':
          return grantsFor(eventId).some((g) => g.scope === 'all_services' || (g.skus ?? []).includes(args.p_service_key as string));
        case 'event_comp_active_skus': {
          const mine = grantsFor(eventId);
          if (mine.some((g) => g.scope === 'all_services')) return world.catalog;
          return [...new Set(mine.flatMap((g) => g.skus ?? []))];
        }
        case 'event_host_is_internal':
          return hosts.some((h) => world.internalUsers.includes(h));
        case 'event_host_holds_founder_seat':
          return hosts.some((h) => world.founderUsers.includes(h));
        case 'event_basket_orders_granting': {
          // The function answers for the COUPLE (or the service role), whoever placed the order.
          if (viewer !== null && !hosts.includes(viewer)) return [];
          return world.orders
            .filter((o) => o.event_id === eventId && o.order_id && (world.basket[o.order_id] ?? []).includes(args.p_service_code as string))
            .map((o) => ({ order_id: o.order_id, status: o.status }));
        }
        default:
          return null;
      }
    })();
    return Promise.resolve({ data: answer, error: null });
  };
  const c = { from, rpc } as unknown as SupabaseClient;
  return viewer === null ? markServiceRoleClient(c) : c;
}

const E1 = 'event-1';
const E2 = 'event-2';
const ANA = 'user-ana';
const BEN = 'user-ben';

/** Everything the Maker page and the guest pages were measured asking, in one render. */
const MAKER_AND_GUEST_ASKS: Array<(db: () => SupabaseClient, eventId: string) => Promise<unknown>> = [
  // The Maker page — Event Hub Pro was asked NINE times by nine components.
  ...Array.from({ length: 9 }, () => (db: () => SupabaseClient, e: string) => eventSkuActive(db(), e, 'COUPLE_WEBSITE_PRO')),
  (db, e) => eventOwnsSku(db(), e, 'COUPLE_WEBSITE_PRO'),
  (db, e) => eventOwnsSku(db(), e, 'ANIMATED_MONOGRAM'),
  (db, e) => eventSkuActive(db(), e, 'LIVE_WALL'),
  (db, e) => eventActiveSkus(db(), e),
  // The guest page — seven products, each of which walked the whole chain.
  (db, e) => eventSkuActive(db(), e, 'ANIMATED_MONOGRAM'),
  (db, e) => eventSkuActive(db(), e, 'STD_PREMIUM_OPENINGS'),
  (db, e) => eventSkuActive(db(), e, 'PAPIC_GUEST'),
  (db, e) => eventSkuActive(db(), e, 'PAPIC_GUEST_6K'),
  (db, e) => eventSkuActive(db(), e, 'PAPIC_GUEST_10K'),
  (db, e) => eventSkuActive(db(), e, 'PAPIC_GUEST_TOPUP'),
  (db, e) => eventHasPapicUnlock(db(), e),
  (db, e) => eventHostIsInternal(db(), e),
];

const ENTITLEMENT_SHAPES = [
  'orders:of-event',
  'orders:grid',
  'orders:per-product',
  'bundle_components',
  'rpc:event_comp_active_skus',
  'rpc:event_has_comp_for_sku',
  'rpc:event_basket_orders_granting',
  'rpc:event_host_is_internal',
  'rpc:event_host_holds_founder_seat',
] as const;

/* ═══ 0 · THE HARNESS CAN SEE A RENDER, AND CAN SEE ITS ABSENCE ═══════════ */

test('plain node is NOT a render, and the test scope IS one (a guard that cannot tell passes everything)', async () => {
  assert.equal(insideRender(), false, 'outside a render nothing may be remembered');
  await withRenderScopeForTest(async () => assert.equal(insideRender(), true));
  assert.equal(insideRender(), false, 'the scope leaked past its render');
});

/* ═══ 1 · THE COUNT ══════════════════════════════════════════════════════ */

test('one render of everything the Maker and a guest page ask: at most ONE request per entitlement shape', async () => {
  // The owner's own event in the incident: an internal host, nothing bought.
  const world = emptyWorld();
  world.hosts[E1] = [ANA];
  world.internalUsers = [ANA];
  const calls: Counter = new Map();
  // A NEW service-role client for every asker — `createAdminClient()` builds one per call.
  const db = () => client(world, calls, null);

  await withRenderScopeForTest(async () => {
    await Promise.all(MAKER_AND_GUEST_ASKS.map((ask) => ask(db, E1)));
  });

  for (const shape of ENTITLEMENT_SHAPES) {
    assert.ok(count(calls, shape) <= 1, `${shape} was asked ${count(calls, shape)} times in one render`);
  }
  // The exact bill for this event: the orders, the bundle map, the comp list, the internal host.
  assert.equal(count(calls, 'orders:of-event'), 1);
  assert.equal(count(calls, 'bundle_components'), 1);
  assert.equal(count(calls, 'rpc:event_comp_active_skus'), 1);
  assert.equal(count(calls, 'rpc:event_host_is_internal'), 1);
  assert.equal(count(calls, 'orders:per-product'), 0, 'a per-product orders read is back in a render');
  assert.equal(count(calls, 'orders:grid'), 0, 'the Studio grid read the orders a second time');
  assert.equal(count(calls, 'rpc:event_has_comp_for_sku'), 0, 'a per-product comp RPC is back for an event with no grant');
  assert.equal(count(calls, 'rpc:event_basket_orders_granting'), 0, 'the basket was asked about for an event with no orders at all');
  assert.ok(total(calls) <= 4, `the render made ${total(calls)} entitlement requests: ${JSON.stringify([...calls])}`);
});

test('🔎 the same asks OUTSIDE a render cost dozens — so the "≤ 1" above is the fix holding, not a stub that cannot count', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [ANA];
  world.internalUsers = [ANA];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);

  await Promise.all(MAKER_AND_GUEST_ASKS.map((ask) => ask(db, E1)));

  assert.ok(count(calls, 'rpc:event_has_comp_for_sku') >= 15, `comp per product: ${count(calls, 'rpc:event_has_comp_for_sku')}`);
  assert.ok(count(calls, 'rpc:event_host_is_internal') >= 15, `internal host: ${count(calls, 'rpc:event_host_is_internal')}`);
  assert.ok(count(calls, 'orders:per-product') >= 15, `orders per product: ${count(calls, 'orders:per-product')}`);
  assert.equal(count(calls, 'orders:of-event'), 0, 'an action, a route handler and a job keep the per-product queries, untouched');
  assert.ok(total(calls) >= 60, `only ${total(calls)} requests — the asks no longer exercise the chain`);
});

test('an ordinary couple with no orders and no grant: five requests, whatever the number of products', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [BEN];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => {
    await Promise.all(MAKER_AND_GUEST_ASKS.map((ask) => ask(db, E1)));
  });
  for (const shape of ENTITLEMENT_SHAPES) assert.ok(count(calls, shape) <= 1, `${shape} ×${count(calls, shape)}`);
  // …the founder-seat question is reached too, because nothing before it said yes.
  assert.equal(count(calls, 'rpc:event_host_holds_founder_seat'), 1);
  assert.equal(total(calls), 5);
});

test('the comp gate asked directly, for product after product: one list, no per-product RPC for an event with no grant', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [BEN];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => {
    for (const sku of ['COUPLE_WEBSITE_PRO', 'ANIMATED_MONOGRAM', 'PAPIC_GUEST', 'SETNAYAN_AI']) {
      assert.equal(await eventHasCompGrant(db(), E1, sku), false);
    }
  });
  assert.equal(count(calls, 'rpc:event_comp_active_skus'), 1);
  assert.equal(count(calls, 'rpc:event_has_comp_for_sku'), 0, 'the comp gate asks per product in a render again');
});

test('a comped event answers every covered product from ONE list, and asks per product only where the list cannot say', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [BEN];
  world.grants = [{ host: BEN, scope: 'specific_skus', skus: ['COUPLE_WEBSITE_PRO', 'ANIMATED_MONOGRAM'] }];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => {
    assert.equal(await eventSkuActive(db(), E1, 'COUPLE_WEBSITE_PRO'), true);
    assert.equal(await eventSkuActive(db(), E1, 'ANIMATED_MONOGRAM'), true);
    assert.equal(count(calls, 'rpc:event_has_comp_for_sku'), 0, 'a covered product needed its own RPC');
    // Not on the list while the list has codes → only the per-product function knows (an all-services grant covers keys the catalogue does not list).
    assert.equal(await eventSkuActive(db(), E1, 'PAPIC_GUEST'), false);
    assert.equal(await eventSkuActive(db(), E1, 'PAPIC_GUEST'), false);
    assert.equal(count(calls, 'rpc:event_has_comp_for_sku'), 1, 'asked once, however often it is needed');
  });
  assert.equal(count(calls, 'rpc:event_comp_active_skus'), 1);
});

/* ═══ 2 · NO SHARING ═════════════════════════════════════════════════════ */

test('two events in one render never share an answer', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [ANA];
  world.hosts[E2] = [BEN];
  world.orders = [{ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' }];
  world.internalUsers = [];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => {
    assert.equal(await eventSkuActive(db(), E1, 'COUPLE_WEBSITE_PRO'), true);
    assert.equal(await eventSkuActive(db(), E2, 'COUPLE_WEBSITE_PRO'), false, 'event 2 was handed event 1’s paid order');
    assert.equal(await eventOwnsSku(db(), E2, 'COUPLE_WEBSITE_PRO'), false);
    assert.equal(await checkOrderActive(db(), E2, 'COUPLE_WEBSITE_PRO'), false);
    assert.equal(await eventHostIsInternal(db(), E1), false);
  });
  assert.equal(count(calls, 'orders:of-event'), 2, 'each event’s orders are their own read');
});

test('two products of one event never share an answer', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [ANA];
  world.orders = [{ event_id: E1, user_id: ANA, service_key: 'SETNAYAN_AI', status: 'paid' }];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => {
    assert.equal(await eventSkuActive(db(), E1, 'SETNAYAN_AI'), true);
    assert.equal(await eventSkuActive(db(), E1, 'PAPIC_GUEST'), false);
    assert.equal(await eventSkuActive(db(), E1, 'SETNAYAN_AI'), true);
  });
});

test('two signed-in people in one render never share an answer — nor does a person share the service role’s', async () => {
  // Ana placed the order; `orders` RLS shows it to her and not to Ben.
  const world = emptyWorld();
  world.hosts[E1] = [];
  world.orders = [{ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' }];
  const calls: Counter = new Map();
  const ana = client(world, calls, ANA);
  const ben = client(world, calls, BEN);
  const service = () => client(world, calls, null);

  assert.notEqual(authorityOf(ana), authorityOf(ben), 'two session clients were given one authority');
  assert.notEqual(authorityOf(ana), authorityOf(service()));
  assert.equal(authorityOf(service()), authorityOf(service()), 'two service-role clients are the same authority');
  assert.equal(authorityOf(ana), authorityOf(ana));

  await withRenderScopeForTest(async () => {
    // Whoever asks first, each person gets the answer THEIR OWN client reads.
    assert.equal(await checkOrderActive(ben, E1, 'COUPLE_WEBSITE_PRO'), false);
    assert.equal(await checkOrderActive(ana, E1, 'COUPLE_WEBSITE_PRO'), true, 'Ana was handed Ben’s empty answer');
    assert.equal(await checkOrderActive(ben, E1, 'COUPLE_WEBSITE_PRO'), false, 'Ben was handed Ana’s paid order');
    assert.equal(await checkOrderActive(service(), E1, 'COUPLE_WEBSITE_PRO'), true);
    assert.equal(await eventSkuActive(ben, E1, 'COUPLE_WEBSITE_PRO'), false, 'Ben was handed the service role’s answer');
    assert.equal(await eventSkuActive(ana, E1, 'COUPLE_WEBSITE_PRO'), true);
  });
  assert.equal(count(calls, 'orders:of-event'), 3, 'Ana, Ben and the service role each read for themselves — once');
});

test('a signed-in viewer’s own orders read never decides the basket — only the service role may skip it', async () => {
  // The couple's OTHER half placed the basket order: the viewer's own (purchaser-scoped) orders read is empty,
  // and the SECURITY DEFINER function still answers for the couple.
  const world = emptyWorld();
  world.hosts[E1] = [ANA, BEN];
  world.orders = [{ event_id: E1, user_id: ANA, service_key: 'ONBOARDING_SERVICES', status: 'paid', order_id: 'o-1' }];
  world.basket = { 'o-1': ['SETNAYAN_AI'] };
  const calls: Counter = new Map();
  const ben = client(world, calls, BEN);
  await withRenderScopeForTest(async () => {
    assert.equal(await eventSkuActive(ben, E1, 'SETNAYAN_AI'), true, 'the co-host lost a product their partner paid for');
  });
  assert.equal(count(calls, 'rpc:event_basket_orders_granting'), 1);
});

test('a second render never receives the first render’s answer', async () => {
  const world = emptyWorld();
  world.hosts[E1] = [ANA];
  const calls: Counter = new Map();
  const db = () => client(world, calls, null);
  await withRenderScopeForTest(async () => assert.equal(await eventSkuActive(db(), E1, 'COUPLE_WEBSITE_PRO'), false));
  // The payment is approved between the two renders.
  world.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' });
  await withRenderScopeForTest(async () => assert.equal(await eventSkuActive(db(), E1, 'COUPLE_WEBSITE_PRO'), true, 'a paid order was hidden by the last render’s answer'));
  assert.equal(count(calls, 'orders:of-event'), 2);
});

test('the key names everything it was given: a different question or a different subject is a different slot', async () => {
  const a = {};
  const b = {};
  let runs = 0;
  const ask = (c: object, q: string, about: string[]) => askedOnce(c, q, about, async () => ++runs);
  await withRenderScopeForTest(async () => {
    assert.equal(await ask(a, 'q', ['e1', 'sku']), 1);
    assert.equal(await ask(a, 'q', ['e1', 'sku']), 1, 'the same question was asked twice');
    assert.equal(await ask(a, 'q', ['e2', 'sku']), 2, 'another event shared the slot');
    assert.equal(await ask(a, 'q', ['e1', 'sku2']), 3, 'another product shared the slot');
    assert.equal(await ask(a, 'q2', ['e1', 'sku']), 4, 'another question shared the slot');
    assert.equal(await ask(b, 'q', ['e1', 'sku']), 5, 'another client shared the slot');
    // A separator inside a value must not make two subjects collide.
    assert.equal(await ask(a, 'q', ['e1","sku']), 6);
    assert.equal(await ask(a, 'q', ['e1', 'sku']), 1);
  });
  // Outside a render nothing is remembered.
  assert.equal(await ask(a, 'q', ['e1', 'sku']), 7);
  assert.equal(await ask(a, 'q', ['e1', 'sku']), 8);
});

test('the service-role mark is set where the client is BUILT, and nowhere else', () => {
  const root = join(__dirname, '..');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/markServiceRoleClient\(/.test(stripComments(readFileSync(p, 'utf8')))) hits.push(p.slice(root.length + 1));
      }
    }
  };
  walk(join(root, 'lib'));
  walk(join(root, 'app'));
  assert.deepEqual(hits.sort(), ['lib/supabase/admin.ts'], 'a client that is NOT the service role would be handed the service role’s answers');
  const admin = stripComments(readFileSync(join(root, 'lib/supabase/admin.ts'), 'utf8'));
  assert.match(admin, /return markServiceRoleClient\(\s*createClient\(url, key,/, 'createAdminClient no longer marks what it builds — every asker misses every other');
});

/* ═══ 3 · THE SAME ANSWERS, IN A RENDER AND OUT OF ONE ═══════════════════ */

const SKUS = [
  'COUPLE_WEBSITE_PRO',
  'ANIMATED_MONOGRAM', // ← COUPLE_WEBSITE_PRO (alias)
  'STD_PREMIUM_OPENINGS', // ← COUPLE_WEBSITE_PRO (alias)
  'LIVE_STUDIO', // ← PANOOD_SYSTEM (alias)
  'SETNAYAN_AI', // bundle child + basket line
  'PAPIC_GUEST', // bundle child
  'GUIDED_PACK', // a bundle code itself — not in the catalogue
  'PAPIC_UNLOCK',
  'LIVE_WALL', // free for everyone
  'NOT_IN_THE_CATALOGUE',
];

const SCENARIOS: Array<[string, (w: World) => void]> = [
  ['nothing at all', () => {}],
  ['a paid order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' })],
  ['a fulfilled order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'PAPIC_UNLOCK', status: 'fulfilled' })],
  ['a pending order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'submitted' })],
  ['awaiting payment', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'SETNAYAN_AI', status: 'awaiting_payment' })],
  ['a cancelled order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'cancelled' })],
  ['a refunded order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'refunded' })],
  ['a lapsed order', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'PAPIC_GUEST', status: 'lapsed' })],
  ['an order with no status', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: null })],
  ['a status nobody has named yet', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'on_hold' })],
  ['refunded AND bought again', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'SETNAYAN_AI', status: 'refunded' }, { event_id: E1, user_id: ANA, service_key: 'SETNAYAN_AI', status: 'paid' })],
  ['Cast, paid (grandfathers Live Studio)', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'PANOOD_SYSTEM', status: 'paid' })],
  ['a paid bundle', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'GUIDED_PACK', status: 'paid' })],
  ['a pending bundle', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'MEDIA_PACK', status: 'submitted' })],
  ['a refunded bundle', (w) => w.orders.push({ event_id: E1, user_id: ANA, service_key: 'MEDIA_PACK', status: 'refunded' })],
  ['a paid basket with Setnayan AI on the bill', (w) => { w.orders.push({ event_id: E1, user_id: ANA, service_key: 'ONBOARDING_SERVICES', status: 'paid', order_id: 'o-1' }); w.basket['o-1'] = ['SETNAYAN_AI', 'COUPLE_WEBSITE_PRO']; }],
  ['a pending basket', (w) => { w.orders.push({ event_id: E1, user_id: ANA, service_key: 'ONBOARDING_SERVICES', status: 'submitted', order_id: 'o-2' }); w.basket['o-2'] = ['SETNAYAN_AI']; }],
  ['a refunded basket', (w) => { w.orders.push({ event_id: E1, user_id: ANA, service_key: 'ONBOARDING_SERVICES', status: 'refunded', order_id: 'o-3' }); w.basket['o-3'] = ['SETNAYAN_AI']; }],
  ['another event’s paid order', (w) => w.orders.push({ event_id: E2, user_id: ANA, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' })],
  ['a comp for named products', (w) => w.grants.push({ host: ANA, scope: 'specific_skus', skus: ['COUPLE_WEBSITE_PRO', 'NOT_IN_THE_CATALOGUE'] })],
  ['a comp for every service', (w) => w.grants.push({ host: ANA, scope: 'all_services' })],
  ['a comp scoped to ANOTHER event', (w) => w.grants.push({ host: ANA, scope: 'all_services', event_id: E2 })],
  ['a comp scoped to THIS event', (w) => w.grants.push({ host: ANA, scope: 'specific_skus', skus: ['PAPIC_GUEST'], event_id: E1 })],
  ['a comp held by someone who does not host it', (w) => w.grants.push({ host: BEN, scope: 'all_services' })],
  ['an internal host', (w) => w.internalUsers.push(ANA)],
  ['a founder-seat host', (w) => w.founderUsers.push(ANA)],
  ['an internal account that does not host it', (w) => w.internalUsers.push(BEN)],
];

type Answers = Record<string, unknown>;
async function everyAnswer(db: () => SupabaseClient): Promise<Answers> {
  const out: Answers = {};
  for (const sku of SKUS) {
    out[`active:${sku}`] = await eventSkuActive(db(), E1, sku);
    out[`owns:${sku}`] = await eventOwnsSku(db(), E1, sku);
    out[`order-active:${sku}`] = await checkOrderActive(db(), E1, sku);
    out[`order-owned:${sku}`] = await checkOrderOwnership(db(), E1, sku);
    out[`comp:${sku}`] = await eventHasCompGrant(db(), E1, sku);
  }
  const all = await eventActiveSkus(db(), E1);
  out['grid:active'] = [...all.active].sort();
  out['grid:pending'] = [...all.pending].sort();
  out['comp-list'] = [...(await eventCompActiveSkus(db(), E1))].sort();
  out['papic-unlock'] = await eventHasPapicUnlock(db(), E1);
  out['internal'] = await eventHostIsInternal(db(), E1);
  out['bundles'] = await fetchBundleComponents(db());
  return out;
}

test('every answer is the same in a render as outside one — for the service role and for a signed-in host', async () => {
  let compared = 0;
  let trues = 0;
  for (const [name, arrange] of SCENARIOS) {
    for (const viewer of [null, ANA, BEN] as const) {
      const world = emptyWorld();
      world.hosts[E1] = [ANA];
      world.hosts[E2] = [BEN];
      arrange(world);
      const outside = await everyAnswer(() => client(world, new Map(), viewer));
      // One client for the whole render when it is a person's (the request builds one), a new one per ask for the service role.
      const person = viewer === null ? null : client(world, new Map(), viewer);
      const inside = await withRenderScopeForTest(() => everyAnswer(() => person ?? client(world, new Map(), null)));
      assert.deepEqual(inside, outside, `"${name}" as ${viewer ?? 'the service role'}: a render answers differently from the per-product queries`);
      compared += Object.keys(outside).length;
      trues += Object.values(outside).filter((v) => v === true).length;
    }
  }
  // 🔎 The matrix says yes AND no — an all-false matrix would agree with anything.
  assert.ok(compared > 4000, `only ${compared} answers compared`);
  assert.ok(trues > 300, `only ${trues} of the answers are "yes" — the scenarios no longer reach the grants`);
});

test('a refused orders read fails the same way in a render: missing table → not owned, anything else throws with the same words', async () => {
  const refusing = (error: { code: string; message: string }) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'not']) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error }).then(resolve);
    return markServiceRoleClient({ from: () => b, rpc: () => Promise.resolve({ data: null, error: null }) } as unknown as SupabaseClient);
  };
  const missing = { code: '42P01', message: 'relation "orders" does not exist' };
  const timeout = { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool' };
  for (const run of [<T>(fn: () => Promise<T>) => fn(), withRenderScopeForTest]) {
    assert.equal(await run(() => checkOrderActive(refusing(missing), E1, 'COUPLE_WEBSITE_PRO')), false);
    assert.equal(await run(() => checkOrderOwnership(refusing(missing), E1, 'COUPLE_WEBSITE_PRO')), false);
    await assert.rejects(
      run(() => checkOrderActive(refusing(timeout), E1, 'COUPLE_WEBSITE_PRO')),
      /Failed to resolve active entitlement for COUPLE_WEBSITE_PRO: Timed out acquiring connection/,
    );
    await assert.rejects(
      run(() => checkOrderOwnership(refusing(timeout), E1, 'COUPLE_WEBSITE_PRO')),
      /Failed to resolve ownership for COUPLE_WEBSITE_PRO: Timed out acquiring connection/,
    );
    // A read that timed out is NEVER "does not own it" — the gate throws, in a render and out of one.
    await assert.rejects(run(() => eventSkuActive(refusing(timeout), E1, 'COUPLE_WEBSITE_PRO')), /Failed to resolve active entitlement/);
    await assert.rejects(run(() => eventOwnsSku(refusing(timeout), E1, 'COUPLE_WEBSITE_PRO')), /Failed to resolve ownership/);
  }
});
