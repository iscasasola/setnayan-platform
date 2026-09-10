/**
 * S3 · the master clock — cadence from audio frames, exact PTS, no burst, gap accounting.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AAC_FRAME_SAMPLES,
  AUDIO_QUANTUM_FRAMES,
  AUDIO_SAMPLE_RATE,
  LONG_GAP_TICKS,
  PROGRAM_FPS,
  QUANTA_PER_VIDEO_TICK,
  VIDEO_TICK_FRAMES,
  createAudioMasterClock,
  framesToMicros,
  type ProgramTick,
} from './audio-clock';

/** Feed `n` render quanta, as the tap does, and collect the ticks that fell out. */
function runQuanta(n: number): ProgramTick[] {
  const ticks: ProgramTick[] = [];
  const clock = createAudioMasterClock((t) => ticks.push(t));
  for (let q = 1; q <= n; q += 1) clock.advance(q * AUDIO_QUANTUM_FRAMES);
  return ticks;
}

test('the grid is 1600 frames — 12.5 quanta per tick, NOT the 12.8 the S3 prompt says', () => {
  assert.equal(VIDEO_TICK_FRAMES, 1600);
  assert.equal(AUDIO_SAMPLE_RATE / PROGRAM_FPS, VIDEO_TICK_FRAMES);
  assert.equal(QUANTA_PER_VIDEO_TICK, 12.5);
  assert.notEqual(QUANTA_PER_VIDEO_TICK, 12.8);
  // 12.8 quanta would be 1638.4 frames per picture — 29.3 fps, and a fractional frame count.
  assert.ok(Math.abs(AUDIO_SAMPLE_RATE / (12.8 * AUDIO_QUANTUM_FRAMES) - 29.296875) < 1e-9);
});

test('30 intervals per second of audio, first picture at zero and the 31st stamped at exactly 1 s', () => {
  // One second of audio is 375 quanta (48000 / 128), which lands slots 0…30 — thirty
  // INTERVALS, thirty-one pictures, the last of them exactly on the second.
  const ticks = runQuanta(AUDIO_SAMPLE_RATE / AUDIO_QUANTUM_FRAMES);
  assert.equal(ticks.length, PROGRAM_FPS + 1);
  assert.equal(ticks[0]?.slot, 0);
  assert.equal(ticks[0]?.timestampMicros, 0);
  assert.equal(ticks[0]?.index, 1);
  assert.equal(ticks.at(-1)?.slot, PROGRAM_FPS);
  assert.equal(ticks.at(-1)?.timestampMicros, 1_000_000);
});

test('PTS is the exact frame position, never an accumulated sum — checked out to six hours', () => {
  // Six hours of ticks, by formula. 1600 frames is 33333.3̄ µs, so deltas alternate; the
  // ABSOLUTE stamp is what must stay exact, and a running `+33333` would be 12 seconds late here.
  const sixHoursTicks = 6 * 60 * 60 * PROGRAM_FPS;
  const last = framesToMicros(sixHoursTicks * VIDEO_TICK_FRAMES);
  assert.equal(last, 6 * 60 * 60 * 1_000_000);
  let accumulated = 0;
  for (let i = 0; i < sixHoursTicks; i += 1) accumulated += Math.round(1e6 / PROGRAM_FPS);
  const naiveDriftMs = (last - accumulated) / 1000;
  assert.ok(naiveDriftMs > 200, `naive addition drifts ${naiveDriftMs} ms — a fifth of a second of lip-sync`);
  assert.ok(naiveDriftMs < 220, `pin the number: ${naiveDriftMs} ms`);
});

test('a tick lands on the first quantum at or after its instant — late, never early, never drifting', () => {
  const ticks = runQuanta(40);
  // Slot 1 is due at frame 1600; quantum 13 ends at 1664. Quantum 12 ends at 1536 — too early.
  const slot1 = ticks.find((t) => t.slot === 1);
  assert.ok(slot1, 'slot 1 must fire');
  assert.equal(slot1?.timestampMicros, framesToMicros(VIDEO_TICK_FRAMES));
  for (const t of ticks) assert.equal(t.frameIndex, t.slot * VIDEO_TICK_FRAMES);
});

test('a clump of late quanta fires ONE tick at the latest slot, not a burst of duplicates', () => {
  const ticks: ProgramTick[] = [];
  const clock = createAudioMasterClock((t) => ticks.push(t));
  clock.advance(AUDIO_QUANTUM_FRAMES); // slot 0
  // The audio thread stalls, then delivers a second's worth of frames at once.
  clock.advance(AUDIO_SAMPLE_RATE);
  assert.equal(ticks.length, 2, 'one tick for the stall, not thirty');
  assert.equal(ticks[1]?.slot, 30);
  const s = clock.stats();
  assert.equal(s.ticks, 2);
  assert.equal(s.maxGapTicks, 30);
  assert.equal(s.longGaps, 1);
  assert.ok(s.maxGapAtMs > 999 && s.maxGapAtMs < 1001, `gap ended at ${s.maxGapAtMs} ms`);
});

test('a gap of exactly LONG_GAP_TICKS is not counted long; one wider is', () => {
  const clock = createAudioMasterClock(() => {});
  clock.advance(AUDIO_QUANTUM_FRAMES); // slot 0
  clock.advance(LONG_GAP_TICKS * VIDEO_TICK_FRAMES); // slot 2 — a gap of exactly 2
  assert.equal(clock.stats().longGaps, 0);
  clock.advance((LONG_GAP_TICKS + 3) * VIDEO_TICK_FRAMES); // slot 5 — a gap of 3
  assert.equal(clock.stats().longGaps, 1);
});

test('the clock never runs backwards, and a repeated frame count fires nothing', () => {
  const ticks: ProgramTick[] = [];
  const clock = createAudioMasterClock((t) => ticks.push(t));
  clock.advance(5 * VIDEO_TICK_FRAMES);
  assert.equal(ticks.length, 1);
  clock.advance(5 * VIDEO_TICK_FRAMES); // same count again
  clock.advance(VIDEO_TICK_FRAMES); // a rewind — a replaced worklet restarting its count
  clock.advance(Number.NaN);
  assert.equal(ticks.length, 1, 'no tick may be stamped behind one already sent');
  assert.equal(clock.stats().frames, 5 * VIDEO_TICK_FRAMES);
});

test('a throwing tick does not stop the clock', () => {
  let calls = 0;
  const clock = createAudioMasterClock(() => {
    calls += 1;
    throw new Error('compositor blew up');
  });
  clock.advance(VIDEO_TICK_FRAMES);
  clock.advance(2 * VIDEO_TICK_FRAMES);
  assert.equal(calls, 2);
});

test('framesToMicros rounds the absolute position; an AAC frame is 21333.3̄ µs', () => {
  assert.equal(framesToMicros(0), 0);
  assert.equal(framesToMicros(AAC_FRAME_SAMPLES), 21_333);
  assert.equal(framesToMicros(2 * AAC_FRAME_SAMPLES), 42_667);
  assert.equal(framesToMicros(3 * AAC_FRAME_SAMPLES), 64_000);
  assert.equal(framesToMicros(AUDIO_SAMPLE_RATE), 1_000_000);
});
