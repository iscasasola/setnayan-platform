/**
 * GUARDS — the wedding onboarding's venue lists and their chain (Lane 2).
 *
 * ⚖ Owner 2026-10-01: free-on-your-dates lists, a pick narrows the dates and the
 * other list goes nearest-first with its distance in KILOMETRES — never a drive
 * time ("don't guess a number"). A listed pick is SHORTLISTED (the lock stays a
 * Your Team action); the couple's own venue is locked at once with no contact.
 *
 * Run from apps/web:  npx tsx --test lib/onboarding/venue-chain.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../security/source-text';
import {
  VENUES_FIRST_PAGE,
  chainedList,
  freeOnAny,
  freeStrip,
  narrowDates,
  nearestFirst,
  searchByName,
  withDistance,
  type VenueCandidate,
} from './venue-chain';
import {
  EMPTY_VENUES,
  VENUE_CATEGORY,
  cleanPin,
  narrowedByVenues,
  ownVenueRows,
  ownVenuesFromVenues,
  shortlistFromVenues,
  type VenueAnswers,
} from './venue-picks';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib\/onboarding$/, '');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const D = ['2026-12-18', '2026-12-19', '2026-12-26'];
const cand = (id: string, name: string, lat: number | null, lng: number | null, freeDates: string[]): VenueCandidate => ({
  vendorId: id,
  name,
  city: 'Makati',
  photoUrl: null,
  verified: true,
  lat,
  lng,
  freeDates,
});
const A = cand('a', 'San Antonio de Padua Parish', 14.5547, 121.0244, ['2026-12-18', '2026-12-19']);
const B = cand('b', 'Sta. Teresita Parish', 14.5601, 121.0301, ['2026-12-19', '2026-12-26']);
const C = cand('c', 'St. Alphonsus Parish', null, null, ['2026-12-26']);
const Z = cand('z', 'Booked Out Hall', 14.55, 121.02, []);

test('a list shows only suppliers free on at least one of the (narrowed) dates', () => {
  assert.deepEqual(chainedList({ all: [A, B, C, Z], dates: D, anchor: null }).map((r) => r.vendorId).sort(), ['a', 'b', 'c']);
  assert.equal(freeOnAny(Z, D), false);
  assert.equal(freeOnAny(Z, []), true, 'no candidate dates → nothing to filter on');
});

test('picking one narrows the dates to the ones it is free on — never to nothing', () => {
  assert.deepEqual(narrowDates(D, A), ['2026-12-18', '2026-12-19']);
  assert.deepEqual(narrowDates(D, Z), D, 'a pick that clears every date keeps the couple\'s own answer');
  assert.deepEqual(narrowDates(D, null), D);
});

test('the chain: the other venue narrows the dates AND orders the list nearest first, in km', () => {
  const dates = narrowDates(D, A); // 18 + 19
  const rows = chainedList({ all: [A, B, C, Z], dates, anchor: { lat: A.lat!, lng: A.lng! } });
  // C is free only on the 26th → out; Z free nowhere → out; A is the anchor itself (0 km) → first
  assert.deepEqual(rows.map((r) => r.vendorId), ['a', 'b']);
  assert.equal(rows[0]!.km, 0);
  assert.ok(rows[1]!.km! > 0 && rows[1]!.km! < 2, `Sta. Teresita is ~1 km away, got ${rows[1]!.km}`);
  assert.equal(Math.round(rows[1]!.km! * 10) / 10, rows[1]!.km, 'one decimal');
});

test('a supplier with no pin is never dropped and never ranked ahead of one that has a distance', () => {
  // every input order — a comparator that only handles one side of the null rule passes one order
  const perms: VenueCandidate[][] = [[A, B, C], [A, C, B], [B, A, C], [B, C, A], [C, A, B], [C, B, A]];
  for (const input of perms) {
    const rows = nearestFirst(withDistance(input, { lat: A.lat!, lng: A.lng! }));
    assert.deepEqual(rows.map((r) => r.vendorId), ['a', 'b', 'c'], input.map((x) => x.vendorId).join(''));
    assert.equal(rows[2]!.km, null);
  }
});

test('with no anchor nothing is dropped for being far, and no distance is claimed', () => {
  const rows = chainedList({ all: [A, B], dates: D, anchor: null });
  assert.equal(rows.length, 2);
  for (const r of rows) assert.equal(r.km, null);
});

test('search by name is a trimmed, case-insensitive contains', () => {
  assert.deepEqual(searchByName([A, B, C], '  teresita ').map((r) => r.vendorId), ['b']);
  assert.equal(searchByName([A, B, C], '').length, 3);
});

test('the strip says which of the couple\'s dates, one entry per date', () => {
  assert.deepEqual(freeStrip(D, A).map((s) => s.free), [true, true, false]);
});

test('the first page is a page size, not a distance rule', () => {
  assert.equal(typeof VENUES_FIRST_PAGE, 'number');
});

// ── picks → what gets written ─────────────────────────────────────────────

const listed = (c: VenueCandidate) => ({ kind: 'listed' as const, vendorId: c.vendorId, name: c.name, city: c.city, lat: c.lat, lng: c.lng, freeDates: [...c.freeDates] });

test('a LISTED pick is shortlisted under its plan group\'s own category — and nothing more', () => {
  const v: VenueAnswers = { open: true, parish: listed(A), reception: listed(B) };
  assert.deepEqual(shortlistFromVenues(v), [
    { vendorId: 'a', name: A.name, category: 'religious_venue' },
    { vendorId: 'b', name: B.name, category: 'venue' },
  ]);
  assert.equal(VENUE_CATEGORY.parish, 'religious_venue');
  assert.equal(VENUE_CATEGORY.reception, 'venue');
  assert.deepEqual(shortlistFromVenues(EMPTY_VENUES), []);
  assert.deepEqual(shortlistFromVenues({ open: true, parish: { kind: 'later' }, reception: { kind: 'supplier' } }), [], 'later / my supplier write nothing');
});

test('an OWN venue is cleaned, contact-free and locked at once; a nameless or half-pinned one is handled', () => {
  const v: VenueAnswers = {
    open: true,
    parish: { kind: 'own', name: '  Casa Verde  ', city: 'Makati', lat: 14.55, lng: 121.02 },
    reception: { kind: 'own', name: '   ', city: 'Tagaytay', lat: 1, lng: 1 },
  };
  const own = ownVenuesFromVenues(v);
  assert.equal(own.length, 1, 'a nameless venue is no venue');
  const rows = ownVenueRows(own[0]!, { eventId: 'e', userId: 'u' });
  assert.equal(rows.manual.business_name, 'Casa Verde');
  assert.ok(!('contact_person' in rows.manual) && !('contact_number' in rows.manual), 'no contact is invented');
  assert.equal(rows.manual.address, 'Makati');
  const ev = rows.vendor('m1');
  assert.equal(ev.status, 'contracted');
  assert.equal(ev.category, 'religious_venue');
  assert.equal(ev.manual_vendor_id, 'm1');
  assert.equal(cleanPin(14.5, null), null, 'both or neither');
  assert.equal(cleanPin(95, 10), null);
});

test('the commit dates are the candidates narrowed by the LISTED picks only', () => {
  const v: VenueAnswers = { open: true, parish: listed(A), reception: listed(B) };
  // A: 18 + 19 ; then B on those: 19 only
  assert.deepEqual(narrowedByVenues(D, v), ['2026-12-19']);
  assert.deepEqual(narrowedByVenues(D, { open: true, parish: { kind: 'own', name: 'X', city: '', lat: null, lng: null }, reception: { kind: 'later' } }), D);
  assert.deepEqual(narrowedByVenues(D, { open: true, parish: listed(Z), reception: null }), D);
});

// ── GUARDS ────────────────────────────────────────────────────────────────

test('🛑 NO DRIVE TIME anywhere in the venue lists — kilometres only (owner: "don\'t guess a number")', () => {
  for (const f of ['lib/onboarding/venue-chain.ts', 'lib/onboarding/venue-picks.ts', 'app/onboarding/wedding/_components/wedding-venues.tsx']) {
    const src = code(f);
    assert.ok(!/\bmins?\b|minutes?|drive[\s-]?time|driveMin|km\s*\/\s*h|averageSpeed|avgSpeed/i.test(src), `${f} states or computes a drive time`);
  }
  assert.match(code('app/onboarding/wedding/_components/wedding-venues.tsx'), /\$\{r\.km\} km/);
});

test('🔑 the commit shortlists a listed pick as "considering" and never touches a lock', () => {
  const actions = code('app/onboarding/wedding/actions.ts');
  assert.match(actions, /status: 'considering' as const,\s*source: 'host_manual' as const/);
  assert.ok(!/lock_request_state|lock_requested_at|isLockHandshakeEnabled|collectBookingFeeAtLock/.test(actions), 'onboarding must not send or take a lock');
  // …and the OWN venue goes through the one row builder (the DB test holds its shape)
  assert.match(actions, /ownVenueRows\(venue, \{ eventId: insertedEvent\.event_id, userId: user\.id \}\)/);
  assert.match(actions, /shortlistFromVenues\(payload\.venues/);
});

test('🔑 a couple who has a venue is not asked the area — but is never left without one', () => {
  const cards = code('app/onboarding/wedding/_components/wedding-cards.tsx');
  assert.match(cards, /const askArea = !\(haveVenue && state\.places\.length > 0\)/);
  const venues = code('app/onboarding/wedding/_components/wedding-venues.tsx');
  assert.match(venues, /places: \[place\], region: resolvePick\(place\)\.rk/, 'a picked venue gives the area');
  assert.match(venues, /places: \[key\], region: resolvePick\(key\)\.rk/, 'an own venue\'s city gives the area');
});

test('the venue search reads the ceremony tile for a parish and never adds a second search', () => {
  const actions = code('app/onboarding/wedding/actions.ts');
  assert.match(actions, /canonicalServicesForTile\('ceremony_venue'\)/);
  assert.equal((actions.match(/export async function searchOnboardingReceptionVenues/g) ?? []).length, 1);
});

test('the false "pre-set halal catering" promise is gone from the onboarding shell', () => {
  const shell = readFileSync(join(WEB, 'app/onboarding/wedding/_components/onboarding-shell.tsx'), 'utf8');
  assert.ok(!/halal catering/i.test(shell));
  assert.ok(!/pre-set dietary/i.test(shell));
});

test('Your Team offers "Add contact" for a venue that has none', () => {
  assert.match(code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/self-added-contact-card.tsx'), /No contact yet\. Add one/);
});

test('🧱 the venue section adds NO async chunk — the shared bundle has no room for a runtime-manifest entry', () => {
  // CI's "bundle size check" failed this PR by 0.0KB gzipped when the section was `next/dynamic`:
  // every `import()` is a chunk-map entry in the webpack runtime EVERY page downloads
  // (see pick-menu-types.ts, +14 bytes for one chunk). Static imports only.
  for (const f of ['app/onboarding/wedding/_components/wedding-venues.tsx', 'app/onboarding/wedding/_components/wedding-cards.tsx']) {
    const src = code(f);
    assert.ok(!/next\/dynamic|\bimport\(/.test(src), `${f} loads something lazily — that is a new async chunk`);
  }
  assert.match(code('app/onboarding/wedding/_components/wedding-venues.tsx'), /import \{ BranchPinMap \} from/);
});
