/**
 * vendor-og-description.test.ts — E1 (2026-09-11).
 *
 * The share card's one descriptive line must never print a fabricated fact:
 * the shop's own tagline when it has one, otherwise only the parts that are
 * actually true (category, city, Verified) — never a "0" or an empty claim,
 * the same row-3838 rule D2 enforces on the public page itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { composeVendorOgDescription } from './vendor-og-description';

test('a tagline wins over everything else', () => {
  assert.equal(
    composeVendorOgDescription({
      tagline: '  Making your day unforgettable.  ',
      services: ['live_band'],
      location_city: 'Cebu City',
      verification_state: 'verified',
    }),
    'Making your day unforgettable.',
    'the tagline must be trimmed and used as-is when present',
  );
});

test('no tagline: falls back to category · city · Verified', () => {
  const result = composeVendorOgDescription({
    tagline: null,
    services: ['live_band'],
    location_city: 'Cebu City',
    verification_state: 'verified',
  });
  assert.match(result, /Cebu City/, 'must include the city');
  assert.match(result, /Verified$/, 'Verified must be the last segment when true');
  assert.doesNotMatch(result, /\bundefined\b|\bnull\b/, 'must never print a raw undefined/null');
});

test('an unverified shop with no city still prints something true, never empty', () => {
  const result = composeVendorOgDescription({
    tagline: null,
    services: ['live_band'],
    location_city: null,
    verification_state: null,
  });
  assert.notEqual(result.trim(), '', 'must never be empty');
  assert.doesNotMatch(result, /Verified/, 'must not claim Verified when it is not true');
});

test('a shop with literally nothing true to say still prints something, not a blank line', () => {
  const result = composeVendorOgDescription({
    tagline: '   ',
    services: [],
    location_city: null,
    verification_state: null,
  });
  assert.notEqual(result.trim(), '', 'a whitespace-only tagline and no other facts must not render blank');
});

test('a whitespace-only tagline is treated as no tagline, not printed verbatim', () => {
  const result = composeVendorOgDescription({
    tagline: '   ',
    services: ['dj'],
    location_city: 'Davao City',
    verification_state: null,
  });
  assert.match(result, /Davao City/, 'must fall through to the category · city composition');
});
