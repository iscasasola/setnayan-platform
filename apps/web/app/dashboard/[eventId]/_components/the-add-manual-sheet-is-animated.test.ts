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
    assert.match(modal, /className="sn-addman-veil fixed inset-0/);
    assert.match(modal, /className="sn-addman-sheet w-full max-w-md/);
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
