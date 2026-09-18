/**
 * guest-privacy-reads-are-honest.test.ts — a guest's own privacy switches may
 * not state a setting the page failed to read (S41b, the COUPLE-FACING tier of
 * `result-dropped-silently`, batch 2: the event site a guest opens).
 *
 * Both controls read the guest's CURRENT setting at render, and on a refused
 * read both stated a setting as fact:
 *
 *   FaceBlock ....... "Your face can appear on the screens at the venue."
 *   scan trail ...... "We keep a record of when you open your invitation…"
 *
 * — to a guest who may have switched it the other way. The documented lean
 * stays (the BUTTON offers the protective action); the SENTENCE now says it
 * could not check.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. Both notices are EXECUTED against a
 * client that refuses every read, and the rendered markup is asserted.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { type ReactElement } from 'react';

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
  const file = path.join(process.cwd(), `__guest_privacy_reads_${id}__.js`);
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

let face: typeof import('@/app/[slug]/_components/face-data-notice');
let scan: typeof import('@/app/[slug]/_components/scan-trail-notice');
before(async () => {
  face = await import('@/app/[slug]/_components/face-data-notice');
  scan = await import('@/app/[slug]/_components/scan-trail-notice');
});

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const err = console.error;
  const warn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = err;
    console.warn = warn;
  }
};
const html = (el: unknown) => (el ? renderToStaticMarkup(el as ReactElement) : '');

test('FaceBlock: a REFUSED read says it could not check, and still offers to blur', async () => {
  next = REFUSED;
  const out = html(await quiet(() => face.FaceDataNotice({ eventId: 'ev_1', guestId: 'g_1' })));
  assert.match(out, /couldn.{1,8}t check whether your face is blurred/);
  assert.doesNotMatch(out, /Your face can appear on the screens/, 'no setting stated as fact');
  assert.match(out, /Blur my face on the screens/, 'the protective action is the one offered');
});

test('FaceBlock: a measured "not blurred" still says so', async () => {
  next = { data: { faceblock_enabled: false }, error: null, count: null };
  const out = html(await quiet(() => face.FaceDataNotice({ eventId: 'ev_1', guestId: 'g_1' })));
  assert.match(out, /Your face can appear on the screens/);
});

test('scan trail: a REFUSED read says it could not check, and still offers to stop', async () => {
  next = REFUSED;
  const out = html(await quiet(() => scan.ScanTrailNotice({ eventId: 'ev_1', guestId: 'g_1' })));
  assert.match(out, /couldn.{1,8}t check just now whether we keep a record/);
  assert.doesNotMatch(out, /We keep a record of when you open/, 'no setting stated as fact');
  assert.match(out, /Stop keeping a record/, 'the protective action is the one offered');
});

test('scan trail: a measured opt-out still says so', async () => {
  next = { data: { scan_tracking_opt_out: true }, error: null, count: null };
  const out = html(await quiet(() => scan.ScanTrailNotice({ eventId: 'ev_1', guestId: 'g_1' })));
  assert.match(out, /We keep no record/);
});

test('the button behind a refused read sets the PROTECTIVE value', () => {
  assert.equal(face.faceBlockTarget(null), true, 'not measured → blur ON');
  assert.equal(face.faceBlockTarget(false), true);
  assert.equal(face.faceBlockTarget(true), false);
  assert.equal(scan.scanOptOutTarget(null), true, 'not measured → stop keeping a record');
  assert.equal(scan.scanOptOutTarget(false), true);
  assert.equal(scan.scanOptOutTarget(true), false);
});
