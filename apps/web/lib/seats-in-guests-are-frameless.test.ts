/**
 * seats-in-guests-are-frameless.test.ts — GUESTS › SEATS: THE 2D FLOOR HAS NO FRAME (R4 slice 6 part 1, owner 2026-10-29:
 * "2D/3D frameless edge to edge"). The 3D room is already frameless in the Maker/Guests (`inMaker` in seating-lab-3d.tsx);
 * the 2D canvas drew a hairline border — in Guests it does not; the Studio keeps it.
 *
 * 🛡 Sabotaged (2026-10-29): the border back on unconditionally → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

test('the 2D canvas draws its border only outside Guests', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));
  const at = src.indexOf('ref={canvasRef}');
  assert.ok(at > -1, 'the canvas moved — this guard is blind');
  const tag = src.slice(at, src.indexOf('style={{', at));
  // 📐 Slice 2 (edge to edge): in Guests the canvas is the room box over a floor that fills the cell — no border either way.
  const guests = tag.match(/inGuests\s*\?\s*"([^"]*)"\s*:\s*'([^']*)'/);
  const [, inGuestsCls, studioCls] = guests ?? [];
  assert.ok(inGuestsCls !== undefined && studioCls !== undefined, 'the canvas no longer names its Guests and Studio looks apart — this guard is blind');
  assert.doesNotMatch(inGuestsCls, /\bborder\b/, 'the Guests floor has a frame');
  assert.match(studioCls, /\bborder border-ink\/15\b/, 'the Studio canvas lost its hairline');
  assert.doesNotMatch(tag.replace(studioCls, ''), /\bborder\b/, 'a second border is drawn');
});

test('the room\u2019s outline: in Guests only for a FIXED (saved) room, square — never the suggested / free board', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));
  assert.match(src, /\{venueScaled && \(!inGuests \|\| \(floorPlan\.venue_width_m !== null && floorPlan\.venue_length_m !== null\)\) \? \(/, 'Guests draws the wall for a room nobody fixed');
  assert.match(src, /className=\{`pointer-events-none absolute inset-0 border border-ink\/30 \$\{inGuests \? '' : 'rounded-lg'\}`\} data-seat-room-wall=""/, 'the Guests wall is rounded');
});

test('every 2D chair is ROUND, in the guest’s colour; a blank one a dashed circle (owner 2026-10-29: "each seat square")', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'));
  for (const kind of ['taken', 'blank']) {
    const at = src.indexOf(`data-seat-chair="${kind}"`);
    assert.ok(at > -1, `the ${kind} chair moved — this guard is blind`);
    const tag = src.slice(src.lastIndexOf('<span', at), src.indexOf('>', at));
    assert.match(tag, /\brounded-full\b/, `a ${kind} chair is not round`);
    assert.doesNotMatch(tag, /\brounded-(?:sm|md|lg|none)\b/, `a ${kind} chair is square-cornered`);
  }
  const blank = src.slice(src.indexOf('data-seat-chair="blank"') - 20, src.indexOf('data-seat-chair="blank"') + 160);
  assert.match(blank, /border-dashed/, 'an empty chair is not the dashed circle');
});
