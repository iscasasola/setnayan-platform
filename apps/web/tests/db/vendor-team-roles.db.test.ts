/**
 * Vendor team roles — Financial + Secretary enum labels (DB-level regression).
 *
 * Guards migration 20271003612974_vendor_team_roles_financial_secretary.sql
 * (Vendor_Monetization_Model_LOCKED_2026-07-25 § 7): two new
 * `public.vendor_team_role` labels plus the `vendor_assignment_received`
 * notification type the assignment hook emits.
 *
 * WITHOUT the migration these tests FAIL — a `vendor_team_members` INSERT with
 * role='financial' raises 22P02 (invalid input value for enum), and the enum
 * label lists come back four/N-1 long. Verified by moving the migration aside
 * and re-running.
 *
 * Also pins the RLS consequence of widening the enum: `current_vendor_ids` must
 * stay FAIL-CLOSED for the two new labels (see the block at the bottom).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let vendorProfileId: string;

async function enumLabels(typeName: string): Promise<string[]> {
  const r = await db.query<{ label: string }>(
    `SELECT e.enumlabel AS label
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1
      ORDER BY e.enumsortorder`,
    [typeName],
  );
  return r.rows.map((x) => x.label);
}

let memberSeq = 0;

/**
 * Insert a member at `role` (each on its own fresh account — the table is
 * UNIQUE per (vendor_profile_id, user_id)). Returns the promise so callers can
 * assert resolve/reject; the role cast is what the enum actually gates.
 */
async function insertMember(role: string) {
  memberSeq += 1;
  const userId = await createUser(`vteam-roles-member-${memberSeq}@example.test`);
  return db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, $3::public.vendor_team_role)`,
    [vendorProfileId, userId, role],
  );
}

/**
 * Create an account the way Supabase does — INSERT into auth.users; the
 * `on_auth_user_created` trigger mirrors the row into public.users (whose
 * user_id has no default and is FK'd to auth.users).
 *
 * Seeded as `customer` deliberately: an `account_type: 'vendor'` signup makes
 * the same trigger auto-create a vendor_profiles row, which collides with the
 * one this test creates by hand (vendor_profiles_user_id_key).
 */
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer'::text)) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner (bypasses RLS)

  const ownerId = await createUser('vteam-roles-owner@example.test');
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'VTeam Roles Test Store') RETURNING vendor_profile_id`,
    [ownerId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the new role enum (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('vendor_team_role now carries financial + secretary', async () => {
  const labels = await enumLabels('vendor_team_role');
  assert.ok(labels.includes('financial'), `financial missing from ${labels.join(',')}`);
  assert.ok(labels.includes('secretary'), `secretary missing from ${labels.join(',')}`);
});

test('the four EXISTING roles are untouched (additive-only migration)', async () => {
  const labels = await enumLabels('vendor_team_role');
  for (const r of ['owner', 'admin', 'agent', 'viewer']) {
    assert.ok(labels.includes(r), `${r} must still exist`);
  }
  // The original four keep their original sort order — new labels append.
  assert.deepEqual(labels.slice(0, 4), ['owner', 'admin', 'agent', 'viewer']);
});

test('a Financial member INSERTs — the blocker case without the migration', async () => {
  await assert.doesNotReject(() => insertMember('financial'));
});

test('a Secretary member INSERTs', async () => {
  await assert.doesNotReject(() => insertMember('secretary'));
});

test('the existing roles still INSERT (regression)', async () => {
  await assert.doesNotReject(() => insertMember('agent'));
  await assert.doesNotReject(() => insertMember('viewer'));
  await assert.doesNotReject(() => insertMember('admin'));
});

test('a bogus role is still rejected — the enum has not become permissive', async () => {
  await assert.rejects(
    () => insertMember('superuser'),
    /invalid input value for enum|22P02/i,
  );
});

test('notification_type carries vendor_assignment_received (the assignment hook)', async () => {
  const labels = await enumLabels('notification_type');
  assert.ok(
    labels.includes('vendor_assignment_received'),
    'the assignment notice could not be inserted without this label',
  );
});

test('a vendor_assignment_received notification INSERTs', async () => {
  const agentId = await createUser('vteam-roles-agent@example.test');
  await assert.doesNotReject(() =>
    db.query(
      `INSERT INTO public.notifications (user_id, type, title, body, related_url)
       VALUES ($1, 'vendor_assignment_received', $2, $3, $4)`,
      [
        agentId,
        "You've been booked for Cruz Wedding",
        'Your team assigned this booking to you.',
        '/vendor-dashboard/customers',
      ],
    ),
  );
});

// ── RLS: the new labels must be FAIL-CLOSED in current_vendor_ids ───────────
//
// `public.current_vendor_ids(min_role)` (20260514010000) ranks the membership
// with `CASE role WHEN 'owner' THEN 4 … WHEN 'viewer' THEN 1 END` and NO ELSE,
// so an unlisted label ranks NULL and `NULL >= n` is never true — the row drops
// out. Adding enum labels therefore grants ZERO RLS access on its own, which is
// the safe direction and exactly what we want while the feature is flag-dark.
//
// These tests pin that property. If someone later adds an `ELSE` (or slots the
// new labels into the CASE) without thinking, this goes red and forces the
// question "how much should Financial actually see?" to be answered on purpose.
// ⚠ The flip side is a real, deliberate gap: until that helper is extended
// (shared RLS surface — out of this track's lane, see the report), a Financial
// or Secretary member can read NOTHING through RLS, including the billing rows
// their role exists to see.

async function insertMemberReturningUser(role: string): Promise<string> {
  memberSeq += 1;
  const userId = await createUser(`vteam-roles-rls-${memberSeq}@example.test`);
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, $3::public.vendor_team_role)`,
    [vendorProfileId, userId, role],
  );
  return userId;
}

async function vendorIdsFor(userId: string, minRole: string): Promise<string[]> {
  await setAuthUid(db, userId);
  try {
    const r = await db.query<{ id: string }>(
      `SELECT public.current_vendor_ids($1) AS id`,
      [minRole],
    );
    return r.rows.map((x) => x.id);
  } finally {
    await setAuthUid(db, null);
  }
}

test('FAIL-CLOSED: a Financial member gets NO vendor ids from current_vendor_ids', async () => {
  const userId = await insertMemberReturningUser('financial');
  for (const minRole of ['viewer', 'agent', 'admin', 'owner']) {
    assert.deepEqual(
      await vendorIdsFor(userId, minRole),
      [],
      `financial must not pass current_vendor_ids('${minRole}')`,
    );
  }
});

test('FAIL-CLOSED: a Secretary member gets NO vendor ids either', async () => {
  const userId = await insertMemberReturningUser('secretary');
  assert.deepEqual(await vendorIdsFor(userId, 'viewer'), []);
});

test('the existing roles still pass current_vendor_ids (no collateral damage)', async () => {
  const viewerId = await insertMemberReturningUser('viewer');
  assert.deepEqual(await vendorIdsFor(viewerId, 'viewer'), [vendorProfileId]);
  assert.deepEqual(await vendorIdsFor(viewerId, 'agent'), []); // still outranked

  const adminId = await insertMemberReturningUser('admin');
  assert.deepEqual(await vendorIdsFor(adminId, 'viewer'), [vendorProfileId]);
  assert.deepEqual(await vendorIdsFor(adminId, 'admin'), [vendorProfileId]);
  assert.deepEqual(await vendorIdsFor(adminId, 'owner'), []);
});
