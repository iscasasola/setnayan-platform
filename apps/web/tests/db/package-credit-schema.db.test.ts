/**
 * PACKAGE CREDIT foundation — schema verification against the FULL replayed
 * prod schema (every migration, in order, in an in-memory PGlite).
 * Covers 20271006413374_vendor_package_credit_required_and_choice_options.
 *
 * What is asserted here (things a pure unit test cannot prove):
 *   • the migration APPLIES on top of the whole corpus (it is not enough that
 *     the SQL "looks idempotent" — the repo has been bitten by half-applied
 *     migrations before);
 *   • vendor_package_items.is_required defaults FALSE — the flag-OFF hold.
 *     If it ever defaulted TRUE, every existing line would become
 *     un-removable the moment the migration landed;
 *   • vendor_packages.unspent_credit_policy is 'expiring' and NOTHING else —
 *     'refundable' is RETIRED (owner 2026-07-26: credit shifts, never discounts);
 *   • an option's price delta cannot be negative — a negative delta is the
 *     one shape that would let a REQUIRED line mint credit;
 *   • the DEFAULT option is free (the package price already includes it);
 *   • at most ONE default per line;
 *   • options CASCADE-delete with their line, so no option can outlive the
 *     item a booking resolves it through;
 *   • RLS is enabled with the same public-read / owner-write pattern the
 *     sibling package tables use.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

const MIGRATION_FILE = '20271006413374_vendor_package_credit_required_and_choice_options.sql';

let replay: ReplayResult;
let db: PGlite;
let packageId: string;
let itemId: string;
let vendorProfileId: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // A vendor profile to hang the package off. account_type 'customer' so the
  // auth trigger doesn't mint a competing vendor_profiles row.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('pkg-credit-vendor@example.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const userId = u.rows[0]!.id;

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Package Credit Test Hotel') RETURNING vendor_profile_id`,
    [userId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const p = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, 'Credit Model Package', 2000000, 30000, TRUE, 'reception_venue')
     RETURNING package_id`,
    [vendorProfileId],
  );
  packageId = p.rows[0]!.package_id;

  const i = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'catering', 'Main course', 300000, 2)
     RETURNING item_id`,
    [packageId],
  );
  itemId = i.rows[0]!.item_id;
});

after(async () => {
  await db?.close();
});

test('the credit migration applied on top of the full corpus', () => {
  assert.ok(replay.applied > 0, 'migrations replayed');
  const skippedFiles = replay.skipped.map((s) => s.file);
  assert.ok(
    !skippedFiles.some((f) => f.includes('vendor_package_credit')),
    `the credit migration must not be skipped, skipped = ${JSON.stringify(skippedFiles)}`,
  );
});

test('is_required defaults FALSE — the flag-OFF hold on every existing line', async () => {
  const r = await db.query<{ is_required: boolean }>(
    `SELECT is_required FROM public.vendor_package_items WHERE item_id = $1`,
    [itemId],
  );
  assert.equal(
    r.rows[0]!.is_required,
    false,
    'a line inserted without the column must stay removable, exactly as today',
  );

  await assert.rejects(
    db.query(`UPDATE public.vendor_package_items SET is_required = NULL WHERE item_id = $1`, [itemId]),
    /null/i,
    'NOT NULL — no tri-state ambiguity on required-ness',
  );
});

test("unspent_credit_policy is 'expiring' and NOTHING else — credit never discounts", async () => {
  // Owner-locked 2026-07-26: "credits can be shifted to other services, but
  // will not discount the price." 'refundable' is RETIRED at the DB, not merely
  // unused — it took unspent budget off the total, so a couple who customized
  // nothing paid less and still received everything.
  const r = await db.query<{ unspent_credit_policy: string }>(
    `SELECT unspent_credit_policy FROM public.vendor_packages WHERE package_id = $1`,
    [packageId],
  );
  assert.equal(r.rows[0]!.unspent_credit_policy, 'expiring');

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_packages SET unspent_credit_policy = 'refundable' WHERE package_id = $1`,
      [packageId],
    ),
    /check/i,
    'refundable is retired — a discount policy must be impossible to store',
  );
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_packages SET unspent_credit_policy = 'rollover' WHERE package_id = $1`,
      [packageId],
    ),
    /check/i,
    'an unknown policy has no defined money behaviour',
  );
});

test('an option price delta cannot be negative (a negative delta would mint credit)', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_item_options (item_id, option_label, price_delta_centavos)
       VALUES ($1, 'Suspiciously cheap', -50000)`,
      [itemId],
    ),
    /check/i,
  );
});

test('the DEFAULT option must be free — the package price already includes it', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_item_options
         (item_id, option_label, price_delta_centavos, is_default)
       VALUES ($1, 'Default with a surcharge', 25000, TRUE)`,
      [itemId],
    ),
    /check|default_is_free/i,
  );
});

test('at most ONE default option per line', async () => {
  await db.query(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, is_default, display_order)
     VALUES ($1, 'Lechon', 0, TRUE, 1)`,
    [itemId],
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_item_options
         (item_id, option_label, price_delta_centavos, is_default, display_order)
       VALUES ($1, 'Also default', 0, TRUE, 2)`,
      [itemId],
    ),
    /unique|duplicate/i,
    'two defaults would make the assumed-in-the-price option ambiguous',
  );
});

test('a non-default premium alternative is accepted and keeps a STABLE id', async () => {
  const ins = await db.query<{ option_id: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, display_order)
     VALUES ($1, 'Wagyu', 25000, 3) RETURNING option_id`,
    [itemId],
  );
  const optionId = ins.rows[0]!.option_id;

  // The whole point of a child table with its own PK: a vendor re-price
  // updates the delta IN PLACE, so a stored selection re-resolves to the new
  // number instead of drifting on a copied one.
  await db.query(
    `UPDATE public.vendor_package_item_options SET price_delta_centavos = 30000 WHERE option_id = $1`,
    [optionId],
  );
  const after = await db.query<{ price_delta_centavos: string; option_id: string }>(
    `SELECT option_id, price_delta_centavos FROM public.vendor_package_item_options WHERE option_id = $1`,
    [optionId],
  );
  assert.equal(after.rows[0]!.option_id, optionId, 'identity survives a re-price');
  assert.equal(Number(after.rows[0]!.price_delta_centavos), 30000);
});

test('options CASCADE with their line — no option outlives the item it prices', async () => {
  const tmpItem = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'cake_desserts', 'Dessert', 40000, 9) RETURNING item_id`,
    [packageId],
  );
  const tmpItemId = tmpItem.rows[0]!.item_id;
  await db.query(
    `INSERT INTO public.vendor_package_item_options (item_id, option_label, price_delta_centavos)
     VALUES ($1, 'Halo-halo', 0)`,
    [tmpItemId],
  );
  await db.query(`DELETE FROM public.vendor_package_items WHERE item_id = $1`, [tmpItemId]);
  const left = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_package_item_options WHERE item_id = $1`,
    [tmpItemId],
  );
  assert.equal(left.rows[0]!.n, 0);
});

test('RLS is enabled on the options table with the sibling public-read / owner-write pattern', async () => {
  const rls = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.vendor_package_item_options'::regclass`,
  );
  assert.equal(rls.rows[0]!.relrowsecurity, true, 'RLS enabled at create time');

  const policies = await db.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'vendor_package_item_options'
     ORDER BY policyname`,
  );
  const names = policies.rows.map((r) => r.policyname);
  assert.deepEqual(names, [
    'vendor_package_item_options_owner_write',
    'vendor_package_item_options_public_read',
  ]);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* REQUIRED implies INCLUDED — the DB half of the money fix                   */
