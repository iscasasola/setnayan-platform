/**
 * S4 · the pure half of the video encoder: config shape, keyframe cadence, the drift guard,
 * and the config-before-media ordering. `VideoEncoder` itself is only reachable from a real
 * browser — see program-canvas.worker.ts, which is deliberately NOT unit tested (same split as
 * S1/S3: the browser-wiring file is thin and untested, the logic it calls is pure and is).
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  KEYFRAME_INTERVAL_TICKS,
  VIDEO_ENCODER_CONFIG,
  DRIFT_THRESHOLD_MS,
  isKeyframeTick,
  checkDrift,
  createVideoEncodeSink,
  createChunkRing,
  createDriftGuardedRing,
  type RingEntry,
  type VideoChunkLike,
  type VideoChunkMetadataLike,
  drainToWire,
} from './video-encode';

/* ── GUARD: keyframe cadence — sabotage `% 60` → `% 61` must go red ────────────────────── */

test('isKeyframeTick: exactly every 60 ticks, matching the exported constant', () => {
  assert.equal(KEYFRAME_INTERVAL_TICKS, 60);
  const keyframeTicks: number[] = [];
  for (let i = 0; i < 181; i += 1) if (isKeyframeTick(i)) keyframeTicks.push(i);
  assert.deepEqual(keyframeTicks, [0, 60, 120, 180]);
});

/* ── GUARD: bitrateMode removed → red ──────────────────────────────────────────────────── */

test('VIDEO_ENCODER_CONFIG: bitrateMode is constant (CBR, not a file export)', () => {
  assert.equal(VIDEO_ENCODER_CONFIG.bitrateMode, 'constant');
});

/* ── GUARD: framerate missing from config → red ────────────────────────────────────────── */

test('VIDEO_ENCODER_CONFIG: framerate is present and paired with bitrate (Safari 17.4 bug)', () => {
  assert.equal(typeof VIDEO_ENCODER_CONFIG.framerate, 'number');
  assert.ok(VIDEO_ENCODER_CONFIG.framerate! > 0);
  assert.equal(typeof VIDEO_ENCODER_CONFIG.bitrate, 'number');
  assert.ok(VIDEO_ENCODER_CONFIG.bitrate! > 0);
});

test('VIDEO_ENCODER_CONFIG: hardwareAcceleration is prefer-hardware (S0-FINDING — require-hardware throws)', () => {
  assert.equal(VIDEO_ENCODER_CONFIG.hardwareAcceleration, 'prefer-hardware');
});

test('VIDEO_ENCODER_CONFIG: avc format is avc (AVCC, length-prefixed) — contract.rs needs the out-of-band description', () => {
  assert.equal(VIDEO_ENCODER_CONFIG.avc?.format, 'avc');
});

/* ── GUARD: decoderConfig captured before the first chunk is released → sabotage the ordering ── */

function fakeChunk(over: Partial<VideoChunkLike> & { payload?: number[] } = {}): VideoChunkLike {
  const payload = over.payload ?? [1, 2, 3];
  return {
    type: over.type ?? 'key',
    timestamp: over.timestamp ?? 0,
    byteLength: payload.length,
    copyTo(dest) {
      new Uint8Array(dest as ArrayBuffer).set(payload);
    },
  };
}

test('config-before-media: onConfig fires before onChunk for the first chunk that carries a description', () => {
  const order: string[] = [];
  const configs: ArrayBuffer[] = [];
  const chunks: RingEntry[] = [];
  const sink = createVideoEncodeSink({
    onConfig: (d) => {
      order.push('config');
      configs.push(d);
    },
    onChunk: (e) => {
      order.push('chunk');
      chunks.push(e);
    },
  });

  const description = new Uint8Array([9, 9, 9]).buffer;
  const metadata: VideoChunkMetadataLike = { decoderConfig: { description } };
  sink.handle(fakeChunk({ type: 'key', timestamp: 0 }), metadata);
  sink.handle(fakeChunk({ type: 'delta', timestamp: 33_333 }), undefined);

  assert.deepEqual(order, ['config', 'chunk', 'chunk'], 'config must precede the chunk it arrived on');
  assert.equal(configs.length, 1, 'config is captured exactly once');
  assert.equal(chunks.length, 2);
  assert.equal(sink.stats().configCaptured, true);
  assert.equal(sink.stats().chunks, 2);
  assert.equal(sink.stats().keyframes, 1);
});

test('config-before-media: a second description (should not happen, but if it did) never re-fires onConfig', () => {
  let configCalls = 0;
  const sink = createVideoEncodeSink({
    onConfig: () => {
      configCalls += 1;
    },
    onChunk: () => {},
  });
  const description = new Uint8Array([1]).buffer;
  sink.handle(fakeChunk({ type: 'key' }), { decoderConfig: { description } });
  sink.handle(fakeChunk({ type: 'key' }), { decoderConfig: { description } });
  assert.equal(configCalls, 1);
});

/* ── the drift guard ────────────────────────────────────────────────────────────────────── */

