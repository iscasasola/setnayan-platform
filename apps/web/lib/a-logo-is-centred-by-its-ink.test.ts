/**
 * 🎯 A LOGO IS ALWAYS CENTRED BY ITS INK (owner 2026-09-28, showing an "AM"
 * logo sitting left of centre above the names on the hero: *"when a logo is
 * created and it is not centered. you should automatically center it and not
 * rely on how they aligned it to the left"*).
 *
 * Held in RENDERED PIXELS, not in the numbers the code computes: each logo is
 * framed by THE resolver, drawn into a square slot the way every surface draws
 * it (viewBox + the default `xMidYMid meet`), and the ink's own bounding box is
 * read back from the alpha channel.
 *
 *   1. an "AM" set in Pinyon Script — whose "A" swash reaches ~490 units past
 *      its advance box — dragged to the left of the artboard, lands centred
 *      within ±1px of the slot's centre, and no ink touches the slot's edge;
 *   2. a curve whose control handles reach far past its ink (the box must be
 *      the ink's, measured at the curve's extrema, not its handles'), placed
 *      off-centre on both axes, lands centred within ±1px;
 *   3. the layers are untouched — the file after the root tag is byte-for-byte
 *      the same, so Draw on (which works in each layer's own box) and the
 *      editor's read-back see exactly what the couple made;
 *   4. every saved logo gets it through the resolver, the read-time gate still
 *      passes the result, it is idempotent, and a mark that is not a layered
 *      logo passes through untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { parse as parseFont } from 'opentype.js';
import {
  LOGO_FRAME,
  centreLogoOnItsInk,
  composeLogoSvg,
  defaultMotion,
  parseLogoSvg,
  type LogoLayer,
} from './logo-layers';
import { resolveEventMonogramSvg, safeMonogramSvg } from './monogram-svg-safe';
import { heroMarkSvg } from './hero-monogram-data';
import { unwrapMark } from './event-app-icon';

const ROOT = join(__dirname, '..');
/** The slot, in CSS px (a phone hero draws the mark at 80–160px). */
const SLOT = 160;

/** A text layer exactly as the Logo editor builds one (`textShapes` in
 *  maker-logo.tsx): the words' OUTLINE box, shifted to 0,0. */
function textLayer(id: string, words: string, fontFile: string, x: number, y: number, scale: number): LogoLayer {
  const b = readFileSync(join(ROOT, fontFile));
  const face = parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  const S = 200;
  const bb = face.getPath(words, 0, 0, S).getBoundingBox();
  const d = face.getPath(words, -bb.x1, -bb.y1, S).toPathData(2);
  return {
    id,
    kind: 'text',
    name: words,
    x,
    y,
    scale,
    color: '#5C2542',
    motion: defaultMotion(0),
    text: words,
    font: 'pinyon',
    body: `<path d="${d}"/>`,
    w: bb.x2 - bb.x1,
    h: bb.y2 - bb.y1,
  };
}

/** Draw a logo into a SLOT × SLOT square the way a surface does, and read back
 *  where its ink is. */
