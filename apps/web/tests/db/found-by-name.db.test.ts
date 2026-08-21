/**
 * tests/db/found-by-name.db.test.ts — who a name search may return, and who it
 * must never return.
 *
 * Owner, 2026-08-21: *"we can search all users of that name as well"* · *"it
 * will show all people with that name and pick the person they want to add"* ·
 * *"just like facebook."*
 *
 * ── WHAT THIS FILE IS DEFENDING ────────────────────────────────────────────
 * A name search is a directory, and the owner (the registered DPO) asked for
 * one. The part that still has to hold is the SHAPE of it: findable is a
 * per-person choice, and three categories of account are never findable at all.
 * The column carries the choice; the query carries the rest, so the query is
 * what is tested here — against real rows, with the same predicates the app
 * uses.
 *
 * Every test is a NEGATIVE except the two that prove the search works at all —
 * without those, a query that returned nothing forever would pass the file.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { escapeLikeQuery } from '../../lib/people-search-query';

let replay: ReplayResult;
let db: PGlite;

/** The app's predicate, reproduced once so every test asks the same question. */
async function findable(query: string): Promise<string[]> {
  const r = await db.query<{ display_name: string }>(
    `SELECT display_name
       FROM public.users
      WHERE display_name ILIKE $1
        AND discoverable_by_name = TRUE
        AND display_name IS NOT NULL
        AND email NOT LIKE '%@anon.setnayan.local'
      ORDER BY display_name`,
    [`%${escapeLikeQuery(query)}%`],
  );
  return r.rows.map((x) => x.display_name);
}

async function mk(email: string, name: string | null): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const uid = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [uid, name]);
  return uid;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  await mk('maria.cruz@find.test', 'Maria Cruz');
  await mk('maria.santos@find.test', 'Maria Santos');
  await mk('mario@find.test', 'Mario Reyes');
  const hidden = await mk('hidden@find.test', 'Maria Hidden');
  await db.query(`UPDATE public.users SET discoverable_by_name = FALSE WHERE user_id = $1`, [
    hidden,
  ]);
  await mk('nameless@find.test', null);
  // An anonymous draft that somehow carries a name — the email is what makes it
  // an unfinished account, not the absence of a name.
  await mk('anon+11111111-1111-1111-1111-111111111111@anon.setnayan.local', 'Maria Anonymous');
  // The literal-wildcard trap: a real person whose name contains % and _.
  await mk('odd@find.test', 'Maria %_ Test');
});

after(async () => {
  await db.close();
});

test('the column defaults to findable — the owner asked for facebook, not opt-in', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.users
      WHERE discoverable_by_name = TRUE AND email LIKE '%@find.test'`,
  );
  // Six accounts carry a `@find.test` address (the seventh seeded row is the
  // anonymous draft, on a different domain). One of the six was explicitly
  // turned off, so five are findable WITHOUT anybody having opted in.
  assert.equal(r.rows[0]!.n, 5);
});

test('🔴 typing a name finds everybody with it — "show all people with that name"', async () => {
  const found = await findable('Maria');
  assert.ok(found.includes('Maria Cruz'), 'Maria Cruz was not findable');
  assert.ok(found.includes('Maria Santos'), 'Maria Santos was not findable');
  assert.ok(found.length >= 2, 'a name shared by two people returned fewer than two');
});

test('a partial name still finds them — nobody types a full legal name', async () => {
  assert.ok((await findable('cru')).includes('Maria Cruz'));
  assert.ok((await findable('REYES')).includes('Mario Reyes'), 'the match is case-sensitive');
});

test('🔒 somebody who turned it OFF is not findable, by any part of their name', async () => {
  for (const q of ['Maria Hidden', 'Hidden', 'hidd']) {
    assert.deepEqual(await findable(q), [], `"${q}" surfaced an account that opted out`);
  }
});

test('🔒 an account with no name is never returned', async () => {
  // Nothing to match on and nothing to show — a blank row in a picker is worse
  // than no row.
  const all = await findable('a');
  assert.ok(!all.includes(''), 'a nameless account was offered');
  assert.ok(all.every((n) => n.trim().length > 0));
});

test('🔒 an anonymous draft is never returned, even with a name on it', async () => {
  const found = await findable('Maria');
  assert.ok(
    !found.includes('Maria Anonymous'),
    'somebody who has not even secured their account was put in a directory',
  );
});

test('🚨 a typed % does NOT return everybody', async () => {
  // Unescaped, this is `ILIKE '%%%'` — the whole table. The escape is what makes
  // it a search for a per-cent sign, which one seeded person actually has.
  const found = await findable('%');
  assert.deepEqual(found, ['Maria %_ Test'], 'a wildcard search returned the directory');
});

test('🚨 a typed _ matches an underscore, not any character', async () => {
  const found = await findable('_');
  assert.deepEqual(found, ['Maria %_ Test'], 'an underscore matched arbitrary names');
  // And the pair together still resolves to the one literal name.
  assert.deepEqual(await findable('%_'), ['Maria %_ Test']);
});

test('a name nobody has returns nothing — the same as somebody hidden', async () => {
  // The two cases MUST be indistinguishable, or the box answers "does this
  // person have an account?" for any name typed into it.
  assert.deepEqual(await findable('Zszszsz'), []);
  assert.deepEqual(await findable('Maria Hidden'), []);
});
