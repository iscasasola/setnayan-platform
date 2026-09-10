// ============================================================================
// A3 broadsheet print keepsake — layout math + the front/back threshold
// ============================================================================
//
// Pure, dependency-free helpers shared by the print route. Kept out of the
// component file so the front/back decision is testable in isolation and its
// threshold is documented in one place.
// ============================================================================

import type { EditorialData } from '../_components/editorial/data';

// ── Masthead helpers (mirrors editorial-content.tsx, kept in lock-step) ──────
// These are re-derivations of the editorial's private masthead helpers so the
// print masthead reads IDENTICALLY (same Volume/No/nameplate/dateline) without
// exporting internals from the render module. If the editorial's awards-cycle
// rule changes, update both.

const AWARDS_CUTOFF_MONTH = 11; // November
const AWARDS_CUTOFF_DAY = 18; // 18th

/** Setnayan awards-cycle Volume for a wedding date (Nov 18 → Nov 17 year). */
export function editionVolume(eventDate: string | null): number {
  if (!eventDate) return 1;
  const [y, m, d] = eventDate.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const onOrAfterCutoff =
    m > AWARDS_CUTOFF_MONTH || (m === AWARDS_CUTOFF_MONTH && d >= AWARDS_CUTOFF_DAY);
  const cycleStartYear = onOrAfterCutoff ? y : y - 1;
  return Math.max(1, cycleStartYear - 2025);
}

