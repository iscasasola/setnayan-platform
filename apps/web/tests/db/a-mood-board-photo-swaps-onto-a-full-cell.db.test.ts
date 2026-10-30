/**
 * 🖼↔🖼 A MOOD BOARD PHOTO DRAGGED ONTO A FULL CELL SWAPS — the REAL `swapMoodboardCells`
 * (lib/moodboard-swap.ts, the whole body of `reorderMoodboardSlot`) run against the REPLAYED schema
 * as a signed-in host, through `clientAs` (RLS and the table grants apply as they do to a browser).
 *
 * WHAT WAS TRUE (found 2026-10-30, live in production): the reorder parked the moving photo at
 * `slot_position = -1` so it could step out of `event_inspiration_assets_slot_unique` (UNIQUE
 * (event_id, slot_key, slot_position) WHERE removed_at IS NULL). The table's own CHECK
 * `event_inspiration_assets_slot_position_check_v2` allows only 1, 2, 3 — so that first UPDATE was
 * refused for every couple — and because the park ran on EVERY drag, not only onto a full cell, no
 * drag-reorder ever worked (test 3 is red under the sabotage too). The board had already painted the
 * swap, so it looked done until the next reload put the photos back.
 *
 *   1 · photo A in cell 1 dragged onto cell 2 holding photo B → A in 2, B in 1, both on the board;
 *   2 · across slots, onto the third cell — the same swap between two named slots;
 *   3 · onto an EMPTY cell → a plain move, the old cell left empty;
 *   4 · under PR #7090's rules (UPDATE granted on removed_at, slot_key, slot_position only; host-only
 *       policies) the host's swap still works — and a guest's is refused with NOTHING changed;
 *   5 · a write that does not land mid-swap is undone: the board is exactly as it was, no photo is
 *       left removed, and the result says it failed;
 *   6 · a cell the page showed as full but the table holds empty answers "stale", never "done".
 *
 * 🛡 Sabotage (run 2026-10-30): restoring the `-1` park in swapMoodboardCells' step 1
 *    (`{ slot_position: -1 }` instead of `{ removed_at: … }`) → tests 1, 2, 3, 4 go red ("the swap was
 *    refused: … Could not move that photo"); 5 and 6 stay green (they assert refusals). Restored → green.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';
import { swapMoodboardCells } from '../../lib/moodboard-swap';

let replay: ReplayResult;
let db: PGlite;

const W = { eventId: '', creator: '', guest: '' };
const HEX6 = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F', '#FFFFFF'];

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** A board photo written past RLS (the fixture), named by its image so a test can say which photo is where. */
async function photo(slot: string, position: number, name: string): Promise<string> {
  await setAuthUid(db, null);
  const r = await db.query<{ inspiration_id: string }>(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'url_paste', $5, $6, $7, $8, $9, $10, $11)
     RETURNING inspiration_id`,
    [W.eventId, W.creator, slot, position, `https://media.example/${name}.jpg`, ...HEX6],
  );
  return r.rows[0]!.inspiration_id;
}

/** The board as the page reads it: every active photo, "slot:position" → photo name. */
async function board(): Promise<Record<string, string>> {
  const r = await db.query<{ slot_key: string; slot_position: number; image_url: string }>(
    `SELECT slot_key, slot_position, image_url FROM public.event_inspiration_assets
      WHERE event_id = $1 AND removed_at IS NULL ORDER BY slot_key, slot_position`,
    [W.eventId],
  );
  const out: Record<string, string> = {};
  for (const row of r.rows) {
    out[`${row.slot_key}:${row.slot_position}`] = row.image_url.replace(/^.*\/|\.jpg$/g, '');
  }
  return out;
}

