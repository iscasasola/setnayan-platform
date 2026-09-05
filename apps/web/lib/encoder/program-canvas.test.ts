/**
 * S1 · the page-side controller against a fake worker and a fake bridge.
 *
 * Pins the contract between the page and program-canvas.worker.ts: what crosses, when,
 * and what is transferred. `window` is synthesized for the same-window bridge resolver.
 *
 * Run: `pnpm test:unit`.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EMPTY_FRAME,
  installProgramBridge,
  resolveLocalProgramBridge,
  type ProgramFrame,
} from '../panood-program-bridge';
import {
  BRIDGE_REPOLL_MS,
  chooseTrackTransport,
  createProgramCanvas,
  type ProgramWorkerLike,
} from './program-canvas';
import type { ProgramCanvasInbound, ProgramCanvasOutbound } from './program-canvas.worker';

type Posted = { message: ProgramCanvasInbound; transfer: Transferable[] | undefined };

function fakeWorker() {
  const posted: Posted[] = [];
  const listeners: Array<(ev: { data: ProgramCanvasOutbound }) => void> = [];
  let terminated = false;
  const worker: ProgramWorkerLike = {
    postMessage: (message, transfer) => posted.push({ message, transfer }),
    addEventListener: (_t, fn) => listeners.push(fn),
    terminate: () => {
      terminated = true;
    },
  };
  return {
    worker,
    posted,
    emit: (data: ProgramCanvasOutbound) => listeners.forEach((fn) => fn({ data })),
    isTerminated: () => terminated,
  };
}

function fakeTrack(name: string) {
  const stopped: string[] = [];
  const track = {
    name,
    kind: 'video',
    clone() {
      return { ...track, name: `${name}-clone`, stop: () => stopped.push(`${name}-clone`) };
    },
    stop: () => stopped.push(name),
  };
  return { track, stopped };
}

function fakeStream(name: string) {
  const { track, stopped } = fakeTrack(name);
  const stream = { id: name, getVideoTracks: () => [track] } as unknown as MediaStream;
  return { stream, stopped };
}

/** A `MediaStreamTrackProcessor` stand-in that records which track it wrapped. */
function fakeProcessor() {
  const wrapped: string[] = [];
  class Processor {
    readable: ReadableStream<VideoFrame>;
    constructor(init: { track: MediaStreamTrack }) {
      wrapped.push((init.track as unknown as { name: string }).name);
      this.readable = { tag: `readable:${wrapped.at(-1)}` } as unknown as ReadableStream<VideoFrame>;
    }
  }
  return { Processor, wrapped };
}

function fakeIntervals() {
  const fns = new Map<number, () => void>();
  let seq = 0;
  return {
    setInterval: (fn: () => void, _ms: number) => {
      fns.set(++seq, fn);
      return seq;
    },
    clearInterval: (h: unknown) => {
      fns.delete(h as number);
    },
    fire: () => fns.forEach((fn) => fn()),
    count: () => fns.size,
  };
}

const frameWith = (over: Partial<ProgramFrame> = {}): ProgramFrame => ({ ...EMPTY_FRAME, ...over });

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { opener: null };
});

test('chooseTrackTransport: readable when the page has the processor, else the track itself', () => {
  assert.equal(chooseTrackTransport(true), 'readable');
  assert.equal(chooseTrackTransport(false), 'track');
});

test('resolveLocalProgramBridge reads THIS window, not the opener', () => {
  assert.equal(resolveLocalProgramBridge(), 'no-bridge');
  const host = installProgramBridge();
  const resolved = resolveLocalProgramBridge();
  assert.notEqual(typeof resolved, 'string');
  host.dispose();
  assert.equal(resolveLocalProgramBridge(), 'no-bridge');
});

