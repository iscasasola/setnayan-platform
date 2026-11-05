/**
 * an-iphone-token-is-a-push-subscription.db.test.ts — THE APP'S APNs TOKEN LIVES
 * NEXT TO THE BROWSER SUBSCRIPTIONS, UNDER THE SAME RULES.
 *
 * Migration `20271300404545_push_subscriptions_carry_apns_device_tokens.sql`
 * (owner 2026-10-31: "The notification on the phone not on the app"). Replays
 * every migration into PGlite and pins what the database does:
 *   1 · every existing-shaped row is `kind = 'web'` by default;
 *   2 · an 'apns' row needs no Web Push keys; a 'web' row without them is refused;
 *   3 · only 'web' and 'apns' are kinds;
 *   4 · RLS is the owner's, unchanged: a person writes and reads their own token,
 *       and cannot see somebody else's;
 *   5 · one token is one row (UNIQUE endpoint) — a re-registration collapses.
 *
 * SABOTAGE (seen red, then restored): dropped the web-has-keys CHECK (2 red).
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
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
const TOKEN = 'ab'.repeat(32);

test('1 · a browser row is kind web by default', async () => {
  await reset();
  const u = await createUser('push-web@example.test');
  const r = await db.query<{ kind: string }>(
    `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.example/1', 'k', 'a') RETURNING kind`,
    [u],
  );
  assert.equal(r.rows[0]!.kind, 'web');
});

test('2 · an apns row needs no keys; a web row without keys is refused', async () => {
  await reset();
  const u = await createUser('push-apns@example.test');
  await db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, $2, 'apns')`, [u, TOKEN]);
  await assert.rejects(
    db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, 'https://push.example/2', 'web')`, [u]),
    /push_subscriptions_web_has_keys/,
  );
});

test('3 · only web and apns are kinds', async () => {
  await reset();
  const u = await createUser('push-kind@example.test');
  await assert.rejects(
    db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, 'fcm-token', 'fcm')`, [u]),
    /push_subscriptions_kind_check/,
  );
});

test('4 · RLS: your own token only', async () => {
  const mine = await createUser('push-rls-a@example.test');
  const theirs = await createUser('push-rls-b@example.test');
  const t = 'cd'.repeat(32);
  await asUser(mine);
  await db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, $2, 'apns')`, [mine, t]);
  const own = await db.query(`SELECT 1 FROM public.push_subscriptions WHERE endpoint = $1`, [t]);
  assert.equal(own.rows.length, 1);
  await asUser(theirs);
  const other = await db.query(`SELECT 1 FROM public.push_subscriptions WHERE endpoint = $1`, [t]);
  assert.equal(other.rows.length, 0, 'another user can read an iPhone token');
  await assert.rejects(
    db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, $2, 'apns')`, [mine, 'ef'.repeat(32)]),
  );
  await reset();
});

test('5 · one token is one row', async () => {
  await reset();
  const u = await createUser('push-unique@example.test');
  const t = '12'.repeat(32);
  await db.query(`INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, $2, 'apns')`, [u, t]);
  await db.query(
    `INSERT INTO public.push_subscriptions (user_id, endpoint, kind) VALUES ($1, $2, 'apns')
     ON CONFLICT (endpoint) DO UPDATE SET last_seen_at = now()`,
    [u, t],
  );
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.push_subscriptions WHERE endpoint = $1`, [t]);
  assert.equal(r.rows[0]!.n, 1);
});
