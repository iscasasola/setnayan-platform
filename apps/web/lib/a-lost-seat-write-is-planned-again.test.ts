/**
 * 🔁 A LOST SEAT WRITE IS PLANNED AGAIN, THEN RECORDED — event-day L1·7
 * (`applyReconcileForEvent`, lib/seating-reconcile.ts).
 *
 * Every attending RSVP runs the re-seat. Two replies in the same second plan the
 * same empty chair; the loser's upsert hits `event_seat_assignments_chair_uniq`
 * and, being one statement, seats nobody in its batch. That error was ignored —
 * a guest who said yes stayed unseated, silently. Now each pass returns its
 * write error, a lost pass is planned once more from fresh reads, and a second
 * loss is recorded as a fault.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the upsert's error not returned from the pass              → test 4 red;
 *   • one attempt instead of two                                  → test 1 red;
 *   • the fault not recorded after the second loss                → test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeatWriteFault } from './seating-reconcile';

const CHAIR = { message: 'duplicate key value violates unique constraint "event_seat_assignments_chair_uniq"', code: '23505' };
const quiet = () => {
  const e = console.error;
  console.error = () => {};
  return () => (console.error = e);
};

async function run(results: Array<SeatWriteFault | null>) {
  const { applyReconcileForEvent } = await import('./seating-reconcile');
  let passes = 0;
  const recorded: SeatWriteFault[] = [];
  const restore = quiet();
  try {
    await applyReconcileForEvent({} as SupabaseClient, 'ev', {}, {
      pass: async () => results[passes++] ?? null,
      record: async (_e, f) => {
        recorded.push(f);
      },
    });
  } finally {
    restore();
  }
  return { passes, recorded };
}

test('1 · a pass that loses the chair race is planned once more — and the second lands', async () => {
  const r = await run([CHAIR, null]);
  assert.equal(r.passes, 2, 'a lost seat write was not planned again — the guest who said yes stays unseated');
  assert.deepEqual(r.recorded, []);
});

test('2 · two lost passes are recorded, never thrown', async () => {
  const r = await run([CHAIR, CHAIR]);
  assert.equal(r.passes, 2, 'it kept retrying past two');
  assert.deepEqual(r.recorded, [CHAIR], 'an unseated guest left no fault behind');
});

test('3 · a pass that lands is the only pass', async () => {
  const r = await run([null]);
  assert.equal(r.passes, 1);
  assert.deepEqual(r.recorded, []);
});

test('4 · the pass returns BOTH write errors — neither is dropped', () => {
  const src = readFileSync(join(__dirname, 'seating-reconcile.ts'), 'utf8');
  const pass = src.slice(src.indexOf('export async function reconcilePass('));
  assert.match(pass, /const \{ error: releaseErr \} = await supabase\s*\.from\('event_seat_assignments'\)\s*\.delete\(\)/);
  assert.match(pass, /if \(releaseErr\) return releaseErr;/, 'the delete’s error is dropped');
  assert.match(pass, /const \{ error: assignErr \} = await supabase\.from\('event_seat_assignments'\)\.upsert\(/);
  assert.match(pass, /if \(assignErr\) return assignErr;/, 'the upsert’s error is dropped — the race is silent again');
});
