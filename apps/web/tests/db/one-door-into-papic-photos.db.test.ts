/**
 * ONE DOOR INTO papic_photos, AND IT IS THE METERED ONE.
 *
 * ⚠ A COUPLE COULD PUT A PHOTO IN THEIR OWN GALLERY WITHOUT SPENDING A CREDIT.
 * `papic_photos_couple_full` was FOR ALL with a WITH CHECK that asked only
 * *"are you a couple on this event?"* — never whether the photo was paid for.
 * With the column-wise INSERT grant `authenticated` holds, a signed-in couple
 * could POST a row straight to PostgREST: no order, no payment, no approval, no
 * grant, no metering.
 *
 * 🔑 THE MONEY SIDE WAS NEVER THE PROBLEM. Credits arrive only as the automatic
 * 50-point `free_grant` or a `topup_order` grant written after an admin compares
 * the payment and approves. Nobody can mint credits. The hole was that a PHOTO
 * could arrive without one being SPENT — the balance never moves because the
 * photo went around it.
 *
 * ⛔ AND A BLANKET REVOKE WOULD HAVE BEEN WRONG. The claimer holding a camera IS
 * an `authenticated` user; revoking the grant breaks every camera. Policies are
 * OR-ed, so narrowing the couple's is what leaves exactly one insert door.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

type Pol = { polname: string; cmd: string };

async function policies(): Promise<Pol[]> {
  const r = await db.query<Pol>(
    `SELECT p.polname,
            CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                          WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                          ELSE 'ALL' END AS cmd
       FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'papic_photos'
      ORDER BY p.polname`,
  );
  return r.rows;
}

test('the replay produced this table at all — or every rule below is vacuous', async () => {
  const rows = await policies();
  assert.ok(rows.length >= 3, `expected several policies on papic_photos, found ${rows.length}`);
});

test('🚨 the couple can no longer INSERT — the FOR ALL door is gone', async () => {
  const rows = await policies();
  const couple = rows.filter((p) => p.polname.startsWith('papic_photos_couple'));
  assert.ok(couple.length > 0, 'the couple lost every policy — they cannot see their own gallery');

  const wideOpen = couple.filter((p) => p.cmd === 'ALL' || p.cmd === 'INSERT');
  assert.deepEqual(
    wideOpen.map((p) => `${p.polname}:${p.cmd}`),
    [],
    'a couple policy permits INSERT again. A photo could then exist without a credit ever being ' +
      'spent — no order, no payment, no approval, no grant, no metering.',
  );
});

test('⚠ …but a couple keeps everything they actually use', async () => {
  const cmds = new Set(
    (await policies()).filter((p) => p.polname.startsWith('papic_photos_couple')).map((p) => p.cmd),
  );
  for (const needed of ['SELECT', 'UPDATE', 'DELETE']) {
    assert.ok(
      cmds.has(needed),
      `the couple lost ${needed} on their own photos — they must still read their gallery, hide a photo and delete one`,
    );
  }
});

test('🚨 the CAMERA can still insert — this is the one door, not zero doors', async () => {
  const claimer = (await policies()).find((p) => p.polname === 'papic_photos_claimer_own');
  assert.ok(claimer, 'papic_photos_claimer_own is gone — no camera can record a capture at all');
  assert.ok(
    claimer.cmd === 'ALL' || claimer.cmd === 'INSERT',
    `the camera's own policy no longer permits INSERT (${claimer.cmd}) — every capture in the product breaks`,
  );
});

test('the table says why, so the next reader does not restore the wide policy', async () => {
  const r = await db.query<{ d: string | null }>(
    `SELECT obj_description('public.papic_photos'::regclass) AS d`,
  );
  const note = r.rows[0]?.d ?? '';
  assert.match(
    note,
    /claimer_own/i,
    'the table comment no longer records that INSERT belongs to the camera alone — a comment a reader queries is the only warning at the point of the mistake',
  );
});
