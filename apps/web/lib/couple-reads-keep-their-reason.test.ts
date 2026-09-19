/**
 * couple-reads-keep-their-reason.test.ts — a couple-facing reader may degrade on
 * a refused read, but never silently (S41b, the COUPLE-FACING tier of
 * `result-dropped-silently`, batch 5: the guest door, songs, the venue, faces).
 *
 * Each reader below has a deliberate, documented degrade — the tradition guide
 * falls back to its built-in defaults, the venue entrance to the conventional
 * spot, the watch links to "none", a supplier's repertoire to an empty shelf.
 * The degrade stays. What was wrong is that a REFUSED read and a genuine
 * absence took the same branch and left nothing behind, so RLS or schema drift
 * read, in every log, exactly like "the couple hasn't set this".
 *
 * Executed, not grepped: each reader runs against a client that refuses, and
 * must (1) still return its documented degrade and (2) leave exactly one
 * `[supabase-error]` record carrying the error object. A genuine absence (no
 * error) must leave NO record — the log is for refusals, not for emptiness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVendorSongs, fetchEventSongRequests } from '@/lib/songs';
import { fetchTraditionItems } from '@/lib/wedding-traditions';
import { readEventWatchUrls } from '@/lib/watch-live-links';
import { fetchEntrance } from '@/lib/indoor-blueprint';

type Result = { data: unknown; error: unknown };
const REFUSAL = { code: '42501', message: 'permission denied' };
function client(result: Result): SupabaseClient {
  const query = (): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'ilike', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return b;
  };
  return { from: () => query(), rpc: () => query() } as unknown as SupabaseClient;
}

/** Run `fn`, capturing every `[supabase-error]` console.error record. */
async function records<T>(fn: () => Promise<T>): Promise<{ value: T; logged: unknown[][] }> {
  const orig = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[supabase-error]')) logged.push(args);
  };
  try {
    return { value: await fn(), logged };
  } finally {
    console.error = orig;
  }
}

const READERS: {
  name: string;
  run: (db: SupabaseClient) => Promise<unknown>;
  degrade: unknown;
  site: string;
}[] = [
  {
    name: 'a supplier repertoire',
    run: (db) => fetchVendorSongs(db, 'vp_1'),
    degrade: [],
    site: 'lib/songs.ts · from:vendor_songs.select',
  },
  {
    name: 'the couple song picks',
    run: (db) => fetchEventSongRequests(db, 'ev_1'),
    degrade: [],
    site: 'lib/songs.ts · from:event_song_picks.select',
  },
  {
    name: 'the tradition guide',
    run: (db) => fetchTraditionItems(db, 'catholic'),
    degrade: null,
    site: 'lib/wedding-traditions.ts · from:wedding_tradition_items.select',
  },
  {
    name: 'the watch links',
    run: (db) => readEventWatchUrls(db, 'ev_1'),
    degrade: { youtubeWatchUrl: null, facebookWatchUrl: null },
    site: 'lib/watch-live-links.ts · from:events.select',
  },
];

for (const r of READERS) {
  test(`${r.name}: a REFUSED read keeps its degrade AND leaves its reason`, async () => {
    const { value, logged } = await records(() => r.run(client({ data: null, error: REFUSAL })));
    assert.deepEqual(value, r.degrade);
    const mine = logged.filter((a) => String(a[0]).includes(r.site));
    assert.equal(mine.length, 1, `expected one "[supabase-error] ${r.site}" record, saw ${JSON.stringify(logged.map((a) => a[0]))}`);
    assert.deepEqual(mine[0]![1], REFUSAL, 'the record carries the error object');
  });

  test(`${r.name}: a genuine absence leaves no record`, async () => {
    const { logged } = await records(() => r.run(client({ data: null, error: null })));
    assert.equal(logged.length, 0);
  });
}

test('the venue entrance: a refused read falls back to the default AND says why', async () => {
  const { value, logged } = await records(() => fetchEntrance(client({ data: null, error: REFUSAL }), 'ev_1'));
  assert.ok(value && typeof (value as { x: number }).x === 'number', 'still an entrance');
  assert.ok(
    logged.some((a) => String(a[0]).includes('lib/indoor-blueprint.ts · from:events.select')),
    `the events read left its reason: ${JSON.stringify(logged.map((a) => a[0]))}`,
  );
});
