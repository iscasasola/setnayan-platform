/**
 * one-press-one-order.test.ts — a second press of a Papic buy button never
 * makes a second bill.
 *
 * Measured 2026-10-13 by the Papic end-to-end tester: "Continue to payment"
 * showed no pressed state, and two presses made two unpaid orders. Three halves
 * hold the fix, and this file checks all three:
 *
 *   1. the RULE (`firstOpenTwin`) — which orders are the same press;
 *   2. the two CALLS — reuse before minting, keep-the-earliest after minting —
 *      against a stand-in client that records what was asked;
 *   3. the WIRING — every Papic buy action that mints a paid order asks before
 *      it mints and settles twins before any side effect, and every one of
 *      their buttons locks while the press is in flight.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  TWIN_ORDER_WINDOW_MS,
  firstOpenTwin,
  keepFirstTwin,
  openTwinReference,
  type OrderTwinKey,
  type TwinRow,
} from '@/lib/one-press-one-order';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

const NOW = Date.parse('2026-10-13T08:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const KEY: OrderTwinKey = {
  eventId: 'ev-1',
  userId: 'u-1',
  serviceKey: 'PAPIC_GUEST_100',
  amountPhp: 70,
  description: 'Papic — adds 100 credits to this event',
};
const row = (over: Partial<TwinRow>): TwinRow => ({
  order_id: 'o-1',
  reference_code: 'SNAAAA1111',
  created_at: at(30_000),
  status: 'submitted',
  description: KEY.description,
  requested_total_php: '70.00',
  payments: [],
  ...over,
});

// ── 1 · the rule ───────────────────────────────────────────────────────────

test('the same purchase moments ago, unpaid, is the twin', () => {
  assert.equal(firstOpenTwin([row({})], KEY, NOW)?.reference_code, 'SNAAAA1111');
});

test('the EARLIEST twin survives, and a tie on time breaks on order_id the same way from both sides', () => {
  const a = row({ order_id: 'o-b', reference_code: 'SNBBBB', created_at: at(5_000) });
  const b = row({ order_id: 'o-a', reference_code: 'SNAAAA', created_at: at(9_000) });
  assert.equal(firstOpenTwin([a, b], KEY, NOW)?.order_id, 'o-a');
  const t = at(5_000);
  const x = row({ order_id: 'o-2', created_at: t });
  const y = row({ order_id: 'o-1', created_at: t });
  assert.equal(firstOpenTwin([x, y], KEY, NOW)?.order_id, 'o-1');
  assert.equal(firstOpenTwin([y, x], KEY, NOW)?.order_id, 'o-1');
});

test('NOT a twin: a payment already logged — that bill is being paid, this is a new purchase', () => {
  assert.equal(firstOpenTwin([row({ payments: [{ payment_id: 'p' }] })], KEY, NOW), null);
});

test('NOT a twin: older than the window — buying the same pack again tomorrow is a real purchase', () => {
  assert.equal(firstOpenTwin([row({ created_at: at(TWIN_ORDER_WINDOW_MS + 1_000) })], KEY, NOW), null);
});

test('NOT a twin: a different amount, a different description, or a closed status', () => {
  assert.equal(firstOpenTwin([row({ requested_total_php: '77.00' })], KEY, NOW), null);
  assert.equal(firstOpenTwin([row({ description: 'Papic — adds 300 credits' })], KEY, NOW), null);
  for (const status of ['paid', 'fulfilled', 'cancelled', 'refunded', 'lapsed']) {
    assert.equal(firstOpenTwin([row({ status })], KEY, NOW), null, status);
  }
});

// ── 2 · the two calls, against a stand-in client ───────────────────────────

type Call = { table: string; op: string; filters: Array<[string, unknown]> };

/** A stand-in Supabase client: answers the twin read with `rows`, records everything. */
function standIn(rows: TwinRow[] | 'error', cancelLands = true) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: '', filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = (s: string) => {
        if (!call.op) call.op = 'select';
        call.filters.push(['select', s]);
        return chain;
      };
      chain.update = (v: unknown) => {
        call.op = 'update';
        call.filters.push(['update', v]);
        return chain;
      };
      for (const f of ['eq', 'gte', 'order', 'limit']) {
        chain[f] = (...args: unknown[]) => {
          call.filters.push([f, args]);
          return self();
        };
      }
      chain.then = (res: (v: unknown) => unknown) => {
        if (call.op === 'update') {
          return Promise.resolve(
            res(cancelLands ? { data: [{ order_id: 'mine' }], error: null } : { data: [], error: null }),
          );
        }
        return Promise.resolve(
          res(rows === 'error' ? { data: null, error: { message: 'boom' } } : { data: rows, error: null }),
        );
      };
      return chain;
    },
  };
  return { client: client as never, calls };
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const e = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = e;
  }
};

test('before minting · an open twin is reused, and the read is scoped to this buyer, event and SKU', async () => {
  const { client, calls } = standIn([row({})]);
  assert.equal(await openTwinReference(client, KEY, NOW), 'SNAAAA1111');
  assert.equal(calls.length, 1, 'one read, nothing else');
  const f = JSON.stringify(calls[0]!.filters);
  for (const must of ['"event_id","ev-1"', '"user_id","u-1"', '"service_key","PAPIC_GUEST_100"', '"status","submitted"']) {
    assert.ok(f.includes(must), `the twin read is not scoped by ${must}`);
  }
});

test('before minting · no twin, or a read that fails, mints as normal (fails OPEN)', async () => {
  assert.equal(await openTwinReference(standIn([]).client, KEY, NOW), null);
  assert.equal(await quiet(() => openTwinReference(standIn('error').client, KEY, NOW)), null);
});