/** Volume number as a masthead Roman numeral (1 → I, 2 → II, …). */
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return 'I';
  const table: Array<[number, string]> = [
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
    [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = Math.floor(n);
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

/** "The <Names> Chronicle" nameplate (strips parenthetical suffixes). */
export function nameplate(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return `The ${cleaned} Chronicle`;
}

/** Masthead dateline center: venue city · wedding date. */
export function editionCenter(data: EditorialData): string {
  const parts: string[] = [];
  if (data.venueCity) parts.push(data.venueCity);
  if (data.eventDateFormatted) parts.push(data.eventDateFormatted);
  return parts.join(' · ') || 'Commemorative Edition';
}

/** Locale-formatted count (en-PH thousands separators). */
export function fmtCount(n: number): string {
  try {
    return n.toLocaleString('en-PH');
  } catch {
    return String(n);
  }
}

export function prettyCategory(category: string): string {
  return category.replace(/_/g, ' ');
}

// ── The front/back threshold ─────────────────────────────────────────────────

/**
 * How much media the day carries, for the back-page decision. Counts a chapter
 * as "media-bearing" when it has at least one photo/clip — the same media a
 * chapter renders in the compact grid on the front.
 */
function mediaBearingChapters(data: EditorialData): number {
  return data.dayChapters.filter((c) => c.media.length > 0).length;
}

/**
 * needsBackPage — decide whether the A3 sheet gets a SECOND printed side.
 *
 * Spec rule (Editorial_Experience_Spec §8): the FRONT is always full; the BACK
 * is a conditional second side, printed ONLY when content genuinely warrants it
 * — never a half-empty back. The front alone comfortably carries the masthead,
 * hero, lead article, and a compact grid of the day's first ~6 moments plus the
 * primary vendor credits. The back exists to absorb the OVERFLOW: extra
 * chapters/photos, the "What They Whispered" wall, the "Powered by Setnayan"
 * services strip, and the full vendor credit ledger.
 *
 * CONCRETE THRESHOLD — the back is warranted when AT LEAST 2 of these hold:
 *   (a) media-bearing chapters > 6   — more moments than the front's compact
 *       grid shows, so there's a real overflow to carry;
 *   (b) kwentoQuotes.length   >= 3   — a "What They Whispered" wall worth a rule;
 *   (c) reviews.length        >= 3   — a "What They Said" block worth a rule;
 *   (d) vendors.length        >= 4   — a credit ledger too long for the front's
 *       primary-credits strip;
 *   (e) servicesAvailed.length >= 3  — a "Powered by Setnayan" strip worth a rule.
 *
 * Requiring TWO signals (not one) is what stops a wedding with, say, only 7
 * chapters but nothing else from spilling onto a nearly-blank back — a single
 * signal stays on the front (its overflow is trimmed per the priority ladder).
 * Two-or-more signals mean there's enough distinct material to fill a back page.
 *
 * Pure + side-effect free so it can be reasoned about / unit-tested directly.
 */
export function needsBackPage(data: EditorialData): boolean {
  const signals = [
    mediaBearingChapters(data) > 6,
    data.kwentoQuotes.length >= 3,
    data.reviews.length >= 3,
    data.vendors.length >= 4,
    data.servicesAvailed.length >= 3,
  ];
  return signals.filter(Boolean).length >= 2;
}

/**
 * Split the day's chapters into the FRONT compact grid (first N) and the BACK
 * overflow (the rest). The front always shows up to `frontCap` media-bearing
 * chapters; anything beyond that only prints when a back page exists.
 */
export const FRONT_CHAPTER_CAP = 6;

export function splitChapters(
  data: EditorialData,
  hasBack: boolean,
): { front: EditorialData['dayChapters']; back: EditorialData['dayChapters'] } {
  const withMedia = data.dayChapters.filter((c) => c.media.length > 0);
  const front = withMedia.slice(0, FRONT_CHAPTER_CAP);
  const back = hasBack ? withMedia.slice(FRONT_CHAPTER_CAP) : [];
  return { front, back };
}

// ============================================================================
// A4 booklet — one page per minute of the story timeline
// ============================================================================
//
// The A4 format is the OPPOSITE editorial choice from the A3 broadsheet: no
// curation, no front/back overflow threshold, no FRONT_CHAPTER_CAP. Every
// written minute (`EditorialData['dayChapters']`, already ordered — see
// data.ts's own note that a chapter's `time` "places" it on the story's
// clock) gets its own page, in order, full stop. A minute with no media still
// gets its page (a title/writeUp-only minute is still a minute); only the
// pagination guard test cares that the count matches exactly.

import type { DayChapter } from '../_components/editorial/data';

/**
 * ── THE EXTENSION SEAM ───────────────────────────────────────────────────
 * A future step lets a couple hand-arrange a bespoke sheet for one or more
 * adjacent minutes (a spread that replaces the mechanical one-minute-per-page
 * default — e.g. a hand-laid ceremony spread covering three consecutive
 * minutes on one sheet). That step is NOT built here. What IS built is the
 * seam it plugs into: `A4PageResolver` is the one function that turns the
 * day's ordered minutes into pages, and `buildA4Pages` takes one as an
 * optional argument instead of hardcoding the one-minute-per-page rule
 * inline. The default resolver is the only one that exists today.
 */
export type A4PageSource =
  | { kind: 'minute'; chapter: DayChapter }
  | { kind: 'arranged'; sheetId: string; chapters: DayChapter[] };

export interface A4PageResolver {
  /** Turn the day's ordered minutes into the pages that get printed. The
   *  default resolver is 1:1 — every minute is exactly one page, in order.
   *  A resolver that hand-arranges some minutes onto a shared sheet must
   *  still return every input chapter exactly once, across all pages, in
   *  their original relative order — that invariant is what the pagination
   *  guard test checks, so a future resolver is held to it automatically. */
  resolve(chapters: readonly DayChapter[]): A4PageSource[];
}

/** The only resolver that exists today: one page per minute, in order. */
export function defaultA4PageResolver(chapters: readonly DayChapter[]): A4PageSource[] {
  return chapters.map((chapter) => ({ kind: 'minute', chapter }));
}

/**
 * Build the A4 booklet's pages from the (already-gated, already-redacted)
 * editorial data. `resolver` defaults to the mechanical one-minute-per-page
 * rule; passing a different one is the seam a future hand-arranged-sheet step
 * uses — nothing today passes anything else.
 *
 * Typed on the ONE field this needs (`dayChapters`), not the whole
 * `EditorialData` — this is a pure layout function and a test fixture for it
 * should not have to fabricate 60 unrelated fields to get one right.
 */
export function buildA4Pages(
  data: Pick<EditorialData, 'dayChapters'>,
  resolver: A4PageResolver = { resolve: defaultA4PageResolver },
): A4PageSource[] {
  return resolver.resolve(data.dayChapters);
}
