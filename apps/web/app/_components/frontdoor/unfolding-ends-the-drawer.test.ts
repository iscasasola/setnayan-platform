/**
 * GUARD — unfolding the phone ends the drawer.
 *
 * ── THE DEFECT THIS EXISTS FOR (foldables audit, 2026-09-25) ───────────────
 * Below 1024 the rail is an off-canvas drawer; opening it marks the content
 * column `inert`. At 1024 and up, CSS pins the rail inline and hides the scrim —
 * but nothing told the component, so `railOpen` stayed `true` and the content
 * column stayed `inert`. Measured on production with a live resize 690 → 1100
 * (a Galaxy Fold inner screen rotated, a dual-screen phone spanned, an iPad
 * rotated to landscape): every link in the page reported an inert ancestor and
 * `elementFromPoint` missed the column entirely. The page looked normal and
 * ignored every tap — and there was no scrim to dismiss, because the scrim is
 * `display:none` at that width.
 *
 * 🔑 THE RULE IS AGREEMENT, NOT A VALUE (same shape as
 * `sheet-agrees-with-the-nav.test.ts`). The shell closes the drawer when a
 * media hook says the rail is inline; the stylesheet decides where the rail
 * STOPS being a drawer. This guard reads both numbers and fails when they
 * differ — so moving the rail's breakpoint moves this guard with it, and moving
 * only one side is what goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = readFileSync(join(HERE, 'front-door-shell.tsx'), 'utf8');
const CSS = readFileSync(join(HERE, 'front-door.css'), 'utf8');
const RESPONSIVE = readFileSync(join(HERE, '..', '..', '..', 'lib', 'use-responsive.ts'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const stripTs = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const stripCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

const SHELL_CODE = stripTs(SHELL);
const CSS_CODE = stripCss(CSS);

/** The px value `lib/use-responsive.ts` gives a named breakpoint. */
function breakpointPx(name: string): number {
  const m = new RegExp(`\\b${name}\\s*:\\s*(\\d+)`).exec(stripTs(RESPONSIVE));
  assert.ok(m, `lib/use-responsive.ts no longer declares a "${name}" breakpoint`);
  return Number(m[1]);
}

/** The max-width of the media block that hides the SHUT drawer. */
function drawerCeilingPx(): number {
  const re = /@media\s*\(max-width:\s*([\d.]+)px\)\s*{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS_CODE))) {
    // Walk the block's braces to find its body.
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < CSS_CODE.length) {
      if (CSS_CODE[i] === '{') depth++;
      else if (CSS_CODE[i] === '}') depth--;
      i++;
    }
    const body = CSS_CODE.slice(re.lastIndex, i);
    if (/\.fd-rail\[data-open='false'\]\s*{\s*display:\s*none/.test(body)) return Number(m[1]);
  }
  assert.fail(
    "front-door.css no longer hides `.fd-rail[data-open='false']` inside a max-width block — if the drawer was rebuilt, re-point this guard rather than deleting it",
  );
}

/** The breakpoint name the shell asks "is the rail inline?" with, and the variable it lands in. */
function shellInlineHook(): { bp: string; name: string } {
  const m = /const\s+(\w+)\s*=\s*useIsDesktop\(\s*'(sm|md|lg|xl|2xl)'\s*\)/.exec(SHELL_CODE);
  assert.ok(
    m,
    'front-door-shell.tsx no longer asks `useIsDesktop(<bp>)` whether the rail is inline — nothing closes the drawer when the screen unfolds past it',
  );
  return { name: m[1], bp: m[2] };
}

test('🚨 the shell closes the drawer when the rail becomes inline', () => {
  const { name } = shellInlineHook();
  // Find the effect that reads the hook and closes the drawer.
  const effects = [...SHELL_CODE.matchAll(/useEffect\(\s*\(\)\s*=>\s*{([\s\S]*?)}\s*,\s*\[([^\]]*)\]\s*\)/g)];
  const closer = effects.find(
    ([, body, deps]) =>
      new RegExp(`\\b${name}\\b`).test(body) &&
      /setRailOpen\(\s*false\s*\)/.test(body) &&
      new RegExp(`\\b${name}\\b`).test(deps),
  );
  assert.ok(
    closer,
    `no useEffect reads \`${name}\` and calls setRailOpen(false) — an open drawer survives an unfold, and the content column stays inert with no scrim to tap`,
  );
});

test('🚨 the shell and the stylesheet agree where the drawer ends', () => {
  const { bp } = shellInlineHook();
  const hookMin = breakpointPx(bp);
  const cssMax = drawerCeilingPx();
  assert.ok(
    hookMin > cssMax && hookMin - cssMax < 1,
    `the shell treats the rail as inline from ${hookMin}px, but front-door.css keeps it a drawer up to ${cssMax}px. ` +
      'Between the two, an open drawer is either closed while still a drawer or left open (and the page inert) once it is not.',
  );
});

// ── A PHONE SPANNED ACROSS A HINGE ──────────────────────────────────────────
// `front-door-fold.css` widens the rail's column to the left-hand screen when a
// dual-screen phone is spanned, so the content starts on the right-hand one.
// That only means anything while the rail is INLINE; below that the rail is a
// drawer and the body is one column. So its floor must be the drawer's ceiling —
// the same agreement as above, from the other side.
const FOLD = readFileSync(join(HERE, 'front-door-fold.css'), 'utf8');
const RAIL_SHELL = stripTs(readFileSync(join(HERE, 'app-rail-shell.tsx'), 'utf8'));

test('🚨 a spanned phone puts the content on one screen — from exactly where the rail becomes inline', () => {
  const m =
    /@media\s*\(horizontal-viewport-segments:\s*2\)\s*and\s*\(min-width:\s*([\d.]+)px\)\s*{\s*\.fd\.fd\s*{\s*--fd-rail:\s*env\(viewport-segment-left 1 0\)/.exec(
      stripCss(FOLD),
    );
  assert.ok(
    m,
    'front-door-fold.css no longer sets --fd-rail to the left segment under two side-by-side viewport segments — content will run across the hinge again',
  );
  const floor = Number(m[1]);
  const cssMax = drawerCeilingPx();
  assert.ok(
    floor > cssMax && floor - cssMax < 1,
    `the hinge rule starts at ${floor}px but the rail stays a drawer up to ${cssMax}px`,
  );
  assert.match(
    RAIL_SHELL,
    /import\s+'\.\/front-door-fold\.css'/,
    'app-rail-shell.tsx no longer loads front-door-fold.css — the rule exists and reaches nothing',
  );
});

test('the content column is still inert only while the drawer is open', () => {
  // The fix above is only needed because of this line; if it ever stops keying
  // on railOpen, this guard's premise has moved and should be re-read.
  assert.match(SHELL_CODE, /inert=\{\s*railOpen\s*\?\s*true\s*:\s*undefined\s*\}/);
});
