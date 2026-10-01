/**
 * The Wedding March's two moves, against real SQL.
 *
 * ⚖ Owner 2026-09-21: tap/drag a name onto an empty place to pair them; drag a
 * name onto another name to swap. Each is ONE function so a move can never be
 * half-done — these tests are the ways a half-done move would show.
 *
 * ⚖ Owner 2026-10-01 ("THE WEDDING MARCH IS ITS OWN ENTITY"): both moves write
 * `march_walks` — one row per person, a walk = the rows sharing a walk_no, order
 * = walk_no — and never a guest row.
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

/** An event + N guests, each placed alone in walk i (as the copy or a first move would). */
async function seed(n: number, tag: string): Promise<{ eventId: string; ids: string[] }> {
  // 'birthday': see guest-pairing.db.test.ts — nothing here depends on the type.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`March ${tag}`],
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
    await place(eventId, g.rows[0]!.guest_id, i, 0);
  }
  return { eventId, ids };
}

const place = (e: string, g: string, walk: number, at: number) =>
  db.query(
    `INSERT INTO public.march_walks (event_id, guest_id, walk_no, place_in_walk) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, guest_id) DO UPDATE SET walk_no = EXCLUDED.walk_no, place_in_walk = EXCLUDED.place_in_walk`,
    [e, g, walk, at],
  );

async function walkOf(id: string): Promise<number | null> {
  const r = await db.query<{ walk_no: number }>('SELECT walk_no FROM public.march_walks WHERE guest_id = $1', [id]);
  return r.rows[0]?.walk_no ?? null;
}

test('join: the joiner walks in the anchor’s walk — the anchor’s place in the march', async () => {
  const { eventId, ids } = await seed(2, 'j');
  const [anchor, joiner] = ids as [string, string];
  await db.query('select public.join_entourage_line($1, $2, $3)', [eventId, anchor, joiner]);
  assert.equal(await walkOf(anchor), 0);
  assert.equal(await walkOf(joiner), 0, 'the new pair split across two walks');
});

test('join: the joiner’s old walk-mate keeps their own walk, walking alone', async () => {
  const { eventId, ids } = await seed(3, 'k');
  const [anchor, joiner, left] = ids as [string, string, string];
  await place(eventId, left, 1, 1); // joiner (walk 1) walks with `left`
  await db.query('select public.join_entourage_line($1, $2, $3)', [eventId, anchor, joiner]);
  assert.equal(await walkOf(left), 1, 'the one left behind moved');
  assert.equal(await walkOf(joiner), 0);
});

test('join: whoever walked with the anchor steps out RIGHT BEHIND, not to the end', async () => {
  const { eventId, ids } = await seed(4, 'l');
  const [anchor, joiner, mate, last] = ids as [string, string, string, string];
  await place(eventId, mate, 0, 1); // walk 0 = anchor + mate · walk 1 = joiner · walk 3 = last
  await db.query('select public.join_entourage_line($1, $2, $3)', [eventId, anchor, joiner]);
  assert.equal(await walkOf(anchor), 0);
  assert.equal(await walkOf(joiner), 0);
  assert.equal(await walkOf(mate), 1, 'the anchor’s old walk-mate did not land right behind');
  assert.ok((await walkOf(last))! > 1, 'a later walk was overtaken');
});

test('swap: two walkers trade places — each walk keeps its spot and its other half', async () => {
  const { eventId, ids } = await seed(4, 's');
  const [a, pa, b, pb] = ids as [string, string, string, string];
  await place(eventId, a, 7, 0);
  await place(eventId, pa, 7, 1);
  await place(eventId, b, 9, 0);
  await place(eventId, pb, 9, 1);

  await db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, a, b]);

  assert.equal(await walkOf(a), 9);
  assert.equal(await walkOf(pb), 9);
  assert.equal(await walkOf(b), 7);
  assert.equal(await walkOf(pa), 7);
});

test('swap: a single and a walker trade — the walk-mate changes hands, nobody is lost', async () => {
  const { eventId, ids } = await seed(3, 't');
  const [single, b, pb] = ids as [string, string, string];
  await place(eventId, b, 5, 0);
  await place(eventId, pb, 5, 1);
  await db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, single, b]);
  assert.equal(await walkOf(single), 5);
  assert.equal(await walkOf(pb), 5);
  assert.equal(await walkOf(b), 0, 'b should now stand alone where the single stood');
});

test('swap: two people in the same walk are refused, not scrambled', async () => {
  const { eventId, ids } = await seed(2, 'u');
  await place(eventId, ids[1]!, 0, 1);
  await assert.rejects(
    () => db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, ids[0], ids[1]]),
    /already walk together/,
  );
  assert.equal(await walkOf(ids[1]!), 0, 'a refused swap still changed the walk');
});

test('both moves refuse a guest from another event', async () => {
  const one = await seed(1, 'v');
  const two = await seed(1, 'w');
  await assert.rejects(
    () => db.query('select public.swap_entourage_places($1, $2, $3)', [one.eventId, one.ids[0], two.ids[0]]),
    /belong to this event/,
  );
  await assert.rejects(
    () => db.query('select public.join_entourage_line($1, $2, $3)', [one.eventId, one.ids[0], two.ids[0]]),
    /belong to this event/,
  );
});

test('unpair: the person steps out right behind; their walk-mate keeps the walk', async () => {
  const { eventId, ids } = await seed(3, 'x');
  const [a, b, c] = ids as [string, string, string];
  await place(eventId, b, 0, 1); // walk 0 = a + b · c at walk 2
  await db.query('select public.unpair_guest($1, $2)', [eventId, a]);
  assert.equal(await walkOf(b), 0);
  assert.equal(await walkOf(a), 1);
  assert.equal(await walkOf(c), 3);
});

test('anon cannot call any move', async () => {
  const r = await db.query<{ fn: string; anon: boolean; authed: boolean }>(`
    select p.proname as fn,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('join_entourage_line', 'swap_entourage_places', 'unpair_guest')
    order by 1`);
  assert.equal(r.rows.length, 3);
  for (const row of r.rows) {
    assert.equal(row.anon, false, `${row.fn} is callable by anon`);
    assert.equal(row.authed, true, `${row.fn} is not callable by the couple`);
  }
});
