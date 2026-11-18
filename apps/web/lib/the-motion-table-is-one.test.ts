/**
 * the-motion-table-is-one.test.ts — 🎞 THE ONE TIMING TABLE (owner 13 Nov 2026, "motion approved" on
 * `Setnayan-specs/prototypes/approved_2026-11-13/grow-full-screen-fable.html` v1; DECISION_LOG 2026-11-13 "Motion system
 * approved").
 *
 * Held here:
 *   1. the numbers ARE the approved table's — and `lib/motion-table.ts` (Web Animations) and the `--sn-m-*` tokens
 *      (globals.css) say the same thing, each declared once;
 *   2. the grow, part by part (`growPlan`): the shape Move 320 ms (18 Nov; 360 on 13 Nov), the page behind to 0.96
 *      under a dim, content in three steps 40 ms apart from 278 ms after the press, ✕ and the bar last (384 → 584) —
 *      content and chrome at the SAME proportions of the shape as 13 Nov's 320 / 440 of 360; the close every window
 *      mirrored at 80 %; reduced motion has no plan (a 120 ms cross-fade);
 *   3. the shape grows from the tapped thing's OWN corner (`riseClip` radius), never wider than half its box;
 *   4. two curves only — Settle (the 13 Nov "emphasized" name is its alias) and the house spring — and the ONE grow
 *      player's parts never hold a transform after they end (a kept transform on an ancestor traps every
 *      `position: fixed` child);
 *   5. the Sheet grows out of its button on THAT player (ported from #7686, 18 Nov): it imports `playGrowParts`, closes
 *      at 80 % back into the button, keeps showing what it showed while closing, and simply appears with no press.
 *
 * Aliases are resolved: `--sn-m-ease-emph: var(--sn-m-settle)` reads as Settle's value.
 *
 * Seen RED once each (13 Nov): `growShapeMs: 360` → 700 (1: the token disagrees); `steps` delay `+ i * t.growStepMs` →
 * `+ i * 80` (2); `Math.min(radius, …)` → `radius` (3); `fill: out ? 'forwards' : 'backwards'` → `'both'` (4).
 * Re-anchored 18 Nov, seen RED again: `growContentStartMs: 278` → 320 (2: the proportion breaks); `--sn-m-move: 320ms`
 * → 360ms (1); the sheet's `playGrowParts(parts, plan, out)` removed (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { EASE_EMPHASIZED, EASE_EMPHASIZED_REVERSED, EASE_SPRING, GROW_TOTAL_MS, MOTION_TABLE, REDUCED_MOTION } from '@/lib/motion-table';
import { closeWindow, growPlan, riseClip, riseScreenMotion, sheetGrowFrames } from '@/lib/rise-screen';

const WEB = join(__dirname, '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
const token = (name: string): string => {
  const all = [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.equal(all.length, 1, `${name} is declared ${all.length} times`);
  return all[0]!;
};
/** A token's value with its aliases followed (`var(--x)` → the value of `--x`). */
const resolve = (name: string): string => {
  const v = token(name);
  const alias = /^var\((--[\w-]+)\)$/.exec(v);
  return alias ? resolve(alias[1]!) : v;
};
const ms = (name: string) => Number(/^(\d+)ms$/.exec(resolve(name))?.[1]);

