/**
 * whats-next-says-what-it-could-not-read.test.ts — the couple's "What's next"
 * (Home's "Dates coming up") may not drop a source it failed to read and still
 * look complete (S41b, the COUPLE-FACING tier of `result-dropped-silently`; one
 * of the four on-screen cases S41 left for later).
 *
 * Every fetcher in `lib/upcoming-items.ts` returned `[]` on a refused read, so a
 * refused payments read removed every payment falling due from a list that
 * rendered calm and whole — and with no other dates, the group vanished. A
 * refused source is now a TAGGED empty list; `fetchUpcomingItems` reports it in
 * `unreadableSources`, and the board's first row says which dates couldn't load.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. `fetchUpcomingItems` is EXECUTED against
 * a client that refuses per table; the render branch is pinned by position.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { fetchUpcomingItems } from '@/lib/upcoming-items';

type Result = { data: unknown; error: unknown };
const REFUSED: Result = { data: null, error: { code: '42501', message: 'permission denied' } };
const EMPTY: Result = { data: [], error: null };

function client(byTable: Record<string, Result>): SupabaseClient {
  const query = (table: string): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'gt', 'gte', 'lte', 'lt', 'or', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(byTable[table] ?? EMPTY).then(resolve);
    return b;
  };
  return { from: (t: string) => query(t), rpc: () => query('') } as unknown as SupabaseClient;
}

async function run(byTable: Record<string, Result>) {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fetchUpcomingItems({
      supabase: client(byTable),
      eventId: 'ev_1',
      eventDate: null,
      ceremonyType: null,
      now: new Date('2026-09-19T00:00:00Z'),
      remindersEnabled: false,
      statutory: false,
    });
  } finally {
    console.error = orig;
  }
}

test('a REFUSED payments read is reported, not silently absent', async () => {
  const r = await run({ event_vendor_line_items: REFUSED });
  assert.deepEqual([...r.unreadableSources], ['vendor_payment']);
  assert.equal(r.items.length, 0);
});

test('each refused source is named', async () => {
  const r = await run({
    event_appointments: REFUSED,
    event_schedule_blocks: REFUSED,
    event_vendor_line_items: REFUSED,
    orders: REFUSED,
  });
  assert.deepEqual([...r.unreadableSources].sort(), ['meeting', 'schedule_block', 'setnayan_sku_expiry', 'vendor_payment']);
});

test('genuinely nothing due is not "unreadable"', async () => {
  const r = await run({});
  assert.deepEqual([...r.unreadableSources], []);
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function all(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

test('the board renders the dates group on a refusal alone, and says so first', () => {
  const s = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  const flag = all(s, 'const unreadableDates = upcoming.unreadableSources.length > 0;');
  const gate = all(s, 'aiActive && (upcoming.items.length > 0 || unreadableDates)');
  const first = all(s, '...(unreadableRow ? [unreadableRow] : []),');
  const rest = all(s, '...upcoming.items.slice(0, 6).map(');
  console.log(`# event-dashboard: flag @${flag.join(',')} · gate @${gate.join(',')} · first @${first.join(',')} · rest @${rest.join(',')}`);
  for (const [name, a] of Object.entries({ flag, gate, first, rest })) assert.equal(a.length, 1, name);
  assert.ok(flag[0]! < gate[0]! && gate[0]! < first[0]! && first[0]! < rest[0]!);
  assert.equal(all(s, "label: 'Some dates couldn’t load',").length, 1);
});
