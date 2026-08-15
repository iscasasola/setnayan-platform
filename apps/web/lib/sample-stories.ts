// WHEN THE SAMPLE STORIES RETIRE — one rule, one number, two readers.
//
// ─── THE OWNER'S RULE (2026-08-15) ───────────────────────────────────────────
// Verbatim: *"samples will be gone once we have created 5 event stories in
// public."* So the curated samples are a shop window that takes itself down —
// they show while the platform has fewer than five REAL published stories, and
// disappear on their own the day the fifth one lands. Nobody has to remember
// to switch them off, which is the whole point: a launch-day placeholder that
// needs a human to retire it is still on the site two years later.
//
// ─── WHY IT IS A MODULE AND NOT AN `if` ──────────────────────────────────────
// TWO surfaces publish the samples: the Stories page renders them, and
// `sitemap-weddings.xml` hands their URLs to Google. Before this file the page
// and the sitemap decided independently — and they had ALREADY drifted:
//
//   · the page said `showcases.length === 0`, and prod holds ONE sample row in
//     the database, so the in-code samples were switched off entirely;
//   · the sitemap emitted all of them unconditionally.
//
// Result, measured live 2026-08-15: **nine sample stories submitted to Google
// with no link to them from anywhere on the site.** Fully written, reachable
// by URL, orphaned in the crawl. Splitting one rule across two files is how
// that happened, so the rule now lives here and both callers ask it.
//
// 🔑 IF THIS SPLITS AGAIN, THE SITEMAP IS THE HALF THAT ROTS QUIETLY. A page
// that stops rendering samples is visible in a second; a sitemap still
// offering twenty fictional URLs after they vanished from the site is visible
// to nobody but a crawler. `sample-stories.test.ts` fails if either caller
// stops asking.

/**
 * How many REAL published stories retire the samples.
 *
 * Owner-set, 2026-08-15. One number, one line, changeable without touching a
 * single rendering decision — which is the reason it is a named constant and
 * not a `5` sitting in two files.
 */
export const SAMPLE_STORIES_RETIRE_AT = 5;

/**
 * Should the curated samples be published at all right now?
 *
 * @param realStoryCount how many NON-sample published stories exist.
 *
 * ⚠ COUNT REAL STORIES, NOT ROWS. The database's own curated sample event is a
 * published row and is NOT a real story; counting rows is exactly the mistake
 * that hid nine finished pages behind a single seeded record. Callers must
 * filter `isSample` out BEFORE calling this.
 *
 * ⚠ FAILS TOWARD SHOWING. A negative or nonsense count still shows samples: an
 * empty Stories page on launch day is worse than one honest sample too many,
 * and the samples are individually badged either way.
 */
export function sampleStoriesAreShowing(realStoryCount: number): boolean {
  return !(realStoryCount >= SAMPLE_STORIES_RETIRE_AT);
}
