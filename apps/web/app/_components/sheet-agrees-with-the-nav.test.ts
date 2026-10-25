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

/**
 * 📱→🖥 SINCE 2026-10-19 THE ANSWER IS PER SURFACE (owner, DECISION_LOG
 * "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)"): the dock and the
 * sheet each carry ONE complete geometry per shell boundary — `lg` (every tree)
 * and `tab` (the couple's event tree, 701) — chosen by the SAME prop
 * (`BottomDock boundary` / `useShellBoundary()`). So agreement is now: the set
 * of lines the dock hides at equals the set of lines the sheet docks at, and
 * each of the sheet's sets flips at exactly one of them.
 */
const BP = '(sm|tab|md|lg|xl|2xl)';

/** The breakpoints at which the phone bottom bar stops being drawn. */
function navPhoneCeilings(): string[] {
  const found = [...new Set([...NAV_CODE.matchAll(new RegExp(`\\b${BP}:hidden\\b`, 'g'))].map((m) => m[1]!))].sort();
  assert.ok(
    found.length > 0,
    'the bottom nav no longer hides at a breakpoint — this guard has lost the side it measures against',
  );
  return found;
}

/** The sheet's geometry sets — one per boundary, as `SHEET_AT` declares them. */
function sheetSets(): { name: string; body: string }[] {
  const at = /const SHEET_AT[^=]*=\s*{([\s\S]*?)\n};/.exec(SHEET_CODE)?.[1];
  assert.ok(at, 'sheet.tsx no longer declares its geometries in one `SHEET_AT` table — re-point this guard rather than deleting it');
  const sets = [...at.matchAll(/\n {2}(\w+): {([\s\S]*?)\n {2}},/g)].map((m) => ({ name: m[1]!, body: m[2]! }));
  assert.ok(sets.length >= 1, 'SHEET_AT holds no geometry');
  return sets;
}

/** The breakpoint at which ONE geometry stops being a bottom sheet. */
function dockPointOf(body: string): string {
  const m = new RegExp(`\\b${BP}:justify-end\\b`).exec(body);
  assert.ok(m?.[1], 'a sheet geometry no longer docks with a `:justify-end`');
  return m[1];
}

/** The default geometry's dock point (the shipped `lg`) — what the fold rules below agree with. */
function sheetDockPoint(): string {
  const lg = sheetSets().find((s) => s.name === 'lg');
  assert.ok(lg, 'SHEET_AT lost its default `lg` geometry');
  return dockPointOf(lg.body);
}

test('🚨 the sheet docks exactly where the phone navigation gives up — on every surface', () => {
  const nav = navPhoneCeilings();
  const sets = sheetSets();
  for (const { name, body } of sets) {
    assert.equal(dockPointOf(body), name, `the "${name}" sheet docks at another surface's line`);
  }
  const sheet = sets.map((s) => s.name).sort();
  assert.deepEqual(
    sheet,
    nav,
    `the sheet docks at [${sheet.join(', ')}] while the phone bottom bar is hidden at [${nav.join(', ')}]. ` +
      'On a surface where those differ a person sees phone chrome and a desktop side drawer at once — ' +
      'which is exactly what the owner was shown on 2026-08-28.',
  );
  /* Both are chosen by the surface's boundary, never by something else. */
  assert.match(SHEET_CODE, /SHEET_AT\[useShellBoundary\(\)\]/, 'the sheet no longer reads the surface boundary');
  assert.match(NAV_CODE, /boundary === 'tab'\s*\?\s*'[^']*tab:hidden'\s*:\s*'[^']*lg:hidden'/, 'the dock no longer reads the surface boundary');
});

test('🚨 every desktop-only rule in a sheet geometry uses that geometry\'s one breakpoint', () => {
  // The height, the corners, the shadow and BOTH widths must flip together with
  // the dock. One left behind gives a bottom sheet with a drawer's rounded left
  // corners, or a drawer that never stopped being full width — half-transformed,
  // which reads as broken rather than as a choice.
  for (const { name, body } of sheetSets()) {
    const others = [...body.matchAll(new RegExp(`\\b${BP}:[a-z[]`, 'g'))].map((m) => m[1]);
    const strays = [...new Set(others)].filter((bp) => bp !== name);
    assert.deepEqual(strays, [], `the "${name}" sheet mixes breakpoints — ${strays.join(', ')}. Every desktop rule must flip together.`);
  }
  /* …and nothing outside the table sneaks a breakpoint class in. */
  const outside = SHEET_CODE.replace(/const SHEET_AT[^=]*=\s*{[\s\S]*?\n};/, '');
  assert.doesNotMatch(outside, new RegExp(`\\b${BP}:[a-z[]`), 'sheet.tsx carries a breakpoint class outside SHEET_AT');
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
// The FOLDABLES block at the end of `app/globals.css` caps the bottom sheet on
// tablets and unfolded phones and keeps it off a hinge. It lives in CSS
// precisely so the class-level rule above stays true — which means this file
// must hold the CSS to the same line, or the cap could drift into the drawer
// band and be the half-transformed sheet the first test exists to prevent.
//
// 🪤 It is in globals.css, not a `sheet-fold.css` beside the component: this
// module is loaded by the unit runner (node + tsx) through other tests, and a
// `.css` import there was a SyntaxError that killed them (#5961, first push).

const GLOBALS = readFileSync(join(HERE, '..', 'globals.css'), 'utf8');
const FOLD_CSS = stripComments(GLOBALS);
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
  assert.ok(m, 'globals.css no longer caps the bottom sheet inside a min/max-width band');
  const ceiling = Number(m[2]);
  const dock = breakpointPx(sheetDockPoint());
  assert.ok(
    dock > ceiling && dock - ceiling < 1,
    `the bottom-sheet cap runs to ${ceiling}px but the sheet docks at ${dock}px — ` +
      'the cap would either leak onto the desktop drawer or leave a band where a tablet sheet is stretched again',
  );
});

test('the fold rules reach the sheet — hooks on the component, rules in the global sheet, no CSS import in the module', () => {
  assert.doesNotMatch(
    SHEET_CODE,
    /import\s+['"][^'"]+\.css['"]/,
    'sheet.tsx imports a stylesheet — the unit runner loads this module under node, where a .css import is a SyntaxError',
  );
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
