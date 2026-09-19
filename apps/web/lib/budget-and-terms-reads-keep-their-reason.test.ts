/**
 * budget-and-terms-reads-keep-their-reason.test.ts — a refused read behind a
 * budget, a floor plan or a service's price terms may degrade, but never
 * silently (S41, the MONEY tier of `result-dropped-silently`).
 *
 * These readers feed money arithmetic with a documented degrade: the budget
 * allocator's config and benchmarks, the budget bands, the floor-plan defaults,
 * a service's payment schedule, price brackets and discounts. The degrade stays
 * (a crashed budget page is worse). What was wrong is that a REFUSED read took
 * the same branch as "nothing configured" and left nothing behind — so a
 * couple quoted without their supplier's discount, or allocated against the
 * fallback bands, was indistinguishable in every log from a supplier who set
 * none.
 *
 * Executed, not grepped: each reader runs against a refusing stub and must
 * (1) still return its degrade value and (2) leave exactly one `[supabase-error]`
 * record carrying the error object; a genuine empty answer leaves NO record.
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
const STUB = path.join(process.cwd(), '__server_only_stub_budget_terms_reads__.js');
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

let allocation: typeof import('@/lib/budget-allocation-data');
let bands: typeof import('@/lib/budget-bands-read');
let bandsShared: typeof import('@/lib/budget-bands-shared');
let seating: typeof import('@/lib/seating');
let schedules: typeof import('@/lib/vendor-service-payment-schedules');
let servicePublic: typeof import('@/lib/vendor-service-public');
let services: typeof import('@/lib/vendor-services');
before(async () => {
  allocation = await import('@/lib/budget-allocation-data');
  bands = await import('@/lib/budget-bands-read');
  bandsShared = await import('@/lib/budget-bands-shared');
  seating = await import('@/lib/seating');
  schedules = await import('@/lib/vendor-service-payment-schedules');
  servicePublic = await import('@/lib/vendor-service-public');
  services = await import('@/lib/vendor-services');
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

const EMPTY_MAP = () => new Map();
const READERS: { name: string; run: (c: SupabaseClient) => Promise<unknown>; fallback: () => unknown }[] = [
  { name: 'fetchActiveBenchmarks', run: (c) => allocation.fetchActiveBenchmarks(c), fallback: () => [] },
  { name: 'fetchBudgetBands', run: (c) => bands.fetchBudgetBands(c), fallback: () => bandsShared.BUDGET_BANDS_FALLBACK },
  { name: 'fetchFloorPlan', run: (c) => seating.fetchFloorPlan(c, 'ev_1'), fallback: () => ({ ...seating.DEFAULT_FLOOR_PLAN }) },
  { name: 'fetchOwnSchedule', run: (c) => schedules.fetchOwnSchedule(c, 'vs_1'), fallback: () => [] },
  { name: 'fetchOwnSchedulesByService', run: (c) => schedules.fetchOwnSchedulesByService(c, ['vs_1']), fallback: EMPTY_MAP },
  { name: 'fetchPriceBracketsByService (public)', run: (c) => servicePublic.fetchPriceBracketsByService(c, ['vs_1']), fallback: EMPTY_MAP },
  { name: 'fetchDiscountsByServicePublic', run: (c) => servicePublic.fetchDiscountsByServicePublic(c, ['vs_1']), fallback: EMPTY_MAP },
  { name: 'fetchBracketsByService', run: (c) => services.fetchBracketsByService(c, ['vs_1']), fallback: EMPTY_MAP },
  { name: 'fetchDiscountsByService', run: (c) => services.fetchDiscountsByService(c, ['vs_1']), fallback: EMPTY_MAP },
];

for (const r of READERS) {
  test(`${r.name}: a REFUSED read degrades AND leaves its reason`, async () => {
    const { value, logs } = await recorded(() => r.run(stubClient(REFUSED)));
    assert.deepEqual(value, r.fallback());
    assert.equal(logs.length, 1, `expected one record, got ${logs.length}`);
    assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
    assert.ok(logs[0]!.includes(ERR), 'the error object itself must be in the record');
  });

  test(`${r.name}: a genuine empty answer leaves NO record`, async () => {
    const { value, logs } = await recorded(() => r.run(stubClient(MISSING)));
    assert.deepEqual(value, r.fallback());
    assert.equal(logs.length, 0);
  });
}
