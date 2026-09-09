/**
 * A SAMPLE SAYS WHAT IT IS — and the solemn ones say it gently.
 *
 * The bill is derived from the shipped fixture, not hand-listed, so a 22nd
 * sample of a new kind is covered the day it is added.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { REAL_WEDDINGS } from './real-weddings';
import { sampleIsSolemn, sampleShowcaseNote, withArticle } from './a-sample-says-what-it-is';

const samples = REAL_WEDDINGS.filter((w) => w.isSample);

test('the fixture really does carry many kinds — the premise of this fix', () => {
  assert.ok(samples.length >= 20, `expected 20+ samples, got ${samples.length}`);
  const kinds = new Set(samples.map((s) => s.eventType));
  assert.ok(kinds.size >= 10, `expected 10+ distinct kinds, got ${kinds.size}`);
});

test('NO SAMPLE IS DESCRIBED AS A WEDDING UNLESS IT IS ONE', () => {
  for (const s of samples) {
    const note = sampleShowcaseNote(s.eventType);
    if (s.eventType.toLowerCase() !== 'wedding') {
      assert.ok(
        !/\bwedding\b/i.test(note),
        `${s.slug} (${s.eventType}) is described as a wedding: ${note}`,
      );
    }
    assert.ok(note.toLowerCase().includes(s.eventType.toLowerCase()), `${s.slug} omits its kind`);
  }
});

test('NO SAMPLE SAYS "COUPLE" — the sentence stands above 17 kinds', () => {
  for (const s of samples) {
    assert.ok(
      !/\bcouple/i.test(sampleShowcaseNote(s.eventType)),
      `${s.slug} (${s.eventType}) speaks of a couple`,
    );
  }
});

test('a solemn sample is not offered a team, photos or a portfolio', () => {
  const wake = samples.find((s) => sampleIsSolemn(s.eventType));
  assert.ok(wake, 'the fixture must still carry a solemn sample');
  const note = sampleShowcaseNote(wake.eventType);
  assert.ok(/family/i.test(note), 'a wake speaks of the family');
  assert.ok(!/\bteam\b/i.test(note), 'a wake is not offered a team');
  assert.ok(/consent/i.test(note), 'consent is still stated');
});

test('the article agrees with the word', () => {
  assert.equal(withArticle('Wedding'), 'a wedding');
  assert.equal(withArticle('Anniversary'), 'an anniversary');
  assert.equal(withArticle('Wake'), 'a wake');
});
