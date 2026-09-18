/**
 * booking-reads-are-honest.test.ts — a couple's booking screen may not state an
 * absence it did not measure (S41, the BOOKING tier of `result-dropped-silently`).
 *
 * Two couple-facing surfaces turned a refused read into the same words as a
 * genuine absence:
 *
 *   supplier workspace · Reviews ... "<Supplier> still has no review." → over a refused read
 *   Library · Saved vendors ........ "No saved vendors yet." → to a couple whose plans hold suppliers
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. Each read now carries a distinct failure
 * value, and each render branches on it BEFORE its empty state. The reviews
 * decision is executed against a stubbed client; the render order is pinned by
 * position (order, not counts).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim ── same as `app/[slug]/_components/editorial/recap-voice.test.ts`:
 * a bundler assertion with no runtime behaviour, resolved to an empty module. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_booking_reads__.js');
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

let info: typeof import('@/app/dashboard/[eventId]/_components/vendor-marketplace-info');
before(async () => {
  info = await import('@/app/dashboard/[eventId]/_components/vendor-marketplace-info');
});

function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'rpc']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

test('supplier reviews: a REFUSED read is reviewsMeasured:false', async () => {
  const r = await quiet(() =>
    info.fetchMarketplaceReviews(stubClient({ data: null, error: { code: '42501', message: 'denied' } }), 'vp_1'),
  );
  assert.equal(r.reviewsMeasured, false);
  assert.deepEqual(r.reviews, []);
});

test('supplier reviews: a genuine empty read is reviewsMeasured:true', async () => {
  const r = await info.fetchMarketplaceReviews(stubClient({ data: [], error: null }), 'vp_1');
  assert.equal(r.reviewsMeasured, true);
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

const RENDERS: { file: string; guard: string; empty: string }[] = [
  {
    file: 'app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx',
    guard: '{!reviewsMeasured ? (',
    empty: 'still has no review.',
  },
  {
    file: 'app/dashboard/(account)/library/_components/vendors-tab.tsx',
    guard: 'if (ownUnreadable && attended.length === 0)',
    empty: 'No saved vendors yet.',
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

test('the saved-vendors read returns its own failure value on a refusal, never []', () => {
  const s = src('app/dashboard/(account)/library/_data/saved-vendors.ts');
  const i = s.indexOf('if (error) {');
  const j = s.indexOf('return SAVED_VENDORS_UNREADABLE;');
  const k = s.indexOf('if (!rows || rows.length === 0) return [];');
  assert.ok(i >= 0 && j > i && k > j, `refusal branch (${i}) → sentinel (${j}) → empty (${k})`);
});
