/**
 * 🖼 THE CARD MAKER'S PHOTOS ARE ONE GALLERY (owner 2026-11-13, DECISION_LOG "CARD MAKER GALLERY UPLOAD APPROVED";
 * drawing `prototypes/card_maker_gallery_upload_2026-11-13/`).
 *
 * Held on the source and on a static render (the sheet needs a tap and the seed needs an effect, so the list rules
 * themselves are held in lib/card-photos.test.ts):
 *   · the maker mounts ONE gallery for the cover + the showcase photos — no second photo uploader, no "More photos" fold;
 *   · the gallery is the shipped FileUpload in `tiles` mode, capped at CARD_MAX_PHOTOS, with the shipped failed tile;
 *   · FileUpload's add tile is the grid's last cell and is gated on `atCapacity` (gone at the limit);
 *   · the sheet: Set as primary photo (waits on the primary, its reason in an ⓘ) · Delete photo (danger) · Cancel;
 *   · the clip stays its own row;
 *   · the two field names post from the one list — the first as the primary, the rest as the showcase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

const DIR = join(__dirname, '_components');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const MAKER = strip(readFileSync(join(DIR, 'canvas-maker.tsx'), 'utf8'));
const GALLERY = strip(readFileSync(join(DIR, 'card-photo-gallery.tsx'), 'utf8'));
const UPLOAD = strip(readFileSync(join(__dirname, '../../_components/file-upload.tsx'), 'utf8'));

test('the maker mounts ONE gallery and no separate cover / showcase photo uploader', () => {
  assert.equal((MAKER.match(/<CardPhotoGallery\b/g) ?? []).length, 1);
  assert.doesNotMatch(MAKER, /<FileUpload\b/, 'the cover uploader is gone from the maker');
  assert.doesNotMatch(MAKER, /<ShowcaseMediaFields\b/, 'the boxed showcase uploader is gone from the maker');
  assert.doesNotMatch(MAKER, /More photos · a clip/);
});

test('the clip stays its own row, with the shipped clip uploader', () => {
  assert.match(MAKER, /<OpensRow\s+name="Clip"/);
  assert.equal((MAKER.match(/<ShowcaseClipField\b/g) ?? []).length, 1);
});

test('the gallery is the shipped FileUpload in tiles mode, capped at the card limit, with the shipped failed tile', () => {
  const mount = GALLERY.slice(GALLERY.indexOf('<FileUpload'), GALLERY.indexOf('/>', GALLERY.indexOf('<FileUpload')));
  assert.match(mount, /variant="gallery"/);
  assert.match(mount, /multiple/);
  assert.match(mount, /maxFiles=\{CARD_MAX_PHOTOS\}/);
  assert.match(mount, /failedSays=\{CARD_PHOTO_FAILED_SAYS\}/);
  assert.match(mount, /tiles=\{\{/);
  assert.doesNotMatch(mount, /\bname=/, 'the gallery posts the two fields itself, from its one list');
  assert.match(GALLERY, /CARD_PHOTO_FAILED_SAYS = 'Couldn’t upload\. Try again\.'/);
});

test('FileUpload draws the add tile as the grid’s last cell, gone at the limit, and no drop box in tiles mode', () => {
  const grid = UPLOAD.slice(UPLOAD.indexOf('data-upload-tiles='), UPLOAD.indexOf('</ul>', UPLOAD.indexOf('data-upload-add')));
  const addAt = grid.indexOf('data-upload-add');
  assert.ok(addAt > grid.indexOf('failed.map('), 'the add tile follows the photos, the pies and the failed tiles');
  assert.match(grid, /\{tilesMode && !atCapacity \? \(/, 'the add tile hides at the limit');
  assert.match(grid, /<ImagePlus\b/);
  assert.match(UPLOAD, /!atCapacity && !rowMode && !thumbMode && !tilesMode \? \(/, 'no big drop box beside the grid');
  // the stall watchdog and the pie are the shipped ones, not redrawn
  assert.match(UPLOAD, /const UPLOAD_STALL_MS = 45_000;/);
});

test('the sheet: Set as primary photo · Delete photo (danger) · Cancel — and Set as primary waits on the primary', () => {
  assert.match(GALLERY, /<Sheet\b/);
  assert.match(GALLERY, /label="Cancel"/);
  assert.match(GALLERY, /tone="brand"[\s\S]{0,80}label="Set as primary photo"[\s\S]{0,40}waiting=\{openIsPrimary\}/);
  assert.match(GALLERY, /tone="danger"[\s\S]{0,60}label="Delete photo"/);
  assert.match(GALLERY, /\{openIsPrimary \? \(\s*<InfoTip[\s\S]*?\{ALREADY_PRIMARY_TIP\}/, 'the greyed reason sits in the ⓘ');
});

test('deleting the primary is said in one line with Undo, through the shipped Undo toast', () => {
  assert.match(GALLERY, /pushUndo\(\{/);
  assert.match(GALLERY, /'Deleted\. The next photo is now the primary\.'/);
  assert.match(MAKER, /<UndoToastHost \/>/, 'the maker mounts the toast the gallery speaks through');
});

test('every help line is in the section ⓘ, none printed under the grid', () => {
  assert.match(MAKER, /tip=\{[^}]*CARD_PHOTOS_FULL_TIP : CARD_PHOTOS_TIP\}/);
  assert.doesNotMatch(GALLERY, /\bhelp=/);
});

test('a static render posts the primary first and the rest as the showcase, with the quiet count', async () => {
  const { CardPhotoGallery } = await import('./_components/card-photo-gallery');
  const html = renderToStaticMarkup(
    React.createElement(CardPhotoGallery, {
      vendorProfileId: 'v1',
      primaryCurrent: 'r2://media/p.jpg',
      showcaseCurrent: ['r2://media/a.jpg', 'r2://media/b.jpg'],
    }),
  );
  const inputs = [...html.matchAll(/<input type="hidden" name="([a-z_0-9]+)" value="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(inputs, [
    ['primary_photo_r2_key', 'r2://media/p.jpg'],
    ['showcase_photo_r2_keys', 'r2://media/a.jpg'],
    ['showcase_photo_r2_keys', 'r2://media/b.jpg'],
  ]);
  assert.match(html, /3 of 6 photos/);
  assert.match(html, /data-upload-add=""/, 'below the limit the add tile is drawn');
});
