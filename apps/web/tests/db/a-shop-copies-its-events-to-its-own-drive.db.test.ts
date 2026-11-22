/**
 * ☁️ "COPY THIS EVENT TO GOOGLE DRIVE" — the schema half (migration 20271359577754, owner 2026-11-22).
 *
 *   · A shop's Drive grant belongs to the SHOP (no event), one per shop; an event grant still needs its event.
 *   · Two shops copying the SAME event each get their own folder; the couple's folder rule (one per event · kind ·
 *     Drive) still holds — the upsert lib/drive-copy.ts sends (onConflict on all four columns) works for both.
 *   · The copy ledger keeps ONE row per (event, stored object): pressing Copy twice adds nothing (no duplicates).
 *   · A shop's row is always a shop's type, and a couple's row is never owned by a shop.
 * Run from apps/web: npx tsx --test tests/db/a-shop-copies-its-events-to-its-own-drive.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { shopA: '', shopB: '', event: '', userA: '' };

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
async function err(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mkUser = async (email: string) =>
    (await one<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`, [email])).id;
  const mkShop = async (user: string, name: string) =>
    (await one<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
      [user, name],
    )).vendor_profile_id;
  F.userA = await mkUser('drive-a@drive.test');
  F.shopA = await mkShop(F.userA, 'Shop A');
  F.shopB = await mkShop(await mkUser('drive-b@drive.test'), 'Shop B');
  F.event = (await one<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Drive copy', 'birthday') RETURNING event_id`)).event_id;
});
after(async () => {
  await db?.close?.();
});

const grant = (event: string | null, shop: string | null, provider: string) =>
  err(
    `INSERT INTO public.oauth_grants (event_id, vendor_profile_id, provider, scopes, refresh_token, external_account_display)
     VALUES ($1, $2, $3, '{}', 'sealed', 'x@example.com')`,
    [event, shop, provider],
  );

test('a shop grant belongs to the shop, one per shop; an event grant still needs its event', async () => {
  assert.equal(await grant(null, F.shopA, 'drive_supplier'), null);
  assert.ok(await grant(null, F.shopA, 'drive_supplier'), 'a second Drive for the same shop was saved');
  assert.equal(await grant(null, F.shopB, 'drive_supplier'), null);
  assert.ok(await grant(null, null, 'drive'), 'a grant with no owner was saved');
  assert.ok(await grant(F.event, F.shopA, 'drive_supplier'), 'a shop grant tied to an event was saved');
  assert.ok(await grant(null, F.shopA, 'drive'), 'a couple-kind grant was saved on a shop');
  assert.equal(await grant(F.event, null, 'drive'), null, 'the couple grant is unchanged');
});

const folder = (shop: string | null, kind: string, provider: string, id: string) =>
  db.query(
    `INSERT INTO public.drive_copy_folders (event_id, kind, drive_provider, vendor_profile_id, drive_folder_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id, kind, drive_provider, vendor_profile_id) DO NOTHING`,
    [F.event, kind, provider, shop, id],
  );

test('two shops on one event each get a folder; the couple keeps one folder per (event, kind, Drive)', async () => {
  await folder(F.shopA, 'root', 'drive_supplier', 'A-root');
  await folder(F.shopB, 'root', 'drive_supplier', 'B-root');
  await folder(F.shopA, 'root', 'drive_supplier', 'A-root-2'); // a race's loser: ignored
  await folder(null, 'root', 'drive', 'couple-root');
  await folder(null, 'root', 'drive', 'couple-root-2'); // the couple's rule still holds with owner NULL
  const rows = (await db.query<{ vendor_profile_id: string | null; drive_folder_id: string }>(
    `SELECT vendor_profile_id, drive_folder_id FROM public.drive_copy_folders WHERE event_id = $1 AND kind = 'root' ORDER BY drive_folder_id`,
    [F.event],
  )).rows;
  assert.deepEqual(rows.map((r) => r.drive_folder_id), ['A-root', 'B-root', 'couple-root']);
  assert.ok(await err(
    `INSERT INTO public.drive_copy_folders (event_id, kind, drive_provider, vendor_profile_id, drive_folder_id) VALUES ($1, 'supplier_files', 'drive', $2, 'x')`,
    [F.event, F.shopA],
  ), 'a shop folder on the couple\'s Drive kind was saved');
});

const artifact = (shop: string | null, type: string, key: string) =>
  db.query(
    `INSERT INTO public.drive_copy_artifacts (event_id, vendor_profile_id, artifact_type, r2_object_key, file_name)
     VALUES ($1, $2, $3, $4, 'f.jpg')
     ON CONFLICT (event_id, r2_object_key) DO NOTHING`,
    [F.event, shop, type, key],
  );

test('the ledger keeps one row per stored object: pressing Copy twice adds nothing', async () => {
  const key = `r2://setnayan-thread-files/supplier-files/${F.shopA}/a.jpg`;
  await artifact(F.shopA, 'supplier_files', key);
  await artifact(F.shopA, 'supplier_files', key);
  const { n } = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.drive_copy_artifacts WHERE event_id = $1 AND r2_object_key = $2`, [F.event, key]);
  assert.equal(n, 1);
});

test('a shop row is a shop type, a couple row is never owned by a shop', async () => {
  assert.ok(await err(
    `INSERT INTO public.drive_copy_artifacts (event_id, vendor_profile_id, artifact_type, r2_object_key, file_name) VALUES ($1, $2, 'papic', 'k1', 'f')`,
    [F.event, F.shopA],
  ));
  assert.ok(await err(
    `INSERT INTO public.drive_copy_artifacts (event_id, vendor_profile_id, artifact_type, r2_object_key, file_name) VALUES ($1, NULL, 'supplier_album', 'k2', 'f')`,
    [F.event],
  ));
  assert.equal(await err(
    `INSERT INTO public.drive_copy_artifacts (event_id, vendor_profile_id, artifact_type, r2_object_key, file_name) VALUES ($1, NULL, 'papic', 'k3', 'f')`,
    [F.event],
  ), null, 'the couple\'s row is unchanged');
});
