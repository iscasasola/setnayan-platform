/**
 * 🖼 THE COVER IS A THUMB AND A PILL — controller review of #7366 against makers prototype § 3 (owner 7 Nov,
 * DECISION_LOG "THE FOUR MAKERS ARE APPROVED"): the card's cover is a small dashed thumb + "Add a cover" pill, then
 * "Replace" once a file is in — not the big "Drop a file or click to choose" box. And the add-a-row presses under
 * What's included and Extras are the shipped `ActionButton` pill, never a bare terracotta text link.
 *
 * Reads source: the maker's cover asks `FileUpload` for `thumb`, `FileUpload` draws thumb mode with no drop box /
 * filename row / big preview, and both bare list editors add rows through `ActionButton`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// 🖼 SUPERSEDED FOR THE CARD MAKER (owner 2026-11-13, "CARD MAKER GALLERY UPLOAD APPROVED"): the cover is no longer a
// thumb + pill of its own — it is the gallery's first tile, tagged "Primary" (held in the-card-photos-are-one-gallery.test.ts).
// `thumb` mode stays in FileUpload, unchanged, for any square single image that asks for it.
test('the card maker’s cover is the gallery’s primary — no cover uploader of its own', () => {
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.doesNotMatch(maker, /<FileUpload\b[^>]*?name="primary_photo_r2_key"/, 'a separate cover uploader is back');
  const gallery = read('app/vendor-dashboard/services/_components/card-photo-gallery.tsx');
  assert.match(gallery, /name="primary_photo_r2_key" value=\{order\[0\]\}/, 'the first tile posts as the cover');
});

test('thumb mode draws one thumb and one ActionButton, and none of the big-box parts', () => {
  const fu = read('app/_components/file-upload.tsx');
  assert.match(fu, /const thumbMode = thumb != null && variant === 'square' && !multiple && !roundPreview;/);
  const block = fu.match(/\{thumbMode \? \([\s\S]*?\n      \) : null\}/);
  assert.ok(block, 'the thumb block is drawn');
  assert.match(block![0], /<ActionButton[\s\S]*?label=\{first \? thumb!\.replace : thumb!\.add\}/);
  assert.equal((block![0].match(/<ActionButton\b/g) ?? []).length, 1, 'exactly one pill');
  // The drop box, the big single preview, the filename rows and the help line all stand down in thumb mode.
  assert.match(fu, /\{!atCapacity && !rowMode && !thumbMode(?: && !tilesMode)? \? \(/);
  assert.match(fu, /isSingleImagePreview && !rowMode && (?:!pillMode && )?!thumbMode \? \(/);
  assert.match(fu, /&& !rowMode && !thumbMode && \(/);
  assert.match(fu, /help && !rowMode && (?:!\(pillMode && items\.length > 0\) && )?!thumbMode \?/);
  // A new file replaces the one there — it never hits "only one file".
  assert.match(fu, /const currentCount = \((?:pillMode \|\| )?thumbMode \? 0 : items\.length\) \+ inFlight\.length;/);
});

// 📐 Ruling 6058 (the Card Maker as one form, approved 11 Nov 2026): "Add a line" / "Add an extra" is the LAST ROW of its
// list (`AddLineRow`, app/_components/form-row-line.tsx) — it was a floating ActionButton pill; never a bare text link.
test('adding a line or an extra is the list’s last row, not a text link', () => {
  const inc = read('app/vendor-dashboard/services/_components/service-list-editors.tsx');
  const bare = inc.slice(inc.indexOf('data-inclusions-bare'));
  assert.match(bare.slice(0, 4000), /<AddLineRow label="Add a line" onAdd=\{add\}/);
  const add = read('app/vendor-dashboard/services/_components/addons-editor.tsx');
  const addBare = add.slice(add.indexOf('data-addons-bare'));
  assert.match(addBare.slice(0, 5000), /<AddLineRow label="Add an extra" onAdd=\{add\}/);
  assert.doesNotMatch(addBare.slice(0, addBare.indexOf('</div>\n    );')), /text-sn-accent/);
});
