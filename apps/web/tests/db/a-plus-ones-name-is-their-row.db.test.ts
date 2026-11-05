/**
 * 🪑 A GUEST'S +1 NAME IS THEIR +1 ROW — the bringer's one-name copy (`guests.plus_one_name`) follows the rows after
 * ANY write (migration 20271288562348), and the one-time backfill (20271289389441) puts the copies that already
 * disagree back in step, twice-run to the same result. Run against the REPLAYED schema.
 *
 * Owner, verbatim, 2026-10-26 (cale-ice, Juanita Sacdalan): "I deleted that guest and added a new plus 1. It is
 * still there?" — her named +1 was removed and a fresh TBA seat minted, and her row still said `plus_one_name =
 * 'Ggvv Vfh'`.
 *
 * THE PROPERTY: after any write, a bringer's copy = the name of their oldest live NAMED +1 row, or NULL — it never
 * names somebody no live +1 row has. Writers covered by construction (the database does it): the host's Delete /
 * Release / bulk delete (a soft delete), Undo (the restore), a rename, a hard delete, the reply's naming, the count's
 * own placeholder minting and trimming — whoever wrote it.
 *
 * 🛡 SABOTAGED, seen RED, then restored (2026-10-26) — see the PR body for the run.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const BACKFILL = path.join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20271289389441_backfill_stale_plus_one_names.sql');

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';

async function guest(first: string, cols: Record<string, unknown> = {}): Promise<string> {
  const keys = ['event_id', 'first_name', 'last_name', 'side', 'group_category', ...Object.keys(cols)];
  const vals = [EVENT, first, 'Sacdalan', 'bride', 'family', ...Object.values(cols)];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING guest_id`,
    vals,
  );
  return r.rows[0]!.guest_id;
}
/** The bringer's own seat rows, live, oldest first. */
async function seats(bringer: string): Promise<{ guest_id: string; first_name: string }[]> {
  return (
    await db.query<{ guest_id: string; first_name: string }>(
      `SELECT guest_id, first_name FROM public.guests WHERE plus_one_of_guest_id = $1 AND deleted_at IS NULL ORDER BY created_at, guest_id`,
      [bringer],
    )
  ).rows;
}
const copy = async (id: string) =>
  (await db.query<{ n: string | null }>(`SELECT plus_one_name AS n FROM public.guests WHERE guest_id = $1`, [id])).rows[0]!.n;
/** Name a seat the way the host's card and the reply both do: both parts, the stamp, the label cleared. */
const nameSeat = (seat: string, first: string, last: string) =>
  db.query(`UPDATE public.guests SET first_name = $2, last_name = $3, display_name = NULL, plus_one_name_confirmed_at = now() WHERE guest_id = $1`, [seat, first, last]);
const softDelete = (id: string) => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [id]);
const undo = (id: string) => db.query(`UPDATE public.guests SET deleted_at = NULL WHERE guest_id = $1`, [id]);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Cale and Ice', 'birthday', 'cale-and-ice-plus-one-name') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

test('the seat-name twin reads a seat exactly as the app does — stand-in words dropped, an unnamed seat is NULL', async () => {
  const name = async (f: string, l: string, confirmed: boolean) =>
    (await db.query<{ n: string | null }>(`SELECT public.guest_plus_one_seat_name($1, $2, ${confirmed ? 'now()' : 'NULL'}) AS n`, [f, l])).rows[0]!.n;
  assert.equal(await name('TBA', '+1', false), null, 'the seat engine’s placeholder read as a name');
  assert.equal(await name('TBA', '+1', true), null, 'two stand-in words read as a name');
  assert.equal(await name('Bbbbb', '+1', true), 'Bbbbb', 'a first name alone kept its stored "+1"');
  assert.equal(await name('TBA', 'Ccgg', true), 'Ccgg', 'a last name alone kept its stored "TBA"');
  assert.equal(await name('Ggvv', ' Vfh ', true), 'Ggvv Vfh');
});

