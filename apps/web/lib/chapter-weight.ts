/**
 * How much of the page a chapter gets, and where its picture comes from.
 *
 * ── WHY THIS IS DERIVED AND NOT CHOSEN ──────────────────────────────────────
 * The design gives a wedding the width of the page, a trip a strip, and an
 * ordinary Tuesday a single line. That is the one thing no competitor does —
 * Zola ships 1,618 designs and two layouts; Appy Couple's "Stories" is six
 * identical polaroids where a first date and an engagement are the same
 * rectangle.
 *
 * 🔑 BUT IT ONLY SURVIVES IF NOBODY HAS TO DECIDE IT. The two publications with
 * the least per-item authoring — The Atlantic (15 of 18 figures at an identical
 * width) and Cereal (one body size) — both abandoned variation entirely rather
 * than art-direct every item. A rule that needs a person to say "this one is
 * big" stops happening in week two, and then the page is a card grid with extra
 * steps.
 *
 * So the weight comes from what the product ALREADY knows about a chapter:
 * does it carry a picture, and did they actually write something. Nothing new
 * is asked of anybody, and a chapter grows on its own as it is filled in.
 *
 * ⚖ WHY THESE TWO FACTS AND NOT "IS IT A WEDDING". Ranking by event type would
 * be the product deciding that a wedding matters more than a graduation, on a
 * page about somebody's life. It also fails the person whose biggest day was a
 * debut. Effort and evidence are honest proxies: the chapter somebody filled
 * with pictures and words IS the one they cared about.
 */

/** How a chapter is rendered. Three sizes; there is no fourth. */
export type ChapterWeight = 'lead' | 'medium' | 'line';

export type WeighedChapter = {
  /** A picture we may show — the celebration's public-safe photo, or a video still. */
  hasPicture: boolean;
  /** Real writing, not a title. `chapterExcerpt` returns null for an empty body. */
  hasWriting: boolean;
};

/**
 * ⚖ THE LEAD IS EARNED BY BOTH. A picture with no words is a photo dump; words
 * with no picture is a note. The chapter that has both is the one somebody
 * finished, and it is the only one that can fill the big slot without looking
 * padded — the slot carries a photograph AND a sentence, so a chapter missing
 * either would render half-empty in the most prominent place on the page.
 */
export function chapterWeight(c: WeighedChapter): ChapterWeight {
  if (c.hasPicture && c.hasWriting) return 'lead';
  if (c.hasPicture || c.hasWriting) return 'medium';
  return 'line';
}

/**
 * The weights for one year's chapters, with a rule the pure test above cannot
 * express: **a year has at most one lead.**
 *
 * Two full-width leads stacked in one year is the layout losing its nerve — the
 * whole claim is that scale means something, and two of the same size next to
 * each other says the opposite. The first (newest) keeps it; the rest step down
 * to medium, which they can fill honestly because they have a picture or words.
 *
 * ⚠ Input order decides which chapter leads. Callers hand these over
 * newest-first, the order the chronicle already produces.
 */
export function weighYear(chapters: readonly WeighedChapter[]): ChapterWeight[] {
  let leadTaken = false;
  return chapters.map((c) => {
    const w = chapterWeight(c);
    if (w !== 'lead') return w;
    if (leadTaken) return 'medium';
    leadTaken = true;
    return 'lead';
  });
}

/**
 * 🪤 A YEAR OF ONLY LINES IS NOT A YEAR — IT IS A RECEIPT.
 *
 * Somebody who wrote three bare titles in 2019 gets three grey rows and nothing
 * to look at, which reads as a broken page rather than a quiet year. When a year
 * has NOTHING above a line, the newest one is promoted to medium so the year has
 * a shape. It renders honestly at that size: a medium is a title, a date and a
 * picture-or-line, and a bare chapter still has a title and a date.
 */
export function weighYearWithFloor(chapters: readonly WeighedChapter[]): ChapterWeight[] {
  const weights: ChapterWeight[] = weighYear(chapters);
  // 🪤 `.some(w => w !== 'line')`, NOT `.every(w => w === 'line')`. TypeScript
  // now infers a type predicate from that arrow and narrows the whole array to
  // `'line'[]` inside the branch — so the very assignment this function exists
  // to make stops compiling. Same test, phrased so the narrowing cannot happen.
  const nothingButLines = weights.length > 0 && !weights.some((w) => w !== 'line');
  if (nothingButLines) weights[0] = 'medium';
  return weights;
}
