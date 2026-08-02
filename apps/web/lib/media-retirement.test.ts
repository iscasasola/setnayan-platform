/**
 * Unit suite for the replaced-media retirement decision.
 *
 * This runs UNATTENDED on a publish path — nobody is looking at the screen when
 * it fires, unlike the admin page where a human clicks each row. So the tests
 * are weighted toward what it must REFUSE:
 *
 *   • never a key outside the site-media allowlist (a mis-stored customer key in
 *     one of these columns must not be swept by an upload);
 *   • never a key the new value still uses (re-uploading the same object, or a
 *     slot whose key did not change, must not delete it);
 *   • never a value it could not parse (guessing is how a live file dies).
 *
 * Candidacy here is necessary but NOT sufficient — `retireReplacedMedia` also
 * re-reads live references before deleting. These tests cover the first gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { retirableKeys } from './media-retirement';

test('a replaced key is retirable', () => {
  assert.deepEqual(
    retirableKeys({
      previous: ['homepage-bg/slot-0/old.mp4'],
      next: ['homepage-bg/slot-0/new.mp4'],
    }),
    ['homepage-bg/slot-0/old.mp4'],
  );
});

test('🔑 an UNCHANGED key is never retired', () => {
  // Saving a slot without changing its clip must not delete the live clip.
  assert.deepEqual(
    retirableKeys({
      previous: ['homepage-bg/slot-0/same.mp4'],
      next: ['homepage-bg/slot-0/same.mp4'],
    }),
    [],
  );
});

test('🔑 a key still present anywhere in the NEW set is never retired', () => {
  // A hero re-upload that reuses some frames must keep every reused frame.
  const out = retirableKeys({
    previous: [
      'hero-frames/s1/f-001.jpg',
      'hero-frames/s1/f-002.jpg',
      'hero-videos/old.mp4',
    ],
    next: ['hero-videos/new.mp4', 'hero-frames/s1/f-002.jpg'],
  });
  assert.deepEqual(out, ['hero-frames/s1/f-001.jpg', 'hero-videos/old.mp4']);
  assert.ok(!out.includes('hero-frames/s1/f-002.jpg'), 'a reused frame must survive');
});

test('an entire replaced frame folder is retirable', () => {
  const previous = Array.from({ length: 5 }, (_, i) => `hero-frames/s1/f-00${i}.jpg`);
  const next = Array.from({ length: 5 }, (_, i) => `hero-frames/s2/f-00${i}.jpg`);
  assert.deepEqual(retirableKeys({ previous, next }), previous);
});

test('🔑 keys outside the site-media allowlist are NEVER retirable', () => {
  // If a customer key were ever mis-stored in one of these columns, an upload
  // must not be able to delete it.
  const out = retirableKeys({
    previous: [
      'events/EVT123/photo.jpg',
      'living-heroes/couple-hero.mp4',
      'merchant-qr/gcash/code.png',
      'vendor-verification/gov-id.pdf',
    ],
    next: ['homepage-bg/slot-0/new.mp4'],
  });
  assert.deepEqual(out, []);
});

test('unparseable and empty values are dropped, not guessed at', () => {
  assert.deepEqual(
    retirableKeys({
      previous: [null, undefined, '', 'https://example.com/nothing.jpg', '   '],
      next: ['homepage-bg/slot-0/new.mp4'],
    }),
    [],
  );
});

test('URLs and r2:// refs are normalised back to keys before comparison', () => {
  // The old row may hold a public URL while the new value is a bare key. Without
  // normalising, the two never match and a still-live file looks retirable.
  assert.deepEqual(
    retirableKeys({
      previous: ['https://media.setnayan.com/hero-videos/live.mp4'],
      next: ['hero-videos/live.mp4'],
    }),
    [],
    'the same object in two notations must compare equal',
  );

  assert.deepEqual(
    retirableKeys({
      previous: ['r2://setnayan-media/hero-videos/old.mp4'],
      next: ['hero-videos/new.mp4'],
    }),
    ['hero-videos/old.mp4'],
  );
});

test('percent-encoded URLs normalise to the same key', () => {
  assert.deepEqual(
    retirableKeys({
      previous: ['https://media.setnayan.com/hero-videos/my%20hero.mp4'],
      next: ['hero-videos/my hero.mp4'],
    }),
    [],
  );
});

test('duplicates collapse, order follows first appearance', () => {
  assert.deepEqual(
    retirableKeys({
      previous: [
        'hero-frames/s1/b.jpg',
        'hero-frames/s1/a.jpg',
        'hero-frames/s1/b.jpg',
        'https://media.setnayan.com/hero-frames/s1/a.jpg',
      ],
      next: [],
    }),
    ['hero-frames/s1/b.jpg', 'hero-frames/s1/a.jpg'],
  );
});

test('an empty previous set is not an error', () => {
  assert.deepEqual(retirableKeys({ previous: [], next: ['homepage-bg/slot-0/a.mp4'] }), []);
});
