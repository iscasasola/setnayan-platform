/**
 * 🔑 A FULL-ACCESS COORDINATOR CAN APPLY THE EVENT HUB — executed against real Postgres (owner 2026-10-29: *"only
 * TWO levels"* — Limited and FULL ACCESS = *"all changes instantly approved"*, Event Hub included).
 *
 * The Maker's Apply writes `events` with the caller's own session (`hub-draft-actions.ts` → `.from('events')
 * .update(eventsPatch)`), and the only UPDATE policy on `events` is `couple_can_update_event` (a `couple` member).
 * So a coordinator — a `coordinator` member, whatever her per-area grant, the "Same access as you" switch ON
 * included — writes ZERO rows. Measured below, not assumed.
 *
 * FULL ACCESS IS THE CO-HOST SEAT (`levelWrite('full')`, `lib/coordinator-access-level.ts`): the hosts' answer moves
 * her seat to `co_host`, `sync_delegate_membership` makes her a `couple` member, and the SAME shipped policy admits
 * her Apply. No new policy, no migration. Limited, the switch Off, a limited helper, and Undo all stay refused.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { levelWrite, undoWrite, type LevelTemplates } from '../../lib/coordinator-access-level';

let replay: ReplayResult;
let db: PGlite;

/** The shipped templates (`PERMISSION_TEMPLATES`, held equal by `the-hosts-pick-their-coordinators-access.test.ts`). */
const T: LevelTemplates = {
  co_host: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false },
  wedding_planner_external: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false },
};
/** The live coordinator's grant as measured on production (2026-10-29): seat plan, view. */
const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { seat_plan: 'view' } };
/** "Same access as you" ON (`COORDINATOR_ON_AREAS` at Edit). */
const SWITCH_ON = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { guest_list: 'edit', seat_plan: 'edit', schedule: 'edit', vendors: 'edit', invitations: 'view', mood_board: 'view' },
};
const SWITCH_OFF = { ...SWITCH_ON, areas: { guest_list: null, seat_plan: null, schedule: null, vendors: null } };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
}
async function asSystem(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newEvent(label: string): Promise<{ eventId: string; creator: string }> {
  const creator = await newUser(`creator-${label}@level.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, creator],
  );
  return { eventId, creator };
}

/** A CONNECTED seat (her account on it, accepted) — the trigger makes her a member of the seat's kind. */
async function seat(eventId: string, uid: string, role: string, perms: unknown, by: string): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, now()) RETURNING moderator_id`,
    [eventId, role, JSON.stringify(perms), by, uid],
  );
  return r.rows[0]!.moderator_id;
}

async function membership(eventId: string, uid: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(`SELECT member_type::text AS t FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [eventId, uid]);
  return r.rows[0]?.t ?? null;
}

/** The Maker's Apply, as the caller: one Event Hub column (`HUB_DRAFT_EVENT_COLUMNS` carries `std_reveal_template`). */
async function applyAs(uid: string, eventId: string, value: string): Promise<number> {
  await asUser(uid);
  try {
    const r = await db.query(`UPDATE public.events SET std_reveal_template = $2 WHERE event_id = $1 RETURNING event_id`, [eventId, value]);
    return r.rows.length;
  } finally {
    await asSystem();
  }
}

/** The hosts' answer, written as the HOST (the `event_moderators_host_update` policy), exactly as `levelWrite` builds it. */
async function answerAs(host: string, moderatorId: string, next: { role_subtype: string; permissions_json: unknown }): Promise<number> {
  await asUser(host);
  try {
    const r = await db.query(
      `UPDATE public.event_moderators SET role_subtype = $2, permissions_json = $3::jsonb WHERE moderator_id = $1 RETURNING moderator_id`,
      [moderatorId, next.role_subtype, JSON.stringify(next.permissions_json)],
    );
    return r.rows.length;
  } finally {
    await asSystem();
  }
}

test('🔴 a coordinator cannot Apply today — narrow grant, switch ON or switch Off alike (0 rows)', async () => {
  for (const [label, perms] of [['narrow', NARROW], ['on', SWITCH_ON], ['off', SWITCH_OFF]] as const) {
    const { eventId, creator } = await newEvent(`coord-${label}`);
    const coord = await newUser(`coord-${label}@level.test`);
    await seat(eventId, coord, 'wedding_planner_external', perms, creator);
    assert.equal(await membership(eventId, coord), 'coordinator');
    assert.equal(await applyAs(coord, eventId, 'garden'), 0, `${label}: a coordinator member wrote the events row`);
  }
});

test('✅ FULL ACCESS (the co-host seat) → her Apply lands; Undo takes it back', async () => {
  const { eventId, creator } = await newEvent('full');
  const coord = await newUser('coord-full@level.test');
  const id = await seat(eventId, coord, 'wedding_planner_external', NARROW, creator);
  const full = levelWrite('full', { role_subtype: 'wedding_planner_external', permissions_json: NARROW as never }, T);
  assert.equal(await answerAs(creator, id, full), 1, 'the host could not record Full access');
  assert.equal(await membership(eventId, coord), 'couple', 'Full access did not make her a full co-host member');
  assert.equal(await applyAs(coord, eventId, 'garden'), 1, 'a Full-access coordinator still cannot Apply the Event Hub');
  const after = await db.query<{ std_reveal_template: string | null }>(`SELECT std_reveal_template FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(after.rows[0]!.std_reveal_template, 'garden');

  // Undo → back to the coordinator's seat as it was → refused again.
  const back = undoWrite(full)!;
  assert.equal(await answerAs(creator, id, back), 1);
  assert.equal(await membership(eventId, coord), 'coordinator', 'Undo left her a full co-host');
  assert.equal(await applyAs(coord, eventId, 'beach'), 0, 'after Undo she still applies');
});

test('⛔ LIMITED and a limited helper stay refused', async () => {
  const { eventId, creator } = await newEvent('limited');
  const coord = await newUser('coord-limited@level.test');
  const id = await seat(eventId, coord, 'wedding_planner_external', SWITCH_ON, creator);
  const limited = levelWrite('limited', { role_subtype: 'wedding_planner_external', permissions_json: SWITCH_ON as never }, T);
  assert.equal(await answerAs(creator, id, limited), 1);
  assert.equal(await membership(eventId, coord), 'coordinator');
  assert.equal(await applyAs(coord, eventId, 'garden'), 0, 'a Limited coordinator applied the Event Hub');

  const helper = await newUser('helper@level.test');
  await seat(eventId, helper, 'viewer', { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false }, creator);
  assert.equal(await applyAs(helper, eventId, 'garden'), 0, 'a limited helper applied the Event Hub');
});

test('⛔ the coordinator cannot give HERSELF Full access', async () => {
  const { eventId, creator } = await newEvent('self');
  const coord = await newUser('coord-self@level.test');
  const id = await seat(eventId, coord, 'wedding_planner_external', SWITCH_ON, creator);
  const full = levelWrite('full', { role_subtype: 'wedding_planner_external', permissions_json: SWITCH_ON as never }, T);
  assert.equal(await answerAs(coord, id, full), 0, 'a coordinator promoted her own seat');
  assert.equal(await membership(eventId, coord), 'coordinator');
});
