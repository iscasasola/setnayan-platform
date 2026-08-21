/**
 * tests/db/samahan-is-asked-never-assigned.db.test.ts — nobody puts a person in
 * a samahan. They are asked, and they open the link themselves.
 *
 * ── WHY THIS TEST EXISTS ───────────────────────────────────────────────────
 * The People roster grew a "+ Samahan" chip on a connected person's row (owner
 * 2026-08-21: *"Then you can set a label. or a samahan, just like the guest
 * list"*). A guest GROUP is the host's own private label, so the guest list can
 * simply write one. A samahan is a group of accounts with a roster its members
 * can read — and `community_members` has exactly ONE insert policy, admin-only.
 *
 * So the chip sends an invitation rather than writing a membership. That is a
 * product decision made BY the database, and this file pins the premise it rests
 * on: if a future migration ever lets an organiser (or anyone else) insert a
 * membership directly, the reasoning behind that chip has quietly changed and
 * somebody should re-read it before the UI follows.
 *
 * Every assertion below is a NEGATIVE. A test that only proves the happy path
 * would pass just as well with the door wide open.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let organiser = '';
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
async function attempt(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
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
  organiser = await mk('organiser@samahan.test');
  outsider = await mk('outsider@samahan.test');

  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Barkada 08', $1)
     RETURNING community_id`,
    [organiser],
  );
  community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'organizer')`,
    [community, organiser],
  );
  await db.query(
    `INSERT INTO public.community_invite_tokens (community_id, token, created_by)
     VALUES ($1, 'tok_barkada_08', $2)`,
    [community, organiser],
  );
});

after(async () => {
  await db.close();
});

test('🔴 an ORGANISER cannot put somebody into their own samahan', async () => {
  // This is the premise the "+ Samahan" chip is built on. If it ever passes,
  // the chip's whole justification has changed.
  const err = await attempt(
    organiser,
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'member')`,
    [community, outsider],
  );
  assert.ok(err, 'an organiser inserted a membership — the invitation model is no longer forced');
  assert.match(err!, /row-level security|policy/i);
});

test('🔒 nor can a stranger add themselves', async () => {
  const err = await attempt(
    outsider,
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'member')`,
    [community, outsider],
  );
  assert.ok(err, 'anybody could walk into any samahan');
});

test('the organiser CAN read the standing link — that is what the chip sends', async () => {
  await asUser(organiser);
  const r = await db.query<{ token: string }>(
    `SELECT token FROM public.community_invite_tokens WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(r.rows[0]?.token, 'tok_barkada_08');
});

test('🔒 a non-organiser cannot read it — so the chip cannot offer a link they lack', async () => {
  // The roster only lists samahan this account ORGANISES, and this is why:
  // anything else would render a control whose action the database refuses.
  await asUser(outsider);
  const r = await db.query(
    `SELECT token FROM public.community_invite_tokens WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(r.rows.length, 0, 'the standing invite link leaked to a non-organiser');
});

test('the roster read is scoped by MY membership, never by the policy alone', async () => {
  // `community_roster_member_read` carries `OR is_admin()`, and production's
  // admin is the owner's own account — so a roster that leaned on the policy
  // would show him every group in the database. The outsider proves the floor:
  // no membership, no rows.
  await asUser(outsider);
  const r = await db.query(`SELECT community_id FROM public.community_members`);
  await reset();
  assert.equal(r.rows.length, 0);
});
