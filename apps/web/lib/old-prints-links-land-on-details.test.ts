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
  // The owner's final order ("OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS"); parts 2–3 fill the empty rows.
  assert.deepEqual(DETAILS_ITEM_GROUPS.map((g) => g.group), ['look', 'event', 'words', 'story', 'hub', 'set', 'day', 'download']);
  // Theme is the FIRST item (the owner-approved prototype), and Details opens on it cold.
  assert.equal(DETAILS_ITEM_KEYS[0], 'theme');
});

test('?tool=prints is Details now; every other tool is untouched', () => {
  assert.equal(makerToolFor('prints'), 'details');
  assert.equal(makerToolFor('details'), 'details');
  assert.equal(makerToolFor('logo'), 'logo');
  assert.equal(makerToolFor(null), null);
});

test('an old address opens the same piece', () => {
  // A size pick or a bookmark to Prints & Tickets: the first print.
  assert.equal(detailsItemFor({ tool: 'prints' }), 'invitation');
  // "Preview in <theme>" was the theme — now the Theme item.
  assert.equal(detailsItemFor({ tool: 'prints', printTheme: 'vintage' }), 'theme');
  // The Menu editor's save came back to Prints & Tickets — now to the Menu.
  assert.equal(detailsItemFor({ tool: 'prints', menuFlash: true }), 'menu');
  // A named item wins, and a stranger's item is ignored.
  assert.equal(detailsItemFor({ tool: 'details', item: 'pass' }), 'pass');
  assert.equal(detailsItemFor({ tool: 'details', item: 'qr-codes' }), 'qr-codes');
  assert.equal(detailsItemFor({ tool: 'details', item: '<script>' }), 'theme');
  // Details with nothing named opens on its first item.
  assert.equal(detailsItemFor({ tool: 'details' }), 'theme');
});

test('an item address is the one Details door', () => {
  assert.equal(detailsItemHref('e-1', 'menu'), '/dashboard/e-1/launch?tool=details&item=menu');
});