test('1 · the numbers are the approved table — and JS and CSS say the same', () => {
  // The approved table, row by row (grow-full-screen-fable.html § 6).
  assert.deepEqual(
    [MOTION_TABLE.pressInMs, MOTION_TABLE.releaseMs, MOTION_TABLE.rippleMs, MOTION_TABLE.toggleMs, MOTION_TABLE.chipInMs, MOTION_TABLE.chipOutMs, MOTION_TABLE.rowOpenMs, MOTION_TABLE.rowShutMs, MOTION_TABLE.growPressMs, MOTION_TABLE.growShapeMs],
    [100, 280, 520, 260, 220, 180, 320, 260, 100, 320],
  );
  // 18 Nov retimes: Saved ✓ 200 / 1400 / 200; swipe leaves in Quick, the gap closes on Move; snap back stays 220.
  assert.deepEqual([MOTION_TABLE.savedInMs, MOTION_TABLE.savedHoldMs, MOTION_TABLE.savedOutMs], [200, 1400, 200]);
  assert.deepEqual([MOTION_TABLE.swipeSnapMs, MOTION_TABLE.swipeLeaveMs, MOTION_TABLE.swipeGapMs], [220, 200, 320]);
  assert.equal(MOTION_TABLE.growCloseFactor, 0.8);
  assert.equal(MOTION_TABLE.pressScale, 0.97);
  assert.equal(MOTION_TABLE.rowPressScale, 0.985);
  assert.equal(GROW_TOTAL_MS, 584, '“press to last part in place” is not 584 ms');
  // Content and chrome keep 13 Nov's proportions of the shape (200/360 and 320/360, measured from the shape's start).
  const t = MOTION_TABLE;
  assert.equal(t.growContentStartMs - t.growPressMs, Math.round((t.growShapeMs * (320 - 120)) / 360), 'the content no longer starts at 13 Nov’s share of the shape');
  assert.equal(t.growChromeStartMs - t.growPressMs, Math.round((t.growShapeMs * (440 - 120)) / 360), 'the chrome no longer starts at 13 Nov’s share of the shape');
  // CSS mirrors.
  const pairs: Array<[string, number]> = [
    ['--sn-m-press-in', MOTION_TABLE.pressInMs],
    ['--sn-m-release', MOTION_TABLE.releaseMs],
    ['--sn-m-ripple', MOTION_TABLE.rippleMs],
    ['--sn-m-toggle', MOTION_TABLE.toggleMs],
    ['--sn-m-toggle-tick', MOTION_TABLE.toggleTickMs],
    ['--sn-m-chip-in', MOTION_TABLE.chipInMs],
    ['--sn-m-chip-out', MOTION_TABLE.chipOutMs],
    ['--sn-m-field-grow', MOTION_TABLE.fieldGrowMs],
    ['--sn-m-field-label', MOTION_TABLE.fieldLabelMs],
    ['--sn-m-field-line', MOTION_TABLE.fieldLineMs],
    ['--sn-m-row-open', MOTION_TABLE.rowOpenMs],
    ['--sn-m-row-shut', MOTION_TABLE.rowShutMs],
    ['--sn-m-grow-press', MOTION_TABLE.growPressMs],
    ['--sn-m-grow-shape', MOTION_TABLE.growShapeMs],
    ['--sn-m-swipe-snap', MOTION_TABLE.swipeSnapMs],
  ];
  for (const [name, v] of pairs) assert.equal(ms(name), v, `${name} disagrees with lib/motion-table.ts`);
  assert.equal(resolve('--sn-m-ease-emph'), EASE_EMPHASIZED);
  assert.equal(EASE_EMPHASIZED, 'cubic-bezier(.2,.8,.2,1)', 'the travel curve is not Settle');
  assert.equal(resolve('--sn-m-ease-emph-rev'), EASE_EMPHASIZED_REVERSED);
  assert.equal(EASE_EMPHASIZED_REVERSED, 'cubic-bezier(.8,0,.8,.2)', 'the close curve is not Settle reversed');
  assert.equal(token('--sn-pill-spring'), EASE_SPRING, 'the house spring is two curves');
  // Every motion names its reduced-motion fallback.
  for (const k of ['press', 'release', 'ripple', 'toggle', 'chip', 'rowPress', 'rowExpand', 'grow'] as const) assert.ok(REDUCED_MOTION[k]);
});

test('2 · the grow, part by part — and the close mirrored at 80 %', () => {
  assert.equal(growPlan(true, true), null, 'reduced motion grows');
  const p = growPlan(false, true)!;
  const fromPress = (x: number) => x + MOTION_TABLE.growPressMs; // the plan is measured from mount (after the press)
  assert.deepEqual(p.shape, { delay: 0, duration: 320 });
  assert.equal(fromPress(p.shape.delay + p.shape.duration), 420, 'the page is not usable from 420 ms');
  assert.deepEqual(p.steps.map((s) => fromPress(s.delay)), [278, 318, 358], 'the content steps are not 278 · 318 · 358');
  assert.equal(p.stepRisePx, 10);
  assert.equal(fromPress(p.chrome.delay), 384, '✕ does not arrive last');
  assert.equal(fromPress(p.bar.delay + p.bar.duration), 584, 'the bar is not in place at 584 ms');
  assert.ok(p.chrome.delay > p.steps[2]!.delay, 'the chrome is not after the content');
  assert.equal(p.behind.scale, 0.96);
  assert.ok(p.behind.dim > 0 && p.behind.dim < 0.5);
  // The close: 80 % as long, last-in first-out — the chrome leaves first, the shape closes last.
  const c = (w: { delay: number; duration: number }) => closeWindow(w, p);
  assert.equal(c(p.shape).duration, Math.round(320 * 0.8));
  assert.equal(c(p.bar).delay, 0, 'the bar is not the first thing out');
  assert.ok(c(p.shape).delay > c(p.chrome).delay, 'the shape closes before the chrome has left');
  const m = riseScreenMotion({ top: 500, left: 16, width: 120, height: 44 }, { width: 390, height: 844 }, false, 22)!;
  assert.equal(m.timing.duration, 320);
  assert.equal(m.closeTiming.duration, 256);
  assert.equal(m.timing.easing, EASE_EMPHASIZED);
  assert.deepEqual(Object.keys(m.frames[0]!), ['clipPath'], 'the shape animates more than its clip');
  assert.equal(riseScreenMotion(null, { width: 390, height: 844 }, false), null, 'a deep link grows from nowhere');
});

