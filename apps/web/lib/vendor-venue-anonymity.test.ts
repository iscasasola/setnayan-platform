/**
 * VENUE NAME-ANONYMITY EXEMPTION — vocabulary guard.
 *
 * `vendor_profiles.services` mixes TWO vocabularies (see `isVendorVenueExempt`):
 * coarse `vendor_category` enum values written by the profile picker + the
 * venue-directory seed, and canonical service keys written by the taxonomy
 * Coverage picker (`syncProfileFromCoverages`). The exemption list originally
 * named only the two coarse values, so when the ceremony/reception tiles were
 * seeded with 23 real canonicals (PR #3477) NONE of them were exempt: a parish
 * that declared itself through the Coverage picker — the only path a self-serve
 * vendor has — was anonymized as a screen name.
 *
 * These tests lock both vocabularies AND the derivation, so a venue leaf added
 * later is exempt the day it is seeded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isVendorVenueExempt, isVendorNameRevealed, resolveVendorDisplayName } from './vendors';
import { TAXONOMY_MAP } from './taxonomy';

test('coarse vendor_category values stay exempt (venue-directory seed rows)', () => {
  // ARRAY['religious_venue','venue'] — exactly what 20260529000000 writes.
  assert.equal(isVendorVenueExempt(['religious_venue', 'venue']), true);
  assert.equal(isVendorVenueExempt(['venue']), true);
  assert.equal(isVendorVenueExempt(['religious_venue']), true);
});

test('canonical venue leaves are exempt — the PR #3477 regression', () => {
  for (const canonical of [
    'ceremony_venue_booking',
    'catholic_church_venue',
    'mosque_venue',
    'civil_ceremony_venue',
    'chinese_temple_venue',
    'reception_venue',
    'function_hall',
    'hotel_ballroom',
    'accommodation',
  ]) {
    assert.equal(
      isVendorVenueExempt([canonical]),
      true,
      `${canonical} sits on a venue tile and must be name-exempt`,
    );
  }
});

test('EVERY canonical on the two venue tiles is exempt (derived, not listed)', () => {
  const venueTiles = new Set(['ceremony_venue', 'reception']);
  const onVenueTiles = Object.entries(TAXONOMY_MAP)
    .filter(([, meta]) =>
      [meta.tile, ...(meta.secondary_tiles ?? [])].some((t) => t != null && venueTiles.has(t)),
    )
    .map(([canonical]) => canonical);

  assert.ok(onVenueTiles.length >= 24, 'expected the seeded venue leaves to be present');
  const notExempt = onVenueTiles.filter((c) => !isVendorVenueExempt([c]));
  assert.deepEqual(
    notExempt,
    [],
    'a venue-tile canonical lost the exemption — add it to the tile, not to a hand list',
  );
});

test('non-venue vendors are NOT exempt — the exemption must not leak', () => {
  for (const canonical of [
    'photography',
    'catering',
    'bridal_gown_custom',
    'wedding_coordination',
    'catholic_priest', // the officiant, not the room
  ]) {
    assert.equal(isVendorVenueExempt([canonical]), false, `${canonical} must stay anonymized`);
  }
  assert.equal(isVendorVenueExempt([]), false);
  assert.equal(isVendorVenueExempt(null), false);
  assert.equal(isVendorVenueExempt(undefined), false);
});

test('exemption reveals the real name end-to-end for an unrevealed free vendor', () => {
  const base = {
    business_name: 'Manila Cathedral',
    name_revealed_at: null,
    isPaidTier: false,
    primary_canonical_service: 'catholic_church_venue',
    location_city: 'Manila',
    screen_name: 'Manila Ceremony Venue #12',
  };

  assert.equal(isVendorNameRevealed({ ...base, services: ['catholic_church_venue'] }), true);
  assert.equal(
    resolveVendorDisplayName({ ...base, services: ['catholic_church_venue'] }),
    'Manila Cathedral',
  );

  // Same vendor, a NON-venue service → still anonymized (screen_name wins).
  assert.equal(
    resolveVendorDisplayName({ ...base, services: ['photography'] }),
    'Manila Ceremony Venue #12',
  );
});
