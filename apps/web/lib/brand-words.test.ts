/**
 * brand-words.test.ts — "papic" in a message reads "Papic" (owner, live iPhone
 * review 2026-10-04, the removal notice an admin typed by hand).
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
});

test('an address or a longer word is left alone — a link in a message still works', () => {
  for (const s of ['setnayan.com/papic', 'papic.setnayan.com', 'papic-seat', 'papics', 'mypapic', 'a@papic']) {
    assert.equal(brandWords(s), s, `"${s}" was rewritten`);
  }
});
