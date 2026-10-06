/**
 * THE "NOT WALKING" TRAY — `march_not_walking` + `set_march_walking`, against real SQL.
 *
 * ⚖ Owner 2026-10-06: *"Just show screen for those not added or will not walk
 * the isle."* A person dragged onto the tray does not walk; dragged back, they
 * walk again. Each test is one way that could be quietly broken:
 *   · a person both walking AND in the tray (two answers to one question);
 *   · their walk-mate dragged out with them (the partner must keep the walk);
 *   · a tray edit that writes a guest row (march edits never do);
 *   · a plain invited guest able to take someone out of the hosts' march.
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
    [`Tray ${tag}`],
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
const walksOf = async (e: string) =>
  (await db.query<{ guest_id: string; walk_no: number }>('select guest_id, walk_no from public.march_walks where event_id = $1 order by walk_no, place_in_walk', [e])).rows;
const trayOf = async (e: string) =>
  (await db.query<{ guest_id: string }>('select guest_id from public.march_not_walking where event_id = $1 order by guest_id', [e])).rows.map((r) => r.guest_id);
const guestsOf = async (e: string) =>
  (await db.query<{ j: string }>(`select coalesce(json_agg(to_jsonb(g) - 'updated_at' order by g.guest_id)::text, '[]') as j from public.guests g where g.event_id = $1`, [e])).rows[0]!.j;
const walking = async (e: string, g: string, walks: boolean) =>
  (await db.query<{ n: number }>('select public.set_march_walking($1, $2, $3) as n', [e, g, walks])).rows[0]!.n;

test('out of the march into the tray — the walk-mate keeps the walk, alone', async () => {
  const e = await event('out');
  const a = await guest(e, 'A', 'bridesmaid');
  const b = await guest(e, 'B', 'groomsman');
  await db.query('select public.set_entourage_order($1, $2::uuid[], $3::int[])', [e, [a, b], [0, 0]]);
  assert.equal((await walksOf(e)).length, 2);
  const before = await guestsOf(e);

  assert.equal(await walking(e, a, false), 1);
  assert.deepEqual((await walksOf(e)).map((r) => r.guest_id), [b], 'the partner left the march too');
  assert.deepEqual(await trayOf(e), [a]);
  assert.equal(await walking(e, a, false), 1, 'twice is the same answer');
  assert.deepEqual(await trayOf(e), [a]);
  assert.equal(await guestsOf(e), before, 'a tray edit wrote a guest row');
});

test('back from the tray — they walk again (unplaced), and never both at once', async () => {
  const e = await event('back');
  const a = await guest(e, 'A', 'ring_bearer');
  await walking(e, a, false);
  assert.equal(await walking(e, a, true), 1);
  assert.deepEqual(await trayOf(e), []);
  assert.deepEqual(await walksOf(e), [], 'back from the tray is UNPLACED until a move places them');

  // A move that places someone still in the tray takes them OUT of it (the floor under the actions).
  await walking(e, a, false);
  await db.query('select public.set_entourage_order($1, $2::uuid[], $3::int[])', [e, [a], [0]]);
  assert.deepEqual(await trayOf(e), [], 'a walker is still listed as not walking');
  assert.equal((await walksOf(e)).length, 1);
});

test('a guest of another event, or a removed guest, is answered 0 — never "done"', async () => {
  const e = await event('other');
  const f = await event('other-2');
  const x = await guest(f, 'X', 'bridesmaid');
  assert.equal(await walking(e, x, false), 0);
  assert.deepEqual(await trayOf(e), []);
  const gone = await guest(e, 'Gone', 'bridesmaid');
  await db.query('update public.guests set deleted_at = now() where guest_id = $1', [gone]);
  assert.equal(await walking(e, gone, false), 0);
});

test('only the hosts may take someone out of the march', async () => {
  const e = await event('rls');
  const a = await guest(e, 'A', 'bridesmaid');
  const user = async (email: string, memberType: 'couple' | 'guest'): Promise<string> => {
    const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, '{}'::jsonb) RETURNING id`, [email]);
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [e, u.rows[0]!.id, memberType]);
    return u.rows[0]!.id;
  };
  const host = await user('host-tray@example.com', 'couple');
  const invited = await user('guest-tray@example.com', 'guest');
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
  // Refused either way: answered 0 (the guest is not theirs to see) or rejected by RLS — never written.
  const said = await as(invited, 'authenticated', () => walking(e, a, false)).catch((err: Error) => {
    assert.match(err.message, /row-level security|permission denied/);
    return 0;
  });
  assert.equal(said, 0, 'an invited guest was told it worked');
  assert.deepEqual(await trayOf(e), [], 'an invited guest took someone out of the march');
  assert.equal(await as(host, 'authenticated', () => walking(e, a, false)), 1);
  assert.deepEqual(await trayOf(e), [a]);
  await assert.rejects(() => as(null, 'anon', () => db.query('select count(*) from public.march_not_walking')), /permission denied/);
});
