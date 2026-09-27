/**
 * 🕯 A GUEST WHO PASSED AWAY IS LISTED, NEVER COUNTED — the SQL half (owner,
 * 2026-09-25; migration 20271249859363). Against the replayed migrations:
 *
 *   · `guests.passed_away` exists, is NOT NULL, and every row reads `false`
 *     until the couple ticks it — nobody is marked by the migration;
 *   · the Papic pool's per-guest divisor (`papic_event_guest_headcount`)
 *     leaves them out — behavioural — and counts them again when un-ticked;
 *   · the caterer's, the supplier brief's and the seat plan's readers, as the
 *     database actually holds them after EVERY migration (`pg_get_functiondef`),
 *     carry the rule on every read of `public.guests` — so a later migration that
 *     re-copies one of those bodies from an older file and drops it goes red.
 *
 * The request rule (tests/db/a-request-counts-for-nothing.db.test.ts) is
 * asserted by its own file; this one asserts only that the two rules coexist.
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
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Remembered', 'birthday', '2027-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  // No `passed_away` named: the insert every existing writer makes.
  const add = (first: string, rsvp: string) =>
    db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
       VALUES ($1, $2, 'Cruz', 'both', 'friends', $3)`,
      [eventId, first, rsvp],
    );
  await add('Ana', 'attending');
  await add('Ben', 'pending');
  await add('Lola', 'attending');
});
after(async () => {
  await db?.close();
});

const headcount = async () =>
  (await db.query<{ n: number }>(`SELECT public.papic_event_guest_headcount($1) AS n`, [eventId])).rows[0]!.n;

test('the column exists, is NOT NULL, and nobody is marked by the migration', async () => {
  const col = (
    await db.query<{ is_nullable: string; column_default: string | null }>(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'passed_away'`,
    )
  ).rows[0];
  assert.ok(col, 'guests.passed_away is missing');
  assert.equal(col.is_nullable, 'NO');
  const marked = (
    await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guests WHERE event_id = $1 AND passed_away`, [eventId])
  ).rows[0]!.n;
  assert.equal(marked, 0, 'an insert that never named the column marked somebody');
});

test('the Papic pool divides by the living — and counts them again when un-ticked', async () => {
  assert.equal(await headcount(), 3);
  await db.query(`UPDATE public.guests SET passed_away = TRUE WHERE first_name = 'Lola' AND event_id = $1`, [eventId]);
  assert.equal(await headcount(), 2, 'a guest who passed away is in the pool’s per-guest divisor');
  await db.query(`UPDATE public.guests SET passed_away = FALSE WHERE first_name = 'Lola' AND event_id = $1`, [eventId]);
  assert.equal(await headcount(), 3);
});

test('every guest read in the caterer / brief / seat-plan / pool functions carries BOTH rules, as the DB holds them', async () => {
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
    const ruled = (def.match(/\b(g2?)\.entry_source <> 'self_added_unlisted' AND NOT \1\.passed_away\b/g) ?? []).length;
    assert.ok(reads > 0, `${fn} reads no guests — re-point this test`);
    assert.equal(ruled, reads, `${fn}: ${ruled} of ${reads} guest reads leave a guest who passed away out`);
  }
});
