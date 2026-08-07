/**
 * A market band can never be built from so few peers that one is identifiable.
 *
 * ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
 * `platform_settings.radar_min_n_floor` is the minimum distinct peers a band
 * needs before it may be shown. Its CHECK allowed `>= 1`, and **prod was set
 * to 1**.
 *
 * Seven functions gate on it via `min_n_ok()` — demand radar (vendor + admin),
 * both band recomputes, rival signals, service-card records, trusted-circle
 * signal. At a floor of 1 a band can be built from a SINGLE other vendor, and
 * its p25 / p50 / p75 are then that vendor's exact reply rate, reply time and
 * conversion — published to a competitor under the label "anonymised benchmark".
 *
 * The feature's own docblock promises "quantiles-only … no peer identity by
 * construction." At n=1 that is false. At n=2 the median still gives it away.
 *
 * Nobody was exposed: 0 band rows, and the recompute is an admin button never
 * pressed. This is the hole closed while still theoretical.
 *
 * ── WHY A TEST AND NOT JUST THE MIGRATION ──────────────────────────────────
 * A CHECK is only as good as its surviving the next `ALTER TABLE`. This asserts
 * the rail is present and REFUSES the identifying range — the same posture as
 * every other guard written on 2026-08-06, all of which were only trustworthy
 * once they had been seen to fail.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close?.();
});

/** Try to set the floor; resolve to the error message, or null on success. */
async function trySetFloor(v: number): Promise<string | null> {
  try {
    await replay.db.query(`UPDATE public.platform_settings SET radar_min_n_floor = ${v}`);
    return null;
  } catch (e) {
    return String((e as Error).message ?? e);
  }
}

test('the identifying range is REFUSED by the database', async () => {
  for (const v of [0, 1, 2]) {
    const err = await trySetFloor(v);
    assert.ok(
      err,
      `radar_min_n_floor = ${v} was ACCEPTED. At ${v} a band can be built from ` +
        `${v === 0 ? 'no' : v} peer(s) and its quantiles are that peer's own numbers.`,
    );
    assert.match(
      err!,
      /radar_min_n_floor/,
      'the refusal must come from the named CHECK, not an unrelated error',
    );
  }
});

test('the safe range is still allowed — the rail is not a wall', async () => {
  // 3 is the hard minimum an admin may choose for a thin category; 5 is the
  // operating value. Both must remain settable, or the knob is useless.
  for (const v of [3, 5, 12]) {
    assert.equal(await trySetFloor(v), null, `radar_min_n_floor = ${v} must be allowed`);
  }
  // Leave it at the operating value.
  await trySetFloor(5);
});

test('the shipped value is at least the safe minimum', async () => {
  const res = await replay.db.query<{ floor: number }>(
    'SELECT radar_min_n_floor AS floor FROM public.platform_settings LIMIT 1',
  );
  const floor = res.rows[0]?.floor;
  assert.ok(typeof floor === 'number', 'platform_settings must have a row with a floor');
  assert.ok(
    floor >= 3,
    `the shipped floor is ${floor} — below the identifiability threshold`,
  );
});

test('a NEW settings row cannot be born identifying', async () => {
  // The default matters as much as the constraint: a fresh environment that
  // never runs an admin screen still must not ship at 1.
  const res = await replay.db.query<{ def: string | null }>(
    `SELECT column_default AS def
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='platform_settings'
        AND column_name='radar_min_n_floor'`,
  );
  const def = Number((res.rows[0]?.def ?? '').replace(/[^0-9]/g, ''));
  assert.ok(def >= 3, `the column default is ${def} — a new row would be identifying`);
});

test('min_n_ok itself never treats a smaller floor as acceptable', async () => {
  // The gate is `count >= GREATEST(floor, 1)`. Even if a caller passes a small
  // literal floor directly, it must still suppress a single-peer band.
  const res = await replay.db.query<{ one: boolean; five: boolean }>(
    'SELECT public.min_n_ok(1, 5) AS one, public.min_n_ok(5, 5) AS five',
  );
  assert.equal(res.rows[0]!.one, false, 'a 1-peer sample must not clear a floor of 5');
  assert.equal(res.rows[0]!.five, true, 'a 5-peer sample must clear a floor of 5');
});
