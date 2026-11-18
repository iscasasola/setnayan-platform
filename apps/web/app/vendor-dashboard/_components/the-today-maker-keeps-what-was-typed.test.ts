/**
 * the-today-maker-keeps-what-was-typed.test.ts — 🧰 WALK STEP 3, FAULT 1 (2026-11-16): the price typed on the card was
 * lost when the New service sheet opened again.
 *
 * Today's "What you offer" step draws the maker in a `Sheet` (`setup-offer-fold.tsx`). The `Sheet` draws nothing while
 * it is shut, so the maker used to be UNMOUNTED by every way a sheet shuts — ✕, the backdrop, the phone's Back, a tap
 * that missed a field under the Cancel · Create row — and the next open started from a blank card: the price, the name,
 * what's included, all gone. Measured in `/dev/card-maker-lab?host=today` at 390 (build-sessions/shots-service-card-fixes).
 *
 * The claim: the maker lives for as long as the step does, and only a MADE card starts the next one fresh. So:
 *   1 · the maker is portalled into a holder OUTSIDE the `{open ? <Sheet> …}` branch (shutting cannot unmount it);
 *   2 · the open sheet shows that same holder (moved in, moved back out alive);
 *   3 · the holder is a sheet's body to the maker (`InSheet`), so its Create row stays in the sheet's layer;
 *   4 · only a change in the card count (a card was made) resets it.
 *
 * Sabotage: draw `{maker}` inside the `<Sheet>` again → test 1 red; reset `started` in the Sheet's onClose → test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const HOST = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/setup-offer-fold.tsx'), 'utf8'));
const SHEET = stripComments(readFileSync(join(WEB, 'app/_components/sheet.tsx'), 'utf8'));

const fold = HOST.slice(HOST.indexOf('export function SetupOfferFold('), HOST.indexOf('function useMakerHolder('));
const sheetBranch = fold.slice(fold.indexOf('{open ? ('));

test('0 · anti-vacuity: the Sheet really draws nothing while shut (so a maker inside it WOULD be unmounted)', () => {
  /* The Sheet may stay drawn only while its mirrored close plays (`present`, ported from #7686); once shut it still returns null. */
  assert.match(SHEET, /if \(!open(?: && !present)?\) return null;/, 'the Sheet keeps its body while shut — re-measure what this guard protects');
  assert.ok(fold.length > 500 && sheetBranch.length > 100, 'SetupOfferFold or its sheet branch was not found');
});

test('1 · the maker is drawn into the holder, outside the open-only sheet branch', () => {
  assert.doesNotMatch(sheetBranch, /\{maker\}/, 'the maker is drawn inside the open-only Sheet again — shutting it loses what was typed');
  const portal = fold.slice(0, fold.indexOf('{open ? ('));
  assert.match(portal, /\{started && holder\s*\?\s*createPortal\(\s*<InSheet\.Provider value>[\s\S]*?\{maker\}[\s\S]*?<\/InSheet\.Provider>,\s*holder,?\s*\)/, 'the maker is not portalled into the holder');
  assert.match(HOST, /useEffect\(\(\) => setHolder\(document\.createElement\('div'\)\), \[\]\);/, 'the holder is not one element for the life of the step');
});

test('2 · the open sheet shows that same holder, and gives it back alive on close', () => {
  assert.match(sheetBranch, /<Sheet\b[^>]*>[\s\S]*?<HolderSlot holder=\{holder\} \/>[\s\S]*?<\/Sheet>/, 'the open sheet does not show the holder');
  const slot = HOST.slice(HOST.indexOf('function HolderSlot('));
  assert.match(slot, /at\.appendChild\(holder\);/);
  assert.match(slot, /if \(holder\.parentNode === at\) at\.removeChild\(holder\);/, 'closing would not hand the holder back');
  assert.doesNotMatch(slot, /holder\.(?:remove|replaceChildren|innerHTML)/, 'closing empties the holder — what was typed is lost');
});

test('3 · inside the holder the maker is still in a sheet’s body (its Create row stays in the sheet’s layer)', () => {
  assert.match(HOST, /import \{ InSheet, Sheet \} from '@\/app\/_components\/sheet';/);
});

test('4 · only a made card starts the next one fresh — shutting the sheet does not', () => {
  const reset = /useEffect\(\(\) => \{\s*if \(cards !== was\.current\) \{\s*setOpen\(false\);\s*setStarted\(false\);\s*\}/.exec(fold);
  assert.ok(reset, 'a made card no longer starts the next card fresh');
  assert.equal((fold.match(/setStarted\(false\)/g) ?? []).length, 1, 'the maker is reset somewhere besides a made card');
  assert.match(sheetBranch, /onClose=\{\(\) => setOpen\(false\)\}/, 'shutting the sheet does more than shut it');
});
