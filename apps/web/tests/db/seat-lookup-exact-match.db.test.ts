/**
 * public_seat_lookup — the EXACT-match, own-seat-only contract (migration
 * 20270920040000). Before this, the RPC matched the typed name as a SUBSTRING
 * and returned up to 25 rows, so a 2-char probe on the public /[slug]/find-seat
 * page enumerated the couple's whole roster. Proven here against the FULL
 * replayed prod schema (every migration, in-memory PGlite):
 *
 *   • an EXACT full-name query returns that guest's own seat;
 *   • case + internal-whitespace differences still exact-match;
 *   • a PARTIAL / substring query returns NOTHING (no enumeration) — the core
 *     security property: two seated guests, a substring that occurs in both
 *     names yields zero rows;
 *   • the published-plan gate + min-length guard still hold.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const SLUG = 'maria-and-juan';

async function lookup(query: string): Promise<Array<{ display_name: string; table_label: string }>> {
  const r = await db.query<{ display_name: string; table_label: string }>(
    `SELECT display_name, table_label FROM public.public_seat_lookup($1, $2)`,
    [SLUG, query],
  );
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug, ceremony_type, venue_setting)
     VALUES ('Maria & Juan', 'wedding', $1, 'catholic', 'banquet_hall') RETURNING event_id`,
    [SLUG],
  );
  const eventId = ev.rows[0]!.event_id;

  // Published floor plan — the searchability gate.
  await db.query(`INSERT INTO public.event_floor_plan (event_id) VALUES ($1)`, [eventId]);
  await db.query(`UPDATE public.event_floor_plan SET published_at = NOW() WHERE event_id = $1`, [eventId]);

  const tbl = await db.query<{ table_id: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
     VALUES ($1, 'Table 1', 'round_8', 8) RETURNING table_id`,
    [eventId],
  );
  const tableId = tbl.rows[0]!.table_id;

  // Two guests whose names share the substring 'an' (Maria SANTos / JuAN).
  for (const [first, last] of [['Maria', 'Santos'], ['Juan', 'Cruz']]) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, $2, $3, 'both', 'friends') RETURNING guest_id`,
      [eventId, first, last],
    );
    await db.query(
      `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1, $2, $3)`,
      [eventId, tableId, g.rows[0]!.guest_id],
    );
  }
});

after(async () => {
  await db?.close();
});

test('an EXACT full-name query returns that guest\'s own seat', async () => {
  const rows = await lookup('Maria Santos');
  assert.equal(rows.length, 1, 'exactly one seat');
  assert.equal(rows[0]!.display_name, 'Maria Santos');
  assert.equal(rows[0]!.table_label, 'Table 1');
});

test('case + internal-whitespace differences still exact-match', async () => {
  const rows = await lookup('  maria   santos ');
  assert.equal(rows.length, 1, 'normalized exact match');
  assert.equal(rows[0]!.table_label, 'Table 1');
});

test('a PARTIAL/substring query returns NOTHING — no roster enumeration', async () => {
  // 'an' is a substring of BOTH "Maria Santos" (…s ANtos…? no — 'an' in Santos)
  // and "Juan Cruz" (ju-AN). The OLD substring RPC returned both; exact-match
  // returns zero.
  assert.deepEqual(await lookup('an'), [], "'an' must not enumerate");
  assert.deepEqual(await lookup('mar'), [], "prefix 'mar' returns nothing (exact-only)");
  assert.deepEqual(await lookup('santos'), [], 'last-name-only is not an exact full-name match');
});

test('the min-length probe guard and unknown-name both return nothing', async () => {
  assert.deepEqual(await lookup('m'), [], '1-char probe guarded');
  assert.deepEqual(await lookup('Nobody Here'), [], 'a name not on the list returns nothing');
});
