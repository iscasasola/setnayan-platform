import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * FRONT-DOOR GEOMETRY — the three silent reversals.
 *
 * ─── WHAT THIS IS FOR ────────────────────────────────────────────────────
 * Owner, 2026-08-14: *"button, text size, proportion is still not correct.
 * ours look too big as compared to the proper sizing."* Measured against
 * YouTube in the same browser at the same viewport, our TYPE was already at or
 * below the reference on six of seven elements — the complaint was BOX HEIGHT,
 * plus a content column the port invented. Both are now fixed, and the fixes
 * share one shape: **paint smaller, press the same.**
 *
 * 🔑 THE LOCK IS A FLOOR ON THE PRESSABLE AREA, NEVER ON THE PAINT. This file's
 * subject line ~158 has claimed exactly that since it shipped — *"The visual
 * circle may read smaller, but the pressable area never does"* — above a rule
 * that painted 44×44 and implemented none of it. A comment was tried and was
 * not enough. This is the mechanism.
 *
 * ─── THE THREE REVERSALS, EACH ONE LINE ──────────────────────────────────
 * Delete any of these and a control keeps its smaller PAINT while silently
 * losing its tap target, with nothing thrown and CI green:
 *   1. `min-height: 0` on `.fd-searchgo` / `.fd-avatar` / `.fd-iconbtn`
 *      — they are real <button>s; without it globals' `button{min-height:44px}`
 *        wins and re-inflates the bar (and renders `.fd-avatar` as an ELLIPSE,
 *        which it was doing live for every signed-in person until 2026-08-14).
 *   2. `overflow: hidden` returning to `.fd-searchbox` — it clips hit-testing,
 *      so the expander inside it becomes pure decoration.
 *   3. the `padding`/`margin` pair on `.fd-chips` — that container is
 *      `overflow-x: auto`, which forces computed `overflow-y: auto`; a scroll
 *      container clips the chips' expanders to nothing.
 *
 * ⚠ THESE ARE TEXT GUARDS AND THEY CANNOT SEE A RENDERED FACT. They stop the
 * three reversals above; they cannot prove a tap target. The real gate is
 * `document.elementFromPoint` in a browser, and the numbers below were measured
 * that way at 1920×1080 and 375×812 before this file was written:
 *
 *   control        paint    press   lock
 *   search submit   38       44      ok
 *   sign in / +Create 36     44      ok
 *   filter chip     32       44      ok   (was 36 paint / 36 press — UNDER the
 *                                          lock before this change)
 *   hamburger       40       44      ok   (375px band)
 *   search field    44 box   44      ok   (touch only — an <input> renders no
 *                                          pseudo-element, so `pointer: coarse`
 *                                          restores its height instead)
 *   top bar         56 —— matches the drawing AND YouTube exactly
 *
 * Do not upgrade "the guards pass" to "the lock is enforced". Say both.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_SRC = readFileSync(join(HERE, 'front-door.css'), 'utf8');

/** Comments stripped, so prose about a rule can never satisfy a check for it. */
const CSS = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declaration block of a selector, or null. */
function block(selector: string): string | null {
  const i = CSS.indexOf(selector + ' {');
  if (i === -1) return null;
  const open = CSS.indexOf('{', i);
  const close = CSS.indexOf('}', open);
  return close === -1 ? null : CSS.slice(open + 1, close);
}

test('the anchor: the stylesheet is real and the stripper did not eat it', () => {
  assert.ok(CSS_SRC.length > 20000, 'front-door.css is missing or truncated');
  assert.ok(CSS.includes('.fd-topbar'), 'comment stripping destroyed the source');
});

/* ── 1 · THE BAR HEIGHT IS NAMED ONCE ──────────────────────────────────── */

test('the sticky offsets read the token, never a px literal', () => {
  /*
    THE DEFECT THIS CLOSES WAS LIVE IN PRODUCTION. `.fd-rail` and `.fd-chipbar`
    both pinned `top: 60px` against a bar that rendered 63 — so the rail's first
    row and the chip strip sat 3px UNDERNEATH the top bar at every width above
    1024. A number hand-typed in three places disagreed with itself, and 3px
    reads as a tight layout rather than as a bug.
  */
  const rail = block('.fd-rail');
  assert.ok(rail, '.fd-rail rule is gone');
  assert.match(rail, /top:\s*var\(--fd-bar\)/, '.fd-rail top is not the token');
  assert.match(
    rail,
    /max-height:\s*calc\(100vh - var\(--fd-bar\)\)/,
    '.fd-rail max-height is not derived from the token',
  );

  const chipbar = block('.fd-chipbar');
  assert.ok(chipbar, '.fd-chipbar rule is gone');
  assert.match(chipbar, /top:\s*var\(--fd-bar\)/, '.fd-chipbar top is not the token');

  // …and the app variant sets its OWN value, because its tallest child is the
  // host's 44px account cluster, not a front-door control.
  assert.match(
    CSS,
    /\.fd\[data-chrome='app'\]\s*\{[^}]*--fd-bar:\s*61px/,
    "the app variant must set --fd-bar itself (61px, MEASURED). Inheriting 56 " +
      'leaves the app rail 5px under its own bar on all five signed-in trees.',
  );
});

