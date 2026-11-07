/**
 * A TAKEN-DOWN SERVICE CARD STAYS DOWN — against a replayed schema
 * (20271309211124_a_taken_down_card_stays_down.sql).
 *
 * The admin "Take down card" sets `is_active = false` plus a hold
 * (`taken_down_at` + `taken_down_reason`). Each case asserts a VALUE both ways:
 *   · a couple CAN read the live card before, and CANNOT after (the public read
 *     policy is the same gate Find and the shop page honour — `is_active`);
 *   · the shop CANNOT bring it back by any of its three paths (the PATCH, the
 *     on/off switch's UPDATE, the maker's RPC) and CANNOT lift the hold, yet can
 *     still save it as a draft;
 *   · Setnayan (service role) CAN put it back, and it is live again.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const COVER = 'r2://media/vendors/td/cover.webp';
const REASON = 'The cover photo belongs to another studio.';

const F = { shopUser: '', couple: '', vendorId: '', card: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
async function card(): Promise<{ is_active: boolean; taken_down_at: string | null; taken_down_reason: string | null }> {
  const r = await db.query<{ is_active: boolean; taken_down_at: string | null; taken_down_reason: string | null }>(
    `SELECT is_active, taken_down_at, taken_down_reason FROM public.vendor_services WHERE vendor_service_id = $1`,
    [F.card],
  );
  assert.equal(r.rows.length, 1, 'the card under test does not exist — the case proved nothing');
  return r.rows[0]!;
}
async function coupleSeesIt(): Promise<boolean> {
  return as(F.couple, async () => {
    const r = await db.query(`SELECT 1 FROM public.vendor_services WHERE vendor_service_id = $1`, [F.card]);
    return r.rows.length === 1;
  });
}
async function takeDown(): Promise<void> {
  await asService(() =>
    db.query(
      `UPDATE public.vendor_services
          SET is_active = false, taken_down_at = NOW(), taken_down_reason = $2
        WHERE vendor_service_id = $1`,
      [F.card, REASON],
    ),
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('td-couple@takedown.test', 'customer');
  F.shopUser = await mkUser('td-shop@takedown.test', 'vendor');
  F.vendorId = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Takedown Studio')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.shopUser],
    )
  ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility
      WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  F.card = (
    await db.query<{ id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active, starting_price_php, primary_photo_r2_key)
       VALUES ($1, 'live_band', 'Takedown Band', false, 30000, $2) RETURNING vendor_service_id AS id`,
      [F.vendorId, COVER],
    )
  ).rows[0]!.id;
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, 'Sound system')`,
    [F.card, F.vendorId],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [F.card]);
});
after(async () => {
  await db?.close();
});

test('before: the card is live and a couple can read it (the case can fail)', async () => {
  assert.equal((await card()).is_active, true);
  assert.equal(await coupleSeesIt(), true);
});

test('the shop cannot take its own card down (only Setnayan sets the hold)', async () => {
  const err = await refused(() =>
    as(F.shopUser, () =>
      db.query(
        `UPDATE public.vendor_services SET taken_down_at = NOW(), taken_down_reason = $2 WHERE vendor_service_id = $1`,
        [F.card, REASON],
      ),
    ),
  );
  assert.match(err ?? '', /Only Setnayan/);
  assert.equal((await card()).taken_down_at, null);
});

test('a take-down must say why — a short reason is refused', async () => {
  const err = await refused(() =>
    asService(() =>
      db.query(
        `UPDATE public.vendor_services SET is_active = false, taken_down_at = NOW(), taken_down_reason = 'no' WHERE vendor_service_id = $1`,
        [F.card],
      ),
    ),
  );
  assert.match(err ?? '', /vendor_services_a_take_down_says_why/);
  assert.equal((await card()).is_active, true);
});

test('Setnayan takes it down → off, with the reason, and a couple can no longer read it', async () => {
  await takeDown();
  const c = await card();
  assert.equal(c.is_active, false);
  assert.notEqual(c.taken_down_at, null);
  assert.equal(c.taken_down_reason, REASON);
  assert.equal(await coupleSeesIt(), false);
});

test('the shop’s on/off switch cannot bring it back — and is told why', async () => {
  const err = await refused(() =>
    as(F.shopUser, () =>
      db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [F.card]),
    ),
  );
  assert.match(err ?? '', /Setnayan took this card down/);
  assert.ok((err ?? '').includes(REASON), 'the refusal carries Setnayan’s reason');
  assert.equal((await card()).is_active, false);
});

test('the shop cannot lift the hold itself', async () => {
  const err = await refused(() =>
    as(F.shopUser, () =>
      db.query(
        `UPDATE public.vendor_services SET taken_down_at = NULL, taken_down_reason = NULL WHERE vendor_service_id = $1`,
        [F.card],
      ),
    ),
  );
  assert.match(err ?? '', /Only Setnayan/);
  assert.notEqual((await card()).taken_down_at, null);
});

test('the maker’s RPC cannot publish it, but CAN save it as a draft', async () => {
  const fields = JSON.stringify({
    category: 'live_band',
    title: 'Takedown Band',
    starting_price_php: 30000,
    primary_photo_r2_key: COVER,
  });
  const inclusions = JSON.stringify([{ label: 'Sound system' }]);
  const call = (publish: boolean) =>
    asService(() =>
      db.query(
        `SELECT public.save_vendor_service($1::uuid, $2::uuid, $3::jsonb,
           '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4::jsonb, $5::boolean)`,
        [F.vendorId, F.card, fields, inclusions, publish],
      ),
    );
  const err = await refused(() => call(true));
  assert.match(err ?? '', /Setnayan took this card down/);
  assert.equal((await card()).is_active, false);

  assert.equal(await refused(() => call(false)), null, 'a draft save of a held card must still work');
  const c = await card();
  assert.equal(c.is_active, false);
  assert.equal(c.taken_down_reason, REASON, 'a draft save must not lift the hold');
});

test('Setnayan puts it back → live again, and a couple can read it', async () => {
  await asService(() =>
    db.query(
      `UPDATE public.vendor_services SET is_active = true, taken_down_at = NULL, taken_down_reason = NULL
        WHERE vendor_service_id = $1`,
      [F.card],
    ),
  );
  const c = await card();
  assert.equal(c.is_active, true);
  assert.equal(c.taken_down_at, null);
  assert.equal(await coupleSeesIt(), true);
});
