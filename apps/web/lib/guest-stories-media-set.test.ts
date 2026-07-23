/**
 * Unit tests for the pure Guest Story PICKER media-set seam
 * (lib/guest-stories-media-set.ts). The load-bearing contracts:
 *
 *   1. A CLIP enters the set ONLY through its geo-stripped web copy
 *      (renderKey = clip_web_r2_key). A clip without one is EXCLUDED — never
 *      substituted with the geo-bearing raw original.
 *   2. A PHOTO whose key is unmistakably a video container is excluded (same
 *      guard as the auto photo set).
 *   3. Ordering follows the tag feed (newest first) for any mix of kinds.
 *   4. storySelectionState enforces the min floor / ~10 max as one code path.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  assembleStoryMediaSet,
  storySelectionState,
  type StoryMediaEntry,
} from './guest-stories-media-set';

const photo = (renderKey: string | null): StoryMediaEntry => ({
  kind: 'photo',
  renderKey,
  stillKey: renderKey,
  durationSec: null,
});

const clip = (
  renderKey: string | null,
  durationSec: number | null = 8,
): StoryMediaEntry => ({
  kind: 'clip',
  renderKey,
  stillKey: 'r2://papic/poster-1.jpg',
  durationSec,
});

test('mixes photos and clips in tag-feed order', () => {
  const tags = [{ source_id: 'a' }, { source_id: 'b' }, { source_id: 'c' }];
  const entries = new Map<string, StoryMediaEntry>([
    ['a', photo('r2://papic/a.jpg')],
    ['b', clip('r2://papic/b-web.mp4')],
    ['c', photo('r2://papic/c.jpg')],
  ]);
  const out = assembleStoryMediaSet(tags, entries);
  assert.deepEqual(
    out.map((m) => `${m.id}:${m.kind}`),
    ['a:photo', 'b:clip', 'c:photo'],
  );
});

test('a clip WITHOUT a web copy is excluded — never the raw original', () => {
  const tags = [{ source_id: 'raw-only' }, { source_id: 'webbed' }];
  const entries = new Map<string, StoryMediaEntry>([
    // The DB read passes renderKey=null when clip_web_r2_key is absent — the
    // raw r2_object_key must never be offered as the renderKey for a clip.
    ['raw-only', clip(null)],
    ['webbed', clip('r2://papic/webbed-web.mp4')],
  ]);
  const out = assembleStoryMediaSet(tags, entries);
  assert.deepEqual(
    out.map((m) => m.id),
    ['webbed'],
  );
});

test('a photo resolving to a video container is excluded', () => {
  const tags = [{ source_id: 'ok' }, { source_id: 'mis-stamped' }];
  const entries = new Map<string, StoryMediaEntry>([
    ['ok', photo('r2://papic/ok.webp')],
    ['mis-stamped', photo('r2://papic/oops.mp4')],
  ]);
  const out = assembleStoryMediaSet(tags, entries);
  assert.deepEqual(
    out.map((m) => m.id),
    ['ok'],
  );
});

test('an untagged/unresolved source_id falls out', () => {
  const tags = [{ source_id: 'known' }, { source_id: 'ghost' }];
  const entries = new Map<string, StoryMediaEntry>([
    ['known', photo('r2://papic/known.jpg')],
  ]);
  const out = assembleStoryMediaSet(tags, entries);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, 'known');
});

test('non-positive stored durations normalize to null', () => {
  const tags = [{ source_id: 'z' }, { source_id: 'p' }];
  const entries = new Map<string, StoryMediaEntry>([
    ['z', clip('r2://papic/z-web.mp4', 0)],
    ['p', clip('r2://papic/p-web.mp4', 9.5)],
  ]);
  const out = assembleStoryMediaSet(tags, entries);
  assert.equal(out[0]?.durationSec, null);
  assert.equal(out[1]?.durationSec, 9.5);
});

test('storySelectionState: floor + cap', () => {
  const limits = { min: 3, max: 10 };
  assert.deepEqual(storySelectionState(0, limits), {
    canRender: false,
    canAddMore: true,
  });
  assert.deepEqual(storySelectionState(2, limits), {
    canRender: false,
    canAddMore: true,
  });
  assert.deepEqual(storySelectionState(3, limits), {
    canRender: true,
    canAddMore: true,
  });
  assert.deepEqual(storySelectionState(10, limits), {
    canRender: true,
    canAddMore: false,
  });
});