async function clearBoard(): Promise<void> {
  await db.query(`DELETE FROM public.event_inspiration_assets WHERE event_id = $1`, [W.eventId]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('swap-creator@mood-board-swap.test');
  W.guest = await newUser('swap-guest@mood-board-swap.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Mood Board Swap', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [W.eventId, W.creator],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [
    W.eventId,
    W.guest,
  ]);

  // The constraint this whole file is about must still be what it was — otherwise a green run proves nothing.
  const check = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'event_inspiration_assets_slot_position_check_v2'`,
  );
  assert.match(check.rows[0]?.def ?? '', /1.*2.*3/, 'the slot_position CHECK is gone or changed — re-read this test');
  assert.doesNotMatch(check.rows[0]!.def, /-1/, 'the CHECK admits -1 — the original bug could not reproduce here');
});

after(async () => {
  await db?.exec('RESET ROLE').catch(() => {});
  await db?.close?.();
});

test('1 · photo A in cell 1 dragged onto cell 2 holding photo B → A in 2, B in 1', async () => {
  await clearBoard();
  await photo('stage', 1, 'A');
  await photo('stage', 2, 'B');

  const res = await swapMoodboardCells(
    clientAs(db, W.creator),
    W.eventId,
    { slotKey: 'stage', slotPosition: 1 },
    { slotKey: 'stage', slotPosition: 2 },
  );
  assert.deepEqual(res, { ok: true, changed: 'swapped' }, `the swap was refused: ${JSON.stringify(res)}`);
  assert.deepEqual(await board(), { 'stage:1': 'B', 'stage:2': 'A' });

  const removed = await db.query(
    `SELECT 1 FROM public.event_inspiration_assets WHERE event_id = $1 AND removed_at IS NOT NULL`,
    [W.eventId],
  );
  assert.equal(removed.rows.length, 0, 'the swap left a photo removed — the park was never undone');
});

test('2 · across slots, onto the third cell — the same swap between two named slots', async () => {
  await clearBoard();
  await photo('stage', 1, 'A');
  await photo('flowers', 3, 'C');

  const res = await swapMoodboardCells(
    clientAs(db, W.creator),
    W.eventId,
    { slotKey: 'stage', slotPosition: 1 },
    { slotKey: 'flowers', slotPosition: 3 },
  );
  assert.deepEqual(res, { ok: true, changed: 'swapped' }, `the swap was refused: ${JSON.stringify(res)}`);
  assert.deepEqual(await board(), { 'flowers:3': 'A', 'stage:1': 'C' });
});

test('3 · onto an EMPTY cell → a plain move, the old cell left empty', async () => {
  await clearBoard();
  await photo('stage', 1, 'A');

  const res = await swapMoodboardCells(
    clientAs(db, W.creator),
    W.eventId,
    { slotKey: 'stage', slotPosition: 1 },
    { slotKey: 'stage', slotPosition: 3 },
  );
  assert.deepEqual(res, { ok: true, changed: 'moved' });
  assert.deepEqual(await board(), { 'stage:3': 'A' });
});

test('4 · under PR #7090’s rules the host still swaps; a guest is refused and nothing changes', async () => {
  await clearBoard();
  await photo('stage', 1, 'A');
  await photo('stage', 2, 'B');

  // #7090, verbatim in effect: host-only INSERT/UPDATE policies + UPDATE on three columns only.
  // Inside a transaction that is rolled back, so the rest of this file keeps today's rules.
  await db.exec('BEGIN');
  try {
    await db.exec(`
      DROP POLICY IF EXISTS event_inspiration_assets_host_update ON public.event_inspiration_assets;
      CREATE POLICY event_inspiration_assets_host_update ON public.event_inspiration_assets
        FOR UPDATE TO authenticated
        USING (event_id IN (SELECT public.current_couple_event_ids()))
        WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));
      REVOKE UPDATE ON public.event_inspiration_assets FROM authenticated;
      GRANT UPDATE (removed_at, slot_key, slot_position) ON public.event_inspiration_assets TO authenticated;
    `);

    const guest = await swapMoodboardCells(
      clientAs(db, W.guest),
      W.eventId,
      { slotKey: 'stage', slotPosition: 1 },
      { slotKey: 'stage', slotPosition: 2 },
    );
    assert.equal(guest.ok, false, 'a guest of the event moved the couple’s photos');
    assert.deepEqual(await board(), { 'stage:1': 'A', 'stage:2': 'B' }, 'a refused swap changed the board');

    const host = await swapMoodboardCells(
      clientAs(db, W.creator),
      W.eventId,
      { slotKey: 'stage', slotPosition: 1 },
      { slotKey: 'stage', slotPosition: 2 },
    );
    assert.deepEqual(host, { ok: true, changed: 'swapped' }, `the host’s swap was refused under #7090: ${JSON.stringify(host)}`);
    assert.deepEqual(await board(), { 'stage:1': 'B', 'stage:2': 'A' });
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK');
  }
});

/** The host's own client, with the Nth UPDATE made to come back refused (an RLS-filtered zero rows). */
function failingNthUpdate(base: SupabaseClient, n: number): SupabaseClient {
  let updates = 0;
  return {
    from(table: string) {
      const real = base.from(table);
      return {
        select: real.select.bind(real),
        update(patch: Record<string, unknown>) {
          updates += 1;
          if (updates !== n) return real.update(patch);
          const refused = {
            eq: () => refused,
            select: () => Promise.resolve({ data: [], error: null }),
          };
          return refused;
        },
      };
    },
  } as unknown as SupabaseClient;
}

test('5 · a write that does not land mid-swap is undone — the board is as it was, nothing left removed', async () => {
  for (const failAt of [2, 3]) {
    await clearBoard();
    await photo('stage', 1, 'A');
    await photo('stage', 2, 'B');

    const res = await swapMoodboardCells(
      failingNthUpdate(clientAs(db, W.creator), failAt),
      W.eventId,
      { slotKey: 'stage', slotPosition: 1 },
      { slotKey: 'stage', slotPosition: 2 },
    );
    assert.equal(res.ok, false, `update #${failAt} did not land and the swap still said ok`);
    assert.deepEqual(await board(), { 'stage:1': 'A', 'stage:2': 'B' }, `update #${failAt} failed and the board changed`);
  }
});

test('6 · a cell the page showed as full but the table holds empty answers "stale", never "done"', async () => {
  await clearBoard();
  await photo('stage', 2, 'B');

  const res = await swapMoodboardCells(
    clientAs(db, W.creator),
    W.eventId,
    { slotKey: 'stage', slotPosition: 1 },
    { slotKey: 'stage', slotPosition: 2 },
  );
  assert.equal(res.ok, false, 'moving a photo that is not there reported success');
  assert.deepEqual(await board(), { 'stage:2': 'B' });
});
