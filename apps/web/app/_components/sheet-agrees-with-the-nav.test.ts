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
  assert.ok(
    m,
    'the bottom nav no longer hides at a breakpoint — this guard has lost the side it measures against',
  );
  return m![1];
}

/** The breakpoint at which the sheet stops being a bottom sheet. */
function sheetDockPoint(): string {
  // The dock is expressed as `<bp>:justify-end` on the positioning wrapper —
  // that is the single line that turns a bottom sheet into a side drawer.
  const m = /\b(sm|md|lg|xl|2xl):justify-end\b/.exec(SHEET_CODE);
  assert.ok(
    m,
    'the sheet no longer docks with a `:justify-end` — if the layout was rewritten, re-point this guard rather than deleting it',
  );
  return m![1];
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
  assert.ok(wide && narrow, 'the two drawer widths are no longer both expressed in rem');
  assert.ok(
    Number(wide![1]) > Number(narrow![1]),
    `the "wide" drawer (${wide![1]}rem) is not wider than the default (${narrow![1]}rem)`,
  );
});
