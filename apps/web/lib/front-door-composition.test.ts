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
 *
 * ─── 2026-09-03 — THE CHIP TESTS BELOW THIS ARE RETIRED, NOT MOVED ──────────
 * The front door dropped its chip bar (All / Your people / Stories / Articles)
 * along with the group-chat hero, replaced by a category-anchor strip and a
 * New uploads / Trending / Shops structure — see `front-door-feed.tsx`.
 * `FRONT_DOOR_CHIPS`, `isChip` and `selectShelf` are deleted from the module
 * they guarded; their tests go with them rather than testing code that no
 * longer exists. `composeFrontDoor` and `splitShelfRows` are UNCHANGED and
 * keep their tests verbatim below. `selectTrendingChapters` is new.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeFrontDoor,
  TRENDING_MIN_LIVE_SHOPS,
  STORIES_MIN_PUBLISHED,
  STORYTELLER_MIN_CHAPTERS,
  selectTrendingChapters,
  splitShelfRows,
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

/* ═══════════════════════════════════════════════════════════════════════════
   TRENDING — chapters ranked by real views, no new "earned" threshold.
   ══════════════════════════════════════════════════════════════════════════ */

type Story = { kind: 'chapter' | 'editorial'; href: string; viewCount: number | null };

test('Trending ranks chapters by view count, highest first', () => {
  const stories: Story[] = [
    { kind: 'chapter', href: '/c/low', viewCount: 10 },
    { kind: 'chapter', href: '/c/high', viewCount: 900 },
    { kind: 'chapter', href: '/c/mid', viewCount: 250 },
  ];
  const trending = selectTrendingChapters(stories);
  assert.deepEqual(
    trending.map((s) => s.href),
    ['/c/high', '/c/mid', '/c/low'],
  );
});

test('Trending never admits an editorial — editorials carry no view count by design', () => {
  const stories: Story[] = [
    { kind: 'chapter', href: '/c/one', viewCount: 5 },
    // An editorial with a non-null viewCount should be structurally impossible
    // (front-door-editorials.ts always sets it to `null`), but the filter
    // checks `kind` FIRST specifically so a bad viewCount can never sneak an
    // editorial onto a shelf that promises "chapters, ranked by real views".
    { kind: 'editorial', href: '/e/one', viewCount: 999 },
  ];
  const trending = selectTrendingChapters(stories);
  assert.deepEqual(trending.map((s) => s.href), ['/c/one']);
});

test('Trending drops a chapter with no real view count rather than treating null as zero', () => {
  const stories: Story[] = [
    { kind: 'chapter', href: '/c/counted', viewCount: 3 },
    { kind: 'chapter', href: '/c/uncounted', viewCount: null },
  ];
  const trending = selectTrendingChapters(stories);
  assert.deepEqual(
    trending.map((s) => s.href),
    ['/c/counted'],
    'a null view count is "we don’t know", not "zero views" — ranking it in would be a guess',
  );
});

test('Trending is honestly empty when nothing has earned a spot — not padded', () => {
  const trending = selectTrendingChapters([]);
  assert.deepEqual(trending, []);
});

test('Trending respects its limit', () => {
  const stories: Story[] = Array.from({ length: 20 }, (_, i) => ({
    kind: 'chapter' as const,
    href: `/c/${i}`,
    viewCount: i,
  }));
  assert.equal(selectTrendingChapters(stories).length, 6, 'default limit is 6');
  assert.equal(selectTrendingChapters(stories, 3).length, 3);
});

test('Trending never mutates what it was given', () => {
  const stories: Story[] = [
    { kind: 'chapter', href: '/c/a', viewCount: 1 },
    { kind: 'chapter', href: '/c/b', viewCount: 2 },
  ];
  const before = [...stories];
  selectTrendingChapters(stories);
  assert.deepEqual(stories, before, 'the caller\'s array must survive ranking');
});

/* ── THE LEAD/TRAILING SPLIT ──────────────────────────────────────────────
   The rule: every article handed to the shelf is either in the lead grid or
   the trailing row, in order, with NOTHING skipped between them. */

type A = { slug: string };
type S = { href: string; hasVideo: boolean };

/** Articles a0…a11, so a skipped one is identifiable by name. */
const TWELVE: A[] = Array.from({ length: 12 }, (_, i) => ({ slug: `a${i}` }));

function renderedSlugs(stories: S[], articles: A[]): string[] {
  const r = splitShelfRows(stories, articles);
  return [...r.leadArticles, ...r.trailingArticles].map((a) => a.slug);
}

test('no story — the lead grid takes four and the rest follows contiguously', () => {
  const r = splitShelfRows([], TWELVE);
  assert.equal(r.leadStories.length, 0);
  assert.deepEqual(r.leadArticles.map((a) => a.slug), ['a0', 'a1', 'a2', 'a3']);
  // Byte-identical to the shipped slice(4, 12) on today's real numbers.
  assert.deepEqual(
    r.trailingArticles.map((a) => a.slug),
    ['a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
  );
});

test('THE REGRESSION — four stories must not make two articles vanish', () => {
  const stories: S[] = Array.from({ length: 4 }, (_, i) => ({
    href: `/s/${i}`,
    hasVideo: false,
  }));
  const shown = renderedSlugs(stories, TWELVE);
  // The lead grid is all stories, so the writing starts at the very first one.
  assert.equal(shown[0], 'a0', 'the trailing row must start where the lead stopped');
  for (const missing of ['a2', 'a3']) {
    assert.ok(
      shown.includes(missing),
      `${missing} rendered nowhere — this is the hard-coded slice(4, …) bug`,
    );
  }
});

test('nothing is skipped at ANY story count — the whole range', () => {
  for (let n = 0; n <= 6; n++) {
    const stories: S[] = Array.from({ length: n }, (_, i) => ({
      href: `/s/${i}`,
      hasVideo: false,
    }));
    const shown = renderedSlugs(stories, TWELVE);
    const expected = TWELVE.slice(0, shown.length).map((a) => a.slug);
    assert.deepEqual(
      shown,
      expected,
      `${n} stories: the rendered articles must be an unbroken run from the start`,
    );
  }
});

test('the lead grid never exceeds four across, whatever it is fed', () => {
  for (let n = 0; n <= 8; n++) {
    const stories: S[] = Array.from({ length: n }, (_, i) => ({
      href: `/s/${i}`,
      hasVideo: false,
    }));
    const r = splitShelfRows(stories, TWELVE);
    assert.ok(
      r.leadStories.length + r.leadArticles.length <= 4,
      `${n} stories overflowed the lead grid`,
    );
  }
});

test('an empty shelf splits into empty rows rather than throwing', () => {
  const r = splitShelfRows([], []);
  assert.deepEqual(r, { leadStories: [], leadArticles: [], trailingArticles: [] });
});
