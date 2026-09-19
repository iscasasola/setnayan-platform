/**
 * The shot list reaches the couple (DAY-10) — END-TO-END DB verification.
 *
 * Covers 20271234188149_event_shot_list_items. Every claim is a boundary, so
 * each is asserted against replayed SQL:
 *
 *   • anon holds nothing (the REVOKE is load-bearing on this project);
 *   • the booked photographer writes their OWN list on their event;
 *   • the couple READS it — the whole point — and cannot write it;
 *   • another booked supplier cannot read or write the photographer's list,
 *     and cannot forge a row in the photographer's name;
 *   • an unbooked supplier cannot write to an event they are not on;
 *   • a stranger reads nothing.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function createUser(email: string) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function createVendor(userId: string, name: string, services: string[]) {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, name, services],
  );
  return r.rows[0]!.vendor_profile_id;
}
async function bookVendor(eventId: string, vendorProfileId: string, category: string, status = 'contracted') {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, $2, 'Booked', $3, 100000, $4)`,
    [eventId, category, status, vendorProfileId],
  );
}

const F = {
  eventId: '',
  otherEventId: '',
  couple: '',
  photoUser: '',
  photoVendor: '',
  caterUser: '',
  caterVendor: '',
  outsiderUser: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  F.couple = await createUser('couple@shot-list.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Shot List Test', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Someone Else', 'birthday') RETURNING event_id`,
  );
  F.otherEventId = other.rows[0]!.event_id;

  F.photoUser = await createUser('photo@shot-list.test');
  F.photoVendor = await createVendor(F.photoUser, 'Photo Co', ['photo_video']);
  await bookVendor(F.eventId, F.photoVendor, 'photographer');

  F.caterUser = await createUser('cater@shot-list.test');
  F.caterVendor = await createVendor(F.caterUser, 'Cater Co', ['catering']);
  await bookVendor(F.eventId, F.caterVendor, 'catering');

  F.outsiderUser = await createUser('outsider@shot-list.test');
});

after(async () => {
  await db?.close?.();
});

async function insertAs(uid: string, eventId: string, vendorProfileId: string, label: string) {
  await asUser(uid);
  return db.query<{ item_id: string }>(
    `INSERT INTO public.event_shot_list_items (event_id, vendor_profile_id, label, position)
     VALUES ($1, $2, $3, 0) RETURNING item_id`,
    [eventId, vendorProfileId, label],
  );
}

/**
 * The refusal cases insert WITHOUT `RETURNING`. With it, the SELECT-side
 * policy also has to admit the new row, so a refusal proves nothing about the
 * WITH CHECK — measured: dropping the booked-event leg from WITH CHECK left
 * every RETURNING-shaped refusal green.
 */
async function bareInsertAs(uid: string, eventId: string, vendorProfileId: string, label: string) {
  await asUser(uid);
  await db.query(
    `INSERT INTO public.event_shot_list_items (event_id, vendor_profile_id, label, position)
     VALUES ($1, $2, $3, 0)`,
    [eventId, vendorProfileId, label],
  );
}

// ─── 1 · Privileges ────────────────────────────────────────────────────────

