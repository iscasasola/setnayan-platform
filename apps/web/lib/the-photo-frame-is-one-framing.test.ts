/**
 * THE PHOTO FRAME IS ONE FRAMING — every size derived from it, the mark always
 * in view (Photo Frame Template, owner-approved 2026-11-04; slice A1b).
 *
 * Pure checks of `lib/photo-frame.ts` against the template contract, plus
 * source guards on the Frame step, FileUpload and the call sites. Each guard
 * marked SABOTAGE-PROVEN was broken on purpose and went red (runs listed in
 * the changelog fragment).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  DEFAULT_FRAMING,
  FRAME_ASPECT,
  RELEASE_PX,
  SNAP_PX,
  clampFraming,
  deriveRect,
  frameRect,
  framedFileName,
  framingFromRef,
  rectImageStyle,
  snapFocus,
  snapZoom,
  zoomAbout,
  type Framing,
} from './photo-frame';
import { markSquareForFrame, type Box } from './photo-mark-geometry';
import { evenCrop } from './video-compress';

const ROOT = process.cwd();
const code = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const inside = (a: Box, b: Box, e = 1e-6) =>
  a.left >= b.left - e && a.top >= b.top - e && a.left + a.width <= b.left + b.width + e && a.top + a.height <= b.top + b.height + e;

function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('the default framing is today\'s centre crop — "Looks good" with no touch changes nothing', () => {
  const r = frameRect(1200, 1600, 1, DEFAULT_FRAMING);
  assert.deepEqual(r, { left: 0, top: 200, width: 1200, height: 1200 });
  const w = frameRect(1600, 900, 2.5, DEFAULT_FRAMING);
  assert.equal(Math.round(w.width), 1600);
  assert.equal(Math.round(w.height), 640);
  assert.equal(Math.round(w.top), 130);
});

test('the frame never leaves the image, at any focus and zoom (no bars, ever)', () => {
  const r = rnd(7);
  for (let i = 0; i < 4000; i += 1) {
    const iw = 200 + Math.floor(r() * 4000);
    const ih = 200 + Math.floor(r() * 4000);
    for (const shape of ['square', 'wide', 'circle'] as const) {
      const f: Framing = { focusX: r() * 1.4 - 0.2, focusY: r() * 1.4 - 0.2, zoom: 0.5 + r() * 3 };
      const fr = frameRect(iw, ih, FRAME_ASPECT[shape], f);
      assert.ok(inside(fr, { left: 0, top: 0, width: iw, height: ih }), `${shape} ${iw}×${ih} ${JSON.stringify(f)}`);
      assert.ok(Math.abs(fr.width / fr.height - FRAME_ASPECT[shape]) < 1e-9);
      const c = clampFraming(iw, ih, FRAME_ASPECT[shape], f);
      assert.ok(c.zoom >= 1 && c.zoom <= 3);
    }
  }
});

test('SABOTAGE-PROVEN: any size shows the frame\'s MARK SQUARE whole — widen, or cut from the top', () => {
  const r = rnd(11);
  // Every place a framed supplier photo is drawn: the 5:7 service card, square
  // tiles, the 1.56 sheet hero, the 2.8 Find banner, the shop heroes (2.46, 3, 4).
  const places = [5 / 7, 0.8, 1, 1.56, 1.91, 358 / 128, 1024 / 416, 3, 4];
  for (let i = 0; i < 3000; i += 1) {
    const iw = 300 + Math.floor(r() * 3700);
    const ih = 300 + Math.floor(r() * 3700);
    const f: Framing = { focusX: r(), focusY: r(), zoom: 1 + r() * 2 };
    const fr = frameRect(iw, ih, 1, f);
    const sq = markSquareForFrame(fr);
    for (const A of places) {
      const d = deriveRect(iw, ih, 1, f, A);
      assert.ok(Math.abs(d.width / d.height - A) < 1e-6, 'the place keeps its aspect');
      assert.ok(inside(d, { left: 0, top: 0, width: iw, height: ih }), 'never past the original');
      // The mark lives at the bottom-right of the frame square; the place must
      // keep that corner region (the bottom ~35 % of the square, its right half).
      const markZone: Box = { left: sq.left + sq.width * 0.45, top: sq.top + sq.height * 0.62, width: sq.width * 0.55, height: sq.height * 0.38 };
      const room = Math.min(d.width, d.height) / Math.min(fr.width, fr.height);
      if (room >= 0.999) assert.ok(inside(markZone, d, 1e-3), `A=${A} ${iw}×${ih} ${JSON.stringify(f)}: the mark is cut off`);
      // Wider views show more around the frame, never less (when the original has room).
      if (A >= 1 && iw >= d.width + 1 && d.height >= fr.height - 1e-6) assert.ok(inside(fr, d, 1e-3), `A=${A}: less than the frame`);
    }
  }
});

test('the framing rides in the stored name, and comes back exactly', () => {
  const f = { focusX: 0.6123, focusY: 0.4, zoom: 1.75, width: 4032, height: 3024 };
  const name = framedFileName('IMG_2041.HEIC.jpg', f);
  assert.equal(name, 'fr-6123-4000-1750-4032x3024.jpg');
  const key = `r2://setnayan-media/vendors/abc/services/9b2e-${name}`;
  assert.deepEqual(framingFromRef(key), f);
  // The display URL carries the key — with or without a signature after it.
  assert.deepEqual(framingFromRef(`https://media.example/vendors/abc/services/9b2e-${name}?X-Amz-Signature=1`), f);
  // Never framed / not ours / out of range → null (drawn exactly as before).
  assert.equal(framingFromRef('r2://setnayan-media/vendors/abc/services/9b2e-photo.jpg'), null);
  assert.equal(framingFromRef('r2://x/y-fr-12000-4000-1750-10x10.jpg'), null);
  assert.equal(framingFromRef('r2://x/y-fr-5000-4000-0500-10x10.jpg'), null);
  assert.equal(framingFromRef(null), null);
});

test('the display style draws exactly the derived rect', () => {
  const s = rectImageStyle(2000, 1000, { left: 500, top: 100, width: 800, height: 800 });
  assert.deepEqual(s, { position: 'absolute', left: '-62.5%', top: '-12.5%', width: '250%', height: '125%', maxWidth: 'none' });
});

test('snapping: the centre catches within 7 px and lets go only past 11 px; zoom settles on 1× within 8 %', () => {
  const px = 1000; // CSS px per unit of focus
  const off = { x: false, y: false, z: false };
  const caught = snapFocus({ focusX: 0.5 + (SNAP_PX - 0.5) / px, focusY: 0.2 }, px, px, off);
  assert.equal(caught.focusX, 0.5);
  assert.equal(caught.ticked, true);
  const notYet = snapFocus({ focusX: 0.5 + (SNAP_PX + 0.5) / px, focusY: 0.2 }, px, px, off);
  assert.notEqual(notYet.focusX, 0.5);
  const held = snapFocus({ focusX: 0.5 + (RELEASE_PX - 0.5) / px, focusY: 0.2 }, px, px, caught.snap);
  assert.equal(held.focusX, 0.5, 'no early release');
  assert.equal(held.ticked, false, 'one tick per catch');
  const freed = snapFocus({ focusX: 0.5 + (RELEASE_PX + 0.5) / px, focusY: 0.2 }, px, px, caught.snap);
  assert.notEqual(freed.focusX, 0.5);
  assert.equal(snapZoom(1.07, off).zoom, 1);
  assert.equal(snapZoom(1.09, off).zoom, 1.09);
  assert.equal(snapZoom(9, off).zoom, 3);
});

test('a pinch zooms around the pinch centre — the pixel under the fingers stays under them', () => {
  const iw = 3000;
  const ih = 2000;
  const f = { focusX: 0.5, focusY: 0.5, zoom: 1 };
  const p = { x: 300, y: 80 };
  const z = zoomAbout(iw, ih, 390, 390, f, p, 2);
  const under = (g: Framing) => {
    const sc = Math.max(390 / iw, 390 / ih) * g.zoom;
    return [g.focusX + (p.x - 195) / (sc * iw), g.focusY + (p.y - 195) / (sc * ih)];
  };
  const [a, b] = under(f);
  const [c, d] = under(z);
  assert.ok(Math.abs(a! - c!) < 1e-9 && Math.abs(b! - d!) < 1e-9);
});

test('the clip crop is whole even pixels inside the clip', () => {
  assert.deepEqual(evenCrop({ left: 419.6, top: -3, width: 1079.4, height: 1079.4 }, 1920, 1080), { x: 420, y: 0, w: 1078, h: 1078 });
  assert.deepEqual(evenCrop({ left: 1500, top: 0, width: 1080, height: 1080 }, 1920, 1080), { x: 840, y: 0, w: 1080, h: 1080 });
});

/* ── source guards ─────────────────────────────────────────────────────── */

