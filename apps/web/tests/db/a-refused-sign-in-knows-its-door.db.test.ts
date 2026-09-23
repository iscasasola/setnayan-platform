/**
 * a-refused-sign-in-knows-its-door.db.test.ts
 *
 * `public.sign_in_door_for_email(p_email)` — after a FAILED password sign-in,
 * does this email have a password, and which providers does it use?
 * (migration 20271242648512; owner 2026-09-23: "we also need to detect if they
 * are a google account".) Measured on prod that day: 3 of 11 real accounts are
 * Google-only with NO password, and the app told them "wrong password".
 *
 * Exercised here on the replayed schema, with the harness's auth.users stub:
 *   • a Google-only row (encrypted_password NULL, providers ['google'])
 *   • an email+password row (providers ['email'])
 *   • a linked row (password AND google)
 *   • no row at all
 * and the grant: anon and authenticated are REFUSED, service_role is not.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function seed(email: string, password: string | null, providers: string[]): Promise<void> {
  await db.query(
    `INSERT INTO auth.users (email, encrypted_password, raw_app_meta_data)
     VALUES ($1, $2, jsonb_build_object('provider', $3::text, 'providers', to_jsonb($4::text[])))`,
    [email, password, providers[0] ?? null, providers],
  );
}

async function door(email: string): Promise<{ has_password: boolean; providers: string[] }[]> {
  const r = await db.query<{ has_password: boolean; providers: string[] }>(
    `SELECT has_password, providers FROM public.sign_in_door_for_email($1)`,
    [email],
  );
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await seed('google-only@example.com', null, ['google']);
  await seed('password@example.com', '$2a$10$notarealhashbutnotnull', ['email']);
  await seed('linked@example.com', '$2a$10$notarealhashbutnotnull', ['email', 'google']);
  await seed('apple-only@example.com', '', ['apple']);
});

after(async () => {
  await db.close();
});

test('a Google-only account: no password, providers say google', async () => {
  assert.deepEqual(await door('google-only@example.com'), [{ has_password: false, providers: ['google'] }]);
});

test('an empty-string password counts as NO password (GoTrue writes NULL, but the guard is belt and braces)', async () => {
  assert.deepEqual(await door('apple-only@example.com'), [{ has_password: false, providers: ['apple'] }]);
});

test('an email+password account has a password; a linked account has both', async () => {
  assert.deepEqual(await door('password@example.com'), [{ has_password: true, providers: ['email'] }]);
  assert.deepEqual(await door('linked@example.com'), [{ has_password: true, providers: ['email', 'google'] }]);
});

test('the email is matched case-insensitively and trimmed, and an unknown email is NO row (never a false row)', async () => {
  assert.equal((await door('  Google-Only@Example.com ')).length, 1);
  assert.deepEqual(await door('nobody@example.com'), []);
});

test('a soft-deleted or anonymous auth row is not a door', async () => {
  await db.query(`INSERT INTO auth.users (email, encrypted_password, raw_app_meta_data, deleted_at) VALUES ('gone@example.com', NULL, '{"providers":["google"]}', now())`);
  await db.query(`INSERT INTO auth.users (email, encrypted_password, raw_app_meta_data, is_anonymous) VALUES ('anon@example.com', NULL, '{"providers":["google"]}', true)`);
  assert.deepEqual(await door('gone@example.com'), []);
  assert.deepEqual(await door('anon@example.com'), []);
});

test('🔒 anon and authenticated are refused; only the service role may ask', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec('BEGIN');
    try {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(
        db.query(`SELECT * FROM public.sign_in_door_for_email('google-only@example.com')`),
        /permission denied/i,
        `${role} must not be able to ask which door an email uses — that confirms accounts to a prober`,
      );
    } finally {
      await db.exec('RESET ROLE').catch(() => {});
      await db.exec('ROLLBACK').catch(() => {});
    }
  }
  await db.exec('BEGIN');
  try {
    await db.exec('SET ROLE service_role');
    assert.equal((await door('google-only@example.com')).length, 1, 'service_role is the one caller');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
  }
});
