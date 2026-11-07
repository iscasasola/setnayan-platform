import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { MemoriesChapter, PhotoChapters } from '@/lib/memories-chapters';

/**
 * memories-chapters.server.ts — THE MEMORIES READ, BY CHAPTER (migration 20271301555513).
 *
 * Two reads, both on the VIEWER'S OWN session — the database answers for `auth.uid()`, never for an id this code sends:
 *   papic_memories_chapters        the chapters the viewer may see (`listed`) or add to (`may_add`)
 *   papic_memories_photo_chapters  each (photo, chapter) the viewer sees it in, and the photos withheld from them
 *
 * 🔒 ENFORCED IN THE READ, NOT THE SCREEN: `readEventMemories` drops every withheld photo before the page is drawn, so a
 * photo in a chapter the viewer may not see never reaches the browser through Memories.
 * 🔑 A REFUSED READ FAILS CLOSED — `refused: true`, and the caller says "couldn't load" rather than drawing photos it
 * cannot vouch for (a refusal here must never show what a chapter hides).
 *
 * ⏭ SEAM — the next Step 7 slice: the check on every photo URL, signed links included. Today the papic tables' RLS still
 * lets the couple read every capture row and a presigned link is not re-checked against a chapter; that check calls
 * `papic_chapter_capture_visible(link, user)` — the one per-photo answer these reads are built on.
 */

export type MemoriesChapterRead = {
  chapters: MemoriesChapter[];
  /** Photo id (capture_id / photo_id) → the chapters this viewer sees it in. Absent = in no chapter (Unsorted). */
  ofPhoto: Map<string, PhotoChapters>;
  /** Photos linked to chapters the viewer sees in NONE — dropped before the page is drawn. */
  withheld: Set<string>;
  refused: boolean;
};

type ChapterRow = {
  block_id: string;
  label: string | null;
  photo_who: string | null;
  listed: boolean | null;
  may_add: boolean | null;
  is_in: boolean | null;
  photos: number | null;
};
type PhotoRow = { guest_capture_id: string | null; seat_photo_id: string | null; block_id: string | null; how: string | null; withheld: boolean | null };

const WHO = new Set(['chapter', 'tagged', 'everybody']);

export async function readMemoriesChapters(supabase: SupabaseClient, eventId: string): Promise<MemoriesChapterRead> {
  const [chaptersRes, photosRes] = await Promise.all([
    supabase.rpc('papic_memories_chapters', { p_event_id: eventId }),
    supabase.rpc('papic_memories_photo_chapters', { p_event_id: eventId }),
  ]);
  if (chaptersRes.error) logQueryError('readMemoriesChapters.chapters', chaptersRes.error, { event_id: eventId });
  if (photosRes.error) logQueryError('readMemoriesChapters.photos', photosRes.error, { event_id: eventId });
  if (chaptersRes.error || photosRes.error) {
    return { chapters: [], ofPhoto: new Map(), withheld: new Set(), refused: true };
  }
  return shapeMemoriesChapters((chaptersRes.data ?? []) as ChapterRow[], (photosRes.data ?? []) as PhotoRow[]);
}

/** The two reads' rows → what the page uses. Exported for the read's own test. */
export function shapeMemoriesChapters(chapterRows: readonly ChapterRow[], photoRows: readonly PhotoRow[]): MemoriesChapterRead {
  const chapters: MemoriesChapter[] = chapterRows.map((r) => ({
    id: r.block_id,
    label: (r.label ?? '').trim() || 'A chapter',
    who: (WHO.has(r.photo_who ?? '') ? r.photo_who : 'chapter') as MemoriesChapter['who'],
    listed: r.listed === true,
    mayAdd: r.may_add === true,
    isIn: r.is_in === true,
    photos: typeof r.photos === 'number' ? r.photos : 0,
  }));
  const ofPhoto = new Map<string, PhotoChapters>();
  const withheld = new Set<string>();
  for (const r of photoRows) {
    const id = r.guest_capture_id ?? r.seat_photo_id;
    if (!id) continue;
    if (r.withheld) {
      withheld.add(id);
      continue;
    }
    if (!r.block_id) continue;
    const pc = ofPhoto.get(id) ?? { in: [], shotIn: [] };
    if (!pc.in.includes(r.block_id)) pc.in.push(r.block_id);
    if (r.how === 'captured' && !pc.shotIn.includes(r.block_id)) pc.shotIn.push(r.block_id);
    ofPhoto.set(id, pc);
  }
  // A photo seen in any chapter is not withheld (the read never says both, but a seen photo must never be dropped).
  for (const id of ofPhoto.keys()) withheld.delete(id);
  return { chapters, ofPhoto, withheld, refused: false };
}
