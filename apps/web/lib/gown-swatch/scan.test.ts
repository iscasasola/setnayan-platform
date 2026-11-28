/**
 * 👗 The swatch-book scan (B13), on GENERATED page photos — there is no canvas in Node, so each page is drawn here
 * pixel by pixel: a card of paper (with a colour cast, light falling off, a hard shadow, or a wooden table around it),
 * swatches with a weave, at a tilt. The owner's real phone photos are the acceptance check after it ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gownColourName,
  gownFindSwatches,
  gownGroupStyles,
  gownPatternCut,
  gownScanNotes,
  gownSwatchCm,
  gownSwatchTile,
  type GownRgba,
} from './scan';

type RGB = [number, number, number];
type Sw = { cx: number; cy: number; w: number; h: number; rgb: RGB; weave?: number; stripe?: number };
type PageSpec = {
  W: number; H: number; paper?: RGB; ang?: number; swatches: Sw[];
  cast?: RGB; falloff?: number; shadow?: { x: number; k: number }; table?: { rgb: RGB; inset: number };
};

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function page(p: PageSpec, seed = 7): GownRgba {
  const r = rng(seed), d = new Uint8ClampedArray(p.W * p.H * 4), paper = p.paper ?? [244, 243, 240], cs = Math.cos(p.ang ?? 0), sn = Math.sin(p.ang ?? 0);
  const ccx = p.W / 2, ccy = p.H / 2;
  for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
    // page-local coordinates (the card is drawn straight, then the photo is tilted)
    const lx = (x - ccx) * cs + (y - ccy) * sn + ccx, ly = -(x - ccx) * sn + (y - ccy) * cs + ccy;
    let c: number[] = [...paper];
    if (p.table && (lx < p.table.inset || ly < p.table.inset || lx > p.W - p.table.inset || ly > p.H - p.table.inset)) c = [...p.table.rgb];
    else for (const s of p.swatches) {
      if (Math.abs(lx - s.cx) <= s.w / 2 && Math.abs(ly - s.cy) <= s.h / 2) {
        c = [...s.rgb];
        if (s.stripe) { const on = Math.floor((lx - s.cx + 1000) / s.stripe) % 2 === 0; if (on) c = c.map((v) => v * 0.55); }
        const wv = s.weave ?? 6, t = ((Math.floor(lx) + Math.floor(ly)) % 2 ? 1 : -1) * wv;
        c = c.map((v) => v + t);
      }
    }
    let light = 1;
    if (p.falloff) light *= 1 - p.falloff * (((x - ccx) / p.W) ** 2 + ((y - ccy) / p.H) ** 2) * 2;
    if (p.shadow && x > p.shadow.x) light *= p.shadow.k;
    const cast = p.cast ?? [1, 1, 1], i = (y * p.W + x) * 4;
    for (let j = 0; j < 3; j++) d[i + j] = c[j]! * light * cast[j]! + (r() - 0.5) * 3;
    d[i + 3] = 255;
  }
  return { data: d, width: p.W, height: p.H };
}

const grid = (rgbs: RGB[], cols: number, W: number, size: number, gap: number, top = 60): Sw[] =>
  rgbs.map((rgb, i) => ({ cx: (W - cols * size - (cols - 1) * gap) / 2 + size / 2 + (i % cols) * (size + gap), cy: top + size / 2 + Math.floor(i / cols) * (size + gap), w: size, h: size, rgb }));

const RED: RGB = [180, 35, 45], NAVY: RGB = [28, 38, 70], SAGE: RGB = [160, 178, 150], BLUSH: RGB = [238, 205, 200], GOLD: RGB = [200, 160, 80], EMERALD: RGB = [20, 110, 80];
const near = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('a plain page: every swatch found, in reading order, with its true colour and name', () => {
  const W = 420, H = 320, sw = grid([RED, NAVY, SAGE, BLUSH, GOLD, EMERALD], 3, W, 90, 30);
  const img = page({ W, H, swatches: sw });
  const pg = gownFindSwatches(img);
  assert.equal(pg.boxes.length, 6);
  pg.boxes.forEach((b, i) => { near(b.cx, sw[i]!.cx, 6, `swatch ${i + 1} x`); near(b.cy, sw[i]!.cy, 6, `swatch ${i + 1} y`); near(b.w, 90, 10, `swatch ${i + 1} width`); });
  const names = pg.boxes.map((b) => gownColourName(gownSwatchTile(img, pg, b, 64).rgb));
  assert.deepEqual(names, ['Red', 'Navy', 'Sage', 'Blush', 'Gold', 'Emerald']);
});

test('a tilted page: the tilt is read and the swatches are still found', () => {
  const W = 440, H = 340, sw = grid([RED, NAVY, SAGE, GOLD], 2, W, 100, 40, 60);
  const pg = gownFindSwatches(page({ W, H, ang: (5 * Math.PI) / 180, swatches: sw }));
  assert.equal(pg.boxes.length, 4);
  near((pg.ang * 180) / Math.PI, 5, 1, 'tilt in degrees');
});

test('a warm room and light falling off to the corners: the paper sets the white, so the colour is the cloth’s own', () => {
  const W = 420, H = 320, sw = grid([SAGE, BLUSH, NAVY], 3, W, 90, 30, 110);
  const img = page({ W, H, swatches: sw, cast: [1.06, 0.98, 0.86], falloff: 0.35 });
  const pg = gownFindSwatches(img);
  assert.equal(pg.boxes.length, 3);
  // flattened against paper at 244, so the swatch reads as its colour × 244 / paper
  const t = gownSwatchTile(img, pg, pg.boxes[0]!, 64).rgb, want = SAGE.map((v, j) => (v * 244) / [244, 243, 240][j]!);
  t.forEach((v, j) => near(v, want[j]!, 10, `sage channel ${j}`));
  assert.equal(gownColourName(gownSwatchTile(img, pg, pg.boxes[1]!, 64).rgb), 'Blush');
});

test('a hard shadow across the page is followed, not taken for a swatch', () => {
  const W = 420, H = 320, sw = grid([RED, NAVY, GOLD, EMERALD], 2, W, 90, 60, 50);
  const pg = gownFindSwatches(page({ W, H, swatches: sw, shadow: { x: 210, k: 0.72 } }));
  assert.equal(pg.boxes.length, 4);
});

test('two swatches glued edge to edge are cut apart at the seam', () => {
  const W = 420, H = 300;
  const sw: Sw[] = [{ cx: 160, cy: 150, w: 100, h: 110, rgb: RED }, { cx: 260, cy: 150, w: 100, h: 110, rgb: NAVY }];
  const pg = gownFindSwatches(page({ W, H, swatches: sw }));
  assert.equal(pg.boxes.length, 2, 'two swatches, not one long one');
  near(pg.boxes[0]!.cx, 160, 8, 'left swatch'); near(pg.boxes[1]!.cx, 260, 8, 'right swatch');
});

test('white cloth on white card is found by its weave', () => {
  const W = 420, H = 300, sw: Sw[] = [{ cx: 140, cy: 150, w: 110, h: 110, rgb: [246, 245, 241], weave: 22 }, { cx: 290, cy: 150, w: 110, h: 110, rgb: RED }];
  const pg = gownFindSwatches(page({ W, H, swatches: sw }));
  assert.equal(pg.boxes.length, 2);
});

test('a table around the card is not a swatch, and the card’s own width sets the size', () => {
  const W = 440, H = 340, inset = 30, sw = grid([RED, NAVY, SAGE], 3, W, 90, 30, 120);
  const img = page({ W, H, swatches: sw, table: { rgb: [120, 82, 50], inset } });
  const pg = gownFindSwatches(img);
  assert.equal(pg.boxes.length, 3);
  near(pg.cardW, W - 2 * inset, 20, 'card width in the photo');
  // a 21 cm card: a 90 px swatch's inner 84 % is about 90 × 0.84 × 21 / 380 cm
  const tile = gownSwatchTile(img, pg, pg.boxes[0]!, 32);
  near(gownSwatchCm(tile.side, pg.cardW, 21), (90 * 0.84 * 21) / (W - 2 * inset), 0.5, 'true size in cm');
});

test('a blank page finds nothing (no box drawn on paper)', () => {
  assert.equal(gownFindSwatches(page({ W: 300, H: 220, swatches: [] })).boxes.length, 0);
});

test('a pattern bigger than the swatch is noticed; a fine repeat and a plain cloth are not', () => {
  const S = 128;
  const draw = (stripe: number | null) => {
    const d = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, v = stripe && Math.floor(Math.hypot(x - 20, y - 30) / stripe) === 2 ? 90 : 220; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    return d;
  };
  assert.equal(gownPatternCut(draw(null), S), false, 'plain');
  assert.equal(gownPatternCut(draw(30), S), true, 'one big ring cut by the edge');
  const fine = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, v = Math.floor(x / 8) % 2 ? 90 : 220; fine[i] = fine[i + 1] = fine[i + 2] = v; fine[i + 3] = 255; }
  assert.equal(gownPatternCut(fine, S), false, 'a stripe that repeats inside');
});

test('names: the designer’s own name for a near-identical colour wins; otherwise the bridal name', () => {
  assert.equal(gownColourName([241, 233, 215]), 'Ivory');
  assert.equal(gownColourName([241, 233, 215], [{ name: 'Candlelight', hex: '#f0e8d6' }, { name: 'Far off', hex: '#202020' }]), 'Candlelight');
  assert.equal(gownColourName([241, 233, 215], [{ name: null, hex: '#f0e8d6' }]), 'Ivory');
});

test('styles: same printed name or code family is one style; the book name otherwise; a hand edit stays', () => {
  const it = (name: string, code: string, style = '', styleEdited = false) => ({ name, code, style, styleEdited });
  assert.deepEqual(gownGroupStyles([it('Mikado', ''), it('mikado', 'MK-02'), it('', 'MK-03'), it('', ''), it('', '', 'Mine', true)], 'Spring book'), ['Mikado', 'Mikado', 'Mikado', 'Spring book', 'Mine']);
  assert.deepEqual(gownGroupStyles([it('', 'CH 01'), it('', 'CH 02'), it('', 'X1')], ''), ['CH', 'CH', 'Swatch book']);
});

test('notes: a cut pattern, small lace, and a shadowed swatch are pointed out', () => {
  assert.equal(gownScanNotes({ cut: false, lace: false, cm: 5, shade: 1 }).length, 0);
  assert.equal(gownScanNotes({ cut: false, lace: true, cm: 5, shade: 1 }).length, 1);
  assert.equal(gownScanNotes({ cut: true, lace: false, cm: 20, shade: 1.4 }).length, 2);
});
