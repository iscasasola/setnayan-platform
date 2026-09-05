/**
 * S1 guards — the pure planner, held to account with synthetic frames.
 *
 * These are the paywall-shaped invariants of the encoder's program picture. Each one was
 * mutation-tested when written (see the S1 handback): breaking the guarded line turns the
 * named assertion red.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EMPTY_FRAME, SPLIT_RATIO_MIN, type ProgramFrame } from '../panood-program-bridge';
import {
  fitContain,
  planProgram,
  PROGRAM_HEIGHT,
  PROGRAM_WIDTH,
  SPLIT_DIVIDER_WIDTH,
  toWireFrame,
  type DrawOp,
} from './program-plan';
import { WITHHELD_CARD, pinnedChannelNotice } from './program-strings';

/** A stand-in MediaStream: the planner only ever tests for null. */
const fakeStream = (): MediaStream => ({ id: 'fake' }) as unknown as MediaStream;

const frameWith = (over: Partial<ProgramFrame> = {}): ProgramFrame => ({
  ...EMPTY_FRAME,
  ...over,
});

const kinds = (ops: readonly DrawOp[]) => ops.map((o) => o.kind);
const videoOps = (ops: readonly DrawOp[]) =>
  ops.filter((o): o is Extract<DrawOp, { kind: 'video' }> => o.kind === 'video');

/* ── GUARD 1 · null stream draws the placeholder, never a video op ─────────── */

test('null stream → the no-signal card with the frame label, and NO video op', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam2', label: 'Ceremony wide', stream: null })),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'card']);
  assert.deepEqual(plan[1], { kind: 'card', card: 'no-signal', lines: ['Ceremony wide'] });
  assert.equal(videoOps(plan).length, 0, 'a null stream must not plan a video draw');
});

test('a stream → one full-frame video op, object-contain region', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam1', stream: fakeStream() })),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'video']);
  assert.deepEqual(videoOps(plan)[0]?.region, { x: 0, y: 0, w: PROGRAM_WIDTH, h: PROGRAM_HEIGHT });
});

/* ── GUARD 2 · requestedSource ≠ source draws the withheld notice ──────────── */

test('requestedSource ≠ source → pinned-channel notice OVER the permitted picture', () => {
  const plan = planProgram({
    frame: toWireFrame(
      frameWith({ source: 'cam1', requestedSource: 'cam3', label: 'Altar', stream: fakeStream() }),
    ),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'video', 'notice']);
  assert.deepEqual(plan[2], {
    kind: 'notice',
    notice: 'withheld-cut',
    text: pinnedChannelNotice('Altar'),
  });
  assert.match(pinnedChannelNotice('Altar'), /^On air: Altar · switching cameras needs the Live Studio unlock$/);
});

test('requestedSource === source → no notice (the host is airing what they cut)', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam1', requestedSource: 'cam1', stream: fakeStream() })),
    air: null,
  });
  assert.equal(plan.some((o) => o.kind === 'notice'), false);
});

test('requestedSource ≠ source with a NON-enforcing air → no notice (entitled host)', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam1', requestedSource: 'cam3', stream: fakeStream() })),
    air: { enforced: false, permittedSlots: ['cam1', 'cam3'] },
  });
  assert.equal(plan.some((o) => o.kind === 'notice'), false);
});

test('a source the server did not permit → the withheld card, nothing else drawn', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam3', stream: fakeStream() })),
    air: { enforced: true, permittedSlots: ['cam1'] },
  });
  assert.deepEqual(kinds(plan), ['clear', 'card']);
  assert.deepEqual(plan[1], {
    kind: 'card',
    card: 'withheld-source',
    lines: [WITHHELD_CARD.kicker, WITHHELD_CARD.title, WITHHELD_CARD.body, WITHHELD_CARD.hint],
  });
  assert.equal(videoOps(plan).length, 0, 'a refused source must not leak its picture');
});

/* ── GUARD 3 · EMPTY_FRAME → placeholder, never a paywall or watermark ─────── */

