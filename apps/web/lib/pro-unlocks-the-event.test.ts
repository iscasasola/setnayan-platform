/**
 * pro-unlocks-the-event.test.ts
 *
 * ⚖ OWNER RULE 2026-10-02 (DECISION_LOG, "A PRO PURCHASE UNLOCKS THE EVENT, NOT
 * THE PERSON WHO PAID"): every Pro or paid-service check asks "does THIS EVENT hold
 * it?", never "did THIS USER buy it?" — for every host and co-host, on every page
 * and in every server check, and the page and the server read it the same way.
 *
 * THE DEFECT (batch-3 audit): the Live Studio control pages read `eventSkuActive`
 * through the signed-in user's own Supabase client. `orders` RLS is
 * purchaser-scoped, so a co-host who did not place the order read "not owned" and
 * was told "no route" — while the server gate (`checkoutPoolChannel` →
 * `eventHoldsHostedChannel`, service client) would have handed them the channel.
 * The same shape sat on ~25 more host pages and four server checks.
 *
 * THE FIX: one resolver, `eventEntitlementClient(eventId)`
 * (lib/event-entitlement-client.server.ts → the decision in
 * lib/event-entitlement-client.ts): the service client, handed out only after the
 * viewer is confirmed as a host of THAT event. Every host-facing entitlement read
 * passes it to the reader it already called.
 *
 * WHAT THIS FILE PROVES
 *   1 · DECISION — over stand-in clients that enforce the two RLS facts that
 *       matter (orders: purchaser-only · memberships: own rows only), with the REAL
 *       `eventSkuActive` / `eventCoupleWebsiteProActive` / `eventHoldsHostedChannel`:
 *       co-host B sees Pro for an event whose order host A placed; the page's read
 *       and the server's read agree; a non-host is refused and no service client is
 *       ever built for them.
 *   2 · REACH — every host surface hands the resolver's client to the reader. A
 *       user-session client passed to an entitlement reader on a host surface fails
 *       this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  NotAnEventHostError,
  resolveEventEntitlementClient,
} from '@/lib/event-entitlement-client';
import { eventSkuActive } from '@/lib/entitlements';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { eventHoldsHostedChannel } from '@/lib/live-studio-roam-provision';
import { LIVE_STUDIO_HOSTED_CHANNEL_SKU } from '@/lib/live-studio-control';
import { stripComments } from '@/lib/strip-comments';

/* ── the world ─────────────────────────────────────────────────────────────── */

const EVENT = 'evt_reyes_cruz';
const OTHER_EVENT = 'evt_someone_else';
const HOST_A = 'user_a_paid'; // the couple member who placed both orders
const COHOST_B = 'user_b_cohost'; // accepted moderator — did NOT pay
const GUEST_C = 'user_c_guest'; // an event member, but a guest
const HOST_ELSEWHERE = 'user_d_other_host'; // hosts a DIFFERENT event

type Row = Record<string, unknown>;

