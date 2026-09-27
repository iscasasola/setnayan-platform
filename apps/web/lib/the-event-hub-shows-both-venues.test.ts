/**
 * the-event-hub-shows-both-venues.test.ts — A WEDDING HAS TWO VENUES.
 *
 * Measured on production 2026-09-27, event `cale-ice`: the ceremony (a parish
 * church, `religious_venue`) and the reception (a hotel, `venue`) were both
 * booked and contracted in `event_vendors`, the event row's `venue_name` and
 * `venue_address` were NULL — and the Event Hub's Venue scene drew "Add your
 * venue." because it read ONE venue off the event row.
 *
 * What this file holds, executed (not grepped) wherever it can be:
 *   1. the resolver — both bookings · only a reception · the same place twice ·
 *      a considering / archived booking never counts · the event-row fallback ·
 *      an event pin is never borrowed by a booking;
 *   2. the loader reads only name / category / status / location columns;
 *   3. the guest render shows both, labelled "Ceremony" and "Reception", with
 *      working directions;
 *   4. the gate: a viewer who has not replied (a stranger included) gets both
 *      NAMES and neither address, pin nor directions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadVenueBookings,
  pickVenueBookings,
  resolveEventVenues,
  venueNamesLine,
  type EventVenue,
  type PlaceRecord,
  type VenueBookingRow,
} from '@/lib/event-venues';
import { withheldVenue, VENUE_WITHHELD_LINE } from '@/lib/venue-disclosure';
import { hasVenueContent } from '@/lib/website-section-content';

// The components compile with the classic JSX runtime under tsx: React must be global.
(globalThis as { React?: unknown }).React = React;
const { VenueWidget } = require('../app/[slug]/_components/venue-widget') as typeof import('../app/[slug]/_components/venue-widget');
const { PublicEventDetails } = require('../app/[slug]/_components/empty-states') as typeof import('../app/[slug]/_components/empty-states');

const CHURCH = 'Santuario de San Vicente de Paul Parish & Shrine of the Poor';
const HOTEL = 'Seda Vertis North';

const row = (over: Partial<VenueBookingRow>): VenueBookingRow => ({
  category: 'venue',
  status: 'contracted',
  vendor_name: HOTEL,
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  manual_vendor_id: null,
  source_venue_directory_id: null,
  marketplace_vendor_id: null,
  linked_vendor_profile_id: null,
  ...over,
});

const ceremonyRow = row({ category: 'religious_venue', vendor_name: CHURCH, manual_vendor_id: 'mv-church' });
const receptionRow = row({ category: 'venue', vendor_name: HOTEL, manual_vendor_id: 'mv-hotel' });

const manual = new Map<string, PlaceRecord>([
  ['mv-church', { address: 'Tandang Sora Ave, Quezon City', latitude: 14.676, longitude: 121.044 }],
  ['mv-hotel', { address: 'North Ave, Vertis North, Quezon City', latitude: 14.6515, longitude: 121.0365 }],
]);

/** `cale-ice`'s event row, as measured: no name, no address, a pin. */
const CALE_ICE_ROW = {
  venue_name: null,
  venue_address: null,
  venue_latitude: 14.676,
  venue_longitude: 121.044,
  std_film_ceremony_name: null,
  std_film_venue_name: 'Seda Hotel Vertis North',
};

// ── 1 · The resolver ────────────────────────────────────────────────────────

test('both bookings → ceremony then reception, each with its own address and pin', () => {
  const v = resolveEventVenues(pickVenueBookings([receptionRow, ceremonyRow], { manual }), CALE_ICE_ROW);
  assert.deepEqual(
    v.map((x) => [x.role, x.name]),
    [
      ['ceremony', CHURCH],
      ['reception', HOTEL],
    ],
  );
  assert.equal(v[0]!.address, 'Tandang Sora Ave, Quezon City');
  assert.equal(v[1]!.latitude, 14.6515);
});

test('only a reception booked → one venue, labelled the reception', () => {
  const v = resolveEventVenues(pickVenueBookings([receptionRow], { manual }), CALE_ICE_ROW);
  assert.deepEqual(
    v.map((x) => [x.role, x.name]),
    [['reception', HOTEL]],
  );
});

