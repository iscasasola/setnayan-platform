/**
 * 💾 THE PLAN HOLDS STORAGE — covers 20271342883073_supplier_plan_storage_allowance.
 *
 * Owner 2026-11-13 (specs DECISION_LOG ce2d0a8 "plan storage"): Solo 5 GB · Pro 10 GB · Ultra 15 GB included in the
 * plan. Free and Free · Verified keep what they had: no allowance.
 *
 *   · PARITY derives from the TypeScript side (`TIER_CAPS[t].storageBytes`), so editing one side alone turns CI red;
 *   · the database refuses NEW bytes past the allowance, as the shop itself under RLS;
 *   · a link to a copy already counted is never refused; removing a file makes room; nothing is ever deleted;
 *   · GRANDFATHERED: a shop over a lowered allowance keeps every file, and only the next new bytes are refused;
 *   · the usage read is service-role only.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { STORAGE_GB, TIER_CAPS, VENDOR_TIERS, type VendorTier } from '../../lib/vendor-tier-caps';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const GB = STORAGE_GB;

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

let seq = 0;
type Shop = { uid: string; shop: string; ev: string; ev2: string };

/** A shop on `tier` that talks to two events (a chat thread each — the filing guard's "an event it talks to"). */
async function newShop(tier: VendorTier): Promise<Shop> {
  await asOwner();
  const n = ++seq;
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
      [`shop-${n}@storage.test`],
    )
  ).rows[0]!.id;
  const shop = (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0]!.v;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = $2 WHERE vendor_profile_id = $1`, [shop, tier]);
  const mkEvent = async (name: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
         VALUES ($1, 'wedding', 'catholic', 'banquet_hall', '2027-04-10'::date) RETURNING event_id AS e`,
        [name],
      )
    ).rows[0]!.e;
  const ev = await mkEvent(`Lia & Ben ${n}`);
  const ev2 = await mkEvent(`Mara & Jo ${n}`);
  for (const e of [ev, ev2]) {
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [e, shop, uid]);
  }
  return { uid, shop, ev, ev2 };
}

/** The shop stores one copy of `bytes` (as itself, under RLS). */
async function store(s: Shop, bytes: number): Promise<string> {
  await asUser(s.uid);
  const n = ++seq;
  const r = await db.query<{ m: string }>(
    `INSERT INTO public.supplier_media (vendor_profile_id, content_sha256, r2_ref, mime, size_bytes)
     VALUES ($1, $2, $3, 'application/pdf', $4) RETURNING media_id AS m`,
    [s.shop, n.toString(16).padStart(64, '0'), `r2://setnayan-thread-files/supplier-files/${s.shop}/ev/${n}.pdf`, bytes],
  );
  await asOwner();
  return r.rows[0]!.m;
}

