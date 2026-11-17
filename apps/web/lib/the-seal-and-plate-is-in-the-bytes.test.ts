/**
 * THE SEAL AND PLATE IS IN THE STORED BYTES — decoded, not assumed.
 *
 * Burns the approved mark (supplier_photo_mark 2026-11-04, direction A) into a
 * real JPEG through the SERVER painter, decodes the stored bytes with sharp and
 * reads the pixels back: the seal's navy face is where the geometry says, the
 * gold SY is in it, the plate darkened its box, and the picture OUTSIDE the
 * plate is untouched. A painter that composited nothing (or composited in the
 * wrong place) fails here, which a "did the bytes change" test never would.
 *
 * Also pins the shared geometry's promises: every tier, at every size, stays
 * inside its safe square — and inside the frame it was laid out in.
 *
 * 🔏 SINCE 2026-11-15 THE SEAL AND PLATE IS SETNAYAN'S OWN MARK ONLY. Supplier photos carry the new row (owner,
 * "APPROVED — THE NEW SUPPLIER PHOTO MARK, APP-WIDE"; its guard is `the-supplier-photo-mark-is-in-the-bytes.test.ts`),
 * so the seal checks below run on the `setnayan` kind, and the shop-name rules left with the shop-name line the owner
 * dropped from the mark.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  displayAspectAllowed,
  layoutInside,
  layoutMark,
  layoutMarkInFrame,
  isRowLayout,
  type MarkMeasure,
  type MarkSpec,
  type PlateLayout,
} from './photo-mark-geometry';
import { markPhotoBytes, markOverlaySvgForLayout, serverMarkLayout, serverMeasure } from './photo-mark-server';

const SETNAYAN: MarkSpec = { kind: 'setnayan' };
const VERIFIED: MarkSpec = { kind: 'supplier', verified: true, shopName: 'Bloom & Vine Styling', slug: 'bloom-vine', hasLogo: true };
const LONG: MarkSpec = {
  kind: 'supplier',
  verified: true,
  shopName: 'The Extremely Long Shop Name Events and Styling Co.',
  slug: 'the-extremely-long-shop-name-events-and-styling-company',
  hasLogo: true,
};

/** A flat mid-grey photo — any mark is visible against it, in both directions. */
async function greyJpeg(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 } } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function pixel(bytes: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

test('decoded stored bytes carry the seal where the geometry put it (not verified)', async () => {
  const src = await greyJpeg(1200, 900);
  const out = await markPhotoBytes(src, SETNAYAN);
  assert.equal(out.layout.tier, 'full');
  const plateLayout = out.layout as PlateLayout;
  const seal = plateLayout.seal!;
  // The seal's face, just off-centre (the gold SY covers the centre): navy — blue well above red.
  const [r, , b] = await pixel(out.bytes, seal.cx - seal.D * 0.33, seal.cy);
  assert.ok(b > r + 20, `seal face should be navy, got rgb(${r},…,${b})`);
  // The plate darkened its box, away from the seal and text.
  const p = plateLayout.plate;
  const [pr] = await pixel(out.bytes, p.left + p.width - 3, p.top + p.height / 2);
  assert.ok(pr < 110, `plate should darken the grey (128), got ${pr}`);
  // Far outside the plate: untouched grey.
  const [ur, ug, ub] = await pixel(out.bytes, 30, 30);
  assert.ok(Math.abs(ur - 128) < 6 && Math.abs(ug - 128) < 6 && Math.abs(ub - 128) < 6, 'the rest of the photo is untouched');
});

test('the gold SY and the gold rim are really drawn — gold pixels inside the seal', async () => {
  const out = await markPhotoBytes(await greyJpeg(1600, 1600), SETNAYAN, { logoPng: null });
  const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
  const s = (out.layout as PlateLayout).seal!;
  let gold = 0;
  for (let y = Math.floor(s.cy - s.D / 2); y < s.cy + s.D / 2; y += 1) {
    for (let x = Math.floor(s.cx - s.D / 2); x < s.cx + s.D / 2; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r > 180 && g > 150 && b < 150 && r > b + 50) gold += 1;
    }
  }
  assert.ok(gold > s.D * 2, `expected gold in the seal, found ${gold} px`);
});

