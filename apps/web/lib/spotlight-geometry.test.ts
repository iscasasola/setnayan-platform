/**
 * 🔦 THE RING WRAPS ITS TARGET, EVENLY, AND THE CARD SITS BY IT — the rules of `lib/spotlight-geometry.ts`, on the
 * shapes the tours meet: the owner's own case (2026-10-23, Apply in the Maker's top bar on a ~1000 pt window, the
 * app's sticky top bar under the Maker), a bottom tab, a button against the screen's edge, a card mid-page, a tall
 * card scrolled to its top, at 375 · 390 · 1024 · 1440 · 1920 · 2000.
 *
 * The real engine in a real browser, step by step for every tour, is
 * `tests/e2e/the-spotlight-ring-wraps-its-target.spec.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeBandFrom, ringFor, tipFor, RING_EDGE, RING_PAD, TIP_GAP, TIP_MAX_W, type Bar, type Box, type Rect } from './spotlight-geometry';

const WIDTHS = [375, 390, 1024, 1440, 1920, 2000] as const;
const HEIGHT = (w: number) => (w < 768 ? 812 : 900);
const NO_INSETS = { top: 0, bottom: 0 };

function wraps(ring: Box, t: Rect, msg: string) {
  assert.ok(ring.x <= t.left + 0.5, `${msg}: the ring starts right of its target (${ring.x} > ${t.left})`);
  assert.ok(ring.y <= t.top + 0.5, `${msg}: the ring starts below its target (${ring.y} > ${t.top})`);
  assert.ok(ring.x + ring.w >= t.left + t.width - 0.5, `${msg}: the ring stops short of its target's right edge`);
  assert.ok(ring.y + ring.h >= t.top + t.height - 0.5, `${msg}: the ring stops short of its target's foot`);
}
function even(ring: Box, t: Rect, msg: string) {
  const pads = [t.left - ring.x, ring.x + ring.w - (t.left + t.width), t.top - ring.y, ring.y + ring.h - (t.top + t.height)];
  assert.ok(Math.max(...pads) - Math.min(...pads) <= 1, `${msg}: uneven padding ${pads.join(' / ')}`);
}
function beside(tip: { left: number; top: number; width: number }, tipH: number, ring: Box, vw: number, msg: string) {
  assert.ok(tip.left >= 16 - 0.5 && tip.left + tip.width <= vw - 16 + 0.5, `${msg}: the card runs off the screen`);
  const gapX = Math.max(0, tip.left - (ring.x + ring.w), ring.x - (tip.left + tip.width));
  const gapY = Math.max(0, tip.top - (ring.y + ring.h), ring.y - (tip.top + tipH));
  assert.ok(gapX + gapY > 0 || vw < 768, `${msg}: the card covers its ring`);
  assert.ok(gapX <= TIP_GAP + 1 && gapY <= TIP_GAP + 1, `${msg}: the card is ${gapX}/${gapY} px from its ring — not beside it`);
}

test("the owner's case: Apply in the Maker's top bar, the app's sticky top bar UNDER the Maker", () => {
  for (const vw of WIDTHS) {
    const vh = HEIGHT(vw);
    const apply: Rect = { left: vw - 8 - 92, top: 6, width: 92, height: 40 };
    // The app's own sticky top bar — 56 px, full width — sits under the full-screen Maker: not painted.
    const appBar: Bar = { rect: { left: 0, top: 0, width: vw, height: 56 }, holds: false, painted: false, under: true };
    const band = freeBandFrom([appBar], vw, vh, NO_INSETS);
    assert.equal(band.top, 0, `${vw}: a bar the Maker covers still pushed the ring down (the 2026-10-23 thin ring)`);
    const ring = ringFor(apply, vw, band);
    assert.ok(ring, `${vw}: no ring around Apply`);
    wraps(ring, apply, `${vw} Apply`);
    even(ring, apply, `${vw} Apply`);
    assert.ok(ring.x + ring.w + RING_EDGE <= vw, `${vw}: Apply's ring outline is cut at the right edge`);
    const tip = tipFor(ring, { h: 190 }, vw, vh, band, NO_INSETS);
    beside(tip, 190, ring, vw, `${vw} Apply`);
    if (vw >= 1024) assert.ok(tip.left + tip.width > vw / 2, `${vw}: the card is parked on the left, away from Apply on the right`);
  }
});

test('the same bar PAINTED (a page under it, not a sheet over it) still keeps the ring out from under it', () => {
  const vw = 390;
  const bar: Bar = { rect: { left: 0, top: 0, width: vw, height: 56 }, holds: false, painted: true, under: false };
  assert.equal(freeBandFrom([bar], vw, 844, NO_INSETS).top, 56);
  // …and a bar the target is drawn OVER (the target overlaps it and is the thing on top) is beneath it.
  assert.equal(freeBandFrom([{ ...bar, under: true }], vw, 844, NO_INSETS).top, 0);
  // …and a bar holding the target (a bottom tab) is never its obstacle.
  assert.equal(freeBandFrom([{ ...bar, rect: { left: 0, top: 780, width: vw, height: 64 }, holds: true }], vw, 844, NO_INSETS).bottom, 844);
});

test('every shape, every width: the ring wraps its target with one padding, the card beside it', () => {
  for (const vw of WIDTHS) {
    const vh = HEIGHT(vw);
    const dock: Bar = { rect: { left: 0, top: vh - 64, width: vw, height: 64 }, holds: false, painted: true, under: false };
    const top: Bar = { rect: { left: 0, top: 0, width: vw, height: 56 }, holds: false, painted: true, under: false };
    const shapes: Record<string, { t: Rect; bars: Bar[] }> = {
      'bottom tab': { t: { left: vw / 5, top: vh - 60, width: vw / 5, height: 56 }, bars: [top, { ...dock, holds: true }] },
      'left-edge button': { t: { left: 4, top: 200, width: 120, height: 44 }, bars: [top, dock] },
      'right-edge button': { t: { left: vw - 4 - 120, top: 200, width: 120, height: 44 }, bars: [top, dock] },
      'card mid-page': { t: { left: 16, top: 300, width: Math.min(vw - 32, 640), height: 160 }, bars: [top, dock] },
      'full-width row': { t: { left: 0, top: 260, width: vw, height: 72 }, bars: [top, dock] },
    };
    for (const [name, { t, bars }] of Object.entries(shapes)) {
      const band = freeBandFrom(bars, vw, vh, NO_INSETS);
      const ring = ringFor(t, vw, band);
      assert.ok(ring, `${vw} ${name}: no ring`);
      wraps(ring, t, `${vw} ${name}`);
      even(ring, t, `${vw} ${name}`);
      const room = RING_EDGE + RING_PAD;
      if (t.left >= room && vw - t.left - t.width >= room && t.top - band.top >= room && band.bottom - t.top - t.height >= room) {
        assert.equal(t.left - ring.x, RING_PAD, `${vw} ${name}: a target with room got less than the full padding`);
      }
      const tip = tipFor(ring, { h: 190 }, vw, vh, band, NO_INSETS);
      beside(tip, 190, ring, vw, `${vw} ${name}`);
      assert.ok(tip.width <= TIP_MAX_W, `${vw} ${name}: the card is wider than ${TIP_MAX_W}`);
    }
  }
});

test('a tall card scrolled to its top: cut at the bar, never past it; a desktop puts the card beside it', () => {
  for (const vw of WIDTHS) {
    const vh = HEIGHT(vw);
    const top: Bar = { rect: { left: 0, top: 0, width: vw, height: 56 }, holds: false, painted: true, under: false };
    const band = freeBandFrom([top], vw, vh, NO_INSETS);
    const t: Rect = { left: 16, top: 70, width: Math.min(vw - 32, 560), height: vh * 1.4 };
    const ring = ringFor(t, vw, band);
    assert.ok(ring);
    assert.ok(ring.y >= band.top && ring.y + ring.h <= band.bottom, `${vw}: the tall ring runs under a bar`);
    assert.ok(ring.x <= t.left && ring.x + ring.w >= t.left + t.width, `${vw}: the tall ring is narrower than its card`);
    const tip = tipFor(ring, { h: 190 }, vw, vh, band, NO_INSETS);
    // Room beside it for the 420 px card (16 · card · 20 · ring · 16): a desktop. A phone keeps the card low.
    if (vw - (ring.x + ring.w) - TIP_GAP - 16 >= TIP_MAX_W) beside(tip, 190, ring, vw, `${vw} tall card`);
  }
});

test('nothing left to light draws nothing: a target wholly under a bar has no ring', () => {
  const band = { top: 56, bottom: 780 };
  assert.equal(ringFor({ left: 300, top: 6, width: 90, height: 40 }, 390, band), null, 'a 0-high "ring" was drawn under the bar');
  assert.equal(ringFor({ left: 300, top: 790, width: 90, height: 40 }, 390, band), null);
});
