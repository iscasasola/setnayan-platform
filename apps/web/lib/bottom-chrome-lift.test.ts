/**
 * bottom-chrome-lift.test.ts — `bottomChromeLift` IS THE TALLEST BOTTOM BAR, AND NOTHING THAT IS NOT A BAR LIFTS IT.
 *
 * Kept from `the-cookie-banner-clears-the-bar.test.ts` (2026-10-11) when the cookie banner was removed (owner
 * 2026-10-22, essential cookies only): the banner was the first reader of this rule, but `lib/reveal-above-chrome.ts`
 * still uses it to keep an opened list clear of a route's own bottom bar, so the property stays executed here.
 *
 * 🔑 THE PROPERTY: for any arrangement of fixed boxes a route can draw, a box that ends `bottomChromeLift` above the
 * bottom edge never overlaps a bottom bar — and a sheet, a backdrop, a top bar or a sliver never lifts it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bottomChromeLift, isBottomBar, type ChromeBox } from '@/lib/bottom-chrome';

const box = (top: number, bottom: number, width = 375): ChromeBox => ({ top, bottom, width, height: bottom - top });
const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

test('a box lifted by the measured stack never overlaps a bottom bar — for any arrangement of fixed boxes', () => {
  // The measured page (2026-10-11): the bar is 747–812 on an 812 screen.
  assert.equal(bottomChromeLift([box(747, 812)], 812), 65);
  assert.equal(bottomChromeLift([], 812), 0, 'no bar, no lift');

  let seed = 20261011;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let pages = 0;
  let withBars = 0;
  for (const vh of [568, 667, 736, 812, 844, 932]) {
    for (let i = 0; i < 400; i++) {
      const bars: ChromeBox[] = [];
      for (let b = rnd(3); b > 0; b--) { const h = 40 + rnd(Math.floor(vh * 0.3)); bars.push(box(vh - h, vh, 200 + rnd(230))); }
      const notBars: ChromeBox[] = [
        box(0, vh), // a full-screen backdrop
        box(rnd(Math.floor(vh * 0.4)), vh), // a sheet that starts above the middle
        box(0, 56 + rnd(40)), // a top bar
        box(vh - 300 - rnd(100), vh - 20 - rnd(200)), // something floating, not touching the edge
        box(vh - 6, vh, 20), // a sliver too small to be a bar
      ];
      const all = [...bars, ...notBars].sort(() => rnd(3) - 1);
      const lift = bottomChromeLift(all, vh);
      pages++;
      if (bars.length) withBars++;
      for (const n of notBars) assert.ok(!isBottomBar(n, vh), `vh ${vh}: ${JSON.stringify(n)} was taken for a bar`);
      assert.equal(lift, Math.round(Math.max(0, ...bars.map((b) => vh - b.top))), `vh ${vh}: the lift is not the tallest bar`);
      const lifted = { top: vh - lift - (96 + rnd(90)), bottom: vh - lift };
      for (const b of bars) assert.equal(overlap(lifted, b), 0, `vh ${vh}: ${lifted.top}–${lifted.bottom} sits on a bar ${b.top}–${b.bottom}`);
    }
  }
  assert.ok(pages === 2400 && withBars > 1200, `the sweep went thin (${withBars} of ${pages} pages had a bar)`);
});
