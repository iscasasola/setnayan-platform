/**
 * S1 · the compositor against a RECORDING painter — the draw-call log is the assertion.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EMPTY_FRAME, type ProgramFrame } from '../panood-program-bridge';
import { ProgramCompositor, type ProgramPainter, type VideoFrameLike } from './program-compositor';
import { toWireFrame, PROGRAM_WIDTH, PROGRAM_HEIGHT } from './program-plan';

type Call =
  | ['clear']
  | ['video', string, { x: number; y: number; w: number; h: number }]
  | ['divider', number, number]
  | ['card', string, readonly string[]]
  | ['notice', string];

function recordingPainter(): { painter: ProgramPainter; calls: Call[]; reset: () => void } {
  const calls: Call[] = [];
  return {
    calls,
    reset: () => calls.splice(0),
    painter: {
      clear: () => calls.push(['clear']),
      drawVideo: (frame, dest) => calls.push(['video', (frame as FakeFrame).name, dest]),
      drawDivider: (x, w) => calls.push(['divider', x, w]),
      drawCard: (card, lines) => calls.push(['card', card, lines]),
      drawNotice: (text) => calls.push(['notice', text]),
    },
  };
}

class FakeFrame implements VideoFrameLike {
  closed = false;
  constructor(
    public readonly name: string,
    public readonly displayWidth = 1920,
    public readonly displayHeight = 1080,
  ) {}
  close() {
    if (this.closed) throw new Error(`${this.name} closed twice`);
    this.closed = true;
  }
}

const fakeStream = (): MediaStream => ({ id: 'fake' }) as unknown as MediaStream;
const wire = (over: Partial<ProgramFrame> = {}) => toWireFrame({ ...EMPTY_FRAME, ...over });
const FULL = { x: 0, y: 0, w: PROGRAM_WIDTH, h: PROGRAM_HEIGHT };

test('fresh frame → drawn; tick with no new frame → the SAME composite is re-drawn, counter advances', () => {
  const { painter, calls, reset } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', stream: fakeStream() }));
  const a = new FakeFrame('A');
  c.pushVideoFrame('primary', a);

  const t1 = c.tick();
  assert.equal(t1.frameCount, 1);
  assert.equal(t1.repeated, false);
  assert.deepEqual(calls, [['clear'], ['video', 'A', FULL]]);

  reset();
  const t2 = c.tick(); // stall: nothing new arrived
  assert.equal(t2.frameCount, 2, 'the tick must never freeze');
  assert.equal(t2.repeated, true);
  assert.deepEqual(calls, [['clear'], ['video', 'A', FULL]], 'repeat-last-frame re-draws the held picture');
  assert.equal(a.closed, false, 'the held frame stays open while it is the latest');
  assert.deepEqual(c.stats(), { frameCount: 2, repeatedCount: 1 });
});

test('a newer frame replaces and CLOSES the previous one', () => {
  const { painter, calls } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', stream: fakeStream() }));
  const a = new FakeFrame('A');
  const b = new FakeFrame('B');
  c.pushVideoFrame('primary', a);
  c.pushVideoFrame('primary', b);
  assert.equal(a.closed, true);
  assert.equal(b.closed, false);
  c.tick();
  assert.deepEqual(calls.at(-1), ['video', 'B', FULL]);
});

/* ── GUARD 1 at the compositor level ───────────────────────────────────────── */

test('stream → null: the placeholder is drawn and the previous camera\'s frame is CLOSED, not kept', () => {
  const { painter, calls, reset } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', label: 'Aisle', stream: fakeStream() }));
  const a = new FakeFrame('A');
  c.pushVideoFrame('primary', a);
  c.tick();
  reset();

  c.setFrame(wire({ source: 'cam1', label: 'Aisle', stream: null }));
  assert.equal(a.closed, true, 'a null stream must drop the held frame');
  c.tick();
  assert.deepEqual(calls, [['clear'], ['card', 'no-signal', ['Aisle']]]);
  assert.equal(calls.some((k) => k[0] === 'video'), false, 'no stale picture through the placeholder');
});

