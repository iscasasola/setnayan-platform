/**
 * the-front-page-carries-real-stories.test.ts
 *
 * Holds `lib/front-door-editorials.ts` — the mapping that finally puts a
 * published editorial on the home page's shelf, after the front door spent its
 * whole life LOADING those rows (`loadPublishedShowcases(24)`) and discarding
 * everything but their count.
 *
 * 🔑 WHY THESE ARE REAL ASSERTIONS AND NOT A REGEX OVER A RENDERER. The rules
 * below are about what the front page CLAIMS — that a sample is never passed
 * off as somebody's real celebration, that a byline never links to a page that
 * 404s, that "your people" never invents a friendship. `data.ts` is
 * `server-only` and DB-bound, so a rule living inside it could only ever be
 * checked by pattern-matching its source. Pure module, real assertions.
 *
 * Every assertion here was mutation-proved: the named mutation was applied to
 * `front-door-editorials.ts`, this file was run, and the test named beside it
 * FAILED. An assertion nobody has watched fail is a decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  editorialsToStories,
  EDITORIAL_KIND_LABEL,
  type EditorialSource,
} from './front-door-editorials';


/**
 * Index into the result while PROVING the row is there.
 *
 * ⚠ NOT A `!`. `noUncheckedIndexedAccess` is on, and silencing it with a
 * non-null assertion would turn "the mapper returned nothing" into a crash
 * three lines later instead of a named failure here — the difference between a
 * test that reports and a test that explodes.
 */
function at<T>(rows: readonly T[], i: number): T {
  const row = rows[i];
  assert.ok(row !== undefined, `expected a row at index ${i}, got ${rows.length} row(s)`);
  return row;
}

