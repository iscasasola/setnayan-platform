/**
 * THE ADD-MANUALLY SHEET IS ANIMATED, AND ITS MOTION CANNOT UNPIN A FIXED
 * OVERLAY. (owner 2026-09-20: *"make sure it is fully animated as well."*)
 *
 * Two separate promises, both of which decay silently:
 *
 * 1. **The motion reaches the render.** A keyframe in `globals.css` that no
 *    component wears is a stylesheet entry, not an animation — the class is
 *    the only thing that makes it ink. This asserts the mount, not the CSS.
 *
 * 2. **`backwards`, never `both`.** This is a REPEAT of a measured production
 *    failure, documented on `sn-rise-soft` in globals.css (2026-09-18):
 *    `both` keeps the animation's TRANSFORM applied after it finishes, at its
 *    identity value. It moves nothing and is invisible — and per CSS spec ANY
 *    transform on an ancestor makes it the containing block for every
 *    `position: fixed` descendant. Last time that unpinned every fixed
 *    overlay on the page and put a coach-mark's buttons 341px below the fold,
 *    on a page that simply looked broken.
 *
 *    This sheet lives inside a `fixed inset-0` dialog and already contains an
 *    absolutely-positioned autocomplete. The next person to add a fixed child
 *    will not read that comment. This test will tell them.
 *
 * ⚠ ANCHORED. It first asserts both files are readable and the class names
 * appear at all, so a rename cannot leave it passing over nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODAL = path.join(HERE, 'new-manual-vendor-modal.tsx');
const GLOBALS = path.resolve(HERE, '..', '..', '..', 'globals.css');

/** The old hand-made dialog's classes — still defined in globals.css, still held to `backwards` below. */
const SHEET_CLASSES = ['sn-addman-veil', 'sn-addman-sheet', 'sn-addman-field'];

/*
 * ⚠ RE-POINTED 2026-10-12 (suppliers step 2, the controller's template rule:
 * every popup is the house `Sheet` — INTERACTION_RULES § 9, "popups darken +
 * blur"). The sheet is no longer a hand-made `fixed inset-0` dialog wearing
 * `sn-addman-veil` / `sn-addman-sheet` / `sn-addman-field`: it is
 * `<Sheet … rise>`, whose motion is `.sn-rise` / `.sn-fade` and whose height cap
 * and inner scroll are the Sheet's own (`max-h-[90dvh]`, `overflow-y-auto`). The
 * PROMISES are unchanged and still asserted below: the motion reaches the
 * render, it is `backwards` (never `both`), the sheet cannot grow off a short
 * screen, and Save stays pinned. Only WHERE they live moved.
 */
const SHEET = path.resolve(HERE, '..', '..', '..', '_components', 'sheet.tsx');

describe('the add-manually sheet is animated', () => {
  const modal = readFileSync(MODAL, 'utf8');
  const css = readFileSync(GLOBALS, 'utf8');
  const sheet = readFileSync(SHEET, 'utf8');

  it('found the files', () => {
    assert.ok(modal.length > 1000, 'modal source looks wrong — re-point this guard');
    assert.ok(css.includes('@keyframes'), 'globals.css looks wrong — re-point this guard');
    assert.ok(sheet.includes('export function Sheet('), 'sheet.tsx looks wrong — re-point this guard');
  });

  it('the modal is the house Sheet, mounted WITH its rise', () => {
    assert.match(modal, /<Sheet\b[^>]*\brise\b/, 'the add sheet is not the house Sheet with `rise` — it would open without motion');
    assert.doesNotMatch(modal, /className="[^"]*\bfixed inset-0\b/, 'a hand-made fixed overlay is back in the modal');
  });

  it("the Sheet's rise and fade are defined, worn by the Sheet, and `backwards`", () => {
    for (const c of ['sn-rise', 'sn-fade']) {
      const i = css.indexOf(`.${c} {`);
      assert.ok(i > 0, `.${c} is not defined in globals.css`);
      const decl = css.slice(i, css.indexOf('}', i));
      assert.match(decl, /\bbackwards\b/, `.${c} is not \`backwards\``);
      assert.doesNotMatch(decl, /\bboth\b/, `.${c} uses \`both\``);
      assert.ok(sheet.includes(c), `the Sheet no longer wears .${c}`);
    }
  });
});

/**
 * THE SHEET CAN BE REACHED. (2026-09-21 — a bug found LIVE on production the
 * day the eight-field sheet shipped: 1,513 px tall in a 768 px window, centred
 * in an overlay that cannot scroll, its required name field at y = -174.) The
 * house Sheet caps its height and scrolls inside itself; the modal keeps Save
 * pinned at the foot.
 */
describe('the sheet can be reached on a short screen', () => {
  const modal = readFileSync(MODAL, 'utf8');
  const sheet = readFileSync(SHEET, 'utf8');

  it('the Sheet caps its own height and scrolls inside itself', () => {
    assert.match(sheet, /max-h-\[90dvh\]/, 'the house Sheet has no height cap');
    assert.match(sheet, /flex-1 overflow-y-auto/, 'the house Sheet does not scroll inside itself');
  });

  it('keeps Save & add pinned so the primary action never scrolls away', () => {
    assert.match(
      modal,
      /className="sticky bottom-0[^"]*"/,
      'the footer holding "Save & add" is no longer sticky — on an eight-field ' +
        'sheet the primary action would scroll out of reach.',
    );
  });
});

describe('the sheet motion cannot unpin a fixed overlay', () => {
  const css = readFileSync(GLOBALS, 'utf8');

  it('uses `backwards`, never `both`, on every add-manually animation', () => {
    const offenders: string[] = [];
    for (const c of SHEET_CLASSES) {
      // The declaration block for this class, up to the closing brace.
      const i = css.indexOf(`.${c} {`);
      if (i < 0) continue;
      const decl = css.slice(i, css.indexOf('}', i));
      if (!/\banimation\b/.test(decl)) continue;
      if (/\bboth\b/.test(decl)) offenders.push(`${c}: ${decl.trim()}`);
      if (!/\bbackwards\b/.test(decl)) offenders.push(`${c} has no fill mode: ${decl.trim()}`);
    }
    assert.deepEqual(
      offenders,
      [],
      'An add-manually animation uses `both` (or no fill mode). `both` holds ' +
        'the transform after the run, which makes the element a containing ' +
        'block for every position:fixed descendant — measured on production ' +
        '2026-09-18, it put a coach-mark 341px below the fold. Use ' +
        '`backwards`.\n' +
        offenders.join('\n'),
    );
  });

  it('is disabled under prefers-reduced-motion', () => {
    // globals.css already kills all motion with a blanket !important rule, so
    // this is belt-and-braces — but the explicit block is what keeps the
    // classes listed if that blanket is ever narrowed.
    const i = css.indexOf('.sn-addman-veil,');
    assert.ok(i > 0, 'the add-manually classes are not listed in a reduced-motion block');
    const block = css.slice(i, i + 400);
    assert.match(block, /animation:\s*none/);
  });
});
