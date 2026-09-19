/**
 * samahan-reads-are-honest.test.ts — a community's story strip may not say
 * "Nothing yet this day." over a read it failed to make (S41b, the
 * COUPLE-FACING tier of `result-dropped-silently`, batch 4: stories & keepsakes).
 *
 * `fetchSamahanStories` returned `[]` on a refused read, and the strip printed
 * its empty-day line — to a community that may be full of stories. It now
 * returns `null`; the page hands the strip `unreadable`, and the strip says it
 * could not load BEFORE it can say "nothing yet".
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The read is EXECUTED against a refusing
 * client (it takes its clients as arguments); the render branch is pinned by
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

/* ── `server-only` shim ── a bundler assertion with no runtime behaviour. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_samahan_reads__.js');
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

let fetchSamahanStories: typeof import('@/lib/samahan-stories').fetchSamahanStories;
before(async () => {
  ({ fetchSamahanStories } = await import('@/lib/samahan-stories'));
});

type Result = { data: unknown; error: unknown };
function client(result: Result): SupabaseClient {
  const query = (): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gt', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return b;
  };
  return { from: () => query(), rpc: () => query() } as unknown as SupabaseClient;
}
const REFUSED: Result = { data: null, error: { code: '42501', message: 'permission denied' } };

test('samahan stories: a REFUSED read is null, never an empty day', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const got = await fetchSamahanStories(client(REFUSED), client(REFUSED), 'c_1', 'u_1');
    assert.equal(got, null);
  } finally {
    console.error = orig;
  }
});

test('samahan stories: a genuine empty day is []', async () => {
  const ok = client({ data: [], error: null });
  assert.deepEqual(await fetchSamahanStories(ok, ok, 'c_1', 'u_1'), []);
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

test('the strip says "couldn\'t load" before it can say "Nothing yet this day."', () => {
  const s = src('app/dashboard/(account)/samahan/[communityId]/_components/samahan-stories.tsx');
  const guard = all(s, '{unreadable && stories.length === 0 ? (');
  const says = all(s, 'couldn&rsquo;t load today&rsquo;s stories');
  const empty = all(s, 'Nothing yet this day.');
  console.log(`# samahan-stories: guard @${guard.join(',')} · says @${says.join(',')} · empty @${empty.join(',')}`);
  assert.equal(guard.length, 1);
  assert.equal(says.length, 1);
  assert.equal(empty.length, 1);
  assert.ok(guard[0]! < says[0]! && says[0]! < empty[0]!);
});

test('the page hands the strip the refusal, not a silent []', () => {
  const s = src('app/dashboard/(account)/samahan/[communityId]/page.tsx');
  assert.equal(all(s, 'storiesUnreadable={stories === null}').length, 1);
  assert.equal(all(s, 'unreadable={storiesUnreadable}').length, 1);
});
