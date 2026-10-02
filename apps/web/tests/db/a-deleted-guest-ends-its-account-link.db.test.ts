/**
 * A REMOVED GUEST ENDS ITS ACCOUNT LINK — asserted against the REPLAYED schema,
 * because the thing that ends it is a trigger, not a screen.
 *
 * ── THE INCIDENT (live test, prod 5666406, 2026-10-02) ───────────────────────
 * A host removed a guest (soft-delete). The account that had saved that
 * invitation kept its `event_members` row (member_type 'guest', guest_id → the
 * removed row), so its Home still said "You're invited" — onto a hub that said
 * "You're not on the guest list for this event yet".
 *
 * ── What is pinned ─────────────────────────────────────────────────────────
 *   1. a soft-delete BY THE COUPLE'S OWN SESSION (the card / swipe / bulk
 *      shape) ends the guest membership — the trigger runs as definer, since
 *      the couple's RLS could never delete another account's row;
 *   2. RESTORING the row does not bring the link back;
 *   3. a HARD delete ends it too (and the guest row really is deleted — the
 *      BEFORE DELETE trigger returns OLD), instead of the FK's SET NULL leaving
 *      a seatless "invited" membership;
 *   4. a Co-host / helper membership through the row is NOT ended here (the
 *      line Unlink draws — `holds_access`);
 *   5. Home's read: a membership that outlived its row (trigger off — the
 *      defence-in-depth case) reads its seat back as null under the account's
 *      own RLS, and `anInvitationStillOnTheList` drops it; a live one stays;
 *   6. the migration's DATA REPAIR block removes EXACTLY the guest memberships
 *      on removed rows — nothing live, nothing non-guest, nothing seatless.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { anInvitationStillOnTheList } from '../../lib/event-board';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let CREATOR = '';
const SOFT_TRIGGER = 'a_removed_guest_ends_its_account_link';
const HARD_TRIGGER = 'a_deleted_guest_ends_its_account_link';

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@deleted-guest.test`],
  );
  return u.rows[0]!.id;
}

async function guest(first: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, $2, 'Cruz', 'both', 'friends') RETURNING guest_id`,
    [EVENT, first],
  );
  return g.rows[0]!.guest_id;
}

async function link(userId: string, guestId: string | null, memberType = 'guest'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, $3::public.member_type, 'guest_signup', $4)`,
    [EVENT, userId, memberType, guestId],
  );
}

async function membershipsOf(userId: string): Promise<{ member_type: string; guest_id: string | null }[]> {
  const r = await db.query<{ member_type: string; guest_id: string | null }>(
    `SELECT member_type::text AS member_type, guest_id FROM public.event_members
      WHERE event_id = $1 AND user_id = $2`,
    [EVENT, userId],
  );
  return r.rows;
}

/** Run as the couple's own session — the card / swipe / bulk delete shape. */
async function asCouple<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, CREATOR);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

/** Fixture rows that outlived their guest — made with both triggers OFF. */
async function withTriggersOff(fn: () => Promise<void>): Promise<void> {
  await db.exec(`ALTER TABLE public.guests DISABLE TRIGGER ${SOFT_TRIGGER}`);
  await db.exec(`ALTER TABLE public.guests DISABLE TRIGGER ${HARD_TRIGGER}`);
  try {
    await fn();
  } finally {
    await db.exec(`ALTER TABLE public.guests ENABLE TRIGGER ${SOFT_TRIGGER}`);
    await db.exec(`ALTER TABLE public.guests ENABLE TRIGGER ${HARD_TRIGGER}`);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  CREATOR = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Removed Guest Party', 'birthday', '2027-07-07'::date, 'day', 'NCR') RETURNING event_id`,
  );
  EVENT = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [EVENT, CREATOR],
  );
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

test('1 · the couple removes a saved guest → that account’s membership is gone', async () => {
  const acct = await newUser();
  const g = await guest('Removed');
  await link(acct, g);
  assert.equal((await membershipsOf(acct)).length, 1, 'fixture: the account holds the invitation');

  const updated = await asCouple(async () =>
    (await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [g])).affectedRows,
  );
  assert.equal(updated, 1, 'the couple’s own session could not remove its guest (RLS fixture broke)');
  assert.deepEqual(await membershipsOf(acct), [], 'removing the guest left the account linked to it');
});

test('2 · restoring the guest does NOT re-link the account', async () => {
  const acct = await newUser();
  const g = await guest('Restored');
  await link(acct, g);
  await asCouple(() => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [g]));
  await asCouple(() => db.query(`UPDATE public.guests SET deleted_at = NULL WHERE guest_id = $1`, [g]));
  const live = await db.query(`SELECT 1 FROM public.guests WHERE guest_id = $1 AND deleted_at IS NULL`, [g]);
  assert.equal(live.rows.length, 1, 'fixture: the row is back on the list');
  assert.deepEqual(await membershipsOf(acct), [], 'a restore silently handed the invitation back');
});

