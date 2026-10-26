/**
 * ＋ ADD PHOTOS — THE UPLOADS CAMERA IS CLAIMED ONCE, BY A HOST, AND A SECOND PRESS CHANGES NOTHING (owner 2026-10-26,
 * live: "the turn on is not working as well fix it"), against the REPLAYED schema, on an `authenticated` session.
 *
 * The one press (`startAddingPhotos`, `app/dashboard/[eventId]/studio/papic/actions.ts`) reads the camera's token on the
 * service role and claims it on the CALLER'S session through `papic_claim_seat`. What that leans on is here:
 *   1 · the camera can be minted ONCE per event (the UNIQUE the provisioner's upsert names — a second render, or the
 *       studio and Memories renders racing, creates nothing);
 *   2 · the host's claim lands, and a second press is a no-op ('claimed' again, the same claimer, the same claimed_at);
 *   3 · the OTHER host's claim is 'taken' and moves nothing;
 *   4 · a non-host is refused at the two reads the action makes on their session: their membership row (the couple
 *       check) and the camera's token (RLS) both come back empty — so they never hold a token to claim with.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { host: '', partner: '', stranger: '', eventId: '', token: 'tok-uploads-0123456789abcdef0123' };

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}
const claim = (uid: string) =>
  as(uid, async () => (await db.query<{ r: { status: string } }>(`SELECT public.papic_claim_seat($1) AS r`, [F.token])).rows[0]!.r);
const seat = async () =>
  (
    await db.query<{ claimer_user_id: string | null; claimed_at: string | null; n: number }>(
      `SELECT claimer_user_id, claimed_at::text, (SELECT count(*)::int FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150) AS n
         FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150`,
      [F.eventId],
    )
  ).rows[0]!;
/** The provisioner's upsert, as `provisionUploadsCameraAdmin` sends it (`onConflict: 'event_id,seat_index'`, ignoreDuplicates). */
const mint = (token: string) =>
  db.query(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, tier, claim_qr_token)
     VALUES ($1, 150, 'PAPIC_CAMERA_FREE', 'free', $2) ON CONFLICT (event_id, seat_index) DO NOTHING`,
    [F.eventId, token],
  );

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const user = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.host = await user('host@uploads.test');
  F.partner = await user('partner@uploads.test');
  F.stranger = await user('stranger@uploads.test');
  F.eventId = (await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Cale and Ice', 'birthday') RETURNING event_id AS e`)).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple')`, [
    F.eventId,
    F.host,
    F.partner,
  ]);
});
after(async () => {
  await db?.close?.();
});

test('1 · the camera is minted once — a second mint (another render, or the two renders racing) creates nothing', async () => {
  await mint(F.token);
  await mint('tok-a-second-render-would-mint-xx');
  const s = await seat();
  assert.equal(s.n, 1, 'two Uploads cameras on one event — the UNIQUE the upsert names is gone');
  const tok = (await db.query<{ t: string }>(`SELECT claim_qr_token AS t FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150`, [F.eventId])).rows[0]!.t;
  assert.equal(tok, F.token, 'the second mint replaced the first camera’s token');
  assert.equal(s.claimer_user_id, null, 'a fresh camera is already somebody’s');
});

test('2 · the host’s press claims it; a second press is a no-op — the same claimer, the same moment', async () => {
  assert.equal((await claim(F.host)).status, 'claimed');
  const first = await seat();
  assert.equal(first.claimer_user_id, F.host, 'the claim did not land on the host');
  assert.ok(first.claimed_at, 'the claim left no moment');
  assert.equal((await claim(F.host)).status, 'claimed', 'a second press by the same host is refused — the sheet would say so on every pick');
  const second = await seat();
  assert.equal(second.claimer_user_id, F.host);
  assert.equal(second.claimed_at, first.claimed_at, 'a second press re-claimed the camera (it should change nothing)');
});

test('3 · the other host’s press is "taken" and moves nothing', async () => {
  assert.equal((await claim(F.partner)).status, 'taken');
  assert.equal((await seat()).claimer_user_id, F.host, 'the other host took the camera from the first');
});

test('4 · a non-host is refused at both reads the action makes on their session — no membership, no token', async () => {
  const membership = await as(F.stranger, () =>
    db.query(`SELECT member_type FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.stranger]),
  );
  assert.equal(membership.rows.length, 0, 'a stranger reads a membership on this event — the couple check would pass them');
  const token = await as(F.stranger, () =>
    db.query(`SELECT claim_qr_token FROM public.paparazzi_seats WHERE event_id = $1`, [F.eventId]),
  );
  assert.equal(token.rows.length, 0, 'a stranger can read the Uploads camera’s token — they could claim it without the action');
  // Positive control: the host's own session does read their membership (the check is not vacuously empty).
  const own = await as(F.host, () =>
    db.query<{ member_type: string }>(`SELECT member_type FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.host]),
  );
  assert.equal(own.rows[0]?.member_type, 'couple', 'the host cannot read their own membership — test 4 would pass for the wrong reason');
});