test('start: air + start go first, then the bridge\'s current frame as wire, then the tracks', () => {
  const host = installProgramBridge(frameWith({ label: 'Before' }));
  const w = fakeWorker();
  const iv = fakeIntervals();
  const canvas = createProgramCanvas({
    air: { enforced: true, permittedSlots: ['cam1'] },
    deps: { createWorker: () => w.worker, trackProcessor: null, ...iv },
  });
  canvas.start();
  assert.deepEqual(
    w.posted.map((p) => p.message.type),
    ['air', 'start', 'frame'],
  );
  assert.deepEqual(w.posted[0]?.message, { type: 'air', air: { enforced: true, permittedSlots: ['cam1'] } });
  assert.deepEqual(w.posted[2]?.message, {
    type: 'frame',
    frame: {
      source: null,
      requestedSource: null,
      label: 'Before',
      live: false,
      hasStream: false,
      hasSecondaryStream: false,
      splitRatio: 0.5,
    },
  });
  assert.equal(iv.count(), 1, 'the re-poll timer is armed');
  canvas.stop();
  host.dispose();
});

test('a published frame is forwarded as wire; a NEW stream sends a transferred readable (Chromium path)', () => {
  const host = installProgramBridge();
  const w = fakeWorker();
  const proc = fakeProcessor();
  const canvas = createProgramCanvas({
    deps: { createWorker: () => w.worker, trackProcessor: proc.Processor, ...fakeIntervals() },
  });
  canvas.start();
  w.posted.splice(0);

  const cam1 = fakeStream('cam1');
  host.publish(frameWith({ source: 'cam1', stream: cam1.stream }));
  assert.deepEqual(
    w.posted.map((p) => p.message.type),
    ['frame', 'track'],
  );
  const track = w.posted[1]!;
  assert.equal((track.message as { slot: string }).slot, 'primary');
  assert.deepEqual(proc.wrapped, ['cam1-clone'], 'the processor wraps a CLONE, never the monitor\'s track');
  assert.deepEqual(track.transfer, [(track.message as { readable: unknown }).readable], 'the readable is transferred');

  // Same stream object again → the frame goes, the track does NOT go again.
  w.posted.splice(0);
  host.publish(frameWith({ source: 'cam1', stream: cam1.stream, label: 'renamed' }));
  assert.deepEqual(
    w.posted.map((p) => p.message.type),
    ['frame'],
  );

  // Stream → null: the slot is cleared and our clone is stopped.
  w.posted.splice(0);
  host.publish(frameWith({ source: 'cam1', stream: null }));
  assert.deepEqual(w.posted[1]?.message, { type: 'track', slot: 'primary', readable: null });
  assert.deepEqual(cam1.stopped, ['cam1-clone']);

  canvas.stop();
  host.dispose();
});

test('WebKit path: no page processor → the cloned TRACK is transferred for the worker to wrap', () => {
  const host = installProgramBridge();
  const w = fakeWorker();
  const canvas = createProgramCanvas({
    deps: { createWorker: () => w.worker, trackProcessor: null, ...fakeIntervals() },
  });
  canvas.start();
  w.posted.splice(0);
  const cam = fakeStream('cam1');
  host.publish(frameWith({ source: 'cam1', stream: cam.stream }));
  const msg = w.posted[1]!.message as unknown as { type: 'track'; slot: string; track: { name: string } };
  assert.equal(msg.type, 'track');
  assert.equal(msg.track.name, 'cam1-clone');
  assert.deepEqual(w.posted[1]!.transfer, [msg.track]);
  canvas.stop();
  host.dispose();
});

test('secondaryStream travels on its own slot', () => {
  const host = installProgramBridge();
  const w = fakeWorker();
  const proc = fakeProcessor();
  const canvas = createProgramCanvas({
    deps: { createWorker: () => w.worker, trackProcessor: proc.Processor, ...fakeIntervals() },
  });
  canvas.start();
  w.posted.splice(0);
  host.publish(
    frameWith({ source: 'cam1', stream: fakeStream('cam1').stream, secondaryStream: fakeStream('cam2').stream }),
  );
  assert.deepEqual(
    w.posted.map((p) => [p.message.type, (p.message as { slot?: string }).slot]),
    [
      ['frame', undefined],
      ['track', 'primary'],
      ['track', 'secondary'],
    ],
  );
  assert.deepEqual(proc.wrapped, ['cam1-clone', 'cam2-clone']);
  canvas.stop();
  host.dispose();
});

