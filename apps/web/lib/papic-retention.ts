import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete, type R2BucketName } from '@/lib/r2';

// Free Papic sampler retention (owner-locked 2026-06-16).
//
// Sampler captures are stamped with papic_photos.expires_at = NOW() + 30 days
// (recordSeatCapture). This is the CRON-FREE cleanup: a bounded, best-effort,
// event-scoped sweep that runs in after() on the Papic surfaces — it deletes the
// R2 bytes for any expired sampler photo, then the rows. The 5-year retention
// rule applies ONLY to paid/delivered photos (expires_at IS NULL); this sweep
// can NEVER touch them because it filters on a non-null expires_at in the past.
//
// Belt-and-suspenders: an R2 object-lifecycle rule on the media bucket gives the
// same byte cleanup for the long tail (a couple who samples and never returns).
// That's an optional owner hardening — the bytes are gone from the couple's view
// the moment the rows are swept here regardless.

const SWEEP_LIMIT = 25;

/** Parse a stored `r2://bucket/key` ref into typed parts (or null if not an R2 ref). */
function parseR2Ref(ref: string | null): { bucket: R2BucketName; key: string } | null {
  if (!ref) return null;
  const m = ref.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { bucket: m[1] as R2BucketName, key: m[2] };
}

/**
 * Delete up to SWEEP_LIMIT expired free-sampler photos for one event — R2 bytes
 * first (best-effort; a failed delete orphans the object, never the data), then
 * the rows. NEVER throws: a sweep hiccup must not break the page that triggered
 * it. Returns how many rows were removed.
 */
export async function sweepExpiredSamplerPhotos(eventId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: expired, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, poster_r2_key')
      .eq('event_id', eventId)
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())
      .limit(SWEEP_LIMIT);

    // Pre-migration (expires_at column absent → 42703) or any read error → no-op.
    if (error || !expired || expired.length === 0) return 0;

    for (const row of expired) {
      for (const ref of [row.r2_object_key as string | null, row.poster_r2_key as string | null]) {
        const parsed = parseR2Ref(ref);
        if (!parsed) continue;
        try {
          await r2Delete(parsed);
        } catch {
          /* orphaned object — the R2 lifecycle rule cleans it; never fatal */
        }
      }
    }

    const ids = expired.map((r) => r.photo_id as string);
    await admin.from('papic_photos').delete().in('photo_id', ids);
    return ids.length;
  } catch {
    return 0;
  }
}
