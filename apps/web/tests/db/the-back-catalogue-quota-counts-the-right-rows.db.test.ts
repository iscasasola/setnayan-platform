/**
 * THE BACK-CATALOGUE QUOTA COUNTS THE RIGHT ROWS — against Postgres.
 *
 * MB11 shipped this quota as three predicates; MB19 (2026-09-04) added the
 * third, changing the UNIT from "per account" to "per category" per the
 * owner's ruling — a shop holding 20 Flowers photos may still upload to
 * Tables:
 *
 *     asset_type = 'supplier_gallery'
 *     AND source_event_id IS NULL      ← BACK-CATALOGUE
 *     AND retired_at IS NULL
 *     AND asset_subtype = <the category>  ← MB19: PER CATEGORY, not account-wide
 *
 * Drop any ONE of these three lines and the arithmetic stays perfect while
 * the number becomes wrong. Dropping the middle line: a florist who imported
 * six photos from weddings they were booked on is told their archive
 * allowance is used up. Dropping the new third line: a shop with 20 Flowers
 * photos is refused a Tables upload it should never have been rationed for.
 * Nothing goes red anywhere else, because nothing else in the system cares
 * which rows the count covered — see
 * [[one-query-many-predicates-tests-the-conjunction]].
 *
 * 🔑 THE COUNT IS RUN AS SQL HERE, NOT MOCKED. The pure ladder is tested in
 * lib/moodboard-gallery-upload.test.ts and the call site is pinned in
 * app/vendor-dashboard/moodboard-library/every-upload-is-screened.test.ts; what
 * only Postgres can answer is whether the column, the constraints and the
 * partial index actually admit and exclude the rows we think they do.
 *
 * ⚠ AND THE ERASURE DIRECTION IS TESTED, because it is the half this repo has
 * been bitten by: `source_event_id` is ON DELETE SET NULL and is named in NO
 * check constraint. A SET NULL onto a CHECKed column behaves like RESTRICT —
 * the cascade UPDATE violates the check and the PARENT delete fails — which
 * would mean deleting a celebration could be blocked by a supplier's gallery
 * photo. The last test here deletes an event and proves it succeeds.
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
const uniq = () => `mb11-${(seq += 1)}`;

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

async function addGalleryPhoto(opts: {
  vendorProfileId: string;
  sourceEventId?: string | null;
  source?: string;
  retired?: boolean;
  /** The inspiration category. Defaults to 'flowers' so existing callers,
   *  written before MB19 made this a real axis, keep meaning what they said. */
  assetSubtype?: string;
}): Promise<string> {
  const r = await db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, source_event_id, approved_at,
        rights_warranted_at, rights_warranty_version, retired_at)
     VALUES ('supplier_gallery',$7,$1,$2,$3,$4,$5,NOW(),NOW(),'v1',
             CASE WHEN $6 THEN NOW() ELSE NULL END)
     RETURNING asset_id`,
    [
      uniq(),
      `moodboard-library/${uniq()}.webp`,
      opts.source ?? 'stylist_upload',
      opts.vendorProfileId,
      opts.sourceEventId ?? null,
      opts.retired ?? false,
      opts.assetSubtype ?? 'flowers',
    ],
  );
  return r.rows[0]!.asset_id;
}

/**
 * The production count, run verbatim as SQL — MB19's per-category query.
 * `assetSubtype` is the third narrowing predicate; see the file docblock for
 * why dropping it, alone, leaves every OTHER test in this file green while
 * the quota silently reverts to account-wide.
 */
async function backCatalogueCount(
  vendorProfileId: string,
  assetSubtype: string,
): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.moodboard_library_assets
      WHERE vendor_profile_id = $1
        AND asset_type = 'supplier_gallery'
        AND asset_subtype = $2
        AND source_event_id IS NULL
        AND retired_at IS NULL`,
    [vendorProfileId, assetSubtype],
  );
  return Number(r.rows[0]!.n);
}

async function refused(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the database accepted a row it must refuse');
}

/* ── 1 · WHAT THE COUNT COVERS ─────────────────────────────────────────── */

