import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getWallSnapshot } from '@/lib/live-wall';
import { youtubeThumbFromEmbedUrl } from '@/lib/creator-chapters';

/**
 * The photograph a chapter shows on a person's public page.
 *
 * ── RULE 0: THE SAFE-PHOTO PROBLEM IS ALREADY SOLVED ────────────────────────
 * `lib/auto-recap.ts` assembles public-safe pictures for a public surface and
 * states the rule this file obeys: the couple's UNBLURRED masters never appear
 * on a public page. Only two sources are public-safe, and this reuses both
 * rather than inventing a third:
 *
 * ✅ AND IT REACHES EVERYBODY. The wall's entitlement gate was removed when the
 * Live Wall became free for every event (migration 20271137526696) — so any
 * celebration with photographs has public-safe copies, not only the ones that
 * bought a wall. Privacy, moderation and consent gates are untouched.
 *
 *   1. wall-safe derivatives — `wall_safe_r2_key`, faces blurred INTO the
 *      pixels by lib/face-blur.ts, NSFW-screened, and **fail-closed**: a photo
 *      with no baked safe copy simply is not in the snapshot. That is what
 *      makes an image-led public page defensible at all.
 *   2. a video still — the chapter's own YouTube thumbnail, which the profile
 *      timeline has always rendered.
 *
 * 🔒 A CHAPTER NEVER REACHES FOR A CELEBRATION'S PHOTOS UNLESS ITS AUTHOR IS
 * TIED TO THAT CELEBRATION. The database enforces that on the link itself
 * (migration 20271150064636 — a browser caller can only attach a celebration it
 * hosts or was booked on), so an `event_id` on a chapter is already proof of
 * the tie by the time we read it here.
 *
 * 🪤 ONE SNAPSHOT PER CELEBRATION, NOT PER CHAPTER. `getWallSnapshot` is 4–5
 * round trips and presigns R2 URLs; calling it per chapter would multiply a
 * page's cost by its chapter count — the exact defect measured on the event
 * page (95 questions per visitor, 78 of them repeats). Chapters are grouped by
 * their celebration and each one is fetched once.
 *
 * ⚠ A FAILED READ RETURNS NO PICTURE, and a chapter with no picture is a
 * smaller chapter — never a broken one. The layout degrades by size, which is
 * the whole point of deriving size from what exists.
 */

export type ChapterPicture = {
  /** A displayable URL, already presigned. */
  url: string;
  /** How many public-safe pictures that celebration has, for the "412 photos" mark. */
  count: number;
};

/** How many tiles to pull per celebration. One to show, a few for the strip. */
const TILES_PER_EVENT = 5;

/**
 * Resolve one picture per chapter, for every chapter on a page.
 *
 * Keyed by chapter id. A chapter with no celebration and no video is simply
 * absent from the map — callers treat absence as "no picture", which the size
 * rule already knows how to render.
 */
export async function loadChapterPictures(
  chapters: ReadonlyArray<{
    chapter_id: string;
    event_id: string | null;
    embed_url: string | null;
  }>,
): Promise<Map<string, ChapterPicture>> {
  const out = new Map<string, ChapterPicture>();
  if (chapters.length === 0) return out;

  // ── the video still costs nothing: it is derived from a string we hold ────
  for (const c of chapters) {
    const thumb = c.embed_url ? youtubeThumbFromEmbedUrl(c.embed_url) : null;
    if (thumb) out.set(c.chapter_id, { url: thumb, count: 0 });
  }

  // ── the celebrations, once each ──────────────────────────────────────────
  const eventIds = Array.from(
    new Set(chapters.map((c) => c.event_id).filter((id): id is string => !!id)),
  );
  if (eventIds.length === 0) return out;

  try {
    createAdminClient();
  } catch {
    return out; // no service role configured — every chapter is simply picture-less
  }

  const byEvent = new Map<string, ChapterPicture>();
  await Promise.all(
    eventIds.map(async (eventId) => {
      try {
        const snap = await getWallSnapshot(eventId, null, { limit: TILES_PER_EVENT });
        const first = snap.tiles?.[0];
        if (first?.url) {
          byEvent.set(eventId, {
            url: first.url,
            // The honest count is what the wall itself reports; when it does
            // not report one we show no number rather than guessing at "5".
            count: typeof snap.count === 'number' ? snap.count : 0,
          });
        }
      } catch {
        // Rejected, not thrown, is this codebase's most common failure — the
        // only symptom is an absence, and the absence here is correct.
      }
    }),
  );

  // 🔑 THE CELEBRATION BEATS THE VIDEO STILL. A photograph of the actual day is
  // the person's own; a YouTube thumbnail is a frame somebody else's player
  // chose. The still is the fallback, which is why it is written first and
  // overwritten here.
  for (const c of chapters) {
    if (!c.event_id) continue;
    const pic = byEvent.get(c.event_id);
    if (pic) out.set(c.chapter_id, pic);
  }

  return out;
}
