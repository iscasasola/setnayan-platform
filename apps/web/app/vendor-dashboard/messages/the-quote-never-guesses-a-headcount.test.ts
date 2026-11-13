/**
 * 🔒 THE QUOTE NEVER GUESSES A HEADCOUNT (supplier walk on production, 13 Nov 2026). The event had no guest list and no
 * count from the couple, and the quote maker opened at "100 pax" — `requestedPax={thread.pax_at_inquiry ?? headerPax ??
 * 100}`. Owner rule: never guess a number. With no count at all the headcount starts EMPTY and the supplier types it.
 * The couple's own estimate is already in `headerPax` (`resolveLivePax` = max(`events.estimated_pax`, headcount)), so
 * nothing new is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const MAKER = read('app/_components/proposal-maker.tsx');

test('the thread page hands the maker no invented count', () => {
  const m = PAGE.match(/requestedPax=\{([^}]*)\}/);
  assert.ok(m, 'the maker is no longer handed requestedPax');
  assert.doesNotMatch(m![1]!, /\?\?\s*\d/, `a guessed default is back: ${m![1]}`);
  assert.match(m![1]!, /\?\?\s*null\s*$/);
});

test('with no count the maker starts EMPTY and asks the supplier to type it', () => {
  assert.match(MAKER, /requestedPax: number \| null;/);
  assert.match(MAKER, /const theirCount: number \| null = livePax \?\? requestedPax \?\? null;/);
  assert.match(MAKER, /const noList = theirCount === null;/);
  // The headcount field is blank, not 0 and not a guess…
  assert.match(MAKER, /value=\{noList && minPax === 0 \? '' : minPax\}/);
  // …and it says what to do.
  assert.match(MAKER, /'type how many guests to quote for'/);
  // Their list reads "—", never a number nobody gave.
  assert.match(MAKER, /\{noList \? '—' : formatCount\(seedPax\)\}/);
});
