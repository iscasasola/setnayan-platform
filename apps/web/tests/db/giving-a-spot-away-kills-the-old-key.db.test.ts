/**
 * 🔁 GIVE THIS SPOT TO SOMEONE ELSE — the old key must die (guest pathway,
 * owner DECISION_LOG 2026-09-26: "a NEW key is issued (rotate_guest_qr_token)
 * and the old person's QR/link stop working").
 *
 * The schema half of `giveSpotToSomeoneElse` (guests/[guestId]/actions.ts):
 *
 *   · the rotation runs as the COUPLE (session client). A service-role call
 *     without `guest_self` is refused by the function — which is why the swap
 *     (and "Take this seat back") must not call it through the admin client;
 *   · after it, the OLD token finds no guest at all — the invite link
 *     (`?invite=`), the QR and the redeem door all look up by it, and the
 *     guest session is checked against it on every read;
 *   · the NEW token finds the SAME row, so the seat, table and count that hang
 *     off that row stay with the spot;
 *   · the old account's hold on the seat is removed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { event: '', host: '', oldAccount: '', guest: '' };

type Rpc = { ok: boolean; reason?: string; qr_token?: string };
const rotate = async (guestId: string) =>
  (await db.query<{ res: Rpc }>(`SELECT public.rotate_guest_qr_token($1) AS res`, [guestId])).rows[0]!.res;
const byToken = async (token: string) =>
  (await db.query<{ guest_id: string }>(`SELECT guest_id FROM public.guests WHERE qr_token = $1`, [token])).rows;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mkUser = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.host = await mkUser('host@give-spot.test');
  F.oldAccount = await mkUser('old@give-spot.test');
  await setAuthUid(db, null);
  F.event = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date)
       VALUES ('Give the Spot', 'birthday', '2027-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    F.event,
    F.host,
  ]);
  F.guest = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, plus_one_count)
       VALUES ($1, 'Tita', 'Baby', 'both', 'family', 'pending', 1) RETURNING guest_id`,
      [F.event],
    )
  ).rows[0]!.guest_id;
  // The old person had saved the seat to an account.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, guest_id)
     VALUES ($1,$2,'guest','guest',$3)`,
    [F.event, F.oldAccount, F.guest],
  );
});
after(async () => {
  await db?.close();
});

test('a service-role rotation without guest_self is REFUSED — the swap must rotate as the couple', async () => {
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  const res = await rotate(F.guest);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_authorized');
});

test('🔁 the swap: the old key finds nobody, the new key finds the same spot, the old account lets go', async () => {
  const old = (await db.query<{ qr_token: string }>(`SELECT qr_token FROM public.guests WHERE guest_id = $1`, [F.guest]))
    .rows[0]!.qr_token;
  assert.deepEqual((await byToken(old)).map((r) => r.guest_id), [F.guest], 'fixture: the old key opens the spot');

  await setAuthUid(db, F.host);
  const res = await rotate(F.guest);
  await setAuthUid(db, null);
  assert.equal(res.ok, true, `the couple could not rotate (${JSON.stringify(res)})`);

  // The exact delete + rename the swap makes (admin client, after the rotation).
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND guest_id = $2 AND member_type = 'guest'`, [
    F.event,
    F.guest,
  ]);
  await db.query(
    `UPDATE public.guests SET first_name = 'Rosario', last_name = 'Medina', display_name = NULL,
            person_id = NULL, email = NULL, mobile = NULL, updated_at = now()
      WHERE guest_id = $1 AND event_id = $2 AND rsvp_status = 'pending'`,
    [F.guest, F.event],
  );

  assert.equal((await byToken(old)).length, 0, 'the OLD link/QR still opens a guest after the swap');
  assert.deepEqual((await byToken(res.qr_token!)).map((r) => r.guest_id), [F.guest], 'the new key opens another row');
  const row = (
    await db.query<{ first_name: string; plus_one_count: number; rsvp_status: string }>(
      `SELECT first_name, plus_one_count, rsvp_status FROM public.guests WHERE guest_id = $1`,
      [F.guest],
    )
  ).rows[0]!;
  assert.equal(row.first_name, 'Rosario');
  assert.equal(row.plus_one_count, 1, 'the count changed — the swap must keep the spot as it was');
  assert.equal(row.rsvp_status, 'pending');
  const held = await db.query(`SELECT 1 FROM public.event_members WHERE user_id = $1 AND event_id = $2`, [
    F.oldAccount,
    F.event,
  ]);
  assert.equal(held.rows.length, 0, 'the old person’s account still holds the seat');
});

test('a guest who REPLIED is not touched by the swap’s update', async () => {
  const replied = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
       VALUES ($1, 'Ana', 'Reyes', 'both', 'family', 'attending') RETURNING guest_id`,
      [F.event],
    )
  ).rows[0]!.guest_id;
  const r = await db.query(
    `UPDATE public.guests SET first_name = 'Someone' WHERE guest_id = $1 AND event_id = $2 AND rsvp_status = 'pending'`,
    [replied, F.event],
  );
  assert.equal(r.affectedRows ?? 0, 0, 'a confirmed guest was renamed');
});
