/**
 * 🗺 SEATS 2D IS THE ROOM, LIST IS THE PEOPLE (owner 2026-11-01, DECISION_LOG — supersedes the same-day "2D does the
 * same"). Owner, on 2D where tapping Table 5 opened a full sheet over the map: *"this makes it impossible for me to move
 * the table."*
 *
 * The PROPERTIES (Guests › Seats, the 2D plan — `roomOnly`):
 *   1. A picked table opens NO sheet and NO dock: its verbs are ONE slim bar in the thumb row — Rotate · Shape ▾ ·
 *      Seats − N + · ⋯ (Name… · Swap with another table… · Link… / Unlink · Delete).
 *   2. No guest list: the guests column is not drawn (and an empty column takes no room); the filter's "People" door is
 *      gone; a table pick does not raise the people sheet.
 *   3. No guest editing: a name or an empty seat does nothing (the press goes on to the room, which pans).
 *   5. The PICKED table drags — on a phone too (the owner could not move a table); everything else keeps planPress.
 *   4. A booth a booked supplier runs opens the supplier card (the 3D walk's `BoothVendorCard`), mapped by the one
 *      `boothCardFromRow` (public business identity only).
 *
 * SABOTAGE (each seen RED, then restored): the table dock back in 2D · the guests portal back on in 2D.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { boothCardFromRow, boothHasSupplier } from '@/lib/booth-card-from-row';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ED = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));

test('0 · 2D in Guests is the room', () => {
  assert.match(ED, /const roomOnly = inGuests && !in3d && view === 'plan';/);
});

test('1 · a picked table: no dock, no sheet — one slim bar of Rotate · Shape ▾ · Seats · ⋯ in the thumb row', () => {
  assert.match(ED, /if \(roomOnly && dockPrimary === 'table'\) return null;/, 'the table dock is drawn over the 2D map again');
  const bar = ED.slice(ED.indexOf('const tableBar = barTable'), ED.indexOf('const boothCardRow'));
  assert.ok(bar.length > 100, 'the slim table bar is gone');
  for (const piece of [/label="Rotate"/, /label="Shape"/, /dockSeatsStepper\(st\)/, /label="More for this table"/]) assert.match(bar, piece);
  for (const k of ["key: 'name'", "key: 'swap'", "key: 'link'", "key: 'unlink'", "key: 'delete'"]) assert.ok(bar.includes(k), `⋯ lacks ${k}`);
  assert.match(ED, /\{seatPop \?\? tableBar\}/, 'the bar does not ride in the thumb row');
});

test('2 · no guest list in 2D', () => {
  assert.match(ED, /<SeatPlanPortal name="guests" on=\{!peopleInSheet && !roomOnly\}>/, 'the guest list is drawn beside the 2D plan');
  assert.match(ED, /if \(peopleInSheet && seatPieceKey && !\(roomOnly && highlightId\)\) setPeopleOpen\(true\);/, 'a table pick raises the people sheet');
  assert.match(ED, /extras: peopleInSheet && !roomOnly/, 'the "People" door is offered in 2D');
  const slot = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seat-plan-in-guests.tsx'), 'utf8'));
  assert.match(slot, /<SeatPlanSlot name="guests" className=\{`[^`]*md:\[&:not\(:empty\)\]:flex/, 'an empty guests column still takes room');
});

test('3 · a name or an empty seat does nothing for the guest in 2D', () => {
  const chairs = [...ED.matchAll(/onPointerDown=\{\(e\) => \{\s*if \(roomOnly\) return;\s*e\.stopPropagation\(\);/g)];
  assert.equal(chairs.length, 2, 'a 2D seat (taken or empty) acts on a guest again');
});

test('5 · the picked table drags, on a phone too', () => {
  assert.match(ED, /const tablePress = \(t: EventTableRow\): 'tap' \| 'drag' => \(roomOnly && highlightId === t\.table_id \? 'drag' : press\);/);
  const hubs = [...ED.matchAll(/onPointerDown=\{tablePress\(t\) === 'drag' \? onHubPointerDown\(t\) : onTapDown\('table', t\.table_id\)\}/g)];
  assert.equal(hubs.length, 2, 'a table hub ignores the picked-table drag');
  // …and its "Drop here?" stays on a phone's screen (a flip pushed it off the left edge).
  assert.match(ED, /if \(rect\.width < 2 \* 260\) return \{ x: Math\.max\(8, Math\.min\(x, rect\.width - 260\)\), y, flipX: false/);
});

test('4 · a supplier’s booth opens THE supplier card, with public identity only', () => {
  assert.match(ED, /roomOnly && d\.kind === 'booth' && booths\.some\(\(b\) => b\.booth_id === d\.id && boothHasSupplier\(b\)\)/, 'a dragged-mode booth tap does not open the card');
  assert.match(ED, /if \(roomOnly && tap\.kind === 'booth' && booths\.some\(\(b\) => b\.booth_id === tap\.id && boothHasSupplier\(b\)\)\) \{/, 'a phone booth tap does not open the card');
  assert.match(ED, /<BoothVendorCard booth=\{boothCardRow \? boothCardFromRow\(boothCardRow\) : null\}/);
  const card = boothCardFromRow({
    booth_id: 'b1', event_id: 'e', booth_type: 'live_cooking', label: 'Lechon', x_pos: 10, y_pos: 20, sort_order: 0, zone: 'reception',
    event_vendor_id: 'v', offerings: 'Lechon de leche',
    vendor: { vendor_name: 'Juan’s Lechon', category: 'catering', logo_url: 'r2://x', tier: 'pro', slug: 'juans', bookable: true, boothAddonActive: false },
  } as never);
  assert.equal(card.vendor?.name, 'Juan’s Lechon');
  assert.equal(card.vendor?.logoUrl, null, 'a raw stored ref must never reach an <img>');
  assert.equal(card.offerings, 'Lechon de leche');
  assert.equal(boothHasSupplier({ vendor: null }), false);
});
