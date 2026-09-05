/**
 * THE GALLERY RANKS EVENT-LINKED FIRST — proven against Postgres (MB22).
 *
 * MB22's whole job is "the standing-out happens where the couple is actually
 * comparing photos" — event-linked photos ahead of back-catalogue, in the
 * same picker slot. The sort key is a brand-new generated column
 * (`is_event_linked`, migration 20271204967268), added specifically because
 * `source_event_id` itself is REVOKED from `anon`/`authenticated` (MB11,
 * 20271202522764) and the couple-facing picker cannot read OR order by a
 * column it has no SELECT privilege on — using the user's own client to
 * `.order('source_event_id', …)` would throw, not silently do the wrong
 * thing. `ugat-schema-claims.db.test.ts` proves the CHECK/FK shapes exist;
 * this file proves the GRANT and the ORDERING actually behave.
 *
 * Three things, each a real failure mode if wrong:
 *
 *   1. `is_event_linked` tracks `source_event_id IS NOT NULL` for real rows —
 *      not just at INSERT time, but after the FK's `ON DELETE SET NULL`
 *      demotes a row to back-catalogue (MB11's whole reason for that FK
 *      shape). A generated column recomputes on every read, so this is
 *      really testing "does the demotion still flow through", not the
 *      generation expression in isolation.
 *   2. The GRANT reaches exactly as far as intended: `anon`/`authenticated`
 *      can read the boolean, and — the one thing this migration must never
 *      do — still cannot read `source_event_id` itself. A behavioural probe,
 *      not introspection: SET ROLE and try the query for real, the same
 *      shape `exposure-freeze.db.test.ts` uses so a real REVOKE and a
 *      believed one cannot quietly disagree.
 *   3. The ORDER BY partitions correctly: event-linked photos before
 *      back-catalogue, and recency still orders each partition — proven with
 *      the EXACT clause `fetchGalleryAssets` runs, not a paraphrase.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

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
const uniq = () => `mb22-${(seq += 1)}`;

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [uniq()],
  );
  return e.rows[0]!.event_id;
}

async function newShop(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq()}@shop.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1,'Bloom & Vine') RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** An approved, warranted supplier-gallery asset with one sampled colour. */
async function newAsset(opts: {
  vendorProfileId: string;
  sourceEventId: string | null;
  slot?: string;
  createdAt?: string;
}): Promise<string> {
  const r = await db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, source_event_id, approved_at,
        rights_warranted_at, rights_warranty_version, created_at)
     VALUES ('supplier_gallery', $1, $2, $3, 'stylist_upload', $4, $5, NOW(),
             NOW(), 'v1', COALESCE($6::timestamptz, NOW()))
     RETURNING asset_id`,
    [
      opts.slot ?? 'flowers',
      uniq(),
      `moodboard-library/${uniq()}.webp`,
      opts.vendorProfileId,
      opts.sourceEventId,
      opts.createdAt ?? null,
    ],
  );
  const assetId = r.rows[0]!.asset_id;
  await db.query(
    `INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex)
     VALUES ($1, 1, '#B22222')`,
    [assetId],
  );
  return assetId;
}

/* ── 1 · THE GENERATED COLUMN TRACKS source_event_id, INCLUDING DEMOTION ── */

test('⭐ is_event_linked is TRUE for an event-linked row, FALSE for back-catalogue', async () => {
  const shop = await newShop();
  const event = await newEvent();
  const linked = await newAsset({ vendorProfileId: shop, sourceEventId: event });
  const backCatalogue = await newAsset({ vendorProfileId: shop, sourceEventId: null });

  const r = await db.query<{ asset_id: string; is_event_linked: boolean }>(
    `SELECT asset_id, is_event_linked FROM public.moodboard_library_assets
      WHERE asset_id = ANY($1::uuid[])`,
    [[linked, backCatalogue]],
  );
  const byId = new Map(r.rows.map((row) => [row.asset_id, row.is_event_linked]));
  assert.equal(byId.get(linked), true);
  assert.equal(byId.get(backCatalogue), false);
});

test('⭐ deleting the EVENT demotes the row, and is_event_linked follows — it is not cached', async () => {
  // MB11's whole reason `source_event_id` is ON DELETE SET NULL rather than
  // CASCADE: the photo is the shop's, not the event's. A generated column
  // that failed to track a post-insert SET NULL would silently keep crediting
  // a deleted celebration.
  const shop = await newShop();
  const event = await newEvent();
  const assetId = await newAsset({ vendorProfileId: shop, sourceEventId: event });

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [event]);

  const r = await db.query<{ source_event_id: string | null; is_event_linked: boolean }>(
    `SELECT source_event_id, is_event_linked FROM public.moodboard_library_assets
      WHERE asset_id = $1`,
    [assetId],
  );
  assert.equal(r.rows[0]!.source_event_id, null, 'FK must SET NULL, not block the delete');
  assert.equal(r.rows[0]!.is_event_linked, false, 'the flag must demote WITH the row');
});

/* ── 2 · THE GRANT REACHES EXACTLY THIS FAR, BEHAVIOURALLY ──────────────── */

test('⭐ THE GUARD · authenticated can read is_event_linked but still cannot read source_event_id', async () => {
  const shop = await newShop();
  const event = await newEvent();
  await newAsset({ vendorProfileId: shop, sourceEventId: event });

  await db.exec('SET ROLE authenticated');
  try {
    const who = await db.query<{ me: string }>(`SELECT current_user AS me`);
    assert.equal(who.rows[0]!.me, 'authenticated', 'SET ROLE did not take effect');

    // (a) the new column is readable — this is the feature.
    await db.query(`SELECT is_event_linked FROM public.moodboard_library_assets LIMIT 1`);

    // (b) the column MB11 revoked must STILL be refused — this migration's
    //     one hard constraint.
    await assert.rejects(
      db.query(`SELECT source_event_id FROM public.moodboard_library_assets LIMIT 1`),
      (e: unknown) => /permission denied/i.test(e instanceof Error ? e.message : String(e)),
      'source_event_id must still be refused to authenticated — MB22 must not reopen MB11',
    );
  } finally {
    await db.exec('RESET ROLE');
  }
});

test('⭐ THE GUARD · anon gets the same shape: is_event_linked yes, source_event_id no', async () => {
  const shop = await newShop();
  await newAsset({ vendorProfileId: shop, sourceEventId: null });

  await db.exec('SET ROLE anon');
  try {
    await db.query(`SELECT is_event_linked FROM public.moodboard_library_assets LIMIT 1`);
    await assert.rejects(
      db.query(`SELECT source_event_id FROM public.moodboard_library_assets LIMIT 1`),
      (e: unknown) => /permission denied/i.test(e instanceof Error ? e.message : String(e)),
    );
  } finally {
    await db.exec('RESET ROLE');
  }
});

/* ── 3 · THE EXACT ORDER BY fetchGalleryAssets RUNS ─────────────────────── */

test('⭐ THE GUARD · event-linked sorts FIRST, and recency orders each partition', async () => {
  const shop = await newShop();
  const eventA = await newEvent();
  const eventB = await newEvent();
  // A REAL inspiration slot — asset_subtype is CHECK-constrained to the
  // shipped vocabulary (see moodboard_library_assets_supplier_gallery_shape),
  // not an arbitrary string.
  const slot = 'cake';

  // Inserted oldest → newest, deliberately out of the order we expect back.
  const backOld = await newAsset({
    vendorProfileId: shop,
    sourceEventId: null,
    slot,
    createdAt: '2026-01-01T00:00:00Z',
  });
  const linkedOld = await newAsset({
    vendorProfileId: shop,
    sourceEventId: eventA,
    slot,
    createdAt: '2026-01-02T00:00:00Z',
  });
  const backNew = await newAsset({
    vendorProfileId: shop,
    sourceEventId: null,
    slot,
    createdAt: '2026-01-03T00:00:00Z',
  });
  const linkedNew = await newAsset({
    vendorProfileId: shop,
    sourceEventId: eventB,
    slot,
    createdAt: '2026-01-04T00:00:00Z',
  });

  // The exact clause fetchGalleryAssets runs (actions.ts): event-linked
  // first, then recency, then asset_id as the final tiebreak.
  const r = await db.query<{ asset_id: string }>(
    `SELECT asset_id FROM public.moodboard_library_assets
      WHERE asset_type = 'supplier_gallery' AND asset_subtype = $1
        AND approved_at IS NOT NULL AND retired_at IS NULL
      ORDER BY is_event_linked DESC, created_at DESC, asset_id ASC`,
    [slot],
  );

  assert.deepEqual(
    r.rows.map((row) => row.asset_id),
    [linkedNew, linkedOld, backNew, backOld],
    'both event-linked rows must precede both back-catalogue rows, each group newest-first',
  );
});
