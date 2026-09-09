/**
 * THE EDITION NUMBER — the arithmetic, and the three ways it must refuse.
 *
 * `03` §2.4 · 08 step 1.6. The number is stamped once at publish and never
 * moves, so **every way this function can be wrong is permanent**. That is why
 * the refusals get as much attention here as the happy path: a story stamped
 * "No. 1" because a query was refused carries that forever, and the database
 * trigger will not let anybody correct it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  countEditionNo,
  editionCycleStart,
  editionVolumeToStamp,
  stampForPublish,
} from './story-edition';

/**
 * A stand-in for the admin client's counting builder. `count` is what the query
 * resolves to, `error` is a REFUSAL — which is what a missing grant, an RLS
 * refusal or a bad column looks like from here: no throw, just an absence.
 *
 * ⚠ THE CAST IS THE POINT, NOT A SHORTCUT. Handing the real `SupabaseClient`
 * type a four-method stand-in is exactly what these tests want: they exercise
 * the ARITHMETIC and the three refusals without a database, and they record
 * which columns the query actually asks for. Widening the production signature
 * to fit the fake instead is what made `tsc` give up (TS2589).
 */
function client(result: { count: number | null; error?: unknown }) {
  const calls: Array<Record<string, string>> = [];
  const api = {
    from(table: string) {
      const call: Record<string, string> = { table };
      calls.push(call);
      const chain = {
        select: () => chain,
        eq: (c: string, v: string) => {
          call[`eq:${c}`] = v;
          return chain;
        },
        gte: (c: string, v: string) => {
          call[`gte:${c}`] = v;
          return chain;
        },
        lte: (c: string, v: string) => {
          call[`lte:${c}`] = v;
          return chain;
        },
        then: (resolve: (r: { count: number | null; error: unknown }) => unknown) =>
          resolve({ count: result.count, error: result.error ?? null }),
      };
      return chain;
    },
  };
  return { api: api as unknown as SupabaseClient, calls };
}

test('the cycle opens on 18 November, not 1 January', () => {
  // Vol. I = 18 Nov 2026 → 17 Nov 2027. A December wedding STARTS a volume; the
  // following June is still that same volume.
  assert.equal(editionCycleStart('2026-11-18'), '2026-11-18');
  assert.equal(editionCycleStart('2026-11-17'), '2025-11-18');
  assert.equal(editionCycleStart('2026-12-25'), '2026-11-18');
  assert.equal(editionCycleStart('2027-06-01'), '2026-11-18');
  assert.equal(editionCycleStart('2027-11-18'), '2027-11-18');
});

test('an unparseable date counts from nothing at all', () => {
  // Not "count from this year" — a window nobody chose would produce a number
  // that looks real. Null means the caller stamps nothing.
  for (const bad of [null, '', 'sometime', '2026-13', 'the 5th']) {
    assert.equal(editionCycleStart(bad), null, `${String(bad)} produced a window`);
  }
});

test('the volume matches the cycle, clamped to the inaugural one', () => {
  assert.equal(editionVolumeToStamp('2026-12-01'), 1);
  assert.equal(editionVolumeToStamp('2027-06-01'), 1);
  assert.equal(editionVolumeToStamp('2027-11-18'), 2);
  assert.equal(editionVolumeToStamp('2028-06-01'), 2);
  // Anything before the first cycle is the inaugural edition, never Vol. 0 or
  // a negative Roman numeral.
  assert.equal(editionVolumeToStamp('2024-01-01'), 1);
  assert.equal(editionVolumeToStamp(null), 1);
});

test('the count asks for weddings inside this event’s own cycle', () => {
  const { api, calls } = client({ count: 4 });
  return countEditionNo(api, '2027-06-01').then((n) => {
    assert.equal(n, 4);
    assert.deepEqual(calls, [
      {
        table: 'events',
        'eq:event_type': 'wedding',
        'gte:event_date': '2026-11-18',
        'lte:event_date': '2027-06-01',
      },
    ]);
  });
});

test('A REFUSED COUNT STAMPS NOTHING — it does not become No. 1', () => {
  /*
    🔑 THE WHOLE REASON THIS TEST EXISTS. A rejected query is an ABSENCE: it
    arrives as `error` set and `count` null, which reads exactly like "no
    weddings". Collapsing the two would stamp a permanent, uncorrectable "No. 1"
    onto a keepsake the first time a grant went missing. A story with no number
    reads "Vol. I" and is honest.
  */
  return Promise.all([
    countEditionNo(client({ count: null, error: { message: 'permission denied' } }).api, '2027-06-01'),
    countEditionNo(client({ count: null }).api, '2027-06-01'),
    countEditionNo(client({ count: 0 }).api, '2027-06-01'),
    countEditionNo(client({ count: 3 }).api, null),
  ]).then(([refused, empty, zero, undated]) => {
    assert.equal(refused, null, 'a refused count became a number');
    assert.equal(empty, null);
    assert.equal(zero, null, 'zero became a number');
    assert.equal(undated, null, 'an undated event was stamped');
  });
});

test('the stamp is all of it or none of it — never half', () => {
  /*
    A volume with no number would print "Vol. II · No. null" to any reader that
    trusted one field without the other, and the masthead's own rule is that the
    number appears only when it is real.
  */
  return Promise.all([
    stampForPublish(client({ count: 4 }).api, '2027-06-01'),
    stampForPublish(client({ count: null, error: { message: 'nope' } }).api, '2027-06-01'),
  ]).then(([full, none]) => {
    assert.deepEqual(full, { volume: 1, no: 4 });
    assert.equal(none, null);
  });
});
