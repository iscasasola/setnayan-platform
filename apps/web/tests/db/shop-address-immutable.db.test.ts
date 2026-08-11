/**
 * GUARD — the DATABASE refuses to move a shop's web address.
 *
 * Owner 2026-08-10: *"whatever they choose here will be permanent."*
 *
 * ⚠ WHY THIS EXISTS SEPARATELY FROM THE APP-SIDE GUARD. Removing the rename
 * from the My Shop editor closes the BUTTON. It does not close the DOOR:
 * `vendor_profiles_owner` is `FOR ALL` on `user_id = auth.uid()` and
 * `business_slug` carries the `authenticated` grant, so **any vendor on any tier
 * can PATCH their own address straight through PostgREST**, no UI involved. A
 * promise the database does not keep is not a promise.
 *
 * WHAT MOVING AN ADDRESS ACTUALLY COSTS, which is why it is refused rather than
 * merely discouraged: save-the-dates go out 6–12 months ahead, locked QR codes
 * are issued per customer, and the sitemap has published it — and shops have
 * **no rename forwarding**. `slug_change_log` supports `entity_type='vendor'`
 * but NOTHING HAS EVER WRITTEN A VENDOR ROW. A moved shop address does not
 * redirect. It 404s, for everyone holding the old one, forever.
 *
 * ⚠ CORRECTED — the sentence above used to add "and the bare-root resolver
 * reads it only for renamed EVENTS". That is no longer true: `resolveRenamedPath`
 * reads event, shop AND person rows. The READER is ready; the WRITER is what is
 * still missing, which is the whole reason this trigger stays closed.
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
  await db.close();
});

async function newShop(name: string, slug: string | null): Promise<string> {
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

test('META: the trigger is installed on the column', async () => {
  // Without this, every refusal below could be passing for some other reason.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgname = 'vendor_profiles_business_slug_immutable' AND NOT tgisinternal`,
  );
  assert.equal(r.rows[0]!.n, 1, 'the immutability trigger is missing');
});

test('an existing address cannot be changed', async () => {
  const id = await newShop('Banawe Florals', 'banaweflorals');
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
        'banaweblooms',
        id,
      ]),
    /SHOP_ADDRESS_IMMUTABLE/,
  );
  assert.equal(await slugOf(id), 'banaweflorals', 'the address moved anyway');
});

test('clearing it IS allowed — that is erasure, not a rename', () => {
  // ⚠ This asserted the OPPOSITE first, and CI caught it: `lib/erasure/coverage.ts`
  // nulls `business_slug` when anonymising a vendor who has asked to be deleted.
  // Refusing that would have broken an RA 10173 erasure to enforce a rule about
  // renaming — which the owner never stated. The ruling was that an address
  // cannot be MOVED, not that a shop cannot cease to exist.
  return (async () => {
    const id = await newShop('Leaving Soon Weddings', 'leavingsoonweddings');
    await db.query(
      `UPDATE public.vendor_profiles SET business_slug = NULL WHERE vendor_profile_id = $1`,
      [id],
    );
    assert.equal(await slugOf(id), null, 'erasure could not clear the address');
  })();
});

test('the FIRST write is allowed — that is the creation path', async () => {
  const id = await newShop('Fresh Shop', null);
  await db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
    'freshshop',
    id,
  ]);
  assert.equal(await slugOf(id), 'freshshop');
});

test('the generator still mints for a shop that has none', async () => {
  // The trigger fires on the generator's own `SET business_slug = …` too. It is
  // safe by construction — the generator writes only WHERE business_slug IS NULL
  // — but "safe by construction" is exactly the kind of claim that rots, so it
  // is measured rather than argued.
  const id = await newShop('Generated Name Co', null);
  await db.query(`SELECT public.generate_business_slug_for_vendor($1)`, [id]);
  assert.equal(await slugOf(id), 'generatednameco');
});

test('an ordinary profile save is untouched', async () => {
  // `UPDATE OF business_slug` fires only when the column is in the SET list, so
  // the everyday save pays nothing. If this ever fails, the trigger has been
  // broadened and every profile edit now runs it.
  const id = await newShop('Untouched Studio', 'untouchedstudio');
  await db.query(`UPDATE public.vendor_profiles SET tagline = $1 WHERE vendor_profile_id = $2`, [
    'Now with a tagline',
    id,
  ]);
  assert.equal(await slugOf(id), 'untouchedstudio');
});

test('a deliberate correction can opt in, for that statement only', async () => {
  // The escape hatch exists so a typo or a trademark complaint has a remedy.
  // Per-statement by design: `SET LOCAL` inside a transaction, so it cannot
  // become a standing exemption someone forgets they left on.
  const id = await newShop('Typo Shop', 'tpyoshop');
  await db.query('BEGIN');
  await db.query(`SET LOCAL setnayan.allow_slug_change = 'on'`);
  await db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
    'typoshop',
    id,
  ]);
  await db.query('COMMIT');
  assert.equal(await slugOf(id), 'typoshop');

  // …and the hatch closed again with the transaction.
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
        'typoshop2',
        id,
      ]),
    /SHOP_ADDRESS_IMMUTABLE/,
    'the escape hatch outlived its statement',
  );
});

test('NEUTRALISATION: without the trigger the rename goes straight through', async () => {
  // Proves the refusals above are the trigger and not some other constraint.
  const id = await newShop('Neutralised Co', 'neutralisedco');
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER vendor_profiles_business_slug_immutable`);
  await db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
    'movedaway',
    id,
  ]);
  assert.equal(await slugOf(id), 'movedaway', 'the rename was blocked by something else entirely');
  await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER vendor_profiles_business_slug_immutable`);

  // Restored, or every later test in this file would be measuring nothing.
  const id2 = await newShop('Restored Co', 'restoredco');
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_profiles SET business_slug = $1 WHERE vendor_profile_id = $2`, [
        'movedtoo',
        id2,
      ]),
    /SHOP_ADDRESS_IMMUTABLE/,
  );
});
