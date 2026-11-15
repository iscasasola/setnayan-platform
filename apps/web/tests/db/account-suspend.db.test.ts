/**
 * ⏸ ACCOUNT SUSPEND — the database half (migration 20271344061337). Owner 2026-11-13, "Yes, add both".
 *
 * Proves, against the replayed schema:
 *   · suspending a person hides every shop they own — the SAME column the fraud desk uses (fraud_suspended_at,
 *     stamped with the person's own suspended_at) plus public_visibility = 'hidden', which every Find / booking
 *     gate already reads;
 *   · unsuspending restores both — the person's row is cleared and the shop's suspension is lifted (it stays hidden,
 *     exactly as unsuspendVendor does today; relisting is /admin/verify's call);
 *   · a shop the FRAUD DESK had already suspended is neither re-stamped nor lifted by the person's hold;
 *   · the person can never lift (or set) their own hold through their own session — the guard;
 *   · internal accounts are refused; a passed Until is lifted by lift_expired_account_suspensions().
 * The sign-in half (GoTrue banned_until) is lib/account-suspension-flow.test.ts.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

async function newSupplier(): Promise<{ userId: string; shopId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`suspend-${++seq}@suspend.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const shopId =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Suspend Test', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  // A listed, verified shop — what a suspension has to take down.
  await db.query(
    `UPDATE public.vendor_profiles SET public_visibility = 'verified', verification_state = 'verified', last_verified_at = now() WHERE vendor_profile_id = $1`,
    [shopId],
  );
  return { userId, shopId };
}

type Person = { suspended_at: string | null; suspended_until: string | null; suspended_reason: string | null };
async function person(userId: string): Promise<Person> {
  await reset();
  return (
    await db.query<Person>(`SELECT suspended_at, suspended_until, suspended_reason FROM public.users WHERE user_id = $1`, [
      userId,
    ])
  ).rows[0]!;
}
type Shop = { fraud_suspended_at: string | null; public_visibility: string };
async function shop(shopId: string): Promise<Shop> {
  await reset();
  return (
    await db.query<Shop>(
      `SELECT fraud_suspended_at, public_visibility::text AS public_visibility FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [shopId],
    )
  ).rows[0]!;
}

async function suspend(userId: string, until: string | null, reason = 'Spam'): Promise<unknown> {
  await reset();
  return (
    await db.query<{ r: unknown }>(`SELECT public.admin_suspend_account($1, $2::timestamptz, $3) AS r`, [userId, until, reason])
  ).rows[0]!.r;
}
async function lift(userId: string): Promise<unknown> {
  await reset();
  return (await db.query<{ r: unknown }>(`SELECT public.admin_lift_account_suspension($1) AS r`, [userId])).rows[0]!.r;
}

test('suspending a person hides their shop with the fraud desk’s own column; unsuspend restores both', async () => {
  const { userId, shopId } = await newSupplier();
  assert.equal((await shop(shopId)).public_visibility, 'verified', 'fixture: the shop should start listed');

  const r = (await suspend(userId, null)) as { shops: string[]; suspended_at: string };
  const p = await person(userId);
  assert.ok(p.suspended_at, 'the person was not stamped');
  assert.equal(p.suspended_until, null);
  assert.equal(p.suspended_reason, 'Spam');
  assert.deepEqual(r.shops, [shopId]);

  const s = await shop(shopId);
  assert.ok(s.fraud_suspended_at, 'the shop was not suspended');
  assert.equal(new Date(s.fraud_suspended_at!).getTime(), new Date(p.suspended_at!).getTime(), 'not the same instant');
  assert.equal(s.public_visibility, 'hidden', 'the shop is still listed');

  // The shipped booking gate refuses a suspended shop (migration 20271335513615's predicate, read in the SAME terms).
  await reset();
  const bookable = await db.query<{ ok: boolean }>(
    `SELECT (verification_state = 'verified' AND fraud_suspended_at IS NULL AND fraud_banned_at IS NULL) AS ok
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shopId],
  );
  assert.equal(bookable.rows[0]!.ok, false);

  const l = (await lift(userId)) as { shops: string[]; was_reason: string };
  assert.deepEqual(l.shops, [shopId]);
  assert.equal(l.was_reason, 'Spam');
  const p2 = await person(userId);
  assert.deepEqual(p2, { suspended_at: null, suspended_until: null, suspended_reason: null });
  const s2 = await shop(shopId);
  assert.equal(s2.fraud_suspended_at, null, 'the shop is still suspended after the lift');
  assert.equal(s2.public_visibility, 'hidden', 'the lift relisted the shop — relisting is Verify’s call (open owner question)');
});

test('a shop the fraud desk suspended first is neither re-stamped nor lifted by the person’s hold', async () => {
  const { userId, shopId } = await newSupplier();
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles SET fraud_suspended_at = '2026-01-01T00:00:00Z', public_visibility = 'hidden' WHERE vendor_profile_id = $1`,
    [shopId],
  );
  const r = (await suspend(userId, null)) as { shops: string[] };
  assert.deepEqual(r.shops, []);
  await lift(userId);
  const s = await shop(shopId);
  assert.equal(new Date(s.fraud_suspended_at!).toISOString(), '2026-01-01T00:00:00.000Z', 'the fraud suspension was lifted');
});

test('the person cannot lift or shorten their own hold through their own session', async () => {
  const { userId } = await newSupplier();
  await suspend(userId, null, 'Abuse or harassment');
  await setAuthUid(db, userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await db.query(
      `UPDATE public.users SET suspended_at = NULL, suspended_until = NULL, suspended_reason = NULL WHERE user_id = $1`,
      [userId],
    );
  } catch {
    // a refusal is also fine — what matters is the row below
  }
  const p = await person(userId);
  assert.ok(p.suspended_at, 'a suspended person cleared their own hold');
  assert.equal(p.suspended_reason, 'Abuse or harassment');

  // …nor give themselves one through the same door (the guard holds both directions).
  const other = await newSupplier();
  await setAuthUid(db, other.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await db.query(`UPDATE public.users SET suspended_at = now(), suspended_reason = 'x' WHERE user_id = $1`, [other.userId]);
  } catch {
    /* refused is fine */
  }
  assert.equal((await person(other.userId)).suspended_at, null);
});

