/**
 * Unit suite for the vendor past-events venue matcher/sorter
 * (lib/vendor-venue-events.ts). Invariants: normalized exact venue-name match,
 * directory-id match, and "matched-first then most-recent" ordering.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeVenue,
  matchesViewerVenue,
  orderVenueMatchedFirst,
  type ViewerVenue,
} from './vendor-venue-events';

test('normalizeVenue: case, spacing, punctuation collapse', () => {
  assert.equal(normalizeVenue('  The  Blue-Leaf   Events '), 'the blue leaf events');
  assert.equal(normalizeVenue('Blue Leaf Events'), 'blue leaf events');
  assert.equal(normalizeVenue(null), '');
  assert.equal(normalizeVenue(''), '');
});

test('matchesViewerVenue: normalized venue-name equality', () => {
  const viewer: ViewerVenue = { venueName: 'Blue Leaf Events', venueDirectoryId: null };
  assert.equal(
    matchesViewerVenue({ venueName: 'blue  leaf   events', venueDirectoryId: null }, viewer),
    true,
  );
  assert.equal(
    matchesViewerVenue({ venueName: 'Fernwood Gardens', venueDirectoryId: null }, viewer),
    false,
  );
});

test('matchesViewerVenue: directory-id match wins even when names differ', () => {
  const viewer: ViewerVenue = { venueName: 'Blue Leaf', venueDirectoryId: 'dir-1' };
  assert.equal(
    matchesViewerVenue({ venueName: 'totally different label', venueDirectoryId: 'dir-1' }, viewer),
    true,
  );
});

test('matchesViewerVenue: no viewer / empty names never match', () => {
  assert.equal(matchesViewerVenue({ venueName: 'X', venueDirectoryId: null }, null), false);
  assert.equal(
    matchesViewerVenue(
      { venueName: null, venueDirectoryId: null },
      { venueName: null, venueDirectoryId: null },
    ),
    false,
  );
  // An empty-name viewer must not match an empty-name event (no false positive).
  assert.equal(
    matchesViewerVenue(
      { venueName: '', venueDirectoryId: null },
      { venueName: '', venueDirectoryId: null },
    ),
    false,
  );
});

test('orderVenueMatchedFirst: matched first, then most-recent by completed/date', () => {
  const rows = [
    { id: 'a', atViewerVenue: false, completedAt: '2026-01-01', eventDate: null },
    { id: 'b', atViewerVenue: true, completedAt: '2025-06-01', eventDate: null },
    { id: 'c', atViewerVenue: false, completedAt: '2026-05-01', eventDate: null },
    { id: 'd', atViewerVenue: true, completedAt: '2026-03-01', eventDate: null },
  ];
  const ordered = orderVenueMatchedFirst(rows).map((r) => r.id);
  // matched (d 2026-03 before b 2025-06), then unmatched (c 2026-05 before a 2026-01)
  assert.deepEqual(ordered, ['d', 'b', 'c', 'a']);
});

test('orderVenueMatchedFirst: falls back to eventDate when completedAt is null', () => {
  const rows = [
    { id: 'x', atViewerVenue: false, completedAt: null, eventDate: '2024-01-01' },
    { id: 'y', atViewerVenue: false, completedAt: null, eventDate: '2026-01-01' },
  ];
  assert.deepEqual(orderVenueMatchedFirst(rows).map((r) => r.id), ['y', 'x']);
});
