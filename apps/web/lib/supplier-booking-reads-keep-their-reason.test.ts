/**
 * supplier-booking-reads-keep-their-reason.test.ts — a refused read on a supplier's booking path may degrade, but never silently.
 *
 * The supplier's side of the booking lifecycle: committed-booking counts (the
 * free-5 gate), which shops are inquirable, Papic accept provenance, a
 * service's time slots and the slots a couple can book. Each degrade is
 * deliberate and stays (fail closed on a gate, empty on a list); what was
 * missing is any record telling a REFUSAL from a genuine absence.
 *
 * Executed, not grepped: each reader runs against a stubbed client that
 * REFUSES, and must leave at least one `[supabase-error]` record carrying the
 * error object itself; against an empty answer it must leave none — the record
 * is for refusals, not for absence. (S41, `result-dropped-silently`, BOOKING tier.)
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── `server-only` shim ── same as `app/[slug]/_components/editorial/recap-voice.test.ts`:
 * a bundler assertion with no runtime behaviour, resolved to an empty module and
 * registered before the dynamic imports below (a static import would hoist). */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_supplier_booking_reads_keep_their_reason__.js');
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

let first5: typeof import('@/lib/vendor-addon-first5-free');
let gate: typeof import('@/lib/vendor-inquirable-gate');
let grants: typeof import('@/lib/vendor-papic-grants');
let slots: typeof import('@/lib/vendor-time-slots');
before(async () => {
  first5 = await import('@/lib/vendor-addon-first5-free');
  gate = await import('@/lib/vendor-inquirable-gate');
  grants = await import('@/lib/vendor-papic-grants');
  slots = await import('@/lib/vendor-time-slots');
});

/** Minimal thenable query builder — every chained filter returns itself; rpc too. */
function stubClient(result: { data: unknown; error: unknown; count?: number | null }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'in', 'is', 'not', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'order', 'limit', 'maybeSingle', 'single', 'rpc']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const ERR = { code: '42501', message: 'permission denied for table' };

async function records(fn: () => Promise<unknown>): Promise<unknown[][]> {
  const logs: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => void logs.push(args);
  try {
    await fn();
  } finally {
    console.error = orig;
  }
  return logs.filter((a) => String(a[0]).startsWith('[supabase-error] '));
}

const READERS: { name: string; run: (c: SupabaseClient) => Promise<unknown> }[] = [
  { name: 'fetchVendorCommittedBookingCount', run: (c) => first5.fetchVendorCommittedBookingCount(c, "vp_1") },
  { name: 'fetchVendorIdsWithActiveService', run: (c) => gate.fetchVendorIdsWithActiveService(c) },
  { name: 'fetchVendorAcceptProvenance', run: (c) => grants.fetchVendorAcceptProvenance(c, "vp_1", "ev_1") },
  { name: 'fetchVendorTimeSlotsByService', run: (c) => slots.fetchVendorTimeSlotsByService(c, "vp_1") },
  { name: 'fetchSlotsForCoupleBooking', run: (c) => slots.fetchSlotsForCoupleBooking(c, "ev_1", "v_1") },
];

for (const r of READERS) {
  test(`${r.name}: a REFUSED read leaves its reason`, async () => {
    const logs = await records(() => r.run(stubClient({ data: null, error: ERR, count: null })));
    assert.ok(logs.length >= 1, `expected a [supabase-error] record, got ${logs.length}`);
    assert.ok(logs[0]!.includes(ERR), 'the error object itself must be in the record');
  });

  test(`${r.name}: an empty answer leaves NO record`, async () => {
    const logs = await records(() => r.run(stubClient({ data: null, error: null, count: 0 })));
    assert.equal(logs.length, 0);
  });
}
