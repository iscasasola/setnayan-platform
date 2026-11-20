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

/**
 * A stub admin client answered by NAME, not call order: `rpc(name)` answers each RPC (`shop_qualified_trust` — the one
 * trust reader since 21 Nov 2026 — and `shop_worked_with_counts`, the caption), `from(table)` each table.
 */
function trustClient(
  rpcs: Record<string, { data: unknown; error: unknown }>,
  tables: Record<string, { data: unknown; error: unknown }>,
): SupabaseClient {
  const ok = { data: [], error: null };
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'or', 'order']) builder[m] = () => builder;
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(tables[table] ?? ok).then(resolve);
      return builder;
    },
    rpc: (name: string) => Promise.resolve(rpcs[name] ?? ok),
  } as unknown as SupabaseClient;
}

const ONE_QUALIFIED = {
  data: [
    {
      vendor_profile_id: 'vp-1',
      trusting_vendor_profile_id: 'v-2',
      relationship_types: ['accredited'],
      origins: ['invited'],
      made_by_this_shop: false,
    },
  ],
  error: null,
};

test('fetchTrustedByVendors: a refused vendor_profiles read returns the UNREADABLE sentinel, never []', async () => {
  const client = trustClient({ shop_qualified_trust: ONE_QUALIFIED }, { vendor_profiles: { data: null, error: ERR } });
  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.equal(value, trustedBy.TRUSTED_BY_UNREADABLE, 'a refused read must be distinguishable from []');
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] lib\/vendor-trusted-by\.ts · from:vendor_profiles\.select/);
});

test('fetchTrustedByVendors: a refused trust read returns UNREADABLE, never [] (21 Nov — the one reader)', async () => {
  const client = trustClient({ shop_qualified_trust: { data: null, error: ERR } }, {});
  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.equal(value, trustedBy.TRUSTED_BY_UNREADABLE, 'a refused trust read must not draw "nobody trusts this shop"');
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] lib\/vendor-trusted-by\.ts · rpc:shop_qualified_trust/);
});

test('fetchTrustedByVendors: a refused worked-together caption read returns UNREADABLE, never [] (Invite a supplier v3)', async () => {
  const client = trustClient({ shop_worked_with_counts: { data: null, error: ERR } }, {});
  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.equal(value, trustedBy.TRUSTED_BY_UNREADABLE, 'a refused worked-together read must not draw an empty list');
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /^\[supabase-error\] lib\/vendor-trusted-by\.ts · rpc:shop_worked_with_counts/);
});

test('fetchTrustedByVendors: a refused hidden-rows read returns UNREADABLE — never a row the shop hid (owner Q5)', async () => {
  const client = trustClient({}, { vendor_trusted_by_hidden: { data: null, error: ERR } });
  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.equal(value, trustedBy.TRUSTED_BY_UNREADABLE);
  assert.equal(logs.length, 1);
  assert.match(String(logs[0]![0]), /from:vendor_trusted_by_hidden\.select/);
});

test('fetchTrustedByVendors: a row the shop hid is not on its Trusted by (owner Q5)', async () => {
  const client = trustClient(
    { shop_qualified_trust: ONE_QUALIFIED, shop_worked_with_counts: { data: [{ other_vendor_profile_id: 'v-2', events: 2 }], error: null } },
    { vendor_trusted_by_hidden: { data: [{ hidden_vendor_profile_id: 'v-2' }], error: null } },
  );
  const { value } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.deepEqual(value, [], 'the hidden partner is gone from this page');
});

test('fetchTrustedByVendors: a genuine read (no qualified shops) returns [] with NO record', async () => {
  const client = trustClient({}, {});
  const { value, logs } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.deepEqual(value, [], 'nobody qualifying is a genuine empty, distinct from unreadable');
  assert.equal(logs.length, 0);
});

test('fetchTrustedByVendors: a WAITING shop (worked with, not qualified) is never drawn — only the one reader adds a shop', async () => {
  // The worked-together caption names v-3, but shop_qualified_trust does not: v-3 has no completed paid booking yet.
  const client = trustClient(
    { shop_worked_with_counts: { data: [{ other_vendor_profile_id: 'v-3', events: 4 }], error: null } },
    { vendor_profiles: { data: [{ vendor_profile_id: 'v-3', business_name: 'Waiting' }], error: null } },
  );
  const { value } = await recorded(() => trustedBy.fetchTrustedByVendors(client, 'vp-1'));
  assert.deepEqual(value, []);
});

test('fetchQualifiedTrustCounts / fetchQualifiedTrustedIds: a refused read is UNREADABLE, never 0 / never "everyone waiting"', async () => {
  const client = trustClient(
    { shop_qualified_trust: { data: null, error: ERR }, shop_qualified_trust_counts: { data: null, error: ERR } },
    {},
  );
  const counts = await recorded(() => trustedBy.fetchQualifiedTrustCounts(client, ['vp-1']));
  assert.equal(counts.value, trustedBy.TRUSTED_BY_UNREADABLE);
  assert.match(String(counts.logs[0]![0]), /rpc:shop_qualified_trust_counts/);
  const ids = await recorded(() => trustedBy.fetchQualifiedTrustedIds(client, 'vp-1'));
  assert.equal(ids.value, trustedBy.TRUSTED_BY_UNREADABLE);
  assert.match(String(ids.logs[0]![0]), /rpc:shop_qualified_trust/);
  const fine = trustClient(
    { shop_qualified_trust_counts: { data: [{ vendor_profile_id: 'vp-1', trusted_by: 3 }], error: null } },
    {},
  );
  const read = await recorded(() => trustedBy.fetchQualifiedTrustCounts(fine, ['vp-1', 'vp-2']));
  assert.deepEqual(read.value, new Map([['vp-1', 3]]));
  assert.equal(read.logs.length, 0);
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
  // Anchored per named function, each with a floor of 1 (never an exact
  // total) — a third, distinct vendor_profiles.select call site added later
  // to this file must not flap this test; deleting either named site still
  // fails because ITS OWN label drops to 0.
  const sites = [
    '[supabase-error] lib/verification-checks-server.ts · from:vendor_profiles.select (readPayoutNameFacts)',
    '[supabase-error] lib/verification-checks-server.ts · from:vendor_profiles.select (otherShopsHoldingNumber)',
  ];
  for (const label of sites) {
    const hits = (body.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    assert.ok(hits >= 1, `expected at least one occurrence of ${JSON.stringify(label)}`);
  }
  const total = (body.match(/\[supabase-error\] lib\/verification-checks-server\.ts · from:vendor_profiles\.select/g) ?? []).length;
  assert.ok(total >= sites.length, `readPayoutNameFacts and otherShopsHoldingNumber must EACH leave a distinct record (floor ${sites.length}, found ${total})`);
});
