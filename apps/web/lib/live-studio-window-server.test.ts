/**
 * ⭐ THE GRANT-KIND METERING SPLIT, END TO END (owner-locked 2026-07-26).
 *
 * lib/live-studio-window.test.ts proves the RULE (`classifyGrant` + `grantIsUnmetered`
 * + `decideBroadcastWindow`) against a pure input. This file proves the WIRING: that
 * `resolveBroadcastWindow` actually reads the four grant signals out of the database
 * and hands the right one to the decision — because a correct rule fed the wrong fact
 * is exactly as expensive as a wrong rule.
 *
 * THE ONE THAT COSTS MONEY: an `is_internal` staff account, of which there can be many
 * and which Wave 7 (#3713) made `unmetered`, must resolve to a METERED one-event-day
 * window. A founder seat — owner-granted, capped at 10, "all services free
 * permanently" — must stay unmetered even though that same account is also internal.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolveBroadcastWindow,
  resolveLiveStudioGrantKind,
  stampFirstLiveAt,
} from './live-studio-window-server';
import { LIVE_STUDIO_DAY_HOURS } from './live-studio-window';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolvePath(HERE, rel), 'utf8');

const EVENT = 'S89E-TESTEVENT1';
const T0 = '2026-08-01T10:00:00.000Z';
const t0 = new Date(T0);
const at = (hours: number) => new Date(t0.getTime() + hours * 3_600_000);

/* ══════════════════════════════════════════════════════════════════════════════
   A TABLE-AWARE Supabase stub. Deliberately not reusing entitlements.test.ts's
   `makeOwnedSupabase`: that one ignores which table is queried, and the whole
   question here is that `orders` (day count) and the grant RPCs disagree.
   ══════════════════════════════════════════════════════════════════════════════ */

type Facts = {
  /** paid/fulfilled LIVE_STUDIO-family orders, by created_at. [] = a pure grant. */
  dayOrders?: string[];
  founder?: boolean;
  comp?: boolean;
  internal?: boolean;
  /** RPCs that should error, to prove the fail-closed direction. */
  rpcErrors?: boolean;
  firstLiveAt?: string | null;
};