test('⭐ event-linked photos are NOT counted; back-catalogue ones are', async () => {
  const shop = await newShop();
  const eventA = await newEvent();
  const eventB = await newEvent();

  assert.equal(await backCatalogueCount(shop, 'flowers'), 0);

  await addGalleryPhoto({ vendorProfileId: shop });
  await addGalleryPhoto({ vendorProfileId: shop });
  assert.equal(await backCatalogueCount(shop, 'flowers'), 2, 'two archive photos');

  await addGalleryPhoto({
    vendorProfileId: shop,
    sourceEventId: eventA,
    source: 'editorial_import',
  });
  await addGalleryPhoto({
    vendorProfileId: shop,
    sourceEventId: eventB,
    source: 'editorial_import',
  });
  assert.equal(
    await backCatalogueCount(shop, 'flowers'),
    2,
    'photos from celebrations they worked must not touch the allowance',
  );
});

test('a retired photo frees its slot', async () => {
  const shop = await newShop();
  const id = await addGalleryPhoto({ vendorProfileId: shop });
  assert.equal(await backCatalogueCount(shop, 'flowers'), 1);
  await db.query(
    `UPDATE public.moodboard_library_assets SET retired_at = NOW() WHERE asset_id = $1`,
    [id],
  );
  assert.equal(await backCatalogueCount(shop, 'flowers'), 0);
});

test('one shop’s photos never count against another’s', async () => {
  const a = await newShop();
  const b = await newShop();
  await addGalleryPhoto({ vendorProfileId: a });
  await addGalleryPhoto({ vendorProfileId: a });
  await addGalleryPhoto({ vendorProfileId: b });
  assert.equal(await backCatalogueCount(a, 'flowers'), 2);
  assert.equal(await backCatalogueCount(b, 'flowers'), 1);
});

test('⭐ MB19: a shop full on Flowers may still fill Tables — the quota is per category', async () => {
  const shop = await newShop();
  for (let i = 0; i < 3; i += 1) {
    await addGalleryPhoto({ vendorProfileId: shop, assetSubtype: 'flowers' });
  }
  assert.equal(await backCatalogueCount(shop, 'flowers'), 3);
  assert.equal(
    await backCatalogueCount(shop, 'table'),
    0,
    'a different category starts at zero, not at the Flowers count',
  );

  await addGalleryPhoto({ vendorProfileId: shop, assetSubtype: 'table' });
  assert.equal(await backCatalogueCount(shop, 'table'), 1);
  assert.equal(
    await backCatalogueCount(shop, 'flowers'),
    3,
    'filling Tables must not touch the Flowers count',
  );
});

test('each of the three narrowing predicates rejects a row the other two would admit', async () => {
  // Per [[one-query-many-predicates-tests-the-conjunction]]: a query with
  // several AND'd predicates can lose any ONE of them and still pass every
  // test built only from rows every predicate rejects together. Each row here
  // is excluded by exactly ONE predicate, so dropping any single line from
  // `backCatalogueCount` (asset_subtype, source_event_id, retired_at) turns
  // this test red.
  const shop = await newShop();
  const event = await newEvent();

  // Rejected ONLY by `source_event_id IS NULL` — right category, not retired.
  await addGalleryPhoto({
    vendorProfileId: shop,
    assetSubtype: 'flowers',
    sourceEventId: event,
    source: 'editorial_import',
  });

  // Rejected ONLY by `retired_at IS NULL` — right category, back-catalogue.
  const retiredId = await addGalleryPhoto({ vendorProfileId: shop, assetSubtype: 'flowers' });
  await db.query(
    `UPDATE public.moodboard_library_assets SET retired_at = NOW() WHERE asset_id = $1`,
    [retiredId],
  );

  // Rejected ONLY by `asset_subtype = 'flowers'` — back-catalogue, not retired.
  await addGalleryPhoto({ vendorProfileId: shop, assetSubtype: 'table' });

  // Admitted by all three.
  await addGalleryPhoto({ vendorProfileId: shop, assetSubtype: 'flowers' });

  assert.equal(
    await backCatalogueCount(shop, 'flowers'),
    1,
    'exactly the one row every predicate admits',
  );
});

