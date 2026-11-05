/**
 * 📌 AN OPENED CATEGORY NEVER COVERS ITS OWN FIRST CARD — owner 2026-10-29, live, the event's Suppliers › Find on a
 * phone: *"when i tapped a category, this is how it pinned on top. it made the service card not placed properly"*.
 *
 * Walked on /dev/suppliers-lab (Chromium + WebKit, 375 · 390 · 768 · 1280, light + dark): opening Photo & Video after
 * Reception scrolled UP, the phone's top bar came back, `--stick-h` grew 58 → 109 px AFTER the landing had aimed, and
 * the pinned head covered its first card by 36 px. Laid out in a browser by
 * `tests/e2e/an-opened-category-never-covers-its-card.spec.ts` (labs only — production builds 404 the lab); this file
 * holds the mechanism in CI.
 *
 *   1  the landing HOLDS its line: the top bar ignores the page's own scroll, and a moved `--stick-h` lands the row
 *      again — until the person scrolls
 *   2  the bench's landing uses that hold, on the takeover root that owns `--stick-h`, and releases it
 *   3  the margins: the row lands ON the line; its body and cards clear the line PLUS their own measured head
 *   4  a page shorter than the screen still makes all the room it needs (a new event's Find at 768: 21 px short)
 *   5  the lab reads the bar the way the app does (`data-chrome="app"`), or it can never show this bug
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  CAT_HEAD_VAR,
  MAX_RELANDS,
  PIN_LANDING_ATTR,
  STICK_LINE_VAR,
  holdLandingLine,
  offTheLine,
  stickLineMoved,
} from '@/lib/pin-landing';
import { pinRoomShortfall } from '@/lib/pin-room';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
const BENCH = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const SHELL = read('app/dashboard/[eventId]/vendors/_components/services-takeover.tsx');
const LAB = readFileSync(join(__dirname, '..', 'app/dev/suppliers-lab/lab-stage.tsx'), 'utf8');

/** The smallest DOM `holdLandingLine` touches: a root with a style, the window's listeners, a MutationObserver. */
function fakeDom() {
  const listeners = new Map<string, Set<() => void>>();
  const observers: Array<{ cb: () => void; on: boolean }> = [];
  const style = new Map<string, string>();
  const attrs = new Set<string>();
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, document: g.document, MutationObserver: g.MutationObserver };
  g.document = {
    documentElement: {
      setAttribute: (k: string) => attrs.add(k),
      removeAttribute: (k: string) => attrs.delete(k),
      hasAttribute: (k: string) => attrs.has(k),
    },
  };
  g.window = {
    addEventListener: (t: string, f: () => void) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t: string, f: () => void) => listeners.get(t)?.delete(f),
  };
  g.MutationObserver = class {
    o: { cb: () => void; on: boolean };
    constructor(cb: () => void) {
      this.o = { cb, on: false };
      observers.push(this.o);
    }
    observe() {
      this.o.on = true;
    }
    disconnect() {
      this.o.on = false;
    }
  };
  const root = {
    style: {
      getPropertyValue: (k: string) => style.get(k) ?? '',
      setProperty: (k: string, v: string) => {
        style.set(k, v);
        for (const o of observers) if (o.on) o.cb();
      },
    },
  } as unknown as HTMLElement;
  return {
    root,
    setLine: (px: number) => root.style.setProperty(STICK_LINE_VAR, `${px}px`),
    fire: (t: string) => [...(listeners.get(t) ?? [])].forEach((f) => f()),
    landing: () => attrs.has(PIN_LANDING_ATTR),
    restore: () => Object.assign(g, saved),
  };
}

test('1 · a moved line lands the row again — until the person scrolls', () => {
  assert.equal(stickLineMoved(58, 109), true, 'the bar coming back (58 → 109) is a move');
  assert.equal(stickLineMoved(58, 58.4), false, 'a sub-pixel wobble is not');

  const dom = fakeDom();
  try {
    dom.setLine(58);
    let lands = 0;
    const release = holdLandingLine(dom.root, () => (lands += 1));
    assert.equal(dom.landing(), true, 'the page steers the scroll without saying so — the bar answers the landing');
    dom.setLine(109); // the pinned row grew under the landing
    assert.equal(lands, 1, 'the line moved under the landing and the row stayed where the OLD line put it — the cover');
    dom.setLine(109); // re-written to itself: no move
    assert.equal(lands, 1, 'a line that did not move lands again — a scroll for nothing');
    dom.fire('touchstart'); // the person takes the scroll
    assert.equal(dom.landing(), false, 'the bar stays frozen after the person scrolls — it never hides again');
    dom.setLine(58);
    assert.equal(lands, 1, 'the page kept steering after the person touched it');
    release();

    lands = 0;
    holdLandingLine(dom.root, () => (lands += 1));
    for (let i = 0; i < MAX_RELANDS + 3; i += 1) dom.setLine(i % 2 ? 58 : 109);
    assert.equal(lands, MAX_RELANDS, 'a line that keeps moving is followed forever — the hold has no end');
  } finally {
    dom.restore();
  }
});

