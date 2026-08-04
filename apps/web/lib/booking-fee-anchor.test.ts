/**
 * booking-fee-anchor.test.ts — PR-I's proof that the fee lands on the right row.
 * (Explore_Replan_BUILD_SPEC_2026-07-27.md §12.2 step 1 · §12.6.2)
 *
 * `resolveFeeAnchorRowId` decides WHICH `event_vendors` row is charged when the
 * vendor accepts a payment. Its failure mode is the dangerous kind: it can
 * return a plausible id and bill a row that must never carry money, freezing a
 * ledger ordinal and burning one of the vendor's five free bookings —
 * permanently, because `ON CONFLICT … DO UPDATE` never rewrites `attribution`.
 *
 * So every case below asserts a POSITIVE post-condition — the exact id, or
 * explicitly `null` — never merely "it didn't throw" (§12.6.2's rule for calls
 * whose failure mode is a silent non-fatal return).
 *
 * The fail-safe being pinned, verbatim from the seam contract: **any resolution
 * error or unknown state bills NOTHING. A vendor must never be charged by a
 * bug.**
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `booking-fee-lock.server.ts` opens with `import 'server-only'`, a module
 * Next.js supplies to the BUNDLER and which does not exist in node_modules — so
 * a static import here dies with MODULE_NOT_FOUND before one assertion runs.
 * The import is a bundler assertion ("never ship me to a client") with no
 * runtime behaviour, and its presence is separately guarded textually, so
 * resolving it to an empty module is faithful rather than a shortcut. Same
 * shim, same reasoning as `tests/db/booking-fee-order-postconditions.db.test.ts`.
 * Registered at module scope, and the real import is dynamic in `before()` —
 * a static one would hoist above this and defeat it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_anchor__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

let resolveFeeAnchorRowId: typeof import('./booking-fee-lock.server').resolveFeeAnchorRowId;

before(async () => {
  ({ resolveFeeAnchorRowId } = await import('./booking-fee-lock.server'));
});

type Row = Record<string, unknown> | null;

/**
 * Minimal PostgREST-shaped stub. `rows` is consulted per `.eq()` chain, so a
 * test states only the two reads the resolver actually performs.
 */
function stubClient(handlers: {
  byVendorId?: (id: string) => { data: Row; error: unknown };
  anchorForPackage?: (pkgId: string) => { data: Row; error: unknown };
}) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from() {
        const filters: Record<string, unknown> = {};
        const chain = {
          select() {
            return chain;
          },
          eq(col: string, val: unknown) {
            filters[col] = val;
            return chain;
          },
          is(col: string, val: unknown) {
            filters[col] = val;
            return chain;
          },
          maybeSingle() {
            if (typeof filters.vendor_id === 'string') {
              calls.push('byVendorId');
              return Promise.resolve(
                handlers.byVendorId?.(filters.vendor_id) ?? { data: null, error: null },
              );
            }
            if (typeof filters.event_vendor_package_id === 'string') {
              calls.push('anchorForPackage');
              // The resolver MUST scope the anchor lookup — assert it here so a
              // future edit cannot quietly drop these and match a covered row.
              assert.equal(filters.package_role, 'anchor', 'anchor lookup must filter package_role');
              assert.equal(filters.archived_at, null, 'anchor lookup must exclude archived');
              return Promise.resolve(
                handlers.anchorForPackage?.(filters.event_vendor_package_id as string) ?? {
                  data: null,
                  error: null,
                },
              );
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      },
      // The stub implements only the two reads the resolver performs; casting
      // through `unknown` keeps that narrowness honest instead of pretending to
      // be a whole SupabaseClient.
    } as unknown as Parameters<typeof resolveFeeAnchorRowId>[0],
  };
}

test('an ordinary booking (package_role NULL) IS the money row', async () => {
  const { client } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: null, event_vendor_package_id: null, archived_at: null },
      error: null,
    }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-1'), 'ev-1');
});

test('an anchor row IS the money row', async () => {
  const { client } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: 'anchor', event_vendor_package_id: 'pkg-1', archived_at: null },
      error: null,
    }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-anchor'), 'ev-anchor');
});

test('a COVERED row resolves to its anchor — never to itself', async () => {
  const { client, calls } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: 'covered', event_vendor_package_id: 'pkg-9', archived_at: null },
      error: null,
    }),
    anchorForPackage: () => ({ data: { vendor_id: 'ev-the-anchor' }, error: null }),
  });
  const got = await resolveFeeAnchorRowId(client, 'ev-covered');
  assert.equal(got, 'ev-the-anchor');
  assert.notEqual(got, 'ev-covered', 'billing the cascade row is the bug this exists to stop');
  assert.deepEqual(calls, ['byVendorId', 'anchorForPackage']);
});

test('a covered row whose ANCHOR IS GONE bills NOTHING', async () => {
  const { client } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: 'covered', event_vendor_package_id: 'pkg-9', archived_at: null },
      error: null,
    }),
    anchorForPackage: () => ({ data: null, error: null }),
  });
  assert.equal(
    await resolveFeeAnchorRowId(client, 'ev-covered'),
    null,
    'skipping a fee is recoverable; billing the wrong row is not',
  );
});

test('an ORPHANED covered row (FK is ON DELETE SET NULL) bills NOTHING', async () => {
  const { client, calls } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: 'covered', event_vendor_package_id: null, archived_at: null },
      error: null,
    }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-orphan'), null);
  assert.deepEqual(calls, ['byVendorId'], 'and it must not go looking');
});

test('an ARCHIVED booking is not a sale — bills NOTHING', async () => {
  const { client } = stubClient({
    byVendorId: (id) => ({
      data: {
        vendor_id: id,
        package_role: null,
        event_vendor_package_id: null,
        archived_at: '2026-08-01T00:00:00Z',
      },
      error: null,
    }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-archived'), null);
});

test('a vanished row bills NOTHING', async () => {
  const { client } = stubClient({ byVendorId: () => ({ data: null, error: null }) });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-gone'), null);
});

test('a READ ERROR bills NOTHING — the fail-safe is structural, not careful', async () => {
  const { client } = stubClient({
    byVendorId: () => ({ data: null, error: { message: 'connection reset' } }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-1'), null);
});

test('an UNKNOWN package_role is treated as an ordinary money row, not skipped', async () => {
  // Forward-compatibility: only 'covered' means "not the money row". A new
  // role must not silently stop billing — that would be a revenue hole nobody
  // notices, which is the harder failure to detect.
  const { client } = stubClient({
    byVendorId: (id) => ({
      data: { vendor_id: id, package_role: 'something_new', event_vendor_package_id: null, archived_at: null },
      error: null,
    }),
  });
  assert.equal(await resolveFeeAnchorRowId(client, 'ev-new'), 'ev-new');
});