/* ────────────────────────────────────────────────────────────────────────── */

test('required + NOT included is REFUSED at the DB (it would be delivered free)', async () => {
  // Without this CHECK the combination is authorable, and the engine used to
  // resolve it as "keep the line": the couple receives an inclusion nobody
  // charged for, and the cascade prices an event_vendors row off its
  // replacement_value_centavos, inflating the 5% platform-fee base.
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, is_required, is_default_included)
       VALUES ($1, 'catering', 'Compulsory upsell nobody bought', 900000, 20, TRUE, FALSE)`,
      [packageId],
    ),
    /check|required_implies_included/i,
  );

  // ...and it cannot be reached by UPDATE either.
  const good = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, is_required, is_default_included)
     VALUES ($1, 'catering', 'Legitimately required line', 0, 21, TRUE, TRUE)
     RETURNING item_id`,
    [packageId],
  );
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET is_default_included = FALSE WHERE item_id = $1`,
      [good.rows[0]!.item_id],
    ),
    /check|required_implies_included/i,
  );
});

test('optional + NOT included is still allowed (an un-ticked upsell is legitimate)', async () => {
  const r = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, is_required, is_default_included)
     VALUES ($1, 'photography', 'Optional extra', 50000, 22, FALSE, FALSE)
     RETURNING item_id`,
    [packageId],
  );
  assert.ok(r.rows[0]!.item_id, 'the CHECK must only bite the required+excluded shape');
});

/* ────────────────────────────────────────────────────────────────────────── */
/* The DEFAULT option may never be retired                                    */
/* ────────────────────────────────────────────────────────────────────────── */

