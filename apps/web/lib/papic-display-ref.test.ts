import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isClipRow,
  resolveStillRef,
  resolvePlayRef,
  stableMediaPath,
  type PapicDisplayRow,
} from './papic-display-ref';

// The resolvers are the ONLY sanctioned entry to a presignable Papic ref, and
// they must never hand a presigner a dead pointer (a dropped raw) or the wrong
// media kind (an .mp4 to an <img>, a still to a <video>). This is the safety
// net for a bug that is ALREADY LIVE for photos, so it gets a dense test.

const DERIV = {
  thumb: 'r2://setnayan-media/derivatives/e/ph.thumb.avif',
  display: 'r2://setnayan-media/derivatives/e/ph.display.avif',
  poster: 'r2://setnayan-media/e/clip.poster.avif',
  raw: 'r2://setnayan-media/e/original.jpg',
  rawVideo: 'r2://setnayan-media/e/clip.mp4',
  clipWeb: 'r2://setnayan-media/e/clip.web.mp4',
} as const;

// ── isClipRow ────────────────────────────────────────────────────────────────
test('isClipRow reads either capture table', () => {
  assert.equal(isClipRow({ photo_type: 'clip' }), true); // papic_photos
  assert.equal(isClipRow({ media_type: 'clip' }), true); // papic_guest_captures
  assert.equal(isClipRow({ photo_type: 'photo' }), false);
  assert.equal(isClipRow({ media_type: 'photo' }), false);
  assert.equal(isClipRow({}), false); // photo-only SELECT (no type col) → photo
});

// ── resolveStillRef · PHOTO ──────────────────────────────────────────────────
test('still(photo): thumb > display > raw', () => {
  assert.equal(
    resolveStillRef({ photo_type: 'photo', thumb_r2_key: DERIV.thumb, display_r2_key: DERIV.display, r2_object_key: DERIV.raw }),
    DERIV.thumb,
  );
  assert.equal(
    resolveStillRef({ photo_type: 'photo', display_r2_key: DERIV.display, r2_object_key: DERIV.raw }),
    DERIV.display,
  );
  assert.equal(
    resolveStillRef({ photo_type: 'photo', r2_object_key: DERIV.raw }),
    DERIV.raw, // pre-derivative row still resolves (no breakage)
  );
});

test('still(photo): a DROPPED original is never signed — derivative wins, null beats a 404', () => {
  // Guard A refuses to drop a photo without a display copy, so a dropped photo
  // always still resolves to a derivative.
  assert.equal(
    resolveStillRef({ photo_type: 'photo', display_r2_key: DERIV.display, r2_object_key: DERIV.raw, full_res_dropped_at: '2026-07-01T00:00:00Z' }),
    DERIV.display,
  );
  // Pathological: dropped + no derivative → null, NOT the dead raw pointer.
  assert.equal(
    resolveStillRef({ photo_type: 'photo', r2_object_key: DERIV.raw, full_res_dropped_at: '2026-07-01T00:00:00Z' }),
    null,
  );
});

// ── resolveStillRef · CLIP ───────────────────────────────────────────────────
test('still(clip): thumb > poster, NEVER the raw video', () => {
  assert.equal(
    resolveStillRef({ media_type: 'clip', thumb_r2_key: DERIV.thumb, poster_r2_key: DERIV.poster, r2_object_key: DERIV.rawVideo }),
    DERIV.thumb,
  );
  assert.equal(
    resolveStillRef({ photo_type: 'clip', poster_r2_key: DERIV.poster, r2_object_key: DERIV.rawVideo }),
    DERIV.poster,
  );
  // No poster/thumb → null, never the .mp4 (would render as a broken <img>).
  assert.equal(
    resolveStillRef({ media_type: 'clip', r2_object_key: DERIV.rawVideo }),
    null,
  );
});

// ── resolvePlayRef · CLIP ────────────────────────────────────────────────────
test('play(clip): clip_web > raw video, drop-safe', () => {
  // No web-copy column yet → falls back to the raw video (today's behaviour).
  assert.equal(
    resolvePlayRef({ media_type: 'clip', r2_object_key: DERIV.rawVideo }),
    DERIV.rawVideo,
  );
  // Web-copy present → preferred.
  assert.equal(
    resolvePlayRef({ media_type: 'clip', clip_web_r2_key: DERIV.clipWeb, r2_object_key: DERIV.rawVideo }),
    DERIV.clipWeb,
  );
  // Dropped raw + web-copy → web-copy; dropped raw + none → null (never dead raw).
  assert.equal(
    resolvePlayRef({ media_type: 'clip', clip_web_r2_key: DERIV.clipWeb, r2_object_key: DERIV.rawVideo, full_res_dropped_at: '2026-07-01T00:00:00Z' }),
    DERIV.clipWeb,
  );
  assert.equal(
    resolvePlayRef({ media_type: 'clip', r2_object_key: DERIV.rawVideo, full_res_dropped_at: '2026-07-01T00:00:00Z' }),
    null,
  );
});

// ── Per-repointed-surface fixtures: each still resolves after a DROP ──────────
// Every repointed read path selects the derivative columns and hands the row to
// a resolver. This proves that after the original is dropped (full_res_dropped_at
// set, only derivatives survive) each surface still resolves to a real ref — no
// r2_object_key-only path 404s.
const DROPPED_PHOTO: PapicDisplayRow = {
  photo_type: 'photo',
  r2_object_key: DERIV.raw, // dead pointer post-drop
  display_r2_key: DERIV.display,
  thumb_r2_key: DERIV.thumb,
  full_res_dropped_at: '2026-07-01T00:00:00Z',
};

for (const surface of [
  'editorial /[slug] gallery (data.ts)',
  'life-story moment graph (photo moment)',
  'kwento review queue anchor',
  'kwento magazine spine',
  'library editorials hero',
  'admin user-reports thumbnail',
  'guest-stories reel photo input',
]) {
  test(`still surface resolves after drop: ${surface}`, () => {
    const ref = resolveStillRef(DROPPED_PHOTO);
    assert.equal(ref, DERIV.thumb);
    assert.notEqual(ref, DERIV.raw); // never the dropped original
    assert.ok(ref); // always a real, presignable derivative
  });
}

test('play surface resolves after (future) clip drop: alaala-orb', () => {
  // Today clips never drop and no web-copy exists → raw video (unchanged).
  assert.equal(resolvePlayRef({ media_type: 'clip', r2_object_key: DERIV.rawVideo }), DERIV.rawVideo);
  // After PR-2/PR-4 make clips droppable with a web-copy, the orb prefers it.
  assert.equal(
    resolvePlayRef({ media_type: 'clip', clip_web_r2_key: DERIV.clipWeb, r2_object_key: DERIV.rawVideo, full_res_dropped_at: '2026-07-01T00:00:00Z' }),
    DERIV.clipWeb,
  );
});

// ── stableMediaPath ──────────────────────────────────────────────────────────
test('stableMediaPath maps r2:// → the streaming route, passes legacy through', () => {
  assert.equal(
    stableMediaPath('r2://setnayan-media/derivatives/e/ph.display.avif'),
    '/papic/media/setnayan-media/derivatives/e/ph.display.avif',
  );
  assert.equal(stableMediaPath('https://cdn.example.com/x.jpg'), 'https://cdn.example.com/x.jpg');
  assert.equal(stableMediaPath(null), null);
  assert.equal(stableMediaPath(''), null);
  assert.equal(stableMediaPath('r2://bucketonly'), null); // malformed → null
});
