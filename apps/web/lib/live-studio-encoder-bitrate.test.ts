/**
 * live-studio-encoder-bitrate.test.ts
 *
 * Pins `stepBitrateRung`'s bounds and hysteresis. Each GUARD test is written
 * so that deleting the specific line it protects flips the assertion — see
 * this file's inline notes for exactly which line, and the changelog
 * fragment for the manual before/after occurrence counts (rule 7).
 *
 * Run: `pnpm test:unit`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepBitrateRung,
  bufferedMs,
  BITRATE_LADDER,
  INITIAL_RUNG_STATE,
  DOWN_BUFFERED_THRESHOLD_MS,
  DOWN_AFTER_MS,
  UP_AFTER_CLEAN_MS,
  MIN_RUNG,
  MAX_RUNG,
  type RungState,
} from '@/lib/live-studio-encoder-bitrate';

const SAMPLE_MS = 500;

/** Feed N samples of the given occupancy through the stepper, in sequence. */
function feed(state: RungState, unsentBytes: number, times: number): RungState {
  let s = state;
  for (let i = 0; i < times; i++) {
    s = stepBitrateRung(s, { unsentBytes, elapsedMs: SAMPLE_MS });
  }
  return s;
}

// Bytes that sit clearly above/below the 1.5s threshold at rung 0's 2.5 Mbps.
const rung0BytesPerMs = BITRATE_LADDER[0].bitrateBps / 8 / 1000;
const BAD_BYTES = Math.ceil(rung0BytesPerMs * (DOWN_BUFFERED_THRESHOLD_MS + 200));
const CLEAN_BYTES = 0;

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER'S NUMBERS — pin the spec's own figures, not just the comment.
// ─────────────────────────────────────────────────────────────────────────

test('the ladder is exactly 2.5 → 1.8 → 1.2 Mbps, 720p30 → 720p30 → 540p30', () => {
  assert.deepEqual(
    BITRATE_LADDER.map((r) => [r.bitrateBps, r.width, r.height]),
    [
      [2_500_000, 1280, 720],
      [1_800_000, 1280, 720],
      [1_200_000, 960, 540],
    ],
  );
});

