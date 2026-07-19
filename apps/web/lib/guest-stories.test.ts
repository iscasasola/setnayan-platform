/**
 * Unit suite for the FREE Guest Stories photo-set assembly (Node built-in test
 * runner, run via tsx — `pnpm test:unit`; CI runs it in the "unit tests" step).
 *
 * Load-bearing invariant: Stories are PHOTO-driven. A guest tagged in a Papic
 * guest CLIP must NOT contribute to the reel input, and must NOT inflate the
 * "You're tagged in N photos" count. The DB read excludes clips at the query
 * level (`papic_guest_captures … .eq('media_type','photo')`), so a clip-tagged
 * row's source_id never appears in the resolved key map — it falls out of the
 * assembled set. This suite asserts that contract (plus the belt-and-suspenders
 * video-extension guard) against the pure `assembleStoryPhotoSet` seam, with no
 * live DB.
 *
 * Regression: before the fix, a clip row's MP4 key reached the client-side
 * <img> loader (lib/reel-render loadImage), firing img.onerror and rejecting
 * the WHOLE render with "Could not load a tagged photo (check R2 CORS)."
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assembleStoryPhotoSet } from './guest-stories-photo-set';

test('clip-tagged rows are excluded — DB filtered media_type, so no key resolves', () => {
  // Tag feed (newest first): two photos and one guest CLIP. The clip's source_id
  // is absent from keyById because the papic_guest_captures query filtered
  // media_type='photo' — exactly what the DB returns post-fix.
  const tags = [
    { source_id: 'photo-1' },
    { source_id: 'clip-1' }, // tagged in a CLIP — not in keyById
    { source_id: 'photo-2' },
  ];
  const keyById = new Map<string, string>([
    ['photo-1', 'r2://media/photo-1.jpg'],
    ['photo-2', 'r2://media/photo-2.jpg'],
  ]);

  const { ordered, total } = assembleStoryPhotoSet(tags, keyById);

  assert.equal(total, 2, 'count reflects photos only — the clip does not inflate it');
  assert.deepEqual(
    ordered.map((o) => o.id),
    ['photo-1', 'photo-2'],
    'newest-first tag order preserved; clip dropped',
  );
});

test('belt-and-suspenders: a stray video key is dropped even if it resolved', () => {
  // Defensive guard for a mis-stamped row: even if a video key somehow reached
  // keyById, it must never feed the <img> loader.
  const tags = [{ source_id: 'photo-1' }, { source_id: 'stray-clip' }];
  const keyById = new Map<string, string>([
    ['photo-1', 'r2://media/photo-1.jpg'],
    ['stray-clip', 'r2://media/stray-clip.mp4'],
  ]);

  const { ordered, total } = assembleStoryPhotoSet(tags, keyById);

  assert.equal(total, 1, 'video key excluded from the count');
  assert.deepEqual(ordered.map((o) => o.id), ['photo-1']);
});

test('all-photo feed passes through unchanged', () => {
  const tags = [{ source_id: 'a' }, { source_id: 'b' }, { source_id: 'c' }];
  const keyById = new Map<string, string>([
    ['a', 'r2://media/a.jpg'],
    ['b', 'r2://media/b.png'],
    ['c', 'r2://media/c.webp'],
  ]);

  const { ordered, total } = assembleStoryPhotoSet(tags, keyById);

  assert.equal(total, 3);
  assert.deepEqual(ordered.map((o) => o.id), ['a', 'b', 'c']);
});