test('Juanita: the named +1 deleted → the copy is gone, a fresh TBA seat names nobody; Undo → the name is back', async () => {
  const juanita = await guest('Juanita', { plus_one_count: 1, plus_one_allowed: true });
  const [seat] = await seats(juanita);
  assert.ok(seat, 'the count trigger minted no seat');
  assert.equal(await copy(juanita), null, 'a TBA seat wrote a name');

  await nameSeat(seat.guest_id, 'Ggvv', 'Vfh');
  assert.equal(await copy(juanita), 'Ggvv Vfh', 'naming the seat did not reach the copy');

  // The host's Delete on the +1 (a soft delete), then a fresh "+1 · TBA" seat, as the owner did.
  await softDelete(seat.guest_id);
  assert.equal(await copy(juanita), null, 'the deleted +1 is still named on her row');
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category, plus_one_of_guest_id) VALUES ($1, 'TBA', '+1', '+1 · TBA', 'bride', 'family', $2)`,
    [EVENT, juanita],
  );
  assert.equal(await copy(juanita), null, 'the new TBA seat brought a name back');

  // Undo brings the removed +1 back — and with them their name on her row.
  await undo(seat.guest_id);
  assert.equal(await copy(juanita), 'Ggvv Vfh', 'Undo did not restore the copy');
});

test('a rename, a hard delete, and two named +1s — the copy is always the oldest live named one', async () => {
  const marwin = await guest('Marwin', { plus_one_count: 2, plus_one_allowed: true });
  const [a, b] = await seats(marwin);
  await nameSeat(a!.guest_id, 'Shadz', 'Arula');
  await nameSeat(b!.guest_id, 'Ben', 'Lim');
  assert.equal(await copy(marwin), 'Shadz Arula');

  await nameSeat(a!.guest_id, 'Shadia', 'Arula');
  assert.equal(await copy(marwin), 'Shadia Arula', 'a renamed seat left the old name on the copy');

  await softDelete(a!.guest_id);
  assert.equal(await copy(marwin), 'Ben Lim', 'the copy did not move to the +1 who is left');

  await db.query(`DELETE FROM public.guests WHERE guest_id = $1`, [b!.guest_id]);
  assert.equal(await copy(marwin), null, 'a hard-deleted +1 is still named');
});

test('placeholders alone never touch the copy — the count minting and trimming TBA seats leaves an import’s name', async () => {
  const lea = await guest('Lea', { plus_one_count: 2, plus_one_allowed: true, plus_one_name: 'Ana Cruz' });
  assert.equal((await seats(lea)).length, 2);
  assert.equal(await copy(lea), 'Ana Cruz', 'minting two TBA seats wiped the import’s name');
  await db.query(`UPDATE public.guests SET plus_one_count = 1 WHERE guest_id = $1`, [lea]);
  assert.equal((await seats(lea)).length, 1);
  assert.equal(await copy(lea), 'Ana Cruz', 'trimming a TBA seat wiped the import’s name');
});

/* ── the backfill ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The state prod holds: a copy written, then its row changed, with the new triggers switched off. */
async function withoutTheTrigger<T>(fn: () => Promise<T>): Promise<T> {
  const t = ['a_plus_ones_name_is_their_row_ins', 'a_plus_ones_name_is_their_row_upd', 'a_plus_ones_name_is_their_row_del'];
  for (const x of t) await db.query(`ALTER TABLE public.guests DISABLE TRIGGER ${x}`);
  try {
    return await fn();
  } finally {
    for (const x of t) await db.query(`ALTER TABLE public.guests ENABLE TRIGGER ${x}`);
  }
}
const allCopies = async () =>
  (await db.query<{ guest_id: string; n: string | null }>(`SELECT guest_id, plus_one_name AS n FROM public.guests ORDER BY guest_id`)).rows;

test('the backfill fixes every copy no live row has — once; twice is the same; a matching copy and a seatless one are left alone', async () => {
  const { removed, renamed, gone, matching, seatless } = await withoutTheTrigger(async () => {
    // Juanita: her named +1 removed, a TBA seat in its place.
    const removed = await guest('Juanita2', { plus_one_count: 1, plus_one_allowed: true });
    const [r1] = await seats(removed);
    await nameSeat(r1!.guest_id, 'Ggvv', 'Vfh');
    await db.query(`UPDATE public.guests SET plus_one_name = 'Ggvv Vfh' WHERE guest_id = $1`, [removed]);
    await softDelete(r1!.guest_id);
    await db.query(`INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_of_guest_id) VALUES ($1, 'TBA', '+1', 'bride', 'family', $2)`, [EVENT, removed]);
    // A seat renamed after the copy was written.
    const renamed = await guest('Marwin2', { plus_one_count: 1, plus_one_allowed: true, plus_one_name: 'Marwin Baldevia' });
    const [m1] = await seats(renamed);
    await nameSeat(m1!.guest_id, 'Shadz', 'Arula');
    // Their only +1 removed, the guest set to None.
    const gone = await guest('Emmanuel', { plus_one_count: 1, plus_one_allowed: true });
    const [e1] = await seats(gone);
    await nameSeat(e1!.guest_id, 'Emmanuel', 'Santos');
    await db.query(`UPDATE public.guests SET plus_one_name = 'Emmanuel Santos' WHERE guest_id = $1`, [gone]);
    await softDelete(e1!.guest_id);
    // A copy that matches (the reply wrote "Bbbbb" for a seat stored "Bbbbb +1").
    const matching = await guest('Kat', { plus_one_count: 1, plus_one_allowed: true });
    const [k1] = await seats(matching);
    await nameSeat(k1!.guest_id, 'Bbbbb', '+1');
    await db.query(`UPDATE public.guests SET plus_one_name = 'Bbbbb' WHERE guest_id = $1`, [matching]);
    // Never had a +1 row: an import's copy with the +1 set to None.
    const seatless = await guest('Rico', { plus_one_name: 'Ana Cruz' });
    return { removed, renamed, gone, matching, seatless };
  });
  assert.equal(await copy(removed), 'Ggvv Vfh', 'the drift was not staged');

  const sql = fs.readFileSync(BACKFILL, 'utf8');
  await db.exec(sql);
  const once = await allCopies();
  assert.equal(await copy(removed), null, 'Juanita still names her removed +1');
  assert.equal(await copy(renamed), 'Shadz Arula', 'a renamed seat’s bringer kept the old name');
  assert.equal(await copy(gone), null, 'a bringer whose only +1 was removed still names them');
  assert.equal(await copy(matching), 'Bbbbb', 'a copy that matches its seat was touched');
  assert.equal(await copy(seatless), 'Ana Cruz', 'a bringer who never had a seat row was touched');

  await db.exec(sql);
  assert.deepEqual(await allCopies(), once, 'a second run changed something');
});
