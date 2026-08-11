/**
 * GUARD — a shop address is permanent, and CAN still be corrected by us.
 *
 * Two claims that have to hold at once, which is why they are measured
 * together in one file:
 *
 *   1. `vendor_profiles_business_slug_immutable` still refuses everyone. The
 *      correction path must not have widened the door it walks through.
 *   2. `admin_correct_business_slug` moves the address AND leaves forwarding
 *      behind it. A correction with no forwarding row inflicts exactly the harm
 *      the trigger exists to prevent — it only changes who caused it.
 *
 * Plus the drift that made this necessary: `LOCKED_IDENTITY_FIELD_KEYS` and the
 * `field_key` CHECK constraint are a hand-typed pair whose own source comment
 * says "never widen one without the other" — and prod ran for a day with
 * `location_city` in one and not the other, so a city correction was rejected
 * by the database and surfaced to the vendor as "please try again shortly".
 * That pair is now compared mechanically.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { LOCKED_IDENTITY_FIELD_KEYS } from '../../lib/vendor-corrections';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function newShop(name: string, slug: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ($1, $2) RETURNING vendor_profile_id`,
    [name, slug],
  );
  return r.rows[0]!.vendor_profile_id;
}
async function slugOf(id: string): Promise<string | null> {
  const r = await db.query<{ business_slug: string | null }>(
    `SELECT business_slug FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  return r.rows[0]!.business_slug;
}

test('the correction moves the address AND leaves forwarding behind it', async () => {
  const id = await newShop('Banawe Flroals', 'banaweflroals');

  const moved = await db.query<{ admin_correct_business_slug: string }>(
    `SELECT public.admin_correct_business_slug($1, $2, NULL)`,
    [id, 'banaweflorals'],
  );
  assert.equal(
    moved.rows[0]!.admin_correct_business_slug,
    'banaweflroals',
    'the function returns the OLD address so the caller can record what changed',
  );
  assert.equal(await slugOf(id), 'banaweflorals');

  const ledger = await db.query<{ entity_type: string; new_slug: string; live: boolean }>(
    `SELECT entity_type, new_slug, redirect_until > now() AS live
       FROM public.slug_change_log WHERE old_slug = 'banaweflroals'`,
  );
  assert.equal(
    ledger.rows.length,
    1,
    'no forwarding row — every printed QR carrying the old address just died, which is ' +
      'the exact harm the immutability trigger exists to prevent',
  );
  assert.equal(ledger.rows[0]!.entity_type, 'vendor');
  assert.equal(ledger.rows[0]!.new_slug, 'banaweflorals');
  assert.equal(ledger.rows[0]!.live, true, 'the forwarding row is already expired');
});

test('the trigger is STILL shut to everyone else afterwards', async () => {
  // The whole point: the correction path is a door, not a demolition. If this
  // ever passes-through, the owner ruling ("whatever they choose here will be
  // permanent") has been quietly reversed by a helper function.
  const id = await newShop('Ordinary Shop', 'ordinaryshop');
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`,
        ['sneakyshop', id],
      ),
    /SHOP_ADDRESS_IMMUTABLE/,
    'a plain UPDATE moved the address — the correction path widened the trigger',
  );
  assert.equal(await slugOf(id), 'ordinaryshop');
});

test('the hatch does NOT leak past the function call', async () => {
  // 🔑 THIS IS WHY THE FUNCTION USES A FUNCTION-LEVEL `SET` AND NOT `SET LOCAL`.
  // `SET LOCAL` inside a function body lasts to the end of the TRANSACTION, so
  // a caller doing more work in the same transaction would still be holding the
  // hatch open without knowing it. Measured: correct one shop, then try to move
  // a different one in the same transaction.
  const corrected = await newShop('Fixed Co', 'fixedco');
  const other = await newShop('Other Co', 'otherco');

  await db.query('BEGIN');
  await db.query(`SELECT public.admin_correct_business_slug($1, $2, NULL)`, [
    corrected,
    'fixedcompany',
  ]);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`,
        ['othercompany', other],
      ),
    /SHOP_ADDRESS_IMMUTABLE/,
    'the escape hatch leaked out of the function and stayed open for the rest of the transaction',
  );
  await db.query('ROLLBACK');
});

test('a malformed address is refused, not written', async () => {
  const id = await newShop('Shape Test', 'shapetest');
  await assert.rejects(
    () => db.query(`SELECT public.admin_correct_business_slug($1, $2, NULL)`, [id, 'NO']),
    /SHOP_ADDRESS_FORMAT/,
  );
  assert.equal(await slugOf(id), 'shapetest');
});

test('correcting to the SAME address changes nothing and logs nothing', async () => {
  // Idempotent on a double-submit. Without this, a second click would write a
  // forwarding row from a word to itself — a redirect loop onto the same URL.
  const id = await newShop('Same Co', 'sameco');
  await db.query(`SELECT public.admin_correct_business_slug($1, $2, NULL)`, [id, 'sameco']);
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.slug_change_log WHERE old_slug = 'sameco'`,
  );
  assert.equal(n.rows[0]!.n, 0, 'a no-op correction wrote a self-referential forwarding row');
});

test('a taken address still loses on the unique index', async () => {
  // The caller checks availability with findSlugConflict; this is the backstop
  // for the race between that check and this write. It must NOT silently
  // succeed — two shops at one address is unresolvable after the fact.
  await newShop('Incumbent', 'incumbentshop');
  const id = await newShop('Challenger', 'challengershop');
  await assert.rejects(
    () =>
      db.query(`SELECT public.admin_correct_business_slug($1, $2, NULL)`, [id, 'incumbentshop']),
    /duplicate key|unique/i,
  );
  assert.equal(await slugOf(id), 'challengershop');
});

test('the correction is not granted to anon or authenticated', async () => {
  const r = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.routine_privileges
      WHERE routine_name = 'admin_correct_business_slug'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.grantee),
    [],
    'a vendor could move their own address by calling this through PostgREST',
  );
});

test('the field-key list and the CHECK constraint say the same thing', async () => {
  // ANTI-DRIFT. These are a hand-typed pair whose source comment already said
  // "never widen one without the other" — and prod ran with `location_city` in
  // the TypeScript list and NOT in the constraint, so filing a city correction
  // was rejected by the database and reported to the vendor as a hiccup.
  const { rows } = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'vendor_correction_requests'
        AND c.conname = 'vendor_correction_requests_field_key_check'`,
  );
  assert.equal(rows.length, 1, 'the field_key CHECK constraint is missing entirely');
  const def = rows[0]!.def;

  const missing = LOCKED_IDENTITY_FIELD_KEYS.filter(
    (k) => !def.includes(`'${k}'`),
  );
  assert.deepEqual(
    missing,
    [],
    `these keys are in LOCKED_IDENTITY_FIELD_KEYS but the database will REJECT a request ` +
      `naming them — the insert fails and the vendor is told to try again shortly, forever`,
  );
});
