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

test('clip spans never exceed the 10-second hard cap at any tempo', () => {
  for (const bpm of [90, 110, 130]) {
    // Sparse cuts (4 beats/cut) deliberately try to give each slot a long gap;
    // clip slots must still clamp to the 10s ceiling while photo slots run longer.
    const kinds: ('photo' | 'clip')[] = ['clip', 'photo', 'clip', 'photo'];
    const spans = buildBeatSchedule(30, kinds, { beatGrid: gridAtBpm(bpm), beatsPerCut: 4 });
    spans.forEach((s, i) => {
      if (kinds[i] === 'clip') {
        assert.ok(s <= 10 + SUM_EPS, `clip span ${s}s ≤ 10s @ ${bpm}bpm`);
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

test('even-split fallback caps clips at the 10s ceiling', () => {
  const kinds: ('photo' | 'clip')[] = ['clip', 'clip'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null });
  // Each would be 15s evenly; clips clamp to the 10s ceiling. There's no photo to
  // absorb the residual, so the reel ends short (20s) rather than fast-motioning:
  // assert the CAP, not the sum.
  for (const s of spans) assert.ok(s <= 10 + SUM_EPS, `clip ≤ 10s (got ${s})`);
  assert.ok(sum(spans) <= 30 + SUM_EPS, `never over budget (got ${sum(spans)})`);
});

test('a degenerate grid (one beat) falls back to even', () => {
  const kinds: ('photo' | 'clip')[] = ['photo', 'photo'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: { bpm: 100, beats: [0.5] } });
  for (const s of spans) assert.ok(Math.abs(s - 15) < SUM_EPS);
});

// ---------------------------------------------------------------------------
// 10s clip slots (2026-07-22) — a clip may now occupy up to 10s at 1×, but the
// SUM of slots stays within the reel's 1–30s budget.
// ---------------------------------------------------------------------------

test('a single 10s clip now occupies more than the old 5s cap when the budget allows', () => {
  // One clip, a 30s target: the whole budget is free, so the clip stretches to
  // its 10s footage ceiling — the exact regression the 5→10 bump fixes. Before,
  // this span would have clamped to 5s (a 10s clip half-used).
  const spans = buildBeatSchedule(30, ['clip'], { beatGrid: null, slotMaxSec: [10] });
  assert.equal(spans.length, 1);
  assert.ok(spans[0]! > 5, `clip span ${spans[0]}s exceeds the old 5s cap`);
  assert.ok(Math.abs(spans[0]! - 10) < SUM_EPS, `clamps to the 10s ceiling (got ${spans[0]})`);
});

test('a clip with NO explicit slotMaxSec uses the CLIP_SLOT_MAX_SEC default (guards the 5→10 bump)', () => {
  // Same one-clip/30s case, but WITHOUT an explicit slotMaxSec — so the clip
  // falls back to the CLIP_SLOT_MAX_SEC default that clipSlotCeilingSec wires
  // into both render paths. The explicit-[10] test above passes even if the
  // constant is reverted to 5; this one does not — revert CLIP_SLOT_MAX_SEC to
  // 5 and this fails, catching a silent regression of the fix.
  const spans = buildBeatSchedule(30, ['clip'], { beatGrid: null });
  assert.equal(spans.length, 1);
  assert.ok(spans[0]! > 5, `default ceiling lets the clip exceed the old 5s cap (got ${spans[0]})`);
  assert.ok(Math.abs(spans[0]! - 10) < SUM_EPS, `defaults to the 10s ceiling (got ${spans[0]})`);
});

test('a many-clip reel stays ≤30s total, each clip a fair share', () => {
  // 8 clips (well within the max 5 guest + 5 couple = 10 sources) at a 30s target.
  // 8 × 10s = 80s would blow the cap, so each gets its fair ~3.75s and the SUM
  // never exceeds the reel budget.
  const kinds: ('photo' | 'clip')[] = Array<'clip'>(8).fill('clip');
  const slotMaxSec = Array<number>(8).fill(10);
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null, slotMaxSec });
  assert.ok(sum(spans) <= 30 + SUM_EPS, `never over the 30s budget (got ${sum(spans)})`);
  assert.ok(Math.abs(sum(spans) - 30) < SUM_EPS, `uses the full 30s budget (got ${sum(spans)})`);
  for (const s of spans) assert.ok(s <= 10 + SUM_EPS && s > 0, `each clip ≤10s, non-zero (got ${s})`);
});

test('slotMaxSec caps a clip slot at its own footage length (no frozen tail)', () => {
  // A 3s clip and a 10s clip share a 30s reel. The short clip must not win more
  // than its 3s of footage — a longer slot would freeze on its last frame.
  const kinds: ('photo' | 'clip')[] = ['clip', 'clip'];
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null, slotMaxSec: [3, 10] });
  assert.ok(spans[0]! <= 3 + SUM_EPS, `short clip capped at its 3s footage (got ${spans[0]})`);
  assert.ok(spans[1]! <= 10 + SUM_EPS, `long clip capped at 10s (got ${spans[1]})`);
  assert.ok(sum(spans) <= 30 + SUM_EPS, `never over budget (got ${sum(spans)})`);
});

test('minSlotSec honors a template floor: every slot ≥ floor, trailing dropped, ≤ budget', () => {
  // 10 clips, a 30s reel, a 4s template floor. Only floor(30/4)=7 slots fit at
  // the floor, so 3 trailing slots drop to 0; survivors each ≥ 4s; ≤ 30s total.
  const kinds: ('photo' | 'clip')[] = Array<'clip'>(10).fill('clip');
  const slotMaxSec = Array<number>(10).fill(10);
  const spans = buildBeatSchedule(30, kinds, { beatGrid: null, slotMaxSec, minSlotSec: 4 });
  const nonZero = spans.filter((s) => s > 1e-6);
  assert.ok(nonZero.length <= 7, `at most floor(30/4)=7 slots survive (got ${nonZero.length})`);
  for (const s of nonZero) assert.ok(s >= 4 - SUM_EPS, `each surviving slot ≥ 4s floor (got ${s})`);
  assert.ok(sum(spans) <= 30 + SUM_EPS, `never over the 30s budget (got ${sum(spans)})`);
});

test('minSlotSec defaults to no floor (legacy behavior unchanged)', () => {
  const kinds: ('photo' | 'clip')[] = ['clip', 'clip', 'clip'];
  const withFloor = buildBeatSchedule(30, kinds, { beatGrid: null, slotMaxSec: [10, 10, 10] });
  // No minSlotSec → all three 10s slots survive (sum 30).
  assert.equal(withFloor.filter((s) => s > 1e-6).length, 3);
  assert.ok(Math.abs(sum(withFloor) - 30) < SUM_EPS, `uses the full budget (got ${sum(withFloor)})`);
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
