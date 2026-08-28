/**
 * laptop-gets-two-columns.test.ts — S4: the card pinned left at full size,
 * the question beside it, during the guided pass, at lg+ only.
 *
 * 🔴 THE COMPLAINT. `cad86bc02`'s own commit message named the gap outright:
 * "the desktop card is not pinned left at full size" — the guided question
 * had already become a column beside the card (`9bb335319`), but the card
 * itself still shrank inside the page's `mx-auto max-w-2xl` wrapper, so a
 * 1400px window still drew one small centred card with the question floating
 * over it, not beside it at full size.
 *
 * ⚖ WHAT IS PINNED HERE, AND WHY EACH ONE IS SEPARATE:
 *   1. the two rules exist ONLY inside `@media (min-width: 1024px)` — a
 *      phone must render byte-identically to before this change, and the
 *      only honest way to prove that from source is that the rules cannot
 *      even be reached below that width;
 *   2. the card only pins DURING the pass — an ordinary edit stays a bottom
 *      sheet at every width, because nothing is being built behind those;
 *   3. the trailing content (recap, publish, "make it richer") is hidden,
 *      not removed, at lg+ during the pass — it still posts;
 *   4. the pin reads the shared shell's own rail/bar tokens, never a
 *      hand-typed offset that can drift from the real chrome.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const readRaw = (p: string) => readFileSync(join(WEB, p), 'utf8');

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const CSS = 'app/globals.css';

test('the files under test actually read back', () => {
  assert.ok(read(MAKER).length > 5000, 'the maker read back empty');
  assert.ok(readRaw(CSS).length > 5000, 'globals.css read back empty');
});

// ---------------------------------------------------------------------------
// 1 · THE PHONE IS UNTOUCHED — both rules live ONLY inside the 1024px query
// ---------------------------------------------------------------------------

test('the pin and the hide rule exist only inside @media (min-width: 1024px)', () => {
  // CSS comments are real /* */ blocks and stripComments() only strips JS/TS
  // comment syntax — read the file raw here rather than mis-stripping CSS.
  const css = readRaw(CSS);

  // This file already carries other `@media (min-width: 1024px)` blocks
  // elsewhere (the shared rail, unrelated to this pin) — anchor on the pin
  // class itself and walk BACKWARD to the nearest enclosing media query,
  // never the first one in the file.
  const pinRule = css.indexOf('.sn-canvas-pass-pin {');
  assert.notEqual(pinRule, -1, 'the pin rule is gone');
  const mediaOpen = css.lastIndexOf('@media (min-width: 1024px)', pinRule);
  assert.notEqual(mediaOpen, -1, 'the 1024px guard for the guided pass pin is gone');

  // Walk brace depth from the media query's own `{` to find where IT closes,
  // not the first `}` inside it (both rule bodies nest their own braces).
  const braceStart = css.indexOf('{', mediaOpen);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.ok(i < css.length, 'the 1024px media query never closes — brace-matching ran off the file');
  const mediaBody = css.slice(braceStart, i);

  assert.match(mediaBody, /\.sn-canvas-pass-pin\s*\{/, 'the pin rule is missing from inside the 1024px query');
  assert.match(mediaBody, /\.sn-canvas-pass-hide\s*\{\s*display:\s*none;?\s*\}/, 'the hide rule is missing from inside the 1024px query');

  // Neither class may be DECLARED anywhere outside that one media block —
  // that is the whole guarantee that a phone (< 1024px) sees no new rule.
  // (The doc comment ABOVE the media query names both classes in prose,
  // which is fine — only an actual rule opener, `.name {`, would matter.)
  const outside = css.slice(0, mediaOpen) + css.slice(i + 1);
  assert.ok(!/\.sn-canvas-pass-pin\s*\{/.test(outside), 'the pin class leaked a definition outside the 1024px query');
  assert.ok(!/\.sn-canvas-pass-hide\s*\{/.test(outside), 'the hide class leaked a definition outside the 1024px query');
});

test('the pin reads the shared rail and bar tokens, not a hand-typed offset', () => {
  const css = readRaw(CSS);
  const rule = css.slice(css.indexOf('.sn-canvas-pass-pin {'), css.indexOf('.sn-canvas-pass-hide {'));
  assert.match(rule, /position:\s*fixed;/, 'the pin stopped escaping the page flow');
  assert.match(rule, /left:\s*var\(--fd-rail,\s*240px\);/, 'left stopped reading the shared rail width');
  assert.match(rule, /top:\s*calc\(var\(--fd-bar,\s*61px\)\s*\+\s*24px\);/, 'top stopped clearing the shared app bar');
});

// ---------------------------------------------------------------------------
// 2 · ONLY DURING THE PASS — an ordinary edit stays exactly as it was
// ---------------------------------------------------------------------------

test('the card only pins when inPass is true, and only once — via its OWN wrapper', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /inPass \? 'sn-canvas-pass-pin' : undefined/,
    'the pin wrapper stopped conditioning the pin class on inPass',
  );
  const count = (src.match(/sn-canvas-pass-pin/g) ?? []).length;
  assert.equal(count, 1, `sn-canvas-pass-pin is referenced ${count} times in the maker, expected exactly 1`);
  // The pulse wrapper's own key+className guard (a separate, older test) must
  // still hold byte-for-byte — the pin lives on a SEPARATE outer wrapper so
  // that keying the pulse div is never disturbed by this change.
  assert.match(
    src,
    /key=\{blocked \? 'card-blocked' : 'card-ready'\} className=\{blocked \? undefined : 'sn-paint-live/,
    'the pin wrapper merged into the pulse div instead of staying separate',
  );
});

test('the trailing content only hides when inPass is true, and only once', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /inPass \? 'sn-canvas-pass-hide space-y-4' : 'space-y-4'/,
    'the trailing-content wrapper stopped conditioning the hide class on inPass',
  );
  const count = (src.match(/sn-canvas-pass-hide/g) ?? []).length;
  assert.equal(count, 1, `sn-canvas-pass-hide is referenced ${count} times in the maker, expected exactly 1`);
});

// ---------------------------------------------------------------------------
// 3 · STILL MOUNTED, NOT REMOVED — the hidden content still posts
// ---------------------------------------------------------------------------

test('the trailing wrapper hides with CSS, never with a conditional unmount', () => {
  const src = read(MAKER);
  const wrapOpen = src.indexOf("inPass ? 'sn-canvas-pass-hide space-y-4' : 'space-y-4'");
  assert.notEqual(wrapOpen, -1, 'the trailing wrapper is gone');
  // The publish buttons and the recap dl must still be inside that wrapper —
  // an unmount would silently stop them posting during the pass on a laptop.
  const afterWrap = src.slice(wrapOpen, wrapOpen + 6000);
  assert.match(afterWrap, /name="publish"/, 'Publish stopped being reachable from inside the hidden wrapper');
  assert.match(afterWrap, /Make it richer/, '"Make it richer" stopped being reachable from inside the hidden wrapper');
});

// ---------------------------------------------------------------------------
// 4 · NO SECOND LAYOUT — this is CSS and one wrapper, not a desktop maker
// ---------------------------------------------------------------------------

test('no second CanvasMaker-shaped component was introduced for desktop', () => {
  const src = read(MAKER);
  assert.equal(
    (src.match(/export function CanvasMaker/g) ?? []).length,
    1,
    'a second maker component appeared — the task asked for one wrapper, not a desktop version',
  );
});
