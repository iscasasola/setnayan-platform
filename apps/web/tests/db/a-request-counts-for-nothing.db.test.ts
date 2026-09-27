/**
 * 🛂 A REQUEST COUNTS FOR NOTHING UNTIL KEEP OR LINK — the SQL half
 * (owner, 2026-09-27: "no. only count when accepted."; migration
 * 20271249183421). Against the replayed migrations:
 *
 *   · the Papic pool's per-guest divisor (`papic_event_guest_headcount`) counts
 *     the couple's guests and not the requests — behavioural;
 *   · the caterer's, the supplier brief's and the seat plan's readers, as the
 *     database actually holds them after every migration (`pg_get_functiondef`),
 *     carry the rule on every read of `public.guests` — so a LATER migration that
 *     re-copies one of those bodies from an older file and drops the rule goes red.
 *   · Keep (entry_source → host_seeded) makes the row count again.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Counts', 'birthday', '2027-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  const add = (first: string, rsvp: string, source: string) =>
    db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, entry_source)
       VALUES ($1, $2, 'X', 'both', 'friends', $3, $4)`,
      [eventId, first, rsvp, source],
    );
  await add('Ana', 'attending', 'host_seeded');
  await add('Ben', 'pending', 'host_seeded');
  await add('Req1', 'attending', 'self_added_unlisted');
  await add('Req2', 'pending', 'self_added_unlisted');
});
after(async () => {
  await db?.close();
});

const headcount = async () =>
  (await db.query<{ n: number }>(`SELECT public.papic_event_guest_headcount($1) AS n`, [eventId])).rows[0]!.n;

test('the Papic pool divides by the couple’s guests, not by requests', async () => {
  assert.equal(await headcount(), 2, 'a request is in the pool’s per-guest divisor');
});

test('Keep makes the row count again', async () => {
  await db.query(`UPDATE public.guests SET entry_source = 'host_seeded' WHERE first_name = 'Req1' AND event_id = $1`, [eventId]);
  assert.equal(await headcount(), 3);
  await db.query(`UPDATE public.guests SET entry_source = 'self_added_unlisted' WHERE first_name = 'Req1' AND event_id = $1`, [eventId]);
});

test('every guest read in the caterer / brief / seat-plan / pool functions carries the rule, as the DB holds them', async () => {
  for (const fn of ['get_vendor_catering_metrics', 'get_vendor_event_brief', 'get_vendor_seat_plan', 'papic_event_guest_headcount']) {
    const def = (
      await db.query<{ d: string }>(
        `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn],
      )
    ).rows[0]?.d;
    assert.ok(def, `${fn} is missing`);
    const reads = (def.match(/public\.guests\b/g) ?? []).length;
    const ruled = (def.match(/\bg2?\.entry_source <> 'self_added_unlisted'/g) ?? []).length;
    assert.ok(reads > 0, `${fn} reads no guests — re-point this test`);
    assert.equal(ruled, reads, `${fn}: ${ruled} of ${reads} guest reads leave requests out`);
  }
});