test('re-resolve, never latch: a remounted controller\'s NEW bridge is attached on the next poll', () => {
  const first = installProgramBridge(frameWith({ label: 'first' }));
  const w = fakeWorker();
  const iv = fakeIntervals();
  const canvas = createProgramCanvas({
    deps: { createWorker: () => w.worker, trackProcessor: null, ...iv },
  });
  canvas.start();
  w.posted.splice(0);

  // Console reloads: old bridge disposed, a new one installed over the same key.
  first.dispose();
  iv.fire(); // no bridge yet → nothing posted, worker keeps ticking on its last frame
  assert.equal(w.posted.length, 0);
  const second = installProgramBridge(frameWith({ label: 'second' }));
  iv.fire();
  assert.deepEqual(w.posted.map((p) => p.message.type), ['frame']);
  assert.equal((w.posted[0]!.message as { frame: { label: string } }).frame.label, 'second');

  // And the old bridge's publishes no longer reach the worker.
  w.posted.splice(0);
  first.publish(frameWith({ label: 'ghost' }));
  assert.equal(w.posted.length, 0);
  second.publish(frameWith({ label: 'live' }));
  assert.equal(w.posted.length, 1);

  canvas.stop();
  second.dispose();
  assert.equal(BRIDGE_REPOLL_MS, 2_000);
});

test('onFrameCount fans out the worker\'s stats; onError its errors; stop unsubscribes, clears, terminates', () => {
  const host = installProgramBridge();
  const w = fakeWorker();
  const iv = fakeIntervals();
  const canvas = createProgramCanvas({
    deps: { createWorker: () => w.worker, trackProcessor: null, ...iv },
  });
  const seen: number[] = [];
  const errors: string[] = [];
  canvas.onFrameCount((s) => seen.push(s.frameCount));
  canvas.onError((where) => errors.push(where));
  canvas.start();
  w.emit({ type: 'ready' });
  w.emit({
    type: 'stats',
    stats: {
      frameCount: 30,
      repeatedCount: 1,
      maxGapTicks: 1,
      maxGapMs: 34,
      maxGapAtMs: 500,
      longGaps: 0,
      elapsedMs: 1000,
      audioQuanta: 375,
      audioPackets: 46,
      audioChunks: 46,
      audioMs: 1000,
      maxAvSkewMs: 21.3,
      maxWallDriftMs: 4,
      ascReady: true,
      videoChunks: 30,
      videoKeyframes: 1,
      avccReady: true,
      videoDriftEvents: 0,
      videoDriftDrops: 0,
      videoRingDrops: 0,
      videoBytes: 93_750,
      videoAvgKbps: 750,
    },
  });
  w.emit({ type: 'error', where: 'read:primary', message: 'x' });
  assert.deepEqual(seen, [30]);
  assert.deepEqual(errors, ['read:primary']);

  w.posted.splice(0);
  canvas.stop();
  assert.deepEqual(w.posted.map((p) => p.message.type), ['stop']);
  assert.equal(w.isTerminated(), true);
  assert.equal(iv.count(), 0, 're-poll timer cleared');
  host.publish(frameWith({ label: 'after stop' }));
  assert.equal(w.posted.length, 1, 'no forwarding after stop');
  host.dispose();
});

/* ── the strings are shared, not copied ────────────────────────────────────── */

test('program-surface.tsx draws the shared strings and carries no literal of its own', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'app', 'panood', 'program', '[eventId]', 'program-surface.tsx'),
    'utf8',
  );
  assert.match(src, /from '@\/lib\/encoder\/program-strings'/);
  assert.doesNotMatch(src, /Unlock to broadcast all your cameras/);
  assert.doesNotMatch(src, /switching cameras needs the Live Studio unlock/);
  assert.match(src, /\{WITHHELD_CARD\.title\}/);
  assert.match(src, /\{pinnedChannelNotice\(label\)\}/);
});

/* ── the module stays free of Tauri gating (S5 owns it) ────────────────────── */

test('lib/encoder carries no window.__TAURI__ gate — that is the call site\'s (S5) job', () => {
  for (const f of [
    'program-canvas.ts',
    'program-canvas.worker.ts',
    'program-compositor.ts',
    'program-plan.ts',
    'audio-clock.ts',
    'audio-mixer.ts',
    'audio-packer.ts',
    'audio-tap.worklet.ts',
  ]) {
    const src = readFileSync(join(__dirname, f), 'utf8');
    assert.doesNotMatch(src, /__TAURI__/, `${f} must not gate on Tauri`);
  }
});