test('the same place twice is ONE venue — "Ceremony & Reception"', () => {
  // Same supplier record.
  const same = resolveEventVenues(
    pickVenueBookings(
      [ceremonyRow, row({ category: 'venue', vendor_name: 'Hotel chapel wing', manual_vendor_id: 'mv-church' })],
      { manual },
    ),
    CALE_ICE_ROW,
  );
  assert.deepEqual(same.map((x) => x.role), ['both']);
  assert.equal(same[0]!.name, CHURCH);
  // Same name, different rows.
  const byName = resolveEventVenues(
    pickVenueBookings([row({ category: 'church_fees', vendor_name: 'Seda  vertis north' }), receptionRow], { manual }),
    CALE_ICE_ROW,
  );
  assert.deepEqual(byName.map((x) => x.role), ['both']);
  assert.equal(byName[0]!.address, 'North Ave, Vertis North, Quezon City', 'keeps the one that knows where it is');
});

test('a booking the couple is only CONSIDERING, or has archived, is not where the wedding is', () => {
  const rows = [
    row({ category: 'religious_venue', vendor_name: 'Some Other Church', status: 'considering' }),
    row({ category: 'venue', vendor_name: 'Old Hotel', archived_at: '2026-08-01T00:00:00Z' }),
  ];
  const v = resolveEventVenues(pickVenueBookings(rows), { venue_name: 'Garden Venue', venue_address: '1 Real St' });
  assert.deepEqual(
    v.map((x) => [x.role, x.name]),
    [['both', 'Garden Venue']],
    'neither the considered church nor the archived hotel may appear',
  );
});

test('no booking → the event row answers (and keeps the label every event had)', () => {
  const v = resolveEventVenues({ ceremony: null, reception: null }, {
    venue_name: 'Manila Hotel',
    venue_address: 'One Rizal Park',
    venue_latitude: '14.5832',
    venue_longitude: '120.9741',
  });
  assert.deepEqual(v, [
    { role: 'both', name: 'Manila Hotel', address: 'One Rizal Park', latitude: 14.5832, longitude: 120.9741 },
  ]);
  // A typed Save-the-Date ceremony + the event row → both, labelled.
  const two = resolveEventVenues({ ceremony: null, reception: null }, {
    venue_name: 'Manila Hotel',
    std_film_ceremony_name: 'Manila Cathedral',
  });
  assert.deepEqual(two.map((x) => [x.role, x.name]), [
    ['ceremony', 'Manila Cathedral'],
    ['reception', 'Manila Hotel'],
  ]);
  // Nothing anywhere → nothing, never a placeholder.
  assert.deepEqual(resolveEventVenues({ ceremony: null, reception: null }, {}), []);
});

test('⛔ an event pin is NEVER laid under a booking that has none of its own', () => {
  // `events.venue_latitude` is "first-saved-wins" — it can belong to a venue the
  // couple saved and never booked. Borrowing it routes guests somewhere real and wrong.
  const v = resolveEventVenues(pickVenueBookings([receptionRow]), CALE_ICE_ROW);
  assert.equal(v[0]!.name, HOTEL);
  assert.equal(v[0]!.latitude, null);
  assert.equal(v[0]!.longitude, null);
});

// ── 2 · The loader ──────────────────────────────────────────────────────────

function tableStub(tables: Record<string, unknown[]>, selects: string[]): SupabaseClient {
  return {
    from(table: string) {
      const b: Record<string, unknown> = {};
      for (const m of ['eq', 'is', 'in', 'order', 'limit']) b[m] = () => b;
      b.select = (cols: string) => {
        selects.push(`${table}: ${cols}`);
        return b;
      };
      b.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
      return b;
    },
  } as unknown as SupabaseClient;
}

