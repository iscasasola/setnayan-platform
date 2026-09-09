/**
 * A TAP FROM THE STORY — guards.
 *
 * Each assertion is a way the attribution could lie: inventing a `src` the
 * receiving side discards, writing a campaign for a story that cannot name
 * itself, rendering a link for a supplier who has no profile, or letting copy
 * promise identity the analytics model forbids.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { stripComments } from './strip-comments';

import {
  REACH_MUST_NEVER_SAY,
  REACH_SENTENCE,
  STORY_TAP_SRC,
  storyTapHref,
} from './a-tap-from-the-story';

test('it reuses `editorial` — the receiving side DISCARDS anything else', () => {
  assert.equal(STORY_TAP_SRC, 'editorial');
  const href = storyTapHref('kubo-films', 'ana-and-marco');
  assert.ok(href);
  assert.ok(href.includes('src=editorial'), href);
  assert.ok(!href.includes('src=story'), 'inventing src=story silently loses the attribution');
});

test('the campaign names the story', () => {
  const href = storyTapHref('kubo-films', 'ana-and-marco');
  assert.ok(href && href.includes(encodeURIComponent('story:ana-and-marco')), href);
});

test('a story that cannot name itself still attributes — and never writes "story:null"', () => {
  const href = storyTapHref('kubo-films', null);
  assert.ok(href);
  assert.ok(href.includes('src=editorial'), 'attribution survives');
  assert.ok(!/utm=/.test(href), 'no campaign rather than a poisoned one');
  assert.ok(!/null/.test(href), href);
});

test('a supplier with no marketplace profile gets NO href — never a dead link', () => {
  assert.equal(storyTapHref(null, 'ana-and-marco'), null);
  assert.equal(storyTapHref('', 'ana-and-marco'), null);
});

test('nothing in the reach copy promises identity', () => {
  for (const forbidden of REACH_MUST_NEVER_SAY) {
    assert.ok(
      !REACH_SENTENCE.toLowerCase().includes(forbidden),
      `the reach sentence promises identity: "${forbidden}"`,
    );
  }
  assert.ok(/how many/i.test(REACH_SENTENCE));
});

/**
 * 🔒 THE TIER BOUNDARY THE OWNER LOCKED: paying changes HOW RICHLY a supplier is
 * credited, never WHETHER. The story credits every supplier by name; only the
 * paid tiers carry a LINK out. This guard exists because the obvious "improve"
 * — making every credit clickable — would quietly move that line, and it would
 * look like a kindness.
 */
test('the story does not link every credit — only the tiers that already carried one', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/[slug]/_components/editorial/editorial-content.tsx'),
    'utf8',
  );
  // ONE comment stripper in this repo, and `lint-one-comment-stripper` caught
  // this file growing a second. A hand-rolled one disagrees with the shared one
  // at exactly the edges that matter — a `*/` inside a string, a URL's `//`.
  const stripped = stripComments(src);
  assert.ok(
    /featured\s*&&\s*tapHref\s*\?/.test(stripped),
    'the link must stay gated on the tier predicate AND on having an href',
  );
});
