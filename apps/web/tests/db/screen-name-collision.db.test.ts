/**
 * Screen-name slug collision — DB-level regression test (executed, not prose).
 *
 * Guards migration 20270820111851_fix_screen_name_slug_collision_namespace.sql,
 * the real prod fix for the 20260714000000 screen-name generator bug:
 *
 *   generate_screen_name_for_vendor() minted the numeric id per
 *   (city, canonical_service) but built the UNIQUE slug from (city, display,
 *   id). Two DIFFERENT service keys resolving to the SAME display label —
 *   commonly two keys absent from canonical_service_schemas, both falling back
 *   to 'Wedding Vendor' — got independent id sequences both starting at 1, so
 *   in the same city they minted IDENTICAL slugs and the SECOND vendor's
 *   INSERT aborted on the unique index (vendor_profiles_screen_name_slug_unique).
 *
 * Verified against the FULL replayed prod schema (no shim): the fix mints in
 * the slug's own (city, display) namespace + a bounded uniqueness-retry loop.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

// Two service keys guaranteed NOT in canonical_service_schemas → both resolve
// to the 'Wedding Vendor' fallback label (the collision precondition).
const ORPHAN_A = 'zzz_orphan_key_a';
const ORPHAN_B = 'zzz_orphan_key_b';

/**
 * Insert a vendor whose (city, services) are present AT INSERT time, so the
 * AFTER-INSERT screen-name trigger fires on the fully-populated row. A
 * 'customer' auth account is NOT auto-provisioned a vendor_profiles row, so
 * this is a genuine INSERT (not an ON CONFLICT update over a pre-provisioned
 * empty row) — exactly the direct-insert signup/seed vector that trips the bug.
 */
async function insertVendorWithService(email: string, city: string, service: string) {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const uid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, $3, ARRAY[$4]::text[])
     RETURNING vendor_profile_id`,
    [uid, `Collision Test ${service}`, city, service],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function readScreenName(vendorProfileId: string) {
  const r = await db.query<{
    screen_name: string;
    screen_name_slug: string;
    screen_name_id: number;
    screen_name_taxonomy: string;
  }>(
    `SELECT screen_name, screen_name_slug, screen_name_id, screen_name_taxonomy
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // Precondition: neither orphan key exists in the taxonomy, so both hit the
  // 'Wedding Vendor' fallback — otherwise the test wouldn't exercise the bug.
  const present = await db.query(
    `SELECT canonical_service FROM public.canonical_service_schemas
      WHERE canonical_service IN ($1, $2)`,
    [ORPHAN_A, ORPHAN_B],
  );
  assert.equal(present.rows.length, 0, 'orphan service keys must be absent from the taxonomy');
});

after(async () => {
  await db?.close();
});

test('replay runs the REAL screen-name migration end-to-end (no shim)', () => {
  // The replay-only patch is gone; the real fix migration is what makes the
  // full corpus replay cleanly. If this passes, the harness applied everything.
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('two same-city vendors with distinct fallback-label services BOTH insert with distinct slugs', async () => {
  // Under the bug, the second INSERT here threw
  //   duplicate key value violates unique constraint
  //     "vendor_profiles_screen_name_slug_unique"
  // and aborted the signup transaction.
  const v1 = await insertVendorWithService('collide-a@screen.test', 'Testcolis', ORPHAN_A);
  const v2 = await insertVendorWithService('collide-b@screen.test', 'Testcolis', ORPHAN_B);

  const s1 = await readScreenName(v1);
  const s2 = await readScreenName(v2);

  // Both actually got a screen name (trigger ran, no abort).
  assert.ok(s1.screen_name_slug, 'vendor 1 got a slug');
  assert.ok(s2.screen_name_slug, 'vendor 2 got a slug');

  // Same (city, display) namespace → sequential ids, distinct slugs.
  assert.equal(s1.screen_name_taxonomy, 'Testcolis Wedding Vendor');
  assert.equal(s2.screen_name_taxonomy, 'Testcolis Wedding Vendor');
  assert.equal(s1.screen_name_slug, 'testcolis-wedding-vendor-1');
  assert.equal(s2.screen_name_slug, 'testcolis-wedding-vendor-2');
  assert.notEqual(
    s1.screen_name_slug.toLowerCase(),
    s2.screen_name_slug.toLowerCase(),
    'distinct slugs — no collision',
  );
});

test('a third same-namespace vendor keeps climbing the sequence', async () => {
  const v3 = await insertVendorWithService('collide-c@screen.test', 'Testcolis', ORPHAN_A);
  const s3 = await readScreenName(v3);
  assert.equal(s3.screen_name_slug, 'testcolis-wedding-vendor-3', 'third vendor → id 3');
});

test('persistence: re-firing the generator NEVER changes an existing screen_name', async () => {
  const v = await insertVendorWithService('persist@screen.test', 'Persistville', ORPHAN_A);
  const before = await readScreenName(v);
  assert.ok(before.screen_name, 'generated on insert');

  // Re-invoke the generator directly (as the trigger would). Persistence rule
  // must short-circuit: the stored name is untouched, no new id is minted.
  await db.query(`SELECT public.generate_screen_name_for_vendor($1)`, [v]);
  const after = await readScreenName(v);

  assert.equal(after.screen_name, before.screen_name, 'screen_name unchanged');
  assert.equal(after.screen_name_slug, before.screen_name_slug, 'slug unchanged');
  assert.equal(after.screen_name_id, before.screen_name_id, 'id unchanged (no re-mint)');
});

test('venue exception preserved: Ceremony/Reception venues keep their real name (no screen_name)', async () => {
  const v = await insertVendorWithService('venue@screen.test', 'Venuetown', 'venue');
  const s = await readScreenName(v);
  assert.equal(s.screen_name, null, 'venue vendors are not anonymized');
  assert.equal(s.screen_name_slug, null, 'no slug for venues');
});
