/**
 * THE PUBLIC CARD COUNTS THE BOOKING THE DELETE ALREADY PRESERVED
 *
 * Owner, 2026-08-21: "on a SHARED record, the vendor keeps it" — contracts,
 * payments, completed bookings. THE TEST IS WHETHER THE SUPPLIER TOOK PART IN IT.
 *
 * Slice 2 preserves the booking and stamps `event_type_at_delete` /
 * `event_date_at_delete` onto the row so it can still be described. Measured in
 * PRODUCTION 2026-08-27 in a rolled-back transaction, the public card did not
 * read any of it — every CTE in `service_card_records` inner-joined `events`:
 *
 *     booked_count 3 → 2 · type_mix [birthday x3] → [] · ledger 3 rows → []
 *
 * The last two emptied ENTIRELY, because falling from 3 to 2 drops the card
 * under the minimum-N floor. One stranger's deletion erased a supplier's whole
 * published track record.
 *
 * ⚖ BOTH DIRECTIONS ARE ASSERTED. The anti-self-dealing guard reads the
 * CASCADING `event_members`, so it passes VACUOUSLY for an orphan. That is safe
 * only because the preserve trigger refuses to preserve a self-dealt booking in
 * the first place — so the laundering direction is pinned here too. If somebody
 * weakens that trigger, this file goes red rather than the card going public
 * with self-dealt work.
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

type CardRecord = {
  booked_count: number;
  documented_events: number;
  type_mix: { event_type: string; n: number }[];
  ledger: { event_type: string; month_year: string; pax_band: string }[];
};

let seq = 0;
async function newUser(kind: 'vendor' | 'customer'): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [`card-preserved-${kind}-${seq}@example.com`, kind],
  );
  return r.rows[0]!.id;
}

/** A verified shop with one service card. */
async function newShop(): Promise<{ vpid: string; userId: string; sid: string }> {
  const userId = await newUser('vendor');
  // The signup trigger may already have minted the profile; reuse it if so.
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  let vpid = existing.rows[0]?.vendor_profile_id;
  if (!vpid) {
    const v = await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,'Preserved Card Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
       RETURNING vendor_profile_id`,
      [userId],
    );
    vpid = v.rows[0]!.vendor_profile_id;
  } else {
    await db.query(
      `UPDATE public.vendor_profiles
          SET verification_state='verified', last_verified_at=NOW(),
              business_name='Preserved Card Studio'
        WHERE vendor_profile_id=$1`,
      [vpid],
    );
  }
  const s = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1,'photography',40000,'Free extra hour') RETURNING vendor_service_id`,
    [vpid],
  );
  return { vpid, userId, sid: s.rows[0]!.vendor_service_id };
}

/**
 * A finished, arm's-length marketplace job with a screened capture on it.
 * `coupleUserId` lets a caller make the job SELF-DEALT by passing the shop's
 * own user — the vector the preserve trigger must refuse.
 */
async function newFinishedJob(
  shop: { vpid: string; sid: string },
  coupleUserId: string,
  monthsAgo: number,
): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, estimated_pax)
     VALUES ('Preserved Card Day','birthday',
             (now() AT TIME ZONE 'Asia/Manila')::date - ($1::int * INTERVAL '1 month'), 80)
     RETURNING event_id`,
    [monthsAgo],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status,
        linked_vendor_profile_id, marketplace_vendor_id, service_id)
     VALUES ($1,'photographer','Preserved Card Studio','complete',$2,$2,$3)`,
    [eventId, shop.vpid, shop.sid],
  );
  await db.query(
    `INSERT INTO public.vendor_papic_captures
       (vendor_profile_id, event_id, r2_object_key, media_type, nsfw_checked)
     VALUES ($1,$2,$3,'photo',TRUE)`,
    [shop.vpid, eventId, `r2://cap/${eventId}.jpg`],
  );
  return eventId;
}

async function card(sid: string): Promise<CardRecord> {
  const r = await db.query<{ record: CardRecord }>(
    `SELECT record FROM public.service_card_records(ARRAY[$1]::uuid[])`,
    [sid],
  );
  return r.rows[0]!.record;
}

