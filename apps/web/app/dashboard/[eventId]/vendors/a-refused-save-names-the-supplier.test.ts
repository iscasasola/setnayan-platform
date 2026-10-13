import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { inlineMoreSaveFailed } from '@/lib/explore-info-copy';

/**
 * A REFUSED SAVE IS SAID LIKE A REFUSED ADD OR REMOVE.
 *
 * 🚨 Seen on the batch-3 walk (2026-10-13, /dev/suppliers-lab with the writes failing, Chromium + WebKit): Save on a
 * "More to compare" card that the write refused showed only a red line under the section — "We couldn't save that
 * supplier." — naming nobody, with no Try again, no top toast, and the section's "· N" count gone (the count hides
 * while the LIST could not be read, and the refusal was written into that same list-error state). A refused Add or
 * Remove on the same page names the supplier, says it in the page's one top toast with Try again, and keeps the
 * counts. This holds Save to the same shape:
 *
 *   • the words NAME the supplier (`inlineMoreSaveFailed(v.name)`);
 *   • every refusal goes through ONE `refuse` — the section's own line AND the page's top toast (`benchLocal.say`);
 *   • a database refusal offers Try again, and Try again IS the save again (signed-out / not-your-event do not:
 *     trying again cannot help);
 *   • the refusal is NOT the list's error — so `counted` (the "· N") does not hear it.
 *
 * Read off the source because `MoreToCompare` needs the whole bench to render; the walk (controller-2026-10-12/
 * batch3-followups/) presses it in a browser.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = stripComments(readFileSync(join(HERE, '_components/shortlist-categories.tsx'), 'utf8'));

function slice(code: string, from: string, to: string): string {
  const i = code.indexOf(from);
  assert.ok(i > -1, `anchor moved: ${from}`);
  const j = code.indexOf(to, i + from.length);
  assert.ok(j > -1, `end anchor moved: ${to}`);
  return code.slice(i, j);
}
const SAVE = slice(BENCH, 'const saveFromMore = async (', 'const undoFromMore = async (');

test('the words name who was not saved', () => {
  assert.equal(inlineMoreSaveFailed('Kusina ni Lola'), 'Kusina ni Lola could not be saved. Nothing was added.');
  assert.doesNotMatch(SAVE, /INLINE_MORE_SAVE_FAILED/, 'the nameless sentence is back');
  const named = SAVE.match(/inlineMoreSaveFailed\(v\.name\)/g) ?? [];
  assert.equal(named.length, 2, 'both refusals (an answer that is not ok, and a throw) must name the supplier');
});

test('one refuse(): the section line AND the page’s top toast, with Try again that saves again', () => {
  const refuse = slice(SAVE, 'const refuse = (', '};');
  assert.match(refuse, /retry \? \(\) => void saveFromMore\(v, true\) : undefined/, 'Try again must be this same save, pressed again');
  assert.match(refuse, /setMoreRefused\(\{ text, retry: again \}\)/, 'the section line must carry the words and the Try again');
  assert.match(refuse, /benchLocal\?\.say\('bad', text, again\)/, 'the page’s one top toast must say it, with the same Try again');
  assert.doesNotMatch(SAVE, /setMoreError\(\s*(?!null)/, 'a refused save must never be written into the list’s error (that hides the "· N")');
  assert.equal((SAVE.match(/refuse\(inlineMoreSaveFailed\(v\.name\), true\)/g) ?? []).length, 2, 'both database refusals (not ok, and a throw) offer Try again');
  assert.match(SAVE, /refuse\(INLINE_MORE_SIGNED_OUT, false\)/, 'signed out: trying again cannot help');
});

test('the line draws its Try again, and the "· N" does not hear a refused save', () => {
  const line = slice(BENCH, '{moreRefused ? (', ') : null}');
  assert.match(line, /role="alert"/);
  assert.match(line, /label="Try again" onClick=\{moreRefused\.retry\}/);
  const counted = slice(BENCH, 'const counted = ', ';');
  assert.doesNotMatch(counted, /moreRefused/, 'the count must stay while a save is refused');
  assert.match(counted, /!moreError/, 'the count still hides while the list itself could not be read');
});
