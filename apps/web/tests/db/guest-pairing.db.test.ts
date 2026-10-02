/**
 * `guests.pair_with_guest_id` — RETIRED for the Wedding March on 2026-10-01
 * (DECISION_LOG "THE WEDDING MARCH IS ITS OWN ENTITY"; the march is
 * `march_walks` now, tested in march-is-its-own-table.db.test.ts). The column
 * and its row constraints stay until it is dropped, so they are still held
 * here; the functions that wrote it are gone and that is held here too.
 *
 * Every test below is a way a pair can go wrong that nothing else would catch:
 * a half-formed pair, a partner stolen by a third guest, an unpair that clears
 * one side, a pair across two events.
 */
import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];

before(async () => {
  db = (await createReplayedDb()).db;
});

after(async () => {
  await db?.close();
});

/** Insert an event + N guests, returning their ids. */
async function seed(n: number, tag: string): Promise<{ eventId: string; ids: string[] }> {
  const ev = await db.query<{ event_id: string }>(
    // 'birthday', not 'wedding': a wedding row must satisfy
    // events_wedding_fields_consistency, and NOTHING about pairing depends on
    // the event type — the DB validates `role` against the enum, never against
    // the event's role set. Same shortcut every other db test here takes.
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [`Pairing ${tag}`],
  );
  const eventId = ev.rows[0]!.event_id;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status)
       VALUES ($1, $2, 'Test', 'both', 'other', 'guest', 'pending') RETURNING guest_id`,
      [eventId, `${tag}${i}`],
    );
    ids.push(g.rows[0]!.guest_id);
  }
  return { eventId, ids };
}

async function partnerOf(id: string): Promise<string | null> {
  const r = await db.query<{ pair_with_guest_id: string | null }>(
    'SELECT pair_with_guest_id FROM public.guests WHERE guest_id = $1',
    [id],
  );
  return r.rows[0]?.pair_with_guest_id ?? null;
}

test('⚖ 2026-10-01 · nothing writes pairs on the guest row any more — pair_guests is gone', async () => {
  // DECISION_LOG "THE WEDDING MARCH IS ITS OWN ENTITY": who walks with whom
  // lives in march_walks (tests/db/march-is-its-own-table.db.test.ts). The
  // column and its constraints stay (below) until it is dropped.
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'pair_guests'`,
  );
  assert.equal(r.rows[0]!.n, 0, 'pair_guests still exists — a second writer of the march');
});

test('unpair_guest no longer touches the guest row', async () => {
  const { eventId, ids } = await seed(2, 'b');
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [ids[1], ids[0]]);
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [ids[0], ids[1]]);
  await db.query('select public.unpair_guest($1, $2)', [eventId, ids[0]]);
  assert.equal(await partnerOf(ids[0] as string), ids[1], 'a march edit wrote guests.pair_with_guest_id');
});

test('the CHECK refuses a self-pair written directly', async () => {
  // The function guards it, but so must the table — a direct UPDATE from any
  // other code path must not be able to create one.
  const { ids } = await seed(1, 'f');
  await assert.rejects(
    () =>
      db.query('update public.guests set pair_with_guest_id = guest_id where guest_id = $1', [
        ids[0],
      ]),
    /guests_no_self_pair/,
  );
});

test('two guests cannot both claim the same partner', async () => {
  // Without the partial UNIQUE, A→C and B→C both "succeed" and C silently has
  // two partners — a pair that is exclusive in the UI and not in the data.
  const { ids } = await seed(3, 'g');
  const [a, b, c] = ids as [string, string, string];
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [c, a]);
  await assert.rejects(
    () =>
      db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [c, b]),
    /guests_pair_partner_unique/,
  );
});

test('deleting a paired guest UNPAIRS their partner rather than being refused', async () => {
  // The FK is ON DELETE SET NULL on a single column deliberately: a composite
  // (event_id, pair_with_guest_id) FK would try to null the NOT NULL event_id
  // and the delete would be REFUSED instead — a SET NULL behaving like
  // RESTRICT. This asserts the delete really does go through.
  const { ids } = await seed(2, 'j');
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [ids[1], ids[0]]);
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [ids[0], ids[1]]);
  await db.query('delete from public.guests where guest_id = $1', [ids[0]]);
  assert.equal(await partnerOf(ids[1] as string), null);
});

test('the two new principal-sponsor roles are real enum values', async () => {
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'guest_role'
        and e.enumlabel in ('principal_sponsor_ninong','principal_sponsor_ninang')`,
  );
  assert.equal(r.rows[0]!.n, 2);
});

test('the legacy principal_sponsor value still exists and is still usable', async () => {
  // ⚠ READ THIS BEFORE "TIDYING" IT AWAY — the earlier note here said "47 live
  // rows hold it", and that is no longer true: the owner RETIRED the role on
  // 2026-09-15 and 0 live rows hold it now.
  //
  // The test stays because a PRODUCT retirement and a DATABASE capability are
  // not the same claim. Postgres has no `ALTER TYPE … DROP VALUE`, so the value
  // outlives the ruling, and every reader of a guest — seating tiers, the
  // roster's grouping, the emcee script — must still survive meeting one. With
  // no live row holding it, NOTHING ON SCREEN would reveal a reader that had
  // quietly stopped understanding it. This assertion is the only witness.
  //
  // The matching product-side guard (it must never be OFFERED again) lives in
  // lib/role-sets.test.ts and lib/bulk-role-vocabulary.test.ts.
  const { eventId } = await seed(0, 'k');
  await db.query(
    `insert into public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status)
     values ($1, 'Legacy', 'Sponsor', 'both', 'other', 'principal_sponsor', 'pending')`,
    [eventId],
  );
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from public.guests
      where event_id = $1 and role = 'principal_sponsor'`,
    [eventId],
  );
  assert.equal(r.rows[0]!.n, 1);
});