/* ── 2 · EVERY SHRUNK CONTROL KEEPS ITS PRESS ──────────────────────────── */

const SHRUNK = [
  { sel: '.fd-iconbtn', isButton: true },
  { sel: '.fd-avatar', isButton: true },
  { sel: '.fd-searchgo', isButton: true },
  { sel: '.fd-chip', isButton: false }, // an <a>
] as const;

test('every control that paints below 44 carries an expander', () => {
  for (const { sel } of SHRUNK) {
    assert.ok(
      new RegExp(`\\${sel}::after\\s*\\{[^}]*content:`).test(CSS),
      `${sel} paints below 44px but has no ::after expander block — its tap ` +
        'target is whatever it paints, which is under the locked 44px floor.',
    );
    const b = block(sel);
    assert.ok(b, `${sel} rule is gone`);
    assert.match(
      b,
      /position:\s*relative/,
      `${sel} has an expander but is not a containing block, so the ` +
        'absolutely-positioned ::after escapes to the nearest positioned ' +
        'ancestor and covers the wrong thing.',
    );
  }
  // The bar's pills are scoped, so they are checked by their own selector.
  assert.match(
    CSS,
    /\.fd-topbar \.fd-btn-gold::after,\s*\.fd-topbar \.fd-btn-quiet::after\s*\{[^}]*content:/,
    "the bar's pills lost their expander",
  );
});

test('every shrunk <button> cancels the global 44px floor', () => {
  /*
    globals.css carries `button { min-height: 44px }`. It is why the port's bar
    was 63px in the first place: `.fd-searchgo` declared no height and silently
    inherited it. Any of these losing `min-height: 0` re-inflates the bar — and
    for `.fd-avatar`, whose width is 32, produces a 32×44 ELLIPSE.
  */
  for (const { sel, isButton } of SHRUNK) {
    if (!isButton) continue;
    const b = block(sel);
    assert.ok(b, `${sel} rule is gone`);
    assert.match(
      b,
      /min-height:\s*0/,
      `${sel} is a <button> painting below 44px and does not cancel globals' ` +
        '`button { min-height: 44px }`. It will render taller than it is wide.',
    );
  }
});

/* ── 3 · NO ANCESTOR CLIPS AN EXPANDER ─────────────────────────────────── */

test('.fd-searchbox does not clip its submit button\'s tap target', () => {
  const b = block('.fd-searchbox');
  assert.ok(b, '.fd-searchbox rule is gone');
  assert.doesNotMatch(
    b,
    /overflow:\s*hidden/,
    '`overflow: hidden` is back on .fd-searchbox. It clips HIT-TESTING, not ' +
      'just paint, so .fd-searchgo::after becomes pure decoration and the ' +
      'submit button silently drops to its 38px paint. The corner rounding it ' +
      'used to provide lives on .fd-searchgo itself now.',
  );
});

test('.fd-chips gives its scroll container room for the chips\' expanders', () => {
  const b = block('.fd-chips');
  assert.ok(b, '.fd-chips rule is gone');
  // Only required while the chips actually paint below the lock.
  const chip = block('.fd-chip') ?? '';
  const chipPaintsSmall = /min-height:\s*(3[0-9]|4[0-3])px/.test(chip);
  if (!chipPaintsSmall) return;
  assert.match(
    b,
    /padding:\s*6px 0/,
    '.fd-chips lost its padding. It is `overflow-x: auto`, which forces ' +
      'computed `overflow-y: auto` — a scroll container clips the chips\' ' +
      'expanders to nothing and the tap target silently becomes 32px.',
  );
  assert.match(
    b,
    /margin:\s*-6px 0/,
    '.fd-chips lost the negative margin that takes back the layout space its ' +
      'padding adds. Without it the chip strip grows 12px taller.',
  );
});

/* ── 4 · THE PROPORTION FIX STAYS ──────────────────────────────────────── */

test('the feed column is not capped back down', () => {
  /*
    `.fd-col { max-width: 1064px }` was invented by the port — the binding
    drawing has no cap; it was drawn inside a 1400px device frame and the port
    froze that frame's proportions at every width. At 1920 it rendered 254px
    cards against YouTube's ~390px, which is what "ours look too big" actually
    was: the same 14px title in a card 35% narrower.
    Measured after the fix: column 1600, card 388 — parity.
  */
  const b = block('.fd-col');
  assert.ok(b, '.fd-col rule is gone');
  const m = /max-width:\s*(\d+)px/.exec(b);
  assert.ok(m, '.fd-col has no max-width at all');
  assert.ok(
    Number(m[1]) >= 1400,
    `.fd-col is capped at ${m[1]}px. Anything below ~1400 re-creates the ` +
      'narrow-card defect the owner reported on 2026-08-14.',
  );
  // …and the 1439px band must not quietly re-impose one.
  assert.doesNotMatch(
    CSS,
    /@media \(max-width: 1439\.98px\)\s*\{[^@]*?\.fd-col\s*\{[^}]*max-width/,
    'the 1439px band caps .fd-col again — at a 1439px window that squeezed a ' +
      '1151px column to 960px, which is the same defect one breakpoint down.',
  );
});
