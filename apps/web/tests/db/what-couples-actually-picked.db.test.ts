/**
 * "WHAT COUPLES ACTUALLY PICKED" — END-TO-END DB verification (migrations replayed).
 *
 * Covers 20271159436100_what_couples_actually_picked. Two things ship there and
 * each is a boundary, so each is asserted against real SQL:
 *
 *   • THE LINK IS OWNERSHIP-GUARDED. `vendor_packages.vendor_service_id` is a
 *     plain FK, and a FK proves the card EXISTS, never that it is YOURS. The
 *     trigger must refuse another vendor's card on INSERT **and** on UPDATE —
 *     a guard attached to one verb is a guard around one door, which this
 *     project has already shipped once (a correct BEFORE UPDATE check that
 *     delete-then-reinsert walked straight past).
 *
 *   • THE FLOOR APPLIES TWICE. `option_mix` publishes an aggregate about other
 *     people's money, so the SAMPLE needs 3+ arm's-length locked bookings AND
 *     every LINE needs 3+ couples. Below either, the line is ABSENT — not
 *     rounded, not bucketed, not "fewer than 3", all of which disclose.
 *     Enforced in SQL so no caller can forget it: a component-level floor ships
 *     the raw number to the browser.
 *
 * Also pinned: the count is of EVENTS not rows, an un-agreed ('considering')
 * booking is not a choice anybody made, self-dealing cannot pad the numbers,
 * and the label comes from the FROZEN snapshot rather than the live option row.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let vendorProfileId: string;
let vendorOwnerId: string;
/** A SECOND shop, to prove one vendor cannot attach a package to another's card. */
let otherVendorProfileId: string;
let otherVendorCardId: string;

type RecordRow = {
  booked_count: number;
  option_sample_n: number;
  option_mix: { label: string; n: number }[];
};

async function readRecord(svc: string): Promise<RecordRow> {
  const r = await db.query<{ vendor_service_id: string; record: RecordRow }>(
    `SELECT vendor_service_id, record FROM public.service_card_records($1::uuid[])`,
    [[svc]],
  );
  return r.rows[0]!.record;
}

async function newCard(profileId = vendorProfileId): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, 'photography', 50000, 'Free extra hour') RETURNING vendor_service_id`,
    [profileId],
  );
  return r.rows[0]!.vendor_service_id;
}

/** A package, optionally linked to a card. */
async function newPackage(
  linkedCardId: string | null,
  profileId = vendorProfileId,
): Promise<string> {
  const r = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible,
        primary_canonical_service, is_active, vendor_service_id)
     VALUES ($1, 'Wedding day', 5000000, 0, FALSE, 'photography', TRUE, $2)
     RETURNING package_id`,
    [profileId, linkedCardId],
  );
  return r.rows[0]!.package_id;
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, estimated_pax, ceremony_type, venue_setting)
     VALUES ($1, 'birthday', (now() - interval '90 days')::date, 100, NULL, NULL)
     RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/**
 * A booking of `packageId`, carrying the FROZEN pricing snapshot the lock wrote.
 * `picks` are `[option_id, label]` pairs — exactly the shape #3862 persists.
 */
