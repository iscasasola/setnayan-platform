/**
 * the-motion-system-is-shared.test.ts — 🎞 THE APPROVED MOTION SYSTEM LIVES IN THE SHARED PIECES AND THE TOKENS, ONE
 * PLACE EACH (owner 2026-11-13, DECISION_LOG "Motion system approved": *"motion approved"*; prototype
 * `prototypes/approved_2026-11-13/grow-full-screen-fable.html`, artifact CnEGqnNxRH9QcTsbgrFHNC v1; plus the same
 * day's "Speed + motion target": jank, flash and jump are bugs).
 *
 * Held here:
 *   1. the timing table is ONE block of tokens in globals.css, each declared once, and `lib/grow-motion.ts` mirrors it
 *      number for number (CSS and script cannot drift apart); the 0.7 s rise and press family are gone;
 *   2. the grow's timeline: shape 360 ms, three content steps 40 ms apart, chrome last, close = the mirror at 80 %;
 *      the grow-out-of-the-pressed-thing frames start exactly on its box and end at rest;
 *   3. every shared piece reads the system — PressFeel (press in / release), RiseScreen (the grow, both ways), Sheet
 *      (grows out of the press, plays the mirrored close before it leaves), Fold (320/260 + the three steps, one open
 *      at a time), the switch, the chip, the field, the swipe — and none keeps a number of its own;
 *   4. reduced motion is honoured in each: the press is the shade alone, the grow a 120 ms cross-fade, a row opens at
 *      once with a 120 ms fade.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-14, one red test each): `--sn-dur-open: 360ms` → `400ms`;
 * `duration-sn-row-open` → `duration-sn-pill` in fold.tsx; `{ close: true, reduced }` → `{ reduced }` in sheet.tsx;
 * `const dip = still.matches ? null :` → `const dip =` in press-feel.tsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  BEHIND_SCALE,
  GROW_CLOSE_TOTAL_MS,
  GROW_TOTAL_MS,
  GROW_WINDOWS,
  TIMING,
  PRESS_SCALE,
  ROW_PRESS_SCALE,
  growFrames,
  growTiming,
  pressScale,
} from '@/lib/grow-motion';
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) => stripComments(read(p));
const CSS = stripComments(read('app/globals.css'));

const tokenMs = (name: string): number => {
  const all = [...CSS.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.equal(all.length, 1, `--${name} is declared ${all.length} times (want once)`);
  const m = /^(\d+)ms$/.exec(all[0]!);
  assert.ok(m, `--${name} is not a plain number of ms: ${all[0]}`);
  return Number(m[1]);
};

test('1 · the timing table is one block of tokens, and lib/grow-motion.ts mirrors it number for number', () => {
  const pairs: [string, number][] = [
    ['sn-dur-press', TIMING.pressMs],
    ['sn-dur-release', TIMING.releaseMs],
    ['sn-dur-grow-press', TIMING.growPressMs],
    ['sn-dur-open', TIMING.openMs],
    ['sn-dur-step', TIMING.stepMs],
    ['sn-dur-row-open', TIMING.rowOpenMs],
    ['sn-dur-row-shut', TIMING.rowShutMs],
    ['sn-dur-toggle', TIMING.toggleMs],
    ['sn-dur-chip', TIMING.chipMs],
    ['sn-dur-chip-out', TIMING.chipOutMs],
    ['sn-dur-snap', TIMING.snapMs],
    ['sn-dur-fade-reduced', TIMING.reducedMs],
  ];
  for (const [name, ms] of pairs) assert.equal(tokenMs(name), ms, `--${name} and lib/grow-motion.ts disagree`);
  // The approved numbers themselves (the prototype's § 6 table).
  assert.deepEqual(
    [TIMING.pressMs, TIMING.releaseMs, TIMING.growPressMs, TIMING.openMs, TIMING.closeRatio, TIMING.stepMs, TIMING.rowOpenMs, TIMING.rowShutMs, TIMING.reducedMs],
    [100, 280, 120, 360, 0.8, 40, 320, 260, 120],
  );
  assert.match(CSS, /--sn-dur-close:\s*calc\(var\(--sn-dur-open\) \* \.8\);/, 'the close is not the open at 80 %');
  assert.match(CSS, /--sn-ease-emph:\s*cubic-bezier\(\.2,0,0,1\);/);
  assert.match(CSS, /--sn-pill-spring:\s*cubic-bezier\(\.34,1\.56,\.64,1\);/);
  // The 0.7 s it replaced: the family reads the release, the rise reads the open — neither keeps a number.
  assert.match(CSS, /--sn-pill-dur:\s*var\(--sn-dur-release\);/);
  assert.match(CSS, /--sn-dur-rise:\s*var\(--sn-dur-open\);/);
  assert.match(CSS, /--sn-ease-rise:\s*var\(--sn-ease-emph\);/);
  assert.equal(RISE_MS, TIMING.openMs);
  assert.equal(RISE_EASE, 'cubic-bezier(.2,0,0,1)');
  assert.equal(RISE_REDUCED_MS, TIMING.reducedMs);
  // Tailwind names for the row's two times and the curve (an arbitrary `duration-[…]` emits nothing here).
  const tw = read('tailwind.config.ts');
  assert.match(tw, /'sn-row-open': 'var\(--sn-dur-row-open\)'/);
  assert.match(tw, /'sn-row-shut': 'var\(--sn-dur-row-shut\)'/);
  assert.match(tw, /'sn-emph': 'var\(--sn-ease-emph\)'/);
});

test('2 · the grow: shape 360, three steps 40 ms apart, chrome last; the close is the mirror at 80 %', () => {
  assert.deepEqual(GROW_WINDOWS.shape, { at: 0, ms: 360 });
  assert.deepEqual([GROW_WINDOWS.step1.at, GROW_WINDOWS.step2.at, GROW_WINDOWS.step3.at], [200, 240, 280], 'the steps are not 40 ms apart');
  assert.ok(GROW_WINDOWS.chrome.at >= GROW_WINDOWS.step3.at && GROW_WINDOWS.bar.at >= GROW_WINDOWS.step3.at, 'the chrome is not last');
  // The prototype counts 640 ms from touch-down; the press (120) is the finger's own, so from mount it is 520.
  assert.equal(GROW_TOTAL_MS, 640 - TIMING.growPressMs);
  assert.equal(GROW_CLOSE_TOTAL_MS, Math.round(GROW_TOTAL_MS * 0.8));
  for (const part of Object.keys(GROW_WINDOWS) as (keyof typeof GROW_WINDOWS)[]) {
    const o = growTiming(part);
    const c = growTiming(part, true);
    assert.equal(o.direction, 'normal');
    assert.equal(c.direction, 'reverse', `${part}: the close is not the same frames backwards`);
    assert.equal(c.duration, Math.round(o.duration * 0.8), `${part}: the close is not at 80 %`);
    // Mirrored: what arrived last leaves first.
    assert.equal(c.delay, Math.round((GROW_TOTAL_MS - o.delay - o.duration) * 0.8), `${part}: the close window is not the open's mirror`);
    assert.ok(c.delay + c.duration <= GROW_CLOSE_TOTAL_MS + 1);
  }
  assert.ok(growTiming('chrome', true).delay < growTiming('shape', true).delay, 'the chrome does not leave first');
  // Out of the pressed thing: at frame 0 the panel sits on its box, clipped to its size; at rest, in place, unclipped.
  const f = growFrames({ left: 16, top: 300, width: 160, height: 44 }, { left: 0, top: 400, width: 390, height: 444 });
  assert.equal(f[0]!.transform, 'translate(16px, -100px)');
  assert.equal(f[0]!.clipPath, 'inset(0px 230px 400px 0px round 14px)');
  assert.equal(f[1]!.transform, 'none');
  assert.match(String(f[1]!.clipPath), /^inset\(-\d+px -\d+px -\d+px -\d+px round 0px\)$/, 'the end clip cuts the panel (its shadow would pop in)');
  // The touch feel's sizes.
  assert.deepEqual([PRESS_SCALE, ROW_PRESS_SCALE, BEHIND_SCALE], [0.97, 0.985, 0.96]);
  assert.equal(pressScale(120), 0.97);
  assert.equal(pressScale(358), 0.985);
  assert.equal(pressScale(44, true), 0.985);
});

test('3 · every shared piece reads the system — and none keeps a number of its own', () => {
  // PressFeel — in on touch-down, out on lift, from the tokens.
  const press = code('app/_components/press-feel.tsx');
  assert.match(press, /from '@\/lib\/grow-motion'/);
  assert.match(press, /token\('--sn-dur-press', TIMING\.pressMs\)/);
  assert.match(press, /token\('--sn-dur-release', TIMING\.releaseMs\)/);
  // RiseScreen — the grow both ways, through the one player.
  const screen = code('app/_components/rise/rise-screen.tsx');
  assert.equal((screen.match(/playRiseScreen\(el, m, originRef\.current, \{/g) ?? []).length, 2, 'the open and the close are not the same grow');
  assert.match(screen, /\{ close: true, reduced: prefersReducedMotion\(\) \}/);
  const riseLib = code('lib/rise-screen.ts');
  assert.match(riseLib, /return playGrow\(/);
  assert.match(riseLib, /behind: true/, 'the page behind does not step back');
  assert.match(riseLib, /bodySteps\(/, 'the content does not arrive in steps');
  assert.match(riseLib, /chrome: Array\.from\(el\.querySelectorAll\('\[data-rise-close\], \[data-rise-info-button\]'\)\)/);
  assert.match(riseLib, /bar: Array\.from\(el\.querySelectorAll\('\[data-rise-thumb\]'\)\)/);
  assert.match(riseLib, /label: title && words && lands/, 'the pressed thing’s words do not travel to the title');
  // Sheet — grows out of the press, and plays the mirror before it leaves the page.
  const sheet = code('app/_components/sheet.tsx');
  assert.match(sheet, /const origin = riseOriginNow\(\);/);
  assert.equal((sheet.match(/growFrames\(boxOf\((?:originRef\.current|origin)\), boxOf\(parts\.panel\)\)/g) ?? []).length, 2);
  assert.match(sheet, /\{ close: true, reduced \}/, 'the sheet closes without the mirror');
  assert.match(sheet, /if \(!open && !present\) return null;/, 'the sheet leaves the page before its close has played');
  assert.match(sheet, /style=\{closing \? \{ pointerEvents: 'none' \} : undefined\}/, 'a closing sheet still takes taps');
  // Fold — the row's own times on grid rows, the arrow with it; content in three steps; one open at a time.
  const fold = code('app/_components/fold.tsx');
  assert.equal((fold.match(/duration-sn-row-open/g) ?? []).length, 2, 'the height and the arrow do not open together');
  assert.equal((fold.match(/duration-sn-row-shut/g) ?? []).length, 3);
  assert.match(fold, /transition-\[grid-template-rows\] ease-sn-emph/);
  assert.match(fold, /const scope = useOneOpen\(open, setOpen\);/, 'rows no longer open one at a time');
  assert.doesNotMatch(fold, /duration-sn-pill/, 'a row still opens at the old 0.7 s');
  const foldCss = stripComments(read('app/_components/fold.css'));
  assert.match(foldCss, /--sn-fold-step: calc\(var\(--sn-dur-step-first\) \+ var\(--sn-dur-step\)\);/);
  assert.match(foldCss, /--sn-fold-step: calc\(var\(--sn-dur-step-first\) \+ 2 \* var\(--sn-dur-step\)\);/);
  // Toggle · chip · field · swipe.
  assert.match(CSS, /\.sn-switch \{[^}]*transition: background-color var\(--sn-dur-toggle\) var\(--sn-ease-emph\);/);
  assert.match(CSS, /\.sn-chip \{[^}]*var\(--sn-dur-chip-out\) var\(--sn-ease-emph\)/);
  assert.match(CSS, /\.sn-chip\.selected \{ transition-duration: var\(--sn-dur-chip\); \}/);
  assert.match(CSS, /\.input-field \{\s*transition-duration: var\(--sn-dur-field\);\s*transition-timing-function: var\(--sn-ease-emph\);/);
  const swipe = code('app/_components/swipe-to-delete.tsx');
  assert.equal((swipe.match(/'transform var\(--sn-dur-snap\) var\(--sn-ease-emph\)'/g) ?? []).length, 2);
  assert.doesNotMatch(swipe, /transform 0\.2s ease/);
  // No shared piece keeps a duration of its own: the numbers are the table's.
  for (const [rel, src] of [
    ['app/_components/press-feel.tsx', press],
    ['app/_components/sheet.tsx', sheet],
    ['lib/rise-screen.ts', riseLib],
    ['app/_components/fold.tsx', fold],
  ] as const) {
    assert.doesNotMatch(src, /\bduration:\s*\d|\b\d{2,4}ms\b/, `${rel}: a duration of its own`);
  }
  assert.doesNotMatch(foldCss.slice(foldCss.indexOf('[data-fold-inner]')), /\b\d+ms\b/, 'fold.css: a duration of its own');
});

test('4 · nobody keeps their own copy of the grow / the rise, and the 0.7 s numbers are gone', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const files = ['app', 'lib', 'components'].flatMap((d) => walk(join(WEB, d))).map((abs) => ({ rel: relative(WEB, abs), src: stripComments(readFileSync(abs, 'utf8')) }));
  assert.ok(files.length > 1000, `the walk found only ${files.length} files — the scan is not looking`);
  const offenders: string[] = [];
  for (const { rel, src } of files) {
    // (`lib/motion.ts` is the guest Event Hub's own three tokens — that page keeps its own motion — not this table.)
    if (rel !== 'lib/grow-motion.ts' && /\b(?:openMs|releaseMs|rowOpenMs)\s*:\s*\d/.test(src)) offenders.push(`${rel}: a second timing table`);
    if (rel !== 'lib/rise-motion.ts' && /\b(?:RISE_MS|PICKED_OPEN_MS)\s*=\s*\d/.test(src)) offenders.push(`${rel}: a numeric RISE_MS / PICKED_OPEN_MS`);
    if (rel !== 'app/globals.css' && /--sn-(?:dur-[a-z-]+|ease-emph)\s*:/.test(src)) offenders.push(`${rel}: redefines a motion token`);
    if (/\b520ms\b|\bduration:\s*520\b/.test(src)) offenders.push(`${rel}: the old 520-ms rise hard-coded`);
    if (rel !== 'lib/rise-motion.ts' && /from '@\/lib\/rise-motion'/.test(src) && /\bduration:\s*\d/.test(src)) offenders.push(`${rel}: imports the rise but passes a literal duration`);
  }
  assert.deepEqual(offenders, []);
  assert.doesNotMatch(CSS, /--sn-pill-dur:\s*700ms/, 'the 0.7 s press family is back');
});

test('5 · reduced motion is honoured in every shared piece', () => {
  const grow = code('lib/grow-motion.ts');
  assert.match(grow, /if \(reduced\) \{\s*if \(can\(parts\.shape\?\.el\)\) runs\.push\(parts\.shape!\.el\.animate\(FADE_FRAMES, \{ \.\.\.REDUCED_TIMING/, 'the grow is not a cross-fade under reduced motion');
  assert.match(grow, /export const REDUCED_TIMING: KeyframeAnimationOptions = \{ duration: TIMING\.reducedMs, easing: 'linear' \};/);
  const press = code('app/_components/press-feel.tsx');
  assert.match(press, /const dip = still\.matches \? null : el\.animate\(/, 'the press scales under reduced motion (the table: shade only)');
  const foldCss = stripComments(read('app/_components/fold.css'));
  const reduced = foldCss.slice(foldCss.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\[data-fold-inner\] > \*[^{]*\{\s*transform: none;\s*transition: opacity var\(--sn-dur-fade-reduced\) linear;/);
  assert.match(code('app/_components/fold.tsx'), /motion-reduce:transition-none \$\{open \? 'grid-rows-\[1fr\]/, 'a row does not open at once under reduced motion');
});
