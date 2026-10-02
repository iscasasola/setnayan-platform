/**
 * THE WEDDING MARCH IS ITS OWN ENTITY — `march_walks`, against real SQL.
 *
 * ⚖ Owner 2026-10-01, DECISION_LOG "THE WEDDING MARCH IS ITS OWN ENTITY":
 * *"wedding march is a different entity."* One row per person — (event_id,
 * guest_id UNIQUE per event, walk_no, place_in_walk); a walk = the rows sharing
 * a walk_no; FK to guests ON DELETE CASCADE; "guests' own data (+1, partner
 * link, role, side) is untouched by any march edit and vice versa"; existing
 * pairs migrated once.
 *
 * Each test is one way that ruling could be quietly broken:
 *   · a march edit that writes a guest column (the coupling the owner ruled out);
 *   · a deleted guest whose walk row lingers;
 *   · the one-time copy changing the order an invitation already prints;
 *   · a plain invited guest able to rewrite the hosts' march.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test, before, after } from 'node:test';
import { createReplayedDb, MIGRATIONS_DIR, setAuthUid, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];

const MIGRATION = fs
  .readdirSync(MIGRATIONS_DIR)
  .find((f) => f.endsWith('_march_is_its_own_table.sql'))!;

before(async () => {
  db = (await createReplayedDb()).db;
});

after(async () => {
  await db?.close();
});

async function event(tag: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Walks ${tag}`],
  );
  return ev.rows[0]!.event_id;
}

async function guest(
  eventId: string,
  first: string,
  last: string,
  role = 'guest',
  extra: Partial<{ entourage_order: number; plus_one_of: string }> = {},
): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status,
                                entourage_order, plus_one_of_guest_id)
     VALUES ($1, $2, $3, 'both', 'other', $4::guest_role, 'pending', $5, $6) RETURNING guest_id`,
    [eventId, first, last, role, extra.entourage_order ?? null, extra.plus_one_of ?? null],
  );
  return g.rows[0]!.guest_id;
}

const pairOnGuests = async (a: string, b: string) => {
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [b, a]);
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [a, b]);
};

/** The one-time copy, exactly as the migration file says it — section 4 run again. */
async function runTheCopy(): Promise<void> {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8');
  const from = sql.indexOf('WITH role_pos(role, pos) AS (');
  const to = sql.indexOf('ON CONFLICT (event_id, guest_id) DO NOTHING;', from);
  assert.ok(from > 0 && to > from, 'the one-time copy could not be found in the migration');
  await db.exec(sql.slice(from, to + 'ON CONFLICT (event_id, guest_id) DO NOTHING;'.length));
}

async function walks(eventId: string): Promise<Array<{ guest_id: string; walk_no: number; place_in_walk: number }>> {
  const r = await db.query<{ guest_id: string; walk_no: number; place_in_walk: number }>(
    'SELECT guest_id, walk_no, place_in_walk FROM public.march_walks WHERE event_id = $1 ORDER BY walk_no, place_in_walk',
    [eventId],
  );
  return r.rows;
}

/** Every column of every guest row of an event, as text — to prove nothing moved. */
async function guestSnapshot(eventId: string): Promise<string> {
  const r = await db.query<{ j: string }>(
    `SELECT coalesce(json_agg(to_jsonb(g) - 'updated_at' ORDER BY g.guest_id)::text, '[]') AS j
       FROM public.guests g WHERE g.event_id = $1`,
    [eventId],
  );
  return r.rows[0]!.j;
}

test('the one-time copy: a mutual pair is one walk of two, everyone else a walk of one, in the printed order', async () => {
  const e = await event('copy');
  // Principal Sponsors, never hand-placed: the invitation printed the lines by
  // role (Ninong-led first), then surname — Bautista · Zamora & Abad · Cruz.
  const zamora = await guest(e, 'Ramon', 'Zamora', 'principal_sponsor_ninong');
  const abad = await guest(e, 'Lita', 'Abad', 'principal_sponsor_ninang');
  const cruz = await guest(e, 'Ana', 'Cruz', 'principal_sponsor_ninang');
  const bautista = await guest(e, 'Eduardo', 'Bautista', 'principal_sponsor_ninong');
  await pairOnGuests(zamora, abad);
  // A hand-placed flower girl leads every unplaced line.
  const flower = await guest(e, 'Mia', 'Yap', 'flower_girl', { entourage_order: 0 });
  // A plain guest is not in the march; a dangling one-way pointer is not a pair.
  const plain = await guest(e, 'Juan', 'Dela Cruz');
  await db.query('update public.guests set pair_with_guest_id = $1 where guest_id = $2', [cruz, plain]);

  await runTheCopy();
  const rows = await walks(e);
  const byId = new Map(rows.map((r) => [r.guest_id, r]));

  assert.equal(byId.has(plain), false, 'a plain guest (and a one-way pointer) was copied into the march');
  assert.equal(byId.get(zamora)!.walk_no, byId.get(abad)!.walk_no, 'a mutual pair was not copied as one walk');
  assert.equal(byId.get(zamora)!.place_in_walk, 0, 'the Ninong is not the walk’s lead (left column)');
  assert.equal(byId.get(abad)!.place_in_walk, 1);
  const order = [flower, bautista, zamora, cruz].map((id) => byId.get(id)!.walk_no);
  assert.deepEqual([...order].sort((x, y) => x - y), order, `the copy changed the printed order: ${order}`);
  assert.equal(new Set(rows.map((r) => r.walk_no)).size, 4, 'two lines were copied into one walk');
});

