/**
 * GUARD — MEMORIES ALWAYS SHOWS THE COMPRESSED COPY (owner 2026-10-23: *"the thumbnails will be small so loading will
 * be fast but they can download photo to get the higher quality. but on the memories, always use the compressed
 * version."*). The grid draws the small copy, the viewer the compressed one, and the ORIGINAL (`r2_object_key`) is
 * only ever a Download — never a tile, never the viewer, never a clip's playback.
 *
 * Sabotage (2026-10-23): `grid` falls back to `r2_object_key` → red; the event Memories read drops `compressedOnly`
 * → red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { memoriesRefs } from './papic-display-ref';
import { stripComments } from './strip-comments';

const ORIG = 'r2://media/orig.jpg';
const all = { r2_object_key: ORIG, thumb_r2_key: 'r2://t', tile_r2_key: 'r2://m', display_r2_key: 'r2://d' };

test('a photo: small copy in the grid, the tile copy one-across, the compressed copy in the viewer', () => {
  const r = memoriesRefs({ photo_type: 'photo', ...all });
  assert.deepEqual(r, { grid: 'r2://t', large: 'r2://m', view: 'r2://d', play: null, download: null });
});

test('the original is never drawn — not even when it is the only file, and not after it is dropped', () => {
  for (const row of [
    { photo_type: 'photo', r2_object_key: ORIG },
    { media_type: 'photo', r2_object_key: ORIG, full_res_dropped_at: null },
    { photo_type: 'clip', r2_object_key: 'r2://clip.mp4', poster_r2_key: 'r2://p' },
  ]) {
    const r = memoriesRefs(row);
    for (const k of ['grid', 'large', 'view', 'play'] as const) {
      assert.notEqual(r[k], row.r2_object_key, `${k} drew the original`);
    }
  }
  // A missing small copy falls to the compressed one, never the original.
  assert.equal(memoriesRefs({ photo_type: 'photo', r2_object_key: ORIG, display_r2_key: 'r2://d' }).grid, 'r2://d');
});

test('a clip plays its web copy only; Download is the kept original, or the web copy once it is gone', () => {
  const clip = { photo_type: 'clip', r2_object_key: 'r2://clip.mp4', clip_web_r2_key: 'r2://web.mp4', poster_r2_key: 'r2://p', thumb_r2_key: 'r2://pt' };
  assert.deepEqual(memoriesRefs(clip), { grid: 'r2://pt', large: 'r2://p', view: 'r2://p', play: 'r2://web.mp4', download: 'r2://clip.mp4' });
  assert.equal(memoriesRefs({ ...clip, full_res_dropped_at: '2026-09-01T00:00:00Z' }).download, 'r2://web.mp4');
  assert.equal(memoriesRefs({ ...clip, clip_web_r2_key: null }).play, null, 'a clip with no web copy played its original');
});

test('the event Memories page reads the compressed-only refs', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/memories/page.tsx'), 'utf8'));
  assert.match(page, /fetchPapicGallery\(\s*supabase,\s*eventId,\s*\{\s*compressedOnly:\s*true\s*\}\s*\)/, 'Memories reads the gallery with originals allowed');
  const lib = stripComments(readFileSync(join(process.cwd(), 'lib/papic-gallery.ts'), 'utf8'));
  assert.match(lib, /memoriesRefs\(/, 'the compressed-only read does not go through memoriesRefs');
});
