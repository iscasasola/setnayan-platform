/**
 * 🖼↔🖼 A MOOD BOARD PHOTO DRAGGED ONTO A FULL CELL SWAPS — the REAL `swapMoodboardCells`
 * (lib/moodboard-swap.ts, the whole body of `reorderMoodboardSlot`) run against the REPLAYED schema
 * as a signed-in host, through `clientAs` (RLS and the table grants apply as they do to a browser).
 *
 * WHAT WAS TRUE (found 2026-10-30, live in production): the reorder parked the moving photo at
 * `slot_position = -1` so it could step out of `event_inspiration_assets_slot_unique` (UNIQUE
 * (event_id, slot_key, slot_position) WHERE removed_at IS NULL). The table's own CHECK
 * `event_inspiration_assets_slot_position_check_v2` allows only 1, 2, 3 — so that first UPDATE was
 * refused for every couple, and because the park ran on EVERY drag, no drag-reorder ever worked. The
 * board had already painted the swap, so it looked done until the next reload put the photos back.
 *
 * 🔑 THE SWAP NEVER TOUCHES `removed_at`. A change to it is a REMOVAL to the rest of the system (#7089's
 * `couple_photo_shares_follow_the_board` withdraws a photo's supplier share on it), so the moving photo
 * parks on a free REAL cell — slot_key / slot_position only. Every test below that moves photos watches
 * `removed_at` on every row of the event after EVERY write the swap sends.
 *
 *   1 · photo A in cell 1 dragged onto cell 2 holding photo B → A in 2, B in 1; A parked on the free
 *       cell of its OWN slot; removed_at untouched at every step;
 *   2 · across slots, onto the third cell — the same swap between two named slots;
 *   3 · onto an EMPTY cell → a plain move in one write, the old cell left empty;
 *   4 · the photo's own slot is full → it parks on a free cell of another part, which is empty again after;
 *   5 · under PR #7090's rules (UPDATE granted on removed_at, slot_key, slot_position only; host-only
 *       policies) the host's swap still works — and a guest's is refused with NOTHING changed;
 *   6 · the board 100 % full → "Make room first — every cell is full", nothing moved;
 *   7 · a write that does not land at any step is undone: the board is exactly as it was;
 *   8 · a cell the page showed as full but the table holds empty answers "stale", never "done".
 *
 * 🛡 Sabotage (run 2026-10-30, each red then restored):
 *    · the `-1` park restored (step 1 writes `slotPosition: -1`) → 1, 2, 4, 5 red ("the swap was refused");
 *    · the park done by `removed_at` instead of a cell → 1, 2, 4, 5 red ("removed_at changed mid-swap"),
 *      and 7 red (a failed step left the photo removed).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';
import { swapMoodboardCells, SWAP_FULL_MESSAGE } from '../../lib/moodboard-swap';

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

/** Every row of the event (removed or not): id → "slot:position" and its removed_at. */
async function rows(): Promise<Map<string, { cell: string; removedAt: unknown }>> {
  const r = await db.query<{ inspiration_id: string; slot_key: string; slot_position: number; removed_at: unknown }>(
    `SELECT inspiration_id, slot_key, slot_position, removed_at FROM public.event_inspiration_assets WHERE event_id = $1`,
    [W.eventId],
  );
  return new Map(r.rows.map((x) => [x.inspiration_id, { cell: `${x.slot_key}:${x.slot_position}`, removedAt: x.removed_at }]));
}

async function clearBoard(): Promise<void> {
  await db.query(`DELETE FROM public.event_inspiration_assets WHERE event_id = $1`, [W.eventId]);
}

/**
 * The host's client, watched: after EVERY update the swap sends lands, the rows of the event are read
 * (past RLS) and `removed_at` is asserted unchanged on every row — so the park itself is observed too.
 * `steps` holds the cell each watched photo stood in after each write.
 */
