/**
 * tests/db/connection-name-visibility.db.test.ts — who may learn a name, and
 * the one direction that must stay shut.
 *
 * ── THE TWO FAILURES THIS SITS BETWEEN ─────────────────────────────────────
 * Too tight: the person being ASKED sees "Someone added you as their spouse"
 * with a Confirm button under it. Nobody confirms an anonymous claim about
 * their own family, so the flow dead-ends. That is what shipped, and it is what
 * migration 20271151915662 fixes.
 *
 * Too loose: a DECLARER learns the name behind any address they type. That
 * turns the add box into a directory lookup for the whole database, which is
 * precisely what the 2026-07-05 rule exists to prevent.
 *
 * So the interesting assertion is not "the name resolves" — it is that the SAME
 * pending edge resolves a name in one direction and nothing in the other. Every
 * test below is written so that swapping the two ids in the function's pending
 * leg turns it red.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let ana = '';
let ben = '';
let cara = '';
let anaPerson = '';
let benPerson = '';
let caraPerson = '';

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

/** The names `uid` can resolve for `ids`, exactly as the People page asks. */
async function namesSeenBy(uid: string, ids: string[]): Promise<Record<string, string>> {
  await asUser(uid);
  try {
    const r = await db.query<{ person_id: string; display_name: string | null }>(
      `SELECT * FROM public.visible_connection_names($1::uuid[])`,
      [ids],
    );
    const out: Record<string, string> = {};
    for (const row of r.rows) if (row.display_name) out[row.person_id] = row.display_name;
    return out;
  } finally {
    await reset();
  }
}

/** Write an edge as the platform does, bypassing RLS — the subject here is the
 *  READ path, so the seeding must not be the thing that fails. */
async function seedEdge(
  from: string,
  to: string,
  status: 'draft' | 'pending' | 'confirmed' | 'declined',
  creator: string,
  relation = 'sibling',
): Promise<void> {
  await reset();
  await db.query(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, $5, 'family', $3, $4)`,
    [from, to, status, creator, relation],
  );
}

/** Answer a pending claim the way the product does: as the RECIPIENT, whose
 *  session is what `person_connections_transition_guard` checks. Doing it with
 *  no auth.uid() is refused by the guard — correctly, and that refusal is
 *  covered by person-connections-forgery.db.test.ts. */
async function answerAs(
  uid: string,
  from: string,
  to: string,
  status: 'confirmed' | 'declined',
): Promise<void> {
  await asUser(uid);
  try {
    await db.query(
      `UPDATE public.person_connections
          SET status = $3,
              confirmed_at = CASE WHEN $3 = 'confirmed' THEN now() ELSE confirmed_at END,
              declined_at  = CASE WHEN $3 = 'declined'  THEN now() ELSE declined_at  END
        WHERE from_person_id = $1 AND to_person_id = $2 AND status = 'pending'`,
      [from, to, status],
    );
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const mk = async (email: string, name: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer','full_name',$2::text))
       RETURNING id`,
      [email, name],
    );
    const uid = r.rows[0]!.id;
    // The display name is what this function returns; make sure there is one.
    await db.query(`UPDATE public.people SET display_name = $2 WHERE claimed_by_user_id = $1`, [
      uid,
      name,
    ]);
    return uid;
  };
  const personOf = async (uid: string): Promise<string> => {
    const r = await db.query<{ person_id: string }>(
      `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
      [uid],
    );
    return r.rows[0]!.person_id;
  };

  ana = await mk('ana@names.test', 'Ana Cruz');
  ben = await mk('ben@names.test', 'Ben Reyes');
  cara = await mk('cara@names.test', 'Cara Lim');
  anaPerson = await personOf(ana);
  benPerson = await personOf(ben);
  caraPerson = await personOf(cara);
});

after(async () => {
  await db.close();
});

test('the seed is real — three claimed people with names', async () => {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.people
      WHERE person_id = ANY($1::uuid[]) AND display_name IS NOT NULL`,
    [[anaPerson, benPerson, caraPerson]],
  );
  assert.equal(r.rows[0]!.n, 3);
});

