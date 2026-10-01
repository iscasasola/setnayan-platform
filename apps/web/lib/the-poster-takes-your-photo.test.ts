/**
 * 🖼 THE A3 OUR STORY POSTER TAKES THE COUPLE'S OWN PHOTO (owner 2026-09-29,
 * DECISION_LOG "OWNER ANSWERS — TEN OPEN QUESTIONS" (1): *"Poster: can add media
 * background"* — optional; the theme's picture stays the default; print needs a
 * high-res image, so warn when too small; offered only where there is a Love Story).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { parsePrintDetails, posterPhotoRefAllowed, posterPhotoTooSmall, serializePrintDetails } from './print-pieces';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = '0e6a4f2c-1b2d-4c3e-8f9a-0b1c2d3e4f50';

test('stored and read back; a stranger’s or malformed ref is dropped; every other key survives', () => {
  const ref = `r2://setnayan-media/events/${E}/poster/a.jpg`;
  const stored = parsePrintDetails({ opening_line: 'Hello', pass_design: 'ticket', poster_photo: { ref, w: 4000, h: 6000 } });
  assert.deepEqual(stored.posterPhoto, { ref, w: 4000, h: 6000 });
  assert.equal(stored.openingLine, 'Hello');
  assert.deepEqual(parsePrintDetails(serializePrintDetails(stored)).posterPhoto, { ref, w: 4000, h: 6000 }, 'a save erases the photo');
  assert.equal(parsePrintDetails({ poster_photo: { ref: 'https://evil.example/a.jpg' } }).posterPhoto, null);
  assert.equal(parsePrintDetails({}).posterPhoto ?? null, null, 'no photo reads as a photo');
  assert.equal(posterPhotoRefAllowed(ref, E), true);
  assert.equal(posterPhotoRefAllowed(`r2://setnayan-media/events/other/poster/a.jpg`, E), false, 'another event’s file');
  assert.equal(posterPhotoRefAllowed(`r2://setnayan-media/events/${E}/../x.jpg`, E), false);
});

test('too small for A3 is said — A3 at 150 dpi, either way round', () => {
  assert.equal(posterPhotoTooSmall({ ref: 'x', w: 1200, h: 1600 }), true);
  assert.equal(posterPhotoTooSmall({ ref: 'x', w: 2480, h: 1754 }), false);
  assert.equal(posterPhotoTooSmall({ ref: 'x', w: 3508, h: 4961 }), false);
  assert.equal(posterPhotoTooSmall({ ref: 'x', w: null, h: null }), false, 'an unmeasured photo is accused');
});

test('the poster draws it full-bleed under a paper veil; the route saves only the couple’s own, measured', () => {
  const layout = read('lib/print-layout.ts');
  assert.match(layout, /const placed = data\.hasPosterBg \? posterGround\(front\.ops, look, w, h, bleed\) : still\(/);
  assert.match(layout, /ref: 'posterBg', x: -b, y: -b, w: w \+ 2 \* b, h: h \+ 2 \* b/);
  const set = read('lib/print-set.server.ts');
  assert.match(set, /const posterBg = stored\.posterPhoto \? await posterPhotoBytes\(stored\.posterPhoto\.ref, opts\.mode\) : null;/);
  const route = read('app/api/hub-print/[piece]/route.ts');
  const post = route.slice(route.indexOf("if (piece === 'poster-photo') {"));
  assert.match(post, /if \(!posterPhotoRefAllowed\(ref, eventId\)\) return NextResponse\.json\(\{ ok: false \}, \{ status: 400 \}\)/);
  assert.match(post, /\.metadata\(\)/, 'the photo is not measured');
  assert.match(post, /tooSmall: posterPhotoTooSmall\(photo\)/);
  const prints = read('app/dashboard/[eventId]/launch/_components/maker-prints.tsx');
  assert.match(prints, /\{k === 'story-poster' && !storyMissing \? <PosterPhotoPicker eventId=\{input\.eventId\} saved=\{input\.posterPhoto \?\? null\} \/> : null\}/);
  const picker = read('app/dashboard/[eventId]/launch/_components/poster-photo-picker.tsx');
  assert.match(picker, /<PickMenu\b/, 'the choice is not one dropdown');
  assert.doesNotMatch(picker, /compressImage/, 'the print photo is squeezed in the browser');
});
