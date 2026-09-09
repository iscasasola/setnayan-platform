/**
 * A SAMPLE SAYS WHAT IT IS — and the solemn ones say it gently.
 *
 * The bill is derived from the shipped fixture, not hand-listed, so a 22nd
 * sample of a new kind is covered the day it is added.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { stripComments } from './strip-comments';

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

/**
 * THE WAKE'S RECAP GATE — asserted on the ROUTE, because it cannot be reached
 * any other way.
 *
 * `/[slug]/recap` is a Server Component whose gate is two `await`s and a
 * `notFound()`; there is no exported function to call. So this reads the file
 * and requires BOTH arms — the metadata arm that stops it being indexed, and
 * the render arm that stops it being served. Gating one alone is how a page
 * comes to be reachable while claiming not to exist.
 *
 * ⚠ A SOURCE-TEXT GUARD IS THE WEAK KIND, and it is used here knowingly: it
 * would pass a gate that reads `.solemn` and does nothing with it. It is here to
 * stop the gate being DELETED — which is what happened to the belief that it
 * existed at all — not to prove it works. The behaviour is proven by the
 * refusal in the route itself.
 */
test('the recap route refuses a solemn register in BOTH arms', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/[slug]/recap/page.tsx'),
    'utf8',
  );
  // ONE comment stripper in this repo — `lint-one-comment-stripper` caught this
  // file growing a second, AFTER the guard sweep had already passed. A guard run
  // before the last edit proves nothing about the last edit.
  const stripped = stripComments(src);
  const hits = (stripped.match(/\.solemn/g) || []).length;
  assert.ok(
    hits >= 2,
    `expected the metadata arm AND the render arm to read .solemn, found ${hits}`,
  );
  assert.ok(
    /solemn\)\s*notFound\(\)/.test(stripped.replace(/\s+/g, ' ')) ||
      /notFound\(\)/.test(stripped),
    'the render arm must actually refuse',
  );
});
