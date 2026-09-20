/**
 * THE BRIEF FROM FIRST CONTACT (test:db) — 20271235469220.
 *
 * Owner, 2026-09-20, asked whether a supplier who has not agreed yet should see
 * the couple's budget range and guest count or only their name: "they already
 * see everything from the starts." So a supplier with ANY live relationship to
 * an event (a pending inquiry thread, a shortlist row, an ask) gets the same
 * brief a booked supplier gets.
 *
 * What these tests hold:
 *   1. The door opens on an unanswered inquiry thread ALONE (no event_vendors
 *      row). Before 20271235469220 that raised not_booked.
 *   2. The door opens on a shortlist row ALONE, and the payload is the full one
 *      (the venue ADDRESS, the run-of-show, the budget band) and not a
 *      "pre-agreement" subset.
 *   3. A supplier with no relationship to the event is still refused. So is one
 *      whose only relationship was removed (an archived row, a declined thread).
 *   4. Scope is per EVENT and per SHOP. A thread on event A opens nothing on
 *      event B, and the stage label stays 'inquiry', so behaviour gated on
 *      'booked' stays gated.
 *
 * 🔑 Each positive is asserted by VALUE on an event that has every field set.
 * On an empty event a withheld field and an unset field both read as NULL.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'First Contact Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/** An event with every field the brief reads populated, and the budget band opted in. */
async function newEvent(label: string): Promise<string> {
  const coupleUid = await newUser(`couple-${label}@first-contact.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision,
        venue_name, venue_address, region, share_budget_band)
     VALUES ($1, 'birthday', '2027-08-08'::date, 'day',
             'The Hidden Hall', '7 Quiet Lane, Pasig', 'NCR', TRUE)
     RETURNING event_id`,
    [`Ana & Miguel ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, location)
     VALUES ($1, 'Ceremony', 'ceremony', '2027-08-08T15:00:00Z', 'The Hidden Hall')`,
    [eventId],
  );
  for (const status of ['attending', 'attending', 'pending']) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
       VALUES ($1, 'Private', 'Person', 'both', 'friends', $2)`,
      [eventId, status],
    );
  }
  // A saved plan with ₱100,000 on photography — the band a photographer quotes into.
  await db.query(
    `INSERT INTO public.budget_allocation_decisions (event_id, canonical_service, final_amount_php)
     VALUES ($1, 'photography', 100000)`,
    [eventId],
  );
  return eventId;
}

async function newThread(eventId: string, vpid: string, status: 'pending' | 'accepted' | 'declined'): Promise<void> {
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source, inquiry_status)
     VALUES ($1, $2, 'explore', $3::public.chat_inquiry_status)`,
    [eventId, vpid, status],
  );
}

async function newLinkRow(eventId: string, vpid: string, status = 'shortlisted'): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer'::public.vendor_category, 'First Contact Co', $2::public.vendor_status, $3)
     RETURNING vendor_id`,
    [eventId, status, vpid],
  );
  return r.rows[0]!.vendor_id;
}

async function asVendor(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

async function brief(eventId: string): Promise<Row> {
  const r = await db.query<{ b: Row }>(`SELECT public.get_vendor_event_brief($1) AS b`, [eventId]);
  return r.rows[0]!.b;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

test('a supplier with ONLY an unanswered inquiry thread gets the whole brief', async () => {
  const eventId = await newEvent('pending-thread');
  const { vpid, uid } = await newVendor('pending-thread@first-contact.test');
  await newThread(eventId, vpid, 'pending');
  // A coordinator's unreleased prep line — visible to the coordinator only.
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, visibility)
     VALUES ($1, 'Staged surprise', 'custom', '2027-08-08T18:00:00Z', 'coordinator_only')`,
    [eventId],
  );

  await asVendor(uid);
  const b = await brief(eventId);
  const ev = b.event as Row;
  const pax = b.pax as Row;

  // Still labelled pre-agreement, so behaviour gated on 'booked' stays gated.
  assert.equal(b.stage, 'inquiry');
  assert.equal(ev.display_name, 'Ana & Miguel pending-thread', 'the couple is named, not "This couple"');
  assert.equal(ev.event_date, '2027-08-08');
  assert.equal(ev.venue_name, 'The Hidden Hall');
  assert.equal(ev.venue_address, '7 Quiet Lane, Pasig');
  assert.equal(ev.region, 'NCR');
  assert.equal(pax.invited, 3);
  assert.equal(pax.attending, 2);
  assert.equal((b.timeline as unknown[]).length, 1, 'the run-of-show reaches them from first contact');
  assert.doesNotMatch(JSON.stringify(b.timeline), /Staged surprise/, 'a coordinator_only line never crosses');
  assert.equal(b.lock_request, null, 'nobody asked — the envelope key is present and NULL');
  // MUTATION (proven, see PR): drop the `inquiry_status = 'pending'` arm from
  // the thread predicate ⇒ this call raises not_booked and the test goes red.
});

