/**
 * A COUPLE'S OWN VENUE, ADDED IN ONBOARDING, IS LOCKED AT ONCE — proved against
 * a real schema, with the EXACT rows the onboarding commit writes
 * (`ownVenueRows`, lib/onboarding/venue-picks.ts).
 *
 * ⚖ Owner 2026-10-01: "Add it yourself — name · pin · photo — locked at once",
 * no contact required. The Event Hub reads the confirmed booking
 * (`lib/event-venues.ts`), so a row that only LOOKS locked would leave the Venue
 * scene on "Add your venue" — every case asserts a stored value.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { ownVenueRows, ownVenuesFromVenues, type VenueAnswers } from '../../lib/onboarding/venue-picks';
import { CONFIRMED_VENDOR_STATUSES } from '../../lib/events';

let replay: ReplayResult;
let db: PGlite;
const EVENT = '44444444-4444-4444-8444-444444444441';
let userId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO events (event_id, slug, display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1, 'own-venue-lock', 'Own Venue Lock', 'wedding', 'catholic', 'banquet_hall')
     ON CONFLICT DO NOTHING`,
    [EVENT],
  );
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('couple@own-venue.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  userId = rows[0]!.id;
});
after(async () => {
  await db?.close();
});

const answers: VenueAnswers = {
  open: true,
  parish: { kind: 'own', name: ' San Antonio de Padua Parish ', city: 'Makati', lat: 14.5547, lng: 121.0244 },
  reception: { kind: 'own', name: 'Casa Verde Gardens', city: 'Tagaytay', lat: null, lng: null },
};

async function write(role: 'parish' | 'reception') {
  const venue = ownVenuesFromVenues(answers).find((v) => v.role === role)!;
  const rows = ownVenueRows(venue, { eventId: EVENT, userId });
  const m = rows.manual;
  const { rows: ins } = await db.query<{ manual_vendor_id: string }>(
    `INSERT INTO event_manual_vendors (event_id, business_name, address, address_latitude, address_longitude, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING manual_vendor_id`,
    [m.event_id, m.business_name, m.address, m.address_latitude, m.address_longitude, m.created_by_user_id],
  );
  const v = rows.vendor(ins[0]!.manual_vendor_id);
  await db.query(
    `INSERT INTO event_vendors (event_id, category, vendor_name, manual_vendor_id, status, selection_match_rank, linked_vendor_profile_id, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [v.event_id, v.category, v.vendor_name, v.manual_vendor_id, v.status, v.selection_match_rank, v.linked_vendor_profile_id, v.source],
  );
}

test('both own venues are written — locked, with no contact, and the name trimmed', async () => {
  await write('parish');
  await write('reception');
  const { rows } = await db.query<{ category: string; vendor_name: string; status: string; contact_person: string | null; pin: string | null }>(
    `SELECT ev.category, ev.vendor_name, ev.status, mv.contact_person, mv.address_latitude::text AS pin
       FROM event_vendors ev JOIN event_manual_vendors mv ON mv.manual_vendor_id = ev.manual_vendor_id
      WHERE ev.event_id = $1`,
    [EVENT],
  );
  rows.sort((a, b) => (a.category < b.category ? -1 : 1));
  assert.deepEqual(
    rows.map((r) => [r.category, r.vendor_name, r.contact_person]),
    [
      ['religious_venue', 'San Antonio de Padua Parish', null],
      ['venue', 'Casa Verde Gardens', null],
    ],
  );
  for (const r of rows) assert.ok((CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(r.status), `${r.category} is ${r.status}, not a confirmed (locked) status`);
  assert.equal(rows[0]!.pin, '14.5547');
  assert.equal(rows[1]!.pin, null, 'a venue with no pin stores no half coordinate');
});

test('a nameless own venue is no venue; a half pin is dropped', () => {
  assert.equal(ownVenuesFromVenues({ open: true, parish: { kind: 'own', name: '   ', city: 'Makati', lat: 1, lng: 1 }, reception: null }).length, 0);
  const [v] = ownVenuesFromVenues({ open: true, parish: null, reception: { kind: 'own', name: 'X', city: '', lat: 14.5, lng: null } });
  assert.equal(v!.lat, null);
  assert.equal(v!.lng, null);
});
