/**
 * the-print-box-takes-the-pieces-shape.test.ts — owner, iPhone, 2026-10-05, on
 * Event Details: under the 5 × 7 card ("5 × 7 in · 127 × 177.8 mm · rounded
 * cut") "a large empty grey rounded box with nothing in it".
 *
 * MEASURED on the live Maker (maria-and-jose, 375 px, Event Details › Names):
 * the box was the EVENT PASS — a landscape card drawn 255 × 153 px, centred in
 * the 340 px box every piece got, so its top 93 px were empty grey, and the
 * guided sheet covered the card below them. The box now takes its piece's shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PRINT_PREVIEW_MAX_PX, printPreviewBox } from './print-preview-view';
import { PRINT_FORMATS } from './print-pieces';

const PAD = 16; // the box's p-4

/** The empty grey above a loaded picture, for a box this wide (the picture fits inside the padding). */
function emptyAbove(boxW: number, aspect: number): number {
  const box = printPreviewBox(aspect);
  const boxH = box.style ? Math.min(PRINT_PREVIEW_MAX_PX, boxW / Number(box.style.aspectRatio)) : PRINT_PREVIEW_MAX_PX;
  const innerW = boxW - 2 * PAD;
  const innerH = boxH - 2 * PAD;
  const picH = Math.min(innerH, innerW / aspect);
  return PAD + (innerH - picH) / 2;
}

test('1 · a landscape pass starts at the top of its box — no empty grey above it', () => {
  for (const id of ['calling-card', 'cr80', 'train', 'boarding'] as const) {
    const f = PRINT_FORMATS[id];
    const gap = emptyAbove(287, f.wMm / f.hMm);
    console.log(`  ${id}: ${gap.toFixed(1)} px of grey above the picture`);
    assert.ok(gap <= PAD + 1, `${id}: ${gap.toFixed(0)} px of empty grey above the card (was 93 px for the calling card)`);
  }
});

test('2 · a portrait piece sits snug too, and the box never grows past the cap', () => {
  const inv = PRINT_FORMATS['inv-5x7'];
  const a = inv.wMm / inv.hMm;
  // The box's padding sits inside its shape, so a portrait card keeps a few px of
  // grey above it — never the 45 px a 340 px box left over a 210 px-wide card.
  const gap = emptyAbove(210, a);
  console.log(`  5 × 7 invitation: ${gap.toFixed(1)} px of grey above the picture`);
  assert.ok(gap <= PAD + 8, `5 × 7: ${gap.toFixed(0)} px of empty grey above the card`);
  const wide = printPreviewBox(a);
  assert.match(wide.className, /max-h-\[340px\]/, 'a wide column caps the box at 340 px');
  assert.doesNotMatch(wide.className, /(^|\s)h-\[340px\]/, 'a box with a shape never also has the fixed height');
  // A caller that does not know its piece's shape keeps the old box exactly.
  assert.deepEqual(printPreviewBox(), { className: 'h-[340px]' });
  assert.deepEqual(printPreviewBox(Number.NaN), { className: 'h-[340px]' });
});

const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, '..', p), 'utf8'));
const PREVIEW = read('app/dashboard/[eventId]/launch/_components/print-preview.tsx');
const PRINTS = read('app/dashboard/[eventId]/launch/_components/maker-prints.tsx');

test('3 · SOURCE: the box is drawn from printPreviewBox, and every piece body hands its shape', () => {
  assert.match(PREVIEW, /const box = printPreviewBox\(aspect\)/);
  assert.match(PREVIEW, /style=\{box\.style\}/);
  assert.doesNotMatch(PREVIEW, /(^|[\s"`])h-\[340px\]/, 'no fixed 340 px box left in the component');
  const body = PRINTS.slice(PRINTS.indexOf('export function PrintPieceBody'), PRINTS.indexOf('export function PrintPieceEditor'));
  assert.ok(body.length > 200, 'PrintPieceBody was not found — this scan is blind, not clean');
  assert.match(body, /aspect=\{fam \? formats\[fam\]\.wMm \/ formats\[fam\]\.hMm : spec\.widthPt \/ spec\.heightPt\}/);
});
