/**
 * pick-menu-place.test.ts — A `PickMenu` LIST OPENS ON THE SCREEN.
 *
 * Measured live on production (controller, 2026-09-27, commit 3e45275):
 *   · phone 390×844 — the element sheet's Font button at 455–495; its list was
 *     drawn at 880, wholly below the screen. The owner tapped Font and nothing
 *     appeared.
 *   · desktop 1440×900 — the same list opened at left 2300, off to the right.
 *   · phone — "Home ▾" at 732–772 opened downward to 1010 in an 844 screen,
 *     ~66px of it visible.
 *
 * Two halves:
 *   1. BEHAVIOUR — `placePickList` is EXECUTED with those measurements: the
 *      list's drawn box (top … top + min(height, maxHeight)) lies inside the
 *      viewport, it opens upward when that is the roomier side, and its left
 *      edge is clamped.
 *   2. THE CONTAINING BLOCK — no placement maths survives an ancestor with
 *      `backdrop-filter` (the sheet's `.sn-glass-bare`), which re-bases
 *      `position: fixed`. So the list must be portalled to `document.body`, and
 *      its z-index must clear the Maker overlay it opens over. A source read,
 *      comments stripped, because a unit test cannot lay out a real page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { PICK_LIST_MARGIN, placePickList, type PickListPlacement } from './pick-menu-place';

const HERE = dirname(fileURLToPath(import.meta.url));
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** The box the list actually paints: its height is capped by maxHeight. */
function drawn(p: PickListPlacement, listHeight: number) {
  const h = Math.min(listHeight, p.maxHeight);
  return { top: p.top, bottom: p.top + h, left: p.left, right: p.left + p.minWidth, height: h };
}

function assertOnScreen(p: PickListPlacement, listHeight: number, vp: { width: number; height: number }) {
  const box = drawn(p, listHeight);
  assert.ok(box.top >= PICK_LIST_MARGIN, `top ${box.top} is above the screen`);
  assert.ok(box.bottom <= vp.height - PICK_LIST_MARGIN, `bottom ${box.bottom} is below a ${vp.height} screen`);
  assert.ok(box.left >= PICK_LIST_MARGIN, `left ${box.left} is off the left edge`);
  assert.ok(box.right <= vp.width - PICK_LIST_MARGIN, `right ${box.right} is off a ${vp.width} screen`);
  assert.ok(box.height > 0, 'the list has no height at all');
}

test('phone Font dropdown (button 455–495, a 452px list, 844 screen) lands wholly on screen', () => {
  const button = { top: 455, bottom: 495, left: 96, width: 278 };
  const p = placePickList({ button, listHeight: 452, viewport: PHONE });
  assertOnScreen(p, 452, PHONE);
  // Room below is 335, above is 441 — the roomier side is above.
  assert.equal(p.side, 'above');
  assert.ok(p.top + Math.min(452, p.maxHeight) <= button.top, 'an upward list must not cover its own button');
});

test('phone "Home ▾" near the bottom (button 732–772, a 232px list) opens UPWARD, fully visible', () => {
  const button = { top: 732, bottom: 772, left: 16, width: 110 };
  const p = placePickList({ button, listHeight: 232, viewport: PHONE });
  assert.equal(p.side, 'above');
  assertOnScreen(p, 232, PHONE);
  assert.equal(Math.min(232, p.maxHeight), 232, 'a list that fits above is not clipped');
  assert.equal(p.top, 732 - 6 - 232);
});

test('a list that fits below opens below, unchanged (the toolbar picker case)', () => {
  const toolbar = { top: 12, bottom: 52, left: 200, width: 120 };
  const p = placePickList({ button: toolbar, listHeight: 300, viewport: DESKTOP });
  assert.equal(p.side, 'below');
  assert.equal(p.top, 52 + 6);
  assertOnScreen(p, 300, DESKTOP);
  // Fits below even though ABOVE is roomier: below still wins — it only flips when it must.
  const mid = { top: 500, bottom: 540, left: 200, width: 120 };
  const q = placePickList({ button: mid, listHeight: 300, viewport: DESKTOP });
  assert.equal(q.side, 'below');
  assert.equal(q.top, 540 + 6);
});

test('desktop Font dropdown at the right edge (button left 1300) is clamped inside a 1440 screen', () => {
  const button = { top: 300, bottom: 340, left: 1300, width: 100 };
  const p = placePickList({ button, listHeight: 452, viewport: DESKTOP });
  assertOnScreen(p, 452, DESKTOP);
  assert.equal(p.left, 1440 - 160 - PICK_LIST_MARGIN);
});

test('a list taller than either side is capped to the room it has, so it scrolls instead of leaving', () => {
  const button = { top: 400, bottom: 440, left: 20, width: 200 };
  const p = placePickList({ button, listHeight: 2000, viewport: PHONE });
  assertOnScreen(p, 2000, PHONE);
  assert.ok(p.maxHeight < 2000);
});

test('before the list mounts (height 0) it is placed below; the re-measure then decides', () => {
  const button = { top: 732, bottom: 772, left: 16, width: 110 };
  assert.equal(placePickList({ button, listHeight: 0, viewport: PHONE }).side, 'below');
  assert.equal(placePickList({ button, listHeight: 232, viewport: PHONE }).side, 'above');
});

test('the list is portalled to <body> and sits above the Maker overlay', () => {
  const src = stripComments(readFileSync(join(HERE, 'pick-menu.tsx'), 'utf8'));
  assert.match(src, /createPortal\(\s*<ul[\s\S]*?<\/ul>,\s*document\.body,?\s*\)/, 'the listbox must be portalled to document.body');
  assert.match(src, /placePickList\(/, 'placement must go through placePickList');
  assert.match(src, /listHeight:\s*listRef\.current\?\.scrollHeight/, 'the list must be measured, not guessed');
  // Focus lands on the CURRENT option once the list exists (measured in the
  // browser: on a first open it landed nowhere; a selector LIST always picked
  // the top option). Inside the layout effect, the selected one first.
  const layout = src.slice(src.indexOf('useLayoutEffect(() => {'), src.indexOf('useEffect(() => {'));
  assert.match(
    layout,
    /querySelector<HTMLButtonElement>\('button\[aria-selected="true"\]:not\(\[disabled\]\)'\)\s*\?\?\s*listRef\.current\.querySelector<HTMLButtonElement>\('button:not\(\[disabled\]\)'\)/,
  );

  const listClass = /role="listbox"[\s\S]*?className="([^"]*)"/.exec(src)?.[1] ?? '';
  const listZ = Number(/\bz-\[(\d+)\]/.exec(listClass)?.[1] ?? NaN);
  const maker = stripComments(readFileSync(resolve(HERE, '../../../launch/_components/maker-shell.tsx'), 'utf8'));
  // The overlay is the element carrying `data-maker-shell`; read ITS z.
  const overlayZ = Number(/className="fixed inset-x-0 top-0 z-\[(\d+)\][^"]*"\s*data-maker-shell/.exec(maker)?.[1] ?? NaN);
  assert.ok(Number.isFinite(listZ), 'the listbox carries a z-[n] class');
  assert.ok(Number.isFinite(overlayZ), 'found the Maker overlay z');
  assert.ok(listZ > overlayZ, `list z-[${listZ}] must clear the Maker overlay z-[${overlayZ}]`);
});
