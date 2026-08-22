/**
 * YOUR PLATE FOLLOWS YOU — the meal + dietary answers belong to the PERSON.
 *
 * Owner, 2026-08-21: *"if they create an account to sync, these information
 * will be saved on their account automatically."*
 *
 * A guest answers "vegetarian · nut allergy" on every invitation they accept,
 * and until now the answer died with that one event. These columns are where it
 * lives instead.
 *
 * ── WHY A DB TEST AND NOT A SOURCE GUARD ────────────────────────────────────
 * The load-bearing behaviour here is a WRITE CONDITION — "fill a blank, never
 * overwrite" — expressed as two separate guarded UPDATEs. A guard that greps
 * for `.is('meal_preference', null)` passes on a comment, and passes just as
 * happily when the two statements are merged back into one (which silently
 * drops the allergy whenever the meal is already set — the exact bug this file
 * was written after catching in review). Only running the statements against a
 * real Postgres can tell the difference.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

type Food = {
  meal_preference: string | null;
  dietary_restrictions: string | null;
  dietary_restrictions_consent_at: string | null;
};

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('the columns exist on the PERSON, not just the guest row', async () => {
  const { rows } = await db.query<{ column_name: string; udt_name: string }>(
    `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('meal_preference','dietary_restrictions','dietary_restrictions_consent_at')
      ORDER BY column_name`,
  );
  assert.equal(rows.length, 3, `expected all three columns, got ${JSON.stringify(rows)}`);
  const meal = rows.find((r) => r.column_name === 'meal_preference');
  // 🔑 THE SAME ENUM THE GUEST ROW USES. A parallel list would drift the moment
  // one side gained a value, and the whole point is that one fills the other.
  assert.equal(meal?.udt_name, 'meal_preference', 'the profile invented its own meal type');
});

test('the free text is bounded, so a paste cannot follow somebody forever', async () => {
  // ⚠ ASSERT THE REFUSAL, NOT THE CONSTRAINT'S NAME. Checking pg_constraint for
  // the name passes just as happily on `CHECK (TRUE)` — the mutation run proved
  // it. The only thing that means anything is that the database says no.
  const u = await seedUser({});
  await assert.rejects(
    db.query(`UPDATE public.users SET dietary_restrictions = repeat('x', 400) WHERE user_id = $1`, [
      u,
    ]),
    'a 400-character value was stored — the bound is gone or is a tautology',
  );
  // …and something reasonable still fits.
  await db.query(`UPDATE public.users SET dietary_restrictions = repeat('x', 300) WHERE user_id = $1`, [u]);
});

test('a meal preference the enum does not know is REFUSED, not stored', async () => {
  const u = await seedUser({});
  await assert.rejects(
    db.query(`UPDATE public.users SET meal_preference = 'pizza' WHERE user_id = $1`, [u]),
    'an arbitrary string was accepted as a meal preference',
  );
});

// ── THE WRITE CONDITION — fill a blank, never overwrite ──────────────────────

/** `public.users.user_id` FKs `auth.users(id)`, and the `on_auth_user_created`
 *  trigger mints the public row — so seed auth first and update on top, the
 *  shape the other db tests use. */
let seq = 0;
async function seedUser(fields: { meal?: string | null; diet?: string | null }) {
  const email = `plate${seq++}@t.invalid`;
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    id,
    email,
  ]);
  await db.query(
    `UPDATE public.users SET meal_preference = $2, dietary_restrictions = $3 WHERE user_id = $1`,
    [id, fields.meal ?? null, fields.diet ?? null],
  );
  return id;
}

/** Exactly the two statements lib/link-guest-account.ts runs on account claim. */
async function carryUp(userId: string, meal: string | null, diet: string | null) {
  if (meal) {
    await db.query(
      `UPDATE public.users SET meal_preference = $2
        WHERE user_id = $1 AND meal_preference IS NULL`,
      [userId, meal],
    );
  }
  if (diet) {
    await db.query(
      `UPDATE public.users
          SET dietary_restrictions = $2, dietary_restrictions_consent_at = now()
        WHERE user_id = $1 AND dietary_restrictions IS NULL`,
      [userId, diet],
    );
  }
}

test('an empty profile receives both answers, and the health field is stamped', async () => {
  const u = await seedUser({});
  await carryUp(u, 'vegetarian', 'nut allergy');
  const { rows } = await db.query<Food>(
    `SELECT meal_preference, dietary_restrictions, dietary_restrictions_consent_at
       FROM public.users WHERE user_id = $1`,
    [u],
  );
  assert.equal(rows[0]!.meal_preference, 'vegetarian');
  assert.equal(rows[0]!.dietary_restrictions, 'nut allergy');
  // RA 10173: dietary text is health data and carries per-field consent, like
  // religion beside it. Storing the value without the stamp is the defect.
  assert.ok(rows[0]!.dietary_restrictions_consent_at, 'health data stored with no consent stamp');
});

test('an answer the person already typed is NEVER overwritten', async () => {
  const u = await seedUser({ meal: 'vegan', diet: 'coeliac' });
  await carryUp(u, 'beef', 'nut allergy');
  const { rows } = await db.query<Food>(
    `SELECT meal_preference, dietary_restrictions FROM public.users WHERE user_id = $1`,
    [u],
  );
  assert.equal(rows[0]!.meal_preference, 'vegan', 'a stale guest row replaced their own choice');
  assert.equal(rows[0]!.dietary_restrictions, 'coeliac', 'a stale guest row replaced their allergy');
});

test('🔴 a set meal must NOT block the allergy from landing', async () => {
  // THE BUG THIS FILE EXISTS FOR. One UPDATE carrying both fields ANDs the two
  // "is null" guards, so a profile that already had a meal preference matched
  // nothing and the ALLERGY — the value that actually matters — was silently
  // dropped. Two statements; each lands on its own merits.
  const u = await seedUser({ meal: 'chicken', diet: null });
  await carryUp(u, 'beef', 'severe nut allergy');
  const { rows } = await db.query<Food>(
    `SELECT meal_preference, dietary_restrictions FROM public.users WHERE user_id = $1`,
    [u],
  );
  assert.equal(rows[0]!.meal_preference, 'chicken', 'their own meal choice was overwritten');
  assert.equal(
    rows[0]!.dietary_restrictions,
    'severe nut allergy',
    'the allergy was dropped because the meal was already set — the merged-UPDATE bug is back',
  );
});

test('running it twice changes nothing', async () => {
  const u = await seedUser({});
  await carryUp(u, 'fish', 'halal');
  const { rows: first } = await db.query<Food>(
    `SELECT dietary_restrictions_consent_at FROM public.users WHERE user_id = $1`,
    [u],
  );
  await carryUp(u, 'beef', 'nut allergy');
  const { rows: second } = await db.query<Food>(
    `SELECT meal_preference, dietary_restrictions, dietary_restrictions_consent_at
       FROM public.users WHERE user_id = $1`,
    [u],
  );
  assert.equal(second[0]!.meal_preference, 'fish');
  assert.equal(second[0]!.dietary_restrictions, 'halal');
  assert.deepEqual(
    second[0]!.dietary_restrictions_consent_at,
    first[0]!.dietary_restrictions_consent_at,
    'a second claim re-stamped consent — the original consent moment was lost',
  );
});
