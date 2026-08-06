/**
 * EVERY SHOP GETS AN ADDRESS — DB-level regression test (executed, not prose).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 * `vendor_profiles.business_slug` is the ONLY thing `/v/[slug]` (and the bare
 * root `setnayan.com/{slug}`) resolves a shop by. Nothing ever wrote it:
 *
 *   • `handle_new_vendor_user()` does `INSERT INTO vendor_profiles (user_id)`
 *   • `/open-shop`'s `becomeVendor` inserts the same bare row, then patches
 *     business_name / owner / phone / email / services — never the slug
 *   • no trigger and no function in the live database mentioned the column
 *     (checked against prod `pg_proc` 2026-08-06: zero hits)
 *
 * The only writers were two server actions, BOTH gated on
 * `tierCaps().customWebsiteName` — Pro / Enterprise / Custom only. So a Free,
 * Verified or Solo shop could never hold a slug, and `lib/vendor-microsite.ts`'s
 * promise that "Free / Verified get the clean auto-composed page" pointed at a
 * page with no address. Live prod carried 2 vendor rows, both `business_slug
 * IS NULL`. Explore renders such a card with `href="#"`.
 *
 * The Pro gate was meant to gate CHOOSING a vanity address. Because no default
 * was ever minted it became a gate on HAVING one.
 *
 * ── WHAT IS ASSERTED ───────────────────────────────────────────────────────
 * Against the FULL replayed prod schema (every migration, real triggers):
 *   1. the real registration shape (bare insert → later UPDATE of business_name)
 *      mints a slug
 *   2. the slug satisfies the app's own SLUG_RE, /^[a-z0-9-]{3,32}$/
 *   3. two shops with the SAME name get DIFFERENT slugs
 *   4. a slug is NEVER regenerated — a public URL is a promise
 *   5. a shop named after a top-level route never takes that route's word
 *   6. EVERY word in lib/reserved-slugs.ts is reserved in the database too
 *      (anti-drift: adding a word to the TS list and not the DB fails here)
 *   7. an un-slugifiable name still yields a valid address
 *   8. minting publishes NOTHING — public_visibility stays 'hidden'
 *
 * (8) is the load-bearing one. `public_visibility` defaulting to 'hidden' is an
 * owner ruling (2026-07-27, "no. we only show shops that are ready"), enforced
 * by `guard_vendor_profiles_entitlement`. Giving a shop an address must not
 * become a back door that puts a real company on the public web.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { RESERVED_SLUGS } from '../../lib/reserved-slugs';

let replay: ReplayResult;
let db: PGlite;

/** The app's own format, verbatim from app/vendor-dashboard/actions.ts. */
const SLUG_RE = /^[a-z0-9-]{3,32}$/;

let seq = 0;
function nextEmail(tag: string): string {
  seq += 1;
  return `slugmint-${tag}-${seq}@example.test`;
}

/**
 * Register a shop the way production actually does it: create a VENDOR auth
 * account (so `handle_new_vendor_user` provisions the bare `vendor_profiles`
 * row with no name), then UPDATE business_name — which is exactly what
 * /open-shop's `becomeVendor` does one statement later.
 *
 * Deliberately NOT `INSERT ... (user_id, business_name)`: that shape would let
 * an INSERT-only trigger pass while the real registration path still minted
 * nothing.
 */
async function registerShop(businessName: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [nextEmail('reg')],
  );
  const uid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  const vendorProfileId = v.rows[0]?.vendor_profile_id;
  assert.ok(
    vendorProfileId,
    'precondition: a vendor auth account must be auto-provisioned a vendor_profiles row',
  );
  await db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [
    vendorProfileId,
    businessName,
  ]);
  return vendorProfileId!;
}

async function readShop(vendorProfileId: string) {
  const r = await db.query<{
    business_slug: string | null;
    business_name: string | null;
    public_visibility: string;
    public_id: string;
  }>(
    `SELECT business_slug, business_name, public_visibility, public_id
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('a shop registered the real way (bare row, then named) gets a public address', async () => {
  const id = await registerShop('Bloom & Vine Studio');
  const row = await readShop(id);

  assert.ok(
    row.business_slug,
    'a named shop must hold a business_slug — without one /v/[slug] cannot resolve it and its Explore card links to "#"',
  );
  assert.match(
    row.business_slug!,
    SLUG_RE,
    `minted slug ${JSON.stringify(row.business_slug)} must satisfy the app's own SLUG_RE`,
  );
  // Derived from the name, not an opaque id, when the name allows it.
  assert.ok(
    row.business_slug!.startsWith('bloom'),
    `expected a name-derived address, got ${JSON.stringify(row.business_slug)}`,
  );
});

