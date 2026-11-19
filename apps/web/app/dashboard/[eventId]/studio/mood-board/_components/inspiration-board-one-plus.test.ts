/**
 * inspiration-board-one-plus.test.ts — ONE + PER PART (owner 2026-11-18, "go for all" on the approved drawing
 * "Inspiration board: one + per part", W4-S1/B8: the board drew 87 identical + boxes, 29 parts × 3).
 *
 * Each rule of the drawing that can be read off the source or run as a function is held here:
 *   · one + per part, opening the picker straight away, several photos at once;
 *   · no + on a full part (3 of 3);
 *   · the "1 of 3" count, and a pick cut to the free spots says so;
 *   · the groups fold — Venue & feel open, the others folded with a count;
 *   · a tap opens the shared photo viewer; a swipe left removes with Undo (no confirm);
 *   · on a phone, moving a photo is ONE dropdown in the viewer; a computer keeps dragging;
 *   · "Browse supplier photos" stays under its part; the ⓘ carries the how-to.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { cutWords, groupCount, partLine, INSPIRATION_OPEN_GROUP } from './inspiration-board-words';

const WEB = join(__dirname, '..', '..', '..', '..', '..', '..');
const src = stripComments(readFileSync(join(__dirname, 'inspiration-board.tsx'), 'utf8'));
const sheet = stripComments(
  readFileSync(join(WEB, 'app/dashboard/[eventId]/vendors/_components/find-inspiration.tsx'), 'utf8'),
);

test('one + per part — not one per spot — and it opens the picker for several photos', () => {
  // The + is drawn ONCE per part, outside the per-spot loop, and only while the part has room.
  assert.match(src, /\{room > 0 \? \(\s*<AddPhotos/, 'the + is not one-per-part behind a room check');
  assert.equal((src.match(/<AddPhotos\b/g) ?? []).length, 1, 'more than one + drawn per part');
  assert.doesNotMatch(src, /MOODBOARD_SLOT_POSITIONS\.map\(\(pos\) => \(\s*<SlotTile/, 'the three + cells per part are back');
  // The press IS the picker: a label around a hidden multi-file input — no page, no sheet of ours.
  const add = /function AddPhotos[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
  assert.match(add, /<label[\s\S]*?<input\s+type="file"\s+multiple/);
  assert.match(add, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(add, /h-11 w-11/, 'the + is under the 44 px floor');
});

test('a full part (3 of 3) has no +; the room counts every taken spot', () => {
  assert.match(src, /const room = cells\.filter\(\(c\) => !c\.tile\)\.length;/);
  assert.deepEqual(partLine(3, 0, []), { text: '3 of 3 · full', full: true });
});

test('the count per part says what is saved, never counting a photo still going up', () => {
  assert.deepEqual(partLine(0, 0, []), { text: 'Add photos', full: false });
  assert.deepEqual(partLine(1, 0, []), { text: '1 of 3', full: false });
  assert.equal(partLine(2, 0, ['Bloom & Co. · Florist']).text, '2 of 3 · 1 from Bloom & Co.');
  assert.equal(partLine(1, 2, []).text, 'Adding 2 photos…');
  assert.equal(
    cutWords(5, 3),
    'You picked 5. 3 is the most for one part, so we added the first 3. Remove one to add another.',
  );
  // The cut is real: only the free spots are uploaded, the first picks first.
  assert.match(src, /const take = files\.slice\(0, free\.length\);/);
});

test('a photo that did not go up stays as Retry, and the row says how many saved', () => {
  assert.match(src, /setTiles\(\(t\) => \(\{ \.\.\.t, \[key\(slot, pos\)\]: \{ failed: file \} \}\)\);/);
  assert.match(src, /onClick=\{\(\) => onRetry\(slot\.k, pos\)\}[\s\S]{0,600}?>\s*Retry\s*</);
  assert.match(src, /did not upload\. Tap Retry\./);
});

test('the groups fold: Venue & feel open, Palette and Dress codes folded with a count', () => {
  assert.equal(INSPIRATION_OPEN_GROUP, 'Venue & feel');
  assert.match(src, /<Fold\b[\s\S]*?defaultOpen=\{group\.title === INSPIRATION_OPEN_GROUP\}/);
  assert.equal(groupCount(0, 18), '0 of 18');
  assert.equal(groupCount(5, 18), '5 of 18 have photos');
});

test('tap opens the shared viewer; swipe left removes with Undo and no confirm', () => {
  assert.match(src, /onOpen=\{\(\) =>\s*setViewing\(/);
  assert.match(src, /<PhotoViewer\b/);
  // The house gesture, and letting go past halfway removes.
  assert.match(src, /swipeMove\(drag\.current, t\.clientX, t\.clientY, e\.timeStamp, SWIPE_REMOVE_PX\)/);
  assert.match(src, /if \(d\.horiz && swipeSettle\(tx, SWIPE_REMOVE_PX\) !== 0\) onRemove\(\);/);
  assert.match(src, /deleteWithUndo\(\{\s*label: 'Photo removed'/);
  assert.match(src, /<UndoToastHost \/>/);
  assert.doesNotMatch(src, /window\.confirm|confirm\(/, 'a confirm dialog came back');
  // The tiny × on each photo (a 20 px target) is gone.
  assert.doesNotMatch(src, /aria-label="Remove"/);
});

test('on a phone, moving a photo is ONE dropdown in the viewer; a computer keeps dragging', () => {
  assert.match(
    src,
    /className="\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hidden" data-inspiration-move="">\s*<PickMenu\s+label="Move to another part"/,
  );
  assert.match(src, /draggable\s/);
  assert.match(src, /onDragStart=\{\(e\) => \{\s*e\.dataTransfer\.setData\(DND_MIME/);
});

test('"Browse supplier photos" stays under its part; the ⓘ carries the how-to', () => {
  assert.match(src, /'Browse supplier photos'/);
  assert.match(sheet, /<InfoTip label=\{W\.sheetTitle\} labelAs="h2"/);
});
