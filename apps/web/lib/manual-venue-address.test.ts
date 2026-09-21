/**
 * The truth table for `checkManualVenueAddress`.
 *
 * Why it exists: the modal and the two server actions each ask this question,
 * and a rule only one of them enforces is a rule the others can be walked
 * around. This file executes the rule itself — not a grep for it — so a change
 * to which categories owe an address has to come through here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADDRESS_REQUIRED_CATEGORIES,
  MANUAL_VENUE_ADDRESS_MAX,
  MANUAL_VENUE_ADDRESS_MISSING,
  MANUAL_VENUE_ADDRESS_TOO_SHORT,
  checkManualVenueAddress,
  manualVendorNeedsAddress,
} from './manual-venue-address';

const GOOD = '1 Vertis North Dr, Bagong Pag-asa, Quezon City';

/**
 * ⚠ SPELLED OUT, NOT READ FROM `ADDRESS_REQUIRED_CATEGORIES`.
 *
 * The loops below used to iterate the exported constant, which made them a
 * count of a symmetric quantity: deleting `religious_venue` from the module
 * shrank the constant AND the loop together, so a sabotage that stopped
 * demanding an address from every ceremony venue still left 12 of 13 tests
 * green. A test that reads its expectation from the thing under test cannot
 * fail. The literal below is the requirement; the deepEqual above pins the
 * export to it.
 */
const PLACES = ['venue', 'religious_venue'] as const;

describe('which categories owe an address', () => {
  it('demands one for the reception venue and the ceremony venue, and those two only', () => {
    assert.deepEqual([...ADDRESS_REQUIRED_CATEGORIES].sort(), ['religious_venue', 'venue']);
    assert.equal(manualVendorNeedsAddress('venue'), true);
    assert.equal(manualVendorNeedsAddress('religious_venue'), true);
  });

  it('does not demand one from a supplier that travels to the venue', () => {
    for (const c of ['catering', 'florist', 'photographer', 'host_emcee', 'band_dj']) {
      assert.equal(manualVendorNeedsAddress(c), false, c);
    }
  });

  it('leaves church_fees alone — it is a line item, not a second place', () => {
    assert.equal(manualVendorNeedsAddress('church_fees'), false);
  });

  it('treats a missing or non-string category as not owing one', () => {
    assert.equal(manualVendorNeedsAddress(null), false);
    assert.equal(manualVendorNeedsAddress(undefined), false);
    assert.equal(manualVendorNeedsAddress(''), false);
  });
});

describe('checkManualVenueAddress', () => {
  it('refuses an empty address on a venue, naming what is wanted', () => {
    for (const c of PLACES) {
      const r = checkManualVenueAddress(c, '');
      assert.equal(r.ok, false, c);
      assert.equal(r.ok === false && r.message, MANUAL_VENUE_ADDRESS_MISSING);
    }
  });

  it('refuses whitespace exactly as it refuses empty — a space is not an address', () => {
    const r = checkManualVenueAddress('venue', '   \n\t ');
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.message, MANUAL_VENUE_ADDRESS_MISSING);
  });

  it('refuses a bare area name on a venue', () => {
    for (const area of ['NCR', 'Quezon City', 'Manila']) {
      const r = checkManualVenueAddress('venue', area);
      assert.equal(r.ok, false, area);
      assert.equal(r.ok === false && r.message, MANUAL_VENUE_ADDRESS_TOO_SHORT);
    }
  });

  it('accepts a real Philippine address with no house number', () => {
    const r = checkManualVenueAddress(
      'religious_venue',
      'Barangay Poblacion, beside the old municipal hall, Bauan, Batangas',
    );
    assert.equal(r.ok, true);
  });

  it('trims what it stores', () => {
    const r = checkManualVenueAddress('venue', `  ${GOOD}  `);
    assert.equal(r.ok && r.value, GOOD);
  });

  it('lets a non-venue skip it — and keeps one when offered', () => {
    const skipped = checkManualVenueAddress('catering', '');
    assert.equal(skipped.ok, true);
    assert.equal(skipped.ok && skipped.value, null);

    const kept = checkManualVenueAddress('catering', GOOD);
    assert.equal(kept.ok && kept.value, GOOD);
  });

  it('does not apply the effort floor to a category that never owed one', () => {
    // A caterer volunteering "Unit 2B" is odd but not an error we should raise:
    // the floor exists to re-ask a couple about the ONE address guests need.
    const r = checkManualVenueAddress('catering', 'Unit 2B');
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value, 'Unit 2B');
  });

  it('caps the length for every category', () => {
    const tooLong = 'x'.repeat(MANUAL_VENUE_ADDRESS_MAX + 1);
    for (const c of ['venue', 'catering']) {
      const r = checkManualVenueAddress(c, tooLong);
      assert.equal(r.ok, false, c);
    }
    assert.equal(checkManualVenueAddress('venue', 'x'.repeat(MANUAL_VENUE_ADDRESS_MAX)).ok, true);
  });

  it('ignores a non-string value the way an empty one is ignored', () => {
    assert.equal(checkManualVenueAddress('catering', undefined).ok, true);
    assert.equal(checkManualVenueAddress('venue', 42).ok, false);
  });
});
