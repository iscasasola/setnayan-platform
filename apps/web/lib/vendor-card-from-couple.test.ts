/**
 * THE SUPPLIER DOES NOT RETYPE WHAT THE COUPLE ALREADY AGREED. (2026-09-20)
 *
 * Owner: *"when a vendor gets this lock, the service card will be the one
 * registering for that portfolio. and the price as well."*
 *
 * It runs the MAPPING (`coupleCardToCanvasInitial`), not the fetch, because
 * the whole risk here is WHAT gets copied and what does not. Both halves
 * matter: a seed that carries too little leaves the supplier retyping, and a
 * seed that carries too much publishes something nobody agreed to publish.
 *
 * ⚠ THE MAPPING LIVES IN ITS OWN MODULE FOR EXACTLY THIS REASON. The fetch
 * half imports `server-only`, which cannot resolve under `node:test` — the
 * first draft of this file died on `Cannot find module 'server-only'`. Rather
 * than fall back to grepping the source, the decision was split out so it can
 * be executed. A rule nobody can run is a rule nobody checks.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { coupleCardToCanvasInitial, isEventVendorId } from './couple-card-to-canvas';

const EVENT_VENDOR_ID = '11111111-2222-4333-8444-555555555555';

/** The mapping takes a plain row — no client, no stub, no async. */
type Row = Parameters<typeof coupleCardToCanvasInitial>[0];

const FULL = {
  vendor_name: 'Seda Vertis North',
  category: 'venue',
  transport_php: 2500,
  food_allowance_php: 1200,
  crew_size: 4,
  crew_meal_covered: true,
  host_inclusions: ['Full-day use of the ballroom', '  ', 'Tables and chairs'],
  marketplace_vendor_id: null,
};

describe('what the couple agreed reaches the supplier’s blank card', () => {
  it('carries the agreed total as the starting price — the owner’s "and the price as well"', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.pricing.starting_price_php, 80000);
    assert.equal(seed.pricing.pricing_basis, 'fixed');
  });

  it('carries transport, crew meals and crew size', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.included.transport_included, true);
    assert.equal(seed.included.transport_flat_fee_php, 2500);
    assert.equal(seed.included.crew_meal_included, true);
    assert.equal(seed.crewSize, '4');
  });

  it('carries the inclusion lines, dropping blank ones, with no invented worth', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.deepEqual(seed.inclusions, [
      { label: 'Full-day use of the ballroom', worth: '' },
      { label: 'Tables and chairs', worth: '' },
    ]);
  });

  it('reads a numeric that PostgREST returned as a string', async () => {
    // transport_php is a numeric and PostgREST hands it back as a string.
    // Without the coercion it would arrive as "2500" while the field is typed
    // number — a mismatch that only surfaces once the card is saved. (The
    // PRICE no longer comes from this row at all; see the agreed-total test
    // below.)
    const seed = coupleCardToCanvasInitial({ ...FULL, transport_php: '2500' } as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.included.transport_flat_fee_php, 2500);
  });

  it('takes the price it is GIVEN — the agreed total now, never a raw column', () => {
    // The caller resolves `agreedTotalNow(headline, change lines)`. This is the
    // contract that keeps a renegotiated booking from seeding the supplier's
    // published card with the price at lock. ₱80,000 locked + ₱5,000 agreed
    // since must reach the card as ₱85,000.
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 85000);
    assert.ok(seed);
    assert.equal(seed.pricing.starting_price_php, 85000);
  });

  it('seeds no price when the caller could not resolve one', () => {
    // A failed change-line read must not fall back to the stale headline.
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', null);
    assert.ok(seed, 'the inclusions alone still justify a seed');
    assert.equal(seed.pricing.starting_price_php, null);
  });
});

describe('what it deliberately does NOT carry', () => {
  it('leaves the title blank — the couple named a SUPPLIER, not a service', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.title, '');
    // It is still carried as the provenance note, which is a different field.
    assert.equal(seed.sourceTitle, 'Seda Vertis North');
  });

  it('bundles no categories — covers are plan groups, linkedCategories are services', async () => {
    const seed = coupleCardToCanvasInitial({ ...FULL, covers_plan_groups: ['catering', 'lights_sound'] } as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.deepEqual(seed.linkedCategories, []);
  });

  it('claims no ★ options rather than reporting a failed read', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.deepEqual(seed.customization, { status: 'none_linked' });
  });

  it('copies no media — the couple’s photo of a supplier is not the supplier’s showcase', async () => {
    const seed = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.coverPhotoR2Key, null);
    assert.deepEqual(seed.showcasePhotoR2Keys, []);
  });
});

describe('it opens blank rather than announcing an empty seed', () => {
  it('returns null when the couple recorded nothing worth carrying', async () => {
    const seed = coupleCardToCanvasInitial({
        vendor_name: 'Tito Marcel',
        category: 'host_emcee',
        total_cost_php: null,
        transport_php: null,
        food_allowance_php: null,
        crew_size: null,
        crew_meal_covered: false,
        host_inclusions: [],
        marketplace_vendor_id: null,
      } as Row, EVENT_VENDOR_ID, 'host_emcee', null);
    assert.equal(seed, null);
  });

  it('a ₱0 total is nothing recorded, not a free service', async () => {
    const seed = coupleCardToCanvasInitial({ ...FULL, transport_php: 0, crew_size: null, crew_meal_covered: false, host_inclusions: [] } as Row, EVENT_VENDOR_ID, 'venue', 0);
    assert.equal(seed, null);
  });

  it('one inclusion alone is enough to be worth seeding', async () => {
    const seed = coupleCardToCanvasInitial({
        ...FULL,
        total_cost_php: null,
        transport_php: null,
        crew_size: null,
        crew_meal_covered: false,
        host_inclusions: ['Bring your own coordinator'],
      } as Row, EVENT_VENDOR_ID, 'venue', null);
    assert.ok(seed);
    assert.equal(seed.inclusions.length, 1);
  });

  it('a transport figure of ₱0 is not "transport included"', async () => {
    const seed = coupleCardToCanvasInitial({ ...FULL, transport_php: 0 } as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.ok(seed);
    assert.equal(seed.included.transport_included, false);
    assert.equal(seed.included.transport_flat_fee_php, null);
  });

  it('guards the id BEFORE any read is attempted', () => {
    // The fetch half returns early on a malformed id, so a hostile `?claim=`
    // cannot turn into a database round trip. The predicate is exported for
    // exactly this: `server-only` puts the fetch out of this runner's reach,
    // so the check it performs is asserted here instead of assumed.
    assert.equal(isEventVendorId(EVENT_VENDOR_ID), true);
    for (const bad of ['', 'not-a-uuid', '../../etc/passwd', "' or 1=1 --"]) {
      assert.equal(isEventVendorId(bad), false, bad);
    }
  });
});

describe('provenance', () => {
  it('flags a cross-category seed the way the ?from= builder does', async () => {
    const same = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'venue', 80000);
    assert.equal(same?.sourceWasOtherCategory, false);

    const cross = coupleCardToCanvasInitial(FULL as Row, EVENT_VENDOR_ID, 'catering', 80000);
    assert.equal(cross?.sourceWasOtherCategory, true);
  });
});
