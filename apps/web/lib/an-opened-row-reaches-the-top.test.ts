/**
 * 📌 AN OPENED CATEGORY REACHES THE TOP — owner 2026-10-25, live, Suppliers: *"when i tapped food trucks it should
 * expand and pin foodtrucks on the top"*; *"we already used to have these both working"*.
 *
 * The landing (`scrollBenchAnchor`, unchanged since c45748a2c2) ran and was CLAMPED by the page's end: walked at 1280 on
 * /dev/suppliers-lab, the last category opened with its head 394 px under the pin line at `scrollY === max`. The fix
 * gives the bench the room the page is short of before each landing scroll (`lib/pin-room.ts`).
 *
 *   1  the arithmetic — exactly the missing page, never negative
 *   2  every landing scroll (the frame after the open AND the end of the unfold) makes room FIRST
 *   3  the room is the bench's padding, and it is dropped when nothing is open
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PIN_ROOM_VAR, pinRoomPx } from '@/lib/pin-room';

const BENCH = stripComments(
  readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'),
);

test('1 · the room is exactly what the page is short of — and 0 when it is long enough', () => {
  // The walked case: an 800-px screen, the last row's top at 1420 in the document, its scroll-margin line 124 px down,
  // a page 1800 px long. Resting there needs scrollY 1296 → a 2096-px page → 296 px short.
  assert.equal(pinRoomPx({ targetTop: 1420, margin: 124, viewport: 800, content: 1800 }), 296);
  // A row high in the list: plenty of page below → no room.
  assert.equal(pinRoomPx({ targetTop: 400, margin: 124, viewport: 800, content: 3000 }), 0);
  // Fractions round up (a 0.4-px shortfall still stops the head 0.4 px low).
  assert.equal(pinRoomPx({ targetTop: 1000.4, margin: 0, viewport: 800, content: 1800 }), 1);
  assert.equal(PIN_ROOM_VAR, '--pin-room');
});

test('2 · every landing scroll makes room first — after the open AND once the unfold has finished', () => {
  const land = BENCH.slice(BENCH.indexOf('const [landing, setLanding]'), BENCH.indexOf('}, [landing]);'));
  assert.ok(land.length > 0, 'the landing effect is gone');
  const fn = /const land = \(\) => \{([\s\S]*?)\};/.exec(land)?.[1] ?? '';
  assert.ok(fn, 'the landing has no single scroll step that makes room');
  const room = fn.indexOf('makeRoomToPin(row, benchRef.current)');
  const scroll = fn.indexOf('scrollBenchAnchor(id)');
  assert.ok(room >= 0, 'the landing scrolls without making room — a low row stops where the page ends (the 2026-10-25 bug)');
  assert.ok(scroll > room, 'the room is made after the scroll — the scroll was already clamped');
  assert.match(land, /requestAnimationFrame\(land\)/, 'the first landing (a frame after the open) skips the room');
  assert.match(land, /removeEventListener\('transitionend', settle\);\s*land\(\);/, 'the landing after the unfold skips the room');
  assert.doesNotMatch(land, /requestAnimationFrame\(\(\) => scrollBenchAnchor\(id\)\)/, 'a bare scroll came back beside the room');
});

test('3 · the room is the bench’s padding, and nothing open drops it', () => {
  assert.match(BENCH, /\.slcat\{padding-bottom:var\(--pin-room,0px\)\}/, 'the room is measured but never drawn');
  assert.match(BENCH, /if \(!openTile && !openAll\) dropPinRoom\(benchRef\.current\);/, 'the room outlives the open row — blank page under a folded list');
});
