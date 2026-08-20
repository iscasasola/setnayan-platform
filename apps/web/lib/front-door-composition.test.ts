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
  FRONT_DOOR_CHIPS,
  isChip,
  selectShelf,
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
   ONE SHELF, TWO AUTHORS — the four chips.

   These exist because nothing tested them. The chip rule lived in three
   ternaries inside an async server component's JSX, where the only symptom of
   a break is a visitor picking a chip and finding an empty page that looks
   exactly like a quiet week.
   ══════════════════════════════════════════════════════════════════════════ */

type A = { slug: string };
type S = { href: string; hasVideo: boolean };

const ARTICLES: A[] = [{ slug: 'a1' }, { slug: 'a2' }, { slug: 'a3' }];
const STORIES: S[] = [
  { href: '/s/youtube', hasVideo: true },
  // 🔑 A CHAPTER WHOSE VIDEO IS NOT ON YOUTUBE. It has a video and no
  // derivable thumbnail — the exact row the first cut dropped by reading
  // `Boolean(thumbUrl)` instead of the loader's `hasVideo`.
  { href: '/s/tiktok', hasVideo: true },
  { href: '/s/written', hasVideo: false },
];

test('ANCHOR — the shelf has exactly the owner-named chips, in order', () => {
  assert.deepEqual(
    [...FRONT_DOOR_CHIPS],
    ['All', 'Your people', 'Stories', 'Articles'],
    'The chip set and its ORDER are the owner\u2019s. "Your people" sits second ' +
      'because it is the one chip about the viewer rather than about a kind ' +
      'of piece (owner 2026-08-20).',
  );
  assert.equal(isChip('All'), true);
  assert.equal(isChip('Journal'), false, 'there is no Journal chip — one shelf');
  assert.equal(isChip(undefined), false);
});

test('All — both kinds are in the one shelf', () => {
  const r = selectShelf('All', ARTICLES, STORIES);
  assert.equal(r.articles.length, 3);
  assert.equal(r.stories.length, 3);
  assert.equal(r.empty, false);
});

test('Articles — our writing only, and no story leaks in', () => {
  const r = selectShelf('Articles', ARTICLES, STORIES);
  assert.equal(r.articles.length, 3);
  assert.equal(r.stories.length, 0, 'a story under the Articles chip is mislabelled');
});

test('Stories — theirs only, INCLUDING the ones with no video', () => {
  const r = selectShelf('Stories', ARTICLES, STORIES);
  assert.equal(r.articles.length, 0);
  assert.equal(r.stories.length, 3);
  assert.ok(
    r.stories.some((s) => !s.hasVideo),
    'a written chapter is still their story — dropping it is what emptied the ' +
      'storyteller shelf in the first place',
  );
});

test('RETIRED — "With video" is not a chip, and Marketplace never was', () => {
  /*
    ⛔ BOTH REFUSALS ARE PINNED HERE so neither is quietly re-added.

    "With video" was a MODIFIER on a story, not a KIND on the shelf — the one
    chip that was not parallel with its neighbours. Nothing was lost: every
    card still carries its own "▶ with video" badge, so a person can still SEE
    which have video; they simply cannot filter to them, on a shelf where zero
    do today.

    "Marketplace" is a different ROOM, not a kind of reading. It already has
    three doors — the shops rail below this shelf, the rail destination, and
    the search box's row — and it would be the only chip that NAVIGATES rather
    than FILTERS, which breaks this row's contract outright.
  */
  assert.equal(isChip('With video'), false, '"With video" came back as a chip');
  assert.equal(isChip('Marketplace'), false, '"Marketplace" was added as a chip');
  assert.equal(isChip('Their stories'), false, 'the old possessive label came back');

  /*
    🔑 AND THE SHELF MUST NOT ANSWER FOR THEM EITHER. A retired chip that still
    selects content is a URL that works with no way to reach it — a
    half-retirement, and exactly the kind that survives review because the
    visible half looks done.
  */
  const r = selectShelf('With video' as never, ARTICLES, STORIES);
  assert.equal(
    r.articles.length + r.stories.length,
    0,
    'A retired chip still selects content. Anything not in FRONT_DOOR_CHIPS ' +
      'must fall through to an empty shelf.',
  );
  assert.equal(r.empty, true);
});

