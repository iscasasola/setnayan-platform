// Reel renderer audio-mux logic (Patiktok un-retire 2026-07-01; engine = lib/reel-render.ts).
//
// These cover the PURE decision logic only. The actual audio mixing
// (AudioContext → MediaStreamAudioDestinationNode → MediaRecorder) is a browser
// runtime that can't be exercised under `tsx --test` (no Web Audio / canvas /
// MediaRecorder in Node), so we test the two seams that steer it:
//   • shouldUseMediaRecorder — does a reel with a song get routed to the path
//     that can mux audio?
//   • selectRecorderMime — do we pick an audio-capable container when there's
//     a track, and keep the video-only ladder otherwise?

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldUseMediaRecorder,
  selectRecorderMime,
  buildBeatSchedule,
  spansToUnits,
  splitFrames,
} from './reel-render';
import type { BeatGrid } from './stories-templates';

// ---------------------------------------------------------------------------
// shouldUseMediaRecorder
// ---------------------------------------------------------------------------

test('uses MediaRecorder when WebCodecs is unavailable (no music)', () => {
  assert.equal(
    shouldUseMediaRecorder({ musicUrl: null, webCodecsAvailable: false }),
    true,
  );
});

test('uses MediaRecorder when WebCodecs is unavailable (with music)', () => {
  assert.equal(
    shouldUseMediaRecorder({
      musicUrl: 'https://r2.example/song.mp3',
      webCodecsAvailable: false,
    }),
    true,
  );
});

test('prefers WebCodecs when available and there is no backing track', () => {
  assert.equal(
    shouldUseMediaRecorder({ musicUrl: null, webCodecsAvailable: true }),
    false,
  );
  assert.equal(
    shouldUseMediaRecorder({ musicUrl: undefined, webCodecsAvailable: true }),
    false,
  );
});

test('steers a reel WITH music to MediaRecorder even when WebCodecs is available', () => {
  // This is the bug fix: WebCodecs can't mux audio yet, so a reel that has a
  // song must take the MediaRecorder path to actually play sound.
  assert.equal(
    shouldUseMediaRecorder({
      musicUrl: 'https://r2.example/pakanta.mp3',
      webCodecsAvailable: true,
    }),
    true,
  );
});

test('treats an empty music url as no music', () => {
  assert.equal(
    shouldUseMediaRecorder({ musicUrl: '', webCodecsAvailable: true }),
    false,
  );
});

// ---------------------------------------------------------------------------
// selectRecorderMime
// ---------------------------------------------------------------------------

test('picks an audio-capable (opus) container when there is audio', () => {
  // Everything supported — first audio candidate wins, and it carries opus.
  const mime = selectRecorderMime(true, () => true);
  assert.ok(mime, 'expected a mime to be chosen');
  assert.match(mime!, /opus/);
  assert.match(mime!, /^video\/webm/);
});

test('never returns a bare video/mp4 (audio-less) container when audio is present', () => {
  // Only mp4 + bare webm are supported. With audio we must NOT pick mp4 (it has
  // no audio codec here) — we accept the bare webm container instead.
  const supported = new Set(['video/mp4', 'video/webm']);
  const mime = selectRecorderMime(true, (m) => supported.has(m));
  assert.equal(mime, 'video/webm');
  assert.notEqual(mime, 'video/mp4');
});

test('keeps the video-only mp4-first ladder when there is no audio', () => {
  const mime = selectRecorderMime(false, () => true);
  assert.equal(mime, 'video/mp4');
});

test('falls through the video-only ladder to webm when mp4 is unsupported', () => {
  const supported = new Set(['video/webm;codecs=vp9,opus', 'video/webm']);
  const mime = selectRecorderMime(false, (m) => supported.has(m));
  assert.equal(mime, 'video/webm;codecs=vp9,opus');
});

test('returns undefined when nothing is supported', () => {
  assert.equal(selectRecorderMime(true, () => false), undefined);
  assert.equal(selectRecorderMime(false, () => false), undefined);
});

// ---------------------------------------------------------------------------
// buildBeatSchedule — beat-aware cut scheduling (the Guest Stories spine)
// ---------------------------------------------------------------------------

/** Even beat grid at `bpm`, beats every 60/bpm seconds across `total` seconds. */
function gridAtBpm(bpm: number, total = 30): BeatGrid {
  const spacing = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t <= total + spacing; t += spacing) {
    beats.push(Number(t.toFixed(4)));
  }
  return { bpm, beats, source: 'test' };
}

const SUM_EPS = 1e-3;
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

