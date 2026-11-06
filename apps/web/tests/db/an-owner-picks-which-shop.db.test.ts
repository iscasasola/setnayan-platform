/**
 * AN OWNER PICKS WHICH SHOP — the active-shop resolver (`lib/active-shop.ts`) RUN FOR REAL against the replayed
 * schema, as the signed-in person (RLS and the grants apply), with TWO shops.
 *
 * ⚖ Owner 2026-10-22: every account switches between all of its shops from the avatar sheet. The world:
 *   • ANA owns shop A (her vendor sign-up opened it) and is an ADMIN helper in shop B;
 *   • BEN owns shop B;
 *   • CAT owns nothing and is a helper in shop B only.
 *
 * Each test is one hole the switch could open:
 *   1. no choice → Ana stands in the shop she OWNS (what every page did before a switch existed);
 *   2. Ana switched to B → B, as a helper (owned: false); Cat → B;
 *   3. 🔒 a forged / foreign shop id falls back to her own shop — it never opens and nothing is written to it;
 *   4. 🔒 A WRITE AFTER SWITCHING LANDS ON THE SWITCHED SHOP: switched to B, a programme segment Ana saves through the
 *      resolved id is B's, and A gains nothing; switched back to A, the next one is A's;
 *   5. 🔒 owner-only editors: switched to B, `resolveOwnedActiveShop` refuses in words — and the database agrees
 *      (Ana's update of B's profile matches zero rows), so the refusal is the truth, not a guess; switched to A, the
 *      edit lands on A and B is untouched;
 *   6. a refused shop read THROWS — it is never "you have no shop".
 *
 * 🛡 Sabotaged, each red then restored (2026-10-22, see the PR body): `pickActiveShop` ignoring the seat list → 2 & 4
 * red; returning a chosen id without checking it → 3 red; `resolveOwnedActiveShop` not checking `owned` → 5 red;
 * the resolver answering null on a refused read → 6 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import './supabase-over-pglite'; // the `server-only` shim, before any production module loads
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';

type Shop = typeof import('../../lib/active-shop');
let S: Shop;
let replay: ReplayResult;
let db: PGlite;

let ANA = '';
let BEN = '';
let CAT = '';
let SHOP_A = '';
let SHOP_B = '';
const FOREIGN = '00000000-0000-4000-8000-0000000000ff';

async function mkUser(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

/** The shop a vendor sign-up opened for this person (the trigger makes it; user_id is UNIQUE). */
async function shopOf(uid: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `UPDATE public.vendor_profiles SET business_name = $2 WHERE user_id = $1 RETURNING vendor_profile_id`,
    [uid, name],
  );
  assert.equal(r.rows.length, 1, `the vendor sign-up did not open a shop for ${name}`);
  return r.rows[0]!.vendor_profile_id;
}

async function segmentsOf(shop: string): Promise<string[]> {
  const r = await db.query<{ label: string }>(
    `SELECT label FROM public.vendor_activities WHERE vendor_profile_id = $1 ORDER BY created_at, label`,
    [shop],
  );
  return r.rows.map((x) => x.label);
}

async function nameOf(shop: string): Promise<string> {
  const r = await db.query<{ business_name: string }>(
    `SELECT business_name FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]!.business_name;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);

  ANA = await mkUser(`ana-${Date.now()}@example.test`, 'vendor');
  BEN = await mkUser(`ben-${Date.now()}@example.test`, 'vendor');
  CAT = await mkUser(`cat-${Date.now()}@example.test`, 'customer');
  SHOP_A = await shopOf(ANA, 'Ana Lights');
  SHOP_B = await shopOf(BEN, 'Ben Sounds');
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'admin')`,
    [SHOP_B, ANA, CAT],
  );

  S = await import('../../lib/active-shop');
});

after(async () => {
  await db?.close?.();
});

const as = (uid: string): SupabaseClient => clientAs(db, uid);

