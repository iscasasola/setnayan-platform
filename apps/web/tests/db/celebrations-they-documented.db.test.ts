/**
 * "NO PHOTO, NO PROOF THE EVENT TOOK PLACE" — the documented-celebrations count.
 *
 * Covers 20271159777838. Owner ruling 2026-08-24: count the EVENTS a shop has
 * photos from, because a booking anybody can create proves nothing and a
 * photograph of the day is hard to fake — and because a visible number that
 * only rises with real work is the nudge to record everything.
 *
 * What is pinned here:
 *   • the unit is the EVENT — fifty photos of one wedding are ONE celebration;
 *   • a hidden capture is not evidence on show;
 *   • self-dealing cannot pad it, same arm's-length rule as every other public
 *     number in this reader;
 *   • it is UNFLOORED on purpose — one documented celebration reads as one,
 *     because this counts the shop's OWN work (like booked_count) rather than
 *     other people's choices (like the option mix, floored twice);
 *   • it is a SHOP fact — two cards of one shop report the same number;
 *   • 🛑 and it does NOT advance `event_vendors.completion_status`. A capture is
 *     the shop's own act, and the owner's 2026-08-21 rule is that a supplier's
 *     own claim is not a release.
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
let cardA: string;
let cardB: string;

type RecordRow = { booked_count: number; documented_events: number };

async function readRecord(svc: string): Promise<RecordRow> {
  const r = await db.query<{ record: RecordRow }>(
    `SELECT record FROM public.service_card_records($1::uuid[])`,
    [[svc]],
  );
  return r.rows[0]!.record;
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, estimated_pax, ceremony_type, venue_setting)
     VALUES ($1, 'birthday', (now() - interval '30 days')::date, 80, NULL, NULL)
     RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/**
 * One capture by our shop at `eventId`.
 *
 * `consent_basis` must be one of the three the table allows; `event_consent` is
 * the ordinary one. `nsfw_checked` defaults to FALSE on the real write path and
 * is flipped only after the screen — see the unscreened test below.
 */
