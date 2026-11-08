/**
 * lib/venue-check.test.ts — the venue connection check judges with the encoder's own numbers.
 *
 * Each test was checked RED by breaking the rule it guards (a threshold retyped, the ladder
 * replay removed, the sample cap dropped) before it was trusted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROBE_CHUNK_BYTES,
  PROBE_MAX_BYTES,
  PROBE_RUN_MS,
  PROBE_SLOT_MS,
  PROBE_URL_TTL_SECONDS,
  PROBE_SWEEP_AFTER_MS,
  STREAM_FULL_BPS,
  STREAM_LOWEST_BPS,
  MAX_SAMPLES,
  cleanPlaceName,
  cleanSamples,
  judgeVenue,
  probeKey,
  PROBE_PREFIX,
  verdictLine,
  type ProbeSample,
} from './venue-check';
import { AUDIO_BITRATE, VIDEO_BITRATE } from './encoder/video-encode';
import { BITRATE_LADDER, MAX_RUNG } from './live-studio-encoder-bitrate';

/** A run where every second uploads at `bps`. */
function steady(bps: number, seconds = PROBE_RUN_MS / PROBE_SLOT_MS): ProbeSample[] {
  const ms = Math.round((PROBE_CHUNK_BYTES * 8 * 1_000) / bps);
  return Array.from({ length: seconds }, () => ({ bytes: PROBE_CHUNK_BYTES, ms }));
}

test('the stream it judges against is the encoder’s, not a typed number', () => {
  assert.equal(STREAM_FULL_BPS, VIDEO_BITRATE + AUDIO_BITRATE);
  assert.equal(STREAM_LOWEST_BPS, BITRATE_LADDER[MAX_RUNG].bitrateBps + AUDIO_BITRATE);
  // The ladder's top rung and the encoder config are two declarations of one number.
  assert.equal(BITRATE_LADDER[0].bitrateBps, VIDEO_BITRATE, 'ladder rung 0 drifted from VIDEO_BITRATE');
  // One chunk is one second of the full stream.
  assert.equal(PROBE_CHUNK_BYTES, Math.round(STREAM_FULL_BPS / 8));
});

test('a run is small: at most one chunk per second of the run', () => {
  assert.equal(PROBE_MAX_BYTES, PROBE_CHUNK_BYTES * (PROBE_RUN_MS / PROBE_SLOT_MS));
  assert.ok(PROBE_MAX_BYTES < 10_000_000, `${PROBE_MAX_BYTES} bytes is not a small test`);
});

test('the URL outlives the run, and the sweep waits well past the URL', () => {
  assert.ok(PROBE_URL_TTL_SECONDS * 1_000 > PROBE_RUN_MS * 2);
  assert.ok(PROBE_SWEEP_AFTER_MS > PROBE_URL_TTL_SECONDS * 1_000 * 2);
});

test('a fast, steady venue is GREEN', () => {
  const j = judgeVenue(steady(20_000_000));
  assert.equal(j.verdict, 'full');
  assert.equal(j.worstRung, 0);
});

test('a venue just under the full stream steps down: YELLOW, not green', () => {
  const j = judgeVenue(steady(STREAM_FULL_BPS * 0.8));
  assert.equal(j.verdict, 'reduced');
  assert.ok(j.worstRung > 0);
});

test('one bad second is a burst, not a step — the encoder’s hysteresis is honoured', () => {
  const run = steady(20_000_000);
  // One second with nothing moving at all, then fast again.
  run[10] = { bytes: 0, ms: PROBE_SLOT_MS };
  assert.equal(judgeVenue(run).verdict, 'full');
});

test('a long stall mid-run steps the stream down: YELLOW', () => {
  const run = steady(20_000_000);
  // A 5-second hole: one PUT that moved nothing for five seconds.
  run[10] = { bytes: 0, ms: 5_000 };
  const j = judgeVenue(run);
  assert.equal(j.verdict, 'reduced');
  assert.equal(j.slowestBps, 0);
});

test('below the lowest rung on average is RED', () => {
  const j = judgeVenue(steady(STREAM_LOWEST_BPS * 0.7));
  assert.equal(j.verdict, 'not_enough');
  assert.match(verdictLine(j), /hotspot/);
});

test('nothing moved: there is no verdict, never a made-up red', () => {
  const j = judgeVenue([{ bytes: 0, ms: 1_000 }, { bytes: 0, ms: 1_000 }]);
  assert.equal(j.verdict, null);
  assert.equal(judgeVenue([]).verdict, null);
});

test('the average is bytes over the time spent sending them', () => {
  const j = judgeVenue([
    { bytes: PROBE_CHUNK_BYTES, ms: 500 },
    { bytes: PROBE_CHUNK_BYTES, ms: 1_500 },
  ]);
  assert.equal(Math.round(j.averageBps), Math.round((2 * PROBE_CHUNK_BYTES * 8 * 1_000) / 2_000));
  assert.equal(Math.round(j.slowestBps), Math.round((PROBE_CHUNK_BYTES * 8 * 1_000) / 1_500));
});

test('the server does not take the phone’s word for impossible samples', () => {
  const cleaned = cleanSamples([
    { bytes: PROBE_CHUNK_BYTES * 50, ms: 10 }, // more than a chunk — capped
    { bytes: -5, ms: 100 },
    { bytes: 100, ms: 0 },
    { bytes: Number.NaN, ms: 100 },
    'nonsense',
    null,
  ]);
  assert.deepEqual(cleaned, [{ bytes: PROBE_CHUNK_BYTES, ms: 10 }]);
  const tooMany = Array.from({ length: MAX_SAMPLES + 50 }, () => ({ bytes: 1, ms: 1 }));
  assert.equal(cleanSamples(tooMany).length, MAX_SAMPLES);
  assert.deepEqual(cleanSamples('x'), []);
});

test('place names are trimmed and short', () => {
  assert.equal(cleanPlaceName('  Function   hall  '), 'Function hall');
  assert.equal(cleanPlaceName(''), null);
  assert.equal(cleanPlaceName(42), null);
  assert.equal(cleanPlaceName('x'.repeat(300))?.length, 80);
});

test('every test upload lives under one folder the sweep reads', () => {
  const key = probeKey('e', 'c');
  assert.ok(key.startsWith(PROBE_PREFIX));
  assert.equal(key, 'venue-check/e/c.bin');
});
