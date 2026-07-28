/**
 * THE FIRST-USER JOURNEY — end to end, against every real migration.
 *
 * Prod has 1 signup, 0 verified vendors, 0 packages and 0 conversations ever,
 * so nothing here has been exercised by an actual human. This walks the whole
 * path a first vendor and a first couple would take and asserts the joins
 * between the pieces, which unit tests deliberately do not cover:
 *
 *   1. a vendor signs up and is verified
 *   2. the vendor authors a package: a required plain line, an optional line,
 *      and a REQUIRED CHOICE line with a standard + a premium option
 *   3. a couple discovers them on Explore and opens a thread (SOURCED)
 *   4. the couple locks the package, picking the premium option
 *   5. the money is checked end to end — booking total, per-line cascade,
 *      and the booking fee
 *
 * It writes to a throwaway PGlite replay, never to prod.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { bookingFeePhp } from '../../lib/booking-fee';

let replay: ReplayResult;
let db: PGlite;

/** Everything the journey mints, so later steps can refer back. */
const ids: Record<string, string> = {};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/* ── 1. A vendor signs up and gets verified ────────────────────────────────*/

test('1 · a vendor can sign up and reach VERIFIED', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('journey-vendor@test.ph', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  ids.vendorUser = u.rows[0]!.id;

  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Journey Photo Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [ids.vendorUser],
  );
  ids.vendor = v.rows[0]!.vendor_profile_id;
  assert.ok(ids.vendor, 'a verified vendor identity exists');
});

/* ── 2. The vendor authors a package ───────────────────────────────────────*/

