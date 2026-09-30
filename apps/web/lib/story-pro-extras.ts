/**
 * apps/web/lib/story-pro-extras.ts
 *
 * THE STORY'S THREE PRO EXTRAS — the moments' own names and stories
 * (`chapterOverrides`), the couple's own columns (`customColumns`) and the
 * featured guest wishes (`reviews`), all kept on `event_editorial.draft_json`.
 *
 * 💎 TRIED FREE, ASKED AT APPLY (owner 2026-09-28/29: *"they can edit it with
 * pro features. but need to upgrade to pro when clicked on apply"*). A couple
 * without Event Hub Pro writes these in the story workroom like anyone else;
 * `saveEditorial` keeps them in the Event Hub DRAFT (`lib/post-event-draft.ts`)
 * rather than on the live story, and the Maker's Apply sheet names them and
 * asks for Pro. A couple with Pro saves them live, as before.
 *
 * ONE definition of "what may be stored", shared by the live save and the
 * draft, so the two can never keep different ideas of a legal wish or moment.
 * The column rule is the render path's own (`readCustomColumns`).
 *
 * Pure. No I/O. Client-safe.
 */
import { readCustomColumns, type CustomColumn } from '@/app/[slug]/_components/editorial/custom-columns';

/** The same shape as `ChapterOverride` in `editorial/data.ts` (server-only there). */
export type StoryChapterOverride = {
  leadId: string;
  title?: string | null;
  writeUp?: string | null;
  hidden?: boolean;
};

/** The same shape as `Review` in `editorial/data.ts`. */
export type StoryReview = {
  author: string;
  role: string | null;
  quote: string;
  stars: number | null;
};

/** Cap the persisted per-moment story so a runaway paste can't bloat draft_json. */
export const CHAPTER_WRITEUP_MAX = 600;
/** Cap the moment name. Comfortably past the longest canonical moment. */
export const CHAPTER_TITLE_MAX = 80;
/** Cap the manual guest-wishes list. */
export const REVIEWS_MAX = 12;
const REVIEW_QUOTE_MAX = 280;
const REVIEW_AUTHOR_MAX = 80;
const REVIEW_ROLE_MAX = 40;

/**
 * The per-chapter curation, cleaned. KEEPS bare `{ leadId }` rows (they carry
 * order), dedupes by leadId, trims + caps text. Anything non-array → [].
 */
export function sanitizeChapterOverrides(input: unknown): StoryChapterOverride[] {
  if (!Array.isArray(input)) return [];
  const out: StoryChapterOverride[] = [];
  const seen = new Set<string>();
  for (const raw of input as Array<Record<string, unknown> | null>) {
    const leadId = typeof raw?.leadId === 'string' ? raw.leadId.trim() : '';
    if (!raw || !leadId || seen.has(leadId)) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, CHAPTER_TITLE_MAX) : '';
    const writeUp = typeof raw.writeUp === 'string' ? raw.writeUp.trim().slice(0, CHAPTER_WRITEUP_MAX) : '';
    const hidden = raw.hidden === true;
    seen.add(leadId);
    out.push({
      leadId,
      ...(title ? { title } : {}),
      ...(writeUp ? { writeUp } : {}),
      ...(hidden ? { hidden: true } : {}),
    });
  }
  return out;
}

/** The couple's own columns — the render path's own reader. */
export function sanitizeCustomColumns(input: unknown): CustomColumn[] {
  return readCustomColumns({ customColumns: input });
}

/**
 * The featured guest wishes, cleaned: a wish with no words is dropped, stars
 * are 1–5 or null, the list is capped. Anything non-array → [].
 */
export function sanitizeReviews(input: unknown): StoryReview[] {
  if (!Array.isArray(input)) return [];
  const out: StoryReview[] = [];
  for (const raw of input as Array<Record<string, unknown> | null>) {
    if (out.length >= REVIEWS_MAX) break;
    const quote = typeof raw?.quote === 'string' ? raw.quote.trim().slice(0, REVIEW_QUOTE_MAX) : '';
    if (!raw || !quote) continue;
    const author = typeof raw.author === 'string' ? raw.author.trim().slice(0, REVIEW_AUTHOR_MAX) : '';
    const role = typeof raw.role === 'string' ? raw.role.trim().slice(0, REVIEW_ROLE_MAX) : '';
    const starsNum = Number(raw.stars);
    const stars = Number.isFinite(starsNum) && starsNum >= 1 ? Math.min(5, Math.round(starsNum)) : null;
    out.push({ author, role: role || null, quote, stars });
  }
  return out;
}

/** The three extras' keys on `event_editorial.draft_json`. */
export const STORY_PRO_EXTRA_KEYS = ['chapterOverrides', 'customColumns', 'reviews'] as const;
export type StoryProExtraKey = (typeof STORY_PRO_EXTRA_KEYS)[number];

export type StoryProExtras = {
  chapterOverrides: StoryChapterOverride[];
  customColumns: CustomColumn[];
  reviews: StoryReview[];
};

/** One extra, cleaned by its own rule. */
export function sanitizeStoryProExtra<K extends StoryProExtraKey>(key: K, raw: unknown): StoryProExtras[K] {
  if (key === 'chapterOverrides') return sanitizeChapterOverrides(raw) as StoryProExtras[K];
  if (key === 'customColumns') return sanitizeCustomColumns(raw) as StoryProExtras[K];
  return sanitizeReviews(raw) as StoryProExtras[K];
}

/** The extras a story's `draft_json` holds today, each through its own rule. */
export function storyProExtrasOf(draftJson: unknown): StoryProExtras {
  const d = draftJson && typeof draftJson === 'object' && !Array.isArray(draftJson)
    ? (draftJson as Record<string, unknown>)
    : {};
  return {
    chapterOverrides: sanitizeChapterOverrides(d.chapterOverrides),
    customColumns: sanitizeCustomColumns(d.customColumns),
    reviews: sanitizeReviews(d.reviews),
  };
}

/** What the couple sees on the Apply sheet for each extra. */
export const STORY_PRO_EXTRA_LABEL: Readonly<Record<StoryProExtraKey, string>> = {
  chapterOverrides: "Your moments' names and stories",
  customColumns: 'Your own columns',
  reviews: 'Featured guest wishes',
};
