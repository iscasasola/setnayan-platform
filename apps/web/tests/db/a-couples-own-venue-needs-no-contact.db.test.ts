/**
 * A COUPLE'S OWN VENUE NEEDS NO CONTACT — proved against a real schema.
 *
 * ⚖ Owner 2026-10-01 (wedding onboarding, "Add it yourself — name · pin ·
 * photo"): the contact is OPTIONAL for a venue the couple adds themselves.
 * `event_manual_vendors.contact_person / contact_number` were NOT NULL +
 * non-blank since 20260604080000; migration 20271259075750 relaxes them.
 *
 * ⚠ EVERY CASE ASSERTS A VALUE — "the insert did not throw" and "the contact
 * is NULL" are different claims, and a blank string must still be refused.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const EVENT = '33333333-3333-4333-8333-333333333331';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO events (event_id, slug, display_name, event_type)
     VALUES ($1, 'own-venue-fixture', 'Own Venue Fixture', 'birthday')
     ON CONFLICT DO NOTHING`,
    [EVENT],
  );
});
after(async () => {
  await db?.close();
});

test('a venue saved with a name, a pin and NO contact is stored with NULL contacts', async () => {
  const { rows } = await db.query<{ contact_person: string | null; contact_number: string | null; lat: string }>(
    `INSERT INTO event_manual_vendors (event_id, business_name, address, address_latitude, address_longitude)
     VALUES ($1, 'Casa Verde Gardens', 'Makati', 14.55, 121.02)
     RETURNING contact_person, contact_number, address_latitude::text AS lat`,
    [EVENT],
  );
  assert.equal(rows[0]!.contact_person, null);
  assert.equal(rows[0]!.contact_number, null);
  assert.equal(rows[0]!.lat, '14.55');
});

test('a contact that IS given must still be non-blank — an empty string is not a contact', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO event_manual_vendors (event_id, business_name, contact_person, contact_number)
       VALUES ($1, 'Blank Contact Hall', '   ', '0917')`,
      [EVENT],
    ),
    /event_manual_vendors_contact_person_check/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO event_manual_vendors (event_id, business_name, contact_person, contact_number)
       VALUES ($1, 'Blank Number Hall', 'Ana', '')`,
      [EVENT],
    ),
    /event_manual_vendors_contact_number_check/,
  );
});

test('a given contact is stored as given', async () => {
  const { rows } = await db.query<{ contact_person: string; contact_number: string }>(
    `INSERT INTO event_manual_vendors (event_id, business_name, contact_person, contact_number)
     VALUES ($1, 'Glasshouse', 'Ana Cruz', '0917 000 0000')
     RETURNING contact_person, contact_number`,
    [EVENT],
  );
  assert.equal(rows[0]!.contact_person, 'Ana Cruz');
  assert.equal(rows[0]!.contact_number, '0917 000 0000');
});

test('the name stays required', async () => {
  await assert.rejects(
    db.query(`INSERT INTO event_manual_vendors (event_id, business_name) VALUES ($1, '  ')`, [EVENT]),
  );
});
