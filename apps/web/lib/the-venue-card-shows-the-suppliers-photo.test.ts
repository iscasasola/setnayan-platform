/**
 * the-venue-card-shows-the-suppliers-photo.test.ts — A VENUE CARD'S PHOTO AND
 * DETAILS COME FROM ITS SUPPLIER, OR FROM THE COUPLE.
 *
 * Owner, 2026-09-30 (DECISION_LOG "A VENUE'S PHOTO COMES FROM ITS SUPPLIER — AND
 * THE COUPLE CAN UPLOAD ONE IF THERE IS NONE"): *"The venue will have their
 * Photos … derived from the supplier's account"* · *"same as the address"* ·
 * *"but if there is none, then we can upload it manually"* · *"so click on it.
 * use supplier details. or input your data"*.
 *
 * Held here, executed where it can be:
 *   1. the loader reads a booked supplier's PUBLIC shop photos (and nothing from
 *      a shop that is not public), and the couple's choice from the Venue
 *      scene's own config — no new table;
 *   2. default = the supplier's first photo; a chosen one; "No photo"; a chosen
 *      photo the supplier removed falls back; "Enter your own" makes the typed
 *      name and address answer, and switching back loses nothing;
 *   3. an own photo outside this event's upload folder is never shown;
 *   4. the photo survives the reply gate (a picture is not the address);
 *   5. the card draws the photo — and with no photo, no tinted band;
 *   6. the Maker: a venue card tapped opens Details › Venues in place, and its
 *      choices save through the action that panel already uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyVenueChoices,
  isOwnVenuePhotoRef,
  loadVenueBookings,
  pickVenueBookings,
  readVenueChoices,
  resolveEventVenues,
  venuePhotoPathPrefix,
  type VenueBookingRow,
} from '@/lib/event-venues';
import { withheldVenue } from '@/lib/venue-disclosure';
import { sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { detailsItemForSection, detailsItemForTap } from '@/lib/maker-details-selection';

(globalThis as { React?: unknown }).React = React;
const { VenueWidget } = require('../app/[slug]/_components/venue-widget') as typeof import('../app/[slug]/_components/venue-widget');

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const EV = 'ev_1';
const HOTEL = 'Seda Vertis North';
const P1 = 'r2://setnayan-media/vendors/vp-hotel/portfolio/lobby.jpg';
const P2 = 'r2://setnayan-media/vendors/vp-hotel/portfolio/ballroom.jpg';
const OWN = `r2://setnayan-media/${venuePhotoPathPrefix(EV)}/our-hotel.jpg`;
const STRANGER = 'r2://setnayan-media/events/ev_OTHER/scene-background/theirs.jpg';

const hotelRow: VenueBookingRow = {
  category: 'venue',
  status: 'contracted',
  vendor_name: HOTEL,
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  manual_vendor_id: null,
  source_venue_directory_id: null,
  marketplace_vendor_id: 'vp-hotel',
  linked_vendor_profile_id: null,
};
const TYPED = { std_film_venue_name: 'Our Garden', venue_address: '1 Garden Rd, Tagaytay' };

function stub(tables: Record<string, unknown[]>, selects: string[]): SupabaseClient {
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

const profile = (visibility: string) => ({
  vendor_profile_id: 'vp-hotel',
  hq_address: 'North Ave, Quezon City',
  hq_latitude: '14.65',
  hq_longitude: '121.03',
  portfolio_r2_keys: [P1, P2, 'https://not-a-ref.example/x.jpg'],
  public_visibility: visibility,
});

// ── 1 · The loader ──────────────────────────────────────────────────────────

test('the loader reads a PUBLIC shop’s photos and the Venue scene’s choice — nothing else', async () => {
  const selects: string[] = [];
  const b = await loadVenueBookings(
    stub(
      {
        event_vendors: [hotelRow],
        vendor_profiles: [profile('verified')],
        invitation_widgets: [{ config_json: { canvas: {}, venue: { reception: { supplierPhoto: P2 } } } }],
      },
      selects,
    ),
    EV,
  );
  assert.deepEqual(b.reception?.photos, [P1, P2], 'the shop page’s r2 refs, in order; a non-ref is not a photo');
  assert.equal(b.choices?.reception?.supplierPhoto, P2);
  assert.ok(selects.some((s) => /invitation_widgets: config_json/.test(s)), 'the choice comes from the Venue scene’s own config');
  for (const s of selects) assert.doesNotMatch(s, /contact|phone|email|cost|price|notes|deposit/i, s);
});

test('a shop that is not public lends no photo', async () => {
  const b = await loadVenueBookings(
    stub({ event_vendors: [hotelRow], vendor_profiles: [profile('coming_soon')] }, []),
    EV,
  );
  assert.deepEqual(b.reception?.photos ?? [], []);
  assert.equal(resolveEventVenues(b, {})[0]?.photo, undefined, 'no photo → no photo key: a clean text card');
});

// ── 2 · Which photo, whose details ──────────────────────────────────────────

const booked = () => pickVenueBookings([hotelRow], {}, new Map([['vp-hotel', [P1, P2]]]));

test('default = the supplier’s first photo; a pick; "No photo"; a removed pick falls back', () => {
  const photo = (choice: object) =>
    resolveEventVenues(applyVenueChoices(booked(), readVenueChoices({ venue: { reception: choice } }, EV), EV), {})[0]?.photo;
  assert.equal(photo({}), P1, 'zero effort looks right: the supplier’s first photo');
  assert.equal(photo({ supplierPhoto: P2 }), P2);
  assert.equal(photo({ supplierPhoto: null }), undefined, '"No photo" is honoured');
  assert.equal(photo({ supplierPhoto: 'r2://setnayan-media/vendors/vp-hotel/portfolio/deleted.jpg' }), P1);
  assert.equal(photo({ supplierPhoto: OWN }), OWN, 'the couple’s own upload may stand in for the supplier’s');
});

test('"Enter your own" — the typed name and address answer; switching back loses nothing', () => {
  const own = applyVenueChoices(booked(), readVenueChoices({ venue: { reception: { source: 'own', ownPhoto: OWN } } }, EV), EV);
  const v = resolveEventVenues(own, TYPED);
  assert.equal(v[0]?.name, 'Our Garden');
  assert.equal(v[0]?.address, '1 Garden Rd, Tagaytay');
  assert.equal(v[0]?.photo, OWN);
  assert.equal(own.offered?.reception?.name, HOTEL, 'the supplier is still offered to switch back to');
  const back = applyVenueChoices(booked(), readVenueChoices({ venue: { reception: { source: 'supplier', ownPhoto: OWN } } }, EV), EV);
  assert.equal(resolveEventVenues(back, TYPED)[0]?.name, HOTEL);
  assert.equal(back.choices?.reception?.ownPhoto, OWN, 'their upload is kept for when they switch again');
});

test('no supplier booked — the couple’s own photo shows on their typed venue', () => {
  const b = applyVenueChoices({ ceremony: null, reception: null }, readVenueChoices({ venue: { reception: { ownPhoto: OWN } } }, EV), EV);
  const v = resolveEventVenues(b, TYPED);
  assert.equal(v[0]?.role, 'both');
  assert.equal(v[0]?.photo, OWN);
});

// ── 3 · Never someone else's file ───────────────────────────────────────────

test('an own photo outside THIS event’s upload folder is never shown', () => {
  assert.equal(isOwnVenuePhotoRef(OWN, EV), true);
  assert.equal(isOwnVenuePhotoRef(STRANGER, EV), false);
  assert.equal(isOwnVenuePhotoRef(`r2://setnayan-thread-files/${venuePhotoPathPrefix(EV)}/x.jpg`, EV), false);
  assert.equal(readVenueChoices({ venue: { reception: { ownPhoto: STRANGER } } }, EV).reception, undefined);
  const b = applyVenueChoices(booked(), readVenueChoices({ venue: { reception: { supplierPhoto: STRANGER } } }, EV), EV);
  assert.equal(resolveEventVenues(b, {})[0]?.photo, P1, 'a stranger’s file is not a supplier photo either');
});

test('the upload folder is the Maker’s scene-media folder (one string, two spellings)', () => {
  assert.equal(venuePhotoPathPrefix(EV), sceneBackgroundPathPrefix(EV));
});

// ── 4 · The reply gate ──────────────────────────────────────────────────────

test('🔒 before a reply: the photo and name stay, the address and pin close', () => {
  const venues = resolveEventVenues(booked(), {}).map((v) => ({ ...v, photoUrl: 'https://cdn.example/p1.jpg' }));
  const shut = withheldVenue({ venue_address: null, venues });
  assert.equal(shut.venues?.[0]?.photoUrl, 'https://cdn.example/p1.jpg');
  assert.equal(shut.venues?.[0]?.name, HOTEL);
  assert.equal(shut.venues?.[0]?.address, null);
  assert.equal(shut.venues?.[0]?.latitude, null);
});

// ── 5 · The card ────────────────────────────────────────────────────────────

const render = (venues: object[], withheld = false) =>
  renderToStaticMarkup(
    React.createElement(VenueWidget, {
      event: { venues, venue_withheld: withheld } as unknown as Parameters<typeof VenueWidget>[0]['event'],
    }),
  );

test('the card draws the photo; with no photo and no map there is no tinted band', () => {
  const withPhoto = render([{ role: 'reception', name: HOTEL, address: null, latitude: null, longitude: null, photoUrl: 'https://cdn.example/p1.jpg' }], true);
  assert.match(withPhoto, /data-venue-photo=""[\s\S]*src="https:\/\/cdn\.example\/p1\.jpg"/);
  const bare = render([{ role: 'reception', name: HOTEL, address: null, latitude: null, longitude: null }], true);
  assert.doesNotMatch(bare, /bg-gradient/, 'an empty gradient band reads as a picture that failed to load');
  assert.doesNotMatch(bare, /<img/);
  assert.match(bare, new RegExp(HOTEL));
});

// ── 6 · The Maker ───────────────────────────────────────────────────────────

test('a venue card tapped on a stage opens Details › Venues in place', () => {
  assert.equal(detailsItemForTap('w:venue_map', null), 'venues');
  assert.equal(detailsItemForSection('w:venue_map'), 'venues');
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /factEditors = \{ \.\.\.factEditors, venues: venuesEditorFor\(eventId, yourEvent\) \}/);
  const parts = read('app/dashboard/[eventId]/launch/_components/details-your-event-parts.tsx');
  assert.match(parts, /venues: venuesEditorFor\(eventId, input\)/, 'Details and the stage draw the SAME editor');
});

test('the choice drafts into the Venue scene’s config — and Apply writes it there (owner 2026-10-04: venues wait for Apply)', () => {
  const editor = read('app/dashboard/[eventId]/launch/_components/details-your-event.tsx');
  assert.match(editor, /fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ venue_map: \{ venue: \{ \[slot\]: choice \} \} \} \}\)\);/);
  assert.match(editor, /void draftVenueChoice\(eventId, slot, next\)/);
  assert.doesNotMatch(editor, /saveAllStdContent/, 'a venue pick writes live from inside the Maker');
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /item\.field === 'venue' \? readVenueChoices\(\{ \[VENUE_CHOICES_KEY\]: item\.value \}, eventId\) : item\.value/, 'Apply re-reads the bag with THIS event');
  assert.match(editor, /'Use the supplier’s details'/);
  assert.match(editor, /'Enter your own'/);
  assert.match(editor, /<FileUpload[\s\S]{0,200}pathPrefix=\{sceneBackgroundPathPrefix\(eventId\)\}[\s\S]{0,200}compressImage/);
  assert.doesNotMatch(editor, /router\.refresh\(/, 'the Maker is never reloaded by a pick');
  const action = read('app/dashboard/[eventId]/studio/save-the-date/actions.ts');
  assert.match(action, /readVenueChoices\(\{ \[VENUE_CHOICES_KEY\]: \{ \[slot\]: data\.venueChoice\.choice \} \}, eventId\)/);
  assert.match(action, /\.from\('invitation_widgets'\)\s*\.update\(\{ config_json: \{ \.\.\.config, \[VENUE_CHOICES_KEY\]: \{ \.\.\.venue, \[slot\]: choice \} \} \}\)[\s\S]{0,80}\.select\('widget_id'\)/);
});
