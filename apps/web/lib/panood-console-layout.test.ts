/**
 * Live Studio console-layout invariants (Node built-in test runner, run via tsx).
 *
 * The console previously switched on VIEWPORT width, which meant snapping OBS beside it on a
 * laptop collapsed the director board into the phone layout — during setup for a broadcast.
 * These tests pin the replacement:
 *
 *   1. DEVICE, NOT WINDOW — the decision reads the physical screen + pointer type, so no window
 *      resize can change it.
 *   2. THE OPERATOR OUTRANKS EVERYTHING — an explicit choice wins over device and over the
 *      on-air freeze, because the freeze exists to stop the BROWSER surprising them, not them.
 *   3. FROZEN WHILE LIVE — once on air, device signals stop mattering.
 *   4. UNKNOWN STORAGE IS NO PREFERENCE — junk in localStorage must not wedge a layout.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveConsoleLayout,
  deviceLayout,
  parseStoredLayout,
  BOARD_MIN_SCREEN_WIDTH,
  type LayoutSignals,
} from './panood-console-layout';

const signals = (over: Partial<LayoutSignals> = {}): LayoutSignals => ({
  override: null,
  pointerFine: true,
  screenWidth: 1440,
  frozen: null,
  ...over,
});

/* ── 1. Device, not window ────────────────────────────────────────────────── */

test('a laptop gets the board', () => {
  assert.equal(resolveConsoleLayout(signals()), 'board');
});

test('a touch phone gets the compact stack', () => {
  assert.equal(resolveConsoleLayout(signals({ pointerFine: false, screenWidth: 390 })), 'compact');
});

test('a laptop with a narrow WINDOW still gets the board', () => {
  // The regression this whole module exists for: OBS snapped beside the console leaves ~720px
  // of viewport, but screen.width is unchanged, so the board survives.
  assert.equal(resolveConsoleLayout(signals({ screenWidth: 1440 })), 'board');
});

test('a large touch screen still gets compact — pointer type decides too', () => {
  // A kiosk or touch-TV is wide but has no precise pointer; a director board needs a cursor.
  assert.equal(deviceLayout(false, 1920), 'compact');
});

test('the board threshold is inclusive at exactly the minimum', () => {
  assert.equal(deviceLayout(true, BOARD_MIN_SCREEN_WIDTH), 'board');
  assert.equal(deviceLayout(true, BOARD_MIN_SCREEN_WIDTH - 1), 'compact');
});

/* ── 2. The operator outranks everything ──────────────────────────────────── */

test('an explicit override beats the device', () => {
  assert.equal(resolveConsoleLayout(signals({ override: 'compact' })), 'compact');
  assert.equal(
    resolveConsoleLayout(signals({ override: 'board', pointerFine: false, screenWidth: 390 })),
    'board',
  );
});

test('an explicit override beats the on-air freeze', () => {
  // The freeze stops the browser re-laying-out mid-ceremony. It must not trap an operator who
  // deliberately reaches for the other layout.
  assert.equal(
    resolveConsoleLayout(signals({ override: 'compact', frozen: 'board' })),
    'compact',
  );
});

/* ── 3. Frozen while live ─────────────────────────────────────────────────── */

test('once on air the frozen layout holds against changed device signals', () => {
  const s = signals({ frozen: 'board', pointerFine: false, screenWidth: 390 });
  assert.equal(resolveConsoleLayout(s), 'board');
});

test('with no freeze and no override the device decides', () => {
  assert.equal(resolveConsoleLayout(signals({ frozen: null, screenWidth: 800 })), 'compact');
});

/* ── 4. Storage hygiene ───────────────────────────────────────────────────── */

test('stored layout parses only the two known values', () => {
  assert.equal(parseStoredLayout('board'), 'board');
  assert.equal(parseStoredLayout('compact'), 'compact');
});

test('junk or absent storage means no preference, not a wedged layout', () => {
  for (const raw of [null, '', 'desktop', 'BOARD', '{"mode":"board"}', 'undefined']) {
    assert.equal(parseStoredLayout(raw), null, `"${raw}" should not resolve to a layout`);
  }
});