test('SABOTAGE-PROVEN: every supplier photo upload opens the Frame step (square); the logo is NOT framed here', () => {
  const sites: Array<[string, string, number]> = [
    ['app/vendor-dashboard/services/_components/canvas-maker.tsx', 'service-card', 1],
    ['app/vendor-dashboard/services/_components/services-manager.tsx', 'service-card', 1],
    ['app/vendor-dashboard/services/_components/service-wizard.tsx', 'service-card', 1],
    ['app/vendor-dashboard/shop/_components/gallery-media.tsx', 'portfolio', 1],
  ];
  for (const [file, prev, n] of sites) {
    const src = code(file);
    const hits = src.match(new RegExp(`mark="supplier"\\s+frame="square"\\s+previews="${prev}"`, 'g')) ?? [];
    assert.equal(hits.length, n, `${file}: the supplier upload must open the Frame step (frame="square" previews="${prev}")`);
  }
  const showcase = code('app/vendor-dashboard/services/_components/showcase-media-fields.tsx');
  assert.match(showcase, /mark="supplier"\s+frame="square"\s+previews="service-card"\s+compressImage/);
  assert.match(showcase, /mark="supplier"\s+frame="square"\s+previews="service-video"\s+compressVideo/);
  // The round logo is framed by ONE control, PictureFrameControl (owner 7 Nov, A3 — `logo_focal_x/y` + `logo_zoom`),
  // which shipped after this design was approved: a second framing for the same picture would be a competing truth.
  for (const file of ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'app/open-shop/logo/_components/add-your-logo.tsx']) {
    assert.doesNotMatch(code(file), /frame="circle"/, `${file}: the logo is framed by PictureFrameControl, not the Frame step`);
  }
});

