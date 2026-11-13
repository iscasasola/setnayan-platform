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
 * THE WAKE'S RECAP GATE — now: THERE IS NO RECAP PAGE TO GATE.
 *
 * `/[slug]/recap` used to render its own page, and needed both a metadata arm and a render arm reading `.solemn` so a
 * wake never had one. On 2026-11-13 the owner folded it into the Post Event story (DECISION_LOG "POST EVENT = A STORY
 * (ONE SCENE PER SCREEN) — SIX CALLS SETTLED" (5)): the route only sends to `/{slug}`, whose own gates decide what a
 * wake shows. So the guard is the stronger claim — the route renders NOTHING of its own: no metadata, no page, only
 * the redirect. A recap page growing back would have to grow its own solemn gate with it.
 */
test('the recap route renders nothing of its own — it only sends to the story', () => {
  const stripped = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/recap/page.tsx'), 'utf8'));
  assert.ok(/redirect\(`\/\$\{encodeURIComponent\(slug\)\}`\)/.test(stripped), 'the recap route must send to the story at /{slug}');
  assert.equal(/generateMetadata/.test(stripped), false, 'a recap route with its own metadata is a page again — and needs its solemn gate back');
  assert.equal(/<\/|\/>/.test(stripped), false, 'the recap route draws markup again — a wake would have a recap page');
});