test('the one-time copy runs once: an event that already has a march is never re-copied', async () => {
  const e = await event('once');
  const a = await guest(e, 'A', 'One', 'bridesmaid');
  const b = await guest(e, 'B', 'Two', 'groomsman');
  await runTheCopy();
  const first = await walks(e);
  await pairOnGuests(a, b); // a stale guest-row pair written after the march exists
  await runTheCopy();
  assert.deepEqual(await walks(e), first, 'a second copy rewrote a march the hosts may have arranged');
});

test('⛔ a march edit changes NO guests column — join, swap, order, unpair', async () => {
  const e = await event('pure');
  const ids = [
    await guest(e, 'A', 'Alpha', 'bridesmaid'),
    await guest(e, 'B', 'Bravo', 'groomsman'),
    await guest(e, 'C', 'Charlie', 'bridesmaid'),
    await guest(e, 'D', 'Delta', 'groomsman'),
  ];
  // A +1 is guest data — the march must not read or write it.
  await guest(e, 'P', 'Plus', 'guest', { plus_one_of: ids[0] });
  await runTheCopy();
  const before = await guestSnapshot(e);

  await db.query('select public.set_entourage_order($1, $2, $3)', [e, ids, [0, 1, 2, 3]]);
  await db.query('select public.join_entourage_line($1, $2, $3)', [e, ids[0], ids[1]]);
  await db.query('select public.swap_entourage_places($1, $2, $3)', [e, ids[1], ids[3]]);
  await db.query('select public.unpair_guest($1, $2)', [e, ids[0]]);

  assert.equal(await guestSnapshot(e), before, 'a march edit wrote a guest row');
});

test('⛔ a guest edit never writes the march', async () => {
  const e = await event('other-way');
  const a = await guest(e, 'A', 'Alpha', 'bridesmaid');
  const b = await guest(e, 'B', 'Bravo', 'groomsman');
  await runTheCopy();
  const before = await walks(e);
  await db.query(
    `update public.guests set plus_one_of_guest_id = $1, couple_with_guest_id = $1, side = 'groom', role = 'groomsman'
      where guest_id = $2`,
    [a, b],
  );
  assert.deepEqual(await walks(e), before, 'editing a guest moved the march');
});

test('deleting a guest takes their walk row with them; their walk-mate keeps walking', async () => {
  const e = await event('cascade');
  const a = await guest(e, 'A', 'Alpha', 'bridesmaid');
  const b = await guest(e, 'B', 'Bravo', 'groomsman');
  await runTheCopy();
  await db.query('select public.join_entourage_line($1, $2, $3)', [e, a, b]);
  await db.query('delete from public.guests where guest_id = $1', [b]);
  const rows = await walks(e);
  assert.deepEqual(rows.map((r) => r.guest_id), [a], 'the deleted guest’s walk row survived, or took the partner');
});

test('a walk row cannot name a guest of another event', async () => {
  const one = await event('fk-1');
  const two = await event('fk-2');
  const theirs = await guest(two, 'X', 'Other', 'bridesmaid');
  await assert.rejects(
    () =>
      db.query('insert into public.march_walks (event_id, guest_id, walk_no) values ($1, $2, 0)', [one, theirs]),
    /march_walks_guest_fkey/,
  );
});

test('RLS: the hosts read and write the march; a plain invited guest and anon do not', async () => {
  const e = await event('rls');
  const a = await guest(e, 'A', 'Alpha', 'bridesmaid');
  const b = await guest(e, 'B', 'Bravo', 'groomsman');
  await runTheCopy();

  const user = async (email: string, memberType: 'couple' | 'guest'): Promise<string> => {
    const u = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, '{}'::jsonb) RETURNING id`,
      [email],
    );
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`,
      [e, u.rows[0]!.id, memberType],
    );
    return u.rows[0]!.id;
  };
  const host = await user('host-walks@example.com', 'couple');
  const invited = await user('guest-walks@example.com', 'guest');

  const as = async <T>(uid: string | null, role: 'authenticated' | 'anon', run: () => Promise<T>): Promise<T> => {
    await setAuthUid(db, uid);
    await db.exec(`SET ROLE ${role}`);
    try {
      return await run();
    } finally {
      await db.exec('RESET ROLE');
      await setAuthUid(db, null);
    }
  };
  const visible = () =>
    db.query<{ n: number }>('select count(*)::int as n from public.march_walks where event_id = $1', [e]);

  assert.equal((await as(host, 'authenticated', visible)).rows[0]!.n, 2, 'the host cannot read their own march');
  await as(host, 'authenticated', () => db.query('select public.join_entourage_line($1, $2, $3)', [e, a, b]));

  assert.equal((await as(invited, 'authenticated', visible)).rows[0]!.n, 0, 'an invited guest can read the march table');
  // A move called by an invited guest sees no row of the march and changes nothing.
  const arranged = await walks(e);
  await as(invited, 'authenticated', () => db.query('select public.unpair_guest($1, $2)', [e, a]));
  assert.deepEqual(await walks(e), arranged, 'an invited guest changed the hosts’ march');
  await assert.rejects(
    () =>
      as(invited, 'authenticated', () =>
        db.query('insert into public.march_walks (event_id, guest_id, walk_no) values ($1, $2, 9)', [e, a]),
      ),
    /row-level security|duplicate key|permission denied/,
  );
  await assert.rejects(
    () => as(null, 'anon', visible),
    /permission denied/,
    'anon can read the march table',
  );
});
