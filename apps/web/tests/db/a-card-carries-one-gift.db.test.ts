/**
 * A CARD CARRIES ONE GIFT — end-to-end, against replayed migrations.
 *
 * Covers 20271320258754_a_card_carries_a_shop_gift (the card maker's Gift dropdown, owner 7 Nov 2026 — DECISION_LOG
 * "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES"). The unit guard
 * (`lib/the-card-gift-is-one-dropdown.test.ts`) reads the SQL as TEXT; these RUN it:
 *
 *   ① a card can name one of the shop's own packs, and a save through `save_vendor_service` that does not mention
 *      the pack leaves it alone (the RPC is not redefined — the maker writes the column around it);
 *   ② a card can never hold the Setnayan gift AND a pack (one dropdown, one answer) — in either order;
 *   ③ a code that is not a giftable pack is refused, so a typed product can never sit on a card as a "gift".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let vendorProfileId: string;

async function save(serviceId: string | null, fields: Record<string, unknown>): Promise<string> {
  const r = await db.query<{ save_vendor_service: string }>(
    `SELECT public.save_vendor_service(
       $1::uuid, $2::uuid, $3::jsonb,
       '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false)`,
    [vendorProfileId, serviceId, JSON.stringify(fields)],
  );
  return r.rows[0]!.save_vendor_service;
}

async function readGift(id: string) {
  const r = await db.query<{ includes_setnayan_gift: boolean; gift_pack_code: string | null }>(
    `SELECT includes_setnayan_gift, gift_pack_code FROM public.vendor_services WHERE vendor_service_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function refuses(sql: string, params: unknown[], constraint: string) {
  await assert.rejects(db.query(sql, params), (e: unknown) => {
    assert.match(String((e as Error).message), new RegExp(constraint));
    return true;
  });
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('owner@onegift.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'One Gift Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
});

after(async () => {
  await db?.close();
});

test('① a card names a shop pack, and a save that does not mention it leaves it alone', async () => {
  const id = await save(null, { category: 'photography', title: 'Coverage' });
  await db.query(`UPDATE public.vendor_services SET gift_pack_code = 'EVENT_PLUS' WHERE vendor_service_id = $1`, [id]);
  assert.deepEqual(await readGift(id), { includes_setnayan_gift: false, gift_pack_code: 'EVENT_PLUS' });
  await save(id, { category: 'photography', title: 'Coverage, renamed' });
  assert.equal((await readGift(id)).gift_pack_code, 'EVENT_PLUS', 'a save through the RPC erased the card’s pack');
  // Papic rungs are giftable too.
  await db.query(`UPDATE public.vendor_services SET gift_pack_code = 'PAPIC_GUEST_500' WHERE vendor_service_id = $1`, [id]);
  assert.equal((await readGift(id)).gift_pack_code, 'PAPIC_GUEST_500');
});

test('② never the Setnayan gift AND a pack — in either order', async () => {
  const withPack = await save(null, { category: 'photography', title: 'Pack first' });
  await db.query(`UPDATE public.vendor_services SET gift_pack_code = 'COUPLE_WEBSITE_PRO' WHERE vendor_service_id = $1`, [withPack]);
  await refuses(
    `UPDATE public.vendor_services SET includes_setnayan_gift = TRUE WHERE vendor_service_id = $1`,
    [withPack],
    'vendor_services_one_gift_ck',
  );
  const withSetnayan = await save(null, { category: 'photography', title: 'Setnayan first', includes_setnayan_gift: true });
  await refuses(
    `UPDATE public.vendor_services SET gift_pack_code = 'EVENT_PLUS' WHERE vendor_service_id = $1`,
    [withSetnayan],
    'vendor_services_one_gift_ck',
  );
  // Switching is two steps in the right order — what commitVendorService does (clear the pack, then the RPC).
  await db.query(`UPDATE public.vendor_services SET gift_pack_code = NULL WHERE vendor_service_id = $1`, [withPack]);
  await save(withPack, { category: 'photography', includes_setnayan_gift: true });
  assert.deepEqual(await readGift(withPack), { includes_setnayan_gift: true, gift_pack_code: null });
});

test('③ a code that is not a giftable pack is refused', async () => {
  const id = await save(null, { category: 'photography', title: 'Not a gift' });
  for (const code of ['LIVE_STUDIO', 'papic_guest', 'PAPIC_GUEST_', '']) {
    await refuses(
      `UPDATE public.vendor_services SET gift_pack_code = $2 WHERE vendor_service_id = $1`,
      [id, code],
      'vendor_services_gift_pack_code_ck',
    );
  }
});
