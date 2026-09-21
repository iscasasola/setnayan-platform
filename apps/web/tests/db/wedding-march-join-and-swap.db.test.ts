/**
 * The Wedding March's two moves, against real SQL.
 *
 * ⚖ Owner 2026-09-21: tap/drag a name onto an empty place to pair them; drag a
 * name onto another name to swap. Each is ONE function so a move can never be
 * half-done — these tests are the ways a half-done move would show.
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
    [`March ${tag}`],
  );
  const eventId = ev.rows[0]!.event_id;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, entourage_order)
       VALUES ($1, $2, 'Test', 'both', 'other', 'guest', 'pending', $3) RETURNING guest_id`,
      [eventId, `${tag}${i}`, i],
    );
    ids.push(g.rows[0]!.guest_id);
  }
  return { eventId, ids };
}

async function state(id: string): Promise<{ partner: string | null; order: number | null }> {
  const r = await db.query<{ pair_with_guest_id: string | null; entourage_order: number | null }>(
    'SELECT pair_with_guest_id, entourage_order FROM public.guests WHERE guest_id = $1',
    [id],
  );
  return { partner: r.rows[0]?.pair_with_guest_id ?? null, order: r.rows[0]?.entourage_order ?? null };
}

const pair = (e: string, a: string, b: string) => db.query('select public.pair_guests($1, $2, $3)', [e, a, b]);

test('join: the joiner walks with the anchor AND stands on the anchor’s line', async () => {
  const { eventId, ids } = await seed(2, 'j');
  const [anchor, joiner] = ids as [string, string];
  await db.query('select public.join_entourage_line($1, $2, $3)', [eventId, anchor, joiner]);
  assert.deepEqual(await state(anchor), { partner: joiner, order: 0 });
  assert.deepEqual(await state(joiner), { partner: anchor, order: 0 }, 'the new pair split across two lines');
});

test('join: the joiner’s old partner keeps their own line, walking alone', async () => {
  const { eventId, ids } = await seed(3, 'k');
  const [anchor, joiner, left] = ids as [string, string, string];
  await pair(eventId, joiner, left);
  await db.query('update public.guests set entourage_order = 1 where guest_id = $1', [left]);
  await db.query('select public.join_entourage_line($1, $2, $3)', [eventId, anchor, joiner]);
  assert.deepEqual(await state(left), { partner: null, order: 1 }, 'the one left behind still points at the joiner, or moved');
});

test('swap: two pairs trade names — each line keeps its place and its other half', async () => {
  const { eventId, ids } = await seed(4, 's');
  const [a, pa, b, pb] = ids as [string, string, string, string];
  await pair(eventId, a, pa);
  await pair(eventId, b, pb);
  // Line 1 = {a, pa} at 7; line 2 = {b, pb} at 9.
  await db.query('update public.guests set entourage_order = 7 where guest_id in ($1, $2)', [a, pa]);
  await db.query('update public.guests set entourage_order = 9 where guest_id in ($1, $2)', [b, pb]);

  await db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, a, b]);

  assert.deepEqual(await state(a), { partner: pb, order: 9 });
  assert.deepEqual(await state(pb), { partner: a, order: 9 });
  assert.deepEqual(await state(b), { partner: pa, order: 7 });
  assert.deepEqual(await state(pa), { partner: b, order: 7 });
});

test('swap: a single and a paired name trade — the partner changes hands, nobody is lost', async () => {
  const { eventId, ids } = await seed(3, 't');
  const [single, b, pb] = ids as [string, string, string];
  await pair(eventId, b, pb);
  await db.query('update public.guests set entourage_order = 5 where guest_id in ($1, $2)', [b, pb]);
  await db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, single, b]);
  assert.deepEqual(await state(single), { partner: pb, order: 5 });
  assert.deepEqual(await state(pb), { partner: single, order: 5 });
  assert.deepEqual(await state(b), { partner: null, order: 0 }, 'b should now stand alone where the single stood');
});

test('swap: two people on the same line are refused, not scrambled', async () => {
  const { eventId, ids } = await seed(2, 'u');
  await pair(eventId, ids[0]!, ids[1]!);
  await assert.rejects(
    () => db.query('select public.swap_entourage_places($1, $2, $3)', [eventId, ids[0], ids[1]]),
    /already walk together/,
  );
  assert.equal((await state(ids[0]!)).partner, ids[1], 'a refused swap still changed the pair');
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

test('anon cannot call either move', async () => {
  const r = await db.query<{ fn: string; anon: boolean; authed: boolean }>(`
    select p.proname as fn,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('join_entourage_line', 'swap_entourage_places')
    order by 1`);
  assert.equal(r.rows.length, 2);
  for (const row of r.rows) {
    assert.equal(row.anon, false, `${row.fn} is callable by anon`);
    assert.equal(row.authed, true, `${row.fn} is not callable by the couple`);
  }
});
