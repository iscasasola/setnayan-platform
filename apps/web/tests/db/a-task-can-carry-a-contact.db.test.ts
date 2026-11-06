/**
 * 📇 A TASK CAN CARRY A CONTACT — asserted against the DATABASE (migration 20271303218631; owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (3)).
 *
 *   1 · the couple writes a name + phone on a task; the event and the moment are DERIVED from the task;
 *   2 · the coordinator (Edit) writes; a helper with View reads; neither of them is refused by accident;
 *   3 · a booked supplier reads it ONLY on a moment they are on (tagged, or a line of theirs) — never on another
 *       moment of the same event, and they never write it;
 *   4 · a stranger, a signed-in guest and anon read nothing;
 *   5 · a bad phone is refused; deleting the task deletes its contact.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = {
  eventId: '',
  otherEventId: '',
  couple: '',
  coord: '',
  viewer: '',
  supplier: '',
  stranger: '',
  guestUser: '',
  booking: '',
  chapter: '',
  carMoment: '',
  otherMoment: '',
  driverTask: '',
  otherTask: '',
};

async function contactsVisible(uid: string | null): Promise<string[]> {
  if (uid) await asUser(uid);
  else await asAnon();
  const r = await db
    .query<{ task_id: string }>(`SELECT task_id FROM public.event_schedule_task_contacts ORDER BY name`)
    .catch(() => ({ rows: [] as { task_id: string }[] }));
  return r.rows.map((x) => x.task_id);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  const mkEvent = async (name: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.couple = await mkUser('couple@contact.test');
  F.coord = await mkUser('coord@contact.test');
  F.viewer = await mkUser('viewer@contact.test');
  F.supplier = await mkUser('supplier@contact.test');
  F.stranger = await mkUser('stranger@contact.test');
  F.guestUser = await mkUser('guest@contact.test');
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Someone Else');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [F.eventId, F.guestUser]);
  for (const [uid, level, role] of [
    [F.coord, 'edit', 'wedding_planner_external'],
    [F.viewer, 'view', 'viewer'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,$3, jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,'remove_hosts',false,
                                            'areas', jsonb_build_object('schedule',$4::text)), NOW())
       ON CONFLICT (event_id,user_id) DO UPDATE SET permissions_json = EXCLUDED.permissions_json, role_subtype = EXCLUDED.role_subtype, removed_at = NULL`,
      [F.eventId, uid, role, level],
    );
  }
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,'Sample Photo','Manila',ARRAY['catering']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
      [F.supplier],
    )
  ).rows[0]!.vendor_profile_id;
  F.booking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'catering','Sample Photo','contracted',30000,$2) RETURNING vendor_id`,
      [F.eventId, vp],
    )
  ).rows[0]!.vendor_id;

  const block = async (row: Record<string, unknown>): Promise<string> => {
    const cols = ['event_id', ...Object.keys(row)];
    return (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING block_id`,
        [F.eventId, ...Object.values(row)],
      )
    ).rows[0]!.block_id;
  };
  F.chapter = await block({ label: 'Preparation', start_at: '2099-12-18T10:00:00Z', responsible_vendor_ids: [F.booking] });
  // The photographer is ON the bridal-car moment (tagged); NOT on the other one.
  F.carMoment = await block({ label: 'Bridal car leaves', start_at: '2099-12-18T14:15:00Z', parent_block_id: F.chapter, responsible_vendor_ids: [F.booking] });
  F.otherMoment = await block({ label: 'Groom’s car leaves', start_at: '2099-12-18T13:45:00Z', parent_block_id: F.chapter });
  const task = async (blockId: string, who: string): Promise<string> =>
    (
      await db.query<{ task_id: string }>(
        `INSERT INTO public.event_schedule_tasks (event_id, block_id, who_label, what) VALUES ($1,$2,$3,'Drives') RETURNING task_id`,
        [F.eventId, blockId, who],
      )
    ).rows[0]!.task_id;
  F.driverTask = await task(F.carMoment, 'Bridal car driver');
  F.otherTask = await task(F.otherMoment, 'Groom’s driver');
});

after(async () => {
  await replay?.db.close();
});

test('1 · the couple writes a name and phone on a task; the event and the moment come from the task', async () => {
  await asUser(F.couple);
  await db.query(
    `INSERT INTO public.event_schedule_task_contacts (task_id, event_id, block_id, name, phone) VALUES ($1,$2,$3,' Mang Ben ','0917 123 4567')`,
    // A forged event and moment — replaced by the trigger.
    [F.driverTask, F.otherEventId, F.otherMoment],
  );
  await asOwner();
  const r = await db.query<{ event_id: string; block_id: string; name: string }>(
    `SELECT event_id, block_id, name FROM public.event_schedule_task_contacts WHERE task_id = $1`,
    [F.driverTask],
  );
  assert.equal(r.rows[0]?.event_id, F.eventId, 'the event was taken from the client');
  assert.equal(r.rows[0]?.block_id, F.carMoment, 'the moment was taken from the client');
  assert.equal(r.rows[0]?.name, 'Mang Ben');
});

test('2 · the coordinator (Edit) writes; a helper with View reads', async () => {
  await asUser(F.coord);
  await db.query(`INSERT INTO public.event_schedule_task_contacts (task_id, name, phone) VALUES ($1,'Kuya Jun','+63 917 765 4321')`, [F.otherTask]);
  assert.deepEqual((await contactsVisible(F.viewer)).sort(), [F.driverTask, F.otherTask].sort());
  await asUser(F.viewer);
  await assert.rejects(
    db.query(`UPDATE public.event_schedule_task_contacts SET name = 'x' WHERE task_id = $1 RETURNING task_id`, [F.driverTask]).then((r) => {
      if (r.rows.length === 0) throw new Error('row-level security: nothing updated');
    }),
    /row-level security|permission/i,
    'a View helper changed a contact',
  );
});

test('3 · a booked supplier reads the contact ONLY on a moment they are on, and never writes it', async () => {
  assert.deepEqual(await contactsVisible(F.supplier), [F.driverTask], 'the supplier saw a phone on a moment they are not on');
  await asUser(F.supplier);
  await assert.rejects(
    db.query(`INSERT INTO public.event_schedule_task_contacts (task_id, name, phone) VALUES ($1,'x','0917 000 0000')`, [F.otherTask]),
    /row-level security|violates|duplicate/i,
  );
  // A line of theirs on the other moment (not a tag) puts them on it — they read it then.
  await asOwner();
  await db.query(`INSERT INTO public.event_schedule_tasks (event_id, block_id, vendor_id, what) VALUES ($1,$2,$3,'Shoots the groom leaving')`, [
    F.eventId,
    F.otherMoment,
    F.booking,
  ]);
  assert.deepEqual((await contactsVisible(F.supplier)).sort(), [F.driverTask, F.otherTask].sort());
});

test('4 · a stranger, a signed-in guest and anon read nothing', async () => {
  assert.deepEqual(await contactsVisible(F.stranger), []);
  assert.deepEqual(await contactsVisible(F.guestUser), [], 'a guest read a phone straight from the table');
  assert.deepEqual(await contactsVisible(null), []);
});

test('5 · a bad phone is refused; deleting the task deletes its contact', async () => {
  await asUser(F.couple);
  await assert.rejects(
    db.query(`UPDATE public.event_schedule_task_contacts SET phone = 'call me' WHERE task_id = $1`, [F.driverTask]),
    /check|violates/i,
  );
  await db.query(`DELETE FROM public.event_schedule_tasks WHERE task_id = $1`, [F.driverTask]);
  await asOwner();
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_task_contacts WHERE task_id = $1`, [F.driverTask]);
  assert.equal(r.rows[0]?.n, 0);
});