test('SABOTAGE-PROVEN: FileUpload frames BEFORE it marks, stamps inside the frame, and names the copy with its framing', () => {
  const src = code('app/_components/file-upload.tsx');
  const spec = src.indexOf('markInput = await door.markSpec(mark, pathPrefix)');
  const ask = src.indexOf('framed = await askFraming(');
  const paint = src.indexOf('file = await door.markFile(rawFile, markInput,');
  assert.ok(spec > 0 && ask > spec && paint > ask, 'ask the mark, THEN the Frame step (it shows the mark), THEN paint');
  assert.match(src, /framed: framed && frame \? \{ \.\.\.framed, shape: frame \} : null,/, 'the painter is handed the framing');
  assert.match(src, /if \(!framed\) return;/, 'backing out uploads nothing');
  assert.match(src, /framedFileName\(file\.name, \{ \.\.\.framed\.framing, \.\.\.framed\.size \}\)/);
  // The lazy door stamps inside the frame and crops the clip to it (lifted out of FileUpload 2026-11-08).
  const door = code('app/_components/upload-mark.ts');
  assert.match(door, /frame: frameRect\(framed\.size\.width, framed\.size\.height, FRAME_ASPECT\[framed\.shape\], framed\.framing\), shape: framed\.shape/);
  assert.match(door, /markPhotoFile\(rawFile, inFrame \? \{ \.\.\.input, framed: inFrame \} : input\)/);
  assert.match(door, /crop: framed \? \(w, h\) => frameRect\(w, h, FRAME_ASPECT\[framed\.shape\], framed\.framing\) : undefined/, 'the clip is cropped to its frame');
  assert.match(door, /photoMark\('original', \{ publicRef \}\)/);
  // Re-open re-frames the CLEAN original — a supplier photo's private copy, never its marked display URL.
  const re = src.slice(src.indexOf('async function reframe('), src.indexOf('function cancelInFlight('));
  assert.match(re, /if \(mark === 'supplier'\) url = await door\.originalUrl\(item\.r2Ref\);/);
  assert.doesNotMatch(re.slice(0, re.indexOf('else if (!mark)')), /item\.displayUrl/, 'a marked copy re-framed would carry two marks');
  assert.match(re, /uploadOne\(raw, \{ replaceId: item\.id, initial \}\)/);
  assert.match(src, /at >= 0 \? prev\.map\(\(i, n\) => \(n === at \? completed : i\)\)/, 'the re-framed copy takes the old one\'s place');
});

test('SABOTAGE-PROVEN: the Frame step owns the gestures the contract lists, and the page never zooms under them', () => {
  const src = code('app/_components/frame-step.tsx');
  assert.match(src, /\.fst-stage\{[^}]*touch-action:none/);
  for (const ev of ["'pointerdown'", "'pointermove'", "'wheel', onWheel, { passive: false }", "'gesturestart'", "'gesturechange'", "'touchmove', stop, { passive: false }", "'dblclick'"]) {
    assert.ok(src.includes(`addEventListener(${ev}`), `missing ${ev}`);
  }
  assert.match(src, /if \(e\.ctrlKey \|\| e\.metaKey\) \{\s*zoomAt\(/, 'trackpad pinch (ctrl+wheel) zooms about the cursor');
  assert.match(src, /navigator\.vibrate\(8\)/);
  assert.match(src, /window\.matchMedia\('\(pointer: coarse\)'\)/, 'the How-to line adapts to the device');
  assert.match(src, /Looks good/);
  assert.match(src, /return layoutMarkInFrame\(fr, shape, mark\.spec/, 'the stage shows the SAME mark layout that is burned in');
});

test('the display sites draw the saved framing', () => {
  assert.match(code('app/vendor-dashboard/services/_components/service-card-face.tsx'), /<FramedImg src=\{coverUrl\} aspect=\{80 \/ 112\} \/>/);
  assert.match(code('app/dashboard/[eventId]/vendors/_components/supplier-sheet.tsx'), /<FramedImg src=\{src\} aspect=\{1\}/);
  assert.match(code('app/_components/marked-photo.tsx'), /const framed = framedImageStyle\(src, frame, displayAspect\);/);
  // The avatar keeps the logo's OWN frame (PictureFrameControl's columns), never a Frame-step framing.
  assert.match(code('app/_components/vendor-avatar.tsx'), /style=\{logoFrameStyle\(frame\)\}/);
});
