/**
 * brand-words.test.ts — "papic" in a message reads "Papic" (owner, live iPhone
 * review 2026-10-04, the removal notice an admin typed by hand) — and nothing
 * that looks like an address is touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandWords } from '@/lib/brand-words';

test('the word papic is spelled Papic, in any case', () => {
  assert.equal(
    brandWords('none of your papic credit has been used'),
    'none of your Papic credit has been used',
  );
  assert.equal(brandWords('PAPIC credits. papic!'), 'Papic credits. Papic!');
  assert.equal(brandWords('Papic stays Papic'), 'Papic stays Papic');
  assert.equal(brandWords('(papic), "papic"'), '(Papic), "Papic"');
});

test('an address, a link or a longer word is left exactly as typed', () => {
  for (const s of [
    'https://x.com/?ref=papic#papic',
    'x.com/?ref=papic',
    'a?x=papic',
    'see#papic',
    'a&papic',
    'setnayan.com/papic',
    'papic.setnayan.com',
    'papic-seat',
    'papics',
    'mypapic',
    'a@papic',
    'ftp://papic',
  ]) {
    assert.equal(brandWords(s), s, `"${s}" was rewritten`);
  }
  assert.equal(
    brandWords('open https://x.com/?ref=papic#papic for your papic photos'),
    'open https://x.com/?ref=papic#papic for your Papic photos',
  );
});

test('the text round-trips — spacing and line breaks are kept', () => {
  const s = 'one  papic\n\ttwo';
  assert.equal(brandWords(s), 'one  Papic\n\ttwo');
});