test('beat schedule sums exactly to the reel duration at 90/110/130 BPM', () => {
  for (const bpm of [90, 110, 130]) {
    const kinds: ('photo' | 'clip')[] = ['photo', 'photo', 'clip', 'photo', 'photo', 'clip'];
    const spans = buildBeatSchedule(30, kinds, { beatGrid: gridAtBpm(bpm), beatsPerCut: 2 });
    assert.equal(spans.length, kinds.length, `one span per source @ ${bpm}bpm`);
    assert.ok(
      Math.abs(sum(spans) - 30) < SUM_EPS,
      `spans sum to 30s @ ${bpm}bpm (got ${sum(spans)})`,
    );
    for (const s of spans) assert.ok(s >= 0, `no negative span @ ${bpm}bpm`);
  }
});

test('clip spans never exceed the 5-second hard cap at any tempo', () => {
  for (const bpm of [90, 110, 130]) {
    // Sparse cuts (4 beats/cut) deliberately try to give each slot a long gap;
    // clip slots must still clamp to 5s while photo slots may run longer.
    const kinds: ('photo' | 'clip')[] = ['clip', 'photo', 'clip', 'photo'];
    const spans = buildBeatSchedule(30, kinds, { beatGrid: gridAtBpm(bpm), beatsPerCut: 4 });
    spans.forEach((s, i) => {
      if (kinds[i] === 'clip') {
        assert.ok(s <= 5 + SUM_EPS, `clip span ${s}s ≤ 5s @ ${bpm}bpm`);
      }
    });
  }
});

test('beat schedule cuts on the beat (slot edges land on beat onsets)', () => {
  const bpm = 120; // 0.5s beats
  const kinds: ('photo' | 'clip')[] = ['photo', 'photo', 'photo'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: gridAtBpm(bpm), beatsPerCut: 2 });
  // 2 beats × 0.5s = 1.0s per non-final slot; the last absorbs the rest.
  assert.ok(Math.abs(spans[0]! - 1.0) < SUM_EPS, `first cut at one bar (got ${spans[0]})`);
  assert.ok(Math.abs(spans[1]! - 1.0) < SUM_EPS, `second cut at one bar (got ${spans[1]})`);
  assert.ok(Math.abs(sum(spans) - 30) < SUM_EPS);
});

test('falls back to an even split when beat_grid is NULL (legacy behavior)', () => {
  const kinds: ('photo' | 'clip')[] = ['photo', 'photo', 'photo'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null });
  // No clips here, so an even split is exactly 10s each.
  for (const s of spans) assert.ok(Math.abs(s - 10) < SUM_EPS, `even 10s split (got ${s})`);
  assert.ok(Math.abs(sum(spans) - 30) < SUM_EPS);
});

test('even-split fallback still caps clips at 5s', () => {
  const kinds: ('photo' | 'clip')[] = ['clip', 'clip'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null });
  // Each would be 15s evenly; clips clamp to 5s, and the residual lands somewhere
  // safe (there's no photo, so the last span grows — but it's still a clip and
  // capped, so the total may be < 30 here: assert the CAP, not the sum).
  for (const s of spans) assert.ok(s <= 5 + SUM_EPS, `clip ≤ 5s (got ${s})`);
});

test('a degenerate grid (one beat) falls back to even', () => {
  const kinds: ('photo' | 'clip')[] = ['photo', 'photo'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: { bpm: 100, beats: [0.5] } });
  for (const s of spans) assert.ok(Math.abs(s - 15) < SUM_EPS);
});

// ---------------------------------------------------------------------------
// spansToUnits — seconds → frames/ms with exact total preservation
// ---------------------------------------------------------------------------

test('spansToUnits preserves the exact total unit budget', () => {
  const spans = [1.0, 1.0, 2.7, 0.3];
  for (const total of [900, 30000, 17]) {
    const units = spansToUnits(spans, total);
    assert.equal(units.length, spans.length);
    assert.equal(
      units.reduce((a, b) => a + b, 0),
      total,
      `units sum to ${total}`,
    );
    for (const u of units) assert.ok(Number.isInteger(u) && u >= 0);
  }
});

test('spansToUnits is proportional to the span sizes', () => {
  const units = spansToUnits([1, 3], 800);
  assert.equal(units.reduce((a, b) => a + b, 0), 800);
  // The 3:1 ratio means the second span gets ~3× the first.
  assert.ok(units[1]! > units[0]!);
});

test('splitFrames still distributes the remainder to earlier parts', () => {
  assert.deepEqual(splitFrames(10, 3), [4, 3, 3]);
  assert.deepEqual(splitFrames(9, 3), [3, 3, 3]);
  assert.deepEqual(splitFrames(0, 0), []);
});
