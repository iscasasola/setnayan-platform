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

/* RE-AIMED 2026-11-20 (the approved drawing `guests_redesign_2026-11-20_fable.html` § 3): the card's ⋯ list is gone — its
   lines are labelled buttons inside the opened ticket — so there is no ⋯ list left to place. The one rule still places every
   popover (the Invite list, the table popovers), and no private copy of it may come back with a new menu. */
test('the popovers place through placeMenu — and the ticket’s buttons bring no private placement back', () => {
  const dir = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
  const parts = stripComments(readFileSync(join(dir, 'guest-ticket-parts.tsx'), 'utf8'));
  const menu = parts.slice(parts.indexOf('export function GuestMoreMenu('), parts.indexOf('export function GuestDeleteControl('));
  assert.doesNotMatch(menu, /role="menu"|getBoundingClientRect|innerWidth - r\.right|right: at\.right/, 'a hand-placed list is back in the ticket’s buttons');
  const overlay = stripComments(readFileSync(join(dir, 'overlay-primitives.tsx'), 'utf8'));
  assert.match(overlay, /= placeMenuIn\(\s*anchor\.getBoundingClientRect\(\)/, 'the table popovers keep a private placement rule');
});