test('anon holds NO privilege; authenticated holds exactly S/I/U/D; RLS is on', async () => {
  await asOwner();
  const anon = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'event_shot_list_items' AND grantee = 'anon'`,
  );
  assert.equal(anon.rows.length, 0, `anon holds ${anon.rows.map((x) => x.privilege_type).join(',')}`);

  const authd = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'event_shot_list_items' AND grantee = 'authenticated'`,
  );
  const got = [...new Set(authd.rows.map((x) => x.privilege_type))].sort();
  assert.ok(got.includes('SELECT') && got.includes('DELETE'), `authenticated table grants: ${got.join(',')}`);
  assert.ok(!got.includes('TRUNCATE') && !got.includes('REFERENCES') && !got.includes('TRIGGER'), got.join(','));

  const rls = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'event_shot_list_items'`,
  );
  assert.equal(rls.rows[0]?.relrowsecurity, true);
});

// ─── 2 · The supplier writes, the couple reads ─────────────────────────────

test('the booked photographer writes their own list, and can tick a shot off', async () => {
  const r = await insertAs(F.photoUser, F.eventId, F.photoVendor, 'The kiss');
  assert.equal(r.rows.length, 1);
  const upd = await db.query<{ captured_at: string | null }>(
    `UPDATE public.event_shot_list_items SET captured_at = NOW() WHERE item_id = $1 RETURNING captured_at`,
    [r.rows[0]!.item_id],
  );
  assert.equal(upd.rows.length, 1);
  assert.ok(upd.rows[0]!.captured_at);
  await insertAs(F.photoUser, F.eventId, F.photoVendor, 'First dance');
});

test('THE COUPLE READS THE LIST — the thing DAY-10 was about', async () => {
  await asUser(F.couple);
  const r = await db.query<{ label: string; captured_at: string | null }>(
    `SELECT label, captured_at FROM public.event_shot_list_items WHERE event_id = $1 ORDER BY label`,
    [F.eventId],
  );
  assert.deepEqual(r.rows.map((x) => x.label), ['First dance', 'The kiss']);
  assert.ok(r.rows.find((x) => x.label === 'The kiss')!.captured_at, 'and sees what has been captured');
});

test('the couple cannot write the supplier’s list', async () => {
  await assert.rejects(() => bareInsertAs(F.couple, F.eventId, F.photoVendor, 'Sneaky'));
  await asUser(F.couple);
  const upd = await db.query(
    `UPDATE public.event_shot_list_items SET label = 'Changed' WHERE event_id = $1 RETURNING item_id`,
    [F.eventId],
  );
  assert.equal(upd.rows.length, 0);
  const del = await db.query(
    `DELETE FROM public.event_shot_list_items WHERE event_id = $1 RETURNING item_id`,
    [F.eventId],
  );
  assert.equal(del.rows.length, 0);
});

// ─── 3 · Other suppliers and strangers ─────────────────────────────────────

test('another booked supplier neither reads the list nor forges a row in the photographer’s name', async () => {
  await asUser(F.caterUser);
  const r = await db.query(`SELECT * FROM public.event_shot_list_items WHERE event_id = $1`, [F.eventId]);
  assert.equal(r.rows.length, 0);
  await assert.rejects(() => bareInsertAs(F.caterUser, F.eventId, F.photoVendor, 'Forged'));
  await asUser(F.caterUser);
  const upd = await db.query(
    `UPDATE public.event_shot_list_items SET captured_at = NULL WHERE event_id = $1 RETURNING item_id`,
    [F.eventId],
  );
  assert.equal(upd.rows.length, 0);
});

test('a supplier cannot write to an event they are not booked on', async () => {
  await assert.rejects(() => bareInsertAs(F.photoUser, F.otherEventId, F.photoVendor, 'Wrong wedding'));
});

test('event_id and vendor_profile_id are not updatable at all — the grant, not only RLS', async () => {
  await asOwner();
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.column_privileges
     WHERE table_schema = 'public' AND table_name = 'event_shot_list_items'
       AND grantee = 'authenticated' AND privilege_type = 'UPDATE' ORDER BY column_name`,
  );
  assert.deepEqual(r.rows.map((x) => x.column_name), ['captured_at', 'label', 'position']);
});

test('an UPDATE cannot move a row onto another event', async () => {
  await asUser(F.photoUser);
  await assert.rejects(() =>
    db.query(
      `UPDATE public.event_shot_list_items SET event_id = $2 WHERE event_id = $1`,
      [F.eventId, F.otherEventId],
    ),
  );
});

test('a stranger reads nothing', async () => {
  await asUser(F.outsiderUser);
  const r = await db.query(`SELECT * FROM public.event_shot_list_items`);
  assert.equal(r.rows.length, 0);
});

test('a blank label is refused by the CHECK', async () => {
  await assert.rejects(() => bareInsertAs(F.photoUser, F.eventId, F.photoVendor, '   '));
});
