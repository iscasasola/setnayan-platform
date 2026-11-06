/**
 * tests/db/samahan-unread-is-yours.db.test.ts — GROUP UNREAD (owner 2026-10-28, DECISION_LOG "APPROVED — RSVP ANSWERS
 * ON THE GUEST LIST + GROUP UNREAD"; migration samahan_reads).
 *
 *   1 · unread counts OTHER members' live messages newer than your marker — or than when you joined, never the epoch;
 *       your own messages and taken-down ones never count;
 *   2 · opening the group (`mark_samahan_read`) clears it; a later message lights it again;
 *   3 · a marker is YOURS: nobody reads another member's marker, writes one in another's name, or writes one on a
 *       group they are not in; a stranger's counts list no group.
 *
 * Sabotage (2026-10-28, each reverted): `AND m.user_id <> auth.uid()` dropped → 1 red; the COALESCE fallback set to
 * 'epoch' → 1 red; mark_samahan_read's membership check dropped → 3 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let a = '';
let b = '';
let outsider = '';
let group = '';
let other = '';

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await asUser(uid);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function unread(uid: string): Promise<Map<string, number>> {
  return as(uid, async () => {
    const r = await db.query<{ community_id: string; unread: number }>(`SELECT community_id, unread FROM public.samahan_unread_counts()`);
    return new Map(r.rows.map((x) => [x.community_id, x.unread]));
  });
}
async function post(uid: string, body: string, ago = '0 seconds'): Promise<void> {
  await db.query(
    `INSERT INTO public.samahan_messages (community_id, user_id, body, created_at) VALUES ($1, $2, $3, NOW() - $4::interval)`,
    [group, uid, body, ago],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  a = await mk('a@unread.test');
  b = await mk('b@unread.test');
  outsider = await mk('outsider@unread.test');
  group = (await db.query<{ community_id: string }>(`INSERT INTO public.communities (name, created_by) VALUES ('Barkada', $1) RETURNING community_id`, [a])).rows[0]!.community_id;
  other = (await db.query<{ community_id: string }>(`INSERT INTO public.communities (name, created_by) VALUES ('Other', $1) RETURNING community_id`, [outsider])).rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role, joined_at)
     VALUES ($1, $2, 'organizer', NOW() - interval '3 days'), ($1, $3, 'member', NOW() - interval '1 day'), ($4, $5, 'organizer', NOW())`,
    [group, a, b, other, outsider],
  );
  // Before B joined: never unread for B. After: two from A, one of them later taken down. One from B itself.
  await post(a, 'before you came', '2 days');
  await post(a, 'Sino may sasakyan?', '1 hour');
  await post(a, 'oops', '50 minutes');
  await db.query(`UPDATE public.samahan_messages SET deleted_at = NOW() WHERE body = 'oops'`);
  await post(b, 'ako!', '40 minutes');
});

after(async () => {
  await db.close();
});

test('1 · unread = others’ live messages since you joined — not yours, not taken down, not before you came', async () => {
  const forB = await unread(b);
  assert.equal(forB.get(group), 1, `B should have exactly 1 unread, got ${forB.get(group)}`);
  const forA = await unread(a);
  assert.equal(forA.get(group), 1, 'A’s unread is B’s one message (A’s own never count)');
  assert.equal(forB.size, 1, 'the counts list a group B is not in');
});

test('2 · opening the group marks it read; a later message lights it again', async () => {
  await as(b, () => db.query(`SELECT public.mark_samahan_read($1)`, [group]));
  assert.equal((await unread(b)).get(group), 0, 'opening the group did not clear it');
  await post(a, 'Sabado, 6 PM');
  assert.equal((await unread(b)).get(group), 1, 'a message after opening is not unread');
  await as(b, () => db.query(`SELECT public.mark_samahan_read($1)`, [group]));
  assert.equal((await unread(b)).get(group), 0);
});

test('3 · a marker is yours alone — and only on a group you are in', async () => {
  const seen = await as(a, () => db.query(`SELECT user_id FROM public.samahan_reads`));
  assert.ok(seen.rows.every((r) => (r as { user_id: string }).user_id === a), 'A reads another member’s marker');
  const forged = await as(a, () =>
    db.query(`INSERT INTO public.samahan_reads (community_id, user_id) VALUES ($1, $2)`, [group, b]).then(
      () => '',
      (e: unknown) => String(e),
    ),
  );
  assert.notEqual(forged, '', 'A wrote a marker in B’s name');
  const stranger = await as(b, () =>
    db.query(`SELECT public.mark_samahan_read($1)`, [other]).then(
      () => '',
      (e: unknown) => String(e),
    ),
  );
  assert.notEqual(stranger, '', 'B marked a group B is not in as read');
  assert.equal((await unread(outsider)).has(group), false, 'a stranger’s counts list the group');
});