test('META: the world is two real shops, and Ana is an owner of one and a helper of the other', async () => {
  assert.notEqual(SHOP_A, SHOP_B);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_team_members WHERE user_id = $1 AND vendor_profile_id = $2`,
    [ANA, SHOP_B],
  );
  assert.equal(r.rows[0]!.n, 1);
});

test('1 · no choice → the shop she owns', async () => {
  assert.deepEqual(await S.resolveActiveShop(as(ANA), ANA, null), { vendorProfileId: SHOP_A, owned: true });
  assert.deepEqual(await S.resolveActiveShop(as(BEN), BEN, null), { vendorProfileId: SHOP_B, owned: true });
});

test('2 · switched to the shop she helps in → that shop, as a helper; a helper with no shop of her own too', async () => {
  assert.deepEqual(await S.resolveActiveShop(as(ANA), ANA, SHOP_B), { vendorProfileId: SHOP_B, owned: false });
  assert.deepEqual(await S.resolveActiveShop(as(ANA), ANA, SHOP_A), { vendorProfileId: SHOP_A, owned: true });
  assert.deepEqual(await S.resolveActiveShop(as(CAT), CAT, null), { vendorProfileId: SHOP_B, owned: false });
  assert.deepEqual(await S.resolveActiveShop(as(CAT), CAT, SHOP_B), { vendorProfileId: SHOP_B, owned: false });
});

test('3 · a forged or foreign shop id never opens — it falls back to her own', async () => {
  assert.deepEqual(await S.resolveActiveShop(as(ANA), ANA, FOREIGN), { vendorProfileId: SHOP_A, owned: true });
  // Cat cannot name Ana's shop into being hers.
  assert.deepEqual(await S.resolveActiveShop(as(CAT), CAT, SHOP_A), { vendorProfileId: SHOP_B, owned: false });
});

test('4 · a write after switching lands on the switched shop — and switching back moves the next one', async () => {
  const before = { a: await segmentsOf(SHOP_A), b: await segmentsOf(SHOP_B) };

  const inB = await S.resolveActiveShop(as(ANA), ANA, SHOP_B);
  const w1 = await as(ANA)
    .from('vendor_activities')
    .insert({ vendor_profile_id: inB!.vendorProfileId, label: 'Grand march (B)' })
    .select('vendor_profile_id');
  assert.equal(w1.error, null, `the helper's write to the shop she switched into was refused: ${w1.error?.message}`);
  assert.deepEqual(await segmentsOf(SHOP_B), [...before.b, 'Grand march (B)'], 'the write did not land on shop B');
  assert.deepEqual(await segmentsOf(SHOP_A), before.a, 'switched to B, the write ALSO (or instead) touched shop A');

  const inA = await S.resolveActiveShop(as(ANA), ANA, SHOP_A);
  const w2 = await as(ANA)
    .from('vendor_activities')
    .insert({ vendor_profile_id: inA!.vendorProfileId, label: 'First dance (A)' })
    .select('vendor_profile_id');
  assert.equal(w2.error, null, w2.error?.message);
  assert.deepEqual(await segmentsOf(SHOP_A), [...before.a, 'First dance (A)'], 'switched back, the write did not land on A');
  assert.deepEqual(await segmentsOf(SHOP_B), [...before.b, 'Grand march (B)'], 'switched back to A, B changed');
});

test('5 · owner-only editors refuse in the shop she only helps in — and the database agrees', async () => {
  const inB = await S.resolveOwnedActiveShop(as(ANA), ANA, SHOP_B);
  assert.deepEqual(inB, { ok: false, error: S.OWNER_ONLY_SHOP_EDIT }, 'a helper was handed an owner-only edit of B');

  // The refusal is the truth: B's profile row will not take her write (owner-only policy) — zero rows, no error.
  const direct = await as(ANA)
    .from('vendor_profiles')
    .update({ business_name: 'Hijacked' })
    .eq('vendor_profile_id', SHOP_B)
    .select('vendor_profile_id');
  assert.deepEqual(direct.data, [], 'RLS let a helper rewrite the shop owner\'s profile — the words would be wrong');
  assert.equal(await nameOf(SHOP_B), 'Ben Sounds');

  const inA = await S.resolveOwnedActiveShop(as(ANA), ANA, SHOP_A);
  assert.deepEqual(inA, { ok: true, vendorProfileId: SHOP_A });
  const edit = await as(ANA)
    .from('vendor_profiles')
    .update({ business_name: 'Ana Lights & Co' })
    .eq('vendor_profile_id', (inA as { vendorProfileId: string }).vendorProfileId)
    .select('vendor_profile_id');
  assert.deepEqual(edit.data, [{ vendor_profile_id: SHOP_A }], edit.error?.message);
  assert.equal(await nameOf(SHOP_A), 'Ana Lights & Co');
  assert.equal(await nameOf(SHOP_B), 'Ben Sounds', 'editing her own shop touched the one she helps in');

  assert.deepEqual(await S.resolveOwnedActiveShop(as(CAT), CAT, null), { ok: false, error: S.OWNER_ONLY_SHOP_EDIT });
});

test('6 · a refused shop read throws — never "you have no shop"', async () => {
  const refused = {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  await assert.rejects(() => S.resolveActiveShop(refused, ANA, null), /unreadable/);
  assert.deepEqual(await S.resolveOwnedActiveShop(refused, ANA, null), { ok: false, error: S.SHOP_UNREADABLE });
});
