/**
 * GUARD — the front door must never tell a lie about how full it is.
 *
 * Two failure directions, and they are NOT symmetric:
 *
 *   • Overclaiming — a "Trending" heading over one shop, or a ranking implied
 *     where none is earned. This page's own rule is that trending is EARNED,
 *     NEVER SOLD. Overclaiming is the worse direction: it is the page lying.
 *   • Underclaiming — hiding a rail that has real content in it, so somebody's
 *     published work never appears.
 *
 * Both are asserted, at the exact thresholds and on both sides of each.
 *
 * 🔑 THE NUMBERS THIS WAS BUILT AGAINST, measured on prod 2026-08-13 (NOT read
 * from a document — the document's own table was one day stale and already
 * wrong about one rail): 1 published chapter · 33 published articles · 0
 * published stories · 1 live shop. The chapter count moved 0 → 1 when Session 2
 * shipped, which flips the storyteller rail from absent to present. That is
 * exactly why the thresholds live in code with a test, instead of a launch-day
 * shape hard-coded from a table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeFrontDoor,
  TRENDING_MIN_LIVE_SHOPS,
  STORIES_MIN_PUBLISHED,
  STORYTELLER_MIN_CHAPTERS,
  type FrontDoorCounts,
} from './front-door-composition';

/** Prod, measured 2026-08-13. */
const TODAY: FrontDoorCounts = { chapters: 1, articles: 33, stories: 0, liveShops: 1 };

test('ANCHOR — the thresholds are the owner-visible numbers, not drifted', () => {
  // If someone changes one of these, they are changing product policy and this
  // test is where they get told, rather than a customer noticing.
  assert.equal(TRENDING_MIN_LIVE_SHOPS, 12, 'the "Trending" threshold is the owner\'s number');
  assert.equal(STORIES_MIN_PUBLISHED, 2);
  assert.equal(STORYTELLER_MIN_CHAPTERS, 1);
});

test("today's real numbers produce an honest page", () => {
  const c = composeFrontDoor(TODAY);
  assert.equal(c.storytellers, 'grid', 'a published chapter exists — the rail must be real');
  assert.equal(c.articles, 'grid');
  assert.equal(c.stories, 'invitation', '0 published stories must invite, never show an empty grid');
  assert.equal(c.shops, 'grid', 'one live shop is still a real shop');
  assert.equal(
    c.shopsHeading,
    'first-shops',
    'ONE shop must never be headed "Trending" — trending is earned, never sold',
  );
});

test('"Trending" is refused everywhere below the threshold — the whole range', () => {
  for (let shops = 1; shops < TRENDING_MIN_LIVE_SHOPS; shops++) {
    const c = composeFrontDoor({ ...TODAY, liveShops: shops });
    assert.notEqual(
      c.shopsHeading,
      'trending',
      `${shops} live shop(s) produced a "Trending" heading — a ranking over ${shops} is noise wearing the clothes of merit`,
    );
  }
});

test('"Trending" returns exactly at the threshold and above', () => {
  const at = composeFrontDoor({ ...TODAY, liveShops: TRENDING_MIN_LIVE_SHOPS });
  assert.equal(at.shopsHeading, 'trending');
  const above = composeFrontDoor({ ...TODAY, liveShops: TRENDING_MIN_LIVE_SHOPS + 40 });
  assert.equal(above.shopsHeading, 'trending');
});

test('an empty shelf is never rendered as an empty grid', () => {
  const empty = composeFrontDoor({ chapters: 0, articles: 0, stories: 0, liveShops: 0 });
  assert.equal(empty.storytellers, 'absent', 'no chapters → the rail leaves, it does not sit empty');
  assert.equal(empty.articles, 'absent');
  assert.equal(empty.stories, 'invitation', 'an invitation, never a zero');
  assert.equal(empty.shops, 'invitation');
  assert.equal(empty.shopsHeading, 'none', 'no shops → no ranking word at all');
});

test('a rail with real content is never hidden — the other failure direction', () => {
  const full = composeFrontDoor({ chapters: 4, articles: 33, stories: 9, liveShops: 30 });
  assert.equal(full.storytellers, 'grid');
  assert.equal(full.stories, 'grid');
  assert.equal(full.shops, 'grid');
  assert.equal(full.shopsHeading, 'trending');
  assert.equal(full.articlesCarryThePage, false, 'with everything full, the writing is not carrying it alone');
});

test('the storyteller rail flips at exactly one chapter — the number that moved', () => {
  assert.equal(composeFrontDoor({ ...TODAY, chapters: 0 }).storytellers, 'absent');
  assert.equal(composeFrontDoor({ ...TODAY, chapters: 1 }).storytellers, 'grid');
});

test('the stories shelf flips at exactly two', () => {
  assert.equal(composeFrontDoor({ ...TODAY, stories: 1 }).stories, 'invitation');
  assert.equal(composeFrontDoor({ ...TODAY, stories: 2 }).stories, 'grid');
});

test('a failed read can never promote a rail', () => {
  // A read that errors commonly surfaces as 0, -1 or NaN. None of them may be
  // able to turn a shelf on, or a database blip publishes an empty grid.
  for (const bad of [-1, -999, Number.NaN, Number.POSITIVE_INFINITY * 0]) {
    const c = composeFrontDoor({ chapters: bad, articles: bad, stories: bad, liveShops: bad });
    assert.equal(c.storytellers, 'absent', `chapters=${bad} promoted the rail`);
    assert.equal(c.shopsHeading, 'none', `liveShops=${bad} produced a heading`);
    assert.equal(c.stories, 'invitation');
  }
});

test('when only the writing is full, the page knows the writing carries it', () => {
  // Today's real shape has a chapter too, so this is the 12-Aug state — kept
  // because it is the state the page will fall back to if that chapter is
  // unpublished, and the grid must re-compose rather than break.
  const c = composeFrontDoor({ chapters: 0, articles: 33, stories: 0, liveShops: 0 });
  assert.equal(c.articlesCarryThePage, true);
  assert.equal(c.storytellers, 'absent');
});
