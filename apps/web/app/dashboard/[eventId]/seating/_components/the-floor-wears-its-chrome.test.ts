/**
 * the-floor-wears-its-chrome.test.ts — WHAT STANDS AROUND THE 2D FLOOR (owner 2026-11-20, "Yes, your picks"; drawing
 * § 2 · § 5 · § 9; DECISION_LOG "GUESTS › SEATS, ROUND TWO").
 *
 *   1 · THE ZOOM IS IN THE THUMB ROW — fit · − · + as one pill, in the row's order search · zoom · Show and sort, each
 *       press 44 px, the plan's own `fitView` / `zoomAround`; on Guests nothing of the zoom stands on the plan. Outside
 *       Guests the shipped stack stays.
 *   2 · SUPPLIER SPOTS ARE NUMBERED CHIPS — a booth on Guests' 2D floor is its number (its name on a tap, a 44 px press);
 *       the legend ends "Supplier spots · N", whose list is who is where; outside Guests the floor keeps its labels.
 *   3 · "TABLE ▾" AT THE ADD BOX'S RIGHT END — the ＋ menu's own list and handler: a table stays in the box, anything
 *       else closes the box and is added the way the ＋ menu adds it.
 *
 * Sabotage (each goes red): put `zoomStack` back on Guests' plan · drop the pill from `right` · put the pill after Show ·
 * call a second zoom · print the booth's label on Guests' floor · drop the legend's spots · give "Table ▾" its own list ·
 * leave the box open when an Entrance is added from it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type * as RowMod from '@/components/thumb-row';
import type * as ZoomMod from './seat-floor-zoom';
import type * as SpotsMod from './seat-floor-spots';
import type * as AddMod from './seat-floor-add';

/* The components compile to classic `React.createElement` under this runner, and a CSS module is its class names —
   set BEFORE the components are required (the same shim as lib/every-thumb-row-is-the-one-row.test.ts). */
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { ThumbRow } = require('@/components/thumb-row') as typeof RowMod;
const { SeatZoomPill } = require('./seat-floor-zoom') as typeof ZoomMod;
const { SpotChip, SupplierSpotsLegend, supplierSpots } = require('./seat-floor-spots') as typeof SpotsMod;
const { AddTableBar } = require('./seat-floor-add') as typeof AddMod;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const raw = (f: string) => readFileSync(join(HERE, f), 'utf8');
const ed = stripComments(raw('seating-editor.tsx'));
const noop = () => {};

