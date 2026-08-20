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

// ---------------------------------------------------------------------------
// ONE SHELF, TWO AUTHORS — which KINDS a chip admits.
// ---------------------------------------------------------------------------

/**
 * The chips over the one shelf. Real links, so filtering works with no
 * JavaScript at all.
 *
 * ⚠ THE CHIP CHANGES WHAT THE SHELF CONTAINS, NEVER THE PAGE'S STRUCTURE.
 * There is one shelf and the CARD says which kind each piece is — that is the
 * whole point of the merge (owner 2026-08-12). A chip that hid or added a
 * SHELF would put us back where we started: a row that is permanently empty
 * and therefore reads as broken rather than young.
 */
export const FRONT_DOOR_CHIPS = [
  'All',
  /**
   * 🔑 "YOUR PEOPLE", NOT "CONNECTED" (owner 2026-08-20). He described it as
   * *"all events around the people you are with"* and rejected his own word in
   * the same breath — "Connected" reads as a wifi state, not as a person.
   * "Your people" is the word the rail already uses for the same set (family ·
   * godparents · friends · samahan), and one word meaning one thing is the
   * lesson the Marketplace/"Find a supplier" collision already cost.
   *
   * ⚠ THE CHIP IS SIGNED-IN ONLY. A stranger has no people, so offering them
   * the button is offering a door onto a permanently empty room. The renderer
   * gates it; `selectShelf` still answers for it, because a hand-typed `?c=`
   * must behave.
   */
  'Your people',
  /**
   * 🏷 "STORIES", NOT "THEIR STORIES" (owner 2026-08-20, who wrote the row back
   * to us as *"Stories, Articles and Marketplace"* — his own word, his own
   * order). The possessive only ever earned its place as a contrast to "Your
   * people" sitting beside it; read alone it is distancing, and NN/g's tab
   * guidance is 1–2 words because shorter labels scan. It also matches the
   * hub's own address and the menu row this chip replaced.
   */
  'Stories',
  'Articles',
] as const;

/*
 * ─── WHAT CAME OFF, AND WHAT MUST NOT GO ON ─────────────────────────────
 *
 * ⛔ "With video" — RETIRED 2026-08-20. It is a MODIFIER on a story, not a
 * KIND of thing on the shelf, so it was the one chip that was not parallel
 * with its neighbours (NN/g: a tab row must hold parallel content — same
 * layout, different data). Nothing is lost: every card still carries its own
 * "▶ with video" badge, so a person can still SEE which have video — they
 * simply cannot filter to them, on a shelf where zero do today.
 *
 * ⛔ "Marketplace" — CONSIDERED AND REFUSED, twice over, and this note exists
 * so it is not proposed a third time.
 *   1 · It is not a KIND OF READING, it is a different room — and it already
 *       has THREE doors: the shops rail below this shelf, the rail
 *       destination, and the search box's "find suppliers" row. NN/g on
 *       duplicate links: indiscriminate extra doors deplete attention rather
 *       than aid findability.
 *   2 · It would be the only chip that NAVIGATES instead of FILTERING, which
 *       breaks this row's whole contract (see the note above).
 *   Precedent is unusually clean: Instagram removed the Shop tab from its
 *   content home in 2023 for want of engagement, and TikTok's push of shop
 *   content INTO the feed produced measurable backlash.
 *   📉 And the local arithmetic agrees. Measured 2026-08-20: two shops exist;
 *   the one with services is HIDDEN, and the one a stranger can reach has
 *   ZERO services. A chip pointing at that is a fourth door to an empty room.
 */

export type ChipKey = (typeof FRONT_DOOR_CHIPS)[number];

export function isChip(v: string | undefined): v is ChipKey {
  return !!v && (FRONT_DOOR_CHIPS as ReadonlyArray<string>).includes(v);
}

/** What one chip admits into the shelf. */
export type ShelfSelection<A, S> = {
  articles: A[];
  stories: S[];
  /** Nothing at all under this chip — the page says so in a sentence. */
  empty: boolean;
};

/**
 * Decide what the one shelf holds under a chip.
 *
 * WHY THIS IS A FUNCTION AND NOT THREE TERNARIES INSIDE THE JSX — the same
 * reason `composeFrontDoor` exists, written one screen above: a rule buried in
 * an async server component's JSX is unreachable from any test, so its only
 * symptom when it breaks is a customer finding nothing. "With video" showing an
 * empty shelf on a day with three video chapters would look exactly like a
 * quiet week.
 *
 * 🔑 "With video" MEANS A VIDEO, NOT A PICTURE OF ONE. A story's `hasVideo`
 * must be the real signal from the loader. Deriving it from a thumbnail answers
 * NO for every chapter whose video is not on YouTube — a chapter that is
 * entirely video, dropped from the one chip that exists to find it.
 *
 * Articles carry no video of their own, so "With video" is stories-only. That
 * is the ported prototype's rule, not an accident: `reads = (kind==='w' ||
 * kind==='v') ? [] : arts`.
 */
export function selectShelf<
  A,
  S extends { hasVideo: boolean; fromYourPeople?: boolean },
>(
  chip: ChipKey,
  articles: readonly A[],
  stories: readonly S[],
): ShelfSelection<A, S> {
  const wantsArticles = chip === 'All' || chip === 'Articles';
  const wantsStories =
    chip === 'All' || chip === 'Stories' || chip === 'Your people';

  /*
    🔑 "YOUR PEOPLE" IS A NARROWING OF THIS SHELF, NEVER A SECOND SOURCE.
    It filters pieces the caller has ALREADY loaded and that every stranger can
    already see, down to the ones whose author the viewer already knows. It
    cannot surface anything private, because nothing here loads a story — see
    `lib/your-people.ts`, which carries the same rule at the other end.

    `fromYourPeople` is OPTIONAL on the type and `!== true` is deliberate: a
    caller that has not computed it yet (or whose read FAILED) yields an empty
    shelf and the written invitation, never somebody else's stories mislabelled
    as a friend's. Absence must fail closed here — it is a claim about who a
    person knows.

    Articles are OURS, so this chip takes none — the same rule "With video"
    already follows, and for the same reason: a Setnayan guide has no author
    the viewer could know.
  */
  const pickedStories = wantsStories
    ? chip === 'Your people'
      ? stories.filter((s) => s.fromYourPeople === true)
      : [...stories]
    : [];
  const pickedArticles = wantsArticles ? [...articles] : [];

  return {
    articles: pickedArticles,
    stories: pickedStories,
    empty: pickedArticles.length === 0 && pickedStories.length === 0,
  };
}

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
