/**
 * YOUR PLACE (owner 2026-10-30, the approved final Suppliers design — `lib/your-place.ts`):
 *
 *  1. TOP 10 is the app's own ranked list, read from `wedding-cities.ts` (never a second copy): exactly the cities
 *     ranked 1–10, in rank order.
 *  2. A BOOKED RECEPTION LOCKS THE PLACE to its city (its pin's nearest curated city); without a pin, the stored city,
 *     then its address. No booked reception → no lock (the picker shows). A booked CEREMONY alone never locks.
 *  3. The sheet draws it that way: locked → the read-only Where + its one line, and NO picker; unlocked → the shipped
 *     CityPick opened on the Top 10. The picker reads the Top 10 from the lib (no city literal of its own).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES } from '@/app/onboarding/wedding/_data/wedding-cities';
import { TOP_PLACES_HEAD, lockedPlaceWhy, nearestCity, placeLockedByReception, topPlaces } from './your-place';
import type { PlaceSlot } from './suppliers-fact-sheets';
import { stripComments } from './strip-comments';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

const slot = (key: 'ceremony' | 'reception', booked: PlaceSlot['booked']): PlaceSlot => ({
  slot: key,
  label: key === 'reception' ? 'Reception' : 'Ceremony',
  booked,
  choice: {},
  typed: '',
  address: '',
  pin: null,
  columns: { name: 'n', address: 'a', lat: 'la', lng: 'lo' },
});
const seda = (pin: { lat: number; lng: number } | null, address: string | null = 'Tagaytay–Nasugbu Hwy') => ({
  name: 'Hacienda Isabel',
  address,
  pinned: pin != null,
  pin,
});

describe('your place', () => {
  it('Top 10 is the ranked list from wedding-cities.ts, in rank order', () => {
    const top = topPlaces();
    const ranked = CITIES.filter((c) => c.top != null && c.top <= 10);
    assert.equal(top.length, 10);
    assert.deepEqual(top.map((c) => c.top), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(new Set(top.map((c) => c.k)), new Set(ranked.map((c) => c.k)));
    assert.equal(TOP_PLACES_HEAD, 'Top 10 in the Philippines');
  });

  it('a booked reception locks the place to its city', () => {
    const tagaytay = CITIES.find((c) => c.k === 'tagaytay')!;
    const near = nearestCity({ lat: tagaytay.lat + 0.01, lng: tagaytay.lon - 0.01 });
    assert.equal(near?.k, 'tagaytay');

    const pinned = placeLockedByReception({ city: 'Makati', slots: [slot('ceremony', null), slot('reception', seda({ lat: 14.11, lng: 120.95 }))] });
    assert.deepEqual(pinned, { where: 'Tagaytay · CALABARZON', reception: 'Hacienda Isabel', pinned: true });
    assert.match(lockedPlaceWhy(pinned!), /Find measures every km from Hacienda Isabel/);

    const unpinned = placeLockedByReception({ city: 'Tagaytay', slots: [slot('reception', seda(null))] });
    assert.deepEqual(unpinned, { where: 'Tagaytay', reception: 'Hacienda Isabel', pinned: false });
    assert.doesNotMatch(lockedPlaceWhy(unpinned!), /measures/, 'no pin → never claim Find measures from it');

    const noCity = placeLockedByReception({ city: '', slots: [slot('reception', seda(null))] });
    assert.equal(noCity?.where, 'Tagaytay–Nasugbu Hwy');
  });

  it('no booked reception → no lock (a booked ceremony alone does not set the place)', () => {
    assert.equal(placeLockedByReception({ city: 'Tagaytay', slots: [slot('reception', null)] }), null);
    assert.equal(placeLockedByReception({ city: 'Tagaytay', slots: [slot('ceremony', seda({ lat: 14.1, lng: 120.9 })), slot('reception', null)] }), null);
  });

  it('the sheet draws the lock with no picker, and the picker on the Top 10 before booking', () => {
    const sheet = read('app/dashboard/[eventId]/vendors/_components/fact-sheets.tsx');
    const body = sheet.slice(sheet.indexOf('function PlaceBody('), sheet.indexOf('function VenueSlotBody('));
    assert.match(body, /const locked = placeLockedByReception\(/);
    const lockedAt = body.indexOf('data-place-locked=""');
    const pickAt = body.indexOf('<CityPick');
    assert.ok(lockedAt > 0 && pickAt > lockedAt, 'the locked place must be drawn INSTEAD of the picker');
    assert.match(body.slice(body.indexOf('{locked ? ('), pickAt), /\) : data\.city !== null \? \(/, 'the picker is not the else of the lock');
    assert.match(body.slice(pickAt, body.indexOf('/>', pickAt)), /start="top10"/, 'the place sheet’s picker does not open on the Top 10');

    const pick = read('app/dashboard/[eventId]/launch/_components/details-city-pick.tsx');
    assert.match(pick, /start === 'top10' && !me/);
    assert.match(pick, /rows = topPlaces\(\)/, 'the Top 10 must come from the lib (one list)');
    assert.doesNotMatch(pick, /'Tagaytay'|'Cebu City'|'Boracay'/, 'a city name was hard-coded in the picker');
    assert.doesNotMatch(read('lib/your-place.ts'), /n: ?'|'tagaytay'|'Tagaytay'/, 'a city literal was copied into the lib');
  });
});