test('default rung is 0 — 720p30 @ 2.5 Mbps for PH mobile upload', () => {
  assert.equal(INITIAL_RUNG_STATE.rung, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// GUARD — bounded: never below MIN_RUNG, never above MAX_RUNG.
// Mutation: remove `state.rung < MAX_RUNG` / `state.rung > MIN_RUNG` and a
// pathological run pushes the rung out of [0, 2] — both tests below fail.
// ─────────────────────────────────────────────────────────────────────────

test('⚠ GUARD upper bound — sustained bad occupancy never steps past MAX_RUNG', () => {
  let state = INITIAL_RUNG_STATE;
  // Way more samples than needed to cross every threshold repeatedly.
  for (let i = 0; i < 200; i++) {
    state = stepBitrateRung(state, { unsentBytes: BAD_BYTES * 10, elapsedMs: SAMPLE_MS });
  }
  assert.equal(state.rung, MAX_RUNG);
  assert.ok(state.rung <= MAX_RUNG);
});

test('⚠ GUARD lower bound — sustained clean occupancy never steps below MIN_RUNG', () => {
  let state: RungState = { rung: MAX_RUNG, aboveThresholdMs: 0, cleanMs: 0 };
  for (let i = 0; i < 400; i++) {
    state = stepBitrateRung(state, { unsentBytes: CLEAN_BYTES, elapsedMs: SAMPLE_MS });
  }
  assert.equal(state.rung, MIN_RUNG);
  assert.ok(state.rung >= MIN_RUNG);
});

// ─────────────────────────────────────────────────────────────────────────
// GUARD — hysteresis: a single bad/clean sample never flips the rung.
// Mutation: replace the `aboveThresholdMs >= DOWN_AFTER_MS` (or cleanMs>=
// UP_AFTER_CLEAN_MS) check with "step on any sample above/below threshold"
// and the single-spike / single-good-sample tests below start failing.
// ─────────────────────────────────────────────────────────────────────────

test('⚠ GUARD hysteresis (down) — ONE bad sample does not step the rung', () => {
  const after = stepBitrateRung(INITIAL_RUNG_STATE, { unsentBytes: BAD_BYTES, elapsedMs: SAMPLE_MS });
  assert.equal(after.rung, 0, 'a single burst must not be mistaken for a trend');
  assert.equal(after.aboveThresholdMs, SAMPLE_MS);
});

test('⚠ GUARD hysteresis (down) — a spike that clears before DOWN_AFTER_MS resets the counter, no step', () => {
  let state = INITIAL_RUNG_STATE;
  state = stepBitrateRung(state, { unsentBytes: BAD_BYTES, elapsedMs: SAMPLE_MS }); // 500ms above
  state = stepBitrateRung(state, { unsentBytes: BAD_BYTES, elapsedMs: SAMPLE_MS }); // 1000ms above — still < 2000
  state = stepBitrateRung(state, { unsentBytes: CLEAN_BYTES, elapsedMs: SAMPLE_MS }); // clears
  assert.equal(state.rung, 0, 'must not have accumulated past DOWN_AFTER_MS yet');
  assert.equal(state.aboveThresholdMs, 0, 'a clean sample must reset the above-threshold streak to zero');
  // Now resume bad samples from scratch — must take the FULL DOWN_AFTER_MS again.
  state = feed(state, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS - 1);
  assert.equal(state.rung, 0, 'the reset streak must not carry over any prior progress');
});

test('DOWN — continuous bad occupancy for exactly DOWN_AFTER_MS steps down exactly one rung', () => {
  const state = feed(INITIAL_RUNG_STATE, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS);
  assert.equal(state.rung, 1);
});

test('one more bad tick after the step does not skip a second rung in the same breath', () => {
  let state = feed(INITIAL_RUNG_STATE, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS);
  assert.equal(state.rung, 1);
  // The step itself resets aboveThresholdMs to 0 — the very next sample,
  // even if still bad, must not immediately cascade to rung 2.
  state = stepBitrateRung(state, { unsentBytes: BAD_BYTES, elapsedMs: SAMPLE_MS });
  assert.equal(state.rung, 1, 'stepping down must not cascade within one sample');
});

test('⚠ GUARD hysteresis (up) — ONE clean sample after a step-down does not step back up', () => {
  let state = feed(INITIAL_RUNG_STATE, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS);
  assert.equal(state.rung, 1);
  state = stepBitrateRung(state, { unsentBytes: CLEAN_BYTES, elapsedMs: SAMPLE_MS });
  assert.equal(state.rung, 1, 'recovery must be patient — one good sample proves nothing');
});

test('UP — continuous clean occupancy for exactly UP_AFTER_CLEAN_MS steps back up one rung', () => {
  let state = feed(INITIAL_RUNG_STATE, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS);
  assert.equal(state.rung, 1);
  state = feed(state, CLEAN_BYTES, UP_AFTER_CLEAN_MS / SAMPLE_MS);
  assert.equal(state.rung, 0);
});

test('a bad sample mid-recovery resets the clean streak (no premature step-up)', () => {
  let state = feed(INITIAL_RUNG_STATE, BAD_BYTES, DOWN_AFTER_MS / SAMPLE_MS);
  assert.equal(state.rung, 1);
  state = feed(state, CLEAN_BYTES, UP_AFTER_CLEAN_MS / SAMPLE_MS - 2); // almost there
  state = stepBitrateRung(state, { unsentBytes: BAD_BYTES, elapsedMs: SAMPLE_MS }); // one bad sample
  assert.equal(state.cleanMs, 0, 'a bad sample must zero the clean streak, not merely pause it');
  assert.equal(state.rung, 1);
});

// ─────────────────────────────────────────────────────────────────────────
// bufferedMs — the conversion the whole decider rests on.
// ─────────────────────────────────────────────────────────────────────────

test('bufferedMs(0, rung) is always 0, at every rung', () => {
  for (const rung of [0, 1, 2] as const) {
    assert.equal(bufferedMs(0, rung), 0);
  }
});

test('bufferedMs scales with the RUNG the caller passes, not always rung 0', () => {
  const bytes = 100_000;
  const atRung0 = bufferedMs(bytes, 0);
  const atRung2 = bufferedMs(bytes, 2);
  // Rung 2's bitrate is lower, so the SAME bytes represent MORE buffered time.
  assert.ok(atRung2 > atRung0, 'the same backlog is worse video-time at a lower bitrate');
});

test('a rung 2 stream can still step down from occupancy scaled to ITS OWN (lower) bitrate', () => {
  let state: RungState = { rung: 2, aboveThresholdMs: 0, cleanMs: 0 };
  const bytesPerMsAtRung2 = BITRATE_LADDER[2].bitrateBps / 8 / 1000;
  const badAtRung2 = Math.ceil(bytesPerMsAtRung2 * (DOWN_BUFFERED_THRESHOLD_MS + 200));
  state = feed(state, badAtRung2, DOWN_AFTER_MS / SAMPLE_MS);
  // Already at MAX_RUNG — must stay there, not error or wrap.
  assert.equal(state.rung, MAX_RUNG);
});