/* ── 2 · THE CONSTRAINTS THAT KEEP THE PREDICATE HONEST ────────────────── */

test('⭐ NO check constraint names source_event_id — the erasure path stays open', async () => {
  // 🛑 THIS TEST EXISTS BECAUSE THE OPPOSITE WAS TRIED. The first draft of
  // migration 20271202522764 carried
  //   CHECK (source <> 'editorial_import' OR source_event_id IS NOT NULL)
  // and this suite refused it: an event delete cascades SET NULL onto that
  // column, the new row fails the check, and Postgres fails the PARENT DELETE.
  // A supplier's gallery photo would have blocked deleting a celebration.
  const constraints = await db.query<{ conname: string }>(
    `SELECT c.conname
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'source_event_id'
      WHERE t.relname = 'moodboard_library_assets'
        AND c.contype = 'c'
        AND a.attnum = ANY (c.conkey)`,
  );
  assert.deepEqual(
    constraints.rows,
    [],
    'a CHECK naming source_event_id turns its SET NULL into a RESTRICT',
  );

  // The rule it would have enforced lives in the INSERT instead: an import
  // written with no event is legal to the database and refused by the action
  // (pinned in every-upload-is-screened.test.ts).
  const shop = await newShop();
  const id = await addGalleryPhoto({ vendorProfileId: shop, source: 'editorial_import' });
  assert.ok(id);
});

test('the widened source vocabulary keeps every prior value', async () => {
  const shop = await newShop();
  for (const source of ['internet_placeholder', 'higgsfield_generated', 'stylist_upload']) {
    const id = await addGalleryPhoto({ vendorProfileId: shop, source });
    assert.ok(id, `${source} must still be accepted`);
  }
  await refused(() => addGalleryPhoto({ vendorProfileId: shop, source: 'made_up' }));
});

test('MB10’s warranty gate still refuses an approved photo with no warranty', async () => {
  // MB11 must not have loosened what MB10 locked.
  const shop = await newShop();
  const message = await refused(() =>
    db.query(
      `INSERT INTO public.moodboard_library_assets
         (asset_type, asset_subtype, label, storage_path, source,
          vendor_profile_id, approved_at)
       VALUES ('supplier_gallery','flowers',$1,$2,'stylist_upload',$3,NOW())`,
      [uniq(), `moodboard-library/${uniq()}.webp`, shop],
    ),
  );
  assert.match(message, /supplier_gallery_shape/);
});

/* ── 3 · THE THEFT SCAN CAN ACTUALLY RECORD THIS BUCKET ────────────────── */

test('⭐ vendor_image_hashes accepts the moodboard_library surface', async () => {
  // Before the CHECK was widened, every hash written by the moodboard upload
  // path would have violated it, been swallowed by the scan's own best-effort
  // catch, and recorded NOTHING — a theft scan that stores no hashes is
  // indistinguishable from a clean marketplace.
  const shop = await newShop();
  await db.query(
    `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash)
     VALUES ($1,'moodboard_library',$2, 42)`,
    [shop, `moodboard-library/${uniq()}.webp`],
  );
  const n = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.vendor_image_hashes
      WHERE vendor_profile_id = $1 AND surface = 'moodboard_library'`,
    [shop],
  );
  assert.equal(Number(n.rows[0]!.n), 1);

  // The two website surfaces are untouched.
  await db.query(
    `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash)
     VALUES ($1,'portfolio',$2, 43)`,
    [shop, `r2://x/${uniq()}`],
  );
  await refused(() =>
    db.query(
      `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash)
       VALUES ($1,'invented_surface',$2, 44)`,
      [shop, `r2://x/${uniq()}`],
    ),
  );
});

