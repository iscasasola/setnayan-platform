/**
 * WHAT A SAMPLE STORY SAYS IT IS.
 *
 * 🔴 THE DEFECT THIS FIXES, SEEN ON THE LIVE SITE 2026-09-09 — not inferred:
 * `/realstories/[slug]` printed ONE hardcoded sentence above every sample —
 *
 *   "A sample of how a WEDDING is told on Setnayan once it becomes a story.
 *    Real COUPLE stories — their own words, photos, and team — begin December
 *    2026, published with the COUPLE'S consent."
 *
 * — above all 21 samples, which carry 17 DIFFERENT event types. So a family's
 * wake, a graduation, a house blessing and a company year-end each announced
 * themselves as a wedding, and the wake told a bereaved reader about "the
 * couple's consent". The story beneath it was already correct: S13 threaded the
 * occasion's own words through the page, and the wake renders "the family"
 * throughout with no Relive, no countdown and no anniversary. **Only the banner
 * above it never learned.**
 *
 * 🔑 IT WAS INVISIBLE TO EVERY SWEEP THAT LOOKED FOR THE WORD "couple" IN THE
 * STORY TREE, because it does not live there — it lives on the showcase route
 * that WRAPS the story. A scan scoped to the tree you are fixing cannot see the
 * chrome around it.
 */

/**
 * Types whose sample must not be described in celebratory terms.
 *
 * ⚠ KEYED ON THE FIXTURE'S OWN LABEL, deliberately — this route reads a static
 * fixture (`lib/real-weddings.ts`), never an event row, so there is no
 * `event_type_profiles.terminology` to resolve a register from. A fixture is
 * the one place a small hand-kept list is honest: it can only drift if somebody
 * adds a solemn sample, and the guard beside this file fails when they do.
 */
const SOLEMN_SAMPLE_TYPES = new Set(['wake', 'funeral', 'memorial']);

export function sampleIsSolemn(eventType: string): boolean {
  return SOLEMN_SAMPLE_TYPES.has(eventType.trim().toLowerCase());
}

/** "a wake" · "a debut" · "an anniversary" — the article the label needs. */
export function withArticle(label: string): string {
  const word = label.trim().toLowerCase();
  return /^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`;
}

/**
 * The sentence above a sample.
 *
 * ⚖ NEITHER ARM SAYS "COUPLE". The celebratory arm cannot: it stands above a
 * graduation and a company year-end as often as a wedding. The solemn arm says
 * less and says it gently — no "team", no "photos" listed like a portfolio.
 */
export function sampleShowcaseNote(eventType: string): string {
  const kind = withArticle(eventType);
  if (sampleIsSolemn(eventType)) {
    return (
      `A sample of how ${kind} is told on Setnayan once it becomes a story. ` +
      `Real stories — a family's own words and photographs — begin December 2026, ` +
      `published only with the family's consent.`
    );
  }
  return (
    `A sample of how ${kind} is told on Setnayan once it becomes a story. ` +
    `Real stories — their own words, photos, and team — begin December 2026, ` +
    `published with the consent of the people in them.`
  );
}
