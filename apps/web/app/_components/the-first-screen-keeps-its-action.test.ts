/**
 * the-first-screen-keeps-its-action.test.ts — THE FIRST SCREEN SHOWS ITS ONE ACTION, AND THE ACTION COVERS NOTHING.
 *
 * Measured on the live sample event's guest page (2026-10-11, a stranger on a phone):
 *
 *   G09 · "Get inside" has its place at y 715–771: entirely below a 375 × 667 screen, and under the bar at
 *         375 × 812 (32 of 56 px showing).
 *   …and then, on the preview of this branch's FIRST fix (the button docked over the cover, `position: sticky`):
 *         fully in view at four sizes — and SITTING ON the names, the date or the link in 5 of 8 first screens.
 *         A button that covers the couple's names is worse than a button below the fold.
 *
 * 🔑 THE PROPERTY: on the first screen the button is fully in view AND its box meets no other box — because it is
 * in the cover's flow and the cover makes room for it (`app/[slug]/_lib/first-screen-fit.ts`): air first, then the
 * mark smaller, then whole parts below the button; the names never.
 *
 *   (1) (2) the cookie banner clears the bar, however late the bar arrives — `the-cookie-banner-clears-the-bar.test.ts`;
 *   (3) THE RULE, on two thousand generated covers: nothing overlaps, the names never give way, parts give way in
 *       the one order and no more of them than it takes, and a cover that fits is left exactly as designed;
 *   (4) THE REAL PAGE: the boxes measured in Chromium from the tester's saved copy of the live page, at
 *       320 × 568 · 375 × 667 · 375 × 812 · 390 × 844, with the cookie banner up and with it answered — the rule
 *       puts the button fully between the top bar and the bar (or the banner), on no text box, with the names in
 *       view, in all eight; and as the page ships today the button misses that in seven of them;
 *   (5) the page wears it: the button is never `sticky` or `fixed` again, the component measures what the rule
 *       asks for, and with no plan written every value is the utility it stands in for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { GIVE_WAY_ORDER, MARK_MIN, fitFirstScreen, layoutFirstScreen, planGiveWay, type FitBox, type FitSnapshot } from '../[slug]/_lib/first-screen-fit';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = read('app/globals.css');

const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
/** The blocks as the plan draws them: each at its own place plus its shift. */
function drawn(snap: FitSnapshot, gives: readonly string[]): FitBox[] {
  const laid = layoutFirstScreen(snap, gives);
  return [...snap.parts, snap.door].map((b) => ({ key: b.key, top: laid.tops[b.key]!, bottom: laid.tops[b.key]! + (b.bottom - b.top) }));
}
const noOverlap = (boxes: FitBox[], where: string) => {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(overlap(boxes[i]!, boxes[j]!) < 0.5, `${where}: ${boxes[i]!.key} ${boxes[i]!.top}–${boxes[i]!.bottom} is drawn on ${boxes[j]!.key} ${boxes[j]!.top}–${boxes[j]!.bottom}`);
    }
  }
};