test('3 · a hard delete ends the link too — and the row really is deleted (BEFORE DELETE returns OLD)', async () => {
  const acct = await newUser();
  const g = await guest('Hard');
  await link(acct, g);
  await db.query(`DELETE FROM public.guests WHERE guest_id = $1`, [g]);
  const still = await db.query(`SELECT 1 FROM public.guests WHERE guest_id = $1`, [g]);
  assert.equal(still.rows.length, 0, 'the trigger swallowed the DELETE (did not RETURN OLD)');
  assert.deepEqual(
    await membershipsOf(acct),
    [],
    'a hard delete left a seatless "invited" membership (FK SET NULL) behind',
  );
});

test('4 · a Co-host / helper membership through the row is not ended here', async () => {
  const acct = await newUser();
  const g = await guest('Helper');
  await link(acct, g, 'coordinator');
  await asCouple(() => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [g]));
  assert.deepEqual(
    (await membershipsOf(acct)).map((m) => m.member_type),
    ['coordinator'],
    'a helper’s access was ended by a guest removal — that has its own door',
  );
});

test('5 · Home: a membership that outlived its row reads no seat and is dropped; a live one stays', async () => {
  const acct = await newUser();
  const other = await newUser();
  const gone = await guest('Outlived');
  const kept = await guest('Kept');
  await link(acct, gone);
  await link(other, kept);
  await withTriggersOff(async () => {
    await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [gone]);
  });
  assert.equal((await membershipsOf(acct)).length, 1, 'fixture: the stale membership survived');

  // The fetchUserEvents shape: the membership plus its guest row (embedded on
  // event_members_guest_id_fkey), read under the ACCOUNT'S OWN session.
  async function homeRowsFor(userId: string) {
    await db.exec('SET ROLE authenticated');
    await setAuthUid(db, userId);
    try {
      const r = await db.query<{ member_type: string; guest_id: string | null; seat: string | null }>(
        `SELECT em.member_type::text AS member_type, em.guest_id, g.guest_id AS seat
           FROM public.event_members em
           LEFT JOIN public.guests g ON g.guest_id = em.guest_id
          WHERE em.user_id = $1`,
        [userId],
      );
      return r.rows;
    } finally {
      await db.exec('RESET ROLE');
      await setAuthUid(db, null);
    }
  }

  const stale = await homeRowsFor(acct);
  assert.equal(stale.length, 1, 'fixture: the account can read its own membership');
  assert.equal(stale[0]!.seat, null, 'a removed guest row is still readable by the account');
  assert.equal(
    stale.filter((r) => anInvitationStillOnTheList({ ...r, member_type: r.member_type as 'guest' })).length,
    0,
    'Home still shows "You’re invited" for a removed guest',
  );

  const live = await homeRowsFor(other);
  assert.equal(live[0]!.seat, kept, 'control: a live invitation reads its seat');
  assert.equal(
    live.filter((r) => anInvitationStillOnTheList({ ...r, member_type: r.member_type as 'guest' })).length,
    1,
    'control: Home dropped a live invitation',
  );
});

test('6 · the DATA REPAIR removes exactly the guest memberships on removed rows', async () => {
  // Orphans of every shape, made the way prod made them (triggers absent).
  const orphanA = await newUser();
  const orphanB = await newUser();
  const helper = await newUser();
  const liveAcct = await newUser();
  const seatless = await newUser();
  const gA = await guest('OrphanA');
  const gB = await guest('OrphanB');
  const gHelper = await guest('OrphanHelper');
  const gLive = await guest('Live');
  await link(orphanA, gA);
  await link(orphanB, gB);
  await link(helper, gHelper, 'coordinator');
  await link(liveAcct, gLive);
  await link(seatless, null);
  await withTriggersOff(async () => {
    await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = ANY($1::uuid[])`, [
      [gA, gB, gHelper],
    ]);
  });

  const expected = await db.query<{ id: string }>(
    `SELECT em.id::text AS id FROM public.event_members em
       JOIN public.guests g ON g.guest_id = em.guest_id
      WHERE em.member_type = 'guest' AND g.deleted_at IS NOT NULL ORDER BY em.id`,
  );
  const before = await db.query<{ id: string }>(`SELECT id::text AS id FROM public.event_members ORDER BY id`);

  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_a_deleted_guest_ends_its_account_link.sql'));
  assert.ok(file, 'the repair migration is missing');
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const block = /-- REPAIR:BEGIN\n([\s\S]*?)-- REPAIR:END/.exec(sql)?.[1];
  assert.ok(block && /DELETE FROM public\.event_members/.test(block), 'the REPAIR block markers moved');
  await db.exec(block);

  const afterIds = new Set(
    (await db.query<{ id: string }>(`SELECT id::text AS id FROM public.event_members`)).rows.map((r) => r.id),
  );
  const removed = before.rows.map((r) => r.id).filter((id) => !afterIds.has(id));
  assert.ok(expected.rows.length >= 2, 'fixture: at least the two orphans exist');
  assert.deepEqual(removed, expected.rows.map((r) => r.id), 'the repair touched a row that was not orphaned');
  assert.deepEqual(await membershipsOf(orphanA), []);
  assert.deepEqual(await membershipsOf(orphanB), []);
  assert.equal((await membershipsOf(helper)).length, 1, 'the repair ended a helper’s access');
  assert.equal((await membershipsOf(liveAcct)).length, 1, 'the repair ended a live invitation');
  assert.equal((await membershipsOf(seatless)).length, 1, 'the repair ended a membership with no row named');
});
