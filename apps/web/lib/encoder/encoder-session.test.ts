/**
 * S18 · the session's guards.
 *
 * The defect these exist to catch is the one this whole session was written to
 * fix: a pipeline that looks connected and sends nothing. So the tests assert
 * on WHAT REACHED THE FAKE `invoke`, never on internal counters — a counter can
 * be incremented by code that never called anything.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG_WAIT_CAPACITY,
  bufferMedia,
  buildConfigChunk,
  configComplete,
  createEncoderSession,
  toEncodedChunk,
} from './encoder-session';
import { ChunkKind, decodeDecoderConfigPayload, type EncodedChunk } from './ipc-contract';
import { chunkFromBase64 } from './ipc-envelope';
import type { MediaChunkWire } from './program-canvas.worker';

function wire(seq: number, keyframe = false, timestampMicros = seq * 33_333): MediaChunkWire {
  return { keyframe, timestampMicros, seq, data: new Uint8Array([seq & 0xff, 1, 2]).buffer };
}

type Call = { command: string; chunk: EncodedChunk };

/** Indexed access that fails the test rather than the type-checker. */
function at(calls: readonly Call[], index: number): Call {
  const call = calls[index];
  assert.ok(call, `expected a call at index ${index}, saw ${calls.length}`);
  return call;
}

function harness() {
  const calls: Call[] = [];
  const session = createEncoderSession({
    invoke: async (command, args) => {
      if (command === 'encoder_stop') return { bytesReceived: 7, chunksReceived: 3 };
      // `encoder_start` carries a token, not a chunk — only the media commands
      // are recorded, which is what every assertion below is about.
      if (typeof args.chunk !== 'string') return null;
      calls.push({ command, chunk: chunkFromBase64(args.chunk) });
      return null;
    },
    mintToken: async () => 'a-token',
  });
  return { calls, session };
}

/** Both configs, in the order the worker actually emits them. */
async function startAndConfigure(h: ReturnType<typeof harness>) {
  await h.session.start('S89EV-TEST');
  h.session.acceptConfig({
    kind: 'video',
    description: new Uint8Array([1, 2, 3]).buffer,
    codec: 'avc1.42E01F',
    width: 1280,
    height: 720,
  });
  h.session.acceptConfig({
    kind: 'audio',
    description: new Uint8Array([4, 5]).buffer,
    sampleRate: 48_000,
    numberOfChannels: 2,
  });
}

// ── THE GUARD THIS SESSION EXISTS FOR ────────────────────────────────────────
// Media must reach `encoder_push`. A session that accepts media and invokes
// NOTHING is precisely the shipped-and-disconnected state this work fixes, and
// it is invisible to every other assertion in this file.
test('accepted media actually reaches encoder_push', async () => {
  const h = harness();
  await startAndConfigure(h);
  h.session.acceptMedia({ video: [wire(0, true)], audio: [wire(1)] });
  await new Promise((r) => setImmediate(r));

  const pushes = h.calls.filter((c) => c.command === 'encoder_push');
  assert.equal(pushes.length, 2, 'both chunks must be pushed');
  assert.equal(at(pushes, 0).chunk.header.kind, ChunkKind.Video);
  assert.equal(at(pushes, 1).chunk.header.kind, ChunkKind.Audio);
});