async function lockPackageFor(
  eventId: string,
  packageId: string,
  picks: [string, string][],
  status = 'locked',
): Promise<void> {
  const options = picks.map(([option_id, label]) => ({
    item_id: '11111111-1111-1111-1111-111111111111',
    option_id,
    label,
    delta_centavos: 0,
  }));
  await db.query(
    `INSERT INTO public.event_vendor_packages
       (event_id, package_id, status, customizations_json,
        remaining_consumable_centavos, total_locked_centavos, locked_at)
     VALUES ($1, $2, $3, $4::jsonb, 0, 100000, NOW())`,
    [
      eventId,
      packageId,
      status,
      JSON.stringify({
        pricing_snapshot: { version: 1, credit_model: false, pax_count: 100, options, extra_hours: [] },
      }),
    ],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('owner@picks.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  vendorOwnerId = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Picks Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorOwnerId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const u2 = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('rival@picks.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const vp2 = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Rival Studio', 'Cebu', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [u2.rows[0]!.id],
  );
  otherVendorProfileId = vp2.rows[0]!.vendor_profile_id;
  otherVendorCardId = await newCard(otherVendorProfileId);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. this one', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

// ───────────────────────────────────────────────────────────────────────────
// THE LINK — a FK proves the card exists, never that it is yours
// ───────────────────────────────────────────────────────────────────────────

test('a package may name a card belonging to the SAME vendor', async () => {
  const card = await newCard();
  const pkg = await newPackage(card);
  const r = await db.query<{ vendor_service_id: string | null }>(
    `SELECT vendor_service_id FROM public.vendor_packages WHERE package_id = $1`,
    [pkg],
  );
  assert.equal(r.rows[0]!.vendor_service_id, card);
});

test('a package with NO card is always allowed — most packages are standalone', async () => {
  const pkg = await newPackage(null);
  const r = await db.query<{ vendor_service_id: string | null }>(
    `SELECT vendor_service_id FROM public.vendor_packages WHERE package_id = $1`,
    [pkg],
  );
  assert.equal(r.rows[0]!.vendor_service_id, null);
});

test('INSERT naming ANOTHER vendor’s card is refused', async () => {
  await assert.rejects(
    () => newPackage(otherVendorCardId),
    /same vendor/,
    'a vendor must not attach their package to a competitor’s card',
  );
});

test('UPDATE naming ANOTHER vendor’s card is refused too — one verb is one door', async () => {
  const pkg = await newPackage(null);
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_packages SET vendor_service_id = $1 WHERE package_id = $2`, [
        otherVendorCardId,
        pkg,
      ]),
    /same vendor/,
    'the guard must fire on UPDATE, not only on INSERT',
  );
});

test('moving the PACKAGE to another vendor while it still names this card is refused', async () => {
  // The other half of the same invariant: the mismatch can be created by
  // changing either side, so the trigger watches both columns.
  const card = await newCard();
  const pkg = await newPackage(card);
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_packages SET vendor_profile_id = $1 WHERE package_id = $2`, [
        otherVendorProfileId,
        pkg,
      ]),
    /same vendor/,
  );
});

test('deleting the card does not delete the package — a couple may hold it', async () => {
  const card = await newCard();
  const pkg = await newPackage(card);
  await db.query(`DELETE FROM public.vendor_services WHERE vendor_service_id = $1`, [card]);
  const r = await db.query<{ vendor_service_id: string | null }>(
    `SELECT vendor_service_id FROM public.vendor_packages WHERE package_id = $1`,
    [pkg],
  );
  assert.equal(r.rows.length, 1, 'the package survives');
  assert.equal(r.rows[0]!.vendor_service_id, null, 'and its link is cleared, not dangling');
});

// ───────────────────────────────────────────────────────────────────────────
// THE FLOOR, TWICE
// ───────────────────────────────────────────────────────────────────────────

/** Lock `n` bookings of a fresh card's package, each picking every label given. */
async function cardWithPicks(
  perEvent: string[][],
  status = 'locked',
): Promise<string> {
  const card = await newCard();
  const pkg = await newPackage(card);
  for (let i = 0; i < perEvent.length; i++) {
    const ev = await newEvent(`picks-${card.slice(0, 8)}-${i}`);
    await lockPackageFor(
      ev,
      pkg,
      perEvent[i]!.map((label) => [`opt-${label}`, label] as [string, string]),
      status,
    );
  }
  return card;
}

test('TWO bookings is below the sample floor — nothing at all is published', async () => {
  const card = await cardWithPicks([['Second shooter'], ['Second shooter']]);
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 0, 'the denominator is withheld below the floor');
  assert.deepEqual(rec.option_mix, [], 'and so is every line');
});

test('THREE bookings all choosing one option clears both floors', async () => {
  const card = await cardWithPicks([
    ['Second shooter'],
    ['Second shooter'],
    ['Second shooter'],
  ]);
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 3);
  assert.deepEqual(rec.option_mix, [{ label: 'Second shooter', n: 3 }]);
});

