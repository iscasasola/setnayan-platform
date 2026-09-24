/**
 * GUARD — the sheet and the navigation must answer "is this a phone?" the same way.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 * `sheet.tsx` docked as a right-side desktop drawer from `sm:` (640px).
 * `nav/bottom-nav.tsx` is `lg:hidden`, so the floating phone bar is on screen
 * right up to 1023px.
 *
 * **Between 640 and 1023 the app therefore rendered its PHONE chrome and its
 * DESKTOP drawer at the same time** — a floating bottom pill underneath a half-
 * width panel pinned to the right edge, with the page blurred behind it. That
 * band is every tablet, a large phone in landscape, a foldable, and any browser
 * window that is not maximised.
 *
 * The owner hit it opening the Papic uploader on 2026-08-28 and said the screen
 * looked unfinished. He was right, and it was not a styling slip: it was two
 * components answering one question with two different numbers.
 *
 * 🔑 SO THE RULE IS AGREEMENT, NOT A VALUE. This file does not assert "the sheet
 * uses lg". It reads the breakpoint out of BOTH files and fails when they differ
 * — so moving the app's phone/desktop line moves this guard with it, and moving
 * only one of the two is what goes red. A guard that pinned the literal `lg`
 * would have to be edited by the person doing the very thing it exists to catch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET = readFileSync(join(HERE, 'sheet.tsx'), 'utf8');
const NAV = readFileSync(join(HERE, 'nav', 'bottom-nav.tsx'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const SHEET_CODE = strip(SHEET);
const NAV_CODE = strip(NAV);

/** The breakpoint at which the phone bottom bar stops being drawn. */
function navPhoneCeiling(): string {
  const m = /\b(sm|md|lg|xl|2xl):hidden\b/.exec(NAV_CODE);
  const bp = m?.[1];
  assert.ok(
    bp,
    'the bottom nav no longer hides at a breakpoint — this guard has lost the side it measures against',
  );
  return bp;
}

/** The breakpoint at which the sheet stops being a bottom sheet. */
function sheetDockPoint(): string {
  // The dock is expressed as `<bp>:justify-end` on the positioning wrapper —
  // that is the single line that turns a bottom sheet into a side drawer.
  const m = /\b(sm|md|lg|xl|2xl):justify-end\b/.exec(SHEET_CODE);
  const bp = m?.[1];
  assert.ok(
    bp,
    'the sheet no longer docks with a `:justify-end` — if the layout was rewritten, re-point this guard rather than deleting it',
  );
  return bp;
}

test('🚨 the sheet docks exactly where the phone navigation gives up', () => {
  const nav = navPhoneCeiling();
  const sheet = sheetDockPoint();
  assert.equal(
    sheet,
    nav,
    `the sheet becomes a desktop drawer at "${sheet}:" while the phone bottom bar is still drawn until "${nav}:". ` +
      'Between those two widths a person sees phone chrome and a desktop side drawer at once — ' +
      'which is exactly what the owner was shown on 2026-08-28.',
  );
});

test('🚨 every desktop-only rule in the sheet uses that same breakpoint', () => {
  // The height, the corners, the shadow and BOTH widths must flip together with
  // the dock. One left behind at `sm:` gives a bottom sheet with a drawer's
  // rounded left corners, or a drawer 22rem wide that never stopped being full
  // width — half-transformed, which reads as broken rather than as a choice.
  const dock = sheetDockPoint();
  const others = [...SHEET_CODE.matchAll(/\b(sm|md|lg|xl|2xl):[a-z[]/g)].map((m) => m[1]);
  const strays = [...new Set(others)].filter((bp) => bp !== dock);
  assert.deepEqual(
    strays,
    [],
    `the sheet mixes breakpoints — ${strays.join(', ')} alongside ${dock}. Every desktop rule must flip together.`,
  );
});

test('the wide drawer is still wider than the narrow one', () => {
  // Cheap, but it is the one thing a careless edit to the template literal can
  // invert without any test noticing.
  const wide = /:w-\[min\((\d+(?:\.\d+)?)rem/.exec(SHEET_CODE);
  const narrow = /:w-\[(\d+(?:\.\d+)?)rem\]/.exec(SHEET_CODE);
  const w = wide?.[1];
  const n = narrow?.[1];
  assert.ok(w && n, 'the two drawer widths are no longer both expressed in rem');
  assert.ok(
    Number(w) > Number(n),
    `the "wide" drawer (${w}rem) is not wider than the default (${n}rem)`,
  );
});

// ── FOLDABLES (2026-09-25) ─────────────────────────────────────────────────
// `sheet-fold.css` caps the bottom sheet on tablets and unfolded phones and
// keeps it off a hinge. It lives in CSS precisely so the class-level rule above
// stays true — which means this file must hold the CSS to the same line, or the
// cap could drift into the drawer band and be the half-transformed sheet the
// first test exists to prevent.

const FOLD_CSS = stripComments(readFileSync(join(HERE, 'sheet-fold.css'), 'utf8'));
const RESPONSIVE = readFileSync(join(HERE, '..', '..', 'lib', 'use-responsive.ts'), 'utf8');

/** The px value `lib/use-responsive.ts` gives a Tailwind breakpoint name. */
function breakpointPx(name: string): number {
  const m = new RegExp(`\\b${name}\\s*:\\s*(\\d+)`).exec(strip(RESPONSIVE));
  assert.ok(m, `lib/use-responsive.ts no longer declares "${name}"`);
  return Number(m[1]);
}

test('🚨 the tablet cap on the bottom sheet ends exactly where the sheet docks', () => {
  const m =
    /@media\s*\(min-width:\s*(\d+)px\)\s*and\s*\(max-width:\s*([\d.]+)px\)\s*{\s*\[data-sheet\]\s*>\s*\[data-sheet-panel\]\s*{[^}]*max-width:/.exec(
      FOLD_CSS,
    );
  assert.ok(m, 'sheet-fold.css no longer caps the bottom sheet inside a min/max-width band');
  const ceiling = Number(m[2]);
  const dock = breakpointPx(sheetDockPoint());
  assert.ok(
    dock > ceiling && dock - ceiling < 1,
    `the bottom-sheet cap runs to ${ceiling}px but the sheet docks at ${dock}px — ` +
      'the cap would either leak onto the desktop drawer or leave a band where a tablet sheet is stretched again',
  );
});

test('the fold rules reach the sheet — the hooks they select are on the component and the file is loaded', () => {
  assert.match(SHEET_CODE, /import\s+'\.\/sheet-fold\.css'/, 'sheet.tsx no longer imports sheet-fold.css');
  assert.match(SHEET_CODE, /\bdata-sheet=/, 'the dialog wrapper lost its data-sheet hook');
  assert.match(SHEET_CODE, /\bdata-sheet-panel=/, 'the sheet body lost its data-sheet-panel hook');
  assert.match(
    FOLD_CSS,
    /@media\s*\(horizontal-viewport-segments:\s*2\)/,
    'the book-posture (side-by-side segments) rule is gone',
  );
  assert.match(
    FOLD_CSS,
    /@media\s*\(vertical-viewport-segments:\s*2\)/,
    'the tabletop-posture (stacked segments) rule is gone',
  );
});
