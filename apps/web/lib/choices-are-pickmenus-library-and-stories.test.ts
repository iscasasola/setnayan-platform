/**
 * choices-are-pickmenus-library-and-stories.test.ts — the supplier inspiration library and /realstories offer their
 * choices through the shipped PickMenu, and the library's file pick is the upload box, not the browser's bare control
 * (sweep B12 + B10, 2026-10-19 · owner rule: "any set of choices is a dropdown").
 *
 * What the sweep saw: the library page drew a native "Choose File · no file selected" and two native <select>s (one
 * cut to "Couples' inspirati…" at 390 px), plus a third <select> under "From events you worked"; /realstories drew
 * its milestone filter as a row of up to 18 pills.
 *
 * The property: no native <select>/<option>/<optgroup> in either file, each choice is a <PickMenu> (counted per
 * choice — a file-level "PickMenu appears somewhere" match could not tell two dropdowns from one), every form value a
 * select used to post still posts (a hidden field of the same name), the library's file input is visually hidden
 * inside its drop box, and the milestone row has no pill buttons left.
 *
 * SABOTAGE: put `<select name="assetType">` back in the editor → RED (test 1, and test 2's hidden-field count).
 * SABOTAGE: swap the import-slot PickMenu for a <select> → RED (test 1 + the per-choice count).
 * SABOTAGE: drop `className="sr-only"` from the library file input → RED (test 3).
 * SABOTAGE: restore the milestone pill row (`setActiveType(activeType === type ? null : type)` buttons) → RED (test 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR = 'app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx';
const STORIES = 'app/realstories/_components/gallery.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** Each self-closing `<Name … />` tag, whole — a `[^>]*` match would stop at the `>` of an `(k) => …` prop. */
function tags(src: string, name: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf(`<${name}`); at >= 0; at = src.indexOf(`<${name}`, at + 1)) {
    const end = src.indexOf('/>', at);
    if (end > at) out.push(src.slice(at, end + 2));
  }
  return out;
}
const PICK_IMPORT = /import \{ PickMenu[^}]*\} from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu'/;

test('1 · neither page draws a native select', () => {
  for (const file of [EDITOR, STORIES]) {
    const src = read(file);
    assert.doesNotMatch(src, /<(select|option|optgroup)\b/, `${file}: a native <select> is back — use PickMenu`);
    assert.match(src, PICK_IMPORT, `${file}: does not import the shipped PickMenu`);
  }
});

test('2 · the library: one PickMenu per choice, and each still posts its form field', () => {
  const src = read(EDITOR);
  for (const attr of ['data-library-asset-type', 'data-library-upload-part', 'data-library-import-part']) {
    const n = tags(src, 'PickMenu').filter((t) => t.includes(`dataAttr="${attr}"`)).length;
    assert.equal(n, 1, `${attr}: ${n} PickMenu(s) — want exactly 1`);
  }
  // The two values `uploadStylistAsset` reads off FormData — a PickMenu posts nothing by itself.
  assert.match(src, /<input type="hidden" name="assetType" value=\{assetType\} \/>/, 'assetType no longer posts');
  assert.match(src, /<input type="hidden" name="assetSubtype" value=\{uploadSlot\} \/>/, 'the part no longer posts');
  console.log('[choices] library: 3 PickMenus, 2 hidden fields');
});

test('3 · the library: the file pick is the upload box, the input inside it is visually hidden', () => {
  const src = read(EDITOR);
  const inputs = tags(src, 'input').filter((t) => /\btype="file"/.test(t));
  assert.equal(inputs.length, 1, `${inputs.length} file inputs — want exactly 1`);
  assert.match(inputs[0]!, /name="file"/, 'the file input must stay `name="file"` — the server action reads it');
  assert.match(inputs[0]!, /className="sr-only"/, 'the bare browser control is showing again ("Choose File · no file selected")');
  const box = src.lastIndexOf('<label', src.indexOf('type="file"'));
  assert.ok(box >= 0 && src.slice(box, src.indexOf('type="file"')).includes('data-library-file-box'), 'the file input is not inside the drop box');
});

test('4 · /realstories: the milestone filter is one PickMenu, not a pill row', () => {
  const src = read(STORIES);
  const n = tags(src, 'PickMenu').filter((t) => t.includes('dataAttr="data-stories-milestone-pick"')).length;
  assert.equal(n, 1, `${n} milestone PickMenu(s) — want exactly 1`);
  assert.doesNotMatch(src, /eventTypes\.map\(\(type\) => \(\s*<button/, 'the milestone pills are back');
  assert.doesNotMatch(src, /aria-label="Filter by milestone type"/, 'the old pill group (role="group") is back');
});
