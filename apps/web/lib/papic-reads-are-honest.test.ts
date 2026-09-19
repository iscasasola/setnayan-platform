/**
 * papic-reads-are-honest.test.ts — Papic may not turn a REFUSED read into the
 * pixels of "nothing shot yet" or "your link is dead" (S41b, the COUPLE-FACING
 * tier of `result-dropped-silently`, batch 3: Papic).
 *
 *   home tile ............ a refused photo count was 0 → "shots ready" + the
 *                          "your free camera is ready" nudge on an event mid-shoot
 *   guest pool gallery ... a refused read → "No photos yet — check back soon!"
 *   crew seat claim ...... a refused read → "This link isn't active. Ask the host"
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The pool read is EXECUTED against a
 * refusing client (the home-tile counts are executed in `papic-home-tile.test.ts`);
 * the render branches are pinned by position (order, not counts).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  const file = path.join(process.cwd(), `__papic_reads_${id}__.js`);
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

let pool: typeof import('@/lib/papic-pool-gallery');
before(async () => {
  pool = await import('@/lib/papic-pool-gallery');
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

test('guest pool: a REFUSED read is unreadable, not an empty pool', async () => {
  next = REFUSED;
  const page = await quiet(() => pool.getPoolGalleryPage('g_1'));
  assert.equal(page.unreadable, true);
  assert.deepEqual(page.tiles, []);
});

test('guest pool: a genuine empty pool is readable', async () => {
  next = { data: [], error: null, count: null };
  const page = await pool.getPoolGalleryPage('g_1');
  assert.equal(page.unreadable, false);
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}
function inOrder(file: string, steps: string[]) {
  const s = src(file);
  const at = steps.map((n) => all(s, n));
  console.log(`# ${file}: ${steps.map((n, i) => `${JSON.stringify(n.slice(0, 40))} ×${at[i]!.length} @${at[i]!.join(',')}`).join(' · ')}`);
  at.forEach((a, i) => assert.equal(a.length, 1, `expected exactly one ${JSON.stringify(steps[i])}`));
  for (let i = 1; i < at.length; i++) assert.ok(at[i - 1]![0]! < at[i]![0]!, `${steps[i - 1]} must come before ${steps[i]}`);
}

test('home tile: an unmeasured photo count says so before "photos gathered"', () => {
  inOrder('app/dashboard/[eventId]/_components/event-dashboard.tsx', [
    'papicHome.cameras === null',
    'papicHome.photosGathered === null',
    "'couldn’t count photos just now'",
    '`photos gathered · ',
  ]);
});

test('pool grid: the unreadable branch comes before "No photos yet"', () => {
  inOrder('app/papic/pool/_components/pool-grid.tsx', [
    'if (tiles.length === 0 && initialUnreadable) {',
    'couldn&rsquo;t load the gallery',
    'No photos yet',
  ]);
  inOrder('app/papic/pool/page.tsx', ['initialUnreadable={firstPage.unreadable}']);
  inOrder('app/api/papic/guest-pool/route.ts', ['if (page.unreadable) {', "error: 'unreadable'", 'ok: true, tiles']);
});

test('seat claim: a refused read routes to the retryable form, never the dead-link screen', () => {
  inOrder('app/papic/actions.ts', [
    "from:paparazzi_seats.select', error);\n      return 'unreadable';",
    "if (!seat) return 'invalid';",
    "if (claimability === 'unreadable') redirect(`/papic/claim/${token}?state=unreadable`);",
    "if (claimability !== 'claimable') {",
  ]);
  const page = src('app/papic/claim/[token]/page.tsx');
  assert.equal(all(page, "state === 'unreadable'").length, 1, 'the claim page reads the state');
  assert.equal(all(page, "if (state === 'invalid' || state === 'error') {").length, 1, 'the terminal branch is unchanged — and does not swallow unreadable');
  assert.equal(all(page, '{checkUnreadable ? (').length, 1, 'the claim form says why');
});
