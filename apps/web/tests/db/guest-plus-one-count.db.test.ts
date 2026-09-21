/**
 * ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4 … for the additional
 * seats." The count and the old boolean are ONE fact in two columns; these are
 * the ways a writer could make them disagree.
 */
import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];
let eventId: string;

before(async () => {
  db = (await createReplayedDb()).db;
  // 'birthday': see guest-pairing.db.test.ts — nothing here depends on the type.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Plus', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

async function add(cols: Record<string, unknown> = {}): Promise<string> {
  const keys = ['event_id', 'first_name', 'last_name', 'side', 'group_category', 'role', 'rsvp_status', ...Object.keys(cols)];
  const vals = [eventId, 'G', 'Test', 'both', 'other', 'guest', 'pending', ...Object.values(cols)];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING guest_id`,
    vals,
  );
  return r.rows[0]!.guest_id;
}
async function state(id: string) {
  const r = await db.query<{ plus_one_count: number; plus_one_allowed: boolean }>(
    'SELECT plus_one_count, plus_one_allowed FROM public.guests WHERE guest_id = $1',
    [id],
  );
  return r.rows[0]!;
}

test('a new guest has no extra seats', async () => {
  assert.deepEqual(await state(await add()), { plus_one_count: 0, plus_one_allowed: false });
});

test('a legacy writer that sets only the boolean gets one seat', async () => {
  assert.deepEqual(await state(await add({ plus_one_allowed: true })), { plus_one_count: 1, plus_one_allowed: true });
});

test('a count sets the boolean — on insert and on update', async () => {
  const id = await add({ plus_one_count: 3 });
  assert.deepEqual(await state(id), { plus_one_count: 3, plus_one_allowed: true });
  await db.query('UPDATE public.guests SET plus_one_count = 0 WHERE guest_id = $1', [id]);
  assert.deepEqual(await state(id), { plus_one_count: 0, plus_one_allowed: false });
  await db.query('UPDATE public.guests SET plus_one_count = 4 WHERE guest_id = $1', [id]);
  assert.deepEqual(await state(id), { plus_one_count: 4, plus_one_allowed: true });
});

test('turning the boolean off clears the seats; on again never shrinks a +3', async () => {
  const id = await add({ plus_one_count: 3 });
  // Unrelated edit: nothing moves.
  await db.query(`UPDATE public.guests SET first_name = 'H' WHERE guest_id = $1`, [id]);
  assert.deepEqual(await state(id), { plus_one_count: 3, plus_one_allowed: true });
  // "On" when already on — a legacy form re-saving its checkbox — keeps +3.
  await db.query('UPDATE public.guests SET plus_one_allowed = true WHERE guest_id = $1', [id]);
  assert.equal((await state(id)).plus_one_count, 3);
  await db.query('UPDATE public.guests SET plus_one_allowed = false WHERE guest_id = $1', [id]);
  assert.deepEqual(await state(id), { plus_one_count: 0, plus_one_allowed: false });
  await db.query('UPDATE public.guests SET plus_one_allowed = true WHERE guest_id = $1', [id]);
  assert.deepEqual(await state(id), { plus_one_count: 1, plus_one_allowed: true });
});

test('more than four, or fewer than none, is refused', async () => {
  await assert.rejects(() => add({ plus_one_count: 5 }), /guests_plus_one_count_range/);
  await assert.rejects(() => add({ plus_one_count: -1 }), /guests_plus_one_count_range/);
});

test('a seat row of exactly the shape syncExtraSeats inserts is accepted, and linked', async () => {
  // ⚖ "+ will have seats beside the person invited". If a constraint refused
  // this shape, every +N would fail at the seat step in production.
  const host = await add({ plus_one_count: 2 });
  for (const n of [1, 2]) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category, role, rsvp_status, photo_consent, plus_one_of_guest_id, plus_one_mode)
       VALUES ($1, 'TBA', '+1', $2, 'both', 'other', 'guest', 'pending', true, $3, 'limited')`,
      [eventId, `+ TBA ${n} · brought by G`, host],
    );
  }
  const r = await db.query<{ n: number; allowed: boolean }>(
    `SELECT count(*)::int AS n, bool_or(plus_one_allowed) AS allowed FROM public.guests WHERE plus_one_of_guest_id = $1`,
    [host],
  );
  assert.equal(r.rows[0]!.n, 2);
  assert.equal(r.rows[0]!.allowed, false, 'a seat row must not itself be allowed a plus-one');
});