/** The shop files a stored copy on an event (a document in This booking). 'ok' or the refusal. */
async function file(s: Shop, media: string, ev = s.ev): Promise<{ id: string | null; error: string | null }> {
  await asUser(s.uid);
  try {
    const r = await db.query<{ f: string }>(
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, media_id, file_name)
       VALUES ($1, $2, 'booking', 'document', $3, 'Contract.pdf') RETURNING file_id AS f`,
      [ev, s.shop, media],
    );
    return { id: r.rows[0]!.f, error: null };
  } catch (e) {
    return { id: null, error: (e as Error).message };
  } finally {
    await asOwner();
  }
}

async function used(shop: string): Promise<number> {
  await asOwner();
  return Number((await db.query<{ u: string }>(`SELECT public.vendor_storage_used_bytes($1) AS u`, [shop])).rows[0]!.u);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('vendor_tier_limit(…,storage_gb) says exactly what TIER_CAPS says — every tier', async () => {
  for (const tier of VENDOR_TIERS) {
    const r = await db.query<{ gb: number | null }>(`SELECT public.vendor_tier_limit($1,'storage_gb') AS gb`, [tier]);
    const gb = r.rows[0]!.gb;
    assert.equal(gb === null ? null : gb * GB, TIER_CAPS[tier].storageBytes, `${tier} storage`);
  }
  const unknown = await db.query<{ gb: number | null }>(`SELECT public.vendor_tier_limit(NULL,'storage_gb') AS gb`);
  assert.equal(unknown.rows[0]!.gb, null, 'an unknown tier reads as Free — no allowance');
  // The arms that were already there are untouched (copied verbatim).
  const r = await db.query<{ b: number }>(`SELECT public.vendor_tier_limit('pro','bookings_per_date_per_service') AS b`);
  assert.equal(r.rows[0]!.b, TIER_CAPS.pro.bookingsPerDatePerService);
});

test('Solo: files up to exactly 5 GB, and the next new byte is refused with storage_allowance', async () => {
  const s = await newShop('solo');
  assert.equal((await file(s, await store(s, 3 * GB))).error, null);
  assert.equal((await file(s, await store(s, 2 * GB))).error, null, 'exactly 5 GB must fit');
  assert.equal(await used(s.shop), 5 * GB);
  const over = await file(s, await store(s, 1));
  assert.match(over.error ?? '', /storage_allowance/, 'a byte past 5 GB was let in');
  assert.equal(await used(s.shop), 5 * GB, 'the refused file was counted');
});

test('Pro holds 10 GB and Ultra 15 GB', async () => {
  const pro = await newShop('pro');
  assert.equal((await file(pro, await store(pro, 10 * GB))).error, null);
  assert.match((await file(pro, await store(pro, 1))).error ?? '', /storage_allowance/);
  const ultra = await newShop('enterprise');
  assert.equal((await file(ultra, await store(ultra, 15 * GB))).error, null);
  assert.match((await file(ultra, await store(ultra, 1))).error ?? '', /storage_allowance/);
});

test('Free and Verified keep what they had: no allowance, never refused', async () => {
  for (const tier of ['free', 'verified'] as const) {
    const s = await newShop(tier);
    assert.equal((await file(s, await store(s, 40 * GB))).error, null, `${tier} was refused`);
  }
});

test('a link to a copy already counted adds nothing and is never refused — even at full', async () => {
  const s = await newShop('solo');
  const m = await store(s, 5 * GB);
  assert.equal((await file(s, m)).error, null);
  assert.equal((await file(s, m, s.ev2)).error, null, 'the same copy on a second event was refused');
  assert.equal(await used(s.shop), 5 * GB, 'one copy on two events counted twice');
});

test('removing a file makes room; the stored copy is not deleted; re-linking it past the allowance is refused', async () => {
  const s = await newShop('solo');
  const a = await store(s, 4 * GB);
  const fa = await file(s, a);
  assert.equal(fa.error, null);
  await asUser(s.uid);
  await db.query(`DELETE FROM public.event_supplier_files WHERE file_id = $1`, [fa.id]);
  await asOwner();
  assert.equal(await used(s.shop), 0, 'a copy no file points at still counts — the shop could never make room');
  const kept = await db.query(`SELECT 1 FROM public.supplier_media WHERE media_id = $1`, [a]);
  assert.equal(kept.rows.length, 1, 'the stored copy was deleted');
  assert.equal((await file(s, await store(s, 3 * GB))).error, null, 'the room was not given back');
  assert.match((await file(s, a)).error ?? '', /storage_allowance/, 'a re-link of 4 GB on top of 3 GB was let in');
});

test('GRANDFATHERED: a shop over a lowered allowance keeps every file; only the next new bytes are refused', async () => {
  const s = await newShop('pro');
  const m = await store(s, 8 * GB);
  assert.equal((await file(s, m)).error, null);
  // Drop the plan underneath them (admin path — the downgrade guard is a separate concern).
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER USER`);
  try {
    await db.query(`UPDATE public.vendor_profiles SET tier_state = 'solo' WHERE vendor_profile_id = $1`, [s.shop]);
  } finally {
    await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER USER`);
  }
  const files = await db.query(`SELECT 1 FROM public.event_supplier_files WHERE vendor_profile_id = $1`, [s.shop]);
  assert.equal(files.rows.length, 1, 'a file was taken away');
  assert.equal(await used(s.shop), 8 * GB);
  assert.equal((await file(s, m, s.ev2)).error, null, 'a link to a counted copy was refused');
  assert.match((await file(s, await store(s, 1))).error ?? '', /storage_allowance/);
});

test('the usage read is the service role’s alone — a signed-in supplier cannot call it', async () => {
  const s = await newShop('solo');
  await asUser(s.uid);
  await assert.rejects(db.query(`SELECT public.vendor_storage_used_bytes($1)`, [s.shop]), /permission denied/);
  await asOwner();
  const grants = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('service_role', 'public.vendor_storage_used_bytes(uuid)', 'EXECUTE') AS ok`,
  );
  assert.equal(grants.rows[0]!.ok, true);
});
