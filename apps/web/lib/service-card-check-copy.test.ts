/**
 * What the supplier reads when a card cannot be created yet — the approved v2 prototype's words, and three
 * properties: no accusing word, never another shop's name, the server says what the maker says.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStatusLine, problemCopy, quotedList, refusalSentence } from './service-card-check-copy';
import type { CardProblem } from './service-card-checks';

const ALL: CardProblem[] = [
  { code: 'service', row: 'offer', filedLabel: 'Church wedding', matched: 'catering', matchedLabel: 'Catering', words: ['catering'] },
  { code: 'words', row: 'name', hits: ['guaranteed', '#1'] },
  { code: 'photo', row: 'photos', ref: 'r', which: 'cover', answer: { status: 'other_card', flagId: 3, reported: false } },
  { code: 'photo', row: 'photos', ref: 'r', which: 'cover', answer: { status: 'other_card', flagId: 3, reported: true } },
  { code: 'photo', row: 'photos', ref: 'r', which: 'cover', answer: { status: 'own_card', serviceId: 's', title: 'Buffet catering · Tita Nena’s' } },
  { code: 'photo', row: 'photos', ref: 'r', which: 'cover', answer: { status: 'checking' } },
  { code: 'photo', row: 'photos', ref: 'r', which: 'cover', answer: { status: 'unavailable' } },
  { code: 'unavailable', row: 'status', checks: ['words'] },
];

test('the drawn words', () => {
  assert.equal(problemCopy(ALL[0]!).title, 'This reads like Catering, not Church wedding');
  assert.equal(problemCopy(ALL[0]!).line, 'Change the service above, or the name below.');
  assert.equal(problemCopy(ALL[1]!).title, '“Guaranteed” and “#1” read as a promise');
  assert.equal(problemCopy(ALL[2]!).title, 'This photo is already on another service card');
  assert.equal(problemCopy(ALL[3]!).title, 'Reported — thank you');
  assert.equal(problemCopy(ALL[4]!).title, 'Already on your card “Buffet catering · Tita Nena’s”');
  assert.equal(problemCopy(ALL[5]!).title, 'Checking the photo…');
  assert.deepEqual(checkStatusLine(2, false), { title: '2 things to fix before you can create', line: 'Tap to go to the first' });
  assert.equal(checkStatusLine(1, true)?.title, '1 thing to fix before you can save');
  assert.equal(checkStatusLine(0, false), null);
});

test('only an unreported photo on another shop’s card offers "It’s mine — report it"', () => {
  assert.deepEqual(problemCopy(ALL[2]!).report, { flagId: 3 });
  for (const p of [ALL[3]!, ALL[4]!, ALL[5]!]) assert.equal(problemCopy(p).report, undefined);
});

test('never an accusing word; never another shop', () => {
  const text = ALL.map((p) => `${problemCopy(p).title} ${problemCopy(p).line}`).join(' ');
  assert.doesNotMatch(text, /\b(flag|flagged|fraud|scam|violation|stolen|theft)\b/i);
});

test('the save refuses in the maker’s own words', () => {
  assert.equal(refusalSentence([ALL[1]!]), '“Guaranteed” and “#1” read as a promise. Say what you do instead — couples take these as guarantees we can’t stand behind.');
  assert.match(refusalSentence([ALL[7]!]) ?? '', /nothing was saved/);
  assert.equal(refusalSentence([]), null);
  assert.equal(quotedList(['a', 'b', 'c']), '“A”, “B” and “C”');
});
