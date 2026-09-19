/**
 * s41c-supplier-batch-d-reads-are-honest.test.ts — batch 4/4 of the SUPPLIER
 * tier of `result-dropped-silently` (S26's both-ends baseline, PR #5625),
 * following S41's MONEY/BOOKING pattern (PRs #5650, #5656).
 *
 * Seventeen `lib/` files carried a refused Supabase read that was tested only
 * as `if (error) …` and left no trace of WHY — no log, no throw, no reference
 * to the reason. Most of these already fail SOFT correctly (an empty map, a
 * `null`, a `false`) and only needed the reason kept (shape 1: `console.error`
 * with the `[supabase-error]` prefix this repo's scanners key on). One site —
 * `lib/vendor-trusted-by.ts`'s `vendor_profiles` half of "Trusted by" — feeds a
 * trust badge rendered on a shop's OWN public profile, where a refused read
 * used to render byte-identical to "nobody endorsed this shop" (shape 2: a
 * distinct `TRUSTED_BY_UNREADABLE` sentinel + a distinct render branch in
 * `app/v/[slug]/page.tsx`'s `TrustedBySection`, mirroring PR #5656's
 * `saved-vendors.ts` / `VendorsTab`).
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL — these tests EXECUTE each reader against
 * a stubbed client, they do not grep for the word `console.error`.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim ── same as `lib/recommendation-count-survives.test.ts`:
 * a bundler assertion with no runtime behaviour, resolved to an empty module.
 * Needed transitively by `vendor-recommendations.ts` (→ `lib/uploads.ts`).
 * Registered before the dynamic imports below — a static import would hoist
 * above it and defeat it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_s41c_batch_d__.js');
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

let pressure: typeof import('@/lib/vendor-pipeline-pressure');
let profile: typeof import('@/lib/vendor-profile');
let addons: typeof import('@/lib/vendor-service-addons');
let servicePublic: typeof import('@/lib/vendor-service-public');
let verification: typeof import('@/lib/vendor-verification');
let recommendations: typeof import('@/lib/vendor-recommendations');
let trustedBy: typeof import('@/lib/vendor-trusted-by');
before(async () => {
  pressure = await import('@/lib/vendor-pipeline-pressure');
  profile = await import('@/lib/vendor-profile');
  addons = await import('@/lib/vendor-service-addons');
  servicePublic = await import('@/lib/vendor-service-public');
  verification = await import('@/lib/vendor-verification');
  recommendations = await import('@/lib/vendor-recommendations');
  trustedBy = await import('@/lib/vendor-trusted-by');
});

/** Minimal thenable query builder — every chained filter returns itself; rpc too. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'rpc']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const ERR = { code: '42501', message: 'permission denied' };

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

// ── shape 1: log-only, fallback unchanged ───────────────────────────────────

test('fetchPipelinePressure: a refused RPC still returns null AND leaves its reason', async () => {
  const { value, logs } = await recorded(() =>
    pressure.fetchPipelinePressure(stubClient({ data: null, error: ERR }), 'thread-1'),
  );
  assert.equal(value, null);
  assert.equal(logs.length, 1, `expected one record, got ${logs.length}`);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
  assert.ok(logs[0]!.includes(ERR), 'the error object itself must be in the record');
});

test('fetchVendorBusinessStartDate: a refused select still returns null AND leaves its reason', async () => {
  const { value, logs } = await recorded(() =>
    profile.fetchVendorBusinessStartDate(stubClient({ data: null, error: ERR }), 'vp-1'),
  );
  assert.equal(value, null);
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
});

test('fetchAddonsByService: a refused select still returns an empty map AND leaves its reason', async () => {
  const { value, logs } = await recorded(() =>
    addons.fetchAddonsByService(stubClient({ data: null, error: ERR }), ['svc-1']),
  );
  assert.deepEqual(value, new Map());
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
});

test('fetchCoveragesByIdPublic: a refused select still returns an empty map AND leaves its reason', async () => {
  const { value, logs } = await recorded(() =>
    servicePublic.fetchCoveragesByIdPublic(stubClient({ data: null, error: ERR }), [1, 2]),
  );
  assert.deepEqual(value, new Map());
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
});

test('isMarketplaceVendorBookable: a refused select fails CLOSED (false) AND leaves its reason', async () => {
  const { value, logs } = await recorded(() =>
    verification.isMarketplaceVendorBookable(stubClient({ data: null, error: ERR }), 'vp-1'),
  );
  assert.equal(value, false);
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
});

test('countVendorRecommendingCouples: a refused select reports 0 AND leaves its reason (was silent before S41c)', async () => {
  const { value, logs } = await recorded(() =>
    recommendations.countVendorRecommendingCouples(stubClient({ data: null, error: ERR }), 'vp-1'),
  );
  assert.equal(value, 0);
  assert.equal(logs.length, 1, 'the pre-fix code returned 0 with ZERO trace of why');
  assert.match(String(logs[0]![0]), /^\[supabase-error\] /);
});

test('a MISSING row (no error) leaves NO record — the log is for refusals, not for absence', async () => {
  const { logs } = await recorded(() =>
    profile.fetchVendorBusinessStartDate(stubClient({ data: null, error: null }), 'vp-1'),
  );
  assert.equal(logs.length, 0);
});

// ── shape 2: honest render state (vendor-trusted-by.ts) ─────────────────────

/** A client whose `vendor_partnerships` read succeeds with one endorsement,
 *  but whose SECOND call (`vendor_profiles`) can be made to refuse. */
