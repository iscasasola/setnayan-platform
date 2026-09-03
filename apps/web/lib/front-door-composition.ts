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

/*
 * ─── 2026-09-03 — THE CHIP MECHANISM IS RETIRED ─────────────────────────
 * `FRONT_DOOR_CHIPS`, `ChipKey`, `isChip` and `selectShelf` lived here (the
 * "All / Your people / Stories / Articles" filter row). The front door
 * dropped its chip bar along with the group-chat hero — the shelf is no
 * longer filtered, it is SECTIONED (New uploads / Trending / Shops), and
 * every section always shows everything of its kind. "Your people" (a
 * signed-in narrowing to stories from people you know) is retired with it;
 * `fromYourPeople` stays on `FrontDoorStory` unused rather than ripping out
 * `lib/your-people.ts`, which is a separate, working read this change did not
 * touch. See `front-door-feed.tsx` for what replaced the chip bar.
 */

/** How the one shelf's pieces divide between the lead grid and the rest. */
export type ShelfRows<A, S> = {
  leadStories: S[];
  leadArticles: A[];
  /** The rest of the writing — starts where the lead grid stopped. */
  trailingArticles: A[];
};

/**
 * Divide the one shelf between the lead four-across grid and the trailing row.
 *
 * ⚠ THE TRAILING ROW'S START IS NOT A CONSTANT, AND HARD-CODING IT LOSES
 * ARTICLES. The lead grid fills with STORIES first and tops up with articles,
 * so how many articles it consumed depends on how many stories exist. The
 * first cut hard-coded the trailing row to begin at index 4 — correct only on
 * a day with no stories. With four stories the lead grid took ZERO articles
 * and the trailing row still began at 4, so the 2nd and 3rd pieces of our
 * writing rendered nowhere: no error, no hole in the layout, just two articles
 * that stop existing the day the first chapter is featured.
 *
 * The rule this keeps: every article the shelf was handed is either in the
 * lead grid or the trailing row, in order, with nothing skipped between them.
 */
export function splitShelfRows<A, S>(
  stories: readonly S[],
  articles: readonly A[],
  opts?: { lead?: number; trailing?: number },
): ShelfRows<A, S> {
  const lead = Math.max(0, Math.floor(opts?.lead ?? 4));
  const trailing = Math.max(0, Math.floor(opts?.trailing ?? 8));

  const leadStories = stories.slice(0, lead);
  const leadArticles = articles.slice(
    0,
    Math.max(0, lead - leadStories.length),
  );
  const trailingArticles = articles.slice(
    leadArticles.length,
    leadArticles.length + trailing,
  );

  return {
    leadStories: [...leadStories],
    leadArticles: [...leadArticles],
    trailingArticles: [...trailingArticles],
  };
}

// ---------------------------------------------------------------------------
// TRENDING — chapters ranked by real views, never a new "earned" threshold.
// ---------------------------------------------------------------------------

/**
 * Trending, for stories. Deliberately NOT a `TRENDING_MIN_*` constant like
 * the shops one above — a chapter only reaches `stories` at all once an
 * admin has featured it (`showcase_featured_at IS NOT NULL`, see
 * `data.ts`'s loader note), so the "earned, never sold" gate is already
 * applied before this function ever sees the array. View count here decides
 * the ORDER among what was already earned, not whether it is shown.
 *
 * Editorials never enter — they carry no view count by design (a couple's
 * own wedding write-up gets no public counter, see `front-door-editorials.ts`).
 *
 * 2026-09-03 SESSION NOTE: the original brief for this section asked for a
 * genuine view-count THRESHOLD before a chapter counts as trending, mirroring
 * `TRENDING_MIN_LIVE_SHOPS` above — that number needs the owner, the same way
 * 12 did ("owner's number, owner's to move"), and was deliberately not
 * guessed. This ships without one: today's real population is chapters that
 * already passed the stricter admin-Feature gate, so a raw view-count
 * threshold on top of that would be gating an already-small, already-curated
 * set a second time. If that changes — chapters get featured in volume and a
 * view floor starts to matter — add `TRENDING_MIN_CHAPTER_VIEWS` here,
 * exactly where `TRENDING_MIN_LIVE_SHOPS` already lives, once a real number
 * exists to put in it.
 */
export function selectTrendingChapters<
  S extends { kind: 'chapter' | 'editorial'; viewCount: number | null },
>(stories: readonly S[], limit = 6): S[] {
  return stories
    .filter(
      (s): s is S & { viewCount: number } =>
        s.kind === 'chapter' && typeof s.viewCount === 'number',
    )
    .slice()
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

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
