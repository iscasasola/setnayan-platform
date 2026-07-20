/**
 * Live Studio program-bridge invariants (Node built-in test runner, run via tsx).
 *
 * The bridge is what keeps the OBS program pop-out from opening a SECOND WebRTC
 * viewer. That matters because lib/panood-webrtc is one-publisher → one-viewer
 * per camera slot: a second viewer's answer replaces the control room's peer and
 * steals the phone's stream, blacking out the operator's own monitor mid-event.
 * So these tests pin the contract that makes sharing possible instead:
 *
 *   1. IDENTITY — the child reads the SAME MediaStream object by reference (a
 *      clone would not play a live track).
 *   2. FAN-OUT — subscribers get every publish, stop after unsubscribe, and one
 *      throwing subscriber never starves the rest.
 *   3. ORPHAN STATES — each way the pop-out can lose its parent reports a
 *      distinct reason, so the UI can explain it rather than show a blank window
 *      that OBS would cheerfully keep broadcasting.
 *
 * `window` is synthesized here — these lib tests run in plain Node, no jsdom.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  installProgramBridge,
  resolveProgramBridge,
  EMPTY_FRAME,
  clampSplitRatio,
  splitRatioFromPointer,
  SPLIT_RATIO_MIN,
  SPLIT_RATIO_MAX,
  type ProgramBridge,
  type ProgramFrame,
} from './panood-program-bridge';

type FakeWindow = { opener: unknown; [key: string]: unknown };

/** Minimal same-origin `window` stand-in; the bridge only touches `opener` + its own key. */
function installFakeWindow(): FakeWindow {
  const w: FakeWindow = { opener: null };
  (globalThis as { window?: unknown }).window = w;
  return w;
}

const frameWith = (over: Partial<ProgramFrame> = {}): ProgramFrame => ({
  ...EMPTY_FRAME,
  ...over,
});

/** Resolve and assert we got a live bridge rather than a failure string. */
function resolveOk(): ProgramBridge {
  const resolved = resolveProgramBridge();
  assert.notEqual(typeof resolved, 'string', `expected a bridge, got "${String(resolved)}"`);
  return resolved as ProgramBridge;
}

let win: FakeWindow;
beforeEach(() => {
  win = installFakeWindow();
});

test('serves the initial frame through the opener', () => {
  const bridge = installProgramBridge(frameWith({ label: 'Camera 1' }));
  win.opener = win; // the pop-out's opener IS the control room

  assert.equal(resolveOk().get().label, 'Camera 1');
  bridge.dispose();
});

test('passes the SAME MediaStream object by reference — never a clone', () => {
  // Reference identity is the entire mechanism: the child assigns the parent's
  // live track straight into its <video>. Structured-cloning would break it.
  const stream = { id: 'live-track' } as unknown as MediaStream;
  const bridge = installProgramBridge();
  win.opener = win;

  bridge.publish(frameWith({ source: 'cam1', stream }));
  assert.equal(resolveOk().get().stream, stream);
  bridge.dispose();
});

test('carries split-cam state so the pop-out composites what the operator sees', () => {
  const primary = { id: 'a' } as unknown as MediaStream;
  const secondary = { id: 'b' } as unknown as MediaStream;
  const bridge = installProgramBridge();
  win.opener = win;

  bridge.publish(
    frameWith({ source: 'cam1', stream: primary, secondaryStream: secondary, splitRatio: 0.3 }),
  );

  const frame = resolveOk().get();
  assert.equal(frame.stream, primary);
  assert.equal(frame.secondaryStream, secondary);
  assert.equal(frame.splitRatio, 0.3);
  bridge.dispose();
});

