/**
 * couple-dashboard-reads-are-honest.test.ts — a couple's event dashboard may not
 * turn a REFUSED read into the same pixels as "nothing here" (S41b, the
 * COUPLE-FACING tier of `result-dropped-silently`, batch 1 of the dashboard).
 *
 * Three cards vanished on a refused read, exactly as they do when there is
 * genuinely nothing to show:
 *
 *   overview · access requests ......... "no request is waiting" → over a refused count
 *   Papic · Finding people in photos ... the couple's only OFF switch disappeared
 *   Papic · Shared gallery ............. the switch that may hold the pool OPEN disappeared
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The first two are EXECUTED against a
 * client that refuses every read, and the rendered markup is asserted; the
 * third sits behind a flag + a DPO control, so its branch order is pinned by
 * position (order, not counts).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { type ReactElement } from 'react';
import { stripComments } from '@/lib/strip-comments';

/* ── a client whose every read is REFUSED (42501), or answers `ok` ── */
type Result = { data: unknown; error: unknown; count: number | null };
const REFUSED: Result = { data: null, error: { code: '42501', message: 'permission denied' }, count: null };
let next: Result = REFUSED;
function query(): unknown {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'maybeSingle', 'single']) {
    b[m] = () => b;
  }
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(next).then(resolve);
  return b;
}
/** The client itself is NOT thenable — `await createClient()` must not settle a query. */
const client = () => ({ from: () => query(), rpc: () => query() });

/* ── module shims: `server-only`, and the two Supabase client factories ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
function shim(id: string, exports: unknown): string {
  const file = path.join(process.cwd(), `__couple_dash_reads_${id}__.js`);
  const m = new CjsModule(file);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  m.paths = [];
  CjsModule._cache[file] = m;
  return file;
}
const SHIMS: Record<string, string> = {
  'server-only': shim('server_only', {}),
  '@/lib/supabase/server': shim('server', { createClient: async () => client() }),
  '@/lib/supabase/admin': shim('admin', { createAdminClient: () => client() }),
};
{
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request in SHIMS) return SHIMS[request]!;
    return original.call(this, request, ...rest);
  };
}

// tsconfig sets `"jsx": "preserve"`, so tsx compiles components to a bare
// `React.createElement` — set it before the DYNAMIC imports below.
(globalThis as unknown as { React: unknown }).React = React;

let doorway: typeof import('@/app/dashboard/[eventId]/_components/access-requests-doorway');
let face: typeof import('@/app/dashboard/[eventId]/studio/papic/_components/face-tagging-choice');
before(async () => {
  doorway = await import('@/app/dashboard/[eventId]/_components/access-requests-doorway');
  face = await import('@/app/dashboard/[eventId]/studio/papic/_components/face-tagging-choice');
});

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};
const html = (el: unknown) => (el ? renderToStaticMarkup(el as ReactElement) : '');

test('access requests: a REFUSED count renders a door that says it could not check', async () => {
  next = REFUSED;
  const out = html(await quiet(() => doorway.AccessRequestsDoorway({ eventId: 'ev_1' })));
  assert.match(out, /couldn.{1,8}t check for access requests/);
});

test('access requests: a genuine zero still renders nothing', async () => {
  next = { data: null, error: null, count: 0 };
  assert.equal(await doorway.AccessRequestsDoorway({ eventId: 'ev_1' }), null);
});

test('face tagging: a REFUSED read keeps the card, saying it could not check (card + row)', async () => {
  next = REFUSED;
  for (const variant of ['card', 'row'] as const) {
    const out = html(await quiet(() => face.FaceTaggingChoice({ eventId: 'ev_1', variant })));
    assert.match(out, /Finding people in photos/, `${variant}: the card is still there`);
    assert.match(out, /couldn.{1,8}t (check|load)/i, `${variant}: and it says why`);
  }
});

test('face tagging: an event without face tagging still renders nothing', async () => {
  next = { data: { papic_face_mode: 'mode_b', event_type: 'wedding', face_tagging_declined_by_couple: false }, error: null, count: null };
  assert.equal(await face.FaceTaggingChoice({ eventId: 'ev_1' }), null);
});

/* ── the shared-gallery card: order, not counts ── */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

test('shared gallery: the refusal branch renders its own card before the absent card returns null', () => {
  const s = src('app/dashboard/[eventId]/studio/papic/_components/pool-gallery-card.tsx');
  const guards = all(s, 'if (error) {');
  const says = all(s, 'couldn&rsquo;t check whether your shared gallery is open');
  const absent = all(s, 'if (!ev) return null;');
  console.log(`# pool-gallery-card: guard @${guards.join(',')} · says @${says.join(',')} · absent @${absent.join(',')}`);
  assert.equal(guards.length, 1);
  assert.equal(says.length, 1);
  assert.equal(absent.length, 1);
  assert.ok(guards[0]! < says[0]! && says[0]! < absent[0]!, 'refusal → its card → only then the absence');
  assert.equal(all(s, 'if (error || !ev) return null;').length, 0, 'the refusal may not share the absence branch');
});
