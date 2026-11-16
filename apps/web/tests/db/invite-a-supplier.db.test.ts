/**
 * 🤝 INVITE A SUPPLIER — asserted against the DATABASE (migration 20271350444634).
 *
 * Owner, 16 Nov 2026 (DECISION_LOG "Invite a supplier v3 APPROVED" · "THREE ANSWERS" · "hand-added partners need the
 * other shop's accept"):
 *
 *   1 · "+ Add" (origin 'added') between shops that never served together is ALLOWED — still a proposal;
 *       the shipped propose (origin 'worked_together') keeps NOT_SERVED_TOGETHER.
 *   2 · a supplier can never write an 'invited' row or an Invites record itself.
 *   3 · a NEW shop joining through the link: one ACCEPTED 'invited' row, inviter → joiner, brought_new_shop = true.
 *   4 · an EXISTING shop joining (join_supplier_invite): the handshake, never counted; "already" on a second join;
 *       its own link is "self".
 *   5 · origin and brought_new_shop cannot be changed after insert.
 *   6 · supplier_invite_join and shop_worked_with_counts are not callable by a signed-in supplier.
 *   7 · joining answers a pending "+ Add" between the same two shops instead of colliding with it.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

type Shop = { uid: string; vp: string; slug: string };
const S: Record<'lights' | 'florist' | 'photo' | 'newbie' | 'caterer', Shop> = {} as never;

async function mkShop(email: string, name: string, slug: string): Promise<Shop> {
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,$3,'Manila',ARRAY['florist']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
      [uid, name, slug],
    )
  ).rows[0]!.vendor_profile_id;
  return { uid, vp, slug };
}

async function rowsBetween(a: Shop, b: Shop) {
  return (
    await db.query<{ recommending_vendor_id: string; status: string; origin: string; brought_new_shop: boolean }>(
      `SELECT recommending_vendor_id, status, origin, brought_new_shop FROM public.vendor_partnerships
        WHERE LEAST(recommending_vendor_id, recommended_vendor_id) = LEAST($1::uuid, $2::uuid)
          AND GREATEST(recommending_vendor_id, recommended_vendor_id) = GREATEST($1::uuid, $2::uuid)`,
      [a.vp, b.vp],
    )
  ).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  S.lights = await mkShop('lights@invite.test', 'Sample Lights', 'sample-lights');
  S.florist = await mkShop('florist@invite.test', 'Sample Florist', 'sample-florist');
  S.photo = await mkShop('photo@invite.test', 'Sample Photo', 'sample-photo');
  S.newbie = await mkShop('newbie@invite.test', 'Sample Newbie', 'sample-newbie');
  S.caterer = await mkShop('caterer@invite.test', 'Sample Caterer', 'sample-caterer');
});

after(async () => {
  await replay?.db.close();
});

test('1 · "+ Add" needs no shared event; the shipped propose still does', async () => {
  await asUser(S.lights.uid);
  try {
    await db.query(
      `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, origin)
       VALUES ($1,$2,'general','proposed',true,'added')`,
      [S.lights.vp, S.photo.vp],
    );
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active)
         VALUES ($1,$2,'accredited','proposed',true)`,
        [S.lights.vp, S.caterer.vp],
      ),
      /NOT_SERVED_TOGETHER/,
    );
  } finally {
    await asOwner();
  }
  const r = await rowsBetween(S.lights, S.photo);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.status, 'proposed', 'a hand add waits for the other shop to accept');
  assert.equal(r[0]!.origin, 'added');
});

test('2 · a supplier cannot write an invited row or an Invites record', async () => {
  await asUser(S.florist.uid);
  try {
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, origin)
         VALUES ($1,$2,'general','proposed',true,'invited')`,
        [S.florist.vp, S.caterer.vp],
      ),
      /INVITED_IS_WRITTEN_ON_SIGN_UP/,
    );
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, origin, brought_new_shop)
         VALUES ($1,$2,'general','proposed',true,'added',true)`,
        [S.florist.vp, S.caterer.vp],
      ),
      /INVITES_NEED_THE_LINK/,
    );
  } finally {
    await asOwner();
  }
});

test('3 · a NEW shop through the link: one accepted invited row, counted', async () => {
  const out = (
    await db.query<{ r: string }>(`SELECT public.supplier_invite_join($1, $2, true) AS r`, [S.lights.vp, S.newbie.vp])
  ).rows[0]!.r;
  assert.equal(out, 'joined');
  const r = await rowsBetween(S.lights, S.newbie);
  assert.equal(r.length, 1, 'one row per handshake (the unordered-pair UNIQUE)');
  assert.deepEqual(
    { by: r[0]!.recommending_vendor_id, status: r[0]!.status, origin: r[0]!.origin, counted: r[0]!.brought_new_shop },
    { by: S.lights.vp, status: 'accepted', origin: 'invited', counted: true },
  );
});

test('4 · an EXISTING shop joins: the handshake, never counted; again = already; own link = self', async () => {
  await asUser(S.florist.uid);
  try {
    const first = (await db.query<{ r: string }>(`SELECT public.join_supplier_invite($1) AS r`, ['sample-lights'])).rows[0]!.r;
    assert.equal(first, 'joined');
    const again = (await db.query<{ r: string }>(`SELECT public.join_supplier_invite($1) AS r`, ['sample-lights'])).rows[0]!.r;
    assert.equal(again, 'already');
    const self = (await db.query<{ r: string }>(`SELECT public.join_supplier_invite($1) AS r`, ['sample-florist'])).rows[0]!.r;
    assert.equal(self, 'self');
  } finally {
    await asOwner();
  }
  const r = await rowsBetween(S.lights, S.florist);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.status, 'accepted');
  assert.equal(r[0]!.origin, 'invited');
  assert.equal(r[0]!.brought_new_shop, false, 'an existing shop never counts toward Invites');
});

test('5 · origin and the Invites mark are pinned after insert', async () => {
  await asUser(S.newbie.uid);
  try {
    await assert.rejects(
      db.query(
        `UPDATE public.vendor_partnerships SET origin = 'added', status = 'declined'
          WHERE recommending_vendor_id = $1 AND recommended_vendor_id = $2`,
        [S.lights.vp, S.newbie.vp],
      ),
      /IMMUTABLE_PARTNERSHIP_FIELDS/,
    );
  } finally {
    await asOwner();
  }
});

test('6 · the internal writer and the worked-with read are not a supplier’s to call', async () => {
  await asUser(S.caterer.uid);
  try {
    await assert.rejects(
      db.query(`SELECT public.supplier_invite_join($1, $2, true)`, [S.lights.vp, S.caterer.vp]),
      /permission denied/,
    );
    await assert.rejects(db.query(`SELECT * FROM public.shop_worked_with_counts($1)`, [S.caterer.vp]), /permission denied/);
  } finally {
    await asOwner();
  }
});

test('7 · joining answers a pending "+ Add" between the same two shops', async () => {
  // Test 1 left Lights → Photo pending (added). Photo now joins through Lights's link.
  await asUser(S.photo.uid);
  try {
    const out = (await db.query<{ r: string }>(`SELECT public.join_supplier_invite($1) AS r`, ['sample-lights'])).rows[0]!.r;
    assert.equal(out, 'joined');
  } finally {
    await asOwner();
  }
  const r = await rowsBetween(S.lights, S.photo);
  assert.equal(r.length, 1, 'the pending add gave way — never two rows for one handshake');
  assert.equal(r[0]!.status, 'accepted');
  assert.equal(r[0]!.origin, 'invited');
});
