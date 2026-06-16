import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete, type R2BucketName } from '@/lib/r2';
import { eventSamplerIsKept, makeSamplerPermanent } from '@/lib/papic-sampler';

// Free Papic sampler retention (owner-locked 2026-06-16).
//
// Sampler captures are stamped with papic_photos.expires_at = NOW() + 30 days
// (recordSeatCapture). This is the CRON-FREE cleanup: a bounded, best-effort,
// event-scoped sweep that runs in after() on the Papic surfaces — it deletes the
// R2 bytes for any expired sampler photo, then the rows. The 5-year retention
// rule applies ONLY to paid/delivered photos (expires_at IS NULL); this sweep
// can NEVER touch them because it filters on a non-null expires_at in the past.
//
// KEEP = PERMANENT (defense-in-depth). The locked rule is that connecting Google
// Drive OR upgrading to paid Papic makes sampler photos permanent. The convert-
// moment hooks (sku-activation PAPIC_SEATS, the Drive OAuth callback, the storage
// switch) clear expires_at when that happens — but they're best-effort and there
// is a connect-then-sample ordering. So the sweep ALSO guards: before deleting
// anything it asks eventSamplerIsKept(), and for a converted event it SELF-HEALS
// (makeSamplerPermanent → expires_at NULL) instead of deleting. This is the last
// line that makes "kept forever" true even if a convert-moment clear was missed.
//
// Belt-and-suspenders: an R2 object-lifecycle rule on the media bucket gives the
// same byte cleanup for the long tail (a couple who samples and never returns).

const SWEEP_LIMIT = 25;

type SamplerRow = {
  photo_id: string;
  r2_object_key: string | null;
  poster_r2_key: string | null;
};

/**
 * Injectable seams so the sweep is unit-testable without a live DB / R2 — the
 * real implementations are the defaults; a test passes fakes. Keeping the
 * Supabase query builder inside the default closures (rather than threading the
 * client through) avoids leaking its types into the public signature.
 */
export type SweepDeps = {
  isKept?: (eventId: string) => Promise<boolean>;
  makePermanent?: (eventId: string) => Promise<number>;
  fetchExpired?: (
    eventId: string,
    limit: number,
  ) => Promise<{ rows: SamplerRow[]; readError: boolean }>;
  deleteRows?: (photoIds: string[]) => Promise<void>;
  deleteObject?: (ref: { bucket: R2BucketName; key: string }) => Promise<void>;
};

/** Parse a stored `r2://bucket/key` ref into typed parts (or null if not an R2 ref). */
function parseR2Ref(ref: string | null): { bucket: R2BucketName; key: string } | null {
  if (!ref) return null;
  const m = ref.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { bucket: m[1] as R2BucketName, key: m[2] };
}

/**
 * Delete up to SWEEP_LIMIT expired free-sampler photos for one event — UNLESS
 * the event has converted (connected Drive / upgraded), in which case the photos
 * are permanent: self-heal their expiry to NULL and delete nothing. Otherwise
 * delete the R2 bytes first (best-effort; a failed delete orphans the object,
 * never the data), then the rows. NEVER throws: a sweep hiccup must not break the
 * page that triggered it. Returns how many rows were removed.
 */
export async function sweepExpiredSamplerPhotos(
  eventId: string,
  deps: SweepDeps = {},
): Promise<number> {
  const isKept = deps.isKept ?? eventSamplerIsKept;
  const makePermanent = deps.makePermanent ?? makeSamplerPermanent;
  const deleteObject = deps.deleteObject ?? ((ref) => r2Delete(ref));
  const fetchExpired =
    deps.fetchExpired ??
    (async (id: string, limit: number) => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('papic_photos')
        .select('photo_id, r2_object_key, poster_r2_key')
        .eq('event_id', id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .limit(limit);
      return { rows: (data ?? []) as SamplerRow[], readError: Boolean(error) };
    });
  const deleteRows =
    deps.deleteRows ??
    (async (photoIds: string[]) => {
      const admin = createAdminClient();
      await admin.from('papic_photos').delete().in('photo_id', photoIds);
    });

  try {
    // Converted (Drive-connected / upgraded) event → photos are permanent.
    // Self-heal expires_at → NULL rather than merely skipping the delete: the
    // gallery hides any row whose expiry is already in the past, so a skip alone
    // would keep the bytes but still vanish the photos from the couple's view.
    // After the heal the rows are permanent (expires_at IS NULL) and this sweep —
    // which only ever selects non-null, past expiries — can never see them again,
    // preserving the "expires_at IS NULL = permanent" retention rule.
    if (await isKept(eventId)) {
      await makePermanent(eventId);
      return 0;
    }

    const { rows, readError } = await fetchExpired(eventId, SWEEP_LIMIT);
    // Pre-migration (expires_at column absent → read error) or nothing due → no-op.
    if (readError || rows.length === 0) return 0;

    for (const row of rows) {
      for (const ref of [row.r2_object_key, row.poster_r2_key]) {
        const parsed = parseR2Ref(ref);
        if (!parsed) continue;
        try {
          await deleteObject(parsed);
        } catch {
          /* orphaned object — the R2 lifecycle rule cleans it; never fatal */
        }
      }
    }

    const ids = rows.map((r) => r.photo_id);
    await deleteRows(ids);
    return ids.length;
  } catch {
    return 0;
  }
}