/** A real, consented, published editorial — the thing this feature exists for. */
function realEditorial(over: Partial<EditorialSource> = {}): EditorialSource {
  return {
    href: '/kian-at-bea',
    coupleNames: 'Kian & Bea',
    heroImageUrl: 'https://img.example/hero.jpg',
    heroVideoUrl: null,
    isSample: false,
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The defect this closes
// ─────────────────────────────────────────────────────────────────────────────

test('a published editorial reaches the shelf at all — the whole point', () => {
  const out = editorialsToStories([realEditorial()]);
  assert.equal(out.length, 1, 'a real consented editorial must become a card');
  assert.equal(at(out, 0).href, '/kian-at-bea');
  assert.equal(
    at(out, 0).title,
    'Kian & Bea',
    "the card leads with the couple's own names",
  );
});

test('the empty state is empty, not invented', () => {
  // MUTATION: return a placeholder row when the list is empty → this fails.
  assert.deepEqual(editorialsToStories([]), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// What the front page may CLAIM
// ─────────────────────────────────────────────────────────────────────────────

test('a SAMPLE never reaches the front page', () => {
  // MUTATION: drop the `.filter((s) => !s.isSample)` → this fails.
  // Why it matters: /realstories shows the sample behind an honest "Sample"
  // badge; the front page has no such badge and would be presenting a staged
  // celebration as somebody's real day.
  const out = editorialsToStories([realEditorial({ isSample: true })]);
  assert.deepEqual(out, [], 'the curated sample must never become a front-page card');
});

test('a sample is dropped from a MIXED list without taking the real one with it', () => {
  const out = editorialsToStories([
    realEditorial({ isSample: true, href: '/sample', coupleNames: 'Maria & Jose' }),
    realEditorial({ href: '/real', coupleNames: 'Kian & Bea' }),
  ]);
  assert.equal(out.length, 1, 'exactly the real one survives');
  assert.equal(at(out, 0).href, '/real');
  /*
    The precise failure a `.find`-shaped filter would cause: keeping the FIRST
    row rather than the non-sample one.

    🪤 THIS LINE READ `out[0].coupleNames` UNTIL TYPECHECK CAUGHT IT. That field
    is on the INPUT (`EditorialSource`), not the output — so it evaluated to
    `undefined`, `undefined !== 'Maria & Jose'` was trivially true, and the
    assertion could never fail. Green, and testing nothing. The mapper renames
    it to `title`/`ownerName`, which is what must actually be checked.
  */
  assert.notEqual(at(out, 0).title, 'Maria & Jose');
  assert.equal(at(out, 0).ownerName, 'Kian & Bea');
});

// ─────────────────────────────────────────────────────────────────────────────
// The byline that must not 404
// ─────────────────────────────────────────────────────────────────────────────

test("an editorial's byline is never a door — ownerSlug is null", () => {
  // MUTATION: set `ownerSlug: s.href.slice(1)` (or any string) → this fails.
  //
  // THE BUG THIS PREVENTS: the card's `ChannelLink` renders `/u/{slug}` for a
  // non-null slug. A showcase passes `users.public_summary_consent_at`, NOT
  // `public_profile_enabled` — a different column, `DEFAULT FALSE`, and the one
  // that makes `/u/{slug}` render at all. So a couple can consent to their
  // editorial being public while having no public profile page, and a slug here
  // would put a 404 on the FRONT PAGE for the first real couple who consents.
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.ownerSlug, null);
  // The name is still carried — null means "print it", never "hide it".
  assert.equal(story.ownerName, 'Kian & Bea');
});

test('"your people" fails closed on an editorial', () => {
  // MUTATION: `fromYourPeople: true` → this fails.
  // It is a claim about who somebody knows, resolved from PUBLIC PROFILE slugs
  // — the very thing an editorial's author may not have. There is nothing to
  // match on, so the honest answer is false.
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.fromYourPeople, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// The card's own fields
// ─────────────────────────────────────────────────────────────────────────────

test('hasVideo comes from the CLIP, never from the poster', () => {
  // MUTATION: `hasVideo: s.heroImageUrl !== null` → this fails on both rows.
  // The #4402 bug, which `data.ts` already carries two warnings about.
  const stillOnly = at(editorialsToStories([
    realEditorial({ heroImageUrl: 'https://img.example/h.jpg', heroVideoUrl: null }),
  ]), 0);
  assert.equal(stillOnly.hasVideo, false, 'a hero STILL is not a video');

  const clipNoStill = at(editorialsToStories([
    realEditorial({ heroImageUrl: null, heroVideoUrl: 'https://v.example/c.mp4' }),
  ]), 0);
  assert.equal(clipNoStill.hasVideo, true, 'a clip with no poster still has video');
});

test('no excerpt is invented for a couple', () => {
  // MUTATION: `excerpt: \`A wedding in ${...}\`` → this fails.
  // Synthesising an opening line would put words on the front page that the
  // couple never wrote about their own wedding.
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.excerpt, null);
});

test('no reading time is guessed', () => {
  // MUTATION: `readingMinutes: 3` → this fails. "No minutes rather than a guess."
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.readingMinutes, null);
});

test('the poster is carried through, and null stays null', () => {
  const withHero = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(withHero.thumbUrl, 'https://img.example/hero.jpg');
  const noHero = at(editorialsToStories([realEditorial({ heroImageUrl: null })]), 0);
  assert.equal(noHero.thumbUrl, null, 'the card falls back to its own treatment');
});

// ─────────────────────────────────────────────────────────────────────────────
// The label — the bug that would only show on a non-wedding
// ─────────────────────────────────────────────────────────────────────────────

test('the kind label carries no wedding word', () => {
  // MUTATION: `EDITORIAL_KIND_LABEL = 'Wedding'` → this fails.
  //
  // `showcase-db.ts` carries a 🔴 note that this covers EVERY kind of
  // celebration, and records that five `.eq('event_type','wedding')` filters
  // were deleted from it in 2026-08 because they refused a debut, a
  // graduation, a christening or a reunion an editorial outright. A wedding
  // word here re-introduces that bug at the most visible surface there is —
  // and it would look CORRECT on every wedding, which is why a test says it.
  assert.doesNotMatch(
    EDITORIAL_KIND_LABEL,
    /wedding|bride|groom|couple/i,
    'the front page must not call a graduation a wedding',
  );
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.kindLabel, EDITORIAL_KIND_LABEL);
});

test('the card can say which kind it is — the one-shelf rule', () => {
  // The shelf does not split; the CARD says which kind it is (owner
  // 2026-08-12). That is only possible if the discriminant survives the map.
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(story.kind, 'editorial');
});

// ─────────────────────────────────────────────────────────────────────────────
// The shelf's own contract
// ─────────────────────────────────────────────────────────────────────────────

test('an editorial satisfies what selectShelf requires of a story', () => {
  // `selectShelf` is generic over `{ hasVideo: boolean; fromYourPeople?: boolean }`.
  // If this shape ever stops satisfying it, the editorials silently stop
  // reaching the shelf — with no type error at the call site, because the
  // generic would just infer a wider S.
  const story = at(editorialsToStories([realEditorial()]), 0);
  assert.equal(typeof story.hasVideo, 'boolean');
  assert.equal(typeof story.fromYourPeople, 'boolean');
});

test('order is preserved — the loader already returns featured-first', () => {
  // MUTATION: `.reverse()` or a sort → this fails.
  // An admin pinning a story to the top of /realstories must mean the same
  // thing on the front page; re-sorting here would silently overrule the editor.
  const out = editorialsToStories([
    realEditorial({ href: '/first' }),
    realEditorial({ href: '/second' }),
    realEditorial({ href: '/third' }),
  ]);
  assert.deepEqual(
    out.map((s) => s.href),
    ['/first', '/second', '/third'],
  );
});
