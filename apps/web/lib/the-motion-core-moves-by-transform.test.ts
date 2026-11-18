/**
 * the-motion-core-moves-by-transform.test.ts — THE MOTION STANDARD, PHASE 2 (APP CORE): NOTHING LAYS THE PAGE OUT
 * AGAIN TO MOVE.
 *
 * Owner, 18 Nov 2026 (`MOTION_STANDARD_2026-11-18.md` § 3, the house rules): "Transform and opacity only. Never animate
 * width, height, top/left, max-height, grid rows, background-position or filter blur" · "Fill `backwards`, never
 * `both`" · "Never put `var()` inside a keyframe's `animation-timing-function`" · "Cascade only the first 6 rows".
 *
 *   1 · every keyframe Phase 2 wrote or retimed moves only opacity and the transform family;
 *   2 · the Phase 2 classes transition only the transform family and opacity (a status chip: its two colours);
 *   3 · the rule breakers are gone: the sheet's max-height snap, the fold's and `.sn-acc`'s grid-rows transition;
 *   4 · the script moves (`rows-move.ts`, `search-grows.ts`, `sheet.tsx`) hand `animate()` transform and opacity only,
 *       and never fill `both`;
 *   5 · ONE shake: `sn-row-shake` and `sn-slider-shake` are retired, and nothing shakes on a loop;
 *   6 · every Phase 2 motion reads the standard's tokens — no raw time, no raw curve; no `var()` in a keyframe;
 *   7 · cascade six, 60 ms apart; a row's first drawing never plays;
 *   8 · a number that changes ticks from the old value in Quick — never back through 0;
 *   9 · Busy keeps the veil and `overlay={false}`; ✓ Done is never inferred from "no longer pending".
 *
 * Sabotage (each proved red, 18 Nov 2026): `height: 0` written into `@keyframes sn-m-open-panel` (1) ·
 * `transition-[max-height]` put back on the sheet's panel (3) · `fill: 'both'` in `rows-move.ts` (4) ·
 * `alwaysFromZero: true` put back in `count-up.tsx` (8).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { CASCADE_ROWS, CASCADE_STEP_MS } from './rows-move';
import { QUICK_MS } from './motion-table';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('app/globals.css');

/** Properties that may move. */
const MAY_MOVE = new Set(['opacity', 'transform', 'translate', 'scale', 'rotate']);
/** Properties that lay the page out again, or repaint every frame. */
const LAYOUT = /\b(?:width|height|top|left|right|bottom|max-height|min-height|max-width|grid-template-rows|background-position|filter|margin|padding)\b/;

/** The whole body of `@keyframes <name>` (balanced braces). */
function keyframes(name: string): string {
  const at = CSS.search(new RegExp(`@keyframes ${name}\\s*\\{`));
  assert.ok(at >= 0, `globals.css has no @keyframes ${name}`);
  let depth = 0;
  for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(CSS.indexOf('{', at) + 1, i);
  }
  throw new Error(`@keyframes ${name} never closes`);
}
/** The body of a top-level rule, by its exact selector. */
function rule(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm').exec(CSS);
  assert.ok(m, `globals.css has no rule “${sel}”`);
  return m[1]!;
}
const propsOf = (body: string) => [...body.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)].map((m) => m[1]!);

/* The keyframes this phase wrote (sn-m-*) or retimed onto the standard. */
const PHASE_2_KEYFRAMES = ['sn-m-shake', 'sn-m-open-panel', 'sn-row-step', 'sn-row-field-in', 'sn-row-field-out', 'sn-row-name-back', 'sn-row-pill-back', 'sn-explain-in', 'sn-explain-note-in', 'sn-addman-veil'];