function stub(facts: Facts): SupabaseClient {
  const dayOrders = facts.dayOrders ?? [];
  const rows = dayOrders.map((created_at) => ({ created_at, status: 'paid' }));

  const table = (name: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      not: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => {
        if (name === 'panood_control_state') {
          return Promise.resolve({
            data: { first_live_at: facts.firstLiveAt === undefined ? T0 : facts.firstLiveAt },
            error: null,
          });
        }
        // No broadcast on air — keeps the never-interrupt rule out of these cases.
        return Promise.resolve({ data: null, error: null });
      },
      then(onOk: (v: unknown) => unknown) {
        // `orders` serves BOTH checkOrderActive (status rows) and
        // fetchBroadcastDayStarts (created_at rows); one row shape satisfies both.
        const data = name === 'orders' ? rows : [];
        return Promise.resolve({ data, error: null }).then(onOk);
      },
    };
    return q;
  };

  return {
    from: (name: string) => table(name),
    rpc: (fn: string) => {
      if (facts.rpcErrors) {
        return Promise.resolve({ data: null, error: { message: 'rpc down' } });
      }
      if (fn === 'event_host_holds_founder_seat')
        return Promise.resolve({ data: Boolean(facts.founder), error: null });
      if (fn === 'event_has_comp_for_sku')
        return Promise.resolve({ data: Boolean(facts.comp), error: null });
      if (fn === 'event_host_is_internal')
        return Promise.resolve({ data: Boolean(facts.internal), error: null });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
}

/* ── resolveLiveStudioGrantKind — the read ──────────────────────────────────── */

test('the resolver reads founder / comp / internal out of the database', async () => {
  assert.equal(await resolveLiveStudioGrantKind(stub({ founder: true }), EVENT), 'founder');
  assert.equal(await resolveLiveStudioGrantKind(stub({ comp: true }), EVENT), 'comp');
  assert.equal(await resolveLiveStudioGrantKind(stub({ internal: true }), EVENT), 'internal');
  assert.equal(await resolveLiveStudioGrantKind(stub({}), EVENT), 'unknown');
});

test('⭐ founder BEATS internal on the real read (the owner account is both)', async () => {
  assert.equal(
    await resolveLiveStudioGrantKind(stub({ founder: true, internal: true }), EVENT),
    'founder',
  );
});

test('FAIL-CLOSED — every grant RPC erroring resolves to unknown (= metered)', async () => {
  assert.equal(await resolveLiveStudioGrantKind(stub({ rpcErrors: true }), EVENT), 'unknown');
  // A blank event id can never be a grant either.
  assert.equal(await resolveLiveStudioGrantKind(stub({ founder: true }), ''), 'unknown');
});

/* ── resolveBroadcastWindow — the whole chain ───────────────────────────────── */

test('⭐ THE CORRECTION — an INTERNAL-hosted event with zero orders is METERED', async () => {
  const supabase = stub({ internal: true });

  const inside = await resolveBroadcastWindow(supabase, EVENT, { now: at(1) });
  assert.equal(inside.multiCam, true, 'inside its one event-day it broadcasts normally');
  assert.equal(inside.reason, 'open', 'NOT "unmetered" — Wave 7 (#3713) returned that here');
  assert.equal(inside.meteredDays, 1);
  assert.equal(inside.expiresAt, at(LIVE_STUDIO_DAY_HOURS).toISOString());

  const after = await resolveBroadcastWindow(supabase, EVENT, { now: at(30) });
  assert.equal(after.multiCam, false, 'the day lapses, exactly like a paying customer');
  assert.equal(after.reason, 'expired');
});

test('FOUNDER — a founder-seat event with zero orders stays unmetered forever', async () => {
  const d = await resolveBroadcastWindow(stub({ founder: true }), EVENT, { now: at(9000) });
  assert.equal(d.multiCam, true);
  assert.equal(d.reason, 'unmetered');
  assert.equal(d.expiresAt, null);
});

test('FOUNDER + INTERNAL — the overlap resolves unmetered, not metered', async () => {
  const d = await resolveBroadcastWindow(stub({ founder: true, internal: true }), EVENT, {
    now: at(9000),
  });
  assert.equal(d.reason, 'unmetered', 'the owner account must not be metered');
});

test('COMP — an admin gift with zero orders stays unmetered', async () => {
  const d = await resolveBroadcastWindow(stub({ comp: true }), EVENT, { now: at(9000) });
  assert.equal(d.reason, 'unmetered');
});

test('a PURCHASED day is metered no matter who the buyer is (internal included)', async () => {
  const d = await resolveBroadcastWindow(
    stub({ internal: true, dayOrders: ['2026-07-20T00:00:00.000Z'] }),
    EVENT,
    { now: at(1) },
  );
  assert.equal(d.days, 1);
  assert.equal(d.reason, 'open');
  assert.equal(d.expiresAt, at(LIVE_STUDIO_DAY_HOURS).toISOString());
});

test('an UNOWNED event never reaches the grant resolver — it is just the free tier', async () => {
  // No orders, no grants: eventSkuActive resolves false and the window short-circuits.
  const d = await resolveBroadcastWindow(stub({}), EVENT, { now: at(1) });
  assert.equal(d.multiCam, false);
  assert.equal(d.reason, 'not-owned');
});

/* ── WIRING GUARDS — the call site is the thing that regresses ──────────────── */

test('resolveBroadcastWindow resolves the grant kind ONLY on the zero-day branch', () => {
  const src = read('./live-studio-window-server.ts');
  assert.match(
    src,
    /dayStarts\.length === 0\s*\?\s*await resolveLiveStudioGrantKind/,
    'the grant read must stay behind the zero-day guard — a paying customer must not pay for four RPCs',
  );
  assert.match(src, /grantKind,/, 'the resolved kind must actually be passed to the decision');
});

test('the precedence ruling lives in the PURE layer, not inline in the reader', () => {
  const src = read('./live-studio-window-server.ts');
  assert.ok(
    src.includes('classifyGrant('),
    'the reader must delegate precedence so all 16 overlaps stay unit-testable',
  );
  assert.ok(
    !/if \(internal\) return 'internal'/.test(src),
    'a second, inline copy of the precedence order is how the two would drift',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   🚨 THE ENTITLEMENT GATE ON THE WINDOW ANCHOR (owner-approved 2026-07-27)

   The defect this closes, in one line: the FREE single-camera livestream ran
   through the same go-live action and stamped the PAID clock, so
   `max(firstLiveAt, boughtAt) + 24h` could expire BEFORE the wedding the couple
   had paid for. See stampFirstLiveAt's header.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * The `stub()` above models reads only. This one adds the two WRITES the stamp
 * performs and records whether the anchor was actually written — which is the
 * whole property under test.
 */
function stampStub(facts: Facts) {
  const dayOrders = facts.dayOrders ?? [];
  const rows = dayOrders.map((created_at) => ({ created_at, status: 'paid' }));
  const wrote: Array<Record<string, unknown>> = [];

  const table = (name: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      not: () => q,
      in: () => q,
      is: () => Promise.resolve({ error: null }),
      order: () => q,
      limit: () => q,
      upsert: () => Promise.resolve({ error: null }),
      update: (payload: Record<string, unknown>) => {
        if (name === 'panood_control_state' && 'first_live_at' in payload) wrote.push(payload);
        return q;
      },
      maybeSingle: () => {
        if (name === 'panood_control_state') {
          return Promise.resolve({
            data: { first_live_at: facts.firstLiveAt === undefined ? null : facts.firstLiveAt },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(onOk: (v: unknown) => unknown) {
        const data = name === 'orders' ? rows : [];
        return Promise.resolve({ data, error: null }).then(onOk);
      },
    };
    return q;
  };

  return {
    client: {
      from: (name: string) => table(name),
      rpc: (fn: string) => {
        if (facts.rpcErrors) return Promise.resolve({ data: null, error: { message: 'rpc down' } });
        if (fn === 'event_host_holds_founder_seat')
          return Promise.resolve({ data: Boolean(facts.founder), error: null });
        if (fn === 'event_has_comp_for_sku')
          return Promise.resolve({ data: Boolean(facts.comp), error: null });
        if (fn === 'event_host_is_internal')
          return Promise.resolve({ data: Boolean(facts.internal), error: null });
        return Promise.resolve({ data: null, error: null });
      },
    } as unknown as SupabaseClient,
    wrote,
  };
}

test('⭐ THE FIX — a FREE go-live does NOT stamp the paid clock', async () => {
  // No orders, no grants → not-owned → the free single-camera livestream. This press
  // is exactly what used to burn the couple's paid day before they had bought it.
  const { client, wrote } = stampStub({});
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, [], 'a free broadcast must never start the ₱2,999 clock');
});

test('⭐ ANTI-VACUITY — a PAID go-live with no anchor DOES stamp', async () => {
  // If this failed the same way, the test above would be worthless: the gate has to
  // refuse the free press and admit the paid one.
  const { client, wrote } = stampStub({ dayOrders: ['2026-07-20T00:00:00.000Z'] });
  await stampFirstLiveAt(client, EVENT);
  assert.equal(wrote.length, 1, 'a paid host pressing live must start their day');
  assert.ok(typeof wrote[0]?.first_live_at === 'string');
});

test('an already-anchored event is not re-stamped (write-once, and idempotent here)', async () => {
  const { client, wrote } = stampStub({
    dayOrders: ['2026-07-20T00:00:00.000Z'],
    firstLiveAt: T0,
  });
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, [], 'the anchor may never move, restart or extend');
});

test('a METERED grant (internal) still stamps — the 2026-07-26 metering ruling holds', async () => {
  // The gate must not accidentally un-meter internal accounts by refusing to start
  // their clock: §4i ② made internal METERED on purpose.
  const { client, wrote } = stampStub({ internal: true });
  await stampFirstLiveAt(client, EVENT);
  assert.equal(wrote.length, 1, 'an internal host gets one metered event-day, so it must anchor');
});

test('FAIL-CLOSED on the write, which is fail-OPEN for the couple', async () => {
  // Grant RPCs down + zero orders → not-owned → no stamp. The paid couple that lands
  // here keeps multiCam via `awaiting-go-live` (no clock), so a transient error costs
  // them nothing and can never shorten a window.
  const { client, wrote } = stampStub({ rpcErrors: true });
  await stampFirstLiveAt(client, EVENT);
  assert.deepEqual(wrote, []);
  const d = await resolveBroadcastWindow(stub({ dayOrders: ['2026-07-20T00:00:00.000Z'], firstLiveAt: null }), EVENT, { now: at(1) });
  assert.equal(d.multiCam, true, 'an unstamped PAID event must still be able to broadcast');
  assert.equal(d.reason, 'awaiting-go-live');
  assert.equal(d.expiresAt, null, 'and it must carry no expiry to run out of');
});

test('🚨 THE REGRESSION, proven both ways — the wedding-day expiry the gate prevents', async () => {
  // The real calendar from the audit: free stream Mon, buy Thu (the 24-hour manual
  // reconciliation SLA forces buying ahead), wedding Sat.
  const mon = '2026-08-03T10:00:00.000Z';
  const thu = '2026-08-06T10:00:00.000Z';
  const sat = new Date('2026-08-08T15:00:00.000Z');

  // BEFORE: the free Monday press had stamped the anchor →
  // max(Mon, Thu) + 24h = Friday → EXPIRED at a Saturday ceremony, on one camera.
  const before = await resolveBroadcastWindow(stub({ dayOrders: [thu], firstLiveAt: mon }), EVENT, {
    now: sat,
  });
  assert.equal(before.multiCam, false, 'this is the defect: paid, and cut to one camera');
  assert.equal(before.reason, 'expired');

  // AFTER: the free press no longer stamps, so the anchor is still null on Saturday;
  // the first ENTITLED go-live is the ceremony itself and the day starts there.
  const atCeremony = await resolveBroadcastWindow(
    stub({ dayOrders: [thu], firstLiveAt: null }),
    EVENT,
    { now: sat },
  );
  assert.equal(atCeremony.multiCam, true, 'they paid; they broadcast');
  assert.equal(atCeremony.reason, 'awaiting-go-live');

  // And once it stamps AT the ceremony, the full event-day runs from there.
  const running = await resolveBroadcastWindow(
    stub({ dayOrders: [thu], firstLiveAt: sat.toISOString() }),
    EVENT,
    { now: new Date(sat.getTime() + 3 * 3_600_000) },
  );
  assert.equal(running.multiCam, true);
  assert.equal(running.reason, 'open');
  assert.equal(
    running.expiresAt,
    new Date(sat.getTime() + LIVE_STUDIO_DAY_HOURS * 3_600_000).toISOString(),
    'buying early must cost the couple nothing — §4f②',
  );
});

test('the gate is STRUCTURAL — the stamp asks before it writes', () => {
  // A caller-side check would be one forgotten call site away from the defect
  // returning, and the column is write-once with no admin reset, so a wrong stamp is
  // unfixable. Pin that the refusal lives inside the stamp.
  const src = read('live-studio-window-server.ts');
  const fn = src.slice(src.indexOf('export async function stampFirstLiveAt'));
  const askAt = fn.indexOf('resolveBroadcastWindow(supabase, eventId)');
  const writeAt = fn.indexOf("update({ first_live_at");
  assert.ok(askAt > -1, 'the stamp must resolve the window before writing');
  assert.ok(writeAt > -1);
  assert.ok(askAt < writeAt, 'the entitlement must be asked BEFORE the write, not after');
  assert.match(fn, /if \(!entitled\.multiCam\) return;/);
});
