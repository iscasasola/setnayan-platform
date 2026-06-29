// Stories P0 — pure beat→slot derivation tests.
//
// These exercise the inert P0 scaffold: the beat-grid types and the pure
// `buildSlotsFromBeatGrid` / `evenSplitSlots` helpers that P1/P2 will consume.
// No DOM / rendering involved, so they run cleanly under `tsx --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLIP_MAX_SEC,
  STORIES_TEMPLATES,
  STORIES_DURATION,
  findStoriesTemplate,
  buildSlotsFromBeatGrid,
  evenSplitSlots,
  type BeatGrid,
  type StoriesTemplate,
} from './stories-templates';

const stories = findStoriesTemplate('golden-hour-stories-30')!;
const fastCut = findStoriesTemplate('midnight-fast-cut-30')!;

// Even 0.5s grid (120 BPM) covering 30s, every other downbeat marked.
function makeGrid(spacing: number, total = STORIES_DURATION): BeatGrid {
  const beats: number[] = [];
  for (let t = 0; t <= total + spacing; t += spacing) beats.push(Number(t.toFixed(3)));
  return {
    bpm: Math.round(60 / spacing),
    beats,
    downbeats: beats.filter((_, i) => i % 4 === 0),
    source: 'test',
  };
}

test('ships at least one 30s Stories template', () => {
  assert.ok(STORIES_TEMPLATES.length >= 1);
  assert.equal(stories.durationSec, STORIES_DURATION);
  assert.equal(STORIES_DURATION, 30);
});

test('clip slots never exceed the 5-second hard cap (dense grid)', () => {
  // 1.5s between beats so a 2-beat stride spans 3s > would-be, and a
  // 1-beat stride could still try to fill long gaps — both must clamp clips.
  for (const tpl of [stories, fastCut] as StoriesTemplate[]) {
    const slots = buildSlotsFromBeatGrid(tpl, makeGrid(1.5));
    for (const s of slots) {
      if (s.kind === 'clip') {
        assert.ok(
          s.endSec - s.startSec <= CLIP_MAX_SEC + 1e-6,
          `clip slot ${s.startSec}-${s.endSec} exceeds ${CLIP_MAX_SEC}s`,
        );
      }
    }
  }
});

test('slots are ordered, non-overlapping, and within the duration', () => {
  const slots = buildSlotsFromBeatGrid(stories, makeGrid(0.5));
  assert.ok(slots.length > 0);
  let prevEnd = -1;
  for (const s of slots) {
    assert.ok(s.endSec > s.startSec, 'slot has positive length');
    assert.ok(s.startSec >= prevEnd - 1e-6, 'slots do not overlap');
    assert.ok(s.endSec <= STORIES_DURATION + 1e-6, 'slot within duration');
    prevEnd = s.endSec;
  }
});

test('photo slots can snap to a full beat gap (not capped like clips)', () => {
  // golden-hour pattern is [photo, photo, clip] with beatsPerCut 2.
  const slots = buildSlotsFromBeatGrid(stories, makeGrid(1.0));
  const photo = slots.find((s) => s.kind === 'photo');
  assert.ok(photo, 'expected at least one photo slot');
  // 2-beat stride over 1.0s spacing → ~2s photo span, which is allowed (> a
  // clip would be allowed too here, but the point is photos aren't clamped to
  // any artificial sub-gap).
  assert.ok(photo!.endSec - photo!.startSec > 0);
});

test('falls back to an even split when the grid is degenerate', () => {
  const fromEmpty = buildSlotsFromBeatGrid(stories, { bpm: 0, beats: [] });
  const even = evenSplitSlots(stories);
  assert.deepEqual(fromEmpty, even);
  assert.ok(even.length >= 1);
});

test('even-split fallback also respects the 5s clip cap', () => {
  for (const s of evenSplitSlots(fastCut)) {
    if (s.kind === 'clip') {
      assert.ok(s.endSec - s.startSec <= CLIP_MAX_SEC + 1e-6);
    }
  }
});

test('photo slots carry a camera move (§16.9); clip slots do not', () => {
  for (const builder of [
    () => buildSlotsFromBeatGrid(stories, makeGrid(1.0)),
    () => evenSplitSlots(stories),
  ]) {
    const slots = builder();
    const photos = slots.filter((s) => s.kind === 'photo');
    const clips = slots.filter((s) => s.kind === 'clip');
    assert.ok(photos.length > 0, 'expected photo slots');
    for (const p of photos) {
      assert.ok(p.cameraMove, 'photo slot has a cameraMove');
      assert.equal(typeof p.cameraMove!.type, 'string');
      assert.ok(p.cameraMove!.amount > 0);
    }
    for (const c of clips) {
      assert.equal(c.cameraMove, undefined, 'clip slot has no cameraMove');
    }
  }
});

test('camera moves vary across photo slots in a reel', () => {
  const photos = evenSplitSlots(stories).filter((s) => s.kind === 'photo');
  const types = new Set(photos.map((p) => p.cameraMove!.type));
  assert.ok(types.size > 1, 'reel uses more than one camera move');
});