test('a flag can name the moodboard_library surface on both sides', async () => {
  const flagged = await newShop();
  const source = await newShop();
  await db.query(
    `INSERT INTO public.vendor_image_flags
       (flagged_vendor_id, flagged_r2_ref, flagged_surface,
        source_vendor_id, source_r2_ref, source_surface, hamming_distance)
     VALUES ($1,$2,'moodboard_library',$3,$4,'moodboard_library',3)`,
    [flagged, `moodboard-library/${uniq()}.webp`, source, `moodboard-library/${uniq()}.webp`],
  );
  const n = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.vendor_image_flags
      WHERE flagged_vendor_id = $1`,
    [flagged],
  );
  assert.equal(Number(n.rows[0]!.n), 1);
});

/* ── 4 · THE ERASURE DIRECTION ─────────────────────────────────────────── */

test('⭐ deleting a celebration does NOT fail, and demotes its photos', async () => {
  // source_event_id is SET NULL and is named in no CHECK. If a future edit adds
  // one, this test is what says so — a SET NULL onto a CHECKed column behaves
  // like RESTRICT and blocks the parent delete while still calling itself
  // SET NULL. `source` is relaxed alongside it so the demoted row stays legal.
  const shop = await newShop();
  const eventId = await newEvent();
  const assetId = await addGalleryPhoto({
    vendorProfileId: shop,
    sourceEventId: eventId,
    source: 'editorial_import',
  });
  assert.equal(await backCatalogueCount(shop, 'flowers'), 0);

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const row = await db.query<{ source_event_id: string | null }>(
    `SELECT source_event_id FROM public.moodboard_library_assets WHERE asset_id = $1`,
    [assetId],
  );
  assert.equal(row.rows.length, 1, 'the shop keeps its own photograph');
  assert.equal(row.rows[0]!.source_event_id, null, 'demoted to back-catalogue');
  assert.equal(
    await backCatalogueCount(shop, 'flowers'),
    1,
    'and it now counts — a demotion, never a takedown',
  );
});

/* ── 5 · THE GRANT IS THE ONLY THING THAT MAKES THE QUOTA REAL ─────────── */

test('⭐ SABOTAGE-PROVEN: a supplier cannot stamp an event id on their own upload', async () => {
  // 🛑 THE FINDING `exposure-freeze.db.test.ts` CAUGHT, kept as a standing
  // assertion. Supabase grants table-level ALL on every public table and a NEW
  // COLUMN INHERITS IT — so the first draft of this migration handed anon and
  // authenticated SELECT/INSERT/UPDATE on `source_event_id`.
  //
  // `moodboard_library_assets_vendor_insert` (20260527000000) admits a
  // supplier's OWN row, and RLS is ROW-level: it cannot constrain a column's
  // VALUE. With the grant, a supplier could POST straight to PostgREST with
  // `source_event_id` set to any UUID, and their upload would be EVENT-LINKED
  // — permanently outside the back-catalogue count above. The tier gate would
  // be one HTTP request wide, and every test in this file would still pass,
  // because the arithmetic was never the problem.
  //
  // Sabotage run: re-granted the column (`GRANT ALL (source_event_id) ON
  // public.moodboard_library_assets TO authenticated`) and this test went RED
  // on the INSERT assertion. Restored by re-running the migration's revoke.
  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.moodboard_library_assets',
                                     'source_event_id', $2) AS ok`,
        [role, priv],
      );
      assert.equal(
        r.rows[0]!.ok,
        false,
        `${role} must not be able to ${priv} source_event_id`,
      );
    }
  }
});

test('the narrowing took nothing else with it', async () => {
  // A mis-computed allow-list would break vendor uploads and the couple's
  // picker silently — the columns below are what both actually read.
  for (const col of [
    'asset_id', 'asset_type', 'asset_subtype', 'label', 'storage_path',
    'source', 'uploaded_by', 'approved_at', 'retired_at', 'created_at',
    'vendor_profile_id',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.moodboard_library_assets', $2, 'SELECT') AS ok`,
        [role, col],
      );
      assert.equal(r.rows[0]!.ok, true, `${role} lost SELECT on ${col}`);
    }
  }
  // And the server, which does every write on this path, keeps the column.
  const svc = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('service_role', 'public.moodboard_library_assets',
                                 'source_event_id', 'INSERT') AS ok`,
  );
  assert.equal(svc.rows[0]!.ok, true, 'service_role must keep source_event_id');
});
