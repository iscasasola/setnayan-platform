/**
 * Auto-Recap FFmpeg argv builder invariants (Node built-in test runner via tsx —
 * `pnpm test:unit`). Pure builder, so no box/ffmpeg needed: we assert the argv
 * shape the Oracle worker will spawn.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAutoRecapFfmpegArgs,
  RECAP_MAX_DURATION_MS,
  type RecapRenderSpec,
} from './recap-ffmpeg';

function spec(overrides: Partial<RecapRenderSpec> = {}): RecapRenderSpec {
  return {
    slots: [
      { inputPath: '/tmp/a.jpg', type: 'photo', durationMs: 10_000 },
      { inputPath: '/tmp/b.jpg', type: 'photo', durationMs: 10_000 },
      { inputPath: '/tmp/c.mp4', type: 'clip', durationMs: 5_000 },
    ],
    outputPath: '/tmp/recap.mp4',
    ...overrides,
  };
}

test('builds a concat montage with one input per slot + audio bed', () => {
  const args = buildAutoRecapFfmpegArgs(spec({ audioPath: '/tmp/song.m4a' }));
  // 3 slot inputs + 1 audio input = 4 `-i`.
  assert.equal(args.filter((a) => a === '-i').length, 4);
  // photo slots are looped + time-bounded; the clip is time-bounded, not looped.
  assert.ok(args.join(' ').includes('-loop 1 -t 10 -i /tmp/a.jpg'));
  assert.ok(args.join(' ').includes('-t 5 -i /tmp/c.mp4'));
  assert.ok(!args.join(' ').includes('-loop 1 -t 5 -i /tmp/c.mp4'));
  // concat over all 3 normalized streams → [vout].
  const fc = args[args.indexOf('-filter_complex') + 1];
  assert.ok(fc);
  assert.ok(fc.includes('concat=n=3:v=1:a=0[vout]'));
  assert.ok(fc.includes('scale=1080:1920:force_original_aspect_ratio=increase'));
  // audio mapped from the last input index (3) with a fade-out + AAC.
  assert.ok(args.join(' ').includes('-map 3:a'));
  assert.ok(args.join(' ').includes('afade=t=out'));
  assert.ok(args.includes('-c:a'));
  // total length pinned to 25s (10+10+5), vertical H.264, ends at the output path.
  assert.ok(args.join(' ').includes('-t 25'));
  assert.ok(args.includes('libx264'));
  assert.equal(args[args.length - 1], '/tmp/recap.mp4');
});

test('silent render omits all audio flags', () => {
  const args = buildAutoRecapFfmpegArgs(spec()); // no audioPath
  assert.equal(args.filter((a) => a === '-i').length, 3);
  assert.ok(!args.includes('-c:a'));
  assert.ok(!args.some((a) => /^\d+:a$/.test(a))); // no audio map token like `3:a`
  assert.ok(!args.join(' ').includes('afade'));
});

test('enforces the hard 30-second cap', () => {
  assert.throws(
    () =>
      buildAutoRecapFfmpegArgs(
        spec({
          slots: [
            { inputPath: '/tmp/a.jpg', type: 'photo', durationMs: 20_000 },
            { inputPath: '/tmp/b.jpg', type: 'photo', durationMs: 15_000 }, // 35s > 30s
          ],
        }),
      ),
    /recap_exceeds_30s_cap/,
  );
  // exactly 30s is allowed.
  assert.doesNotThrow(() =>
    buildAutoRecapFfmpegArgs(
      spec({
        slots: [{ inputPath: '/tmp/a.jpg', type: 'photo', durationMs: RECAP_MAX_DURATION_MS }],
      }),
    ),
  );
});

test('rejects empty slots and non-positive durations', () => {
  assert.throws(() => buildAutoRecapFfmpegArgs(spec({ slots: [] })), /recap_no_slots/);
  assert.throws(
    () =>
      buildAutoRecapFfmpegArgs(
        spec({ slots: [{ inputPath: '/tmp/a.jpg', type: 'photo', durationMs: 0 }] }),
      ),
    /recap_bad_slot_duration/,
  );
});