test('minting an address publishes NOTHING — the shop stays hidden', async () => {
  const id = await registerShop('Quietly Unlisted Events');
  const row = await readShop(id);

  assert.ok(row.business_slug, 'precondition: the shop was given an address');
  assert.equal(
    row.public_visibility,
    'hidden',
    'owner ruling 2026-07-27 ("we only show shops that are ready"): having an address must never imply being listed',
  );
});

test('two shops with the same name get different addresses', async () => {
  const a = await registerShop('Manila Wedding Films');
  const b = await registerShop('Manila Wedding Films');

  const rowA = await readShop(a);
  const rowB = await readShop(b);

  assert.ok(rowA.business_slug && rowB.business_slug, 'both shops must get an address');
  assert.notEqual(
    rowA.business_slug,
    rowB.business_slug,
    'a collision must be resolved, not left to abort the second shop on the unique index',
  );
  assert.match(rowB.business_slug!, SLUG_RE);
});

test('an address is never regenerated — renaming the shop keeps the old URL working', async () => {
  const id = await registerShop('First Name Studio');
  const before = (await readShop(id)).business_slug;
  assert.ok(before);

  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Completely Different Name' WHERE vendor_profile_id = $1`,
    [id],
  );
  const after = (await readShop(id)).business_slug;

  assert.equal(
    after,
    before,
    'a public address already handed out must survive a rename — silently moving it 404s every link and QR already printed',
  );
});

test('a shop named after a top-level route never takes that route', async () => {
  // 'explore' is a real page (/explore). A shop literally named "Explore" must
  // not shadow it, and — because RESERVED_SLUGS.has(slug) → notFound() at the
  // bare root — must not mint an address that resolves nowhere either.
  const id = await registerShop('Explore');
  const row = await readShop(id);

  assert.ok(row.business_slug, 'the shop still gets an address');
  assert.notEqual(row.business_slug, 'explore', 'must not claim a reserved top-level route');
  assert.match(row.business_slug!, SLUG_RE);
});

test('every word reserved in lib/reserved-slugs.ts is reserved in the database', async () => {
  // ANTI-DRIFT. The database cannot import the TypeScript list, so the two are
  // written twice — exactly the shape that rots silently. This test compares
  // them mechanically: add a word to the TS file without adding it to the
  // migration and this fails, naming the word.
  const words = [...RESERVED_SLUGS];
  assert.ok(words.length > 50, 'precondition: the reserved list was read, not empty');

  const { rows } = await db.query<{ word: string }>(
    `SELECT w AS word
       FROM unnest($1::text[]) AS w
      WHERE NOT public.business_slug_is_reserved(w)
      ORDER BY w`,
    [words],
  );

  assert.deepEqual(
    rows.map((r) => r.word),
    [],
    'these words are reserved in lib/reserved-slugs.ts but NOT in the database — a minted shop address could shadow a real route',
  );
});

test('a name that slugifies to nothing still gets a valid address', async () => {
  const id = await registerShop('★★★');
  const row = await readShop(id);

  assert.ok(row.business_slug, 'an un-slugifiable name must still produce an address');
  assert.match(
    row.business_slug!,
    SLUG_RE,
    `fallback address ${JSON.stringify(row.business_slug)} must satisfy SLUG_RE`,
  );
  // The documented fallback is the row's own public id, which is unique by
  // construction.
  assert.equal(row.business_slug, row.public_id.toLowerCase());
});

test('erasing a shop does not hand its address back', async () => {
  // The erasure scrub (lib/erasure/coverage.ts VENDOR_PROFILE_PII_SCRUB) clears
  // `business_slug` and blanks `business_name` in ONE statement — and that
  // statement names business_name, so the mint trigger fires on it. If the
  // trigger did not require a NON-BLANK name it would re-mint from the row's
  // public id and quietly resurrect the erased vendor's public URL.
  const id = await registerShop('Leaving Soon Weddings');
  assert.ok((await readShop(id)).business_slug, 'precondition: the shop had an address');

  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = '', business_slug = NULL
      WHERE vendor_profile_id = $1`,
    [id],
  );

  assert.equal(
    (await readShop(id)).business_slug,
    null,
    'an erased shop must stay address-less — re-minting would put the erased profile back on a public URL',
  );
});

test('a very long business name is truncated to a usable address', async () => {
  const id = await registerShop(
    'The Extraordinarily Long And Very Descriptive Wedding Photography Company Of Metro Manila',
  );
  const row = await readShop(id);

  assert.ok(row.business_slug);
  assert.match(row.business_slug!, SLUG_RE, 'a 32-char ceiling is part of the app format');
  assert.ok(
    !row.business_slug!.endsWith('-'),
    'truncation must not leave a trailing hyphen — it reads as a broken URL',
  );
});
