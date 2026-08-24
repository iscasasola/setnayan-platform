/**
 * tests/db/samahan-usapan-is-members-only.db.test.ts — the samahan chat room
 * (owner 2026-08-24: "can we set a chat room on the page?").
 *
 * Four promises, each pinned by a NEGATIVE where a negative is what matters:
 *   1. members read; a non-member reads nothing;
 *   2. a member posts AS THEMSELVES — the INSERT policy's `user_id =
 *      auth.uid()` half is what stops posting in somebody else's voice
 *      (the 2026-08-12 impersonation family, which shipped EIGHT times);
 *   3. a non-member cannot post into a samahan they do not belong to;
 *   4. take-down is a SOFT delete and the ONLY edit — the UPDATE policy says
 *      "this row is yours", the trigger says which field, so an author
 *      cannot rewrite `body` after everyone has read it.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let member = '';
let other = '';
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
async function attempt(
  uid: string,
  sql: string,
  params: unknown[] = [],
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
  member = await mk('member@usapan.test');
  other = await mk('other@usapan.test');
  outsider = await mk('outsider@usapan.test');
  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Usapan Barkada', $1)
     RETURNING community_id`,
    [member],
  );
  community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'organizer'), ($1, $3, 'member')`,
    [community, member, other],
  );
});

after(async () => {
  await db.close();
});

test('a member posts, and both members read it', async () => {
  const posted = await attempt(
    member,
    `INSERT INTO public.samahan_messages (community_id, user_id, body)
     VALUES ($1, $2, 'nandito na ako')`,
    [community, member],
  );
  assert.equal(posted.error, '', `posting must not be refused: ${posted.error}`);

  await asUser(other);
  const read = await db.query(
    `SELECT body FROM public.samahan_messages WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(read.rows.length, 1, 'the other member must see it');
});

test('a NON-member reads nothing', async () => {
  await asUser(outsider);
  const read = await db.query(
    `SELECT body FROM public.samahan_messages WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(read.rows.length, 0, 'an outsider must see no messages');
});

test('🔴 nobody can post in somebody else’s voice', async () => {
  const forged = await attempt(
    other,
    `INSERT INTO public.samahan_messages (community_id, user_id, body)
     VALUES ($1, $2, 'I did not write this')`,
    [community, member],
  );
  assert.ok(
    forged.error !== '' || forged.rows === 0,
    'an insert naming another member as author must not succeed',
  );
  const count = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.samahan_messages WHERE body = 'I did not write this'`,
  );
  assert.equal(count.rows[0]!.n, 0, 'and nothing may land');
});

test('a NON-member cannot post at all', async () => {
  const r = await attempt(
    outsider,
    `INSERT INTO public.samahan_messages (community_id, user_id, body)
     VALUES ($1, $2, 'let me in')`,
    [community, outsider],
  );
  assert.ok(r.error !== '' || r.rows === 0, 'a stranger must not reach the room');
});

test('take-down is soft, and it is the ONLY edit an author gets', async () => {
  const taken = await attempt(
    member,
    `UPDATE public.samahan_messages SET deleted_at = NOW()
      WHERE community_id = $1 AND user_id = $2`,
    [community, member],
  );
  assert.equal(taken.error, '', `an author must be able to take their message down: ${taken.error}`);
  assert.equal(taken.rows, 1);

  // …but not rewrite it after the fact.
  const rewritten = await attempt(
    member,
    `UPDATE public.samahan_messages SET body = 'something else'
      WHERE community_id = $1 AND user_id = $2`,
    [community, member],
  );
  assert.match(rewritten.error, /only deleted_at may change/i, 'the body must be frozen');

  // …and cannot move it into another samahan or onto another author.
  const moved = await attempt(
    member,
    `UPDATE public.samahan_messages SET user_id = $3
      WHERE community_id = $1 AND user_id = $2`,
    [community, member, other],
  );
  assert.match(moved.error, /only deleted_at may change/i, 'authorship must be frozen');
});

test('one member cannot take DOWN another member’s message', async () => {
  await db.query(
    `INSERT INTO public.samahan_messages (community_id, user_id, body)
     VALUES ($1, $2, 'mine alone')`,
    [community, other],
  );
  const r = await attempt(
    member,
    `UPDATE public.samahan_messages SET deleted_at = NOW() WHERE body = 'mine alone'`,
  );
  assert.equal(r.rows, 0, 'the UPDATE policy scopes take-down to the author');
  const still = await db.query<{ deleted_at: string | null }>(
    `SELECT deleted_at FROM public.samahan_messages WHERE body = 'mine alone'`,
  );
  assert.equal(still.rows[0]!.deleted_at, null, 'and the message stays up');
});