test('3 · the shape grows from the tapped thing’s own corner', () => {
  const vp = { width: 390, height: 844 };
  assert.match(riseClip({ top: 500, left: 16, width: 120, height: 44 }, vp, 22), /round 22px\)$/);
  assert.match(riseClip({ top: 500, left: 16, width: 120, height: 44 }, vp, 999), /round 22px\)$/, 'a pill’s radius overruns half its height');
  assert.match(riseClip({ top: 500, left: 16, width: 120, height: 44 }, vp), /round 14px\)$/, 'no radius to read is not the house 14 px');
  const screen = stripComments(readFileSync(join(WEB, 'app/_components/rise/rise-screen.tsx'), 'utf8'));
  assert.equal((screen.match(/radiusOf\(originRef\.current\)/g) ?? []).length, 2, 'the open and the close do not read the tapped corner');
});

test('4 · two curves only; the ONE grow player’s parts hold nothing once they end', () => {
  const lib = stripComments(readFileSync(join(WEB, 'lib/rise-screen.ts'), 'utf8'));
  const helpers = lib.slice(lib.indexOf('export function playGrowParts'), lib.indexOf('// ── end of the grow player ──'));
  assert.ok(helpers.length > 200, 'premise: the grow helpers');
  assert.match(helpers, /fill: out \? 'forwards' : 'backwards',/, 'an opening part holds its transform after it lands');
  assert.doesNotMatch(helpers, /fill: 'both'/, 'a part holds both ends');
  assert.doesNotMatch(helpers, /cubic-bezier\(/, 'a part keeps a curve of its own');
  // Only transform and opacity move in the parts (the shape's clip is the one stated exception, on the screen itself).
  for (const prop of ['width', 'height', 'top', 'left', 'margin']) {
    assert.doesNotMatch(helpers, new RegExp(`\\{ ${prop}:`), `a part animates ${prop}`);
  }
  assert.match(helpers, /a\.finished\.then\(\(\) => \(el\.style\.transformOrigin = ''\)/, 'the page behind keeps a transform origin');
  assert.match(helpers, /d\.finished\.then\(\(\) => dim\.remove\(\), \(\) => dim\.remove\(\)\);/, 'the dim is left on the page');
});

test('5 · the Sheet grows out of its button on the ONE grow player (ported from #7686)', () => {
  const sheet = stripComments(readFileSync(join(WEB, 'app/_components/sheet.tsx'), 'utf8'));
  // One player: the sheet plays the same parts as Rise full screen, never an engine of its own.
  assert.match(sheet, /from '@\/lib\/rise-screen'/, 'the sheet does not read the one grow player');
  assert.match(sheet, /playGrowParts\(parts, plan, out\)/, 'the sheet does not play its parts on the one player');
  assert.doesNotMatch(sheet, /grow-motion/, 'a second grow engine is back');
  assert.ok(!existsSync(join(WEB, 'lib/grow-motion.ts')), 'a second grow engine (lib/grow-motion.ts) exists');
  // The close: 80 %, back into the button, and still showing what it showed.
  assert.match(sheet, /duration: out \? RISE_CLOSE_MS : RISE_MS/, 'the sheet’s close is not the open at 80 %');
  assert.match(sheet, /if \(open\) shown\.current = \{ children, head, foot \};/, 'a closing sheet empties mid-close');
  assert.match(sheet, /if \(!open && !present\) return null;/, 'the sheet leaves before its close has played');
  // No fresh press: it never GROWS from nowhere — since Phase 2 (18 Nov, "sheets use Stack") it slides in from its own
  // edge and leaves the same way (`playSheetStack`); the grow is only ever played from a real origin.
  assert.match(sheet, /if \(!originRef\.current\) \{[^}]*void playSheetStack\(parts, false\);\s*return;\s*\}/, 'a sheet with no press behind it grows from nowhere');
  assert.match(sheet, /\(origin && origin\.isConnected \? playSheetGrow\(parts, origin, true\) : playSheetStack\(parts, true\)\)/, 'a sheet whose button left the page closes into nothing');
  // The shape: transform + one clip, from the button's box to the panel's, ending unclipped.
  const f = sheetGrowFrames({ left: 20, top: 600, width: 120, height: 44 }, { left: 0, top: 300, width: 390, height: 544 }, 22);
  assert.equal(f[0]!.transform, 'translate(20px, 300px)');
  assert.equal(f[0]!.clipPath, 'inset(0px 270px 500px 0px round 22px)');
  assert.deepEqual(f[1], { transform: 'none', clipPath: 'inset(-120px -120px -120px -120px round 0px)' });
  assert.deepEqual(Object.keys(f[0]!).sort(), ['clipPath', 'transform'], 'the sheet’s shape animates more than transform and its clip');
});
