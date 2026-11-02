/**
 * 🚶 A MOMENT PICKS WHICH MARCH — `event_schedule_blocks.march_key`, against real SQL (migration 20271301571290; owner
 * 2026-11-01: *"When we say this is a march. It picks which march."*, DECISION_LOG "A MOMENT PICKS WHICH MARCH").
 *
 * Each test is one way the link could be quietly wrong:
 *   · two moments refused one march (the owner: one march can serve more than one moment);
 *   · removing the link deleting the march (or its walkers);
 *   · deleting a march deleting the MOMENT that used it (only the link may go);
 *   · a link naming another event's march, a march that does not exist, or set on a chapter;
 *   · a coordinator with Edit on the Schedule unable to link a march they cannot read;
 *   · deleting the whole event tripping over the clear.
 *
 * Run: pnpm --filter @setnayan/web test:db
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

async function asUser(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await db.exec('SET ROLE authenticated');
}
async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}

async function event(tag: string): Promise<string> {
  await asOwner();
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', DATE '2099-12-18', 'day') RETURNING event_id`,
    [`March link ${tag}`],
  );
  return ev.rows[0]!.event_id;
}
async function block(eventId: string, label: string, parent: string | null): Promise<string> {
  await asOwner();
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, parent_block_id)
     VALUES ($1, $2, TIMESTAMPTZ '2099-12-18 14:00+00', TIMESTAMPTZ '2099-12-18 14:30+00', $3) RETURNING block_id`,
    [eventId, label, parent],
  );
  return r.rows[0]!.block_id;
}
async function guest(eventId: string, first: string): Promise<string> {
  await asOwner();
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status)
     VALUES ($1, $2, 'Test', 'both', 'other', 'flower_girl'::guest_role, 'pending') RETURNING guest_id`,
    [eventId, first],
  );
  return g.rows[0]!.guest_id;
}
const marchGroup = async (e: string, key: string, label: string) => {
  await asOwner();
  await db.query('insert into public.march_groups (event_id, group_key, label) values ($1, $2, $3)', [e, key, label]);
};
const link = (blockId: string, key: string | null) =>
  db.query<{ block_id: string }>('update public.event_schedule_blocks set march_key = $2 where block_id = $1 returning block_id', [blockId, key]);
const keyOf = async (blockId: string) => {
  await asOwner();
  return (await db.query<{ march_key: string | null }>('select march_key from public.event_schedule_blocks where block_id = $1', [blockId])).rows[0]
    ?.march_key;
};
const groupsOf = async (e: string) => {
  await asOwner();
  return (await db.query<{ group_key: string }>('select group_key from public.march_groups where event_id = $1', [e])).rows.map((r) => r.group_key);
};

test('two moments use one march; removing a link never deletes the march or its walkers', async () => {
  const e = await event('share');
  const chapter = await block(e, 'Reception', null);
  const rehearsal = await block(e, 'Rehearsal of the entrance', chapter);
  const entrance = await block(e, 'Grand Entrance', chapter);
  await marchGroup(e, 'own_grandentr01', 'Grand Entrance');
  const g = await guest(e, 'Alyssa');
  assert.equal(await db.query<{ n: number }>('select public.set_march_group($1, $2, $3) as n', [e, g, 'own_grandentr01']).then((r) => r.rows[0]!.n), 1);

  await asOwner();
  assert.equal((await link(rehearsal, 'own_grandentr01')).rows.length, 1);
  assert.equal((await link(entrance, 'own_grandentr01')).rows.length, 1, 'a second moment could not use the same march');
  assert.equal(await keyOf(rehearsal), 'own_grandentr01');
  assert.equal(await keyOf(entrance), 'own_grandentr01');

  // Not a march any more — the march, and who walks in it, stay.
  await asOwner();
  assert.equal((await link(rehearsal, null)).rows.length, 1);
  assert.equal(await keyOf(rehearsal), null);
  assert.deepEqual(await groupsOf(e), ['own_grandentr01'], 'removing the link deleted the march');
  const walkers = await db.query<{ march_group: string | null }>('select march_group from public.march_walks where event_id = $1 and guest_id = $2', [e, g]);
  assert.equal(walkers.rows[0]?.march_group, 'own_grandentr01', 'removing the link moved the march’s walkers');
  assert.equal(await keyOf(entrance), 'own_grandentr01', 'removing one moment’s link cleared the other’s');

  // The event's Wedding March itself is a march too.
  assert.equal((await link(rehearsal, 'entourage')).rows.length, 1);
  assert.equal(await keyOf(rehearsal), 'entourage');
});

test('deleting a march clears its moments’ links — the moments stay', async () => {
  const e = await event('drop');
  const chapter = await block(e, 'Ceremony', null);
  const m = await block(e, 'Flower girls’ parade', chapter);
  const other = await block(e, 'Processional', chapter);
  await marchGroup(e, 'own_parade00001', 'Parade');
  await marchGroup(e, 'own_keepme00001', 'Kept');
  await asOwner();
  await link(m, 'own_parade00001');
  await link(other, 'own_keepme00001');
  await db.query('delete from public.march_groups where event_id = $1 and group_key = $2', [e, 'own_parade00001']);
  const left = await db.query<{ n: number }>('select count(*)::int as n from public.event_schedule_blocks where block_id = $1', [m]);
  assert.equal(left.rows[0]!.n, 1, 'deleting a march deleted the moment that used it');
  assert.equal(await keyOf(m), null, 'the moment still names a march that is gone');
  assert.equal(await keyOf(other), 'own_keepme00001', 'deleting one march cleared another march’s link');
});

test('a link names a real march of its own event, and only on a moment', async () => {
  const e = await event('refuse');
  const f = await event('refuse-other');
  const chapter = await block(e, 'Reception', null);
  const m = await block(e, 'Entrance', chapter);
  await marchGroup(f, 'own_theirs00001', 'Not yours');
  await asOwner();
  await assert.rejects(() => link(m, 'own_theirs00001'), /march_not_found/, 'a moment linked another event’s march');
  await assert.rejects(() => link(m, 'own_nosuch00001'), /march_not_found/, 'a moment linked a march that does not exist');
  await assert.rejects(() => link(m, 'bearers'), /check/i, 'a built-in section key was linked as a march');
  await assert.rejects(() => link(chapter, 'entourage'), /check/i, 'a chapter was made a march');
  assert.equal(await keyOf(m), null);
});

test('a coordinator with Edit on the Schedule links a march they cannot read; deleting the event still works', async () => {
  const e = await event('coord');
  await asOwner();
  const coord = (
    await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('coord@march-link.test', '{}'::jsonb) RETURNING id`)
  ).rows[0]!.id;
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external',
             jsonb_build_object('edit_all', false, 'checkout', false, 'invite_hosts', false, 'remove_hosts', false,
                                'areas', jsonb_build_object('schedule', 'edit')), NOW())`,
    [e, coord],
  );
  const chapter = await block(e, 'Reception', null);
  const m = await block(e, 'Entrance', chapter);
  await marchGroup(e, 'own_coordsee001', 'Entourage entrance');
  await asUser(coord);
  const seen = await db.query('select group_key from public.march_groups where event_id = $1', [e]);
  assert.equal(seen.rows.length, 0, 'premise: the coordinator cannot read the march list');
  assert.equal((await link(m, 'own_coordsee001')).rows.length, 1, 'an existing march read as missing to the coordinator');
  await asOwner();
  assert.equal(await keyOf(m), 'own_coordsee001');

  await db.query('delete from public.events where event_id = $1', [e]);
  const n = await db.query<{ n: number }>('select count(*)::int as n from public.event_schedule_blocks where event_id = $1', [e]);
  assert.equal(n.rows[0]!.n, 0);
});