test('1 · the zoom is a pill in the thumb row: search · zoom · Show and sort, 44 px presses, the plan’s own handlers', () => {
  const pill = renderToStaticMarkup(createElement(SeatZoomPill, { onFit: noop, onOut: noop, onIn: noop }));
  assert.match(pill, /data-seat-plan-zoom=""/);
  const words = [...pill.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(words, ['Fit the room', 'Zoom out', 'Zoom in'], 'the pill is not fit · − · +');
  assert.match(pill.slice(0, pill.indexOf('Zoom out')), /lucide-scan/, 'Fit does not wear the corner brackets');
  assert.doesNotMatch(pill, /maximize|full ?screen/i);

  // In the row: the search, then the zoom, then Show and sort — the drawing's order.
  const row = renderToStaticMarkup(
    createElement(ThumbRow, {
      name: 'guests-seats',
      field: { placeholder: 'Search guests' },
      right: [{ node: createElement(SeatZoomPill, { onFit: noop, onOut: noop, onIn: noop }) }, { menu: [{ key: 'all', label: 'Everyone' }], label: 'Show, or open the people', value: 'all', onPick: noop }],
    }),
  );
  const search = row.indexOf('placeholder="Search guests"');
  const zoom = row.indexOf('data-seat-plan-zoom');
  const show = row.indexOf('data-thumb-seat="menu"');
  assert.ok(search > 0 && zoom > search && show > zoom, 'the row is not search · zoom · Show and sort');
  // Every press is 44: the row's own seat sizes a shipped button there, and the pill sits in the middle of the row.
  const rowCss = readFileSync(join(process.cwd(), 'components', 'thumb-row.module.css'), 'utf8');
  assert.match(rowCss, /\.nodeRound :global\(\.ab\) \{ width: 44px; height: 44px; min-width: 44px;/);
  assert.match(row, /data-thumb-seat="round"[^>]*>\s*<span data-seat-plan-zoom=""/, 'the pill is not in a round seat');
  assert.match(raw('seat-floor-zoom.module.css'), /:global\(\[data-thumb-seat\]\):has\(> \.pill\) \{ margin-right: auto; \}/);

  // The editor: on Guests › Seats › 2D the pill is FIRST in `right` (before Show and sort), on the plan's own handlers.
  const right = ed.slice(ed.indexOf('right={['), ed.indexOf('guestsFilterMenu({', ed.indexOf('right={[')));
  assert.match(right, /\.\.\.\(roomOnly \? \[\{ node: <SeatZoomPill onFit=\{fitView\} onOut=\{\(\) => zoomAround\(0\.8\)\} onIn=\{\(\) => zoomAround\(1\.25\)\} \/> \}\] : \[\]\),/, 'the pill is not first in the row, or zooms its own way');
  // Nothing of the zoom stands on Guests' plan; outside Guests the shipped stack stays.
  assert.deepEqual([...ed.matchAll(/\{[^{}]*\bzoomStack\}/g)].map((m) => m[0]), ['{inGuests ? null : zoomStack}'], 'the zoom stack is drawn on Guests’ plan again');
  assert.doesNotMatch(ed.slice(ed.indexOf('const zoomStack = ('), ed.indexOf('const studioPeople =')), /inGuests|--sn-thumb-room/, 'the stack still has a place on Guests’ plan');
});

test('2 · supplier spots: numbered chips on the floor, their name on a tap, "Supplier spots · N" in the legend', () => {
  const spots = supplierSpots([
    { booth_id: 'b1', booth_type: 'band', label: 'Lights & Sound Co', event_vendor_id: 'ev1' },
    { booth_id: 'b2', booth_type: 'photo_booth', label: 'Photo Booth', event_vendor_id: null },
    { booth_id: 'b3', booth_type: 'unassigned', label: '', event_vendor_id: null },
  ]);
  assert.deepEqual(
    spots.map((s) => [s.n, s.name, s.hint]),
    [
      [1, 'Lights & Sound Co', 'Band / Stage'],
      [2, 'Photo Booth', 'No supplier here yet'],
      [3, 'New booth', 'No supplier here yet'],
    ],
    'a spot does not say who is there',
  );
  const chip = (named: boolean) => renderToStaticMarkup(createElement(SpotChip, { spot: spots[0]!, named, picked: false, onPointerDown: noop }));
  const plain = chip(false);
  assert.match(plain, /data-seat-spot="1"/);
  assert.match(plain, /class="flex h-11 min-w-11 /, 'the chip’s press is under 44 px');
  assert.doesNotMatch(plain, /data-seat-spot-name|Lights &amp; Sound Co<\/span>/, 'the chip prints its long name before a tap');
  assert.match(plain, /aria-label="Supplier spot 1 · Lights &amp; Sound Co"/, 'the chip has no name for a screen reader');
  assert.match(chip(true), /data-seat-spot-name=""[^>]*>· Lights &amp; Sound Co</, 'a tapped chip does not show its name');

  const legend = renderToStaticMarkup(createElement(SupplierSpotsLegend, { spots, onPick: noop }));
  assert.match(legend, /Supplier spots · 3/);
  assert.match(legend, /aria-haspopup="listbox"/, 'the list of who is where is not the shared dropdown');

  // The editor: on Guests' 2D the booth IS the chip (the same presses), its tap names it, and the legend ends with spots.
  const floor = ed.slice(ed.indexOf('{booths.map((b, bi) => {'), ed.indexOf('const unassigned = b.booth_type', ed.indexOf('{booths.map((b, bi) => {')));
  assert.match(floor, /if \(roomOnly\) \{/);
  assert.match(floor, /<SpotChip\s+spot=\{spot\}\s+named=\{spotNamed === b\.booth_id\}/);
  assert.match(floor, /onPointerDown=\{press === 'drag' && canEdit \? onBoothPointerDown\(b\.booth_id\) : onTapDown\('booth', b\.booth_id\)\}/, 'the chip lost the booth’s presses');
  assert.doesNotMatch(floor, /markerLabel|boothPresenceLabel/, 'Guests’ floor prints the long label again');
  assert.match(ed, /if \(roomOnly && tap\.kind === 'booth'\) nameSpot\(tap\.id\);/, 'a tap on a chip does not name it (phone)');
  assert.match(ed, /if \(d && !d\.moved && roomOnly && d\.kind === 'booth'\) nameSpot\(d\.id\);/, 'a press on a chip does not name it (computer)');
  const legendSrc = ed.slice(ed.indexOf('const seatLegend ='), ed.indexOf('const overThumb ='));
  assert.match(legendSrc, /\{floorSpots\.length > 0 \? <SupplierSpotsLegend spots=\{floorSpots\} onPick=\{setSpotNamed\} \/> : null\}/);
  assert.match(ed, /const floorSpots = supplierSpots\(booths\);/);
});

test('3 · "Table ▾" at the Add box’s right end is the ＋ menu’s own list and handler', () => {
  const options = [
    { key: 'table', label: 'New table' },
    { key: 'entrance', label: 'Entrance' },
    { key: 'service', label: 'Service door' },
    { key: 'dance', label: 'Dance floor' },
    { key: 'cocktail', label: 'Cocktail area' },
    { key: 'sign', label: 'Sign · 0/24' },
    { key: 'booth', label: 'Supplier booth' },
  ];
  const html = renderToStaticMarkup(createElement(AddTableBar, { defaultLabel: 'Table 3', busy: false, onDraft: noop, onAdd: noop, onCancel: noop, kinds: { options, onPick: noop } }));
  const name = html.indexOf('data-floor-add-name');
  const kind = html.indexOf('data-floor-add-kind');
  const cancel = html.indexOf('data-floor-add-cancel');
  assert.ok(name > 0 && kind > name && cancel > kind, '"Table ▾" is not at the box’s right end (after the name, before ✕)');
  assert.match(html.slice(kind - 400, kind + 400), /aria-label="What to add: Table"/, 'the pick does not say Table');
  assert.doesNotMatch(renderToStaticMarkup(createElement(AddTableBar, { defaultLabel: 'Table 3', busy: false, onDraft: noop, onAdd: noop, onCancel: noop })), /data-floor-add-kind/, 'a box with no list draws an empty pick');

  // The editor hands the ＋ menu's own list (`seatAddOptions`) and handler (`onSeatAdd`) — never a copy.
  const bar = ed.slice(ed.indexOf('const addBar ='), ed.indexOf('const seatTray ='));
  assert.match(bar, /options: seatAddOptions\.map\(\(o\) => \(o\.key === 'table' \? \{ \.\.\.o, label: 'New table' \} : o\)\),/);
  assert.match(bar, /if \(k === 'table'\) return;\s*setAddingTable\(false\);\s*onSeatAdd\(k\);/, 'an item picked from "Table ▾" leaves the box open, or is added another way');
  assert.ok(ed.indexOf('const seatAddOptions: PickOption[] = [') < ed.indexOf('const addBar ='), 'the list is read before it is made');
  for (const k of ['table', 'entrance', 'service', 'dance', 'cocktail', 'sign', 'booth']) {
    assert.match(ed.slice(ed.indexOf('const seatAddOptions: PickOption[] = ['), ed.indexOf('const onSeatAdd')), new RegExp(`key: '${k}'`), `"Table ▾" lacks ${k}`);
  }
});
