/**
 * entitlement-reads-keep-their-reason.test.ts — a refused read on an
 * entitlement, an order state or a token may fail CLOSED, but never silently
 * (S41, the MONEY tier of `result-dropped-silently`).
 *
 * These readers answer "has this been paid for / granted?": a comp grant, a
 * Papic camera order, a 3D-booth event order, a vendor team role, a community
 * invite token. Each failing closed on a refusal is correct — a gate must not
 * open on an unreadable answer — and stays. What was wrong is that the refusal
 * took the same branch as a genuine "no" and left nothing behind, so a couple
 * locked out of something they PAID for (RLS drift, a phantom column) looked,
 * in every log, exactly like a couple who never bought it.
 *
 * Executed, not grepped: each reader runs against a refusing stub and must
 * (1) still fail closed and (2) leave exactly one `[supabase-error]` record
 * carrying the error object; a genuine empty answer leaves NO record.
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
const STUB = path.join(process.cwd(), '__server_only_stub_entitlement_reads__.js');
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

let entitlements: typeof import('@/lib/entitlements');
let cameras: typeof import('@/lib/papic-cameras');
let selfPurchase: typeof import('@/lib/self-purchase');
let booth: typeof import('@/lib/vendor-3d-booth-event-pricing');
let communities: typeof import('@/lib/communities');
before(async () => {
  entitlements = await import('@/lib/entitlements');
  cameras = await import('@/lib/papic-cameras');
  selfPurchase = await import('@/lib/self-purchase');
  booth = await import('@/lib/vendor-3d-booth-event-pricing');
  communities = await import('@/lib/communities');
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
/** A genuine empty answer. `null` data serves both row reads and array reads here. */
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
  { name: 'eventHasCompGrant', run: (c) => entitlements.eventHasCompGrant(c, 'ev_1', 'PAPIC'), fallback: () => false },
  { name: 'eventCompActiveSkus', run: (c) => entitlements.eventCompActiveSkus(c, 'ev_1'), fallback: () => [] },
  { name: 'papicCameraOrderPaid', run: (c) => cameras.papicCameraOrderPaid(c, 'ord_1'), fallback: () => false },
  { name: 'fetchSelfPurchaseRoles', run: (c) => selfPurchase.fetchSelfPurchaseRoles(c, 'u_1'), fallback: () => [] },
  { name: 'fetchVendorBoothEventOrderState', run: (c) => booth.fetchVendorBoothEventOrderState(c, 'vp_1', 'ev_1'), fallback: () => 'none' },
  { name: 'fetchInviteToken', run: (c) => communities.fetchInviteToken(c, 'cm_1'), fallback: () => null },
];

for (const r of READERS) {
  test(`${r.name}: a REFUSED read fails closed AND leaves its reason`, async () => {
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
