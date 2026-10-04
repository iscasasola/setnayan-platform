/**
 * A HOST CAN NEVER WRITE ANOTHER PERSON'S PROFILE — asserted against the
 * REPLAYED schema, each step through a real `authenticated` session.
 *
 * B9 "Use this on your profile" (DECISION_LOG 2026-09-30 "THE EVENT'S FORMAL
 * NAME FILLS THE PERSON'S OWN PROFILE — ONE TAP, NEVER SILENT"): the event's
 * formal name reaches a profile only when the PERSON confirms it on their own
 * Me tab, and the action writes through their own client. That is safe only if
 * the database itself refuses everybody else — so this pins it there:
 *
 *   1. the guest writes their own profile's name (the action's exact write:
 *      the empty parts, each matched on NULL) — the fixture is not vacuous;
 *   2. the HOST of the event that guest is linked to cannot UPDATE that
 *      profile's name — zero rows, value unchanged;
 *   3. the host editing the LINKED GUEST ROW's name does not travel into the
 *      person's profile (no trigger carries a host's typing across);
 *   4. a signed-in stranger cannot write it either.
 *
 * 🛡 Sabotage: `CREATE POLICY … ON public.users FOR UPDATE USING (true)` for
 *    authenticated → 2 and 4 go red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let HOST = '';
let GUEST_USER = '';
let STRANGER = '';
let SEAT = '';

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@host-cannot-write-profile.test`],
  );
  return u.rows[0]!.id;
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

async function profileName(uid: string) {
  const r = await db.query<{ name_prefix: string | null; first_name: string | null; middle_name: string | null; last_name: string | null }>(
    `SELECT name_prefix, first_name, middle_name, last_name FROM public.users WHERE user_id = $1`,
    [uid],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  HOST = await newUser();
  GUEST_USER = await newUser();
  STRANGER = await newUser();

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ('Claire & Jon', 'gala_night', 'host-cannot-write-profile') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, name_prefix, first_name, middle_name, last_name, side, group_category)
     VALUES ($1, 'Ms.', 'Claire', 'Estoras', 'Buanhog', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  SEAT = g.rows[0]!.guest_id;

  // The host holds the event; the guest SAVED their seat to their account.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1, $2, 'couple', NULL), ($1, $3, 'guest', $4)`,
    [EVENT, HOST, GUEST_USER, SEAT],
  );
  // The guest's profile holds a shorter name than the seat.
  await db.query(
    `UPDATE public.users SET name_prefix = NULL, first_name = 'Claire', middle_name = NULL, last_name = 'Buanhog'
      WHERE user_id = $1`,
    [GUEST_USER],
  );
});

after(async () => {
  await replay?.db?.close?.();
});

test('the guest writes their OWN profile’s empty parts — the action’s exact write', async () => {
  const r = await as(GUEST_USER, () =>
    db.query(
      `UPDATE public.users SET name_prefix = 'Ms.', middle_name = 'Estoras'
        WHERE user_id = $1 AND name_prefix IS NULL AND middle_name IS NULL
        RETURNING user_id`,
      [GUEST_USER],
    ),
  );
  assert.equal(r.rows.length, 1, 'the person cannot write their own name — the fixture proves nothing');
  assert.deepEqual(await profileName(GUEST_USER), {
    name_prefix: 'Ms.',
    first_name: 'Claire',
    middle_name: 'Estoras',
    last_name: 'Buanhog',
  });
});

test('🔒 the HOST cannot write the linked guest’s profile', async () => {
  const before = await profileName(GUEST_USER);
  const r = await as(HOST, () =>
    db.query(`UPDATE public.users SET first_name = 'Clara', middle_name = 'X' WHERE user_id = $1 RETURNING user_id`, [
      GUEST_USER,
    ]),
  );
  assert.equal(r.rows.length, 0, 'a host rewrote a guest’s profile name');
  assert.deepEqual(await profileName(GUEST_USER), before);
});

test('🔒 the host editing the linked GUEST ROW does not reach the person’s profile', async () => {
  const before = await profileName(GUEST_USER);
  const r = await as(HOST, () =>
    db.query(`UPDATE public.guests SET first_name = 'Clarita', middle_name = 'Y' WHERE guest_id = $1 RETURNING guest_id`, [
      SEAT,
    ]),
  );
  assert.equal(r.rows.length, 1, 'the host cannot edit their own guest list — this step proves nothing');
  assert.deepEqual(await profileName(GUEST_USER), before, 'a host’s typing on the guest row travelled into the profile');
});

test('🔒 a signed-in stranger cannot write it either', async () => {
  const before = await profileName(GUEST_USER);
  const r = await as(STRANGER, () =>
    db.query(`UPDATE public.users SET last_name = 'Z' WHERE user_id = $1 RETURNING user_id`, [GUEST_USER]),
  );
  assert.equal(r.rows.length, 0);
  assert.deepEqual(await profileName(GUEST_USER), before);
});
