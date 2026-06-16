import type { R2BucketName } from '@/lib/r2';

// Free Papic sampler retention — PURE core (no 'server-only', no DB/R2 runtime
// imports), so it's unit-testable under `tsx --test`. The server-only wrapper
// `papic-retention.ts` supplies the real seams (createAdminClient queries,
// r2Delete, eventSamplerIsKept, makeSamplerPermanent) and delegates here.
//
// KEEP = PERMANENT (defense-in-depth). The locked rule is that connecting Google
// Drive OR upgrading to paid Papic makes sampler photos permanent. The convert-
// moment hooks clear expires_at when that happens — but they're best-effort, and
// there is a connect-then-sample ordering. So the sweep ALSO guards: for a
// converted event it SELF-HEALS (makeSamplerPermanent → expires_at NULL) instead
// of deleting. Self-heal rather than merely skip, because the couple gallery
// hides any row whose expiry is in the past — a bare skip would keep the bytes
// but still vanish the photos from the couple's view. After the heal the rows are
// permanent (expires_at IS NULL) and this sweep — which only ever selects
// non-null, past expiries — can never see them again.

export const SWEEP_LIMIT = 25;

export type SamplerRow = {
  photo_id: string;
  r2_object_key: string | null;
  poster_r2_key: string | null;
};

/** All seams the sweep needs — injected by the server wrapper, faked by tests. */
export type SweepDeps = {
  isKept: (eventId: string) => Promise<boolean>;
  makePermanent: (eventId: string) => Promise<number>;
  fetchExpired: (
    eventId: string,
    limit: number,
  ) => Promise<{ rows: SamplerRow[]; readError: boolean }>;
  deleteRows: (photoIds: string[]) => Promise<void>;
  deleteObject: (ref: { bucket: R2BucketName; key: string }) => Promise<void>;
};

/** Parse a stored `r2://bucket/key` ref into typed parts (or null if not an R2 ref). */
export function parseR2Ref(
  ref: string | null,
): { bucket: R2BucketName; key: string } | null {
  if (!ref) return null;
  const m = ref.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!m || !m[1] || !m[2]) return null;
  return { bucket: m[1] as R2BucketName, key: m[2] };
}

/**
 * Sweep up to SWEEP_LIMIT expired free-sampler photos for one event — UNLESS the
 * event has converted (Drive-connected / upgraded), in which case the photos are
 * permanent: self-heal their expiry to NULL and delete nothing. Otherwise delete
 * the R2 bytes first (best-effort; a failed object delete orphans the object,
 * never the data), then the rows. NEVER throws. Returns rows removed.
 */
export async function sweepExpiredSamplerPhotosCore(
  eventId: string,
  deps: SweepDeps,
): Promise<number> {
  try {
    if (await deps.isKept(eventId)) {
      await deps.makePermanent(eventId);
      return 0;
    }

    const { rows, readError } = await deps.fetchExpired(eventId, SWEEP_LIMIT);
    // Pre-migration (expires_at column absent → read error) or nothing due → no-op.
    if (readError || rows.length === 0) return 0;

    for (const row of rows) {
      for (const ref of [row.r2_object_key, row.poster_r2_key]) {
        const parsed = parseR2Ref(ref);
        if (!parsed) continue;
        try {
          await deps.deleteObject(parsed);
        } catch {
          /* orphaned object — the R2 lifecycle rule cleans it; never fatal */
        }
      }
    }

    const ids = rows.map((r) => r.photo_id);
    await deps.deleteRows(ids);
    return ids.length;
  } catch {
    return 0;
  }
}