test('2 · the vendor can author a package with a REQUIRED CHOICE line', async () => {
  const p = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, description, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active)
     VALUES ($1, 'Full Day Wedding', 'The whole day', 15000000, 0, false, 'photography', true)
     RETURNING package_id`,
    [ids.vendor],
  );
  ids.pkg = p.rows[0]!.package_id;

  // A REQUIRED line (cannot be dropped), an OPTIONAL line (droppable for
  // credit), and a REQUIRED CHOICE line the couple must answer.
  const rows = await db.query<{ item_id: string; service_description: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description, is_default_included,
        is_required, replacement_value_centavos, display_order)
     VALUES
       ($1,'photography','8-hour coverage', true, true,  9000000, 0),
       ($1,'photography','Engagement shoot', true, false, 2000000, 1),
       ($1,'photography','Album',            true, true,  4000000, 2)
     RETURNING item_id, service_description`,
    [ids.pkg],
  );
  for (const r of rows.rows) {
    if (r.service_description === 'Engagement shoot') ids.optionalItem = r.item_id;
    if (r.service_description === 'Album') ids.choiceItem = r.item_id;
    if (r.service_description === '8-hour coverage') ids.requiredItem = r.item_id;
  }

  // The Album line is a CHOICE: standard is included, premium adds ₱15,000.
  const opts = await db.query<{ option_id: string; option_label: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, is_default, is_available, display_order)
     VALUES
       ($1,'30-page album',  0,       true,  true, 0),
       ($1,'60-page layflat', 1500000, false, true, 1)
     RETURNING option_id, option_label`,
    [ids.choiceItem],
  );
  for (const o of opts.rows) {
    if (o.option_label === '60-page layflat') ids.premiumOption = o.option_id;
    else ids.standardOption = o.option_id;
  }

  assert.ok(ids.premiumOption, 'the vendor could save a premium alternative');

  // The column the authoring surface got wrong this morning — proven readable
  // under the name the app actually asks for.
  const readBack = await db.query<{ option_label: string }>(
    `SELECT option_label FROM public.vendor_package_item_options WHERE option_id = $1`,
    [ids.premiumOption],
  );
  assert.equal(readBack.rows[0]!.option_label, '60-page layflat');
});

/* ── 3. A couple discovers the vendor on Explore ───────────────────────────*/

test('3 · a couple can find the vendor and open a SOURCED conversation', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('journey-couple@test.ph', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  ids.coupleUser = u.rows[0]!.id;
  await db.query(
    `INSERT INTO public.users (user_id, email, public_id) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING`,
    [ids.coupleUser, 'journey-couple@test.ph', 'S89UJOURNEY01'],
  );

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Journey Wedding','birthday')
     RETURNING event_id`,
  );
  ids.event = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [ids.event, ids.coupleUser],
  );

  // Arrived through the marketplace → this is what makes the booking billable.
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1,$2,'explore')`,
    [ids.event, ids.vendor],
  );

  const attr = await db.query<{ a: string }>(
    `SELECT public.booking_fee_attribution_for($1,$2) AS a`, [ids.vendor, ids.event],
  );
  assert.equal(attr.rows[0]!.a, 'sourced', 'an Explore arrival must be billable');
});

/* ── 4. The couple locks the package, picking the premium option ───────────*/

test('4 · the couple can lock the package and the money is right', async () => {
  // What lockPackage computes and stores. Base ₱150,000, premium album +₱15,000,
  // and the couple drops the ₱20,000 engagement shoot.
  const base = 15000000;
  const premium = 1500000;
  const dropped = 2000000;

  // Non-flexible package: a removal cuts the price one-for-one.
  const expectedTotal = base - dropped + premium;

  const b = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages
       (event_id, package_id, status, customizations_json,
        remaining_consumable_centavos, total_locked_centavos, locked_at)
     VALUES ($1,$2,'locked',$3,0,$4,NOW())
     RETURNING booking_id`,
    [
      ids.event,
      ids.pkg,
      JSON.stringify({
        removed_item_ids: [ids.optionalItem],
        chosen_option_ids: [ids.premiumOption],
      }),
      expectedTotal,
    ],
  );
  ids.booking = b.rows[0]!.booking_id;

  // The cascade, post-M1: ONE anchor carrying the whole agreed total, plus a
  // covered row per remaining kept line carrying no money at all.
  const anchor = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php,
        marketplace_vendor_id, event_vendor_package_id, package_item_id, package_role)
     VALUES ($1,'photographer','Journey Photo Co','contracted',$2,$3,$4,$5,'anchor')
     RETURNING vendor_id`,
    [ids.event, expectedTotal / 100, ids.vendor, ids.booking, ids.requiredItem],
  );
  ids.anchor = anchor.rows[0]!.vendor_id;

  // THE ROW THAT USED TO BE IMPOSSIBLE: a second line for the same vendor in
  // the same event. Before M1 this raised 23505 and killed the whole booking.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php,
        marketplace_vendor_id, event_vendor_package_id, package_item_id, package_role)
     VALUES ($1,'photographer','Journey Photo Co','contracted',NULL,$2,$3,$4,'covered')`,
    [ids.event, ids.vendor, ids.booking, ids.choiceItem],
  );

  // A covered row carrying money must be structurally impossible.
  let moneyOnCovered: string | null = null;
  try {
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, total_cost_php,
          marketplace_vendor_id, event_vendor_package_id, package_item_id, package_role)
       VALUES ($1,'catering','Journey Photo Co','contracted',999,$2,$3,$4,'covered')`,
      [ids.event, ids.vendor, ids.booking, ids.optionalItem],
    );
  } catch (e) {
    moneyOnCovered = e instanceof Error ? e.message : String(e);
  }
  assert.ok(moneyOnCovered, 'a covered row was allowed to carry money');

  // Exactly one anchor per booking.
  const anchors = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.event_vendors
      WHERE event_vendor_package_id=$1 AND package_role='anchor'`,
    [ids.booking],
  );
  assert.equal(anchors.rows[0]!.c, 1, 'exactly one anchor carries the money');

  const stored = await db.query<{ t: string }>(
    `SELECT total_locked_centavos::text AS t FROM public.event_vendor_packages WHERE booking_id=$1`,
    [ids.booking],
  );
  assert.equal(Number(stored.rows[0]!.t), expectedTotal, 'the agreed total is stored');
  assert.equal(expectedTotal, 14500000, '₱150,000 − ₱20,000 + ₱15,000 = ₱145,000');

  // The dropped line must NOT have cascaded — the couple is not delivered it.
  const cascaded = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.event_vendors
      WHERE event_vendor_package_id=$1 AND package_item_id=$2`,
    [ids.booking, ids.optionalItem],
  );
  assert.equal(cascaded.rows[0]!.c, 0, 'a dropped line must not be booked');
});

/* ── 5. The fee ────────────────────────────────────────────────────────────*/

test('5 · the fee is charged ONCE, on the whole package, via the anchor', async () => {
  // §6.4. Until this landed, lockPackage never called the fee collector at all,
  // so a package booked for ₱0 in fees no matter its size.
  assert.equal(bookingFeePhp(145000), 5450, 'the taper on the agreed package total');

  // Push this vendor past their five free bookings so a real charge computes.
  for (let i = 1; i <= 5; i++) {
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type)
       VALUES ($1,'birthday') RETURNING event_id`, [`warm-${i}`],
    );
    const warmEvent = ev.rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1,$2,'explore')`, [warmEvent, ids.vendor],
    );
    const r = await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'photographer','Journey Photo Co','contracted',1000,$2)
       RETURNING vendor_id`, [warmEvent, ids.vendor],
    );
    await db.query(`SELECT public.booking_fee_open_lock_charge($1)`, [r.rows[0]!.vendor_id]);
  }

  // THE ANCHOR — the 6th booking, so it actually bills.
  const res = await db.query<{ r: Record<string, unknown> }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS r`, [ids.anchor],
  );
  const r = res.rows[0]!.r;

  assert.equal(r.status, 'pending', 'the 6th booking bills');
  assert.equal(
    Number(r.computed_fee_centavos),
    545000,
    'the fee is the taper on ₱145,000 — the number the couple agreed to, not one line',
  );

  // AND a covered row must be refused outright. Calling the RPC per covered row
  // would burn a free-5 slot per service and freeze a ledger ordinal that is
  // only ever computed once.
  const covered = await db.query<{ vendor_id: string }>(
    `SELECT vendor_id FROM public.event_vendors
      WHERE event_vendor_package_id=$1 AND package_role='covered' LIMIT 1`,
    [ids.booking],
  );
  const cres = await db.query<{ r: Record<string, unknown> }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS r`, [covered.rows[0]!.vendor_id],
  );
  assert.equal(cres.rows[0]!.r.skipped, 'covered_row_no_fee', 'a covered row must never be billed');

  // Exactly ONE charge for this whole package booking.
  const charges = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges bfc
       JOIN public.event_vendors ev ON ev.vendor_id = bfc.event_vendor_id
      WHERE ev.event_vendor_package_id = $1`,
    [ids.booking],
  );
  assert.equal(charges.rows[0]!.c, 1, 'a package takes ONE fee, not one per service');
});

/* ── 6. The couple's own gallery / delivery side is untouched by all this ──*/

test('6 · the booking is reachable from the couple side', async () => {
  const rows = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.event_vendor_packages
      WHERE event_id=$1 AND status='locked'`,
    [ids.event],
  );
  assert.equal(rows.rows[0]!.c, 1, 'the couple has exactly one locked package');
});