test('the DEFAULT option cannot be marked unavailable (it would brick the whole package)', async () => {
  // The engine falls back to the default for any kept OPTIONAL choice line
  // the couple did not pick, and errors are all-or-nothing — so one retired
  // default makes the ENTIRE package uncomputable for every couple, not just
  // that line. A vendor doing the thing is_available exists for must not be
  // able to take a live package down.
  const item = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'cake_desserts', 'Dessert (choice)', 40000, 30) RETURNING item_id`,
    [packageId],
  );
  const dessertId = item.rows[0]!.item_id;

  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_item_options
         (item_id, option_label, price_delta_centavos, is_default, is_available)
       VALUES ($1, 'Retired default', 0, TRUE, FALSE)`,
      [dessertId],
    ),
    /check|default_is_available/i,
  );

  const okOpt = await db.query<{ option_id: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, is_default, is_available)
     VALUES ($1, 'Halo-halo', 0, TRUE, TRUE) RETURNING option_id`,
    [dessertId],
  );
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_item_options SET is_available = FALSE WHERE option_id = $1`,
      [okOpt.rows[0]!.option_id],
    ),
    /check|default_is_available/i,
    'and it cannot be retired after the fact either',
  );

  // A NON-default alternative may of course still be retired.
  const alt = await db.query<{ option_id: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, display_order)
     VALUES ($1, 'Gateau', 12000, 2) RETURNING option_id`,
    [dessertId],
  );
  await db.query(
    `UPDATE public.vendor_package_item_options SET is_available = FALSE WHERE option_id = $1`,
    [alt.rows[0]!.option_id],
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* The §4 promote-to-required backfill — actually executed, not assumed       */
/* ────────────────────────────────────────────────────────────────────────── */

test('the §4 backfill promotes zero-value ANCHOR lines and touches nothing else', async () => {
  // The replay corpus has no seeded vendor packages (the 20260604110000 seeds
  // key off vendor_profiles rows that do not exist on a fresh DB), so the
  // migration's UPDATE ran against zero rows and was previously unproven.
  // Here the REAL statement is lifted out of the migration file and replayed
  // against data shaped like the seed, so a future edit to its WHERE clause
  // is caught rather than silently untested.
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8');
  const match = sql.match(/UPDATE public\.vendor_package_items i[\s\S]*?;/);
  assert.ok(match, 'the §4 backfill UPDATE must still exist in the migration');
  const backfillSql = match![0];
  assert.ok(
    backfillSql.includes('is_required = TRUE'),
    'the extracted statement must be the promote-to-required backfill',
  );

  const p = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, 'Backfill Shape Package', 140000000, 20000000, TRUE, 'reception_venue')
     RETURNING package_id`,
    [vendorProfileId],
  );
  const pid = p.rows[0]!.package_id;

  // (a) the seed's anchor shape — zero value, ticked, anchor service.
  const anchor = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'reception_venue', 'Grand Ballroom', 0, 1) RETURNING item_id`,
    [pid],
  );
  // (b) anchor service but carries REAL value — must NOT be promoted.
  const valuedAnchor = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'reception_venue', 'Second hall', 500000, 2) RETURNING item_id`,
    [pid],
  );
  // (c) zero value but NOT the anchor service — a free giveaway line that
  //     must stay removable.
  const freeGiveaway = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, replacement_value_centavos, display_order)
     VALUES ($1, 'catering', 'Free welcome drink', 0, 3) RETURNING item_id`,
    [pid],
  );

  await db.exec(backfillSql);

  const rows = await db.query<{ item_id: string; is_required: boolean }>(
    `SELECT item_id, is_required FROM public.vendor_package_items WHERE package_id = $1`,
    [pid],
  );
  const byId = new Map(rows.rows.map((r) => [r.item_id, r.is_required]));
  assert.equal(byId.get(anchor.rows[0]!.item_id), true, 'the zero-value anchor line is promoted');
  assert.equal(
    byId.get(valuedAnchor.rows[0]!.item_id),
    false,
    'MONEY GUARD: a line carrying real value must never become un-removable',
  );
  assert.equal(
    byId.get(freeGiveaway.rows[0]!.item_id),
    false,
    'a free non-anchor line stays removable',
  );

  // And re-running is a no-op (the AND i.is_required = FALSE guard).
  await db.exec(backfillSql);
  const again = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_package_items
     WHERE package_id = $1 AND is_required = TRUE`,
    [pid],
  );
  assert.equal(again.rows[0]!.n, 1, 'idempotent');
});

test('the seeded required-ness WORKAROUND still frees zero credit', async () => {
  // The 20260604110000 seed priced the anchor venue line at 0 so unchecking
  // it returned nothing. The new migration promotes such lines to
  // is_required = TRUE, which must be a strict money no-op: the value was
  // already 0, so no pool can move.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
     FROM public.vendor_package_items i
     JOIN public.vendor_packages p ON p.package_id = i.package_id
     WHERE i.is_required = TRUE
       AND i.canonical_service = p.primary_canonical_service
       AND i.replacement_value_centavos <> 0`,
  );
  assert.equal(
    r.rows[0]!.n,
    0,
    'the promote-to-required backfill must never touch a line that carries real value',
  );
});
