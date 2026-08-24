/**
 * AN ACCEPTED DELEGATE IS A MEMBER — owner ruling 2026-08-24, "Full helper
 * access", asked directly and answered.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * Two membership lists: event_members (what 117 tables' policies gate on) and
 * event_moderators (what the dashboard shell admits). The token-accept door
 * minted the coordinator member row in APP code; the access-request approval
 * door creates the moderator row BORN-ACCEPTED and never minted; a row seeded
 * by SQL passes no app door at all. Production held exactly that: an accepted
 * external planner with no member row, reading an EMPTY checklist on an event
 * with 94 items — an RLS denial is 200 + zero rows + null error, so "not
 * allowed" and "nothing here" are the same value. ONE WRITE BODY, TWO DOORS.
 *
 * ── WHY THESE TESTS DRIVE THE TABLE, NOT AN ACTION ─────────────────────────
 * The fix is a trigger (migration 20271161203067) precisely because the doors
 * keep multiplying. So every test here writes event_moderators the way a DOOR
 * would — an UPDATE stamping accepted_at (token door), an INSERT born accepted
 * (approval door / SQL seed) — and reads event_members back. A test that
 * called one server action would prove one door.
 *
 * 🛡 Mutation-checked by occurrence count, before → after, each proved RED.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

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

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newEvent(label: string): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@delegate.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  return { eventId, coupleUid };
}

async function memberType(eventId: string, uid: string): Promise<string | null> {
  const r = await db.query<{ member_type: string }>(
    `SELECT member_type::text AS member_type FROM public.event_members
     WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  return r.rows[0]?.member_type ?? null;
}

async function seedModerator(
  eventId: string,
  uid: string | null,
  opts: { accepted?: boolean; role?: string } = {},
): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, $3, '{}'::jsonb, $4)
     RETURNING moderator_id`,
    [eventId, uid, opts.role ?? 'wedding_planner_external', opts.accepted ? new Date().toISOString() : null],
  );
  return r.rows[0]!.moderator_id;
}

test('the approval/SQL door: a row born accepted mints the coordinator membership', async () => {
  const { eventId } = await newEvent('born-accepted');
  const planner = await newUser('planner-born@delegate.test');
  await seedModerator(eventId, planner, { accepted: true });
  assert.equal(
    await memberType(eventId, planner),
    'coordinator',
    'The access-request door and a straight SQL seed both create the row ' +
      'already accepted — the exact shape production held. The trigger must ' +
      'mint on INSERT, not only on the token door’s UPDATE.',
  );
});

test('the token door: stamping accepted_at on a pending invite mints it', async () => {
  const { eventId } = await newEvent('token-door');
  const planner = await newUser('planner-token@delegate.test');
  const modId = await seedModerator(eventId, null, { accepted: false });
  // The app-side upsert was REMOVED from the accept action; this UPDATE is now
  // the only thing that door does, so this test is what proves it still works.
  await db.query(
    `UPDATE public.event_moderators
     SET user_id = $2, accepted_at = NOW(), invitation_token = NULL
     WHERE moderator_id = $1`,
    [modId, planner],
  );
  assert.equal(await memberType(eventId, planner), 'coordinator');
});

test('a couple member is never downgraded by accepting a delegate role', async () => {
  const { eventId, coupleUid } = await newEvent('couple-safe');
  await seedModerator(eventId, coupleUid, { accepted: true, role: 'groom' });
  assert.equal(
    await memberType(eventId, coupleUid),
    'couple',
    'ON CONFLICT DO NOTHING is the guarantee: accepting a moderator role must ' +
      'never turn the couple into a coordinator.',
  );
});

test('an unclaimed or pending invite mints nothing', async () => {
  const { eventId } = await newEvent('pending');
  const planner = await newUser('planner-pending@delegate.test');
  await seedModerator(eventId, planner, { accepted: false });
  assert.equal(await memberType(eventId, planner), null, 'not accepted → not a member');
  await seedModerator(eventId, null, { accepted: true });
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_members
     WHERE event_id = $1 AND member_type = 'coordinator'`,
    [eventId],
  );
  assert.equal(n.rows[0]!.c, '0', 'accepted but unclaimed (user_id null) → nothing to admit');
});

test('removal revokes the membership the accept minted', async () => {
  const { eventId } = await newEvent('removal');
  const planner = await newUser('planner-removed@delegate.test');
  const modId = await seedModerator(eventId, planner, { accepted: true });
  assert.equal(await memberType(eventId, planner), 'coordinator');
  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [modId]);
  assert.equal(
    await memberType(eventId, planner),
    null,
    'A removed delegate keeping coordinator membership would be the same gap ' +
      'in the opposite direction — access that outlives the role.',
  );
});

test('removal never deletes a couple row', async () => {
  const { eventId, coupleUid } = await newEvent('removal-guards');
  const coupleModId = await seedModerator(eventId, coupleUid, { accepted: true, role: 'groom' });
  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [coupleModId]);
  assert.equal(await memberType(eventId, coupleUid), 'couple', 'the delete names coordinator only');
});

test('one moderator role per person per event — the premise the inverse leans on', async () => {
  // The trigger's "spare the membership while another live accepted role
  // remains" branch is a BELT: today it can never fire, because the schema
  // holds one row per (event, user). This test pins that premise — if the
  // UNIQUE is ever relaxed, it fails, and whoever relaxes it is told the
  // removal inverse now has a real second-role case to handle.
  const { eventId } = await newEvent('one-role');
  const planner = await newUser('planner-one-role@delegate.test');
  await seedModerator(eventId, planner, { accepted: true });
  await assert.rejects(
    () => seedModerator(eventId, planner, { accepted: true, role: 'family_helper' }),
    /event_moderators_event_id_user_id_key/,
    'a second role for the same person on the same event must be refused by the schema',
  );
});

test('the membership actually opens the checklist under RLS — the live complaint', async () => {
  const { eventId } = await newEvent('checklist');
  await db.query(
    `INSERT INTO public.event_checklist_items (event_id, title, sort_order)
     VALUES ($1, 'Book the church', 1)`,
    [eventId],
  );
  const planner = await newUser('planner-checklist@delegate.test');
  await seedModerator(eventId, planner, { accepted: true });

  await db.exec(`SET ROLE authenticated`);
  await setAuthUid(db, planner);
  const r = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_checklist_items WHERE event_id = $1`,
    [eventId],
  );
  await db.exec('RESET ROLE');
  assert.equal(
    r.rows[0]!.c,
    '1',
    'This is the sentence the whole ruling exists for: the planner on a ' +
      'wedding with 94 checklist items read an EMPTY list, because an RLS ' +
      'denial and a blank event are the same 200. With the membership, the ' +
      'checklist is visible.',
  );
});