test('(3) the rule: nothing overlaps, the names never give way, parts go in one order and no more than it takes', () => {
  let seed = 20261011;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const KEYS = ['eyebrow', 'mark', 'names', 'line', 'date', 'time', 'link'];
  /** A cover: some of the parts (the names always), each with a height and a gap above it, then the button. */
  const cover = (): FitSnapshot => {
    let y = 100 + rnd(60);
    const parts: FitBox[] = [];
    for (const key of KEYS) {
      if (key !== 'names' && rnd(6) === 0) continue; // a couple may have hidden a part
      y += parts.length ? rnd(48) : 0;
      const h = key === 'mark' ? 60 + rnd(120) : key === 'names' ? 60 + rnd(120) : 14 + rnd(50);
      parts.push({ key, top: y, bottom: y + h });
      y += h;
    }
    y += 8 + rnd(40);
    return { parts, door: { key: 'door', top: y, bottom: y + 56 } };
  };
  let covers = 0, gave = 0, untouched = 0, namesOnly = 0;
  for (let i = 0; i < 2000; i++) {
    const snap = cover();
    const limit = 260 + rnd(700);
    const plan = planGiveWay(snap, limit);
    const where = `cover ${i} (limit ${limit})`;
    covers++;
    assert.ok(!plan.gives.includes('names'), `${where}: the names gave way`);
    // In the one order: what gave way is the first N of GIVE_WAY_ORDER that this cover has.
    const present = GIVE_WAY_ORDER.filter((k) => snap.parts.some((p) => p.key === k));
    assert.deepEqual([...plan.gives].sort(), present.slice(0, plan.gives.length).sort(), `${where}: parts gave way out of order`);
    // No more than it takes: with one fewer the button would pass the limit.
    if (plan.gives.length > 0) {
      const fewer = present.slice(0, plan.gives.length - 1);
      assert.ok(layoutFirstScreen(snap, fewer).doorBottom > limit, `${where}: a part gave way that did not have to`);
      gave++;
    } else {
      assert.deepEqual(plan.shift, {}, `${where}: nothing gave way and a block was still moved`);
      untouched++;
    }
    const boxes = drawn(snap, plan.gives);
    noOverlap(boxes, where);
    // Kept parts stay in the page's own order above the button; given parts in their own order below it.
    const door = boxes.find((b) => b.key === 'door')!;
    const kept = boxes.filter((b) => b.key !== 'door' && !plan.gives.includes(b.key));
    const given = boxes.filter((b) => plan.gives.includes(b.key));
    assert.ok(kept.every((b) => b.bottom <= door.top + 0.5) && given.every((b) => b.top >= door.bottom - 0.5), `${where}: a kept part is under the button, or a given one above it`);
    for (const list of [kept, given]) for (let k = 1; k < list.length; k++) assert.ok(list[k]!.top >= list[k - 1]!.bottom - 0.5, `${where}: the page's order was not kept`);
    assert.equal(plan.fits, door.bottom <= limit);
    if (!plan.fits) {
      // Even the names and the button do not fit: the button is directly under the names, in flow — never on them.
      assert.deepEqual(kept.map((b) => b.key), ['names'], `${where}: it does not fit and something besides the names still stands above the button`);
      namesOnly++;
    }
    // The block the cover occupies does not grow: what moved below the button uses the room the button left.
    const extent = (bs: FitBox[]) => Math.max(...bs.map((b) => b.bottom)) - Math.min(...bs.map((b) => b.top));
    assert.ok(extent(boxes) <= extent([...snap.parts, snap.door]) + 48, `${where}: the cover grew past the room it had`);
  }
  assert.ok(covers === 2000 && gave > 400 && untouched > 300 && namesOnly > 20, `the sweep went thin (${gave} gave way, ${untouched} untouched, ${namesOnly} names-only)`);
  assert.deepEqual([...GIVE_WAY_ORDER], ['link', 'time', 'mark', 'eyebrow', 'line', 'date'], 'the order parts give way in changed — the date goes last, the names are not on it');

  // A cover that fits is left exactly as designed; one that needs only air, or only a smaller mark, moves no part.
  const snap = cover();
  const tighter = (cut: number): FitSnapshot => ({ parts: snap.parts, door: { key: 'door', top: snap.door.top - cut, bottom: snap.door.bottom - cut } });
  const m = { natural: snap, noAir: tighter(80), smallMark: tighter(140) };
  assert.deepEqual(fitFirstScreen(m, snap.door.bottom), { air: 1, mark: 1, gives: [], shift: {}, doorBottom: snap.door.bottom, fits: true });
  const airOnly = fitFirstScreen(m, snap.door.bottom - 40);
  assert.ok(airOnly.air > 0 && airOnly.air < 1 && airOnly.mark === 1 && airOnly.gives.length === 0 && airOnly.doorBottom <= snap.door.bottom - 40, 'forty pixels short should cost some air and nothing else');
  const markToo = fitFirstScreen(m, snap.door.bottom - 110);
  assert.ok(markToo.air === 0 && markToo.mark < 1 && markToo.mark >= MARK_MIN && markToo.gives.length === 0 && markToo.doorBottom <= snap.door.bottom - 110, 'a hundred and ten short should close the air and shrink the mark, and move no part');
});

type Screen = { size: string; banner: 'up' | 'answered'; vh: number; headerBottom: number; limit: number; natural: FitSnapshot; noAir: FitSnapshot; smallMark: FitSnapshot };
const SCREENS = (JSON.parse(read('app/[slug]/_lib/first-screen-boxes.fixture.json')) as { screens: Screen[] }).screens;

