/**
 * event-types-must-be-specific.db.test.ts — migration 20271294233183 (+ 20271293446382), proven on the replayed
 * schema as a REAL `authenticated` session (SET ROLE + JWT claim). Owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST
 * BE SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS".
 *
 *   1. "Celebration" is hidden from couples (enabled = FALSE) and is still an ACTIVE type — existing events keep it.
 *   2. A host may ask (insert their own open ask) and read only their own; never forge a resolved one; never resolve.
 *   3. One open ask per person per name.
 *   4. `event_type_added` exists in the notification enum (a TS-only kind is refused in silence).
 *   5. A group may own a gala night, a date or a hangout (the CHECK now matches the profiles).
 *
 * SABOTAGE PERFORMED AND UNDONE: the `AND status = 'pending'` line removed from `event_type_requests_ask` → test 2 RED
 * (a host inserted an already-'dismissed' row).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const U = { a: '', b: '' };

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  U.a = await mk('ask-a@types.test');
  U.b = await mk('ask-b@types.test');
});
after(async () => {
  await db?.close();
});

test('1 · Celebration is hidden from couples, still active — never retired, never deleted', async () => {
  const r = await db.query<{ enabled: boolean; status: string }>(
    `SELECT enabled, status FROM public.event_type_vocab WHERE event_type = 'celebration'`,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.enabled, false);
  assert.equal(r.rows[0]!.status, 'active');
});

test('2 · a host asks for themselves only, open and untyped, and reads only their own', async () => {
  await asUser(U.a, () =>
    db.query(`INSERT INTO public.event_type_requests (requested_by, label) VALUES ($1, 'Alumni homecoming')`, [U.a]),
  );
  await assert.rejects(
    asUser(U.a, () => db.query(`INSERT INTO public.event_type_requests (requested_by, label) VALUES ($1, 'Forged')`, [U.b])),
    /row-level security/i,
    'an ask in someone else’s name',
  );
  await assert.rejects(
    asUser(U.a, () =>
      db.query(`INSERT INTO public.event_type_requests (requested_by, label, status) VALUES ($1, 'Pre-closed', 'dismissed')`, [U.a]),
    ),
    /row-level security/i,
    'an ask that arrives already answered',
  );
  const seenByB = await asUser(U.b, () => db.query(`SELECT 1 FROM public.event_type_requests`));
  assert.equal(seenByB.rows.length, 0, 'B reads nobody else’s asks');
  const moved = await asUser(U.a, () =>
    db.query(`UPDATE public.event_type_requests SET status = 'dismissed' WHERE requested_by = $1 RETURNING 1`, [U.a]),
  );
  assert.equal(moved.rows.length, 0, 'a host cannot resolve their own ask');
});

test('3 · one open ask per person per name', async () => {
  await assert.rejects(
    asUser(U.a, () =>
      db.query(`INSERT INTO public.event_type_requests (requested_by, label) VALUES ($1, '  alumni HOMECOMING ')`, [U.a]),
    ),
    /duplicate key|unique/i,
  );
});

test('4 · event_type_added is a value of the notification enum', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT 'event_type_added' = ANY(enum_range(NULL::public.notification_type)::text[]) AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true);
});

test('5 · a group may own a gala night, a date or a hangout — and still never a wedding', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'events_community_class_consistency'`,
  );
  const def = r.rows[0]!.def;
  for (const k of ['gala_night', 'date', 'hangout', 'reunion', 'concert']) assert.match(def, new RegExp(`'${k}'`));
  for (const k of ['wedding', 'debut', 'birthday', 'christening']) assert.doesNotMatch(def, new RegExp(`'${k}'`));
});
