/**
 * photo-arrives.test.ts — 🖼 PHOTO ARRIVES (motion standard 18 Nov 2026, § 4 #20): Move 320 · Settle, opacity plus a
 * tiny settle; reduced motion: at once; never hides a photo, never moves the layout, never fades the page's first
 * picture, never reaches the couple's Event Hub.
 *
 * Seen RED once each (2026-11-18), then restored — see the changelog fragment `claude-motion-loading.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { EASE_SETTLE, MOVE_MS } from '@/lib/motion-table';
import {
  PHOTO_ARRIVES,
  PHOTO_ARRIVES_KEYFRAMES,
  PHOTO_ARRIVES_SELECTOR,
  PHOTO_ARRIVES_TIMING,
  photoShouldArrive,
  playPhotoArrives,
} from '@/lib/photo-arrives';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

function img(attrs: Record<string, string> = {}, opts: { marked?: boolean; editorial?: boolean } = {}) {
  const played: Array<{ keyframes: unknown; timing: unknown }> = [];
  return {
    played,
    matches: (sel: string) => sel === PHOTO_ARRIVES_SELECTOR && opts.marked !== false,
    closest: (sel: string) => (sel === '.sn-editorial' && opts.editorial ? {} : null),
    getAttribute: (n: string) => attrs[n] ?? null,
    animate: (keyframes: unknown, timing: unknown) => void played.push({ keyframes, timing }),
  };
}

test('Move · Settle, filled backwards; opacity and scale only', () => {
  assert.deepEqual({ ...PHOTO_ARRIVES_TIMING }, { duration: MOVE_MS, easing: EASE_SETTLE, fill: 'backwards' });
  assert.equal(MOVE_MS, 320);
  for (const frame of PHOTO_ARRIVES_KEYFRAMES) {
    assert.deepEqual(Object.keys(frame).sort(), ['opacity', 'scale'], 'the arrival animates something other than opacity and scale');
  }
  assert.equal(PHOTO_ARRIVES_KEYFRAMES[0].opacity, 0);
  assert.deepEqual({ ...PHOTO_ARRIVES_KEYFRAMES[1] }, { opacity: 1, scale: '1' }, 'the arrival does not end at rest');
  const from = Number(PHOTO_ARRIVES_KEYFRAMES[0].scale);
  assert.ok(from > 1 && from <= 1.04, `the settle is not tiny (${from})`);
});

test('a marked photo arrives; reduced motion, the first picture, the Event Hub and unmarked images do not', () => {
  const plain = img();
  assert.equal(playPhotoArrives(plain, false), true);
  assert.equal(plain.played.length, 1);
  assert.deepEqual(plain.played[0]!.timing, { ...PHOTO_ARRIVES_TIMING });

  const reduced = img();
  assert.equal(playPhotoArrives(reduced, true), false, 'reduced motion still faded the photo');
  assert.equal(reduced.played.length, 0);

  assert.equal(photoShouldArrive(img({ fetchpriority: 'high' }), false), false, 'the page’s first picture was faded');
  assert.equal(photoShouldArrive(img({ loading: 'eager' }), false), false);
  assert.equal(photoShouldArrive(img({ loading: 'lazy' }), false), true);
  assert.equal(photoShouldArrive(img({}, { editorial: true }), false), false, 'a photo in the couple’s Event Hub was given the app’s motion');
  assert.equal(photoShouldArrive(img({}, { marked: false }), false), false, 'an unmarked image was faded');
  assert.equal(photoShouldArrive(null, false), false);
});

test('it can never hide a photo: no stylesheet rule touches a marked image', () => {
  const css = read('app/globals.css');
  assert.ok(!/data-sn-photo/.test(css), 'globals.css styles [data-sn-photo] — a photo could be hidden waiting for script');
  const lib = read('lib/photo-arrives.ts');
  assert.ok(!/\.style\.|setAttribute|classList/.test(lib), 'photo-arrives writes to the image — it only ever plays an animation');
  assert.match(lib, /addEventListener\('load', onLoad, true\)/, 'the one listener is not a capture listener (load does not bubble)');
});

test('the shared photo parts carry the mark, and the listener is mounted once', () => {
  assert.deepEqual({ ...PHOTO_ARRIVES }, { 'data-sn-photo': '' });
  for (const part of ['app/_components/framed-img.tsx', 'app/_components/marked-photo.tsx', 'app/_components/vendor-avatar.tsx', 'app/_components/proof-image.tsx']) {
    assert.match(read(part), /<(?:img|Image) \{\.\.\.PHOTO_ARRIVES\}/, `${part} no longer marks its photo`);
  }
  const layout = read('app/layout.tsx');
  assert.equal((layout.match(/<PhotoArrives \/>/g) ?? []).length, 1, 'the listener is not mounted exactly once in the root layout');
});
