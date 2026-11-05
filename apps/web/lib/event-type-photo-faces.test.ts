/**
 * The event-type photos keep their faces in the launcher and dashboard bands.
 *
 * 2026-11-04: the owner's new renders put faces in the top 10–35 % of the frame, and
 * the band (a fifth to a half of the photo's height) showed 13 of 17 types with no
 * heads. These tests hold the fix:
 *
 *   1. every repo photo has a measured face span, and every span has a photo — a new
 *      or renamed file cannot ship without one;
 *   2. at every band size measured in the browser, for every per-event slide, the top
 *      of the faces is inside the band, and the whole span is when it fits;
 *   3. the CSS the browser runs computes the same offset as the numeric twin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  EVENT_CARD_FACE_FOOT,
  EVENT_CARD_FACE_HEADROOM,
  eventCardFaceSlide,
  faceFramedObjectPosition,
  faceFramedOffsetPx,
} from './event-card-art';
import { EVENT_TYPE_PHOTO_ASPECT, EVENT_TYPE_PHOTO_FACES, faceSpanForTypePhoto } from '@/app/dashboard/(account)/create-event/_components/event-types';

const PHOTOS = join(__dirname, '..', 'public', 'event-types');

/** Band sizes measured on 2026-11-04 (lab, real components), with what covers each foot. */
const BANDS = [
  { name: 'launcher · 390', w: 356, h: 128, footClear: EVENT_CARD_FACE_FOOT },
  { name: 'launcher · 1280', w: 230, h: 144, footClear: EVENT_CARD_FACE_FOOT },
  { name: 'dashboard · 390', w: 356, h: 112, footClear: 0.6 },
  { name: 'dashboard · 1280', w: 478, h: 112, footClear: 0.6 },
] as const;

const SLIDES = [0, 1 / 3, 2 / 3, 1];

test('every repo event-type photo has a measured face span, and every span has a photo', () => {
  const files = readdirSync(PHOTOS)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/\.webp$/, ''))
    .sort();
  assert.deepEqual(Object.keys(EVENT_TYPE_PHOTO_FACES).sort(), files);
  for (const [key, [top, bottom]] of Object.entries(EVENT_TYPE_PHOTO_FACES)) {
    assert.ok(top >= 0 && bottom <= 1 && top < bottom, `${key}: [${top}, ${bottom}] is not a span inside the photo`);
  }
});

test('the span applies only to the repo file — an admin upload is a different picture', () => {
  assert.deepEqual(faceSpanForTypePhoto('wedding', '/event-types/wedding.webp'), EVENT_TYPE_PHOTO_FACES.wedding);
  assert.equal(faceSpanForTypePhoto('wedding', 'https://media.example/wedding-hero.webp'), null);
  assert.equal(faceSpanForTypePhoto('wedding', '/event-types/debut.webp'), null);
  assert.equal(faceSpanForTypePhoto('concert', '/event-types/concert.webp'), null);
  assert.equal(faceSpanForTypePhoto('toString', '/event-types/toString.webp'), null);
});

test('heads stay in the band at every measured size, for every event', () => {
  for (const band of BANDS) {
    const hi = band.w * EVENT_TYPE_PHOTO_ASPECT;
    const usable = (band.footClear - EVENT_CARD_FACE_HEADROOM) * band.h;
    for (const [key, [s0, s1]] of Object.entries(EVENT_TYPE_PHOTO_FACES)) {
      for (const slide of SLIDES) {
        const L = faceFramedOffsetPx(band, [s0, s1], slide, { footClear: band.footClear, aspect: EVENT_TYPE_PHOTO_ASPECT });
        const where = `${key} · ${band.name} · slide ${slide.toFixed(2)}`;
        assert.ok(L <= 0 && L >= band.h - hi - 0.01, `${where}: the photo no longer covers the band`);
        const top = L + s0 * hi;
        assert.ok(top >= 0 && top <= band.footClear * band.h, `${where}: the top of the faces is outside the band (${top.toFixed(1)} px)`);
        if ((s1 - s0) * hi <= usable) {
          const bottom = L + s1 * hi;
          assert.ok(bottom <= band.footClear * band.h + 0.01, `${where}: chins fall under the foot (${bottom.toFixed(1)} px)`);
          assert.ok(top >= Math.min(EVENT_CARD_FACE_HEADROOM * band.h, s0 * hi) - 0.01, `${where}: heads touch the top edge`);
        } else {
          // Too tall for the window: pinned at the top so the heads are the part kept.
          assert.ok(Math.abs(top - Math.min(EVENT_CARD_FACE_HEADROOM * band.h, s0 * hi)) < 0.01, `${where}: a tall span must pin its top`);
        }
      }
    }
  }
});

test('events of one type still differ — four slides, spread over the room there is', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 400; i += 1) seen.add(eventCardFaceSlide(`S89E-SLIDE${i}`));
  assert.deepEqual([...seen].sort(), SLIDES);
  // Where there is room, the four slides are four different pictures. (A photo whose
  // faces touch its own top edge has no room to slide up into; mirror and colour
  // still tell those events apart.)
  const band = BANDS[0];
  const offsets = SLIDES.map((s) => Math.round(faceFramedOffsetPx(band, EVENT_TYPE_PHOTO_FACES.reunion!, s)));
  assert.equal(new Set(offsets).size, 4, `reunion on ${band.name}: ${offsets.join(', ')}`);
});

/** Evaluate the object-position's vertical part for a container of w×h px. */
function evalCssOffset(css: string, w: number, h: number): number {
  const y = css.replace(/^50% /, '');
  const js = y
    .replace(/(-?\d+(?:\.\d+)?)cqw/g, (_, n) => `(${n}*${w}/100)`)
    .replace(/(-?\d+(?:\.\d+)?)cqh/g, (_, n) => `(${n}*${h}/100)`)
    .replace(/(\d)px/g, '$1')
    .replace(/calc\(/g, '(')
    .replace(/\bmin\(/g, 'Math.min(')
    .replace(/\bmax\(/g, 'Math.max(');
  assert.match(js, /^[\d\s.+\-*/(),Mathminx]+$/, `unexpected token in ${js}`);
  return Function(`return (${js});`)() as number;
}

test('the CSS the browser runs lands where the numeric twin says', () => {
  for (const band of BANDS) {
    for (const [key, span] of Object.entries(EVENT_TYPE_PHOTO_FACES)) {
      for (const slide of SLIDES) {
        const opts = { footClear: band.footClear, aspect: EVENT_TYPE_PHOTO_ASPECT };
        const css = faceFramedObjectPosition(span, slide, opts);
        const px = faceFramedOffsetPx(band, span, slide, opts);
        assert.ok(Math.abs(evalCssOffset(css, band.w, band.h) - px) < 0.6, `${key} · ${band.name}: CSS and numeric disagree`);
      }
    }
  }
});