test('EMPTY_FRAME → "Nothing on program yet", and no overlay/watermark op of any kind', () => {
  // The bridge's EMPTY_FRAME still says `overlay: true` (the pop-out's fail-closed default).
  assert.equal(EMPTY_FRAME.overlay, true, 'premise: EMPTY_FRAME carries the legacy overlay flag');
  const plan = planProgram({ frame: toWireFrame(EMPTY_FRAME), air: null });
  assert.deepEqual(plan, [
    { kind: 'clear' },
    { kind: 'card', card: 'no-signal', lines: ['Nothing on program yet'] },
  ]);
  for (const op of plan) {
    assert.doesNotMatch(op.kind, /overlay|watermark|paywall/i, `op kind ${op.kind} is a paywall draw`);
  }
  // And the wire form has no overlay field to carry across at all.
  assert.equal('overlay' in toWireFrame(EMPTY_FRAME), false);
});

/* ── GUARD 4 · split honoured only when secondaryStream is non-null ────────── */

test('secondaryStream non-null → split at clampSplitRatio(splitRatio), with a divider', () => {
  const plan = planProgram({
    frame: toWireFrame(
      frameWith({ source: 'cam1', stream: fakeStream(), secondaryStream: fakeStream(), splitRatio: 0.3 }),
    ),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'video', 'divider', 'video']);
  const [primary, secondary] = videoOps(plan);
  const primaryW = Math.round(0.3 * PROGRAM_WIDTH);
  assert.equal(primary?.slot, 'primary');
  assert.deepEqual(primary?.region, { x: 0, y: 0, w: primaryW, h: PROGRAM_HEIGHT });
  assert.equal(secondary?.slot, 'secondary');
  assert.deepEqual(secondary?.region, {
    x: primaryW + SPLIT_DIVIDER_WIDTH,
    y: 0,
    w: PROGRAM_WIDTH - primaryW - SPLIT_DIVIDER_WIDTH,
    h: PROGRAM_HEIGHT,
  });
});

test('secondaryStream null → splitRatio is IGNORED and the primary takes the full frame', () => {
  const plan = planProgram({
    frame: toWireFrame(
      frameWith({ source: 'cam1', stream: fakeStream(), secondaryStream: null, splitRatio: 0.3 }),
    ),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'video']);
  assert.equal(videoOps(plan)[0]?.region.w, PROGRAM_WIDTH);
});

test('split ratio is clamped through the bridge helper (0.05 → SPLIT_RATIO_MIN)', () => {
  const plan = planProgram({
    frame: toWireFrame(
      frameWith({ source: 'cam1', stream: fakeStream(), secondaryStream: fakeStream(), splitRatio: 0.05 }),
    ),
    air: null,
  });
  assert.equal(videoOps(plan)[0]?.region.w, Math.round(SPLIT_RATIO_MIN * PROGRAM_WIDTH));
});

test('secondary stream WITHOUT a primary → no split, the no-signal card', () => {
  const plan = planProgram({
    frame: toWireFrame(frameWith({ source: 'cam1', stream: null, secondaryStream: fakeStream() })),
    air: null,
  });
  assert.deepEqual(kinds(plan), ['clear', 'card']);
});

/* ── wire form + letterbox maths ───────────────────────────────────────────── */

test('toWireFrame reduces the two streams to booleans and defaults requestedSource to null', () => {
  const wire = toWireFrame({ ...EMPTY_FRAME, requestedSource: undefined, stream: fakeStream() });
  assert.deepEqual(wire, {
    source: null,
    requestedSource: null,
    label: 'Nothing on program yet',
    live: false,
    hasStream: true,
    hasSecondaryStream: false,
    splitRatio: 0.5,
  });
});

test('fitContain letterboxes a 4:3 source inside 16:9 and pillarboxes 9:16, never cropping', () => {
  const full = { x: 0, y: 0, w: 1280, h: 720 };
  assert.deepEqual(fitContain(640, 480, full), { x: 160, y: 0, w: 960, h: 720 });
  assert.deepEqual(fitContain(1080, 1920, full), { x: 438, y: 0, w: 405, h: 720 });
  assert.deepEqual(fitContain(1920, 1080, full), full);
  // Inside a split pane, offsets are relative to the pane.
  assert.deepEqual(fitContain(1920, 1080, { x: 386, y: 0, w: 894, h: 720 }), {
    x: 386,
    y: 109,
    w: 894,
    h: 503,
  });
  // Degenerate sources fall back to the region rather than throwing mid-broadcast.
  assert.deepEqual(fitContain(0, 0, full), full);
  assert.deepEqual(fitContain(Number.NaN, 720, full), full);
});
