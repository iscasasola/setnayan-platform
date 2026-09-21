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

const SHEET_CLASSES = ['sn-addman-veil', 'sn-addman-sheet', 'sn-addman-field'];

describe('the add-manually sheet is animated', () => {
  const modal = readFileSync(MODAL, 'utf8');
  const css = readFileSync(GLOBALS, 'utf8');

  it('found both files', () => {
    assert.ok(modal.length > 1000, 'modal source looks wrong — re-point this guard');
    assert.ok(css.includes('@keyframes'), 'globals.css looks wrong — re-point this guard');
  });

  it('every motion class is BOTH defined and worn', () => {
    for (const c of SHEET_CLASSES) {
      assert.ok(css.includes(`.${c}`), `.${c} is not defined in globals.css`);
      assert.ok(
        modal.includes(c),
        `.${c} is defined but nothing in the modal wears it — a keyframe no ` +
          'component references animates nothing.',
      );
    }
  });

  it('the backdrop and the sheet are the elements that carry it', () => {
    // Pinned to the two mounts rather than a bare file match, so moving the
    // class onto an inner div (where it would animate the wrong box) fails.
    // ⚠ Pinned to the ELEMENT, not to the class ORDER. The first version
    // matched the literal `sn-addman-sheet w-full max-w-md`, and the next edit
    // to that className (adding the height cap) broke it for a reason that had
    // nothing to do with animation. The property is "the sheet wears it"; the
    // sheet is the one element carrying `max-w-md`.
    assert.match(modal, /className="sn-addman-veil [^"]*fixed inset-0/);
    assert.match(modal, /className="sn-addman-sheet [^"]*\bmax-w-md\b/);
  });
});

/**
 * THE SHEET CAN BE REACHED. (2026-09-21 — a bug found LIVE on production the
 * day the eight-field sheet shipped, not by any test.)
 *
 * Measured in the browser: the sheet was 1,513px tall in a 768px window. It
 * sits in a `fixed inset-0` overlay, which cannot scroll, and was centred — so
 * it overflowed 372px off BOTH edges. The required Vendor name field was at
 * y = -174 and "Save & add" was below the fold. A couple on a laptop could not
 * fill in the one required name or press save.
 *
 * ⚠ A SOURCE GUARD CANNOT MEASURE LAYOUT, and this one does not pretend to. It
 * pins the two declarations whose ABSENCE produced the bug — a height cap with
 * scrolling on the sheet, and a sticky footer — so that removing either fails
 * CI with the reason. Whether the result is comfortable to use is still a
 * browser question; whether the cap exists at all is not.
 */
describe('the sheet can be reached on a short screen', () => {
  const modal = readFileSync(MODAL, 'utf8');
  const sheetClass = (modal.match(/className="(sn-addman-sheet [^"]*)"/) ?? [])[1] ?? '';

  it('found the sheet className to inspect', () => {
    assert.ok(sheetClass.length > 0, 'could not find the sheet className — re-point this guard');
  });

  it('caps its own height, on phones and on desktop', () => {
    assert.match(sheetClass, /(^|\s)max-h-\[/, 'the sheet has no mobile max-height');
    assert.match(sheetClass, /\bsm:max-h-\[/, 'the sheet has no desktop max-height');
  });

  it('scrolls inside itself', () => {
    assert.match(
      sheetClass,
      /\boverflow-y-auto\b/,
      'the sheet does not scroll. Inside a fixed overlay, a sheet taller than the ' +
        'window overflows off both edges and cannot be reached — measured on ' +
        'production 2026-09-21 with the Vendor name field at y = -174.',
    );
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
