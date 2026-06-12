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

export type GuestLivePhoto = { id: string; url: string };

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
            .select('photo_id, r2_object_key')
            .in('photo_id', photoIds)
            .eq('moderation_state', 'clean')
            .eq('photo_type', 'photo')
            .is('hidden_at', null)
        : Promise.resolve({ data: [] as { photo_id: string; r2_object_key: string }[] }),
      captureIds.length
        ? admin
            .from('papic_guest_captures')
            .select('capture_id, r2_object_key')
            .in('capture_id', captureIds)
            .eq('moderation_state', 'clean')
            .is('hidden_at', null)
        : Promise.resolve({ data: [] as { capture_id: string; r2_object_key: string }[] }),
    ]);

    // Re-order by the tag feed (newest tag first), then presign the cap.
    const keyById = new Map<string, string>();
    for (const p of photosRes.data ?? []) keyById.set(p.photo_id, p.r2_object_key);
    for (const c of capturesRes.data ?? []) keyById.set(c.capture_id, c.r2_object_key);

    const ordered = tags
      .map((t) => ({ id: t.source_id as string, key: keyById.get(t.source_id as string) }))
      .filter((x): x is { id: string; key: string } => Boolean(x.key));

    const top = ordered.slice(0, limit);
    const photos = (
      await Promise.all(
        top.map(async ({ id, key }) => {
          const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS });
          return url ? { id, url } : null;
        }),
      )
    ).filter((p): p is GuestLivePhoto => Boolean(p));

    if (photos.length === 0) return null;
    return { photos, total: ordered.length };
  } catch {
    return null; // gallery trouble must never break the wedding page
  }
}
