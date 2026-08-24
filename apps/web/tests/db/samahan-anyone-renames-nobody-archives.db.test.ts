/**
 * tests/db/samahan-anyone-renames-nobody-archives.db.test.ts — the widened
 * community UPDATE policy gives every member the NAME and the PHOTO, and
 * nothing else (owner 2026-08-24: "anyone can rename … place a photo/logo").
 *
 * The policy is ROW-level, so on its own it would also hand every member the
 * archive switch, the kind, and the identity columns — the
 * row-is-yours-field-is-not failure shape (2026-08-12, 8 CVEs). The
 * communities_member_field_guard trigger is what scopes it, and this file
 * pins that boundary in BOTH directions: what a member now CAN do, and what
 * the widening must NOT have handed them.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let organiser = '';
let member = '';
let outsider = '';
let community = '';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
/** Run one UPDATE as uid; returns {rows, error}. RLS refusals surface as 0
 *  rows, trigger refusals as an error — a guard has to tell them apart. */
async function tryUpdate(
  uid: string,
  sql: string,
  params: unknown[],
): Promise<{ rows: number; error: string }> {
  await asUser(uid);
  try {
    const res = await db.query(sql, params);
    return { rows: res.affectedRows ?? 0, error: '' };
  } catch (e) {
    return { rows: 0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    );
    return r.rows[0]!.id;
  };
  organiser = await mk('org@face.test');
  member = await mk('member@face.test');
  outsider = await mk('outsider@face.test');
  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Barkada Face', $1)
     RETURNING community_id`,
    [organiser],
  );
  community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'organizer'), ($1, $3, 'member')`,
    [community, organiser, member],
  );
});

after(async () => {
  await db.close();
});

test('a PLAIN MEMBER renames the samahan and sets its photo', async () => {
  const r = await tryUpdate(
    member,
    `UPDATE public.communities
        SET name = 'Barkada Renamed',
            photo_url = 'r2://setnayan-media/samahan/x/photo.jpg'
      WHERE community_id = $1`,
    [community],
  );
  assert.equal(r.error, '', `the rename must not be refused: ${r.error}`);
  assert.equal(r.rows, 1, 'the rename must reach the row');
});

test('a NON-member changes nothing — RLS, zero rows, no oracle', async () => {
  const r = await tryUpdate(
    outsider,
    `UPDATE public.communities SET name = 'Taken Over' WHERE community_id = $1`,
    [community],
  );
  assert.equal(r.rows, 0, 'an outsider must match zero rows');
});

test('the widening did NOT hand a member the archive switch', async () => {
  const r = await tryUpdate(
    member,
    `UPDATE public.communities SET archived = TRUE WHERE community_id = $1`,
    [community],
  );
  // ⚖ SUPERSEDED REASON, same refusal. This used to read /only an organizer/;
  // the owner's 2026-08-24 ruling ("for as long as there is one, the group
  // lives") means NOBODY may close a samahan that still holds people, so the
  // trigger now refuses on the ROSTER rather than on the role.
  assert.match(r.error, /lives while anyone is still in it/i, 'the trigger must refuse, loudly');
  const still = await db.query<{ archived: boolean }>(
    `SELECT archived FROM public.communities WHERE community_id = $1`,
    [community],
  );
  assert.equal(still.rows[0]!.archived, false, 'and the row must be untouched');
});

test('identity is immutable for EVERYONE below the service role — organizer included', async () => {
  for (const uid of [member, organiser]) {
    // Point created_by at a DIFFERENT account — assigning its current value
    // is a no-op the trigger rightly ignores, and the first cut of this test
    // did exactly that for the organizer and read the silence as a failure.
    const r = await tryUpdate(
      uid,
      `UPDATE public.communities SET created_by = $2 WHERE community_id = $1`,
      [community, outsider],
    );
    assert.match(r.error, /identity fields are immutable/i, `created_by must be locked for ${uid}`);
  }
});

test('⚖ NOR AN ORGANIZER — owner 2026-08-24 supersedes this test’s original claim', async () => {
  // 🛑 This test used to assert the OPPOSITE: "an ORGANIZER can still archive
  // — the guard scopes members, not organizers." That was true for exactly
  // one day. The owner then ruled: "the only way to close a group/samahan is
  // when all members leave the samahan. but for as long as there is one, the
  // group lives." Closing is not an act performed on other people, whatever
  // the role. Rewritten rather than deleted, so the reversal is visible to
  // whoever reads this next.
  const r = await tryUpdate(
    organiser,
    `UPDATE public.communities SET archived = TRUE WHERE community_id = $1`,
    [community],
  );
  assert.match(r.error, /lives while anyone is still in it/i, 'an organizer is refused too');
  const still = await db.query<{ archived: boolean }>(
    `SELECT archived FROM public.communities WHERE community_id = $1`,
    [community],
  );
  assert.equal(still.rows[0]!.archived, false, 'the samahan stays open');
});
