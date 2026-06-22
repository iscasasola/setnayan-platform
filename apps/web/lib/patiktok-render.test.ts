// Iteration 0017 PR — reel renderer audio-mux logic.
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

import { shouldUseMediaRecorder, selectRecorderMime } from './patiktok-render';

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