test('1b · the top bar does not answer the page’s own landing', () => {
  const hook = stripComments(readFileSync(join(__dirname, '..', 'app/_components/nav/use-hide-on-scroll.ts'), 'utf8'));
  const step = hook.slice(hook.indexOf('requestAnimationFrame(() => {'));
  const landing = step.indexOf('if (pageIsLanding())');
  assert.ok(landing > 0, 'the bar answers the landing’s own scroll — up brings it back over the line it aimed at (the cover)');
  assert.ok(landing < step.indexOf('setHidden('), 'the bar moves before it asks whether the page is landing');
  assert.equal(offTheLine(110, 109), false, 'a pixel is on the line');
  assert.equal(offTheLine(113, 109), true, 'four pixels low is off it (WebKit after a fold above)');
});

test('2 · the bench’s landing holds its line on the takeover root, and lets go on cleanup', () => {
  const land = BENCH.slice(BENCH.indexOf('const [landing, setLanding]'), BENCH.indexOf('}, [landing]);'));
  assert.ok(land.length > 0, 'the landing effect is gone');
  assert.match(
    land,
    /const release = holdLandingLine\(benchRef\.current\?\.closest<HTMLElement>\('\[data-budget-build-takeover\]'\) \?\? null, land, \{\s*row,\s*holder: benchRef\.current,\s*\}\);/,
    'the landing aims once and never looks at the line again — the 2026-10-29 cover',
  );
  assert.match(land, /return \(\) => \{[\s\S]*release\(\);[\s\S]*\}/, 'the hold outlives its landing — an old row is pulled back');
  // The takeover root is the element that carries both the attribute and `--stick-h`.
  assert.match(SHELL, /<section ref=\{rootRef\} data-budget-build-takeover=""/, 'the hold watches an element that does not own --stick-h');
  assert.match(SHELL, /root\.style\.setProperty\('--stick-h'/, '--stick-h is no longer written on the takeover root');
  assert.equal(STICK_LINE_VAR, '--stick-h');
  // Each open head's height is measured onto its row.
  assert.match(
    BENCH,
    /measureOpenHeads\(benchRef\.current, '\.cat\.open', ':scope > \.cat-head-row'\)/,
    'the cards clear a head whose height nobody measured',
  );
});

test('3 · the row lands ON the line; its body and cards clear the line plus their own head', () => {
  assert.match(
    SHELL,
    /\.slcat \[id\^="sltile-"\]\{scroll-margin-top:var\(--stick-h,150px\)\}/,
    'an opened row lands off the line — the head jumps a strip as the page moves',
  );
  assert.doesNotMatch(SHELL, /\[id\^="sltile-"\][^{]*\{scroll-margin-top:calc\(var\(--stick-h,150px\) \+ 14px\)/, 'the 14 px strip is back');
  const cards = /\.cat\.open>\.cat-collapse>\.cat-body,[^{]*\.cat\.open \.cat-body :is\(\.vcw,\[id\]\)\{scroll-margin-top:calc\(var\(--stick-h,150px\) \+ var\((--[a-z-]+),0px\)\)\}/.exec(
    SHELL,
  );
  assert.ok(cards, 'a card scrolled to inside an open category lands under its head');
  assert.equal(cards[1], CAT_HEAD_VAR, 'the cards clear a head height nobody writes');
  // The head pins where the row lands.
  assert.match(BENCH, /\.cat\.open>\.cat-head-row\{position:sticky;top:var\(--stick-h,150px\)/, 'the head pins somewhere the row does not land');
});

test('4 · a page shorter than the screen still gets all the room it needs', () => {
  // Walked: a new event at 768 — the row's top at 270, its line at 109, the page could reach 140: 21 px short.
  assert.equal(pinRoomShortfall({ targetTop: 270, margin: 109, maxScroll: 140 }), 21);
  assert.equal(pinRoomShortfall({ targetTop: 270, margin: 109, maxScroll: 161 }), 0);
  assert.equal(pinRoomShortfall({ targetTop: 270, margin: 109, maxScroll: 400 }), 0);
  const fn = read('lib/pin-room.ts');
  const make = fn.slice(fn.indexOf('export function makeRoomToPin'));
  assert.match(make, /pinRoomShortfall\(\{[\s\S]*maxScroll: document\.documentElement\.scrollHeight - window\.innerHeight/, 'the room trusts scrollHeight on a min-height page');
  const loop = /for \(let pass = 0; pass < (\d+); pass \+= 1\) \{([\s\S]*?)\n  \}/.exec(make);
  assert.ok(loop && Number(loop[1]) >= 1, 'the room is never re-read once it is in — a short page stops the row low');
  assert.match(loop?.[2] ?? '', /px \+= missing;\s*holder\.style\.setProperty\(PIN_ROOM_VAR, `\$\{px\}px`\);/, 'the shortfall is read and never added');
});

test('5 · the lab reads the top bar the way the app does', () => {
  assert.match(LAB, /data-chrome="app" data-boundary="tab"/, 'the lab bar counts as showing while slid away — it cannot show this bug');
  assert.match(LAB, /@media \(max-width:700\.98px\)\{\.sl-lab-bar\[data-hidden="true"\]/, 'the lab bar slides away where no real bar does');
});