test('checkDrift: null in sync, event past the threshold, and the threshold is exactly 100ms', () => {
  assert.equal(DRIFT_THRESHOLD_MS, 100);
  assert.equal(checkDrift(0, 0), null);
  assert.equal(checkDrift(50_000, 0), null, '50ms is within the guard');
  assert.equal(checkDrift(100_000, 0), null, 'exactly 100ms is within the guard (> not >=)');
  const event = checkDrift(150_000, 0);
  assert.ok(event);
  assert.equal(event?.type, 'drift');
  assert.equal(event?.deltaMs, 150);
});

test('drift-guarded ring: an out-of-sync chunk is dropped (never re-timestamped) and reported once', () => {
  const ring = createChunkRing(4);
  const driftEvents: unknown[] = [];
  const guarded = createDriftGuardedRing(ring, (e) => driftEvents.push(e));

  const inSync: RingEntry = { keyframe: true, timestampMicros: 33_000, seq: 0, data: new Uint8Array([1]) };
  const outOfSync: RingEntry = { keyframe: false, timestampMicros: 500_000, seq: 1, data: new Uint8Array([2]) };

  guarded.push(inSync, 32_500);
  guarded.push(outOfSync, 33_000); // |500000 - 33000| / 1000 = 467ms > 100ms

  assert.equal(driftEvents.length, 1);
  assert.equal(guarded.stats().driftEvents, 1);
  assert.equal(guarded.stats().droppedForDrift, 1);
  const drained = ring.drain();
  assert.equal(drained.length, 1, 'only the in-sync chunk reached the ring');
  assert.equal(drained[0]?.seq, 0);
  // The dropped chunk's timestamp is untouched anywhere in this module — there is no
  // re-timestamping code path to sabotage, which is the guard: nothing here ever writes
  // to `entry.timestampMicros`.
});

/* ── the bounded ring, on its own ───────────────────────────────────────────────────────── */

test('ring: bounded, drops oldest on overflow, counts pushed and dropped', () => {
  const ring = createChunkRing(2);
  const e = (seq: number): RingEntry => ({ keyframe: false, timestampMicros: seq, seq, data: new Uint8Array() });
  ring.push(e(0));
  ring.push(e(1));
  ring.push(e(2));
  assert.deepEqual(
    ring.drain().map((x) => x.seq),
    [1, 2],
  );
  assert.deepEqual(ring.stats(), { size: 0, capacity: 2, pushed: 3, dropped: 1 });
});

test('ring: rejects a non-positive-integer capacity', () => {
  assert.throws(() => createChunkRing(0));
  assert.throws(() => createChunkRing(-1));
  assert.throws(() => createChunkRing(1.5));
});

/* ── S18 · the drain to the page ───────────────────────────────────────────── */

function entry(seq: number, keyframe = false): RingEntry {
  return {
    keyframe,
    timestampMicros: seq * 33_333,
    seq,
    data: new Uint8Array([seq & 0xff, 7, 7]),
  };
}

// THE GUARD THIS SESSION EXISTS FOR, at the worker's end. Before S18 the video
// ring's `drain()` had callers only in tests and the encoded programme went
// nowhere. A drain that reports "nothing to send" while the rings are full is
// that same defect wearing a different hat.
test('a full ring is drained, not merely inspected', () => {
  const video = createChunkRing(10);
  video.push(entry(1, true));
  video.push(entry(2));
  const audio = createChunkRing(10);
  audio.push(entry(3));

  const first = drainToWire(video, audio);
  assert.ok(first, 'chunks are waiting, so there is something to send');
  assert.deepEqual(first.video.map((c) => c.seq), [1, 2]);
  assert.deepEqual(first.audio.map((c) => c.seq), [3]);

  // Emptied — a second flush on a quiet tick must not re-send the same frames.
  assert.equal(drainToWire(video, audio), null);
});

test('a quiet tick sends nothing at all', () => {
  assert.equal(drainToWire(createChunkRing(4), createChunkRing(4)), null);
});

// Leaving a buffer out of the transfer list does not fail — it structured-clones
// instead, silently, thirty times a second. Only a count can catch it.
test('every buffer reaches the transfer list', () => {
  const video = createChunkRing(10);
  video.push(entry(1, true));
  video.push(entry(2));
  const audio = createChunkRing(10);
  audio.push(entry(3));
  audio.push(entry(4));

  const drained = drainToWire(video, audio);
  assert.ok(drained);
  assert.equal(drained.transfer.length, 4, 'one per chunk, video and audio alike');
  for (const chunk of [...drained.video, ...drained.audio]) {
    assert.ok(drained.transfer.includes(chunk.data), `chunk ${chunk.seq} was not transferred`);
  }
});

test('the keyframe flag and timestamp survive the crossing', () => {
  const video = createChunkRing(4);
  video.push(entry(9, true));
  const drained = drainToWire(video, createChunkRing(4));
  assert.ok(drained);
  const first = drained.video[0];
  assert.ok(first);
  assert.equal(first.keyframe, true);
  assert.equal(first.timestampMicros, 9 * 33_333);
});