test('the plate text lines are in the bytes (ivory caps inside the plate)', async () => {
  const out = await markPhotoBytes(await greyJpeg(1600, 1200), SETNAYAN);
  const layout = out.layout as PlateLayout;
  assert.equal(layout.lines.map((l) => l.font).join(','), 'caps,addr');
  const caps = layout.lines.find((l) => l.font === 'caps')!;
  const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let y = Math.floor(caps.y); y < caps.y + caps.px; y += 1) {
    for (let x = Math.floor(caps.x); x < caps.x + caps.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      // The plate darkens grey 128 to ~70; the gold/ivory strokes (anti-aliased) read well above it.
      if (data[i]! > 150 && data[i + 1]! > 150) ink += 1;
    }
  }
  assert.ok(ink > caps.width / 2, `the caps should be drawn, found ${ink} px over ${Math.round(caps.width)}`);
});

test('the overlay never asks the host for a font — no <text> element', () => {
  const layout = serverMarkLayout(1200, 1200, VERIFIED);
  const svg = markOverlaySvgForLayout(1200, 1200, layout, null);
  assert.doesNotMatch(svg, /<text\b/);
  assert.match(svg, /<path d="M/);
});

test('every tier stays inside its safe square at every size and both variants', () => {
  const tiers = new Set<string>();
  for (const spec of [SETNAYAN, VERIFIED, LONG]) {
    for (let S = 40; S <= 4000; S += 37) {
      for (const [w, h] of [
        [S, S],
        [Math.round(S * 1.6), S],
        [S, Math.round(S * 1.4)],
      ] as const) {
        const l = layoutMark(w, h, spec, serverMeasure);
        tiers.add(l.tier);
        const safe = { left: l.safe.left, top: l.safe.top, width: l.safe.size, height: l.safe.size };
        assert.ok(layoutInside(l, safe), `${l.tier} mark escapes the safe square at ${w}×${h}`);
      }
    }
  }
  // The plate's three tiers (Setnayan's own) and the supplier row's two.
  assert.deepEqual([...tiers].sort(), ['compact', 'full', 'row', 'row-text', 'text']);
});

test('the long-address rule: on the supplier row the address shrinks, it is never cut', () => {
  const l = layoutMark(1200, 1200, LONG, serverMeasure);
  assert.ok(isRowLayout(l), 'a supplier photo carries the row');
  assert.equal(l.address.text, 'setnayan.com/the-extremely-long-shop-name-events-and-styling-company');
  const safe = { left: l.safe.left, top: l.safe.top, width: l.safe.size, height: l.safe.size };
  assert.ok(layoutInside(l, safe), 'the long address still fits the safe square');
});

test('the mark stays inside the frame at ANY framing (square, wide, circle)', () => {
  const measure: MarkMeasure = serverMeasure;
  for (const shape of ['square', 'wide', 'circle'] as const) {
    const aspect = shape === 'wide' ? 2.5 : 1;
    for (let fw = 200; fw <= 3000; fw += 211) {
      for (const fx of [0, 37, 501]) {
        const frame = { left: fx, top: 13, width: fw, height: Math.round(fw / aspect) };
        const l = layoutMarkInFrame(frame, shape, VERIFIED, measure);
        assert.ok(layoutInside(l, frame), `${shape} ${frame.width}×${frame.height}: mark escapes the frame`);
      }
    }
  }
});

test('display aspects: a square frame allows 5:7 … 1.91:1 and refuses the 3:1 banner', () => {
  assert.ok(displayAspectAllowed('square', 5 / 7));
  assert.ok(displayAspectAllowed('square', 1));
  assert.ok(displayAspectAllowed('square', 1.91));
  assert.ok(!displayAspectAllowed('square', 3));
  assert.ok(displayAspectAllowed('wide', 4.4));
  assert.ok(!displayAspectAllowed('wide', 1));
});