function watched(base: SupabaseClient, ids: string[]) {
  const steps: Array<Record<string, string>> = [];
  let armed: Map<string, { cell: string; removedAt: unknown }> | null = null;
  const observe = async () => {
    const now = await rows();
    if (!armed) throw new Error('watched() used before arm()');
    for (const [id, was] of armed) {
      assert.deepEqual(now.get(id)?.removedAt, was.removedAt, `removed_at changed mid-swap on ${id} (step ${steps.length + 1})`);
    }
    steps.push(Object.fromEntries(ids.map((id) => [id, now.get(id)?.cell ?? '?'])));
  };
  const client = {
    from(table: string) {
      const real = base.from(table) as unknown as Record<string, (...a: unknown[]) => unknown>;
      return {
        select: (...a: unknown[]) => real.select!(...a),
        update(patch: Record<string, unknown>) {
          const q = real.update!(patch) as Record<string, (...a: unknown[]) => unknown>;
          const chain: Record<string, (...a: unknown[]) => unknown> = {
            eq: (...a) => (q.eq!(...a), chain),
            is: (...a) => (q.is!(...a), chain),
            select: (...a) =>
              Promise.resolve(q.select!(...a) as PromiseLike<unknown>).then(async (v) => {
                await observe();
                return v;
              }),
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  return {
    client,
    steps,
    arm: async () => {
      armed = await rows();
    },
  };
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

  // The constraints this file is about must still be what they were — otherwise a green run proves nothing.
  const check = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'event_inspiration_assets_slot_position_check_v2'`,
  );
  assert.match(check.rows[0]?.def ?? '', /1.*2.*3/, 'the slot_position CHECK is gone or changed — re-read this test');
  assert.doesNotMatch(check.rows[0]!.def, /-1/, 'the CHECK admits -1 — the original bug could not reproduce here');
  const fk = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'event_inspiration_assets_slot_key_is_a_part'`,
  );
  assert.match(fk.rows[0]?.def ?? '', /REFERENCES inspiration_parts\(slot_key\)/, 'slot_key is no longer a part — re-read the park');
});

after(async () => {
  await db?.exec('RESET ROLE').catch(() => {});
  await db?.close?.();
});

test('1 · A in cell 1 dragged onto cell 2 holding B → A in 2, B in 1; parked in its own slot; removed_at untouched', async () => {
  await clearBoard();
  const A = await photo('stage', 1, 'A');
  const B = await photo('stage', 2, 'B');

  const w = watched(clientAs(db, W.creator), [A, B]);
  await w.arm();
  const res = await swapMoodboardCells(w.client, W.eventId, { slotKey: 'stage', slotPosition: 1 }, { slotKey: 'stage', slotPosition: 2 });
  assert.deepEqual(res, { ok: true, changed: 'swapped' }, `the swap was refused: ${JSON.stringify(res)}`);
  assert.deepEqual(await board(), { 'stage:1': 'B', 'stage:2': 'A' });
  assert.deepEqual(
    w.steps,
    [
      { [A]: 'stage:3', [B]: 'stage:2' }, // park — the free cell of A's OWN slot
      { [A]: 'stage:3', [B]: 'stage:1' }, // B takes A's cell
      { [A]: 'stage:2', [B]: 'stage:1' }, // A lands
    ],
    'the swap did not park, shift and land in three observed writes',
  );
});

test('2 · across slots, onto the third cell — the same swap between two named slots', async () => {
  await clearBoard();
  const A = await photo('stage', 1, 'A');
  const C = await photo('flowers', 3, 'C');

  const w = watched(clientAs(db, W.creator), [A, C]);
  await w.arm();
  const res = await swapMoodboardCells(w.client, W.eventId, { slotKey: 'stage', slotPosition: 1 }, { slotKey: 'flowers', slotPosition: 3 });
  assert.deepEqual(res, { ok: true, changed: 'swapped' }, `the swap was refused: ${JSON.stringify(res)}`);
  assert.deepEqual(await board(), { 'flowers:3': 'A', 'stage:1': 'C' });
  assert.equal(w.steps.length, 3);
});

test('3 · onto an EMPTY cell → a plain move in one write, the old cell left empty', async () => {
  await clearBoard();
  const A = await photo('stage', 1, 'A');

  const w = watched(clientAs(db, W.creator), [A]);
  await w.arm();
  const res = await swapMoodboardCells(w.client, W.eventId, { slotKey: 'stage', slotPosition: 1 }, { slotKey: 'stage', slotPosition: 3 });
  assert.deepEqual(res, { ok: true, changed: 'moved' });
  assert.deepEqual(await board(), { 'stage:3': 'A' });
  assert.deepEqual(w.steps, [{ [A]: 'stage:3' }], 'a move onto an empty cell parked first');
});

test('4 · the photo’s own slot is full → it parks on another part’s free cell, empty again after', async () => {
  await clearBoard();
  const A = await photo('stage', 1, 'A');
  const B = await photo('stage', 2, 'B');
  await photo('stage', 3, 'X');

  const w = watched(clientAs(db, W.creator), [A, B]);
  await w.arm();
  const res = await swapMoodboardCells(w.client, W.eventId, { slotKey: 'stage', slotPosition: 1 }, { slotKey: 'stage', slotPosition: 2 });
  assert.deepEqual(res, { ok: true, changed: 'swapped' }, `the swap was refused: ${JSON.stringify(res)}`);
  assert.deepEqual(await board(), { 'stage:1': 'B', 'stage:2': 'A', 'stage:3': 'X' }, 'the parking cell was not left empty');
  const parkedAt = w.steps[0]![A]!;
  assert.doesNotMatch(parkedAt, /^stage:/, `A parked inside its full slot: ${parkedAt}`);
  const part = await db.query(`SELECT 1 FROM public.inspiration_parts WHERE slot_key = $1`, [parkedAt.split(':')[0]]);
  assert.equal(part.rows.length, 1, `A parked on a key that is not a part: ${parkedAt}`);
});

test('5 · under PR #7090’s rules the host still swaps; a guest is refused and nothing changes', async () => {
  await clearBoard();
  const A = await photo('stage', 1, 'A');
  const B = await photo('stage', 2, 'B');

  // #7090, verbatim in effect: host-only UPDATE policy + UPDATE on three columns only.
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

    const w = watched(clientAs(db, W.creator), [A, B]);
    await w.arm();
    const host = await swapMoodboardCells(w.client, W.eventId, { slotKey: 'stage', slotPosition: 1 }, { slotKey: 'stage', slotPosition: 2 });
    assert.deepEqual(host, { ok: true, changed: 'swapped' }, `the host’s swap was refused under #7090: ${JSON.stringify(host)}`);
    assert.deepEqual(await board(), { 'stage:1': 'B', 'stage:2': 'A' });
    assert.equal(w.steps.length, 3);
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK');
  }
});

test('6 · the board 100 % full → "Make room first — every cell is full", nothing moved', async () => {
  await clearBoard();
  await setAuthUid(db, null);
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     SELECT $1, $2, p.slot_key, pos, 'url_paste', 'https://media.example/' || p.slot_key || '-' || pos || '.jpg',
            $3, $4, $5, $6, $7, $8
       FROM public.inspiration_parts p CROSS JOIN generate_series(1, 3) AS pos`,
    [W.eventId, W.creator, ...HEX6],
  );
  const full = await board();
  const parts = await db.query(`SELECT 1 FROM public.inspiration_parts`);
  assert.ok(parts.rows.length > 1, 'the replay seeds no parts — the full-board case is vacuous');
  assert.equal(Object.keys(full).length, parts.rows.length * 3, 'the fixture did not fill every cell');

  const res = await swapMoodboardCells(
    clientAs(db, W.creator),
    W.eventId,
    { slotKey: 'stage', slotPosition: 1 },
    { slotKey: 'stage', slotPosition: 2 },
  );
  assert.deepEqual(res, { ok: false, message: SWAP_FULL_MESSAGE });
  assert.deepEqual(await board(), full, 'a refused swap on a full board moved something');
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
            is: () => refused,
            select: () => Promise.resolve({ data: [], error: null }),
          };
          return refused;
        },
      };
    },
  } as unknown as SupabaseClient;
}

test('7 · a write that does not land at any step is undone — the board is exactly as it was', async () => {
  for (const failAt of [1, 2, 3]) {
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

test('8 · a cell the page showed as full but the table holds empty answers "stale", never "done"', async () => {
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
