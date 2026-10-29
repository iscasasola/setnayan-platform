/**
 * a-top-row-folds-on-scroll.test.ts — a page's top count row compresses into ONE slim pinned line once the page runs
 * under it, and GLIDES doing it (owner 2026-10-29: DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS
 * INTO ONE PINNED ROW ON SCROLL"; "remember to animate them properly").
 *
 *   1. The fold decision has the prototype's hysteresis: never while not stuck, on past 44 px under, off within 6 px.
 *   2. The hook writes ATTRIBUTES (never state) and the rows that use it carry every hook the stylesheet draws by —
 *      checked PER ROW, so one row losing its fold cannot hide behind another keeping it.
 *   3. The folded look and the glide live in the ONE shared stylesheet pair, loaded once, honouring reduced motion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinFoldNext, PIN_FOLD_AFTER_PX, PIN_UNFOLD_WITHIN_PX } from './use-pin-fold';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · folds once stuck and 44 px under; unfolds within 6 px — never flickers at the edge', () => {
  assert.equal(pinFoldNext(false, null, 500), false, 'a row that is not stuck must never fold');
  assert.equal(pinFoldNext(true, null, 500), false, 'a row that came unstuck must unfold');
  assert.equal(pinFoldNext(false, 100, 100 + PIN_FOLD_AFTER_PX), false, 'folded at the threshold itself, not past it');
  assert.equal(pinFoldNext(false, 100, 100 + PIN_FOLD_AFTER_PX + 1), true, 'did not fold past the threshold');
  assert.equal(pinFoldNext(true, 100, 100 + 20), true, 'unfolded inside the hysteresis band — it would flicker');
  assert.equal(pinFoldNext(true, 100, 100 + PIN_UNFOLD_WITHIN_PX - 1), false, 'did not unfold back near the top');
});

test('2 · the hook writes attributes; Today and Customers each carry every hook', () => {
  const hook = read('app/_components/pinned-row/use-pin-fold.ts');
  assert.match(hook, /el\.toggleAttribute\('data-folded', next\)/);
  assert.doesNotMatch(hook, /useState/, 'the fold must be an attribute, never state — the list would re-render per scroll');
  for (const rel of ['app/vendor-dashboard/_components/today-counts.tsx', 'app/vendor-dashboard/customers/_components/customers-pin.tsx']) {
    const src = read(rel);
    const n = (re: RegExp) => (src.match(re) ?? []).length;
    assert.equal(n(/usePinFold\(pinRef\)/g), 1, `${rel}: does not fold its row`);
    assert.match(src, /ref=\{pinRef\}[\s\S]{0,400}data-pin-fold=""/, `${rel}: the folding row is not the sticky row`);
    assert.equal(n(/data-pin-door=""/g), 1, `${rel}: each count must carry data-pin-door`);
    assert.equal(n(/data-pin-n=""/g), 2, `${rel}: the number (read and "couldn't load") must both carry data-pin-n`);
    assert.equal(n(/data-pin-w=""/g), 2, `${rel}: the word (read and "couldn't load") must both carry data-pin-w`);
  }
});

test('3 · one stylesheet draws the fold, one the glide; both loaded once; reduced motion stills them', () => {
  const root = read('app/layout.tsx');
  assert.match(root, /import '\.\/_components\/pinned-row\/pin-glide\.css';/);
  assert.match(root, /import '\.\/_components\/pinned-row\/pin-fold\.css';/);
  const glide = read('app/_components/pinned-row/pin-glide.css');
  assert.match(glide, /@keyframes sn-pin-rise \{\s*from \{\s*opacity: 0;\s*transform: translateY\(6px\);/);
  assert.match(glide, /@keyframes sn-pin-drop \{\s*from \{\s*opacity: 0;\s*transform: translateY\(-6px\);/);
  const fold = read('app/_components/pinned-row/pin-fold.css');
  assert.match(fold, /\[data-pin-fold\]\[data-folded\] > \* \{\s*animation: sn-pin-rise/, 'folding no longer glides in');
  assert.match(fold, /\[data-pin-fold\]\[data-pin-was\]:not\(\[data-folded\]\) > \* \{\s*animation: sn-pin-drop/, 'unfolding no longer glides back');
  assert.match(fold, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none;/, 'reduced motion must still the glide');
});
