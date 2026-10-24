/**
 * 🏷 THE MARK ON THE PHOTOS — owner 2026-10-24, final: *"Free: plain camera with a
 * small Setnayan mark on saved photos. Pro: their logo on the shutter, theme
 * colours, and their monogram on saved photos. No frames."*
 *
 *   1. free → the Setnayan mark; pro → the couple's monogram; pro with no
 *      monogram of their own → the Setnayan mark;
 *   2. the original is never in the marked tiers, and the only painter call is
 *      inside the copy-maker (`resizeTo`), reached only by the copies;
 *   3. the chip sits bottom-right, inside the picture, small;
 *   4. both camera mounts ask the one resolver, with the Logo & QR part.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { MARKED_TIERS, markBox, papicMarkFor, SETNAYAN_PHOTO_MARK } from './papic-photo-mark';
import { photoMarkOfEvent } from './papic-photo-mark-of-event';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ROW = {
  display_name: 'Ana & Ben',
  monogram_text: 'A&B',
  monogram_color: '#7A1F2B',
  monogram_custom_svg: null,
  monogram_uploaded_svg: null,
};

test('1 · free → the Setnayan mark, pro → their monogram, pro with none of their own → the Setnayan mark', () => {
  assert.deepEqual(papicMarkFor({ pro: false, monogramSvg: '<svg/>', monogramText: 'A&B' }), SETNAYAN_PHOTO_MARK);
  const pro = papicMarkFor({ pro: true, monogramSvg: null, monogramText: 'A&B', monogramInk: '#7A1F2B' });
  assert.equal(pro.kind, 'monogram');
  assert.equal(pro.kind === 'monogram' && pro.text, 'A&B');
  assert.deepEqual(papicMarkFor({ pro: true, monogramSvg: null, monogramText: '  ' }), SETNAYAN_PHOTO_MARK);
  // …through the one resolver both mounts call:
  assert.deepEqual(photoMarkOfEvent(ROW, false), SETNAYAN_PHOTO_MARK, 'a free event carries their monogram');
  assert.equal(photoMarkOfEvent(ROW, true).kind, 'monogram', 'a Pro event does not carry their monogram');
  assert.deepEqual(
    photoMarkOfEvent({ ...ROW, monogram_text: null }, true),
    SETNAYAN_PHOTO_MARK,
    'a name-derived "S" is not their monogram — fall back to the Setnayan mark',
  );
});

test('2 · the original is never marked', () => {
  assert.ok(!(MARKED_TIERS as readonly string[]).includes('original'), 'the original is a marked tier');
  assert.ok(!(MARKED_TIERS as readonly string[]).some((t) => t.startsWith('clip')), "a clip's own bytes are marked");
  const prepare = read('lib/papic-upload/prepare.ts');
  // The painter is called in exactly one place — the copy-maker — and only with a mark handed in.
  assert.equal((prepare.match(/paintMark\(/g) ?? []).length, 1);
  assert.match(prepare, /if \(mark\) await paintMark\(ctx, fit\.w, fit\.h, mark\)/);
  assert.match(prepare, /makePhotoPieces\(original: Blob, mark: PapicMark \| null = null\)/);
  assert.match(prepare, /makePoster\(poster: Blob, mark: PapicMark \| null = null\)/);
  // The develop step (it makes the ORIGINAL) never paints, and the shutter's face copy never carries a mark.
  assert.doesNotMatch(read('lib/papic-upload/develop.ts'), /paintMark|papic-photo-mark/);
  const cam = read('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.match(cam, /faceSource = await resizeTo\(canvas, 1280, 0\.85\);/, 'the face copy gained an argument');
  // The original is stored from the shutter's bytes, untouched.
  assert.match(read('lib/papic-upload/replayer.ts'), /await this\.putBlob\(shot, 'original', input\.primary\);/);
});

test('3 · small, bottom-right, inside the picture — on a phone tile and a display copy', () => {
  for (const [w, h] of [[320, 240], [1280, 960], [720, 1280]] as const) {
    const b = markBox(w, h, 1);
    assert.ok(b.x > w / 2 && b.y > h / 2, `${w}×${h}: not in the bottom-right`);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, `${w}×${h}: outside the picture`);
    assert.ok(b.h <= Math.max(14, Math.max(w, h) * 0.05), `${w}×${h}: not small`);
  }
});

test('4 · both camera mounts ask the one resolver, with the Logo & QR part', () => {
  const page = read('app/papic/guest/page.tsx');
  assert.match(page, /eventHubPartActive\(admin, session\.event_id, 'logo_qr'\)/);
  assert.match(page, /photoMarkOfEvent\(dressRow, pro\)/);
  assert.match(page, /photoMark=\{photoMark\}/);
  assert.match(read('app/[slug]/_lib/loaders.ts'), /photoMark: photoMarkOfEvent\(event, await hubPartActiveFor\(event\.event_id, 'logo_qr'\)/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /photoMark=\{papicGuest\.photoMark\}/);
  // Every guest shot hands its mark to the queue (photo and clip).
  const cam = read('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.equal((cam.match(/ownerTag: uploadOwner,\s*mark,/g) ?? []).length, 2);
});