test('after minting · alone, the order keeps itself and nothing is written', async () => {
  const mine = row({ order_id: 'mine', reference_code: 'SNMINE', created_at: at(100) });
  const { client, calls } = standIn([mine]);
  const out = await keepFirstTwin(client, client, KEY, { orderId: 'mine', referenceCode: 'SNMINE' }, NOW);
  assert.deepEqual(out, { keptMine: true });
  assert.ok(!calls.some((c) => c.op === 'update'), 'a lone order cancelled itself');
});

test('after minting · a LATER twin cancels itself (submitted only) and lands on the earlier bill', async () => {
  const first = row({ order_id: 'first', reference_code: 'SNFIRST', created_at: at(800) });
  const mine = row({ order_id: 'mine', reference_code: 'SNMINE', created_at: at(100) });
  const { client, calls } = standIn([first, mine]);
  const out = await keepFirstTwin(client, client, KEY, { orderId: 'mine', referenceCode: 'SNMINE' }, NOW);
  assert.deepEqual(out, { keptMine: false, reference: 'SNFIRST' });
  const upd = calls.find((c) => c.op === 'update');
  assert.ok(upd, 'the later twin was not cancelled');
  const f = JSON.stringify(upd!.filters);
  assert.ok(f.includes('"cancelled"'));
  assert.ok(f.includes('"order_id","mine"'), 'it cancelled something other than its own order');
  assert.ok(f.includes('"status","submitted"'), 'the cancel is not limited to an unpaid order');
});

test('after minting · the EARLIER twin keeps itself even when it reads the later one', async () => {
  const mine = row({ order_id: 'mine', reference_code: 'SNMINE', created_at: at(800) });
  const later = row({ order_id: 'later', reference_code: 'SNLATER', created_at: at(100) });
  const { client, calls } = standIn([mine, later]);
  const out = await keepFirstTwin(client, client, KEY, { orderId: 'mine', referenceCode: 'SNMINE' }, NOW);
  assert.deepEqual(out, { keptMine: true });
  assert.ok(!calls.some((c) => c.op === 'update'));
});

test('after minting · a cancel that does not land keeps the order (never strand a live bill behind a redirect)', async () => {
  const first = row({ order_id: 'first', reference_code: 'SNFIRST', created_at: at(800) });
  const mine = row({ order_id: 'mine', created_at: at(100) });
  const { client } = standIn([first, mine], false);
  const out = await keepFirstTwin(client, client, KEY, { orderId: 'mine', referenceCode: 'SNMINE' }, NOW);
  assert.deepEqual(out, { keptMine: true });
});

// ── 3 · the wiring ─────────────────────────────────────────────────────────

const STUDIO = 'app/dashboard/[eventId]/studio/papic/actions.ts';
const GUEST = 'app/papic/buy/actions.ts';

const bodyOf = (src: string, name: string): string => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i > -1, `${name} is gone — re-point this guard`);
  const next = src.indexOf('\nexport ', i + 10);
  return src.slice(i, next > -1 ? next : undefined);
};
const MINT = /\.from\(\s*'orders'\s*\)\s*\.insert\(/;

for (const [file, fn, before, sideEffect] of [
  [STUDIO, 'purchasePapicPoolTopUp', true, /revalidatePath\(/],
  [STUDIO, 'purchasePapicExtras', true, /provisionPaidCamerasAdmin\(/],
  [STUDIO, 'activatePapicLimited', false, /from\('papic_limited_snapshots'\)\s*\.insert\(/],
  [GUEST, 'startPapicGuestPurchase', false, /from\('papic_guest_orders'\)\.insert\(/],
] as const) {
  test(`wiring · ${fn} settles twins after minting and before its side effect`, () => {
    const body = bodyOf(read(file), fn);
    const mint = body.search(MINT);
    const keep = body.search(/keepFirstTwin\(/);
    const effect = body.search(sideEffect);
    assert.ok(mint > -1, `${fn} no longer mints — re-point this guard`);
    assert.ok(keep > mint, `${fn} does not settle twins after it mints — two presses together make two bills`);
    assert.ok(effect > keep, `${fn} provisions before it settles twins — the losing press would provision too`);
    if (before) {
      const reuse = body.search(/openTwinReference\(/);
      assert.ok(reuse > -1 && reuse < mint, `${fn} mints without first reusing the bill a moment-ago press made`);
    }
  });
}

for (const [file, what] of [
  ['app/dashboard/[eventId]/studio/papic/_components/papic-pool-card.tsx', 'Continue to payment'],
  ['app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx', 'extra cameras'],
  ['app/dashboard/[eventId]/studio/papic/guest-camera-tier-picker.tsx', 'guest cameras'],
] as const) {
  test(`button · ${what} locks while pressed and names the step`, () => {
    const src = read(file);
    assert.ok(!/<button\s+type="submit"/.test(src), `${file} has a bare submit again — two presses, two bills`);
    assert.match(src, /<SubmitButton[\s\S]*?pendingLabel=/, `${file} has no locking button with a step line`);
    assert.match(src, /Opening payment…/);
  });
}

test('button · the guest offer locks while pressed and names the step', () => {
  const src = read('app/papic/_components/papic-buy-shell.tsx');
  const i = src.indexOf('function OfferSubmit');
  assert.ok(i > -1, 'the guest offer button is gone — re-point this guard');
  const body = src.slice(i, src.indexOf('\n}', i));
  assert.match(body, /useFormStatus\(\)/);
  assert.match(body, /disabled=\{pending\}/);
  assert.match(body, /Opening payment…/);
});
