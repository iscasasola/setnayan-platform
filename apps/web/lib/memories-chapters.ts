/**
 * apps/web/lib/memories-chapters.ts — MEMORIES BY CHAPTER: the dropdown, the filter and Add to Chapter (pure; the
 * reads are `memories-chapters.server.ts`, the rules themselves live in the database — migration 20271301555513).
 *
 * Owner 2026-11-01 (DECISION_LOG "A CHAPTER'S PHOTOS: WHO + WHEN; ADD TO OTHER CHAPTERS"; plan
 * `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 Photos, §4 "Memories by chapter" · "Add to other chapters"; the
 * approved prototype `prototypes/schedule_chapters_2026-11-01`, `memories()` and `mediaViewer()`):
 *   *"A chapter is exclusive to 1. the people part of that initially or tagged only or to everybody 2. show instantly
 *   for everybody or will only show once event is done"* · *"We can add media files inside other chapters on memories
 *   directly."*
 *
 * 🔒 NOTHING HERE DECIDES WHO SEES WHAT. The server read hands this module only the chapters the viewer may see
 * (`listed`) and only the (photo, chapter) pairs they see; a photo they see in no chapter never reaches the page at all
 * (`withheld`, dropped by `readEventMemories`). This file only arranges what already came through.
 *
 * Pure — `memories-chapters.test.ts` executes every rule.
 */

/** One chapter as the Memories read returns it for THIS viewer (`papic_memories_chapters`). */
export type MemoriesChapter = {
  id: string;
  label: string;
  /** The chapter's Who — said in the Add to Chapter warning ("More people will see this"). */
  who: 'chapter' | 'tagged' | 'everybody';
  /** The dropdown lists it: the viewer sees the chapter, or at least one photo in it (their own). */
  listed: boolean;
  /** A host, or one of its people — the viewer may add a photo to it. */
  mayAdd: boolean;
  /** One of its people (named on it, through a group or a role, a booked supplier). */
  isIn: boolean;
  /** How many of its photos this viewer sees. */
  photos: number;
};

/** A photo's chapters, as THIS viewer sees them. Empty = Unsorted (or not a chapter-able file). */
export type PhotoChapters = { in: string[]; shotIn: string[] };

/** The dropdown's two fixed rows. */
export const ALL_CHAPTERS = 'all';
export const UNSORTED = 'unsorted';
export type ChapterFilter = string;

/** A file that can belong to a chapter — a Papic shot (a guest capture, a seat camera's photo). */
export function isChapterFile(item: { table: string }): boolean {
  return item.table === 'papic_guest_captures' || item.table === 'papic_photos';
}

/**
 * 🔽 THE DROPDOWN — "All chapters", then ONLY the chapters this viewer may see (the server's `listed`), then Unsorted
 * when anything in what they were given sits in no chapter. A chapter the server did not list is never offered.
 */
export function chapterFilterOptions(
  chapters: readonly MemoriesChapter[],
  items: readonly { table: string; chapters?: PhotoChapters | null }[],
): { key: string; label: string; group?: string }[] {
  const listed = chapters.filter((c) => c.listed);
  const unsorted = items.some((it) => isChapterFile(it) && !(it.chapters?.in.length));
  return [
    { key: ALL_CHAPTERS, label: 'All chapters' },
    ...listed.map((c) => ({ key: c.id, label: c.label, group: 'Chapters' })),
    ...(unsorted ? [{ key: UNSORTED, label: 'Unsorted', group: listed.length ? 'Chapters' : undefined }] : []),
  ];
}

/** Whether a file belongs under the picked row. An unknown chapter (no longer listed) filters to nothing. */
export function inChapterFilter(item: { table: string; chapters?: PhotoChapters | null }, filter: ChapterFilter): boolean {
  if (filter === ALL_CHAPTERS) return true;
  if (filter === UNSORTED) return isChapterFile(item) && !(item.chapters?.in.length);
  return Boolean(item.chapters?.in.includes(filter));
}

/** A remembered pick that is no longer offered falls back to All — never a filter that silently shows nothing. */
export function validFilter(filter: string | null, options: readonly { key: string }[]): ChapterFilter {
  return filter && options.some((o) => o.key === filter) ? filter : ALL_CHAPTERS;
}

/**
 * ➕ ADD TO CHAPTER — may this viewer move THIS photo? Hosts may (it reached them, so they see it); anyone else only
 * from a chapter they are in (owner: "hosts and that chapter's people"). The server asks the same again.
 */
export function canAddFrom(item: { table: string; chapters?: PhotoChapters | null }, chapters: readonly MemoriesChapter[], host: boolean): boolean {
  if (!isChapterFile(item)) return false;
  if (host) return true;
  const mine = new Set(chapters.filter((c) => c.isIn).map((c) => c.id));
  return Boolean(item.chapters?.in.some((id) => mine.has(id)));
}

/** The Add to Chapter list: every chapter the viewer may add to, ✓ where the photo already is; a shot's own chapter
 *  is listed greyed (it never leaves the chapter it was shot in). */
export function chapterTargets(
  item: { chapters?: PhotoChapters | null },
  chapters: readonly MemoriesChapter[],
): { options: { key: string; label: string; disabledNote?: string }[]; picked: string[] } {
  const inSet = new Set(item.chapters?.in ?? []);
  const shot = new Set(item.chapters?.shotIn ?? []);
  const options = chapters
    .filter((c) => c.mayAdd || inSet.has(c.id))
    .map((c) => (shot.has(c.id) ? { key: c.id, label: c.label, disabledNote: 'Shot in this chapter — it stays here.' } : { key: c.id, label: c.label }));
  return { options, picked: options.filter((o) => inSet.has(o.key)).map((o) => o.key) };
}

/**
 * 👀 WIDER — adding to an "Everybody" chapter a photo that sits in no "Everybody" chapter shows it to the whole guest
 * list. The prototype asks first ("More people will see this. Everyone in … can open it.").
 */
export function widensTo(item: { chapters?: PhotoChapters | null }, targetId: string, chapters: readonly MemoriesChapter[]): MemoriesChapter | null {
  const by = new Map(chapters.map((c) => [c.id, c]));
  const target = by.get(targetId);
  if (!target || target.who !== 'everybody') return null;
  const already = (item.chapters?.in ?? []).some((id) => by.get(id)?.who === 'everybody');
  return already ? null : target;
}

/** The server's refusal codes (`papic_memories_set_chapter`), in words. */
export const CHAPTER_REFUSAL: Readonly<Record<string, string>> = {
  not_signed_in: 'Please sign in again.',
  not_a_chapter: 'That chapter is no longer there.',
  not_this_event: 'This photo isn’t from this event.',
  not_yours_to_add: 'Only the hosts and that chapter’s people can add photos to it.',
  cannot_see_photo: 'You can add a photo only from a chapter you are in.',
  shot_here: 'It was shot in this chapter — it stays here.',
};
export function chapterRefusalWords(code: string | null | undefined): string {
  return (code && CHAPTER_REFUSAL[code]) || 'We couldn’t change its chapters — nothing changed.';
}