test('the loader follows each booking to its address + pin, and reads nothing else', async () => {
  const selects: string[] = [];
  const admin = tableStub(
    {
      event_vendors: [receptionRow, ceremonyRow, row({ category: 'venue', vendor_name: 'X', status: 'considering' })],
      event_manual_vendors: [
        { manual_vendor_id: 'mv-church', address: 'Tandang Sora Ave', address_latitude: '14.676', address_longitude: '121.044' },
        { manual_vendor_id: 'mv-hotel', address: 'North Ave', address_latitude: null, address_longitude: null },
      ],
    },
    selects,
  );
  const b = await loadVenueBookings(admin, 'ev_1');
  assert.equal(b.ceremony?.name, CHURCH);
  assert.equal(b.ceremony?.latitude, 14.676, 'NUMERIC arrives as a string and is still a pin');
  assert.equal(b.reception?.name, HOTEL);
  assert.equal(b.reception?.address, 'North Ave');
  assert.equal(b.reception?.latitude, null);
  // A supplier's phone, price and notes never ride this path to a public page.
  for (const s of selects) {
    assert.doesNotMatch(s, /contact|phone|email|cost|price|notes|deposit/i, s);
  }
});

// ── 3 · The guest render ────────────────────────────────────────────────────

const render = (el: unknown) => renderToStaticMarkup(el as never);

const EVENT = {
  event_id: 'ev_1',
  slug: 'cale-ice',
  display_name: 'Cale & Ice',
  event_date: '2026-12-18',
  venue_name: null,
  venue_address: null,
  venue_latitude: 14.676,
  venue_longitude: 121.044,
  venues: resolveEventVenues(pickVenueBookings([ceremonyRow, receptionRow], { manual }), CALE_ICE_ROW),
} as unknown as Parameters<typeof VenueWidget>[0]['event'];

test('a guest who has replied sees BOTH venues, labelled, each with directions', () => {
  const html = render(React.createElement(VenueWidget, { event: EVENT }));
  assert.match(html, />Ceremony</);
  assert.match(html, />Reception</);
  assert.ok(html.includes('Santuario de San Vicente de Paul Parish &amp; Shrine of the Poor'));
  assert.ok(html.includes(HOTEL));
  assert.match(html, /The venues/);
  assert.ok(html.indexOf('>Ceremony<') < html.indexOf('>Reception<'), 'ceremony first — the order a guest goes');
  assert.ok((html.match(/google\.com\/maps/g) ?? []).length >= 2, 'a maps link for each venue');
  assert.doesNotMatch(html, /Add your venue|Venue to be confirmed/);
});

test('🔒 a guest who has NOT replied — or a stranger — gets both names and no location at all', () => {
  const closed = withheldVenue(EVENT);
  for (const v of closed.venues as EventVenue[]) {
    assert.equal(v.address, null);
    assert.equal(v.latitude, null);
    assert.equal(v.longitude, null);
  }
  assert.ok((EVENT.venues as EventVenue[])[0]!.address, 'never mutates the open row');
  const html = render(React.createElement(VenueWidget, { event: closed }));
  assert.ok(html.includes(HOTEL) && html.includes('Santuario'), 'the NAMES stay');
  assert.doesNotMatch(html, /Tandang Sora|North Ave/, 'no address');
  assert.doesNotMatch(html, /google\.com\/maps|waze|maps\.apple|openstreetmap/, 'no map, no directions');
  assert.ok(html.includes(VENUE_WITHHELD_LINE.replace(/’/g, '&#x27;')) || html.includes(VENUE_WITHHELD_LINE), 'says why');
});

test('the details card names both, and every one-line mention agrees', () => {
  const html = render(
    React.createElement(PublicEventDetails, {
      dateLabel: 'December 18, 2026',
      venueName: null,
      venueAddress: null,
      venues: withheldVenue(EVENT).venues,
    }),
  );
  assert.match(html, />Ceremony</);
  assert.match(html, />Reception</);
  assert.equal(venueNamesLine(EVENT), `${CHURCH} · ${HOTEL}`);
  assert.equal(venueNamesLine(EVENT, ' and '), `${CHURCH} and ${HOTEL}`);
});

test('two named venues are content — the Maker must not say "Add your venue."', () => {
  const closed = withheldVenue(EVENT);
  assert.equal(
    hasVenueContent({ ...closed, venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null }),
    true,
  );
  assert.equal(hasVenueContent({ venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null, venues: [] }), false);
});