test('1 · every keyframe Phase 2 wrote or retimed moves only opacity and the transform family', () => {
  for (const name of PHASE_2_KEYFRAMES) {
    const body = keyframes(name);
    const props = propsOf(body);
    assert.ok(props.length > 0, `anti-vacuity: @keyframes ${name} declares nothing`);
    for (const p of props) assert.ok(MAY_MOVE.has(p), `@keyframes ${name} animates “${p}” — transform and opacity only`);
    assert.doesNotMatch(body, /animation-timing-function\s*:[^;]*var\(/, `@keyframes ${name} puts var() in a keyframe's timing function (Chrome runs it linear)`);
  }
});

test('2 · the Phase 2 classes transition only the transform family and opacity', () => {
  const moving: Record<string, string[]> = {
    '.sn-m-toast': ['translate', 'opacity'],
    '.sn-m-toast[data-leaving]': ['translate', 'opacity'],
    '.sn-m-pop': ['scale', 'opacity'],
    '.sn-m-busy': ['opacity'],
    '.sn-m-done': ['scale', 'opacity'],
    '.sn-m-status': ['color', 'background-color'],
  };
  for (const [sel, want] of Object.entries(moving)) {
    const t = /transition:\s*([^;]+);/.exec(rule(sel));
    assert.ok(t, `${sel} has no transition`);
    const got = t[1]!.split(',').map((part) => part.trim().split(/\s+/)[0]!);
    assert.deepEqual(got, want, `${sel} transitions ${got.join(', ')}`);
    assert.doesNotMatch(t[1]!, /\ball\b/, `${sel} transitions “all” — a layout property rides along`);
  }
  /* Each entrance is @starting-style — and none of them starts from a layout property. */
  for (const cls of ['sn-m-toast', 'sn-m-pop', 'sn-m-busy', 'sn-m-done']) {
    const start = new RegExp(`@starting-style\\s*\\{\\s*\\.${cls}\\s*\\{([^}]*)\\}\\s*\\}`).exec(CSS);
    assert.ok(start, `.${cls} has no @starting-style entrance`);
    for (const p of propsOf(start[1]!)) assert.ok(MAY_MOVE.has(p), `.${cls} enters from “${p}”`);
  }
  /* A menu's Pop is `scale`, never `transform`: the list is `position: fixed` and may hold fixed children. */
  assert.doesNotMatch(rule('.sn-m-pop'), /transition:[^;]*\btransform\b/);
  assert.match(read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx'), /className="sn-m-pop bg-surface z-\[95\]/, 'the PickMenu’s list does not wear Pop');
  assert.match(read('app/_components/badge.tsx'), /'sn-m-status inline-flex h-6 /, 'the status chip does not cross-fade');
});

test('3 · the rule breakers are gone: no max-height snap, no grid-rows transition', () => {
  const sheet = read('app/_components/sheet.tsx');
  assert.doesNotMatch(sheet, /transition-\[max-height\]|transition-\[height\]|transition-all/, 'the sheet animates its height again');
  assert.match(sheet, /playSheetSnap\(panel, from\)/, 'the half ↔ max snap is not played by transform');
  assert.match(sheet, /max-(?:lg|tab):max-h-\[52dvh\]/, 'anti-vacuity: the sheet no longer opens at half');
  const fold = read('app/_components/fold.tsx');
  assert.doesNotMatch(fold, /transition-\[grid-template-rows\]|transition-all/, 'the fold animates grid rows again');
  assert.match(fold, /slideBelow\(body, \(\) => \{/, 'the rows under a fold do not slide by transform');
  assert.match(fold, /grid-rows-\[1fr\]/, 'anti-vacuity: the fold no longer opens on grid rows');
  assert.doesNotMatch(CSS, /\[data-fold-body\]\s*\{[^}]*transition/, 'the fold’s body transitions again');
  assert.doesNotMatch(rule('.sn-acc'), /transition/, '.sn-acc animates its rows again');
  assert.match(rule('[data-fold-open] > [data-fold-body] > [data-fold-inner]'), /animation:\s*sn-m-open-panel var\(--sn-m-move\) var\(--sn-m-settle\) backwards;/);
});

/** Every `.animate(` call's argument text in a file. */
function animateCalls(src: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf('.animate('); at >= 0; at = src.indexOf('.animate(', at + 1)) {
    let depth = 0;
    for (let i = at + '.animate'.length; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) {
        out.push(src.slice(at, i + 1));
        break;
      }
    }
  }
  return out;
}

test('4 · the script moves hand animate() transform and opacity only — and never fill “both”', () => {
  const files = { 'lib/rows-move.ts': 4, 'app/_components/search-grows.ts': 3, 'app/_components/sheet.tsx': 6 };
  for (const [rel, least] of Object.entries(files)) {
    const src = read(rel);
    const calls = animateCalls(src);
    assert.ok(calls.length >= least, `anti-vacuity: ${rel} has ${calls.length} animate() calls, expected at least ${least}`);
    for (const call of calls) {
      const keys = [...call.matchAll(/[{,]\s*([A-Za-z]+)\s*:/g)].map((m) => m[1]!);
      for (const k of keys) {
        assert.ok(!/^(?:height|width|top|left|right|bottom|maxHeight|minHeight|gridTemplateRows|backgroundPosition|filter|margin\w*|padding\w*)$/.test(k), `${rel} animates “${k}”: ${call.slice(0, 90)}…`);
      }
      assert.doesNotMatch(call, /fill:\s*'both'/, `${rel} fills “both” — a held transform unpins every fixed child`);
      assert.doesNotMatch(call, /duration:\s*\d|cubic-bezier\(/, `${rel} writes a raw time or curve: ${call.slice(0, 90)}…`);
    }
    assert.doesNotMatch(src, /fill:\s*'both'/, `${rel} fills “both”`);
  }
  /* The frames the sheet and the grow build elsewhere are transform + opacity (+ the grow's one clip, 13 Nov). */
  const rows = read('lib/rows-move.ts');
  assert.match(rows, /transform: `translateY\(\$\{dy\}px\)`/);
  assert.match(rows, /transform: 'translateX\(-110%\)', opacity: 0/, 'a leaving row does not slide out');
});

test('5 · ONE shake — the two old ones are retired, and nothing shakes on a loop', () => {
  assert.doesNotMatch(CSS, /@keyframes sn-row-shake|@keyframes sn-slider-shake|\.sn-row-shake\b/, 'an old shake is back');
  assert.equal((CSS.match(/@keyframes sn-m-shake\b/g) ?? []).length, 1);
  assert.match(rule('.sn-m-shake'), /animation:\s*sn-m-shake var\(--sn-m-move\) var\(--sn-m-settle\) 1;/);
  for (const m of CSS.matchAll(/animation:\s*sn-m-shake[^;]*;/g)) assert.doesNotMatch(m[0], /infinite/, 'the shake loops — Sheen is the only loop');
  assert.ok([...CSS.matchAll(/animation:\s*sn-m-shake[^;]*;/g)].length >= 3, 'anti-vacuity: the slider thumbs no longer wear the one shake');
  const row = read('app/_components/form-row.tsx');
  assert.doesNotMatch(row, /sn-row-shake/);
  assert.ok((row.match(/'sn-m-shake'/g) ?? []).length >= 2, 'the form row no longer shakes a refused answer');
  /* It swings a few px by `translate` (a centred box keeps its transform) and ends where it began. */
  const body = keyframes('sn-m-shake');
  assert.match(body, /0%,\s*100%\s*\{\s*translate:\s*0;\s*\}/);
  const swings = [...body.matchAll(/translate:\s*(-?\d+)px/g)].map((m) => Math.abs(Number(m[1])));
  assert.equal(swings.length, 3, 'three short swings');
  assert.ok(Math.max(...swings) <= 7 && swings[swings.length - 1]! < swings[0]!, 'the swings do not die away');
});

test('6 · every Phase 2 motion reads the standard’s tokens — no raw time, no raw curve', () => {
  const a = CSS.indexOf('THE MOTION STANDARD · PHASE 2');
  // (comments are stripped — find the block by its first and last rules instead)
  const from = CSS.indexOf('.sn-fade.sn-popup-dark {');
  const to = CSS.indexOf('.sn-m-status { transition: none !important; }');
  assert.ok(a < 0 && from > 0 && to > from, 'anti-vacuity: the Phase 2 block was not found in globals.css');
  const block = CSS.slice(from, to);
  for (const m of block.matchAll(/(?:transition|animation)(?:-duration|-timing-function)?\s*:\s*([^;]+);/g)) {
    assert.doesNotMatch(m[1]!, /(?<![\w-])\d*\.?\d+m?s\b|cubic-bezier\(/, `a raw timing in the Phase 2 block: ${m[0]}`);
    assert.match(m[1]!, /var\(--sn-m-|^none/, `a Phase 2 motion that reads no token: ${m[0]}`);
  }
  /* The retimed parts read the tokens too. */
  for (const sel of ['.sn-row-field', '.sn-row-field[data-leaving]', '[data-form-row-back] > .sn-row-name', '[data-form-row-back] > .sn-row-pill', '.sn-explain-pop', '.sn-addman-veil']) {
    const anim = /animation:\s*([^;]+);/.exec(rule(sel));
    assert.ok(anim, `${sel} has no animation`);
    assert.match(anim[1]!, /var\(--sn-m-(?:tap|quick|move)\) var\(--sn-m-(?:settle|spring)\)/, `${sel} is not on the standard: ${anim[1]}`);
    assert.doesNotMatch(anim[1]!, /--sn-pill-dur|cubic-bezier|\d(?:ms|s)\b|\bboth\b/, `${sel}: ${anim[1]}`);
  }
  /* Row field: opens in Move on Spring, folds back in Quick on Settle (faster than it opens). */
  assert.match(rule('.sn-row-field'), /animation:\s*sn-row-field-in var\(--sn-m-move\) var\(--sn-m-spring\);/);
  assert.match(rule('.sn-row-field[data-leaving]'), /animation:\s*sn-row-field-out var\(--sn-m-quick\) var\(--sn-m-settle\);/);
  /* The scrim: Quick on Settle, in. */
  assert.match(rule('.sn-fade.sn-popup-dark'), /animation-duration:\s*var\(--sn-m-quick\);\s*animation-timing-function:\s*var\(--sn-m-settle\);/);
});

test('7 · cascade six, 60 ms apart — and a list’s first drawing never plays', () => {
  assert.equal(CASCADE_ROWS, 6);
  assert.equal(CASCADE_STEP_MS, 60);
  const rows = read('lib/rows-move.ts');
  assert.match(rows, /rows\.slice\(0, CASCADE_ROWS\)\.forEach\(\(row, i\) =>/, 'more than six rows cascade');
  assert.match(rows, /delay: i \* CASCADE_STEP_MS,\s*fill: 'backwards',/);
  assert.match(rows, /if \(!arrival\) return;/, 'a list’s first drawing plays an entrance over the server’s HTML');
  const swipe = read('app/_components/swipe-to-delete.tsx');
  assert.match(swipe, /rowArrives\(row\);\s*return \(\) => \{\s*if \(deletePressed\.current\) rowLeaves\(row\);\s*\};/, 'the one swipe row no longer arrives and leaves by transform');
  assert.match(swipe, /deletePressed\.current = true;\s*onDelete\(/);
});

test('8 · a number that changes ticks from the old value in Quick — never back through 0', () => {
  const up = read('app/_components/count-up.tsx');
  assert.doesNotMatch(up, /alwaysFromZero/, 'CountUp restarts from 0 on every change again');
  assert.match(up, /fromZeroOnLoad: true,\s*changeDurationMs: QUICK_MS,/);
  assert.equal(QUICK_MS, 200);
  const engine = read('components/count.tsx');
  assert.match(engine, /const from = alwaysFromZero \|\| \(fromZeroOnLoad && !isChange\) \? 0 : remembered;/);
  assert.match(engine, /const d = \(isChange \? changeDurationMs : undefined\) \?\? durationMs \?\? countDurationMs\(from, value\);/);
});

test('9 · Busy keeps the veil and overlay={false}; ✓ Done is said by the owner, never inferred', () => {
  const btn = read('app/_components/submit-button.tsx');
  assert.match(btn, /overlay = true,/, 'the veil is no longer the default');
  assert.match(btn, /if \(!overlay \|\| !loader\) return;/, 'overlay={false} no longer opts out of the veil');
  assert.match(btn, /loader\.show\(\{/, 'the sd-loader veil is gone from Busy');
  assert.match(btn, /<span className="sn-m-busy inline-flex items-center gap-2" data-busy="">/);
  assert.match(btn, /style=\{floor \? \{ \.\.\.style, minWidth: floor \} : style\}/, 'the button does not keep its size while busy');
  /* ✓ only when the form's owner says the save landed. */
  assert.match(btn, /const settled = showDone && !pending;/);
  assert.match(btn, /if \(!done\) \{\s*setShowDone\(false\);\s*return;\s*\}/);
  assert.doesNotMatch(btn, /setShowDone\(true\)[\s\S]{0,40}pending/, '✓ is inferred from the pending flag');
});
