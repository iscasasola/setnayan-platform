/**
 * GUARD — the control that saves a photo must not cover the photo, and must not
 * be shrunk to achieve that.
 *
 * 🚨 FOUND BY THE OWNER LOOKING AT HIS OWN GALLERY (2026-08-10). Fourteen photos
 * on screen, and every single tile had a dark 44px pill reading "Save" parked
 * over its upper-left. He could not see any of his pictures. The control built
 * to save a photo was hiding it.
 *
 * ⚠ THE OBVIOUS FIX IS THE WRONG ONE. Shrinking it, or dropping the word, would
 * break the **Guest Legibility Floor** recorded in the component itself: the save
 * action must be a VISIBLE, ≥44px-tappable, LABELLED control — not a 20px
 * icon-only corner dot an older guest cannot see or hit. That decision predates
 * the bug and is not what caused it.
 *
 * 🔑 THE BUG WAS THE POSITION, NOT THE SIZE. Anchored to an edge with its own
 * scrim, a 44px labelled bar reads as chrome; dropped at `left-1.5 top-1.5` on a
 * thumbnail it reads as an object sitting on the subject. This guard pins BOTH
 * halves, because the next person to see the overlap will reach for the size.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, 'save-photo-button.tsx'), 'utf8');

/** Strip comments — this guard must never pass on the prose explaining itself. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The single className string on the button element. */
function buttonClasses(): string {
  const m = CODE.match(/className="([^"]*absolute[^"]*)"/);
  assert.ok(m?.[1], 'the overlay button must still carry a className');
  return m[1];
}

test('the guard reads CODE, not the comment that explains the bug', () => {
  assert.ok(!/Guest Legibility Floor/.test(CODE), 'comments must be stripped before matching');
  assert.ok(/Guest Legibility Floor/.test(SRC), 'and the explanation must still be in the file');
});

test('🚨 it is anchored to an EDGE, not dropped on top of the picture', () => {
  const cls = buttonClasses();
  // The exact shape of the bug: pinned into the tile's interior corner.
  assert.ok(
    !/\bleft-1\.5\b/.test(cls) || !/\btop-1\.5\b/.test(cls),
    'left-1.5 + top-1.5 is the floating pill that covered every photo',
  );
  assert.match(
    cls,
    /\b(inset-x-0|inset-y-0)\b/,
    'an edge-anchored bar spans its edge — a control that only touches one corner sits ON the photo',
  );
  assert.match(cls, /\bbottom-0\b/, 'the bottom strip is the one place a control costs nothing');
});

test('it carries its own scrim, so the label is legible over any photo', () => {
  const cls = buttonClasses();
  // ⚠ `bg-black/` ALONE IS NOT ENOUGH TO ASSERT ON. The button also carries
  // `active:bg-black/70` for the press state, so a looser pattern matched even
  // with the scrim deleted — the sabotage stayed green. Require the gradient
  // itself, which is the thing doing the work.
  assert.match(
    cls,
    /\bbg-gradient-to-t\b/,
    'white text over an arbitrary photo needs a scrim or it disappears on a bright one',
  );
  assert.match(cls, /from-black\//, 'the scrim must actually be dark at the label end');
});

test('⚠ the 44px touch target SURVIVES — do not fix the overlap by shrinking it', () => {
  assert.match(
    buttonClasses(),
    /min-h-\[44px\]/,
    'the Guest Legibility Floor: an older guest must be able to hit it',
  );
});

test('⚠ the WORD survives too — icon-only was explicitly rejected', () => {
  assert.match(CODE, /<span>\{label\}<\/span>/, 'the label must still render');
  assert.match(CODE, /'Save'/, 'and it must still say Save when idle');
});

test('it still says what it is doing, and confirms when done', () => {
  assert.match(CODE, /'Saving…'/);
  assert.match(CODE, /'Saved'/);
  assert.match(CODE, /aria-label="Save to phone"/, 'the accessible name must not depend on the icon');
});

test('tapping Save never also opens the tile behind it', () => {
  // The clip tile has a full-tile play button underneath. Without this the save
  // tap would open the lightbox at the same time.
  assert.match(CODE, /e\.stopPropagation\(\)/);
});
