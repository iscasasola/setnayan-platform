/**
 * A bundle carries its cards and a gift — migration 20271320001366, held under the real replay.
 *
 * Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED"): the bundle maker lists the shop's service cards
 * first as locked lines and gets a Gift row (No gift · Setnayan gift · the shop's own packs). The migration adds:
 *   · vendor_packages.includes_setnayan_gift / gift_pack_code — only giftable codes, never both;
 *   · vendor_package_items.vendor_service_id — which line is a card, only the SAME shop's card, SET NULL on delete.
 *
 * What would go wrong without each check: a bundle offering a non-giftable SKU (LIVE_STUDIO) as a free gift; a
 * bundle promising BOTH gifts; a supplier pointing a line at ANOTHER shop's card (its name and from-price would show
 * as theirs); a deleted card taking the bundle line with it instead of leaving it as a plain line.
 *
 * Run from apps/web: pnpm exec tsx --test tests/db/a-bundle-carries-its-cards-and-a-gift.db.test.ts
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function asSetup(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer'::text)) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function refusedWith(sql: string, params: unknown[]): Promise<string | null> {
  try {
    const r = await db.query(sql, params as never[]);
    return (r.rows?.length ?? 0) === 0 && /returning/i.test(sql) ? 'zero rows' : null;
  } catch (e) {
    return (e as Error).message;
  }
}

const F = { owner1: '', vendor1: '', vendor2: '', pkg1: '', card1: '', card2: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asSetup();
  F.owner1 = await createUser('owner-1@bundle-gift.test');
  const owner2 = await createUser('owner-2@bundle-gift.test');
  F.vendor1 = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Shop One') RETURNING vendor_profile_id`,
      [F.owner1],
    )
  ).rows[0]!.vendor_profile_id;
  F.vendor2 = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Shop Two') RETURNING vendor_profile_id`,
      [owner2],
    )
  ).rows[0]!.vendor_profile_id;
  F.card1 = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active)
       VALUES ($1, 'catering', 'Shop One catering', FALSE) RETURNING vendor_service_id`,
      [F.vendor1],
    )
  ).rows[0]!.vendor_service_id;
  F.card2 = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active)
       VALUES ($1, 'catering', 'Shop Two catering', FALSE) RETURNING vendor_service_id`,
      [F.vendor2],
    )
  ).rows[0]!.vendor_service_id;
  F.pkg1 = (
    await db.query<{ package_id: string }>(
      `INSERT INTO public.vendor_packages
         (vendor_profile_id, package_name, total_price_centavos, consumable_budget_centavos,
          is_consumable_flexible, primary_canonical_service)
       VALUES ($1, 'Catering bundle', 2000000, 0, FALSE, 'catering') RETURNING package_id`,
      [F.vendor1],
    )
  ).rows[0]!.package_id;
});

after(async () => {
  await db?.close();
});

test('a new bundle has no gift — both columns start empty', async () => {
  await asSetup();
  const r = await db.query<{ includes_setnayan_gift: boolean; gift_pack_code: string | null }>(
    `SELECT includes_setnayan_gift, gift_pack_code FROM public.vendor_packages WHERE package_id = $1`,
    [F.pkg1],
  );
  assert.deepEqual(r.rows[0], { includes_setnayan_gift: false, gift_pack_code: null });
});

test('only a giftable code can be the gift — a Papic pack, Event Plus, Event Pro; never LIVE_STUDIO', async () => {
  await asSetup();
  for (const code of ['PAPIC_GUEST', 'PAPIC_GUEST_500', 'EVENT_PLUS', 'COUPLE_WEBSITE_PRO']) {
    const err = await refusedWith(`UPDATE public.vendor_packages SET gift_pack_code = $2 WHERE package_id = $1`, [
      F.pkg1,
      code,
    ]);
    assert.equal(err, null, `${code} is giftable and was refused: ${err}`);
  }
  for (const code of ['LIVE_STUDIO', 'papic_guest', 'PAPIC_GUESTX', '']) {
    const err = await refusedWith(`UPDATE public.vendor_packages SET gift_pack_code = $2 WHERE package_id = $1`, [
      F.pkg1,
      code,
    ]);
    assert.ok(err && /vendor_packages_gift_pack_code_ck/.test(err), `${JSON.stringify(code)} was accepted as a gift`);
  }
  await db.query(`UPDATE public.vendor_packages SET gift_pack_code = NULL WHERE package_id = $1`, [F.pkg1]);
});

test('one gift per bundle — the Setnayan gift and a shop pack together are refused', async () => {
  await asSetup();
  const err = await refusedWith(
    `UPDATE public.vendor_packages SET includes_setnayan_gift = TRUE, gift_pack_code = 'EVENT_PLUS' WHERE package_id = $1`,
    [F.pkg1],
  );
  assert.ok(err && /vendor_packages_one_gift_ck/.test(err), 'a bundle promised both gifts');
  assert.equal(
    await refusedWith(`UPDATE public.vendor_packages SET includes_setnayan_gift = TRUE WHERE package_id = $1`, [F.pkg1]),
    null,
  );
  await db.query(`UPDATE public.vendor_packages SET includes_setnayan_gift = FALSE WHERE package_id = $1`, [F.pkg1]);
});

test('the shop owner writes the gift under RLS — the existing row policy covers the new columns', async () => {
  await asUser(F.owner1);
  const r = await db.query<{ package_id: string }>(
    `UPDATE public.vendor_packages SET gift_pack_code = 'PAPIC_GUEST' WHERE package_id = $1 RETURNING package_id`,
    [F.pkg1],
  );
  assert.equal(r.rows.length, 1, 'the owner could not set the gift on their own bundle');
  await asSetup();
});

test("a card line must be the same shop's card — another shop's card is refused", async () => {
  await asSetup();
  const own = await refusedWith(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order,
        parent_option_id, is_default_included, vendor_service_id)
     VALUES ($1, 'catering', 'Shop One catering', 0, 0, NULL, TRUE, $2) RETURNING item_id`,
    [F.pkg1, F.card1],
  );
  assert.equal(own, null, `the shop's own card was refused: ${own}`);

  const theirs = await refusedWith(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order,
        parent_option_id, is_default_included, vendor_service_id)
     VALUES ($1, 'catering', 'Shop Two catering', 0, 1, NULL, TRUE, $2) RETURNING item_id`,
    [F.pkg1, F.card2],
  );
  assert.ok(
    theirs && /owned by the package's own shop/.test(theirs),
    `a line pointed at another shop's card was not refused by the same-owner trigger (${theirs})`,
  );
});

test('a deleted card leaves the line as a plain line (SET NULL), never deletes it', async () => {
  await asSetup();
  const before = await db.query<{ item_id: string }>(
    `SELECT item_id FROM public.vendor_package_items WHERE package_id = $1 AND vendor_service_id = $2`,
    [F.pkg1, F.card1],
  );
  assert.equal(before.rows.length, 1);
  await db.query(`DELETE FROM public.vendor_services WHERE vendor_service_id = $1`, [F.card1]);
  const after = await db.query<{ vendor_service_id: string | null }>(
    `SELECT vendor_service_id FROM public.vendor_package_items WHERE item_id = $1`,
    [before.rows[0]!.item_id],
  );
  assert.equal(after.rows.length, 1, 'deleting the card deleted the bundle line');
  assert.equal(after.rows[0]!.vendor_service_id, null);
});

test('the same-owner check is not callable by app roles', async () => {
  await asSetup();
  const r = await db.query<{ anon: boolean; authed: boolean }>(
    `SELECT has_function_privilege('anon', 'public.vendor_package_item_service_same_owner()', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.vendor_package_item_service_same_owner()', 'EXECUTE') AS authed`,
  );
  assert.deepEqual(r.rows[0], { anon: false, authed: false });
});