test('a stranger resolves NOTHING — no edge, no name', async () => {
  const seen = await namesSeenBy(cara, [anaPerson, benPerson]);
  assert.deepEqual(seen, {}, 'a name leaked with no connection at all');
});

test('🔴 the person being ASKED sees who asked them', async () => {
  // Ana declares Ben is her sibling. Ben is the one who has to answer it.
  await seedEdge(anaPerson, benPerson, 'pending', ana);
  const seen = await namesSeenBy(ben, [anaPerson]);
  assert.equal(seen[anaPerson], 'Ana Cruz', 'Ben was asked to confirm an anonymous claim');
});

test('🔒 …and the DECLARER still learns nothing from the same pending edge', async () => {
  // Same row, read from the other end. This is the direction that would make
  // the add box a name lookup for any email on earth.
  const seen = await namesSeenBy(ana, [benPerson]);
  assert.deepEqual(seen, {}, 'typing an address returned the name behind it');
});

test('🔒 a third party sees neither side of somebody else’s pending claim', async () => {
  const seen = await namesSeenBy(cara, [anaPerson, benPerson]);
  assert.deepEqual(seen, {});
});

test('a DRAFT is private to its author — it resolves nothing, in either direction', async () => {
  // Nothing has been sent; the other person has not been told and must not be
  // discoverable through it.
  await seedEdge(caraPerson, benPerson, 'draft', cara);
  assert.deepEqual(await namesSeenBy(ben, [caraPerson]), {}, 'a draft named its author');
  assert.deepEqual(await namesSeenBy(cara, [benPerson]), {}, 'a draft named its subject');
});

test('once CONFIRMED, both sides see each other — the 2026-07-05 rule, unchanged', async () => {
  await answerAs(ben, anaPerson, benPerson, 'confirmed');
  assert.equal((await namesSeenBy(ben, [anaPerson]))[anaPerson], 'Ana Cruz');
  assert.equal((await namesSeenBy(ana, [benPerson]))[benPerson], 'Ben Reyes');
});

test('a DECLINED claim goes dark again for the person who made it', async () => {
  await seedEdge(caraPerson, anaPerson, 'pending', cara);
  assert.equal(
    (await namesSeenBy(ana, [caraPerson]))[caraPerson],
    'Cara Lim',
    'precondition: while pending, Ana can see who is asking',
  );
  await answerAs(ana, caraPerson, anaPerson, 'declined');
  assert.deepEqual(
    await namesSeenBy(ana, [caraPerson]),
    {},
    'a refused claim kept resolving a name',
  );
});

test('a soft-deleted edge resolves nothing — withdrawing really withdraws', async () => {
  // A different relation from the draft above: the edge index is unique per
  // (from, to, relation), so reusing 'sibling' would fail on the INSERT and the
  // test would be measuring the wrong refusal.
  await seedEdge(caraPerson, benPerson, 'pending', cara, 'friend');
  assert.equal((await namesSeenBy(ben, [caraPerson]))[caraPerson], 'Cara Lim');
  await reset();
  await db.query(
    `UPDATE public.person_connections SET deleted_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2 AND status = 'pending'`,
    [caraPerson, benPerson],
  );
  assert.deepEqual(await namesSeenBy(ben, [caraPerson]), {}, 'a withdrawn request still named its sender');
});

test('the function never returns contact details — name only, by construction', async () => {
  // The shape is the guarantee: an email or a phone number cannot leak through
  // a function whose result type has two columns and neither is one.
  await reset();
  const r = await db.query<{ result: string }>(
    `SELECT pg_get_function_result(p.oid) AS result
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'visible_connection_names'`,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.result, 'TABLE(person_id uuid, display_name text)');
});
