/**
 * THE COUPLE'S OWN MARCH GROUPS — `march_groups` + `march_walks.march_group` + `set_march_group`, against real SQL.
 *
 * ⚖ Owner 2026-10-29: *"yes. so if they have a custom way of marching they can customize it."* Each test is one way it
 * could be quietly broken:
 *   · a walker moved into a group dragging their walk-mate along (a walk must never span two groups);
 *   · a move into a group that does not exist, or of someone "Not walking", answered as done;
 *   · a later reorder wiping who is in which group;
 *   · a deleted group taking its walkers' walk rows with it (they must walk on, in their role's section);
 *   · a march edit writing a guest row; a plain invited guest (or anon) reading or making the hosts' groups.
 */
import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];
before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await db?.close();
});

async function event(tag: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Own groups ${tag}`],
  );
  return ev.rows[0]!.event_id;
}
async function guest(eventId: string, first: string, role: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status)
     VALUES ($1, $2, 'Test', 'both', 'other', $3::guest_role, 'pending') RETURNING guest_id`,
    [eventId, first, role],
  );
  return g.rows[0]!.guest_id;
}
const group = (e: string, key: string, label: string) =>
  db.query('insert into public.march_groups (event_id, group_key, label) values ($1, $2, $3)', [e, key, label]);
const regroup = async (e: string, g: string, key: string | null) =>
  (await db.query<{ n: number }>('select public.set_march_group($1, $2, $3) as n', [e, g, key])).rows[0]!.n;
const walksOf = async (e: string) =>
  (await db.query<{ guest_id: string; walk_no: number; march_group: string | null }>(
    'select guest_id, walk_no, march_group from public.march_walks where event_id = $1 order by walk_no, place_in_walk',
    [e],
  )).rows;
const guestsOf = async (e: string) =>
  (await db.query<{ j: string }>(`select coalesce(json_agg(to_jsonb(g) - 'updated_at' order by g.guest_id)::text, '[]') as j from public.guests g where g.event_id = $1`, [e])).rows[0]!.j;

test('into a group: a fresh walk of their own (the walk-mate keeps theirs), and no guest row written', async () => {
  const e = await event('into');
  const a = await guest(e, 'A', 'candle_sponsor');
  const b = await guest(e, 'B', 'candle_sponsor');
  await db.query('select public.set_entourage_order($1, $2::uuid[], $3::int[])', [e, [a, b], [0, 0]]);
  await group(e, 'own_parade0001', 'Parade');
  const before = await guestsOf(e);
  assert.equal(await regroup(e, a, 'own_parade0001'), 1);
  const w = await walksOf(e);
  const wa = w.find((r) => r.guest_id === a)!;
  const wb = w.find((r) => r.guest_id === b)!;
  assert.equal(wa.march_group, 'own_parade0001');
  assert.equal(wb.march_group, null, 'the walk-mate was dragged into the group');
  assert.notEqual(wa.walk_no, wb.walk_no, 'one walk now spans two groups');
  assert.equal(await regroup(e, a, 'own_parade0001'), 1, 'twice is the same answer');
  assert.equal((await walksOf(e)).find((r) => r.guest_id === a)!.walk_no, wa.walk_no, 'a repeat moved them again');
  // A reorder inside the group keeps who is in it.
  await db.query('select public.set_entourage_order($1, $2::uuid[], $3::int[])', [e, [a], [0]]);
  assert.equal((await walksOf(e)).find((r) => r.guest_id === a)!.march_group, 'own_parade0001', 'a reorder wiped the group');
  // Back home.
  assert.equal(await regroup(e, a, null), 1);
  assert.equal((await walksOf(e)).find((r) => r.guest_id === a)!.march_group, null);
  assert.equal(await guestsOf(e), before, 'a march edit wrote a guest row');
});

test('an unplaced walker is placed by the move; a missing group, a tray name, another event — all answered 0', async () => {
  const e = await event('refuse');
  const a = await guest(e, 'A', 'ring_bearer');
  await group(e, 'own_parade0002', 'Parade');
  assert.equal(await regroup(e, a, 'own_parade0002'), 1, 'an unplaced walker could not join a group');
  assert.equal((await walksOf(e)).length, 1);
  assert.equal(await regroup(e, a, 'own_nosuchgroup'), 0, 'a group that does not exist was answered done');
  const t = await guest(e, 'T', 'flower_girl');
  await db.query('select public.set_march_walking($1, $2, false)', [e, t]);
  assert.equal(await regroup(e, t, 'own_parade0002'), 0, 'someone not walking was put in a group');
  const f = await event('refuse-2');
  const x = await guest(f, 'X', 'bridesmaid');
  assert.equal(await regroup(e, x, 'own_parade0002'), 0);
  await assert.rejects(() => group(e, 'bearers', 'Not an own key'), /check/i, 'a built-in key was made an own group');
  await assert.rejects(() => group(e, 'own_parade0003', '   '), /check/i, 'a group with no name');
});

test('a deleted group hands its walkers back — the walk rows stay, the group is cleared', async () => {
  const e = await event('drop');
  const a = await guest(e, 'A', 'veil_sponsor');
  await group(e, 'own_parade0004', 'Parade');
  await regroup(e, a, 'own_parade0004');
  await db.query('delete from public.march_groups where event_id = $1 and group_key = $2', [e, 'own_parade0004']);
  const w = await walksOf(e);
  assert.equal(w.length, 1, 'deleting a group deleted its walkers’ walks');
  assert.equal(w[0]!.march_group, null);
});

test('only the hosts may read or make their own groups', async () => {
  const e = await event('rls');
  const user = async (email: string, memberType: 'couple' | 'guest'): Promise<string> => {
    const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, '{}'::jsonb) RETURNING id`, [email]);
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [e, u.rows[0]!.id, memberType]);
    return u.rows[0]!.id;
  };
  const host = await user('host-owngroups@example.com', 'couple');
  const invited = await user('guest-owngroups@example.com', 'guest');
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
  await as(host, 'authenticated', () => group(e, 'own_hostmade01', 'Ours'));
  const seen = await as(invited, 'authenticated', () => db.query('select group_key from public.march_groups where event_id = $1', [e]));
  assert.equal(seen.rows.length, 0, 'an invited guest read the hosts’ groups');
  await assert.rejects(() => as(invited, 'authenticated', () => group(e, 'own_guestmade1', 'Theirs')), /row-level security/);
  await assert.rejects(() => as(null, 'anon', () => db.query('select count(*) from public.march_groups')), /permission denied/);
  const a = await guest(e, 'A', 'bridesmaid');
  assert.equal(await as(host, 'authenticated', () => regroup(e, a, 'own_hostmade01')), 1, 'the host could not move a walker in');
});