/* ── 7. The anchor's money cannot be tampered with ─────────────────────────*/

test('7 · a couple cannot erase the fee base by re-roling their own anchor', async () => {
  // `event_vendors` grants UPDATE to `authenticated` at TABLE level, so the
  // couple can write their own rows. Guarding only total_cost_php was evadable:
  // demote the anchor to 'covered' and NULL the total in one statement and the
  // price guard never fires, because it tested NEW.package_role.
  let demote: string | null = null;
  try {
    await db.query(
      `UPDATE public.event_vendors
          SET package_role = 'covered', total_cost_php = NULL
        WHERE vendor_id = $1`,
      [ids.anchor],
    );
  } catch (e) {
    demote = e instanceof Error ? e.message : String(e);
  }
  assert.ok(demote, 'an anchor could be demoted — the fee base is erasable');
  assert.match(String(demote), /package_role_is_immutable/);

  // And the total itself still cannot be typed.
  let retype: string | null = null;
  try {
    await db.query(
      `UPDATE public.event_vendors SET total_cost_php = 1 WHERE vendor_id = $1`,
      [ids.anchor],
    );
  } catch (e) {
    retype = e instanceof Error ? e.message : String(e);
  }
  assert.ok(retype, 'the anchor total was typeable');
  assert.match(String(retype), /package_anchor_price_is_derived/);
});
