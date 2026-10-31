/**
 * a-reply-is-pushed-once.db.test.ts — THE GROUPED PHONE NOTICE'S STATE IS ON THE
 * BELL ROWS, AND A ROW IS CARRIED BY ONE NOTICE ONLY.
 *
 * Migration `20271299863206_rsvp_push_groups_on_the_bell_rows.sql` (owner
 * 2026-10-31: replies go to the phone, grouped "like facebook"). Replays every
 * migration into PGlite and runs the SAME statements `lib/rsvp-push.server.ts`
 * sends, so what is pinned is what the database does, not what a comment says:
 *
 *   1 · `notifications.pushed_at` exists, nullable, NULL on a fresh row;
 *   2 · the claim (`UPDATE … SET pushed_at WHERE id IN (…) AND pushed_at IS
 *       NULL RETURNING`) takes the rows once — the second identical claim takes
 *       NONE, so no reply is ever pushed twice;
 *   3 · the flush's read (waiting = unpushed AND unread) skips a pushed row and a
 *       row the host already read in the bell;
 *   4 · the flush's partial index exists with that predicate;
 *   5 · RLS is unchanged: a host still reads their own rows (with the new
 *       column) and cannot see another host's.
 *
 * SABOTAGE (seen red, then restored): dropped `AND pushed_at IS NULL` from the
 * claim below (2 red).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function notice(userId: string, title: string, extra = ''): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.notifications (user_id, type, title, related_url ${extra ? ', read_at' : ''})
     VALUES ($1, 'rsvp_received', $2, '/dashboard/x/guests/g' ${extra ? ', now()' : ''})
     RETURNING notification_id AS id`,
    [userId, title],
  );
  return r.rows[0]!.id;
}

/** The claim lib/rsvp-push.server.ts sends (supabase-js → PostgREST → this). */
async function claim(ids: string[]): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    `UPDATE public.notifications SET pushed_at = now()
      WHERE notification_id = ANY($1::uuid[]) AND pushed_at IS NULL
      RETURNING notification_id AS id`,
    [ids],
  );
  return r.rows.map((x) => x.id);
}

test('1 · pushed_at exists, nullable, NULL on a fresh row', async () => {
  await reset();
  const col = await db.query<{ is_nullable: string; data_type: string }>(
    `SELECT is_nullable, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'pushed_at'`,
  );
  assert.equal(col.rows.length, 1, 'notifications.pushed_at is missing');
  assert.equal(col.rows[0]!.is_nullable, 'YES');
  assert.match(col.rows[0]!.data_type, /timestamp with time zone/);
  const u = await createUser('host-fresh@example.test');
  const id = await notice(u, "Maria RSVP'd: attending");
  const r = await db.query<{ pushed_at: string | null }>(`SELECT pushed_at FROM public.notifications WHERE notification_id = $1`, [id]);
  assert.equal(r.rows[0]!.pushed_at, null);
});

test('2 · the claim takes each row once — the second identical claim takes none', async () => {
  await reset();
  const u = await createUser('host-claim@example.test');
  const a = await notice(u, "Maria RSVP'd: attending");
  const b = await notice(u, "Jose RSVP'd: not attending");
  assert.deepEqual((await claim([a, b])).sort(), [a, b].sort());
  assert.deepEqual(await claim([a, b]), [], 'a reply was claimed by two notices');
});

test('3 · the flush reads only waiting rows — unpushed and unread', async () => {
  await reset();
  const u = await createUser('host-flush@example.test');
  const waiting = await notice(u, "Ana RSVP'd: attending");
  const pushed = await notice(u, "Liza RSVP'd: attending");
  await claim([pushed]);
  const seen = await notice(u, "Ben RSVP'd: attending", 'read');
  const r = await db.query<{ id: string }>(
    `SELECT notification_id AS id FROM public.notifications
      WHERE user_id = $1 AND type = 'rsvp_received' AND pushed_at IS NULL AND read_at IS NULL
        AND created_at >= now() - interval '2 hours'`,
    [u],
  );
  const ids = r.rows.map((x) => x.id);
  assert.deepEqual(ids, [waiting]);
  assert.ok(!ids.includes(seen) && !ids.includes(pushed));
});

test('4 · the flush has its partial index', async () => {
  await reset();
  const r = await db.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'notifications_rsvp_push_waiting_idx'`,
  );
  assert.equal(r.rows.length, 1, 'the waiting-rows index is missing');
  assert.match(r.rows[0]!.indexdef, /pushed_at IS NULL/);
  assert.match(r.rows[0]!.indexdef, /read_at IS NULL/);
});

test('5 · RLS unchanged — a host reads their own rows, never another host\'s', async () => {
  await reset();
  const mine = await createUser('host-rls-a@example.test');
  const theirs = await createUser('host-rls-b@example.test');
  const myId = await notice(mine, "Maria RSVP'd: attending");
  await notice(theirs, "Jose RSVP'd: attending");
  await setAuthUid(db, mine);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ id: string; pushed_at: string | null }>(
    `SELECT notification_id AS id, pushed_at FROM public.notifications`,
  );
  await reset();
  assert.deepEqual(r.rows.map((x) => x.id), [myId]);
});