test('a line chosen by fewer than 3 couples is ABSENT, not rounded and not bucketed', async () => {
  // Five couples: all five took the album, ONE took the drone. Publishing
  // "1 couple chose the drone" beside a ledger giving that event's month and
  // size is a fact about one identifiable booking.
  const card = await cardWithPicks([
    ['Album', 'Drone'],
    ['Album'],
    ['Album'],
    ['Album'],
    ['Album'],
  ]);
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 5);
  assert.deepEqual(rec.option_mix, [{ label: 'Album', n: 5 }]);
  assert.ok(
    !JSON.stringify(rec.option_mix).includes('Drone'),
    'a below-floor option must not appear in ANY form',
  );
});

test('an un-agreed booking is not a choice anybody made', async () => {
  // PR-H: a lock request sits at 'considering' until the supplier agrees.
  const card = await cardWithPicks(
    [['Album'], ['Album'], ['Album']],
    'considering',
  );
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 0);
  assert.deepEqual(rec.option_mix, []);
});

test('self-dealing cannot pad the picks', async () => {
  // The vendor's owner sits on the couple roster of one event — the same
  // arm's-length rule that gates the public completed-events number.
  const card = await newCard();
  const pkg = await newPackage(card);
  const events: string[] = [];
  for (let i = 0; i < 3; i++) {
    const ev = await newEvent(`selfdeal-${i}`);
    events.push(ev);
    await lockPackageFor(ev, pkg, [['opt-Album', 'Album']]);
  }
  let rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 3, 'three arm’s-length bookings to start');

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [events[0], vendorOwnerId],
  );
  rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 0, 'one of the three was the vendor’s own — back below the floor');
  assert.deepEqual(rec.option_mix, []);
});

test('the count is of EVENTS, and a malformed snapshot is skipped rather than trusted', async () => {
  const card = await newCard();
  const pkg = await newPackage(card);
  for (let i = 0; i < 3; i++) {
    const ev = await newEvent(`shape-${i}`);
    await lockPackageFor(ev, pkg, [['opt-Album', 'Album']]);
  }
  // A booking whose customizations_json has no snapshot at all — written by an
  // older deploy, a support script, or nothing. It counts toward the sample
  // (it IS a booking) and contributes no picks.
  const ev = await newEvent('shape-nosnapshot');
  await db.query(
    `INSERT INTO public.event_vendor_packages
       (event_id, package_id, status, customizations_json,
        remaining_consumable_centavos, total_locked_centavos, locked_at)
     VALUES ($1, $2, 'locked', '{"pricing_snapshot": {"options": "not an array"}}'::jsonb, 0, 1, NOW())`,
    [ev, pkg],
  );
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 4, 'four bookings in the sample');
  assert.deepEqual(rec.option_mix, [{ label: 'Album', n: 3 }], 'three of them chose the album');
});

test('the label comes from the FROZEN snapshot, newest lock wins', async () => {
  // A vendor renaming an option cannot rewrite the receipts, and the record
  // shows the most recent name they actually sold under.
  const card = await newCard();
  const pkg = await newPackage(card);
  const labels = ['Album (old name)', 'Album (old name)', 'Leather album'];
  for (let i = 0; i < labels.length; i++) {
    const ev = await newEvent(`label-${i}`);
    await lockPackageFor(ev, pkg, [['opt-album', labels[i]!]]);
    // Stagger locked_at so "newest" is unambiguous.
    await db.query(
      `UPDATE public.event_vendor_packages SET locked_at = NOW() + ($1 || ' seconds')::interval
       WHERE event_id = $2`,
      [String(i), ev],
    );
  }
  const rec = await readRecord(card);
  assert.deepEqual(rec.option_mix, [{ label: 'Leather album', n: 3 }]);
});

test('a card with no linked package publishes nothing, and still reads fine', async () => {
  const card = await newCard();
  const rec = await readRecord(card);
  assert.equal(rec.option_sample_n, 0);
  assert.deepEqual(rec.option_mix, []);
  assert.equal(rec.booked_count, 0);
});
