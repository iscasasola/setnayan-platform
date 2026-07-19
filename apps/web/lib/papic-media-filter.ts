/**
 * lib/papic-media-filter.ts — the single source of truth for "is this Papic
 * capture a PHOTO?".
 *
 * ROOT CAUSE this closes (sibling of #2335): a photo-only consumer (an <img> /
 * `new Image()` / `sharp()` decode / photo grid / reel) that reads
 * `papic_guest_captures` but forgets `.eq('media_type','photo')` will pull guest
 * CLIP rows (`media_type='clip'`) whose `r2_object_key` is a video — the consumer
 * then chokes (blank tile, decode reject, broken render). The parallel
 * `papic_photos` table uses `photo_type` for the same distinction.
 *
 * The fix in every photo-only reader is a one-line filter on the query
 * (`.eq('media_type','photo')` for guest captures, `.eq('photo_type','photo')`
 * for seat photos). This module exists so the RULE itself is named + unit-tested
 * once, rather than re-derived per call site:
 *
 *   • PAPIC_GUEST_PHOTO_TYPE / PAPIC_SEAT_PHOTO_TYPE — the column names + the
 *     'photo' literal, so a reader can spell the filter from a constant.
 *   • isPapicPhotoRow() — a defensive client-side predicate for the rare reader
 *     that can't push the filter into SQL and must drop clips after the fact.
 *
 * 'photo' is the column DEFAULT (migration 20270216612756), so rows written
 * before the media_type column existed read back as photos — both the SQL filter
 * and this predicate keep them.
 */

/** Column + literal for the guest-capture photo-only filter. */
export const PAPIC_GUEST_PHOTO_TYPE = { column: 'media_type', value: 'photo' } as const;

/** Column + literal for the seat (papic_photos) photo-only filter. */
export const PAPIC_SEAT_PHOTO_TYPE = { column: 'photo_type', value: 'photo' } as const;

/** The clip discriminator value shared by both tables. */
export const PAPIC_CLIP_VALUE = 'clip' as const;

/**
 * True when a capture row is a PHOTO (not a clip), for a photo-only consumer.
 *
 * Reads whichever discriminator the row carries: `media_type`
 * (papic_guest_captures) or `photo_type` (papic_photos). A row is treated as a
 * photo unless it is EXPLICITLY a clip — so a null/absent/legacy discriminator
 * (pre-migration, or a row that simply didn't select the column) stays a photo,
 * matching the DB default and the untagged-still-delivered posture. Only an
 * exact 'clip' is dropped; this never silently discards a real photo.
 */
export function isPapicPhotoRow(row: {
  media_type?: string | null;
  photo_type?: string | null;
}): boolean {
  const discriminator = row.media_type ?? row.photo_type ?? null;
  return discriminator !== PAPIC_CLIP_VALUE;
}