test('refusals: an internal account, a second suspension, an Until in the past, no reason', async () => {
  const { userId } = await newSupplier();
  await reset();
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [userId]);
  await assert.rejects(suspend(userId, null), /suspend_internal_account/);
  await db.query(`UPDATE public.users SET is_internal = FALSE WHERE user_id = $1`, [userId]);

  await assert.rejects(suspend(userId, '2020-01-01T00:00:00Z'), /suspend_until_in_past/);
  await assert.rejects(suspend(userId, null, '  '), /suspend_needs_reason/);
  await suspend(userId, null);
  await assert.rejects(suspend(userId, null), /suspend_already_suspended/);
  await lift(userId);
  await assert.rejects(lift(userId), /suspend_not_suspended/);
});

test('a hold whose Until has passed lifts itself — the person and their shop', async () => {
  const { userId, shopId } = await newSupplier();
  await suspend(userId, new Date(Date.now() + 3600_000).toISOString());
  // Move the hold into the past the way time would (a direct write is privileged here; the CHECK still holds).
  await reset();
  await db.query(
    `UPDATE public.users SET suspended_at = now() - interval '8 days', suspended_until = now() - interval '1 day' WHERE user_id = $1`,
    [userId],
  );
  await db.query(
    `UPDATE public.vendor_profiles SET fraud_suspended_at = (SELECT suspended_at FROM public.users WHERE user_id = $1) WHERE vendor_profile_id = $2`,
    [userId, shopId],
  );
  const rows = await db.query<{ lifted_user_id: string; lifted: { shops: string[] } }>(
    `SELECT * FROM public.lift_expired_account_suspensions()`,
  );
  const mine = rows.rows.find((r) => r.lifted_user_id === userId);
  assert.ok(mine, 'the expired hold was not lifted');
  assert.deepEqual(mine!.lifted.shops, [shopId]);
  assert.equal((await person(userId)).suspended_at, null);
  assert.equal((await shop(shopId)).fraud_suspended_at, null);
});

test('only the service role may call the three functions', async () => {
  await reset();
  for (const fn of [
    'admin_suspend_account(uuid,timestamptz,text)',
    'admin_lift_account_suspension(uuid)',
    'lift_expired_account_suspensions()',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [
        role,
        `public.${fn}`,
      ]);
      assert.equal(r.rows[0]!.ok, false, `${role} can execute ${fn}`);
    }
  }
});
