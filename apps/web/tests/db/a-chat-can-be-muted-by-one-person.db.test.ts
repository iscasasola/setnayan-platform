/**
 * 🔕 A CHAT CAN BE MUTED BY ONE PERSON — the database half of Unichat "Mute this chat" (controller ruling 21 Nov 2026:
 * per person, all their devices; nobody else is affected). Migration 20271356402294.
 *
 *   1 · A person mutes and unmutes THEIR OWN row (insert · read · delete), through RLS as themselves.
 *   2 · Nobody can mute for someone else (WITH CHECK user_id = auth.uid()), and nobody reads another person's mute —
 *       the other side is never told.
 *   3 · A signed-in session cannot UPDATE a mute (only insert/delete are granted), and anon reaches nothing.
 *   4 · The row goes with its chat (ON DELETE CASCADE on the thread).
 *   5 · `vendor_push_tokens.user_id` exists (nullable): the shop-wide push can now leave out one member's devices.
 *
 * Sabotage (21 Nov 2026, measured): the policy's WITH CHECK widened to `true` → 2 RED (a mute written for someone
 * else). `GRANT UPDATE` added → 3 RED.
 *
 * Run: cd apps/web && npx tsx --test tests/db/a-chat-can-be-muted-by-one-person.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let host: string;
let supplier: string;
let thread: string;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`,
    [email, accountType],
  );
}

/** Run `sql` as a signed-in person (RLS on). Returns the rows, or throws what the database threw. */
async function asUser(uid: string, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return (await db.query<Record<string, unknown>>(sql, params)).rows;
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  host = await newUser('mute-host@test.test', 'customer');
  supplier = await newUser('mute-shop@test.test', 'vendor');
  // A vendor sign-up may already hold its shop row (the sign-up trigger) — reuse it, as the other DB tests do.
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [supplier]);
  const shop =
    existing.rows[0]?.vendor_profile_id ??
    (await one<string>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
       VALUES ($1, 'Lumina Lights', 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
      [supplier],
    ));
  const eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Ana turns 30', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host]);
  thread = await one<string>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id AS v`,
    [eventId, shop, host],
  );
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the per-person mute', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · a person mutes, reads and unmutes their own chat', async () => {
  await asUser(host, `INSERT INTO public.chat_thread_mutes (thread_id, user_id) VALUES ($1, $2)`, [thread, host]);
  assert.equal((await asUser(host, `SELECT 1 FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread])).length, 1);
  await asUser(host, `DELETE FROM public.chat_thread_mutes WHERE thread_id = $1 AND user_id = $2`, [thread, host]);
  assert.equal(Number(await one<string>(`SELECT count(*)::text AS v FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread])), 0);
});

test('2 · nobody mutes for someone else, and nobody reads another person’s mute', async () => {
  await assert.rejects(
    asUser(supplier, `INSERT INTO public.chat_thread_mutes (thread_id, user_id) VALUES ($1, $2)`, [thread, host]),
    /row-level security|violates/i,
    'a mute was written for someone else',
  );
  await asUser(host, `INSERT INTO public.chat_thread_mutes (thread_id, user_id) VALUES ($1, $2)`, [thread, host]);
  assert.equal((await asUser(supplier, `SELECT 1 FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread])).length, 0, 'the other side can see the mute');
  // The supplier cannot remove the host's mute either (their delete reaches no row).
  await asUser(supplier, `DELETE FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread]);
  assert.equal(Number(await one<string>(`SELECT count(*)::text AS v FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread])), 1);
});

test('3 · a mute is never updated in place, and anon reaches nothing', async () => {
  await assert.rejects(
    asUser(host, `UPDATE public.chat_thread_mutes SET muted_at = now() WHERE thread_id = $1`, [thread]),
    /permission denied/i,
    'a signed-in session may UPDATE a mute',
  );
  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(db.query(`SELECT 1 FROM public.chat_thread_mutes`), /permission denied/i, 'anon reads mutes');
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('4 · the mute goes with its chat', async () => {
  await db.query(`DELETE FROM public.chat_threads WHERE thread_id = $1`, [thread]);
  assert.equal(Number(await one<string>(`SELECT count(*)::text AS v FROM public.chat_thread_mutes WHERE thread_id = $1`, [thread])), 0);
});

test('5 · a shop device now says whose phone it is (nullable — older devices are still sent)', async () => {
  const col = await db.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendor_push_tokens' AND column_name = 'user_id'`,
  );
  assert.equal(col.rows[0]?.is_nullable, 'YES');
});