function world(): Record<string, Row[]> {
  return {
    orders: [
      { event_id: EVENT, user_id: HOST_A, service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' },
      { event_id: EVENT, user_id: HOST_A, service_key: LIVE_STUDIO_HOSTED_CHANNEL_SKU, status: 'paid' },
    ],
    event_members: [
      { event_id: EVENT, user_id: HOST_A, member_type: 'couple' },
      { event_id: EVENT, user_id: GUEST_C, member_type: 'guest' },
      { event_id: OTHER_EVENT, user_id: HOST_ELSEWHERE, member_type: 'couple' },
    ],
    event_moderators: [
      { event_id: EVENT, user_id: COHOST_B, moderator_id: 'm1', accepted_at: '2026-09-01', removed_at: null },
    ],
  };
}

type Filter = (r: Row) => boolean;

/**
 * A query-builder stand-in over in-memory tables. `rls` is the row policy the real
 * database applies to THIS client — the service client has none.
 */
function fakeClient(opts: {
  tables: Record<string, Row[]>;
  rls?: (table: string, row: Row) => boolean;
  failTables?: ReadonlySet<string>;
  log?: string[];
}): SupabaseClient {
  const { tables, rls = () => true, failTables = new Set(), log } = opts;
  const client = {
    from(table: string) {
      log?.push(table);
      const filters: Filter[] = [];
      const run = () => {
        if (failTables.has(table)) return { data: null, error: { code: '08006', message: 'connection_failure' } };
        const rows = (tables[table] ?? []).filter((r) => rls(table, r)).filter((r) => filters.every((f) => f(r)));
        return { data: rows, error: null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
        neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
        is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
        not: (c: string, op: string, v: unknown) => {
          if (op === 'is') filters.push((r) => (r[c] ?? null) !== v);
          else if (op === 'in') filters.push(() => true);
          return b;
        },
        or: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: () => {
          const res = run();
          return Promise.resolve({ data: res.data ? (res.data[0] ?? null) : null, error: res.error });
        },
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, ko),
      };
      return b;
    },
    // No comp grant, not an internal host, no founder seat: an ordinary event.
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return client as unknown as SupabaseClient;
}

/** The service client: no RLS at all. */
const serviceClientFor = (tables: Record<string, Row[]>, log?: string[]) => fakeClient({ tables, log });

/** A signed-in user's own session: `orders` is purchaser-scoped, memberships are own-row. */
const sessionClientFor = (uid: string, tables: Record<string, Row[]>, failTables?: ReadonlySet<string>) =>
  fakeClient({
    tables,
    failTables,
    rls: (table, row) => {
      if (table === 'orders') return row.user_id === uid; // orders_owner_read: user_id = auth.uid()
      if (table === 'event_members' || table === 'event_moderators') return row.user_id === uid;
      return true;
    },
  });

/** Resolve as `uid`, counting how many service clients were built. */
async function resolveAs(uid: string | null, eventId = EVENT, failTables?: ReadonlySet<string>) {
  const tables = world();
  let built = 0;
  const attempt = resolveEventEntitlementClient({
    eventId,
    userId: uid,
    userClient: sessionClientFor(uid ?? '', tables, failTables),
    serviceClient: () => {
      built += 1;
      return serviceClientFor(tables);
    },
  });
  return { attempt, built: () => built, tables };
}

/* ── 1 · DECISION ──────────────────────────────────────────────────────────── */

test('the defect, reproduced: through her OWN session, co-host B reads the event as NOT owning what host A bought', async () => {
  const tables = world();
  const own = sessionClientFor(COHOST_B, tables);
  assert.equal(await eventSkuActive(own, EVENT, LIVE_STUDIO_HOSTED_CHANNEL_SKU), false);
  assert.equal(await eventCoupleWebsiteProActive(own, EVENT), false);
  // …while the server gate, on the service client, says yes. This disagreement IS the bug.
  assert.equal(await eventHoldsHostedChannel(serviceClientFor(tables), EVENT), true);
});

test('⚖ co-host B sees Pro and the hosted channel for an event whose orders host A placed', async () => {
  const { attempt } = await resolveAs(COHOST_B);
  const ent = await attempt;
  assert.equal(await eventCoupleWebsiteProActive(ent, EVENT), true, 'Event Hub Pro belongs to the EVENT');
  assert.equal(await eventSkuActive(ent, EVENT, LIVE_STUDIO_HOSTED_CHANNEL_SKU), true);
});

test('⚖ the page and the server read it the same way — for the payer and the co-host alike', async () => {
  for (const uid of [HOST_A, COHOST_B]) {
    const { attempt, tables } = await resolveAs(uid);
    const page = await eventSkuActive(await attempt, EVENT, LIVE_STUDIO_HOSTED_CHANNEL_SKU);
    const server = await eventHoldsHostedChannel(serviceClientFor(tables), EVENT);
    assert.equal(page, server, `${uid}: the page must say what the server will do`);
  }
});

test('⚖ a coordinator member (the Live Studio controller admits one) is a host too', async () => {
  const tables = world();
  tables.event_members!.push({ event_id: EVENT, user_id: 'user_e_coord', member_type: 'coordinator' });
  const ent = await resolveEventEntitlementClient({
    eventId: EVENT,
    userId: 'user_e_coord',
    userClient: sessionClientFor('user_e_coord', tables),
    serviceClient: () => serviceClientFor(tables),
  });
  assert.equal(await eventSkuActive(ent, EVENT, LIVE_STUDIO_HOSTED_CHANNEL_SKU), true);
});

test('⛔ a non-host is REFUSED — a guest of the event gets no service client', async () => {
  const { attempt, built } = await resolveAs(GUEST_C);
  await assert.rejects(attempt, NotAnEventHostError);
  assert.equal(built(), 0, 'the service client is never even constructed for a refused viewer');
});

test('⛔ the event id is never trusted — a host of ANOTHER event asking about this one is refused', async () => {
  const { attempt, built } = await resolveAs(HOST_ELSEWHERE, EVENT);
  await assert.rejects(attempt, NotAnEventHostError);
  assert.equal(built(), 0);
});

test('⛔ signed out, a removed co-host, or an unaccepted invite — all refused', async () => {
  const signedOut = await resolveAs(null);
  await assert.rejects(signedOut.attempt, NotAnEventHostError);

  for (const patch of [{ removed_at: '2026-09-20' }, { accepted_at: null }]) {
    const tables = world();
    Object.assign(tables.event_moderators![0]!, patch);
    let built = 0;
    await assert.rejects(
      resolveEventEntitlementClient({
        eventId: EVENT,
        userId: COHOST_B,
        userClient: sessionClientFor(COHOST_B, tables),
        serviceClient: () => (built++, serviceClientFor(tables)),
      }),
      NotAnEventHostError,
      JSON.stringify(patch),
    );
    assert.equal(built, 0);
  }
});

test('⛔ FAIL CLOSED — a membership that cannot be read is "not a host", never "a host"', async () => {
  const { attempt, built } = await resolveAs(COHOST_B, EVENT, new Set(['event_members', 'event_moderators']));
  await assert.rejects(attempt, NotAnEventHostError);
  assert.equal(built(), 0);
});

/* ── 2 · REACH — every host surface uses the resolver ──────────────────────── */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every entitlement reader a host surface calls (client as FIRST argument). */
const READERS = [
  'eventSkuActive',
  'eventOwnsSku',
  'eventActiveSkus',
  'eventHasPapicUnlock',
  'resolveAddOnState',
  'eventOwnsStdOpenings',
  'eventStdOpeningsActive',
  'eventOwnsPapicSeats',
  'eventPapicSeatsActive',
  'eventPapicActive',
  'eventOwnsAnimatedMonogram',
  'eventAnimatedMonogramActive',
  'eventGetsAnimatedMonogramFromHubPro',
  'eventOwnsPapicGuest',
  'eventPapicGuestActive',
  'eventPapicGuestAccess',
  'eventOwnsCustomQrGuest',
  'eventOwnsCoupleWebsitePro',
  'eventCoupleWebsiteProActive',
  'isEditorialProActive',
  'eventOwnsEditorialPro',
  'resolvePanoodTier',
  'resolveBroadcastWindow',
  'canPublishMultiCam',
  'eventKwentoEnabled',
  'resolveEventQrLook',
  'resolveEventMonogram',
  'resolveFaceTagging',
  'loadAfterSummary',
];

/** The trees every viewer of which is a host of the event in the URL. */
const HOST_TREES = ['app/dashboard/[eventId]', 'app/panood/control/[eventId]'];

/**
 * Host-surface reads that stay on a DIRECTLY-built service client, each for a
 * stated reason. Every one is event-level already (service client), so none is the
 * defect; they are listed so a NEW call site cannot slip in unexamined.
 */
const EVENT_LEVEL_BY_OWN_GATE: Record<string, string> = {
  'app/dashboard/[eventId]/studio/papic/actions.ts':
    'purchase actions — service client after the action’s own host gate; money path left untouched',
  'app/dashboard/[eventId]/website/widgets/actions.ts':
    'every action calls requireHostMembershipOrThrow first, then reads on the service client',
  'app/dashboard/[eventId]/story/actions.ts': 'service client after the action’s own host gate',
  'app/dashboard/[eventId]/studio/pakanta/actions.ts': 'service client re-verify after the action’s own row check',
  'app/dashboard/[eventId]/studio/patiktok/actions.ts':
    'face-tagging policy on a booth path any event MEMBER (incl. a guest) may reach — not host-only',
  'app/dashboard/[eventId]/studio/mood-board/concept-pdf/route.ts': 'GET route gated by its own read; service client',
  'app/dashboard/[eventId]/seating/print/route.ts': 'GET route gated by its own read; service client',
  'app/dashboard/[eventId]/seating/export/route.ts': 'GET route gated by its own read; service client',
  'app/dashboard/[eventId]/invitation/print/page.tsx': 'print page gated by its own read; service client',
};

/** A first argument that came from the one resolver. */
const FROM_RESOLVER = /^(ent|await eventEntitlementClient\()/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(abs);
  }
  return out;
}

type Call = { file: string; reader: string; firstArg: string };

function hostCalls(): Call[] {
  const calls: Call[] = [];
  const re = new RegExp(`\\b(${READERS.join('|')})\\(\\s*([^,)]*)`, 'g');
  for (const tree of HOST_TREES) {
    for (const abs of walk(join(WEB, tree))) {
      const src = stripComments(readFileSync(abs, 'utf8'));
      for (const m of src.matchAll(re)) {
        // Skip the declaration of a reader itself (`function eventSkuActive(`).
        if (/function\s+$/.test(src.slice(Math.max(0, m.index! - 12), m.index!))) continue;
        calls.push({ file: relative(WEB, abs), reader: m[1]!, firstArg: m[2]!.trim() });
      }
    }
  }
  return calls;
}

test('the scan sees the host surfaces it is about (a guard that reads nothing proves nothing)', () => {
  const calls = hostCalls();
  const files = new Set(calls.map((c) => c.file));
  for (const f of [
    'app/dashboard/[eventId]/studio/live-studio-control/page.tsx',
    'app/panood/control/[eventId]/page.tsx',
    'app/dashboard/[eventId]/website/our-story/page.tsx',
    'app/dashboard/[eventId]/layout.tsx',
  ]) {
    assert.ok(files.has(f), `expected entitlement reads in ${f}`);
  }
  assert.ok(calls.length >= 60, `only ${calls.length} reader calls found — did the scan break?`);
});

test('⚖ every host-surface entitlement read goes through the one resolver (no user-session client)', () => {
  const offenders = hostCalls()
    .filter((c) => !FROM_RESOLVER.test(c.firstArg))
    .filter((c) => !(c.file in EVENT_LEVEL_BY_OWN_GATE))
    .map((c) => `${c.file} · ${c.reader}(${c.firstArg}, …)`);
  assert.deepEqual(
    offenders,
    [],
    'A host page asked an entitlement question through something other than eventEntitlementClient(eventId). ' +
      'Through a user session, orders RLS shows only what THAT user bought — a co-host reads "not owned".',
  );
});

test('⚖ the reads left on their own gate are still service-client reads — never a user session', () => {
  const session = /^(supabase|await createClient\(|await requireCouple\()/;
  const bad = hostCalls()
    .filter((c) => c.file in EVENT_LEVEL_BY_OWN_GATE)
    .filter((c) => session.test(c.firstArg))
    .map((c) => `${c.file} · ${c.reader}(${c.firstArg}, …)`);
  assert.deepEqual(bad, []);
  // And the list carries no dead rows: each one still holds a read.
  const withReads = new Set(hostCalls().map((c) => c.file));
  for (const f of Object.keys(EVENT_LEVEL_BY_OWN_GATE)) assert.ok(withReads.has(f), `stale exemption: ${f}`);
});

test('the resolver is server-only and builds the service client only after the host check', () => {
  const server = readFileSync(join(WEB, 'lib/event-entitlement-client.server.ts'), 'utf8');
  assert.match(server, /^import 'server-only';/);
  assert.match(stripComments(server), /serviceClient: createAdminClient/);
  const core = stripComments(readFileSync(join(WEB, 'lib/event-entitlement-client.ts'), 'utf8'));
  const check = core.indexOf('viewerHostsEvent(userClient');
  const build = core.indexOf('return serviceClient()');
  assert.ok(check > 0 && build > check, 'membership is checked BEFORE the service client is built');
});
