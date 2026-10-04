/**
 * the-row-menu-opens-on-screen.test.ts — A GUEST ROW'S ⋯ LIST OPENS WHOLLY ON
 * SCREEN AT 375 PX.
 *
 * Live bug on 74ff0be (2026-10-03): the row's ⋯ ("More for <name>") sits on
 * the LEFT of a phone card, beside Invite, and its list was pinned by its RIGHT
 * edge to the ⋯'s right edge — 224 px wide, it ran off the left of the screen
 * and only "…to NFC" showed. Both the ⋯ list and the guest-table popovers now
 * place themselves through ONE function, `placeMenu` (lib/menu-place.ts).
 *
 * 🛡 Sabotaged (see the PR): putting back `right: window.innerWidth - r.right`
 * turns the second test red; dropping the clamp from `placeMenu` turns the
 * first red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { placeMenu } from '@/lib/menu-place';

const PHONE = { width: 375, height: 667 };
const MENU = { width: 224, height: 150 };
const onScreen = (p: { left: number; top: number }, m = MENU, v = PHONE) =>
  p.left >= 8 && p.left + m.width <= v.width - 8 && p.top >= 8 && p.top + m.height <= v.height - 8;

test('at 375 px the ⋯ list is wholly on screen wherever its button sits', () => {
  // The live case: ⋯ just right of Invite, on the left half of the card.
  const leftButton = { left: 120, right: 164, top: 300, bottom: 344 };
  const p = placeMenu(leftButton, PHONE, MENU, 'end');
  assert.ok(onScreen(p), `the ⋯ list opened off screen: ${JSON.stringify(p)}`);
  // Every x across the phone, top and bottom of the screen.
  for (let x = 0; x <= 375 - 44; x += 11) {
    for (const y of [60, 300, 600]) {
      const at = placeMenu({ left: x, right: x + 44, top: y, bottom: y + 44 }, PHONE, MENU, 'end');
      assert.ok(onScreen(at), `⋯ at x=${x}, y=${y} → ${JSON.stringify(at)} is off screen`);
    }
  }
  // When it fits, it still lines up with the ⋯'s right edge (the design).
  const rightButton = { left: 315, right: 359, top: 300, bottom: 344 };
  assert.equal(placeMenu(rightButton, PHONE, MENU, 'end').left, 359 - 224);
  // No room below → it opens above the button.
  const low = placeMenu({ left: 300, right: 344, top: 600, bottom: 644 }, PHONE, MENU, 'end');
  assert.ok(low.top + MENU.height <= 600, 'a ⋯ near the bottom opened its list under the screen edge');
  // The table popovers ('start') keep the arithmetic they shipped with.
  const r = { left: 340, right: 380, top: 100, bottom: 130 };
  assert.deepEqual(placeMenu(r, { width: 390, height: 800 }, { width: 210, height: 120 }), {
    left: Math.max(8, Math.min(340, 390 - 210 - 8)),
    top: 136,
  });
});

test('the ⋯ list and the popovers both place through placeMenu, by their LEFT edge', () => {
  const dir = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
  const parts = stripComments(readFileSync(join(dir, 'guest-ticket-parts.tsx'), 'utf8'));
  const menu = parts.slice(parts.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /placeMenuIn\(\s*r,/, 'the ⋯ list no longer uses the one placement rule');
  // On a guest-list row (no box to stay in) it still lines up by its right edge;
  // inside the guest card it opens below the card's row (the-card-reads-in-one-voice.test.ts).
  assert.match(menu, /room \? 'start' : 'end',/, 'the ⋯ list no longer lines up with the ⋯ by its right edge when it fits');
  assert.doesNotMatch(menu, /innerWidth - r\.right|right: at\.right/, 'the ⋯ list is pinned by its right edge again — it runs off a phone');
  assert.match(menu, /\{ top: at\.top, left: at\.left,/, 'the ⋯ list is not drawn at its placed left edge');
  assert.match(menu, /maxWidth: 'calc\(100vw - 16px\)'/, 'the ⋯ list can be wider than the phone');
  const overlay = stripComments(readFileSync(join(dir, 'overlay-primitives.tsx'), 'utf8'));
  assert.match(overlay, /= placeMenuIn\(\s*anchor\.getBoundingClientRect\(\)/, 'the table popovers keep a private placement rule');
});
