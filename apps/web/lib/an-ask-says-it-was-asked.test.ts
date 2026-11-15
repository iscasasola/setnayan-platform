/**
 * 💬 AN ASK SAYS IT WAS ASKED (walk 13 Nov 2026). "Ask for a quote" on a supplier card in More to compare saves the
 * supplier first (a thread needs a pick), and the card then said "Saved to Mobile Bar." over an inquiry already sent.
 * The card now names the ask, and offers no Undo (an Undo would remove the pick, not the ask).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inlineMoreAskedNote, inlineMoreSavedNote } from '@/lib/explore-info-copy';
import { stripComments } from '@/lib/strip-comments';

test('the words', () => {
  assert.equal(inlineMoreAskedNote('SetnaProd'), 'Asked SetnaProd for a quote.');
  assert.equal(inlineMoreAskedNote('  '), 'Asked for a quote.');
  assert.equal(inlineMoreSavedNote('Mobile Bar'), 'Saved to Mobile Bar.', 'a plain Save still says where it went');
});

test('the card says the ask once Ask for a quote is pressed, and hides Undo; a refused ask puts the save back', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '..', 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'));
  assert.match(src, /\{saved\.asked \? inlineMoreAskedNote\(v\.name\) : inlineMoreSavedNote\(label\)\}/);
  assert.match(src, /\{saved\.undoable && !saved\.asked \? \(/);
  const ask = src.slice(src.indexOf('const inquireFromMore = async'), src.indexOf('const inquireFromMore = async') + 1600);
  assert.match(ask, /markAsked\(true\);[\s\S]*contactShortlistVendor[\s\S]*markAsked\(false\);/);
});
