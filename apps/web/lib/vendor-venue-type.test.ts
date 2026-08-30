/**
 * vendor-venue-type.test.ts — `vendor_profiles.venue_type` (migration
 * 20260810000000) was read publicly by the v1 vendor profile API and by
 * Explore's leaf-match filter with NO writer a vendor could reach. Both live
 * shops were stuck on the seed default. C2 (2026-08-31) adds the writer —
 * this file pins that it exists, is reachable, and stays the ONLY one.
 *
 * Mirrors `vendor-compatibility.test.ts`, the direct precedent for this exact
 * shape (a column with a reader and no writer).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_VENDOR_VENUE_TYPES,
  VENDOR_VENUE_TYPES,
  VENDOR_VENUE_TYPE_LABEL,
  isVendorVenueType,
} from './vendor-venue-type';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('every venue type has a label', () => {
  for (const key of VENDOR_VENUE_TYPES) {
    assert.ok(VENDOR_VENUE_TYPE_LABEL[key], `${key} has no label`);
  }
});

test('isVendorVenueType rejects anything outside the vocabulary', () => {
  assert.equal(isVendorVenueType('hotel_ballroom'), true);
  assert.equal(isVendorVenueType('catholic_church'), false); // venue_directory's word, not this one
  assert.equal(isVendorVenueType(null), false);
  assert.equal(isVendorVenueType(42), false);
  assert.equal(ALLOWED_VENDOR_VENUE_TYPES.size, VENDOR_VENUE_TYPES.length);
});

// ── THE WRITER EXISTS AND IS REACHABLE ──────────────────────────────────────

test('a form in the product actually posts venue_type', () => {
  const action = read('app/vendor-dashboard/shop/venue-type-actions.ts');
  assert.ok(
    /\.update\(\{\s*venue_type\s*:/.test(action),
    'The venue-type action no longer writes venue_type. That returns the ' +
      'column to the state this file exists because of: read everywhere, ' +
      'written nowhere.',
  );
});

test('the card is mounted on a page a vendor can open', () => {
  const page = read('app/vendor-dashboard/shop/page.tsx');
  assert.ok(
    /<VenueTypeCard\s/.test(page),
    'VenueTypeCard is not rendered on My Shop. A writer nobody can reach is ' +
      'the same as no writer.',
  );
});

test('the card reads the same vocabulary the writer accepts', () => {
  const card = read('app/vendor-dashboard/shop/_components/venue-type-card.tsx');
  assert.ok(
    /VENDOR_VENUE_TYPES/.test(card) && /from '@\/lib\/vendor-venue-type'/.test(card),
    'The card stopped importing the shared vocabulary — a re-typed option ' +
      'list can drift from what the server actually accepts.',
  );
});

// ── ONLY ONE WRITER FOR THIS COLUMN ─────────────────────────────────────────

test('the general inline-profile editor does not also write venue_type', () => {
  // Through the shared lexer, not a hand-rolled regex — see lib/strip-comments.ts
  // and the tombstone in vendor-compatibility.test.ts this mirrors.
  const src = stripComments(read('app/vendor-dashboard/actions.ts'));
  assert.ok(
    !/INLINE_PROFILE_FIELDS[\s\S]{0,400}'venue_type'/.test(src) &&
      !/venue_type\s*:/.test(src),
    'A second writer for venue_type has appeared in the general inline-' +
      'profile editor (app/vendor-dashboard/actions.ts). The card at ' +
      'shop/_components/venue-type-card.tsx always renders the picker, so a ' +
      'second write path can disagree with what the vendor sees on screen. ' +
      'The single writer is shop/venue-type-actions.ts.',
  );
});