test('a supplier on the couple’s shortlist gets the full brief, including the budget band', async () => {
  const eventId = await newEvent('shortlist');
  const { vpid, uid } = await newVendor('shortlist@first-contact.test');
  await newLinkRow(eventId, vpid, 'shortlisted');

  await asVendor(uid);
  const b = await brief(eventId);

  assert.equal(b.stage, 'inquiry');
  assert.deepEqual(b.booked_categories, ['photographer'], 'their own category on this event, and only theirs');
  assert.equal((b.event as Row).venue_address, '7 Quiet Lane, Pasig');
  const band = b.budget_band as Row;
  assert.ok(band, 'the couple opted in and allocated to photography — the band must reach a shortlisted photographer');
  const lo = band.lo_centavos as number;
  const hi = band.hi_centavos as number;
  assert.ok(lo < 100000 * 100 && hi > 100000 * 100, `band ${lo}..${hi} must bracket ₱100,000 strictly`);
  assert.notEqual(lo, 100000 * 100, 'the exact figure is never a band edge');
});

test('a supplier with no thread and no row on the event is still refused', async () => {
  const eventId = await newEvent('stranger');
  const { uid } = await newVendor('stranger@first-contact.test');

  await asVendor(uid);
  await assert.rejects(() => brief(eventId), /not_booked/);
});

test('a removed relationship opens nothing: an archived row, a declined thread', async () => {
  const eventId = await newEvent('removed');
  const { vpid, uid } = await newVendor('removed@first-contact.test');
  const rowId = await newLinkRow(eventId, vpid, 'considering');
  await db.query(`UPDATE public.event_vendors SET archived_at = NOW() WHERE vendor_id = $1`, [rowId]);
  await newThread(eventId, vpid, 'declined');

  await asVendor(uid);
  await assert.rejects(() => brief(eventId), /not_booked/);
});

test('a thread on one event opens nothing on another, and no other shop is exposed', async () => {
  const eventA = await newEvent('scope-a');
  const eventB = await newEvent('scope-b');
  const { vpid, uid } = await newVendor('scope@first-contact.test');
  const { vpid: rivalVpid } = await newVendor('rival@first-contact.test');
  await newThread(eventA, vpid, 'pending');
  // A rival shop is BOOKED on event A. Its name must not reach a supplier who
  // has not agreed (the roster is booked-only), and its category must not
  // appear as the caller's own.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering'::public.vendor_category, 'Rival Feast', 'contracted', $2)`,
    [eventA, rivalVpid],
  );

  await asVendor(uid);
  await assert.rejects(() => brief(eventB), /not_booked/, 'event B has no relationship to this shop');

  const b = await brief(eventA);
  assert.deepEqual(b.booked_categories, [], 'the rival’s category is not the caller’s');
  assert.ok(!('vendor_roster' in b), 'the roster names other shops — booked suppliers only');
  assert.doesNotMatch(JSON.stringify(b), /Rival Feast|Private|Person/, 'no rival shop and no guest name crosses');
});