test("a supplier's published record survives one couple deleting their celebration", async () => {
  const shop = await newShop();
  const events: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    events.push(await newFinishedJob(shop, await newUser('customer'), 3));
  }

  const before = await card(shop.sid);
  assert.equal(before.booked_count, 3, 'precondition: three finished jobs');
  assert.equal(before.documented_events, 3, 'precondition: three documented');
  assert.equal(before.type_mix.length, 1, 'precondition: the mix is published');
  assert.equal(before.ledger.length, 3, 'precondition: the dated ledger is published');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [events[0]]);

  const after = await card(shop.sid);

  // The row the delete preserved is still the supplier's finished job.
  assert.equal(
    after.booked_count, 3,
    'THE REGRESSION: the preserved booking dropped off the public count because ' +
    'every CTE inner-joined events and an orphan has none',
  );
  // …and because it still counts, the card stays above the minimum-N floor, so
  // neither collection is wiped. This is the half that hurt most.
  assert.equal(
    after.type_mix.length, 1,
    'THE REGRESSION: falling under the min-N floor emptied the type mix entirely',
  );
  assert.equal(after.type_mix[0]!.n, 3, 'the preserved job is still in the mix');
  assert.equal(
    after.ledger.length, 3,
    'THE REGRESSION: falling under the min-N floor emptied the whole dated ledger',
  );

  // UNCHANGED AND DELIBERATE: the capture cascades with the celebration under the
  // owner's photos-are-deleted ruling, so the evidence really is gone.
  assert.equal(
    after.documented_events, 2,
    'documented_events still falls — the photograph was deleted, and "no photo, ' +
    'no proof" is the owner\'s own rule. Changing this is HIS call, not a fix.',
  );
});

test('the preserved booking is described by the type and date stamped at deletion', async () => {
  const shop = await newShop();
  const eventId = await newFinishedJob(shop, await newUser('customer'), 3);
  await newFinishedJob(shop, await newUser('customer'), 3);
  await newFinishedJob(shop, await newUser('customer'), 3);

  const expected = await db.query<{ month_year: string }>(
    `SELECT to_char(event_date,'YYYY-MM') AS month_year FROM public.events WHERE event_id=$1`,
    [eventId],
  );
  const month = expected.rows[0]!.month_year;

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const row = await db.query<{ t: string | null; d: string | null }>(
    `SELECT event_type_at_delete::text AS t, event_date_at_delete::text AS d
       FROM public.event_vendors
      WHERE event_id IS NULL AND marketplace_vendor_id = $1`,
    [shop.vpid],
  );
  assert.equal(row.rows.length, 1, 'the booking was preserved');
  assert.equal(row.rows[0]!.t, 'birthday', 'the type was stamped at deletion');
  assert.ok(row.rows[0]!.d, 'the date was stamped at deletion');

  const after = await card(shop.sid);
  const months = after.ledger.map((l) => l.month_year);
  assert.ok(
    months.includes(month),
    'the ledger still shows the deleted celebration under its stamped month',
  );
  // An orphan has no head-count left to band, and must not invent one.
  const orphanRow = after.ledger.find((l) => l.pax_band === 'unknown');
  assert.ok(orphanRow, "the preserved job's pax band reads 'unknown', not a guess");
});

test('a SELF-DEALT booking is destroyed by the delete and never reaches the public card', async () => {
  const shop = await newShop();
  // Three arm's-length jobs so the card is above the floor and any laundering
  // would be visible in the published collections, not just the count.
  await newFinishedJob(shop, await newUser('customer'), 3);
  await newFinishedJob(shop, await newUser('customer'), 3);
  await newFinishedJob(shop, await newUser('customer'), 3);
  // …and one the shop booked for ITSELF: its own user on the couple roster.
  const selfEvent = await newFinishedJob(shop, shop.userId, 3);

  const before = await card(shop.sid);
  assert.equal(before.booked_count, 3, 'the self-dealt job never counted while live');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [selfEvent]);

  const survived = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors
      WHERE event_id IS NULL AND marketplace_vendor_id = $1`,
    [shop.vpid],
  );
  assert.equal(
    survived.rows[0]!.n, 0,
    'THE LAUNDERING DIRECTION: the preserve trigger must destroy a self-dealt ' +
    'booking while event_members still exists — the arm\'s-length guard reads ' +
    'that cascading table and passes VACUOUSLY once the row is an orphan',
  );
  const after = await card(shop.sid);
  assert.equal(after.booked_count, 3, 'the self-dealt job was not laundered into the count');
});