// ── MEDIA BEFORE CONFIG ──────────────────────────────────────────────────────
// Rust's tagger counts `media_before_config` because a decoder handed a
// keyframe with no `avcC` produces nothing. Releasing on the FIRST config half
// instead of both is the natural wrong implementation, so the test asserts the
// half-configured state sends nothing at all.
test('media is held until BOTH config halves exist, and the config goes first', async () => {
  const h = harness();
  await h.session.start('S89EV-TEST');

  h.session.acceptMedia({ video: [wire(0, true)], audio: [] });
  await new Promise((r) => setImmediate(r));
  assert.equal(h.calls.length, 0, 'nothing may be sent before any config');

  h.session.acceptConfig({
    kind: 'video',
    description: new Uint8Array([1, 2, 3]).buffer,
    codec: 'avc1.42E01F',
    width: 1280,
    height: 720,
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(h.calls.length, 0, 'the video half alone is not a config');
  assert.equal(h.session.isSending(), false);

  h.session.acceptConfig({
    kind: 'audio',
    description: new Uint8Array([4, 5]).buffer,
    sampleRate: 48_000,
    numberOfChannels: 2,
  });
  await new Promise((r) => setImmediate(r));

  assert.equal(at(h.calls, 0).command, 'encoder_config', 'the config must be the FIRST call');
  assert.equal(at(h.calls, 0).chunk.header.kind, ChunkKind.Config);
  const decoded = decodeDecoderConfigPayload(at(h.calls, 0).chunk);
  assert.deepEqual([...decoded.avcC], [1, 2, 3]);
  assert.deepEqual([...decoded.asc], [4, 5]);
  assert.equal(at(h.calls, 1).command, 'encoder_push', 'the held frame follows the config');
});

// ── THE HELD BUFFER IS BOUNDED ───────────────────────────────────────────────
test('the pre-config buffer drops the OLDEST past capacity, and counts it', () => {
  const buffer: EncodedChunk[] = [];
  const chunk = (seq: number) => toEncodedChunk(wire(seq), 'video');

  assert.equal(bufferMedia(buffer, [chunk(1), chunk(2)], 3), 0);
  assert.equal(buffer.length, 2);

  assert.equal(bufferMedia(buffer, [chunk(3), chunk(4)], 3), 1, 'one over capacity');
  assert.equal(buffer.length, 3);
  // The OLDEST went — the newest frames are the ones worth keeping, because
  // Rust's WireGate refuses everything until a keyframe anyway.
  assert.deepEqual(buffer.map((c) => c.header.seq), [2, 3, 4]);
});

test('an unconfigured session cannot grow without bound', async () => {
  const h = harness();
  await h.session.start('S89EV-TEST');
  for (let i = 0; i < CONFIG_WAIT_CAPACITY + 50; i += 1) {
    h.session.acceptMedia({ video: [wire(i)], audio: [] });
  }
  await startAndConfigure(h);
  await new Promise((r) => setImmediate(r));
  const pushes = h.calls.filter((c) => c.command === 'encoder_push');
  assert.equal(pushes.length, CONFIG_WAIT_CAPACITY, 'capped at capacity, not unbounded');
});

// ── THE WIRE FORMAT ──────────────────────────────────────────────────────────
// `ContractError.keyframe_on_non_video` is a real refusal in the Rust decoder.
// The worker marks every AAC frame `keyframe: true` (they are all independent),
// so passing that flag straight through would make every audio chunk illegal.
test('audio never carries the keyframe flag, whatever the worker marked', () => {
  const audio = toEncodedChunk(wire(4, true), 'audio');
  assert.equal(audio.header.keyframe, false);
  const video = toEncodedChunk(wire(4, true), 'video');
  assert.equal(video.header.keyframe, true, 'video keeps it');
});

test('timestamps survive as microseconds, not milliseconds', () => {
  const chunk = toEncodedChunk(wire(9, false, 1_234_567), 'video');
  assert.equal(chunk.header.tsUs, 1_234_567n);
});

test('configComplete needs both halves', () => {
  assert.equal(configComplete({ avcC: null, asc: null }), false);
  assert.equal(configComplete({ avcC: new Uint8Array([1]), asc: null }), false);
  assert.equal(configComplete({ avcC: null, asc: new Uint8Array([1]) }), false);
  assert.equal(configComplete({ avcC: new Uint8Array([1]), asc: new Uint8Array([2]) }), true);
});

test('the config chunk is stamped 0, not with a media timestamp', () => {
  const chunk = buildConfigChunk({ avcC: new Uint8Array([1]), asc: new Uint8Array([2]) });
  assert.equal(chunk.header.tsUs, 0n);
  assert.equal(chunk.header.kind, ChunkKind.Config);
});

// ── STOP ─────────────────────────────────────────────────────────────────────
test('stop reports both sides and stops sending', async () => {
  const h = harness();
  await startAndConfigure(h);
  h.session.acceptMedia({ video: [wire(0, true)], audio: [] });
  await new Promise((r) => setImmediate(r));

  const outcome = await h.session.stop();
  assert.equal(outcome.bytesReceived, 7);
  assert.equal(outcome.chunksReceived, 3);
  assert.equal(h.session.isSending(), false);

  const before = h.calls.length;
  h.session.acceptMedia({ video: [wire(1)], audio: [] });
  await new Promise((r) => setImmediate(r));
  assert.equal(h.calls.length, before, 'a stopped session sends nothing more');
});
