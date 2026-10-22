/**
 * a-shop-venue-follows-the-shops-pin.test.ts — WHOSE PIN THE GUESTS' MAP USES (owner 2026-10-22, DECISION_LOG "A
 * MANUAL VENUE TAKES THE COUPLE'S PIN; A SHOP'S VENUE TAKES THE SHOP'S"): *"manual entry venues can set pin. venues
 * from actual suppliers cannot customize pin, only follows what the suppliers pinned."* · *"manual is the manual
 * added suppliers."*
 *
 * A PROPERTY, over every mix of: slot (ceremony · reception) × booking (a shop · a shop that was a manual supplier
 * and claimed it · a manual supplier · nothing) × the shop pinned or not × the couple's card pinned or not × the
 * event's own typed pin set or not × the card on the supplier's details or "Enter your own". Through the SAME
 * functions the guest page runs (`pickVenueBookings` → `applyVenueChoices` → `resolveEventVenues`):
 *
 *   1 · a SHOP's venue lands on the shop's pin — or on NO pin when the shop has none — whatever the couple's card or
 *       the event's typed pin say, in either mode (a claimed manual supplier: the shop's pin takes over);
 *   2 · a MANUAL venue on the supplier's details lands on the couple's card pin (the value `saveManualVenuePin`
 *       writes — the columns are held equal in 4); on "Enter your own", and with nothing booked, on the event's own
 *       typed pin (the columns Studio › Info drafts);
 *   3 · the editors' door agrees: a shop is `shop` in every mode; a manual supplier on its details is `manual`; the
 *       couple's own details over anything that is not a shop are `own`; an unpinned shop SAYS so;
 *   4 · ROUND TRIP: the card writer (`saveSelfAddedServiceCard`) writes exactly the columns the resolver's read
 *       (`loadVenueBookings`) reads the pin from, and the Studio / Details / Suppliers own-mode editors send no pin
 *       for a shop's card.
 *
 * SABOTAGE (each seen RED, then restored): `placeOf` back to the manual card first (1 fails on a claimed shop) ·
 * `shopPin` removed from `resolveEventVenues` (1 fails on "Enter your own") · `venuePinDoor` checking `own` before
 * `shop` (3 fails) · the shop skip removed from the fact sheet's own-mode write (4 fails).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyVenueChoices,
  pickVenueBookings,
  resolveEventVenues,
  type EventVenueColumns,
  type PlaceRecord,
  type VenueBookingRow,
  type VenueChoices,
  type VenueSlotKey,
} from './event-venues';
import { shopPinLine, shopUnpinnedLine, venuePinDoor } from './venue-pin-door';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

type Pin = { latitude: number; longitude: number } | null;
const SHOP: Record<VenueSlotKey, Pin> = { ceremony: { latitude: 14.6, longitude: 121.0 }, reception: { latitude: 14.65, longitude: 121.03 } };
const CARD: Record<VenueSlotKey, Pin> = { ceremony: { latitude: 10.3, longitude: 123.9 }, reception: { latitude: 10.33, longitude: 123.95 } };
const TYPED: Record<VenueSlotKey, Pin> = { ceremony: { latitude: 7.07, longitude: 125.6 }, reception: { latitude: 7.1, longitude: 125.63 } };

type Booking = 'shop' | 'claimed' | 'manual' | 'none';

function world(slot: VenueSlotKey, booking: Booking, shopPinned: boolean, cardPinned: boolean, typedPinned: boolean, own: boolean) {
  const category = slot === 'ceremony' ? 'religious_venue' : 'venue';
  const rows: VenueBookingRow[] =
    booking === 'none'
      ? []
      : [
          {
            vendor_id: 'ev-1',
            category,
            status: 'contracted',
            vendor_name: 'The Place',
            updated_at: '2026-10-01T00:00:00Z',
            archived_at: null,
            manual_vendor_id: booking === 'shop' ? null : 'm-1',
            marketplace_vendor_id: booking === 'shop' || booking === 'claimed' ? 'p-1' : null,
            linked_vendor_profile_id: null,
          },
        ];
  const manual = new Map<string, PlaceRecord>([
    ['m-1', { address: 'The couple’s typed street, Cebu City', latitude: cardPinned ? CARD[slot]!.latitude : null, longitude: cardPinned ? CARD[slot]!.longitude : null }],
  ]);
  const profile = new Map<string, PlaceRecord>([
    ['p-1', { address: shopPinned ? 'The shop’s own address' : null, latitude: shopPinned ? SHOP[slot]!.latitude : null, longitude: shopPinned ? SHOP[slot]!.longitude : null }],
  ]);
  const choices: VenueChoices = own ? { [slot]: { source: 'own' } } : {};
  const bookings = applyVenueChoices(pickVenueBookings(rows, { manual, profile }), choices, 'e-1');
  const t = typedPinned ? TYPED[slot]! : null;
  const event: EventVenueColumns =
    slot === 'ceremony'
      ? { std_film_ceremony_name: 'Typed ceremony', ceremony_venue_latitude: t?.latitude ?? null, ceremony_venue_longitude: t?.longitude ?? null }
      : { std_film_venue_name: 'Typed reception', venue_latitude: t?.latitude ?? null, venue_longitude: t?.longitude ?? null };
  const venues = resolveEventVenues(bookings, event);
  const v = venues.find((x) => x.role === slot || x.role === 'both') ?? null;
  return { bookings, venue: v };
}

const pinOf = (v: { latitude: number | null; longitude: number | null } | null): Pin =>
  v && v.latitude != null && v.longitude != null ? { latitude: v.latitude, longitude: v.longitude } : null;

const MIXES = (() => {
  const out: [VenueSlotKey, Booking, boolean, boolean, boolean, boolean][] = [];
  for (const slot of ['ceremony', 'reception'] as const)
    for (const booking of ['shop', 'claimed', 'manual', 'none'] as const)
      for (const shopPinned of [true, false])
        for (const cardPinned of [true, false])
          for (const typedPinned of [true, false])
            for (const own of [false, true]) out.push([slot, booking, shopPinned, cardPinned, typedPinned, own]);
  return out;
})();

test('1 · a shop’s venue lands on the shop’s pin — or none — whatever the couple’s card or typed pin say', () => {
  let n = 0;
  for (const [slot, booking, shopPinned, cardPinned, typedPinned, own] of MIXES) {
    if (booking !== 'shop' && booking !== 'claimed') continue;
    const { venue } = world(slot, booking, shopPinned, cardPinned, typedPinned, own);
    const what = `${slot} · ${booking} · shop ${shopPinned ? 'pinned' : 'unpinned'} · card ${cardPinned} · typed ${typedPinned} · ${own ? 'own' : 'supplier'}`;
    assert.ok(venue, `${what}: the venue vanished`);
    assert.deepEqual(pinOf(venue), shopPinned ? SHOP[slot] : null, `${what}: the guests’ map is not on the shop’s pin`);
    n++;
  }
  assert.equal(n, 64, 'the mixes did not run');
});

test('2 · a manual venue lands on the couple’s card pin; “Enter your own” and nothing booked land on the typed pin', () => {
  let n = 0;
  for (const [slot, booking, shopPinned, cardPinned, typedPinned, own] of MIXES) {
    if (booking !== 'manual' && booking !== 'none') continue;
    const { venue } = world(slot, booking, shopPinned, cardPinned, typedPinned, own);
    const what = `${slot} · ${booking} · card ${cardPinned} · typed ${typedPinned} · ${own ? 'own' : 'supplier'}`;
    const expected = booking === 'manual' && !own ? (cardPinned ? CARD[slot] : null) : typedPinned ? TYPED[slot] : null;
    assert.deepEqual(pinOf(venue), expected, `${what}: the guests’ map is not on the couple’s pin`);
    n++;
  }
  assert.equal(n, 64);
});

test('3 · the editors’ door agrees — a shop is the shop’s in every mode, and an unpinned shop says so', () => {
  for (const [slot, booking, shopPinned, cardPinned, typedPinned, own] of MIXES) {
    const { bookings } = world(slot, booking, shopPinned, cardPinned, typedPinned, own);
    const b = bookings.offered?.[slot] ?? null;
    const isOwn = !b || own;
    const door = venuePinDoor(b ? { pinFrom: b.pinFrom, vendorId: b.vendorId } : null, isOwn);
    const what = `${slot} · ${booking} · ${own ? 'own' : 'supplier'}`;
    if (booking === 'shop' || booking === 'claimed') assert.equal(door, 'shop', `${what}: the couple can set a shop’s pin`);
    else if (booking === 'manual' && !own) assert.equal(door, 'manual', `${what}: a manual supplier’s pin cannot be set`);
    else assert.equal(door, 'own', `${what}`);
  }
  assert.equal(venuePinDoor({ pinFrom: 'directory', vendorId: 'x' }, false), 'record');
  assert.equal(venuePinDoor({ pinFrom: 'manual', vendorId: null }, false), 'record', 'a card with no booking to save through is not editable');
  assert.equal(shopUnpinnedLine('Seda Vertis North'), 'Seda Vertis North hasn’t pinned their place yet');
  assert.equal(shopPinLine('Seda Vertis North', false), shopUnpinnedLine('Seda Vertis North'));
  assert.match(shopPinLine('Seda Vertis North', true), /^Pinned by Seda Vertis North/);
});

test('4 · round trip: the card writer writes the columns the guest read reads; no own-mode editor sends a shop’s pin', () => {
  const writer = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts');
  const card = writer.slice(writer.indexOf('export async function saveSelfAddedServiceCard'), writer.indexOf('export async function saveManualVenuePin'));
  assert.match(card, /update\.address_latitude = pinLat;\s*update\.address_longitude = pinLng;/, 'the card writer no longer writes the pin');
  assert.match(card, /\.from\('event_manual_vendors'\)\s*\.update\(update\)/);
  const save = writer.slice(writer.indexOf('export async function saveManualVenuePin'));
  assert.match(save, /fd\.set\('address_latitude'[\s\S]{0,80}fd\.set\('address_longitude'[\s\S]{0,400}await saveSelfAddedServiceCard\(fd\)/, 'saveManualVenuePin does not go through the card writer');
  const venues = read('lib/event-venues.ts');
  assert.match(venues, /'event_manual_vendors',\s*'manual_vendor_id',\s*'address, address_latitude, address_longitude'/, 'the guest read does not read the card’s pin');
  /* Every own-mode editor skips the pin columns for a shop's card. */
  assert.match(read('app/dashboard/[eventId]/launch/_components/details-your-event.tsx'), /if \(doorOf\(s\) === 'shop'\) continue;\s*events\[s\.columns\.lat\]/, 'Details › Venues drafts a pin over a shop');
  assert.match(read('app/dashboard/[eventId]/vendors/_components/fact-sheets.tsx'), /\.\.\.\(door === 'shop'\s*\?\s*\{\}\s*:\s*\{\s*\[s\.columns\.lat\]/, 'the place sheet drafts a pin over a shop');
  const studio = read('app/dashboard/[eventId]/launch/_components/studio-venues.tsx');
  assert.match(studio, /if \(door === 'own'\) return <StudioOwnVenue/, 'Studio › Info drafts a pin for a card that is not the couple’s');
  /* …and each editor that draws a manual supplier's pin saves it through the one door. */
  for (const f of ['app/dashboard/[eventId]/launch/_components/details-your-event.tsx', 'app/dashboard/[eventId]/launch/_components/studio-venues.tsx']) {
    assert.match(read(f), /const \{ saveManualVenuePin \} = useStudioActions\(\);[\s\S]*<ManualVenuePin[\s\S]{0,300}save=\{saveManualVenuePin\}/, `${f} saves a manual pin some other way`);
  }
  assert.match(read('app/dashboard/[eventId]/vendors/_components/fact-sheets.tsx'), /manualPin: saveManualVenuePin,/);
});