test('a track swap (resetSlot) drops the old camera\'s picture before the new one arrives', () => {
  const { painter, calls, reset } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', stream: fakeStream() }));
  const a = new FakeFrame('A');
  c.pushVideoFrame('primary', a);
  c.tick();
  reset();

  c.setFrame(wire({ source: 'cam2', stream: fakeStream() })); // the stream is non-null: a different camera
  c.resetSlot('primary');
  assert.equal(a.closed, true);
  c.tick();
  // A video op is planned, but with nothing held the cleared frame stands — black, like a
  // <video> whose srcObject just changed. Never cam1's last picture.
  assert.deepEqual(calls, [['clear']]);
});

/* ── GUARD 3 · EMPTY_FRAME through the compositor: no overlay call ─────────── */

test('EMPTY_FRAME (default state) → exactly clear + the placeholder card; no overlay hook fires by default', () => {
  const { painter, calls } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.tick();
  assert.deepEqual(calls, [['clear'], ['card', 'no-signal', ['Nothing on program yet']]]);
});

test('S2 seam: an installed overlay hook runs AFTER the program picture, with the planned frame', () => {
  const { painter, calls } = recordingPainter();
  const c = new ProgramCompositor(painter);
  const seen: string[] = [];
  c.setOverlayHook((p, frame) => {
    seen.push(frame.label);
    p.drawNotice('hook');
  });
  c.setFrame(wire({ label: 'Reception' }));
  c.tick();
  assert.deepEqual(seen, ['Reception']);
  assert.deepEqual(calls.at(-1), ['notice', 'hook']);
  c.setOverlayHook(null);
  calls.splice(0);
  c.tick();
  assert.equal(calls.some((k) => k[0] === 'notice'), false);
});

/* ── GUARD 4 · split through the compositor, with letterboxing per pane ────── */

test('split: both slots drawn object-contain inside their panes, divider between', () => {
  const { painter, calls } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', stream: fakeStream(), secondaryStream: fakeStream(), splitRatio: 0.5 }));
  c.pushVideoFrame('primary', new FakeFrame('A', 1920, 1080));
  c.pushVideoFrame('secondary', new FakeFrame('B', 1080, 1920));
  c.tick();
  assert.deepEqual(calls, [
    ['clear'],
    ['video', 'A', { x: 0, y: 180, w: 640, h: 360 }],
    ['divider', 640, 2],
    ['video', 'B', { x: 642 + Math.round((638 - 405) / 2), y: 0, w: 405, h: 720 }],
  ]);
});

test('secondaryStream → null drops the secondary frame and the split collapses to full frame', () => {
  const { painter, calls, reset } = recordingPainter();
  const c = new ProgramCompositor(painter);
  c.setFrame(wire({ source: 'cam1', stream: fakeStream(), secondaryStream: fakeStream() }));
  const b = new FakeFrame('B');
  c.pushVideoFrame('primary', new FakeFrame('A'));
  c.pushVideoFrame('secondary', b);
  c.tick();
  reset();
  c.setFrame(wire({ source: 'cam1', stream: fakeStream(), secondaryStream: null }));
  assert.equal(b.closed, true);
  c.tick();
  assert.deepEqual(calls, [['clear'], ['video', 'A', FULL]]);
});

test('dispose closes every held frame exactly once', () => {
  const { painter } = recordingPainter();
  const c = new ProgramCompositor(painter);
  const a = new FakeFrame('A');
  const b = new FakeFrame('B');
  c.pushVideoFrame('primary', a);
  c.pushVideoFrame('secondary', b);
  c.dispose();
  assert.equal(a.closed, true);
  assert.equal(b.closed, true);
  assert.doesNotThrow(() => c.dispose(), 'a second dispose must not double-close');
});
