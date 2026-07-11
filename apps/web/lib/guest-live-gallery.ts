/**
 * lib/guest-live-gallery.ts — the per-guest LIVE tagged-photo read for the
 * day-of page ("photos of you, so far").
 *
 * Owner 2026-06-12: "the gallery must be on the on-the-day part." This is the
 * personalized half of that pair (the shared half is the Live Wall mirror):
 * while the wedding runs, a cookie-session guest sees the photos THEY are
 * tagged in arriving through the day — the live form of the post-event
 * "your photos" delivery, powered by the same photo_tags pipeline.
 *
 * SAFETY: admin-client reads are scoped by the caller's verified guest
 * session (the page resolves guest_id from the signed cookie); only
 * `moderation_state = 'clean'` captures are shown (NSFW screen passed,
 * FaceBlock not withheld — same allowlist posture as the wall), and clips
 * are excluded (photo_type = 'photo'); the Living Moments strip owns clip
 * playback. Presigned 1h GET URLs; thumbnails only, capped small — this
 * renders on a venue-WiFi page.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

const URL_TTL_SECONDS = 60 * 60;

export type GuestLivePhoto = {
  id: string;
  /** Which capture table `id` points at — lets the guest drop a wrong auto-tag. */
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  url: string;
};

export type GuestLiveGallery = {
  photos: GuestLivePhoto[];
  /** Total clean tagged captures (may exceed photos.length). */
  total: number;
};

export async function getGuestLiveGallery(
  eventId: string,
  guestId: string,
  limit = 8,
): Promise<GuestLiveGallery | null> {
  try {
    const admin = createAdminClient();
    const { data: tags } = await admin
      .from('photo_tags')
      .select('source_table, source_id, created_at')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('removed_at', null) // a "not me" tombstone drops the photo from this guest
      .order('created_at', { ascending: false })
      .limit(60);
    if (!tags || tags.length === 0) return null;

    const photoIds = tags
      .filter((t) => t.source_table === 'papic_photos')
      .map((t) => t.source_id as string);
    const captureIds = tags
      .filter((t) => t.source_table === 'papic_guest_captures')
      .map((t) => t.source_id as string);

    const [photosRes, capturesRes] = await Promise.all([
      photoIds.length
        ? admin
            .from('papic_photos')
            .select('photo_id, r2_object_key, thumb_r2_key, display_r2_key')
            .in('photo_id', photoIds)
            .eq('moderation_state', 'clean')
            .eq('photo_type', 'photo')
            .is('hidden_at', null)
        : Promise.resolve({
            data: [] as {
              photo_id: string;
              r2_object_key: string;
              thumb_r2_key: string | null;
              display_r2_key: string | null;
            }[],
          }),
      captureIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id, r2_object_key, thumb_r2_key, display_r2_key')
            .in('capture_id', captureIds)
            .eq('moderation_state', 'clean')
            // Guest CLIPS (media_type='clip') are excluded — this gallery is
            // PHOTO-only (see module header); the Living Moments strip owns clip
            // playback. A clip's r2_object_key is an MP4, which would render as a
            // broken thumbnail in the photo grid. Mirrors the photo_type='photo'
            // filter on the papic_photos query above.
            .eq('media_type', 'photo')
            .is('hidden_at', null)
        : Promise.resolve({
            data: [] as {
              capture_id: string;
              r2_object_key: string;
              thumb_r2_key: string | null;
              display_r2_key: string | null;
            }[],
          }),
    ]);

    // Re-order by the tag feed (newest tag first), then presign the cap. Prefer
    // the cheap web copy (thumb → display) over the full-res original — lighter
    // for a thumbnail grid AND drop-safe: once a photo's original is dropped from
    // R2 after 3 months, the web copy is what's left (the row + tags are kept).
    const webRef = (r: {
      r2_object_key: string;
      thumb_r2_key: string | null;
      display_r2_key: string | null;
    }): string => r.thumb_r2_key ?? r.display_r2_key ?? r.r2_object_key;
    const keyById = new Map<string, string>();
    for (const p of photosRes.data ?? []) keyById.set(p.photo_id, webRef(p));
    for (const c of capturesRes.data ?? []) keyById.set(c.capture_id, webRef(c));

    const ordered = tags
      .map((t) => ({
        id: t.source_id as string,
        sourceTable: t.source_table as GuestLivePhoto['sourceTable'],
        key: keyById.get(t.source_id as string),
      }))
      .filter((x): x is { id: string; sourceTable: GuestLivePhoto['sourceTable']; key: string } =>
        Boolean(x.key),
      );

    const top = ordered.slice(0, limit);
    const photos = (
      await Promise.all(
        top.map(async ({ id, sourceTable, key }) => {
          const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS });
          return url ? { id, sourceTable, url } : null;
        }),
      )
    ).filter((p): p is GuestLivePhoto => Boolean(p));

    if (photos.length === 0) return null;
    return { photos, total: ordered.length };
  } catch {
    return null; // gallery trouble must never break the wedding page
  }
}