test('(4) the real page, four phones × the cookie banner up and answered: the button is in view, on nothing, and the names are there', () => {
  assert.deepEqual(
    SCREENS.map((s) => `${s.size} ${s.banner}`),
    ['320x568 up', '320x568 answered', '375x667 up', '375x667 answered', '375x812 up', '375x812 answered', '390x844 up', '390x844 answered'],
    'the measured screens changed — re-measure all eight (hub-walk/guest-fixes/scripts/harness2.mjs)',
  );
  let missedAsShipped = 0;
  const gaveWay: Record<string, string> = {};
  for (const s of SCREENS) {
    const where = `${s.size} · banner ${s.banner}`;
    // As the page ships today: the button in its own place.
    const shipped = s.natural.door;
    if (shipped.bottom > s.limit) missedAsShipped++;
    // The measured cover is the sample event's: every part is there.
    assert.deepEqual(s.natural.parts.map((p) => p.key), ['eyebrow', 'mark', 'names', 'line', 'date', 'time', 'link'], `${where}: the measured cover lost a part`);

    const plan = fitFirstScreen(s, s.limit);
    assert.ok(plan.fits, `${where}: the names and the button do not fit the first screen`);
    assert.ok(plan.doorBottom <= s.limit + 0.5, `${where}: the plan leaves the button's bottom at ${plan.doorBottom}, past ${s.limit}`);
    assert.ok(plan.air >= 0 && plan.air <= 1 && plan.mark >= MARK_MIN && plan.mark <= 1);
    assert.ok(!plan.gives.includes('names'), `${where}: the names gave way`);

    // The boxes it draws — measured with the air closed and the mark small, which is the least room it ever takes.
    const snap = plan.gives.length > 0 || plan.air === 0 ? s.smallMark : plan.mark < 1 ? s.smallMark : s.noAir;
    const boxes = plan.air === 1 && plan.mark === 1 ? [...s.natural.parts, s.natural.door] : drawn(snap, plan.gives);
    noOverlap(boxes, where);
    const door = boxes.find((b) => b.key === 'door')!;
    const names = boxes.find((b) => b.key === 'names')!;
    // Fully in view: under the pinned top bar, above the bottom bar (or the cookie banner).
    assert.ok(door.top >= s.headerBottom && door.bottom <= s.limit + 0.5, `${where}: the button ${door.top}–${door.bottom} is not between ${s.headerBottom} and ${s.limit}`);
    assert.ok(names.top >= s.headerBottom && names.bottom <= door.top + 0.5, `${where}: the names ${names.top}–${names.bottom} are not in view above the button`);
    // It meets no text box: every other block ends above it or starts below it.
    for (const b of boxes) if (b !== door) assert.ok(overlap(b, door) < 0.5, `${where}: the button sits on "${b.key}"`);
    gaveWay[where] = plan.gives.join(' · ') || (plan.air < 1 || plan.mark < 1 ? `nothing (air ${plan.air}${plan.mark < 1 ? `, mark ${plan.mark.toFixed(2)}` : ''})` : 'nothing — it fits as designed');
  }
  assert.equal(missedAsShipped, 7, `as shipped the button should miss the first screen in 7 of 8 (got ${missedAsShipped}) — the fixture no longer reproduces the fault`);
  // What gives way, screen by screen. The names never; the date holds everywhere it was measured.
  assert.deepEqual(gaveWay, {
    '320x568 · banner up': 'eyebrow · mark · line · time · link',
    '320x568 · banner answered': 'mark · time · link',
    '375x667 · banner up': 'mark · time · link',
    '375x667 · banner answered': 'link',
    '375x812 · banner up': 'link',
    '375x812 · banner answered': 'nothing (air 0.62)',
    '390x844 · banner up': 'nothing (air 0, mark 0.83)',
    '390x844 · banner answered': 'nothing — it fits as designed',
  });
});