async function inkInSlot(svg: string): Promise<{ x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }> {
  const sized = svg.replace(/^<svg\b/, `<svg width="${SLOT}" height="${SLOT}"`);
  const { data, info } = await sharp(Buffer.from(sized), { density: 72 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, SLOT, 'rendered at the slot size');
  assert.equal(info.height, SLOT);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if ((data[(y * info.width + x) * 4 + 3] as number) > 8) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
  }
  assert.ok(x1 > x0 && y1 > y0, 'the logo drew some ink');
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* ── 1 · the owner's case: an "AM" with a swash, dragged to the left ───────── */

test('1 · an off-centre "AM" with a swash lands centred within ±1px, and nothing is clipped', async () => {
  // Pinyon's "A" swash reaches past its advance box: the fixture must BE a swash.
  const b = readFileSync(join(ROOT, 'public/monogram-studio/fonts/PinyonScript-Regular.ttf'));
  const face = parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  const A = (face as unknown as { charToGlyph: (c: string) => { advanceWidth?: number; getBoundingBox: () => { x2: number } } }).charToGlyph('A');
  const ab = A.getBoundingBox();
  assert.ok(ab.x2 > (A.advanceWidth ?? 0) + 200, `the "A" swash reaches ${ab.x2 - (A.advanceWidth ?? 0)} units past its advance`);

  // Where the owner's logo sat: left of centre, and a little high.
  const am = textLayer('am', 'AM', 'public/monogram-studio/fonts/PinyonScript-Regular.ttf', 330, 440, 0.5);
  const composed = composeLogoSvg([am])!;

  // BEFORE: the artboard is what gets centred — the ink sits left.
  const before = await inkInSlot(composed);
  assert.ok(before.cx < SLOT / 2 - 10, `the fixture really is off-centre before (ink centre x = ${before.cx})`);

  // AFTER: through THE resolver, as every surface asks for it.
  const framed = resolveEventMonogramSvg({ monogram_custom_svg: composed })!;
  const after = await inkInSlot(framed);
  assert.ok(Math.abs(after.cx - SLOT / 2) <= 1, `ink centre x = ${after.cx}, slot centre = ${SLOT / 2}`);
  assert.ok(Math.abs(after.cy - SLOT / 2) <= 1, `ink centre y = ${after.cy}, slot centre = ${SLOT / 2}`);
  // Not clipped: a clear margin on every side (the swash included).
  assert.ok(after.x0 >= 2 && after.y0 >= 2 && after.x1 <= SLOT - 2 && after.y1 <= SLOT - 2, `ink box ${JSON.stringify(after)} touches the edge`);
  // …and it now fills the slot across, instead of an artboard's worth of air.
  assert.ok(after.x1 - after.x0 > (before.x1 - before.x0) * 1.5, 'the empty artboard around the logo is gone');
});

/* ── 2 · the box is the INK's, not the handles' ────────────────────────────── */

test('2 · a curve whose handles overshoot its ink is centred by the ink, within ±1px', async () => {
  // The handles reach y = -900; the ink tops out near y = -225 (3/4 of the way).
  const hump: LogoLayer = {
    id: 'hump',
    kind: 'image',
    name: 'hump',
    x: 640,
    y: 700,
    scale: 0.4,
    color: '#1E2229',
    motion: defaultMotion(0),
    body: '<path d="M0 1000 C0 -200 250 -200 1000 1000 Z"/>',
    w: 1000,
    h: 1000,
  };
  const dot: LogoLayer = { ...hump, id: 'dot', name: 'dot', x: 760, y: 820, scale: 0.08, body: '<path d="M0 0H1000V1000H0Z"/>' };
  const composed = composeLogoSvg([hump, dot])!;
  const after = await inkInSlot(resolveEventMonogramSvg({ monogram_custom_svg: composed })!);
  assert.ok(Math.abs(after.cx - SLOT / 2) <= 1, `ink centre x = ${after.cx}`);
  assert.ok(Math.abs(after.cy - SLOT / 2) <= 1, `ink centre y = ${after.cy}`);
  assert.ok(after.y0 >= 2, 'the top of the curve is not clipped');
});

/* ── 3 · the arrangement, and Draw on, are untouched ───────────────────────── */

test('3 · only the viewBox changes — every layer, its place and its writing path are byte-identical', () => {
  const am = textLayer('am', 'AM', 'public/monogram-studio/fonts/PinyonScript-Regular.ttf', 300, 500, 0.5);
  am.write = { w: 40, pts: [{ x: 10, y: 10 }, { x: 200, y: 120 }, { x: 400, y: 40 }] };
  const frame: LogoLayer = { ...am, id: 'ring', kind: 'frame', name: 'ring', x: 300, y: 500, scale: 0.7, write: undefined, body: '<path fill-rule="evenodd" d="M20 500a480 480 0 1 0 960 0a480 480 0 1 0 -960 0ZM42 500a458 458 0 1 0 916 0a458 458 0 1 0 -916 0Z"/>', w: 1000, h: 1000 };
  const composed = composeLogoSvg([frame, am])!;
  const framed = centreLogoOnItsInk(composed)!;
  const rootEnd = (s: string) => s.indexOf('>') + 1;
  assert.notEqual(framed.slice(0, rootEnd(framed)), composed.slice(0, rootEnd(composed)), 'the root is re-framed');
  assert.equal(framed.slice(rootEnd(framed)), composed.slice(rootEnd(composed)), 'everything inside the root is byte-identical');
  assert.match(framed, /data-write="M/, 'the writing path Draw on follows is still there');
  assert.deepEqual([...parseLogoSvg(framed)], [...parseLogoSvg(composed)], 'the editor reads back the same layers');
  // A ring is framed by the box it paints — the frame layer is the widest ink.
  const vb = /viewBox="([^"]+)"/.exec(framed)![1]!.split(' ').map(Number);
  const ringW = 1000 * 0.7 * 0.96; // outer diameter 960 of 1000, at scale 0.7
  assert.ok(vb[2]! >= ringW && vb[2]! < ringW * 1.12, `viewBox width ${vb[2]} holds the ring (${ringW}) plus a small margin`);
});

/* ── 4 · every surface, every saved logo, safely ───────────────────────────── */

test('4 · the resolver frames every saved layered logo; the gate passes it; it is idempotent; other marks pass through', () => {
  const am = textLayer('am', 'AM', 'public/monogram-studio/fonts/PinyonScript-Regular.ttf', 250, 300, 0.4);
  const composed = composeLogoSvg([am])!;
  assert.match(composed, /viewBox="0 0 1000 1000"/, 'a saved logo carries the artboard');
  const framed = centreLogoOnItsInk(composed)!;
  assert.doesNotMatch(framed, /viewBox="0 0 1000 1000"/);
  assert.equal(resolveEventMonogramSvg({ monogram_custom_svg: composed }), framed, 'THE resolver frames it');
  assert.equal(heroMarkSvg({ monogram_custom_svg: composed }), framed, 'the hero / invite / print call frames it');
  assert.equal(centreLogoOnItsInk(framed), framed, 'idempotent — it reads the ink, never the old viewBox');
  assert.ok(safeMonogramSvg(framed), 'a surface that re-gates the resolved mark still accepts it');
  assert.equal(unwrapMark(framed)?.viewBox, /viewBox="([^"]+)"/.exec(framed)![1], 'the app icon maps it through the new viewBox');
  // Not a layered logo → untouched (an upload, a studio mark, nothing).
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0H10V10H0Z"/></svg>';
  assert.equal(centreLogoOnItsInk(plain), plain);
  assert.equal(centreLogoOnItsInk(null), null);
  // An empty text layer (no words yet) is no ink: the logo is framed on the rest.
  const empty: LogoLayer = { ...am, id: 'empty', x: 900, y: 900, body: '<path d=""/>', w: 1, h: 1 };
  assert.equal(
    /viewBox="([^"]+)"/.exec(centreLogoOnItsInk(composeLogoSvg([am, empty])!)!)![1],
    /viewBox="([^"]+)"/.exec(framed)![1],
    'a layer with nothing drawn does not stretch the box',
  );
  assert.ok(LOGO_FRAME === 1000);
});
