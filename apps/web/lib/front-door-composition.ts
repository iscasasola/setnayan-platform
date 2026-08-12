/**
 * front-door-composition.ts — what the front door SHOWS at the counts it
 * actually has today.
 *
 * WHY THIS IS A MODULE AND NOT `if` STATEMENTS INSIDE THE PAGE. The whole
 * design problem of the front door is that on launch day it is nearly empty,
 * and the rule it must obey is **compose honestly rather than apologise four
 * times**. That is a decision with thresholds in it, and thresholds buried in
 * JSX inside an async server component cannot be tested — the same trap that
 * left the marketplace search ranker unreachable until 2026-08-12, where the
 * only symptom of a regression would have been a customer finding nothing.
 *
 * Every threshold below is owner-visible product policy, not styling:
 *
 *   • "Trending" is EARNED, NEVER SOLD. Below `TRENDING_MIN_LIVE_SHOPS` a
 *     ranking is noise wearing the clothes of merit — a "Trending" heading over
 *     a field of one is a lie the page must not tell. Prod holds ONE live shop,
 *     so today the heading is honest instead: "The first shops".
 *   • An empty shelf reads as BROKEN, not young. A rail with nothing in it is
 *     removed, not rendered empty with an apology.
 *   • A written invitation is not a zero. Where a shelf is genuinely empty but
 *     will fill, the page says what it is for, in a sentence.
 *
 * 🪤 THE LIVE-SHOP COUNT MUST NOT COME FROM `is_published`. That column is
 * LEGACY and no longer queried by the marketplace — `app/explore/page.tsx` says
 * so outright ("the legacy `is_published` boolean is no longer queried here").
 * The real gate is `public_visibility = 'verified' AND verification_state =
 * 'verified'`. Measured 2026-08-13, prod holds two shops: one with
 * `is_published = true` that is HIDDEN, and one `public_visibility='verified'`
 * with `is_published = false`. Counting the legacy way yields 0 and makes the
 * page apologise when it should be saying "The first shops". The caller owns
 * that query; this module only takes the number — so the trap is written down
 * where whoever changes the query will read it.
 */

/**
 * "Trending" only returns once a ranking could mean something. Owner's number,
 * owner's to move (`FRONT_DOOR_AND_SEAM_FINAL` §1: "Twelve is the one new
 * number and it is yours to move").
 */
export const TRENDING_MIN_LIVE_SHOPS = 12;

/**
 * Below this, the stories shelf shows a written invitation instead of a grid.
 * Matches what the homepage already shipped before this port — not a new rule.
 */
export const STORIES_MIN_PUBLISHED = 2;

/** One published chapter is enough for the storyteller rail to be real. */
export const STORYTELLER_MIN_CHAPTERS = 1;

/** The measured state of the world the page is rendering into. */
export type FrontDoorCounts = {
  /** Published storyteller chapters. */
  chapters: number;
  /** Published articles (git-tracked markdown, so this cannot fail — only be short). */
  articles: number;
  /** Published couple stories / editorials. */
  stories: number;
  /**
   * Shops live to a stranger. MUST be counted with
   * `public_visibility='verified' AND verification_state='verified'`,
   * never with the legacy `is_published`. See the module docblock.
   */
  liveShops: number;
};

/** How one rail renders. `absent` means it is not on the page at all. */
export type RailShape = 'absent' | 'invitation' | 'grid';

export type FrontDoorComposition = {
  storytellers: RailShape;
  articles: RailShape;
  stories: RailShape;
  shops: RailShape;
  /**
   * The shops heading. `trending` is only ever returned once a ranking is
   * earned; below the threshold the honest heading is `first-shops`.
   */
  shopsHeading: 'trending' | 'first-shops' | 'none';
  /** True when the writing is the only full rail — it then carries the page. */
  articlesCarryThePage: boolean;
};

/**
 * Decide the page's shape from what actually exists.
 *
 * Deliberately total and deliberately dull: every rail gets an explicit shape,
 * so adding a rail forces a decision here rather than defaulting to "render it
 * empty and hope". Negative or non-finite inputs are floored at 0 rather than
 * trusted — a read that failed must never be able to promote a rail.
 */
export function composeFrontDoor(counts: FrontDoorCounts): FrontDoorComposition {
  const n = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

  const chapters = n(counts.chapters);
  const articles = n(counts.articles);
  const stories = n(counts.stories);
  const liveShops = n(counts.liveShops);

  const storytellers: RailShape =
    chapters >= STORYTELLER_MIN_CHAPTERS ? 'grid' : 'absent';

  // The writing is the one shelf that is never empty in practice, but it is
  // still asked rather than assumed — a build that shipped zero articles should
  // not render a headed shelf with nothing under it.
  const articlesShape: RailShape = articles > 0 ? 'grid' : 'absent';

  const storiesShape: RailShape =
    stories >= STORIES_MIN_PUBLISHED ? 'grid' : 'invitation';

  // A shop shelf with no shops is an invitation to open one, never an empty
  // grid. With some shops but not enough for a ranking, it is still a grid —
  // only the HEADING changes, because the shops are real even when the
  // ranking would not be.
  const shopsShape: RailShape = liveShops > 0 ? 'grid' : 'invitation';
  const shopsHeading: FrontDoorComposition['shopsHeading'] =
    liveShops >= TRENDING_MIN_LIVE_SHOPS
      ? 'trending'
      : liveShops > 0
        ? 'first-shops'
        : 'none';

  return {
    storytellers,
    articles: articlesShape,
    stories: storiesShape,
    shops: shopsShape,
    shopsHeading,
    articlesCarryThePage:
      articlesShape === 'grid' &&
      storytellers !== 'grid' &&
      storiesShape !== 'grid' &&
      shopsShape !== 'grid',
  };
}
