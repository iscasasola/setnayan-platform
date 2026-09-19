/**
 * couple-reads-keep-their-reason-2.test.ts — the last of the COUPLE-FACING tier
 * of `result-dropped-silently` (S41b, batch 8: the floor plan, the story, Papic
 * cameras, entitlements — files S41's open batches also touch).
 *
 * Each reader below has a deliberate, documented degrade — a floor plan without
 * its signs or scene objects, a planner without keep-apart rules.
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
import { fetchSeatingConstraints, fetchSigns, fetchSceneObjects } from '@/lib/seating';

type Result = { data: unknown; error: unknown };
const REFUSAL = { code: '42501', message: 'permission denied' };
function client(result: Result): SupabaseClient {
  const query = (): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'ilike', 'gt', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
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
    name: 'the keep-apart rules',
    run: (db) => fetchSeatingConstraints(db, 'ev_1'),
    degrade: [],
    site: 'lib/seating.ts · from:event_seating_constraints.select',
  },
  {
    name: 'the floor-plan signs',
    run: (db) => fetchSigns(db, 'ev_1'),
    degrade: [],
    site: 'lib/seating.ts · from:event_floor_signs.select',
  },
  {
    name: 'the floor-plan scene objects',
    run: (db) => fetchSceneObjects(db, 'ev_1'),
    degrade: [],
    site: 'lib/seating.ts · from:event_scene_objects.select',
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
