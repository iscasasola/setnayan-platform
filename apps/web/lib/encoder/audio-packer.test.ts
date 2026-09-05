/**
 * S3 · quanta → AAC packets: eight quanta a packet, planar layout, and timestamps that do not
 * drift over a wedding.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AAC_FRAME_SAMPLES, AUDIO_QUANTUM_FRAMES, AUDIO_SAMPLE_RATE, framesToMicros } from './audio-clock';
import { createAudioPacker, type AudioPacket } from './audio-packer';

const QUANTA_PER_PACKET = AAC_FRAME_SAMPLES / AUDIO_QUANTUM_FRAMES;

/** A quantum whose every sample is `value` on the left and `-value` on the right. */
function quantum(value: number): Float32Array {
  const q = new Float32Array(2 * AUDIO_QUANTUM_FRAMES);
  q.fill(value, 0, AUDIO_QUANTUM_FRAMES);
  q.fill(-value, AUDIO_QUANTUM_FRAMES);
  return q;
}

function collect(quanta: number): AudioPacket[] {
  const out: AudioPacket[] = [];
  const packer = createAudioPacker((p) => out.push(p));
  for (let i = 0; i < quanta; i += 1) packer.push(quantum(i + 1));
  return out;
}

test('a packet is exactly eight quanta — 1024 frames, no split, no leftover', () => {
  assert.equal(QUANTA_PER_PACKET, 8);
  assert.equal(collect(7).length, 0, 'seven quanta is not yet a packet');
  const packets = collect(8);
  assert.equal(packets.length, 1);
  assert.equal(packets[0]?.numberOfFrames, AAC_FRAME_SAMPLES);
  assert.equal(packets[0]?.numberOfChannels, 2);
  assert.equal(packets[0]?.data.length, 2 * AAC_FRAME_SAMPLES);
});

test('the layout is f32-planar — all of channel 0, then all of channel 1, in arrival order', () => {
  const [packet] = collect(8);
  assert.ok(packet);
  for (let q = 0; q < 8; q += 1) {
    const at = q * AUDIO_QUANTUM_FRAMES;
    assert.equal(packet.data[at], q + 1, `left of quantum ${q}`);
    assert.equal(packet.data[AAC_FRAME_SAMPLES + at], -(q + 1), `right of quantum ${q}`);
  }
});

test('timestamps are the exact frame position, and deltas sit within 1 µs of 1024/48000 s', () => {
  const packets = collect(8 * 200);
  assert.equal(packets.length, 200);
  const nominal = (AAC_FRAME_SAMPLES * 1e6) / AUDIO_SAMPLE_RATE; // 21333.3̄ µs
  packets.forEach((p, n) => {
    assert.equal(p.frameIndex, n * AAC_FRAME_SAMPLES);
    assert.equal(p.timestampMicros, framesToMicros(n * AAC_FRAME_SAMPLES), `packet ${n} absolute stamp`);
  });
  for (let n = 1; n < packets.length; n += 1) {
    const delta = (packets[n]?.timestampMicros ?? 0) - (packets[n - 1]?.timestampMicros ?? 0);
    assert.ok(Math.abs(delta - nominal) < 1, `packet ${n} delta ${delta} µs`);
  }
  // The invariant the deltas alone cannot show: no accumulation. Every third packet is exact.
  assert.equal(packets[3]?.timestampMicros, 64_000);
  assert.equal(packets[150]?.timestampMicros, 3_200_000);
});

test('over six hours the last stamp is still exact — a per-packet += would be 337 ms late', () => {
  const packets = 6 * 60 * 60 * (AUDIO_SAMPLE_RATE / AAC_FRAME_SAMPLES);
  const exact = framesToMicros(Math.floor(packets) * AAC_FRAME_SAMPLES);
  let accumulated = 0;
  for (let i = 0; i < Math.floor(packets); i += 1) accumulated += 21_333;
  const driftMs = (exact - accumulated) / 1000;
  assert.equal(Math.floor(packets), 1_012_500);
  assert.ok(driftMs > 330 && driftMs < 345, `a += implementation would be ${driftMs} ms late`);
});

test('a malformed quantum is dropped, not mis-copied — and it is counted', () => {
  const out: AudioPacket[] = [];
  const packer = createAudioPacker((p) => out.push(p));
  packer.push(new Float32Array(2 * AUDIO_QUANTUM_FRAMES - 1));
  packer.push(new Float32Array(0));
  for (let i = 0; i < 8; i += 1) packer.push(quantum(1));
  assert.equal(out.length, 1, 'the two bad quanta must not have shifted the packet');
  assert.deepEqual(packer.stats(), { packets: 1, quanta: 8, dropped: 2 });
  assert.equal(out[0]?.data[0], 1);
});

test('each packet gets a fresh buffer — the next quanta cannot overwrite one already handed out', () => {
  const packets = collect(16);
  assert.equal(packets.length, 2);
  assert.notEqual(packets[0]?.data, packets[1]?.data);
  assert.equal(packets[0]?.data[0], 1, 'packet 0 still holds quantum 1');
  assert.equal(packets[1]?.data[0], 9, 'packet 1 holds quantum 9');
});

test('a packet size that is not a whole number of quanta is refused loudly', () => {
  assert.throws(() => createAudioPacker(() => {}, { framesPerPacket: 1000 }), /whole number/);
});