test('a chip with nothing under it reports empty, so the page can say so', () => {
  // Today: 0 published chapters reach the public shelf.
  const r = selectShelf('Stories', ARTICLES, []);
  assert.equal(r.empty, true);
  // …but the writing is never empty, so All never is either.
  assert.equal(selectShelf('All', ARTICLES, []).empty, false);
});

test('selecting never mutates what it was given', () => {
  const stories = [...STORIES];
  selectShelf('Stories', ARTICLES, stories);
  assert.equal(stories.length, 3, 'the caller\'s array must survive a filter');
});

/* ── THE LEAD/TRAILING SPLIT ──────────────────────────────────────────────
   The rule: every article handed to the shelf is either in the lead grid or
   the trailing row, in order, with NOTHING skipped between them. */

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

/* ── "YOUR PEOPLE" — A NARROWING, AND IT MUST FAIL CLOSED ────────────────
   Owner 2026-08-20, having rejected his own word for it: *"your people - yes"*.

   The chip filters pieces the caller has ALREADY loaded and that every
   stranger can already see, down to the ones whose author the viewer already
   knows. Nothing here loads a story, which is the property that makes it safe
   — see `lib/your-people.ts`, which carries the same rule at the other end.

   The direction of failure is the whole design: this is a claim about who a
   person knows, so an unknown must read as "not yours", never as "yours". */
const PEOPLE_STORIES: Array<{
  href: string;
  hasVideo: boolean;
  fromYourPeople?: boolean;
}> = [
  { href: '/s/friend-video', hasVideo: true, fromYourPeople: true },
  { href: '/s/friend-written', hasVideo: false, fromYourPeople: true },
  { href: '/s/stranger', hasVideo: true, fromYourPeople: false },
  // The field absent entirely — a caller that has not computed it, or whose
  // read failed. Must be treated as NOT yours.
  { href: '/s/unknown', hasVideo: true },
];

test('Your people — only theirs, and written chapters count too', () => {
  const r = selectShelf('Your people', ARTICLES, PEOPLE_STORIES);
  assert.equal(
    r.articles.length,
    0,
    'Articles are OURS. A Setnayan guide has no author the viewer could know, ' +
      'so one appearing under this chip is mislabelled as a friend’s work.',
  );
  assert.deepEqual(
    r.stories.map((s) => s.href).sort(),
    ['/s/friend-video', '/s/friend-written'],
    'a friend’s chapter told purely in writing is still a friend’s chapter',
  );
});

test('Your people — an UNKNOWN author is not your friend (fails closed)', () => {
  const r = selectShelf('Your people', ARTICLES, [
    { href: '/s/unknown', hasVideo: true },
  ]);
  assert.equal(
    r.stories.length,
    0,
    'A story with no `fromYourPeople` was admitted. A missing flag means the ' +
      'caller has not computed it or its read FAILED — and inventing `true` ' +
      'tells a person that a stranger is somebody they know.',
  );
  assert.equal(r.empty, true, 'and the page must then show its written invitation');
});

test('Your people NARROWS the shelf — it can never add a story', () => {
  const all = selectShelf('All', ARTICLES, PEOPLE_STORIES);
  const mine = selectShelf('Your people', ARTICLES, PEOPLE_STORIES);
  const allHrefs = new Set(all.stories.map((s) => s.href));
  for (const s of mine.stories) {
    assert.ok(
      allHrefs.has(s.href),
      `${s.href} appears under "Your people" but not under "All" — this chip ` +
        'is a FILTER over the public shelf. If it can add a piece, it can add ' +
        'a private one, and the safety argument for the whole feature is gone.',
    );
  }
  assert.ok(mine.stories.length <= all.stories.length);
});

test('Your people — nobody yet is EMPTY, not a fallback to everyone', () => {
  const r = selectShelf('Your people', ARTICLES, [
    { href: '/s/stranger', hasVideo: true, fromYourPeople: false },
  ]);
  assert.equal(
    r.stories.length,
    0,
    'An empty result must stay empty. Falling back to the full shelf would ' +
      'label strangers as the viewer’s people — worse than showing nothing.',
  );
  assert.equal(r.empty, true);
});