async function capture(
  eventId: string,
  opts: { hidden?: boolean; profile?: string; screened?: boolean } = {},
) {
  const { hidden = false, profile = vendorProfileId, screened = true } = opts;
  await db.query(
    `INSERT INTO public.vendor_papic_captures
       (vendor_profile_id, event_id, r2_object_key, media_type, captured_at,
        consent_basis, nsfw_checked, hidden_at)
     VALUES ($1, $2, 'k/' || gen_random_uuid()::text, 'photo', NOW(),
             'event_consent', $4, CASE WHEN $3 THEN NOW() END)`,
    [profile, eventId, hidden, screened],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('owner@documented.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  vendorOwnerId = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Documented Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorOwnerId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  for (const cat of ['photography', 'videography']) {
    const r = await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1, $2, 40000, 'Free extra hour') RETURNING vendor_service_id`,
      [vendorProfileId, cat],
    );
    if (cat === 'photography') cardA = r.rows[0]!.vendor_service_id;
    else cardB = r.rows[0]!.vendor_service_id;
  }
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. this one', () => {
  assert.equal(replay.applied, replay.total);
});

test('a shop with no photos has documented nothing', async () => {
  const rec = await readRecord(cardA);
  assert.equal(rec.documented_events, 0);
});

test('ONE celebration counts as one — and is NOT suppressed', async () => {
  // Unfloored on purpose: this counts the shop's own work, so "1" discloses
  // nothing about WHICH celebration, and the owner asked for a number that
  // moves from the first one.
  const e = await newEvent('doc-first');
  await capture(e);
  const rec = await readRecord(cardA);
  assert.equal(rec.documented_events, 1);
});

test('fifty photos of one wedding are ONE celebration', async () => {
  const e = await newEvent('doc-many-photos');
  for (let i = 0; i < 12; i++) await capture(e);
  const rec = await readRecord(cardA);
  // The previous test's event plus this one.
  assert.equal(rec.documented_events, 2, 'the unit is the EVENT, never the photo');
});

test('it is a SHOP fact — every card of the shop reports the same number', async () => {
  const a = await readRecord(cardA);
  const b = await readRecord(cardB);
  assert.equal(a.documented_events, b.documented_events);
  assert.ok(b.documented_events > 0, 'a card with no bookings of its own still shows the shop record');
});

test('a hidden capture is not evidence on show', async () => {
  const before = (await readRecord(cardA)).documented_events;
  const e = await newEvent('doc-hidden');
  await capture(e, { hidden: true });
  assert.equal(
    (await readRecord(cardA)).documented_events,
    before,
    'a capture the shop or an admin hid must not count',
  );
  // …and un-hiding it brings the celebration back.
  await db.query(`UPDATE public.vendor_papic_captures SET hidden_at = NULL WHERE event_id = $1`, [e]);
  assert.equal((await readRecord(cardA)).documented_events, before + 1);
});

test('self-dealing cannot pad the record', async () => {
  const before = (await readRecord(cardA)).documented_events;
  const e = await newEvent('doc-selfdeal');
  await capture(e);
  assert.equal((await readRecord(cardA)).documented_events, before + 1);

  // The shop's owner is on this event's couple roster — the same exclusion set
  // that gates the public completed-events and trusted-review numbers.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [e, vendorOwnerId],
  );
  assert.equal(
    (await readRecord(cardA)).documented_events,
    before,
    'photographing your own celebration is not documenting a client’s',
  );
});

test('another shop’s photos are not ours', async () => {
  const u2 = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('rival@documented.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const vp2 = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Rival Studio', 'Cebu', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [u2.rows[0]!.id],
  );
  const before = (await readRecord(cardA)).documented_events;
  const e = await newEvent('doc-rival');
  await capture(e, { profile: vp2.rows[0]!.vendor_profile_id });
  assert.equal((await readRecord(cardA)).documented_events, before);
});

test('an archived celebration drops out of the record', async () => {
  const before = (await readRecord(cardA)).documented_events;
  const e = await newEvent('doc-archived');
  await capture(e);
  assert.equal((await readRecord(cardA)).documented_events, before + 1);
  await db.query(`UPDATE public.events SET archived = TRUE WHERE event_id = $1`, [e]);
  assert.equal((await readRecord(cardA)).documented_events, before);
});

test('🛑 a capture does NOT advance the booking’s completion state', async () => {
  // The owner's 2026-08-21 rule: a supplier's own claim is not a release. A
  // capture is the supplier's own act, so counting it must never move the
  // machine that the booking fee, the review window and the delete handshake
  // all read.
  const e = await newEvent('doc-completion-untouched');
  const ev = await db.query<{ vendor_id: string; completion_status: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, service_id,
        marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Documented Studio', 'contracted', $2, $3, $3)
     RETURNING vendor_id, completion_status`,
    [e, cardA, vendorProfileId],
  );
  const before = ev.rows[0]!.completion_status;

  await capture(e);
  const after = await db.query<{ completion_status: string; service_marked_complete_at: string | null }>(
    `SELECT completion_status, service_marked_complete_at
     FROM public.event_vendors WHERE vendor_id = $1`,
    [ev.rows[0]!.vendor_id],
  );
  assert.equal(after.rows[0]!.completion_status, before, 'the completion state must not move');
  assert.equal(after.rows[0]!.service_marked_complete_at, null, 'and nothing marks the job done');
  // …while the celebration IS counted.
  assert.ok((await readRecord(cardA)).documented_events > 0);
});

test('an UNSCREENED capture does not count — the table\'s own surfacing rule', async () => {
  // The capture route writes nsfw_checked=FALSE and flips it only after the
  // screen; a posterless clip stays unscreened forever, by design. Counting one
  // would pad a public number with media nothing has looked at.
  const before = (await readRecord(cardA)).documented_events;
  const e = await newEvent('doc-unscreened');
  await capture(e, { screened: false });
  assert.equal((await readRecord(cardA)).documented_events, before);
  await db.query(
    `UPDATE public.vendor_papic_captures SET nsfw_checked = TRUE WHERE event_id = $1`,
    [e],
  );
  assert.equal((await readRecord(cardA)).documented_events, before + 1);
});
