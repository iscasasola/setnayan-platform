/**
 * the-cookie-banner-clears-the-bar.test.ts — THE COOKIE BANNER NEVER SITS ON A ROUTE'S OWN BOTTOM BAR, HOWEVER LATE THE BAR ARRIVES.
 *
 * Measured on the live sample event's guest page (2026-10-11, a stranger on a phone):
 *
 *   G01 · 12 fresh visits at 375 × 812. In 5 the cookie banner sat ON the Welcome / Details bar (banner 679–800,
 *         bar 747–812, `--cb-lift: 0px`): a tap on Details pressed "Manage". In the other 7, lifted clear of the
 *         bar (614–735), it sat on "Get inside" (715–771) instead.
 *   G09 · "Get inside" has its place at y 715–771: entirely below a 375 × 667 screen, and under the bar at
 *         375 × 812 (32 of 56 px showing).
 *
 * Three boxes share the bottom of a phone — the page's bar, the cookie banner, the page's one action — and each was
 * placed without knowing of the others. The fix gives them ONE order, bottom up: the bar · the banner · the action.
 *
 * 🔑 THE PROPERTY, measured rather than read:
 *   (1) for any arrangement of fixed boxes a route can draw, a banner lifted by `bottomChromeLift` never overlaps a
 *       bottom bar — and a sheet, a backdrop or a top bar never lifts it;
 *   (2) the banner re-measures when the page changes under it (the bar ARRIVES after the banner — the race);
 *
 * (The other half — the action standing above the banner — is `the-first-screen-keeps-its-action.test.ts`.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bottomChromeLift, isBottomBar, type ChromeBox } from '@/lib/bottom-chrome';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const BANNER = stripComments(read('app/_components/cookie-consent-banner.tsx'));

const box = (top: number, bottom: number, width = 375): ChromeBox => ({ top, bottom, width, height: bottom - top });
const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Where the banner's own class puts it: `bottom-[calc(var(--cb-lift,0px)+max(0.75rem,env(safe-area-inset-bottom)))]`. */
function bannerBox(lift: number, height: number, vh: number, safe: number) {
  assert.match(BANNER, /bottom-\[calc\(var\(--cb-lift,0px\)\+max\(0\.75rem,env\(safe-area-inset-bottom\)\)\)\]/, 'the banner is positioned some other way — re-derive bannerBox()');
  const bottom = vh - (lift + Math.max(12, safe));
  return { top: bottom - height, bottom };
}

test('(1) a banner lifted by the measured stack never overlaps a bottom bar — for any arrangement of fixed boxes', () => {
  // The measured page: the bar is 747–812 on an 812 screen.
  assert.equal(bottomChromeLift([box(747, 812)], 812), 65);
  assert.equal(bottomChromeLift([], 812), 0, 'no bar, no lift — what the banner measured before the bar arrived');
  assert.equal(overlap(bannerBox(0, 121, 812, 0), box(747, 812)), 53, 'unlifted, the banner should reproduce the measured overlap (679–800 on 747–812)');
  assert.equal(overlap(bannerBox(65, 121, 812, 0), box(747, 812)), 0);

  // A deterministic sweep of pages: one or two real bars among things that are NOT bars.
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
      for (const safe of [0, 34]) {
        const banner = bannerBox(lift, 96 + rnd(90), vh, safe);
        for (const b of bars) assert.equal(overlap(banner, b), 0, `vh ${vh}: the banner ${banner.top}–${banner.bottom} sits on a bar ${b.top}–${b.bottom}`);
      }
    }
  }
  assert.ok(pages === 2400 && withBars > 1200, `the sweep went thin (${withBars} of ${pages} pages had a bar)`);
});

test('(2) the banner re-measures when the page changes under it — a bar that arrives late is still cleared', () => {
  // The measurement is the pure rule, fed every fixed / sticky box on the page.
  assert.match(BANNER, /boxes\.push\(el\.getBoundingClientRect\(\)\)/);
  assert.match(BANNER, /return bottomChromeLift\(boxes, window\.innerHeight\)/);
  // The effect that measures: its body, from the `recompute` it defines to its dependency list.
  const start = BANNER.indexOf('const recompute = () => setLiftPx(measureRouteBottomChrome(el));');
  assert.ok(start > 0, 'the measuring effect is gone');
  const effect = BANNER.slice(start, BANNER.indexOf('}, [showing, pathname, manage]);', start));
  assert.ok(effect.length > 100 && effect.length < 1500, 'could not isolate the measuring effect');
  // An ARRIVAL fires no resize and no transitionend: the page itself is watched, whole, for added / removed nodes.
  const watch = /new MutationObserver\((\w+)\)/.exec(effect);
  assert.ok(watch, 'nothing watches the page for a bar that arrives after the banner — the 5-in-12 race is back');
  assert.match(effect, /\.observe\(document\.body, \{ childList: true, subtree: true \}\)/, 'the watch does not cover the whole page');
  // …and what it calls ends in the SAME recompute, at most once a frame.
  const fn = new RegExp(`const ${watch![1]} = \\(\\) => \\{([\\s\\S]*?)\\n    \\};`).exec(effect);
  assert.ok(fn && /requestAnimationFrame\(\(\) => \{[\s\S]*recompute\(\);/.test(fn[1]!), 'the watch does not lead to the measurement');
  assert.match(effect, /\.disconnect\(\)/, 'the watch outlives the banner');
  // The three it always listened for are still there.
  assert.match(effect, /addEventListener\('resize', recompute\)/);
  assert.match(effect, /addEventListener\('transitionend', recompute, true\)/);
});