function trustedByClient(profilesResult: { data: unknown; error: unknown }): SupabaseClient {
  let call = 0;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'order']) builder[m] = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => {
    // First `.from()` call is vendor_partnerships (one accepted row); the
    // second is vendor_profiles — resolved by call ORDER, matching the real
    // query sequence in fetchTrustedByVendors.
    const result =
      call === 1
        ? { data: [{ recommending_vendor_id: 'v-2', relationship_type: 'accredited' }], error: null }
        : profilesResult;
    return Promise.resolve(result).then(resolve);
  };
  return {
    from: () => {
      call += 1;
      return builder;
    },
  } as unknown as SupabaseClient;
}

test('fetchTrustedByVendors: a refused vendor_profiles read returns the UNREADABLE sentinel, never []', async () => {
  const { value, logs } = await recorded(() =>
    trustedBy.fetchTrustedByVendors(trustedByClient({ data: null, error: ERR }), 'vp-1'),
  );
  assert.equal(value, trustedBy.TRUSTED_BY_UNREADABLE, 'a refused read must be distinguishable from []');
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] lib\/vendor-trusted-by\.ts · from:vendor_profiles\.select/);
});

test('fetchTrustedByVendors: a genuine read (no partnerships) returns [] with NO record', async () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'order']) builder[m] = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  const client = { from: () => builder } as unknown as SupabaseClient;

  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.deepEqual(value, [], 'no accepted partnerships is a genuine empty, distinct from unreadable');
  assert.equal(logs.length, 0);
});

// ── the render branches BEFORE the empty state, in source order ─────────────

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('TrustedBySection: the "couldn\'t load" branch comes before the empty-state return', () => {
  const page = src('app/v/[slug]/page.tsx');
  const fnStart = page.indexOf('function TrustedBySection(');
  assert.ok(fnStart !== -1, 'TrustedBySection was renamed or removed');
  const fnEnd = page.indexOf('\nfunction ReviewsSection(', fnStart);
  assert.ok(fnEnd !== -1, 'could not bound TrustedBySection — the next section moved');
  const body = page.slice(fnStart, fnEnd);

  const unreadableGuard = body.indexOf('if (unreadable)');
  const couldntLoad = body.indexOf("couldn&rsquo;t load");
  const emptyReturn = body.indexOf('if (vendors.length === 0) return null;');
  assert.ok(unreadableGuard !== -1, 'the unreadable guard is gone');
  assert.ok(couldntLoad !== -1, 'the distinct "could not load" copy is gone');
  assert.ok(emptyReturn !== -1, 'the genuine-empty guard is gone');
  assert.ok(
    unreadableGuard < couldntLoad && couldntLoad < emptyReturn,
    'the unreadable branch must render BEFORE the code ever reaches "vendors.length === 0" — ' +
      'otherwise a refused read still falls through to the same silence as a genuine empty',
  );
});

test('verified-badge-sweep: the vendor_verification_applications count-refusal is logged, not silently skipped', () => {
  const body = src('lib/verified-badge-sweep.ts');
  const fnStart = body.indexOf('async function settleLapsedVouches(');
  const fnEnd = body.indexOf('\nexport async function runVerifiedBadgeDeadlineSweep', fnStart);
  const fn = body.slice(fnStart, fnEnd);
  const countErrGuard = fn.indexOf('if (countErr)');
  assert.ok(countErrGuard !== -1, 'the countErr guard moved or was removed');
  const guardBlock = fn.slice(countErrGuard, fn.indexOf('continue;', countErrGuard) + 'continue;'.length);
  assert.match(guardBlock, /console\.error\(\s*'\[supabase-error\]/, 'the refusal is still discarded with no trace');
});

test('verification-checks-server: BOTH vendor_profiles call sites now log their refusal', () => {
  const body = src('lib/verification-checks-server.ts');
  const hits = (body.match(/\[supabase-error\] lib\/verification-checks-server\.ts · from:vendor_profiles\.select/g) ?? []).length;
  assert.equal(hits, 2, 'readPayoutNameFacts and otherShopsHoldingNumber must EACH leave a distinct record');
});
