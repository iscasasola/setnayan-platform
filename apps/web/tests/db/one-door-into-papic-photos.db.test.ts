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
 * 🛑 THE PARAGRAPH THAT USED TO SIT HERE WAS WRONG, AND IT IS KEPT AS A
 * CORRECTION RATHER THAN DELETED. It read: *"a blanket revoke would have been
 * wrong — the claimer holding a camera IS an `authenticated` user; revoking the
 * grant breaks every camera."* **The second half does not follow from the
 * first.** A camera does not need the BROWSER to hold the grant; it needs the
 * capture to be recorded, and `recordSeatCapture` can write with the service
 * role after its eight gates have run — which is what
 * `20271169487222_no_photo_without_a_credit` did the next day. The guest half of
 * this same feature had already been built that way for months
 * (`papic_record_guest_capture`, SECURITY DEFINER), which is why `anon` never
 * needed an INSERT grant.
 *
 * 🔑 So narrowing the couple's policy was CORRECT AND INSUFFICIENT. It closed
 * the couple's door and left the claimer's standing — and the Uploads camera
 * then made every host a claimer, which walked the couple straight back through
 * it. **There are now ZERO browser-role doors into this table**, and the rules
 * below say so.
 *
 * ⚠ The grant and policy mechanics are asserted ONCE, in
 * `no-photo-without-a-credit.db.test.ts`. This file keeps what is specific to
 * the couple, and this correction.
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

test('🚨 the camera keeps the three verbs it uses — closing INSERT must not close those', async () => {
  // The claimer's FOR ALL policy became three on 2026-08-26. The camera still
  // counts its own shots (SELECT), stamps the web copy of a clip (UPDATE) and
  // reads back what it wrote — only the INSERT arm went, and the row it writes
  // now goes in under the service role.
  const claimer = (await policies()).filter((p) => p.polname.startsWith('papic_photos_claimer'));
  assert.ok(
    claimer.length > 0,
    'every claimer policy is gone — a camera can no longer see or finish its own captures',
  );
  const cmds = new Set(claimer.map((p) => p.cmd));
  for (const needed of ['SELECT', 'UPDATE', 'DELETE']) {
    assert.ok(
      cmds.has(needed),
      `the camera lost ${needed} on its own captures (${[...cmds].join(', ')})`,
    );
  }
});

test('🚨 …and NO policy on this table admits INSERT from a browser role any more', async () => {
  const inserting = (await policies())
    .filter((p) => p.cmd === 'ALL' || p.cmd === 'INSERT')
    .map((p) => `${p.polname}:${p.cmd}`);
  assert.deepEqual(
    inserting,
    [],
    `these policies still admit INSERT: ${inserting.join(', ')}. Every gate in ` +
      `recordSeatCapture — the burst limiter, the clip cap, the window, the paid ` +
      `gate, the geo control, the credit reserve — is app-side, and a policy ` +
      `cannot count credits. The row belongs to the service role.`,
  );
});

test('the table says why, so the next reader does not restore the wide policy', async () => {
  const r = await db.query<{ d: string | null }>(
    `SELECT obj_description('public.papic_photos'::regclass) AS d`,
  );
  const note = r.rows[0]?.d ?? '';
  assert.match(
    note,
    /service.role only|service_role only/i,
    'the table comment no longer records that INSERT is service-role only — a comment a reader queries is the only warning at the point of the mistake, and this table has now been widened by accident twice',
  );
});
