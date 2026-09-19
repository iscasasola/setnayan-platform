/**
 * price-reads-keep-their-reason.test.ts — a refused catalogue read may fall back,
 * but never silently (S41, the MONEY tier of `result-dropped-silently`).
 *
 * These readers price things: a seat, a branch, the Setnayan Pay fee, an
 * application fee, a Papic pack, the mood-board render config. Each one falls
 * back to a constant (or to "no price") when the catalogue cannot be read —
 * that fallback is deliberate and stays. What was wrong is that a REFUSED read
 * and a MISSING row took the same branch and left nothing behind, so "the admin
 * retired this SKU" and "RLS/schema drift refused the read" were
 * indistinguishable in every log. A fallback price that nobody knows is a
 * fallback is how a charge drifts from the catalogue unnoticed.
 *
 * Executed, not grepped: each reader runs against a stubbed client that
 * refuses, and must (1) still return its documented fallback and (2) leave
 * exactly one `[supabase-error]` record carrying the error object. A missing row
 * (no error) must leave NO record — the log is for refusals, not for absence.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * Some of these readers transitively import a module that opens with
 * `import 'server-only'` — a bundler assertion with no runtime behaviour that
 * does not exist for node. Resolved to an empty module; same shim as
 * `app/[slug]/_components/editorial/recap-voice.test.ts`. Registered before the
 * dynamic imports below (a static import would hoist above it). */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_price_reads__.js');
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

let seats: typeof import('@/lib/vendor-seats');
let branches: typeof import('@/lib/vendor-branches');
let payouts: typeof import('@/lib/payouts');
let verification: typeof import('@/lib/vendor-verification');
let papic: typeof import('@/lib/vendor-papic-grants');
let moodboard: typeof import('@/lib/moodboard-render-credits');
before(async () => {
  seats = await import('@/lib/vendor-seats');
  branches = await import('@/lib/vendor-branches');
  payouts = await import('@/lib/payouts');
  verification = await import('@/lib/vendor-verification');
  papic = await import('@/lib/vendor-papic-grants');
  moodboard = await import('@/lib/moodboard-render-credits');
});

/** Minimal thenable query builder — every chained filter returns itself; rpc too. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'rpc']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const ERR = { code: '42501', message: 'permission denied for table' };
const REFUSED = { data: null, error: ERR };
const MISSING = { data: null, error: null };

async function recorded<T>(fn: () => Promise<T>): Promise<{ value: T; logs: unknown[][] }> {
  const logs: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => void logs.push(args);
  try {
    return { value: await fn(), logs };
  } finally {
    console.error = orig;
  }
}

const READERS: { name: string; run: (c: SupabaseClient) => Promise<unknown>; fallback: () => unknown }[] = [
  { name: 'fetchSeatFeePhp', run: (c) => seats.fetchSeatFeePhp(c), fallback: () => seats.SEAT_FEE_PHP },
  { name: 'fetchBranchFeePhp', run: (c) => branches.fetchBranchFeePhp(c), fallback: () => branches.BRANCH_FEE_PHP },
  { name: 'getSetnayanFeeBps', run: (c) => payouts.getSetnayanFeeBps(c), fallback: () => payouts.DEFAULT_SETNAYAN_FEE_BPS },
  { name: 'resolveApplicationFeeCentavos', run: (c) => verification.resolveApplicationFeeCentavos(c, 'initial'), fallback: () => 0 },
  { name: 'fetchVendorPapicPackPricePhp', run: (c) => papic.fetchVendorPapicPackPricePhp(c), fallback: () => null },
  { name: 'readMoodboardRenderConfig', run: (c) => moodboard.readMoodboardRenderConfig(c), fallback: () => null },
  { name: 'readMoodboardRenderBalance', run: (c) => moodboard.readMoodboardRenderBalance(c, 'ev_1'), fallback: () => null },
];

for (const r of READERS) {
  test(`${r.name}: a REFUSED read falls back AND leaves its reason`, async () => {
    const { value, logs } = await recorded(() => r.run(stubClient(REFUSED)));
    assert.deepEqual(value, r.fallback());
    assert.equal(logs.length, 1, `expected one record, got ${logs.length}`);
    assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
    assert.ok(logs[0]!.includes(ERR), 'the error object itself must be in the record');
  });

  test(`${r.name}: a MISSING row falls back with NO record`, async () => {
    const { value, logs } = await recorded(() => r.run(stubClient(MISSING)));
    assert.deepEqual(value, r.fallback());
    assert.equal(logs.length, 0);
  });
}
