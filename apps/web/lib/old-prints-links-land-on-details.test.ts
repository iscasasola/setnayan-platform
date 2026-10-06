/**
 * old-prints-links-land-on-details.test.ts — owner 2026-09-28, verbatim:
 * *"1 fold prints and tickets into details"* (DECISION_LOG "PRINTS & TICKETS
 * FOLDS INTO DETAILS": old links to Prints & Tickets land on Details at the
 * same piece; nothing it does today is lost).
 *
 * Held here: every piece Prints & Tickets drew is an item of Details, and every
 * old address resolves to the right one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DETAILS_ITEM_GROUPS,
  DETAILS_ITEM_KEYS,
  detailsItemFor,
  detailsItemHref,
  isDetailsItemKey,
  makerToolFor,
} from './maker-details-items';
import { PRINT_SET_KEYS } from './print-pieces';
import { freePrints } from './free-prints';

test('every piece Prints & Tickets drew is an item of Details — none lost', () => {
  for (const k of PRINT_SET_KEYS) assert.ok(isDetailsItemKey(k), `${k} left the fold`);
  // The free group, with and without an address (the event QR needs one).
  for (const slug of ['ana-ben', null]) {
    for (const fp of freePrints('e-1', slug)) assert.ok(isDetailsItemKey(fp.key), `${fp.key} left the fold`);
  }
  assert.equal(new Set(DETAILS_ITEM_KEYS).size, DETAILS_ITEM_KEYS.length, 'one key names two items');
  // The owner's order (2026-10-06, "EVENT DETAILS IS REBUILT"): Look · Story &
  // plans · Your event (one form) · the prints at the bottom, unchanged. The
  // hidden group keeps the items that left the list addressable.
  assert.deepEqual(DETAILS_ITEM_GROUPS.map((g) => g.group), ['look', 'story', 'event', 'elsewhere', 'set', 'day', 'download']);
  // Background is the FIRST item (the Look's first row), and Details opens on it cold.
  assert.equal(DETAILS_ITEM_KEYS[0], 'background');
});

test('?tool=prints is Details now; a tool that did not move is untouched', () => {
  assert.equal(makerToolFor('prints'), 'details');
  assert.equal(makerToolFor('details'), 'details');
  // Logo moved into Details (part 3, "OPTION B") — `the-look-moves-into-details.test.ts` holds the rest.
  assert.equal(makerToolFor('logo'), 'details');
  assert.equal(makerToolFor('post-event'), 'post-event');
  assert.equal(makerToolFor(null), null);
});

test('an old address opens the same piece', () => {
  // A size pick or a bookmark to Prints & Tickets: the first print.
  assert.equal(detailsItemFor({ tool: 'prints' }), 'invitation');
  // "Preview in <theme>" was the theme — no theme is picked since 2026-10-05; it opens the Look's Background.
  assert.equal(detailsItemFor({ tool: 'prints', printTheme: 'vintage' }), 'background');
  // The Menu editor's save came back to Prints & Tickets — now to the Menu.
  assert.equal(detailsItemFor({ tool: 'prints', menuFlash: true }), 'menu');
  // A named item wins, and a stranger's item is ignored.
  assert.equal(detailsItemFor({ tool: 'details', item: 'pass' }), 'pass');
  assert.equal(detailsItemFor({ tool: 'details', item: 'qr-codes' }), 'qr-codes');
  assert.equal(detailsItemFor({ tool: 'details', item: '<script>' }), 'background');
  // Details with nothing named opens on its first item.
  assert.equal(detailsItemFor({ tool: 'details' }), 'background');
  // An old address to the whole Look still opens it (the guided Look step's item).
  assert.equal(detailsItemFor({ tool: 'details', item: 'theme' }), 'theme');
});

test('an item address is the one Details door', () => {
  assert.equal(detailsItemHref('e-1', 'menu'), '/dashboard/e-1/launch?tool=details&item=menu');
});
