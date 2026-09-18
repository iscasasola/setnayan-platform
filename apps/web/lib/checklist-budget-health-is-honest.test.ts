/**
 * checklist-budget-health-is-honest.test.ts — the checklist's Budget health card
 * may not vanish, or draw itself, over a read it failed to make (S41b, the
 * COUPLE-FACING tier of `result-dropped-silently`; one of the four on-screen
 * cases S41 left for later).
 *
 *   refused budget read ........... card HID — the pixels of "no budget set yet"
 *   refused committed-suppliers ... card drawn from market ranges as if nothing
 *                                   were booked — a buffer that is not true
 *   computeBudgetHealth threw ..... card HID
 *
 * All three now yield `BUDGET_HEALTH_UNREADABLE`, and the checklist draws a
 * "We couldn't check your budget just now" card that still opens /budget.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. `computeBudgetHealth` is EXECUTED against
 * a client that refuses per table; the render branch is pinned by position.
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
/** Per-table answers; a table not listed gets `next`. */
let byTable: Record<string, Result> = {};
function query(table = ''): unknown {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'maybeSingle', 'single']) {
    b[m] = () => b;
  }
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(byTable[table] ?? next).then(resolve);
  return b;
}
/** The client itself is NOT thenable — `await createClient()` must not settle a query. */
const client = () => ({ from: (t: string) => query(t), rpc: () => query() });

/* ── module shims: `server-only`, and the two Supabase client factories ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
function shim(id: string, exports: unknown): string {
  const file = path.join(process.cwd(), `__budget_health_reads_${id}__.js`);
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

let budget: typeof import('@/lib/checklist-budget');
before(async () => {
  budget = await import('@/lib/checklist-budget');
});

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  const warn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
    console.warn = warn;
  }
};

const BUDGET_ROW: Result = {
  data: { estimated_budget_centavos: 50_000_000, estimated_pax: 120, ceremony_type: 'church', region: 'NCR', style_preferences: {} },
  error: null,
  count: null,
};

test('a REFUSED budget read is unreadable, not "no budget set"', async () => {
  byTable = {};
  next = REFUSED;
  assert.equal(await quiet(() => budget.computeBudgetHealth('ev_1')), budget.BUDGET_HEALTH_UNREADABLE);
});

test('a REFUSED committed-suppliers read is unreadable, not "nothing booked"', async () => {
  byTable = { events_host: BUDGET_ROW };
  next = REFUSED;
  assert.equal(await quiet(() => budget.computeBudgetHealth('ev_1')), budget.BUDGET_HEALTH_UNREADABLE);
});

test('a budget that was genuinely never set is still null', async () => {
  byTable = { events_host: { data: { estimated_budget_centavos: null }, error: null, count: null } };
  next = REFUSED;
  assert.equal(await budget.computeBudgetHealth('ev_1'), null);
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

test('the checklist draws the could-not-check card before it can draw — or skip — the health card', () => {
  const s = src('app/dashboard/[eventId]/_components/checklist/checklist-full.tsx');
  const guard = all(s, "{budgetHealth === 'unreadable' ? (");
  const card = all(s, '<BudgetHealthUnreadable eventId={eventId} />');
  const health = all(s, '<BudgetHealthCard eventId={eventId} health={budgetHealth} />');
  console.log(`# checklist-full: guard @${guard.join(',')} · unreadable card @${card.join(',')} · health card @${health.join(',')}`);
  assert.equal(guard.length, 1);
  assert.equal(card.length, 1);
  assert.equal(health.length, 1);
  assert.ok(guard[0]! < card[0]! && card[0]! < health[0]!);
  assert.equal(all(s, 'couldn&rsquo;t check your budget just now').length, 1);
});

test('a throw inside computeBudgetHealth is unreadable too, not a hidden card', () => {
  const s = src('app/dashboard/[eventId]/checklist/page.tsx');
  const threw = all(s, "'EventChecklistPage (computeBudgetHealth threw)'");
  const set = all(s, 'budgetHealth = BUDGET_HEALTH_UNREADABLE;');
  assert.equal(set.length, 1);
  assert.equal(threw.length, 1);
  assert.ok(set[0]! < threw[0]!, 'the catch sets unreadable');
});
