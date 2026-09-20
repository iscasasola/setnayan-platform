/**
 * money-reads-are-honest.test.ts — a money screen may not state an absence it
 * did not measure (S41, the MONEY tier of `result-dropped-silently`).
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * Supabase RESOLVES with `{ error }`; it does not throw. Four money surfaces
 * turned a refused read into the same pixels as a genuine "none":
 *
 *   /vendor-dashboard/booking-fees ..... "Nothing to pay yet." → to a shop that owes one
 *   /vendor-dashboard/payment-options .. "No payment options yet." → invites a re-add
 *   vendor Overview cash-flow tile ..... "No booked installments yet." → to a booked shop
 *   couple's Papic studio .............. "Guests chipped in" card vanished → reads as nobody gave
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. Each read now returns a DISTINCT failure
 * value, and each render branches on it BEFORE its empty state. The decisions
 * are executed against a stubbed client; the render order is pinned by source
 * position (order, not counts — a count of a symmetric quantity proves nothing).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnPaymentMethodsMeasured } from '@/lib/vendor-payment-methods';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `vendor-booking-fees.server.ts` opens with `import 'server-only'`, a module
 * Next supplies to the BUNDLER that does not exist for node. Resolving it to an
 * empty module is faithful (it has no runtime behaviour) — same shim as
 * `app/[slug]/_components/editorial/recap-voice.test.ts`. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_money_reads__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let fees: typeof import('@/lib/vendor-booking-fees.server');
before(async () => {
  fees = await import('@/lib/vendor-booking-fees.server');
});

/** Minimal thenable query builder — every chained filter returns itself. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'like', 'in', 'order', 'limit']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const REFUSED = { data: null, error: { code: '42501', message: 'permission denied for table' } };

// Silence the intentional error logs so a green run reads clean.
const quiet = <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = orig;
  });
};

test('payment methods: a REFUSED read is measured:false, not an empty list', async () => {
  const r = await quiet(() => fetchOwnPaymentMethodsMeasured(stubClient(REFUSED), 'vp_1'));
  assert.equal(r.measured, false);
  assert.deepEqual(r.methods, []);
});

test('payment methods: a genuine empty read is measured:true', async () => {
  const r = await fetchOwnPaymentMethodsMeasured(stubClient({ data: [], error: null }), 'vp_1');
  assert.equal(r.measured, true);
  assert.deepEqual(r.methods, []);
});

test('booking fees: a REFUSED read is FEE_ORDERS_UNREADABLE, never []', async () => {
  const r = await quiet(() => fees.fetchVendorFeeOrders(stubClient(REFUSED), 'u_1'));
  assert.equal(r, fees.FEE_ORDERS_UNREADABLE);
  assert.notDeepEqual(r, []);
});

test('booking fees: a genuine empty read is [] and counts 0 due', async () => {
  const ok = stubClient({ data: [], error: null });
  assert.deepEqual(await fees.fetchVendorFeeOrders(ok, 'u_1'), []);
  assert.equal(await fees.countDueVendorFeeOrders(ok, 'u_1'), 0);
});

// ── the render: the failure branch must come BEFORE the empty-state copy ──────

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every index of `needle` in `hay`. */
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

const RENDERS: { file: string; guard: string; empty: string }[] = [
  {
    file: 'app/vendor-dashboard/booking-fees/page.tsx',
    guard: '{unreadable ? (',
    // ⚠ WAS "No booking fees yet." (2026-09-20). The page now also lists the
    // WAIVED free-5 charges, which are booking fees — computed, recorded and
    // owed nothing on. Claiming a shop with five of them has "no booking fees"
    // was the same false absence this file exists to catch, one word over, so
    // the empty state is about what is PAYABLE.
    empty: 'Nothing to pay yet.',
  },
  {
    file: 'app/vendor-dashboard/payment-options/surface.tsx',
    guard: '{!methodsMeasured ? (',
    empty: 'No payment options yet.',
  },
  {
    file: 'app/vendor-dashboard/_components/overview-sections.tsx',
    guard: '{!measured ? (',
    empty: 'No booked installments yet.',
  },
  {
    file: 'app/dashboard/[eventId]/studio/papic/_components/guest-contributions-card.tsx',
    guard: 'if (rows === CONTRIBUTIONS_UNREADABLE)',
    empty: 'if (rows.length === 0) return null;',
  },
];

for (const r of RENDERS) {
  test(`render: ${r.file} says "couldn't load" before it says "none"`, () => {
    const s = src(r.file);
    const guards = all(s, r.guard);
    const empties = all(s, r.empty);
    console.log(`# ${r.file}: guard ×${guards.length} @${guards.join(',')} · empty ×${empties.length} @${empties.join(',')}`);
    assert.equal(guards.length, 1, `expected exactly one "${r.guard}"`);
    assert.equal(empties.length, 1, `expected exactly one "${r.empty}"`);
    assert.ok(guards[0]! < empties[0]!, 'the failure branch must be decided before the empty state');
  });
}

test('the Overview passes the payday measurement through to the tile', () => {
  const s = src('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.equal(all(s, 'measured={earnings.paydayMeasured}').length, 1);
  const lib = src('lib/vendor-overview.ts');
  assert.equal(all(lib, 'paydayMeasured: paydayTotals !== null').length, 1);
});
