/**
 * Scroll-free console height math (Node built-in test runner, run via tsx).
 *
 * The console is an operator surface used during a ceremony that cannot be re-run — if the
 * PROGRAM monitor sits below the fold, cutting a camera means scrolling past the very controls
 * you need. These tests pin the arithmetic that keeps it on one screen:
 *
 *   1. MEASURED, NOT HARDCODED — the fit subtracts the console's own measured top, so the sticky
 *      bar / shell padding / future chrome can change without rotting this.
 *   2. THE MOBILE NAV IS VIEWPORT-DRIVEN — it is `lg:hidden`, so clearance follows viewport
 *      width, NOT the board/compact layout mode (which is device-driven and can disagree).
 *   3. A FLOOR, NOT A CRUSH — on a short window, scrolling a little beats a sliver console.
 *   4. UNUSABLE MEASUREMENTS RETURN null — the caller must fall back to natural flow rather than
 *      collapse to zero height during SSR or a mid-transition measure.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  consoleFitHeight,
  MOBILE_NAV_CLEARANCE_PX,
  DESKTOP_BOTTOM_GAP_PX,
  MIN_CONSOLE_HEIGHT_PX,
  type FitInput,
} from './panood-console-fit';

const fit = (over: Partial<FitInput> = {}): FitInput => ({
  consoleTop: 200,
  viewportHeight: 900,
  bottomNavVisible: false,
  ...over,
});

/* ── 1. Measured, not hardcoded ───────────────────────────────────────────── */

test('desktop fit is viewport minus the measured top minus a small gap', () => {
  assert.equal(consoleFitHeight(fit()), 900 - 200 - DESKTOP_BOTTOM_GAP_PX);
});

test('a taller sticky header simply yields a shorter console', () => {
  // Nothing here knows the header's height — that is the point.
  assert.equal(consoleFitHeight(fit({ consoleTop: 320 })), 900 - 320 - DESKTOP_BOTTOM_GAP_PX);
});

/* ── 2. The mobile nav is viewport-driven ─────────────────────────────────── */

test('mobile clears the bottom nav', () => {
  assert.equal(
    consoleFitHeight(fit({ viewportHeight: 844, consoleTop: 180, bottomNavVisible: true })),
    844 - 180 - MOBILE_NAV_CLEARANCE_PX,
  );
});

test('the iPhone home indicator is subtracted on top of the nav', () => {
  assert.equal(
    consoleFitHeight(
      fit({ viewportHeight: 844, consoleTop: 180, bottomNavVisible: true, safeAreaBottom: 34 }),
    ),
    844 - 180 - MOBILE_NAV_CLEARANCE_PX - 34,
  );
});

test('a negative safe-area value cannot ADD height', () => {
  const withJunk = consoleFitHeight(fit({ safeAreaBottom: -50 }));
  assert.equal(withJunk, consoleFitHeight(fit({ safeAreaBottom: 0 })));
});

/* ── 3. A floor, not a crush ──────────────────────────────────────────────── */

test('a short window floors at the minimum rather than crushing the console', () => {
  // Laptop with OBS docked and a browser toolbar: scrolling a little is the honest outcome.
  assert.equal(consoleFitHeight(fit({ viewportHeight: 500, consoleTop: 400 })), MIN_CONSOLE_HEIGHT_PX);
});

test('the floor also applies when the console is pushed below the fold entirely', () => {
  assert.equal(consoleFitHeight(fit({ consoleTop: 1200 })), MIN_CONSOLE_HEIGHT_PX);
});

/* ── 4. Unusable measurements ─────────────────────────────────────────────── */

test('a zero or absent viewport returns null, not a collapsed console', () => {
  assert.equal(consoleFitHeight(fit({ viewportHeight: 0 })), null);
  assert.equal(consoleFitHeight(fit({ viewportHeight: Number.NaN })), null);
});

test('a non-finite top returns null', () => {
  assert.equal(consoleFitHeight(fit({ consoleTop: Number.NaN })), null);
});
