/**
 * lib/guest-stories-photo-set.ts — the PURE assembly seam for the FREE Guest
 * Stories photo set, split out from lib/guest-stories.ts so it carries NO
 * server-only deps (no `server-only`, no Supabase admin client, no R2 presign).
 *
 * Stories are PHOTO-driven. The DB read in guest-stories.ts excludes guest CLIPS
 * at the query level (`papic_guest_captures … .eq('media_type','photo')`), so a
 * clip-tagged row's source_id never resolves to a key here and falls out of the
 * set — keeping clips out of BOTH the reel input and the "tagged in N photos"
 * count. This module is the testable contract for that, plus a defensive
 * video-extension guard.
 */

/**
 * A tag row from `photo_tags` (newest-first), narrowed to what the photo-set
 * assembly needs.
 */
export type StoryTagRow = { source_id: string };

/**
 * Belt-and-suspenders: even though the DB query already excludes clips
 * (media_type='photo'), refuse any key that is unmistakably a video container.
 * The DB filter is the PRIMARY guard; this only catches a mis-stamped row from
 * reaching the client-side <img> loader (which would reject the whole render
 * with "Could not load a tagged photo"). `.webp` images are NOT matched.
 */
export const VIDEO_KEY_RE = /\.(mp4|mov|m4v|webm)(\?|#|$)/i;

/**
 * Given the ordered tag feed and the keys the (already clip-excluded,
 * clean-screened) media queries returned, build the ordered photo list and
 * report the photo total. A clip-tagged row never has its source_id in
 * `keyById`, so it falls out — both the reel input AND the count reflect
 * photos only.
 */
export function assembleStoryPhotoSet(
  tags: StoryTagRow[],
  keyById: Map<string, string>,
): { ordered: { id: string; key: string }[]; total: number } {
  const ordered = tags
    .map((t) => ({ id: t.source_id, key: keyById.get(t.source_id) }))
    .filter(
      (x): x is { id: string; key: string } =>
        Boolean(x.key) && !VIDEO_KEY_RE.test(x.key as string),
    );
  return { ordered, total: ordered.length };
}