/** The declarations of the first rule for `selector` in the door's block of `globals.css`. */
function declarations(selector: string): Record<string, string> {
  const esc = selector.replace(/[.[\]'>~:()*]/g, (c) => `\\${c}`);
  const m = new RegExp(`^  ${esc} \\{([^}]*)\\}`, 'm').exec(CSS);
  assert.ok(m, `globals.css no longer has a ${selector} rule`);
  return Object.fromEntries([...m![1]!.matchAll(/([\w-]+):\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()]));
}

test('(5) the page wears it: the button never floats, the component measures what the rule asks, and no plan = the page as written', () => {
  // The button is in flow. Nothing about it is sticky or fixed — that is how it came to sit on the names.
  const start = CSS.indexOf('THE FIRST SCREEN MAKES ROOM FOR ITS ONE ACTION');
  const block = stripComments(CSS.slice(start, CSS.indexOf('Candlelight art direction', start)));
  assert.ok(start > 0 && block.length > 400, 'the door’s block is gone from globals.css');
  assert.doesNotMatch(block, /position:\s*(?:sticky|fixed)/, 'the button floats over the cover again');
  assert.equal(declarations('.sn-door-row').display, 'contents');
  assert.match(declarations('.sn-door-dock')['scroll-margin-bottom'] ?? '', /var\(--sn-door-rest\)/);
  assert.match(CSS, /@media \(min-width: 1280px\) \{\s*\.sn-door-dock \{\s*--sn-door-rest: 1rem;/);

  // With no plan written (`--fs-air` and `--fs-mark` unset → 1) each value IS the utility it replaces.
  const rem = (expr: string, air: number, mark: number): number => {
    const filled = expr.replace(/var\(--fs-air, 1\)/g, String(air)).replace(/var\(--fs-mark, 1\)/g, String(mark)).replace(/calc/g, '').replace(/rem/g, '');
    assert.match(filled, /^[\d\s.()+*-]+$/, `cannot evaluate "${expr}"`);
    return Function(`"use strict"; return (${filled});`)() as number;
  };
  const card = declarations("[data-first-screen-fit] [data-cover-frameless] > div");
  const mark = declarations("[data-first-screen-fit] [data-cover-frameless] [data-motion='arrive-mark']");
  const drawing = declarations("[data-first-screen-fit] [data-cover-frameless] [data-motion='arrive-mark'] > div");
  const row = declarations(':not([hidden]) ~ .sn-door-row > :first-child');
  const lift = declarations('[data-first-screen-fit]');
  const asDesigned = { pt: rem(card['padding-top']!, 1, 1), pb: rem(card['padding-bottom']!, 1, 1), markTop: rem(mark['margin-top']!, 1, 1), markHeight: rem(mark.height!, 1, 1), scale: rem(drawing['--tw-scale-x']!, 1, 1), rowTop: rem(row['margin-top']!, 1, 1), lift: rem(lift['margin-top']!, 1, 1) };
  // pt-8 · pb-7 · mt-5 · h-[9.5rem] · scale-[1.85] · the row's 1.5rem · no lift
  assert.deepEqual(asDesigned, { pt: 2, pb: 1.75, markTop: 1.25, markHeight: 9.5, scale: 1.85, rowTop: 1.5, lift: -0 });
  const masthead = stripComments(read('app/[slug]/_components/pahina-masthead.tsx'));
  assert.match(masthead, /<div className="px-5 pb-7 pt-8">/, 'the card’s padding changed — the fit’s values no longer stand in for it');
  assert.match(masthead, /data-motion="arrive-mark" className="mt-5 flex h-\[9\.5rem\] items-center justify-center">[\s{}]*<div className="scale-\[1\.85\]">/, 'the mark’s box changed — the fit’s values no longer stand in for it');
  // Closed up, the cover is smaller in every one of them; the mark at its least is MARK_MIN of itself.
  assert.ok(rem(card['padding-top']!, 0, 1) < 2 && rem(card['padding-bottom']!, 0, 1) < 1.75 && rem(row['margin-top']!, 0, 1) < 1.5 && rem(lift['margin-top']!, 0, 1) < 0);
  assert.equal(rem(mark.height!, 0, MARK_MIN), 9.5 * MARK_MIN);
  assert.equal(declarations('[data-first-screen-fit] [data-fs-shift]').top, 'var(--fs-shift, 0px)');

  // The door mounts the measuring half — unless it is told not to (the Maker's canvas).
  const door = stripComments(read('app/[slug]/_components/get-inside.tsx'));
  assert.match(door, /<details className=\{`group mx-auto max-w-md\$\{dock \? ' sn-door-dock' : ''\}`\} data-get-inside="door">/);
  assert.match(door, /\{dock \? <FirstScreenDoor \/> : null\}/);
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /<div className="sn-door-row">[\s\S]{0,1600}<GetInside[\s\S]{0,200}dock=\{!isEditorCanvas\}/, 'the door’s row changed, or the canvas fits it');

  // The component: three measurements, the rule, and the limit — the bar's top or the banner's, whichever is higher.
  // (RE-AIMED 2026-10-12: the measuring and writing moved, unchanged, to `_lib/first-screen-fit-dom.ts`, so the ONE fit
  // has a second caller — Scrub's hold fits its cover before it fades, owner "option 2" — and no copy. The claim is
  // unchanged: three measurements, the rule, the limit.)
  const fit = stripComments(read('app/[slug]/_components/first-screen-door.tsx'));
  const hands = stripComments(read('app/[slug]/_lib/first-screen-fit-dom.ts'));
  assert.match(fit, /firstScreenFitter\(screen, cover, inner, door, \(\) => window\.scrollY\)/, 'the door no longer fits through the one fitter');
  assert.match(fit, /plan = make\(list, limit\);/);
  assert.match(hands, /const natural = snapshot\(list\);\s*set\(0, 1\);\s*const noAir = snapshot\(list\);\s*set\(0, MARK_MIN\);\s*const smallMark = snapshot\(list\);\s*let plan = fitFirstScreen\(\{ natural, noAir, smallMark \}, limit\);/);
  assert.doesNotMatch(hands, /style\.(?:position|top|transform)\b/, 'the fit positions a block itself');
  assert.match(fit, /getPropertyValue\('--cookie-banner-top'\)/);
  assert.match(fit, /const limit = window\.innerHeight - Math\.max\(rest, banner > 0 \? banner \+ 8 : 0\);/);
  assert.match(fit, /parseFloat\(getComputedStyle\(door\)\.scrollMarginBottom\)/);
  // It fits again when the banner arrives or goes, when the window or the block changes, and when the door opens.
  assert.match(fit, /\.observe\(root, \{ attributes: true, attributeFilter: \['style'\] \}\)/);
  assert.match(fit, /new ResizeObserver\(soon\)/);
  assert.match(fit, /door\.addEventListener\('toggle', onToggle\)/);
  assert.match(fit, /if \(door\.open\) door\.scrollIntoView\(\{ block: 'nearest'/);
  // 🎚 While the cover hands over by Scrub (the page's hold armed) it stands aside: a fit answering the hand-over's
  // re-measure fed a loop (the page changed length every ~120 ms at 375 × 560 — `scripts/scrub-browser-check.mjs` 16
  // plays it in a browser; this only pins the source).
  // (RE-AIMED 2026-10-12, owner "option 2": the cover is FITTED ONCE BEFORE IT FADES and the fit must not run again
  // while it is held. So, armed, it measures nothing and writes nothing — and no longer takes the plan back: the
  // hold fitted the first screen before it armed, by the same rule (`hub-scrub-engine.ts` `fitCover`), and the plan
  // stays while the cover is held. Disarmed, it fits as before.)
  assert.match(fit, /const handedOver = \(\) => door\.closest\('\[data-hub-page-on\]'\) !== null;/);
  assert.match(fit, /if \(handedOver\(\)\) return;\s*const list = blocks\(\);\s*clear\(list\);/, 'the fit measures or writes while the cover is held');
  assert.match(fit, /\.observe\(hold, \{ attributes: true, attributeFilter: \['data-hub-page-on'\] \}\)/, 'the fit does not hear the hand-over arm');
  // It writes custom properties and one attribute — never a position of its own.
  assert.doesNotMatch(fit, /style\.(?:position|top|transform)\b/, 'the component positions a block itself');

  // The banner says where its top is — only as the full-width sheet — and takes the word back when it goes.
  const banner = stripComments(read('app/_components/cookie-consent-banner.tsx'));
  assert.match(banner, /const BANNER_TOP_VAR = '--cookie-banner-top';/);
  assert.match(banner, /if \(r\.width >= window\.innerWidth - 1\) root\.style\.setProperty\(BANNER_TOP_VAR, `\$\{Math\.round\(window\.innerHeight - r\.top\)\}px`\);/);
  assert.ok((banner.match(/root\.style\.removeProperty\(BANNER_TOP_VAR\)/g) ?? []).length >= 2, 'the banner’s top outlives the banner');
});
