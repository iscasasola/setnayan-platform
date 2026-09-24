/**
 * GUARD — A BOTTOM SHEET MUST NOT END UNDERNEATH THE FLOATING NAV.
 *
 * ⚖ Owner, 2026-09-23, on the capture-window sheet: *"i can no longer update
 * it again. under the bottom nav"* — the Save button sat behind the pill, so a
 * capture window that had been set could never be changed again. He reported it
 * on three sheets in a row (capture window, guest window, Papic look); it was
 * one bug in the shared `Sheet`, not three.
 *
 * ── 🔑 WHY A SOURCE GUARD AND NOT A TEST ──────────────────────────────────
 * Nothing in CI lays a page out. 17k unit tests, 3k db tests and 30-odd guards
 * were all green while the button was unreachable — the same way #5777 shipped
 * a required field at y=-174 past a fully green suite. A source guard cannot
 * measure pixels either; what it CAN do is stop the two numbers below being
 * deleted or quietly decoupled from the nav they are derived from.
 *
 * **This is a tripwire, not a proof.** Anything that changes the sheet's height
 * or the nav's geometry still has to be opened and looked at.
 *
 * ── THE ARITHMETIC IT PINS ────────────────────────────────────────────────
 * `bottom-nav.tsx` is `fixed bottom-[calc(env(safe-area-inset-bottom)+12px)]`
 * and its `NavShell` stage is `height: 64`. So the bar occupies
 * `safe-area + 76px` measured from the viewport bottom. The sheet clears it
 * with 88px (a 12px gap) and gives back the same amount from its own max
 * height, or a tall sheet clips off the TOP instead — the identical defect
 * pointing the other way.
 *
 * Run from apps/web:  npx tsx --test lib/the-sheet-clears-the-bottom-nav.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, '');
const SHEET = readFileSync(join(WEB, 'app/_components/sheet.tsx'), 'utf8');
const NAV = readFileSync(join(WEB, 'app/_components/nav/bottom-nav.tsx'), 'utf8');

test('the nav still is what this arithmetic assumes — 64px at safe-area + 12px', () => {
  // If either number moves, the sheet's clearance is wrong and silently so.
  assert.match(
    NAV,
    /bottom-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\]/,
    'the bottom nav no longer floats at safe-area + 12px — the sheet clearance was derived from it',
  );
  assert.match(
    NAV,
    /height:\s*64/,
    'the bottom nav bar is no longer 64px tall — recompute the sheet clearance (offset + height + gap)',
  );
  assert.match(NAV, /lg:hidden/, 'the bottom nav is no longer phone-only, so `lg:pb-0` is now wrong');
});

test('🚨 the sheet reserves room for the nav below lg', () => {
  assert.match(
    SHEET,
    /pb-\[calc\(env\(safe-area-inset-bottom\)\+88px\)\]/,
    'the sheet no longer clears the floating nav — its bottom control is unreachable on a phone',
  );
  assert.match(SHEET, /lg:pb-0/, 'the desktop drawer is padding a nav that is not on screen');
});

test('…and gives back the same room from its own height, so it cannot clip at the top', () => {
  assert.match(
    SHEET,
    /max-h-\[calc\(100dvh-env\(safe-area-inset-bottom\)-104px\)\]/,
    'the sheet max-height no longer accounts for the nav clearance — a tall sheet now clips its TOP',
  );
  assert.ok(
    !/max-h-\[90dvh\]/.test(SHEET),
    'the old 90dvh cap is back; with the new bottom padding it overflows the viewport',
  );
});

test('z-index is NOT how this is held — the sheet was never behind the nav', () => {
  // Raising z would stack the sheet OVER the nav and leave two bars competing.
  assert.match(SHEET, /z-50/, 'the sheet lost its stacking level');
  assert.match(NAV, /z-30/, 'the nav lost its stacking level; the sheet/nav order is no longer intentional');
});

test('🚨 the backdrop stops where the sheet stops — the nav is never dimmed', () => {
  // Owner: "not on top of the bottom nav … its layer will just be above the
  // bottom nav". An `inset-0` backdrop covers the overlay's padding too, which
  // greys the bar and makes it read as disabled.
  assert.ok(
    !/absolute inset-0 bg-ink\/40/.test(SHEET),
    'the backdrop is back to inset-0 — it now dims the bottom nav, which stays usable',
  );
  assert.match(
    SHEET,
    /bottom-\[calc\(env\(safe-area-inset-bottom\)\+88px\)\] lg:bottom-0 bg-ink\/40/,
    'the backdrop no longer clears the nav by the same 88px the sheet does',
  );
});

test('the sheet travels its own height, and never with `both`', () => {
  assert.match(SHEET, /sn-sheet-up/, 'the sheet no longer rises from the bottom');
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /@keyframes sn-sheet-up/, 'the sheet-up keyframe is gone');
  const rule = css.slice(css.indexOf('.sn-sheet-up {'), css.indexOf('.sn-sheet-up {') + 160);
  assert.ok(
    /backwards/.test(rule) && !/\bboth\b/.test(rule),
    'sn-sheet-up uses `both`: a lingering transform makes the panel the containing ' +
      'block for its fixed descendants and silently unpins them (measured on prod 2026-09-18)',
  );
});

test('the Papic rows actually ASK for the animation', () => {
  // `rise` was never passed, so every sheet on this page opened with no motion
  // at all while the prop sat there looking implemented.
  const rowSrc = readFileSync(
    join(WEB, 'app/dashboard/[eventId]/studio/papic/_components/setting-row.tsx'),
    'utf8',
  );
  assert.match(rowSrc, /<Sheet open rise\b/, 'SettingRow stopped passing `rise` — its sheets do not animate');
});