test('pushes every update to subscribers and stops after unsubscribe', () => {
  const bridge = installProgramBridge();
  win.opener = win;

  const seen: (string | null)[] = [];
  const unsubscribe = resolveOk().subscribe((f) => seen.push(f.source));

  bridge.publish(frameWith({ source: 'cam1' }));
  bridge.publish(frameWith({ source: 'cam2' }));
  unsubscribe();
  bridge.publish(frameWith({ source: 'cam3' })); // must not be seen

  assert.deepEqual(seen, ['cam1', 'cam2']);
  bridge.dispose();
});

test('one throwing subscriber does not starve the others', () => {
  const bridge = installProgramBridge();
  win.opener = win;
  const resolved = resolveOk();

  let healthyCalls = 0;
  resolved.subscribe(() => {
    throw new Error('pop-out mid-teardown');
  });
  resolved.subscribe(() => {
    healthyCalls += 1;
  });

  bridge.publish(frameWith({ source: 'cam1' }));
  assert.equal(healthyCalls, 1);
  bridge.dispose();
});

test('reports no-opener when the pop-out is opened directly or bookmarked', () => {
  assert.equal(resolveProgramBridge(), 'no-opener');
});

test('reports opener-closed when the control room tab is gone', () => {
  win.opener = { closed: true };
  assert.equal(resolveProgramBridge(), 'opener-closed');
});

test('reports no-bridge when the opener is not a control room', () => {
  win.opener = { closed: false };
  assert.equal(resolveProgramBridge(), 'no-bridge');
});

test('reports no-bridge instead of throwing on a cross-origin opener', () => {
  win.opener = new Proxy(
    { closed: false },
    {
      get(_t, prop) {
        if (prop === 'closed') return false;
        throw new Error('SecurityError: cross-origin');
      },
    },
  );
  assert.equal(resolveProgramBridge(), 'no-bridge');
});

test('dispose removes the bridge so a stale pop-out cannot bind to a dead console', () => {
  const bridge = installProgramBridge();
  win.opener = win;
  assert.notEqual(typeof resolveProgramBridge(), 'string');

  bridge.dispose();
  assert.equal(resolveProgramBridge(), 'no-bridge');
});

/* -------------------------------------------------------------------------- */
/*  Split-cam ratio math (PR #5)                                              */
/* -------------------------------------------------------------------------- */

test('clampSplitRatio keeps both panes legible', () => {
  assert.equal(clampSplitRatio(0.5), 0.5);
  assert.equal(clampSplitRatio(0), SPLIT_RATIO_MIN); // a 0%-wide pane reads as a glitch
  assert.equal(clampSplitRatio(1), SPLIT_RATIO_MAX);
  assert.equal(clampSplitRatio(-5), SPLIT_RATIO_MIN);
  assert.equal(clampSplitRatio(42), SPLIT_RATIO_MAX);
});

test('clampSplitRatio collapses non-finite input to an even split', () => {
  // A divider dragged before layout can produce NaN; an even split is the only
  // safe fallback, since this frame may be going to air.
  assert.equal(clampSplitRatio(Number.NaN), 0.5);
  assert.equal(clampSplitRatio(Number.POSITIVE_INFINITY), 0.5);
  assert.equal(clampSplitRatio(Number.NEGATIVE_INFINITY), 0.5);
});

test('splitRatioFromPointer maps pointer position across the track', () => {
  const track = { left: 100, width: 400 };
  assert.equal(splitRatioFromPointer(300, track), 0.5); // dead centre
  assert.equal(splitRatioFromPointer(200, track), 0.25);
  assert.equal(splitRatioFromPointer(100, track), SPLIT_RATIO_MIN); // clamped at the edge
  assert.equal(splitRatioFromPointer(500, track), SPLIT_RATIO_MAX);
});

test('splitRatioFromPointer returns null for an unlaid-out track', () => {
  // Returning null (not 0.5) lets the caller LEAVE the ratio alone rather than
  // snapping the operator's divider to a clamp bound mid-drag.
  assert.equal(splitRatioFromPointer(300, { left: 0, width: 0 }), null);
  assert.equal(splitRatioFromPointer(300, { left: 0, width: Number.NaN }), null);
});
