/**
 * What a vendor may see of their own captures. Every rule here is a rule about
 * someone else's wedding photos, so each one is pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureSummary,
  clipLengthLabel,
  visibleVendorCaptures,
} from './vendor-own-captures';

const row = (over: Partial<Parameters<typeof visibleVendorCaptures>[0][number]> = {}) => ({
  capture_id: 'c1',
  event_id: 'e1',
  r2_object_key: 'papic/vendor-v/event-e/cap-1.jpg',
  poster_r2_key: null,
  media_type: 'photo',
  clip_duration_ms: null,
  captured_at: '2026-12-12T14:00:00.000Z',
  hidden_at: null,
  nsfw_checked: true,
  ...over,
});

test('an unscreened capture is shown to nobody — not even the person who took it', () => {
  assert.equal(visibleVendorCaptures([row({ nsfw_checked: false })]).length, 0);
  assert.equal(visibleVendorCaptures([row({ nsfw_checked: null })]).length, 0);
});

test('a picture the couple took down leaves the vendor’s view too', () => {
  // The couple's event, the couple's call.
  assert.equal(visibleVendorCaptures([row({ hidden_at: '2026-12-13T00:00:00Z' })]).length, 0);
});

test('a clip tiles on its poster, never on the video file', () => {
  const [c] = visibleVendorCaptures([
    row({
      media_type: 'clip',
      r2_object_key: 'papic/vendor-v/event-e/cap-2.mp4',
      poster_r2_key: 'papic/vendor-v/event-e/cap-2.jpg',
      clip_duration_ms: 7000,
    }),
  ]);
  assert.equal(c?.tileKey, 'papic/vendor-v/event-e/cap-2.jpg', 'the grid must show a still');
  assert.equal(c?.sourceKey, 'papic/vendor-v/event-e/cap-2.mp4', 'the source stays the video');
  assert.equal(c?.mediaType, 'clip');
});

test('a clip with no poster is skipped rather than tiled as video', () => {
  // Degrading to the mp4 would autoplay a wall of video on a phone at a wedding.
  const out = visibleVendorCaptures([
    row({ media_type: 'clip', r2_object_key: 'cap.mp4', poster_r2_key: null }),
  ]);
  assert.equal(out.length, 0);
});

test('a good photo comes through with its own key on both sides', () => {
  const [c] = visibleVendorCaptures([row()]);
  assert.equal(c?.tileKey, c?.sourceKey);
  assert.equal(c?.mediaType, 'photo');
  assert.equal(c?.clipDurationMs, null);
});

test('clip length reads as minutes and seconds, photos have none', () => {
  const [clip] = visibleVendorCaptures([
    row({ media_type: 'clip', r2_object_key: 'c.mp4', poster_r2_key: 'c.jpg', clip_duration_ms: 7400 }),
  ]);
  assert.equal(clipLengthLabel(clip!), '0:07');
  const [photo] = visibleVendorCaptures([row()]);
  assert.equal(clipLengthLabel(photo!), null);
});

test('the summary counts what is SHOWN, not what was fetched', () => {
  const captures = visibleVendorCaptures([
    row({ capture_id: 'a' }),
    row({ capture_id: 'b' }),
    row({ capture_id: 'hidden', hidden_at: '2026-12-13T00:00:00Z' }),
    row({ capture_id: 'unscreened', nsfw_checked: false }),
    row({ capture_id: 'c', media_type: 'clip', r2_object_key: 'c.mp4', poster_r2_key: 'c.jpg', clip_duration_ms: 5000 }),
  ]);
  assert.equal(captureSummary(captures), '2 photos · 1 clip');
});

test('an empty set says so plainly instead of showing a zero', () => {
  assert.equal(captureSummary([]), 'Nothing yet.');
});

test('singulars read as singulars', () => {
  assert.equal(captureSummary(visibleVendorCaptures([row()])), '1 photo');
});
