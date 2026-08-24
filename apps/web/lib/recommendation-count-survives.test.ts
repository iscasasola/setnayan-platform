/**
 * recommendation-count-survives.test.ts — "recommended by N couples" keeps
 * counting couples after their celebrations are deleted.
 *
 * The db test proves the ROWS survive. This proves the number a person actually
 * reads on the shop page, which is computed here in JS and was the half that
 * would have shipped wrong.
 *
 * 🚨 THE TRAP: the count dedupes by `event_id`, because both partners on one
 * celebration can each recommend and that is ONE couple. A `Set` collapses every
 * NULL to a single member — so once recommendations outlive their events, three
 * different couples would have read as "recommended by 1 couple". Not zero,
 * which looks like an absence; a believable wrong number instead.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `vendor-recommendations.ts` imports `lib/uploads.ts`, which opens with
 * `import 'server-only'` — a module Next.js supplies to the BUNDLER and which
 * does not exist in node_modules, so a static import here dies with
 * MODULE_NOT_FOUND before one assertion runs. The import is a bundler assertion
 * ("never ship me to a client") with no runtime behaviour, so resolving it to an
 * empty module is faithful rather than a shortcut.
 * Same shim, same reasoning as `lib/booking-fee-anchor.test.ts`. Registered at
 * module scope, and the real import is dynamic in `before()` — a static one
 * would hoist above this and defeat it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_reco__.js');
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

let countVendorRecommendingCouples:
  typeof import('./vendor-recommendations').countVendorRecommendingCouples;

before(async () => {
  ({ countVendorRecommendingCouples } = await import('./vendor-recommendations'));
});

type Row = { recommendation_id: string; event_id: string | null };

/** The narrowest stub that exercises the real function's real query chain. */
function clientReturning(rows: Row[] | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: rows, error }),
      }),
    }),
  } as never;
}

test('three couples who each deleted their celebration still count as three', async () => {
  const n = await countVendorRecommendingCouples(
    clientReturning([
      { recommendation_id: 'r1', event_id: null },
      { recommendation_id: 'r2', event_id: null },
      { recommendation_id: 'r3', event_id: null },
    ]),
    'vendor-1',
  );
  assert.equal(n, 3, 'THE REGRESSION: a Set of NULLs has one member, so this read 1');
});

test('both partners on ONE LIVING celebration still count as one couple', async () => {
  // The reason the dedupe exists at all. After a delete the database has already
  // collapsed the pair to one row, so the orphan case cannot present two.
  const n = await countVendorRecommendingCouples(
    clientReturning([
      { recommendation_id: 'r1', event_id: 'live-1' },
      { recommendation_id: 'r2', event_id: 'live-1' },
    ]),
    'vendor-1',
  );
  assert.equal(n, 1, 'two partners, one celebration, one couple');
});

test('live and orphaned celebrations are counted together, never double', async () => {
  const n = await countVendorRecommendingCouples(
    clientReturning([
      { recommendation_id: 'r1', event_id: 'live-1' },
      { recommendation_id: 'r2', event_id: 'live-1' },
      { recommendation_id: 'r3', event_id: null },
    ]),
    'vendor-1',
  );
  assert.equal(n, 2, 'one living celebration + one deleted one = two couples');
});

test('two DIFFERENT deleted celebrations count as two, never merged', async () => {
  // The failure the old key produced: a Set of NULLs has one member.
  const n = await countVendorRecommendingCouples(
    clientReturning([
      { recommendation_id: 'r1', event_id: null },
      { recommendation_id: 'r2', event_id: null },
    ]),
    'vendor-1',
  );
  assert.equal(n, 2);
});

test('a failed read reports 0 rather than a number it did not establish', async () => {
  const n = await countVendorRecommendingCouples(
    clientReturning(null, { message: 'refused' }),
    'vendor-1',
  );
  assert.equal(n, 0);
});
