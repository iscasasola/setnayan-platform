/**
 * The Wedding March's order write, against real SQL.
 *
 * ⚖ Owner 2026-09-23: *"when i move someone, the whole screen refreshes. feels
 * laggy."* One tap of Move ↑ rewrites the whole printed group — by design, so
 * there is no "have we normalised yet" state to get wrong — and it used to do
 * that as one `UPDATE` per person, awaited in a loop: 50 sequential round trips
 * to Singapore for his Principal Sponsors.
 *
 * 🔑 THE ROW COUNT WAS NEVER THE PROBLEM — THE ROUND TRIPS WERE. So these
 * tests are about the one thing that could go wrong in collapsing fifty
 * statements into one: that it still writes EXACTLY what the loop wrote, and
 * nothing it did not.
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

async function seed(n: number, tag: string): Promise<{ eventId: string; ids: string[] }> {
  // 'birthday': see guest-pairing.db.test.ts — nothing here depends on the type.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Order ${tag}`],
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

const orderOf = async (id: string): Promise<number | null> =>
  (
    await db.query<{ entourage_order: number | null }>(
      'SELECT entourage_order FROM public.guests WHERE guest_id = $1',
      [id],
    )
  ).rows[0]?.entourage_order ?? null;

const setOrder = (e: string, ids: string[], orders: number[]) =>
  db.query<{ set_entourage_order: number }>(
    'select public.set_entourage_order($1, $2, $3) as set_entourage_order',
    [e, ids, orders],
  );

test('one call writes the whole group, and reports how many rows it moved', async () => {
  const { eventId, ids } = await seed(4, 'a');
  const r = await setOrder(eventId, ids, [3, 2, 1, 0]);
  assert.equal(r.rows[0]!.set_entourage_order, 4, 'the write did not report its own row count');
  assert.deepEqual(
    await Promise.all(ids.map(orderOf)),
    [3, 2, 1, 0],
    'the group did not land in the order it was given',
  );
});

test('both halves of a pair can share a number — that is how a pair is one line', async () => {
  const { eventId, ids } = await seed(4, 'b');
  const [a, b, c, d] = ids as [string, string, string, string];
  await setOrder(eventId, [a, b, c, d], [0, 0, 1, 1]);
  assert.deepEqual(await Promise.all([orderOf(a), orderOf(b)]), [0, 0]);
  assert.deepEqual(await Promise.all([orderOf(c), orderOf(d)]), [1, 1]);
});

test('it touches nobody outside the list it was handed', async () => {
  const { eventId, ids } = await seed(3, 'c');
  const bystander = ids[2]!;
  await setOrder(eventId, [ids[0]!, ids[1]!], [5, 6]);
  assert.equal(await orderOf(bystander), null, 'a guest nobody named was reordered');
});

test('a guest from another event is not moved, and does not stop the rest', async () => {
  const mine = await seed(2, 'd');
  const theirs = await seed(1, 'e');
  const r = await setOrder(mine.eventId, [mine.ids[0]!, theirs.ids[0]!], [1, 2]);
  assert.equal(r.rows[0]!.set_entourage_order, 1, 'the other event’s guest was counted as written');
  assert.equal(await orderOf(mine.ids[0]!), 1);
  assert.equal(await orderOf(theirs.ids[0]!), null, 'another event’s processional was reordered');
});

test('a soft-deleted guest is not moved', async () => {
  const { eventId, ids } = await seed(2, 'f');
  await db.query('update public.guests set deleted_at = now() where guest_id = $1', [ids[1]]);
  const r = await setOrder(eventId, ids, [0, 1]);
  assert.equal(r.rows[0]!.set_entourage_order, 1);
  assert.equal(await orderOf(ids[1]!), null, 'a removed guest was given a place in the aisle');
});

test('mismatched arrays are refused, not half-applied', async () => {
  const { eventId, ids } = await seed(3, 'g');
  await assert.rejects(
    () => setOrder(eventId, ids, [0, 1]),
    /exactly one position/,
    'a short order list was accepted',
  );
  assert.deepEqual(await Promise.all(ids.map(orderOf)), [null, null, null], 'a refused write still moved rows');
});

test('clear hands the group back to the default, and counts only what it cleared', async () => {
  const { eventId, ids } = await seed(3, 'h');
  await setOrder(eventId, [ids[0]!, ids[1]!], [0, 1]);
  const r = await db.query<{ clear_entourage_order: number }>(
    'select public.clear_entourage_order($1, $2) as clear_entourage_order',
    [eventId, ids],
  );
  // The third never had a number — clearing it is not a change to report.
  assert.equal(r.rows[0]!.clear_entourage_order, 2);
  assert.deepEqual(await Promise.all(ids.map(orderOf)), [null, null, null]);
});

test('⛔ reordering the aisle never touches a chair', async () => {
  // The processional and the seat plan are two orderings on purpose. This is
  // the assertion the whole feature rests on, so it is made against the SQL.
  const { eventId, ids } = await seed(2, 'i');
  const before = await db.query<{ c: string }>(
    'select count(*)::text as c from public.event_seat_assignments where event_id = $1',
    [eventId],
  );
  await setOrder(eventId, ids, [1, 0]);
  const after = await db.query<{ c: string }>(
    'select count(*)::text as c from public.event_seat_assignments where event_id = $1',
    [eventId],
  );
  assert.equal(after.rows[0]!.c, before.rows[0]!.c, 'an order write changed the seat plan');
});

test('anon cannot call either write', async () => {
  const r = await db.query<{ fn: string; anon: boolean; authed: boolean }>(`
    select p.proname as fn,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('set_entourage_order', 'clear_entourage_order')
    order by 1`);
  assert.equal(r.rows.length, 2, 'one of the two order writes is missing');
  for (const row of r.rows) {
    assert.equal(row.anon, false, `${row.fn} is callable by anon`);
    assert.equal(row.authed, true, `${row.fn} is not callable by the couple`);
  }
});
