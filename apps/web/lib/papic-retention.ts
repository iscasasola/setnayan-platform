import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete } from '@/lib/r2';
import { eventSamplerIsKept, makeSamplerPermanent } from '@/lib/papic-sampler';
import {
  sweepExpiredSamplerPhotosCore,
  type SamplerRow,
} from '@/lib/papic-retention-core';

// Free Papic sampler retention (owner-locked 2026-06-16).
//
// Sampler captures are stamped with papic_photos.expires_at = NOW() + 30 days
// (recordSeatCapture). This is the CRON-FREE cleanup: a bounded, best-effort,
// event-scoped sweep that runs in after() on the Papic surfaces. It deletes the
// R2 bytes for any expired sampler photo, then the rows — UNLESS the event has
// converted (connected Drive / upgraded), in which case the photos are permanent
// and it self-heals their expiry to NULL instead (the last line of defense for
// the "connect Drive OR upgrade = permanent" rule; the convert-moment hooks
// normally clear expires_at already, but they're best-effort).
//
// The 5-year retention rule applies ONLY to permanent rows (expires_at IS NULL);
// this sweep can NEVER touch them — it only ever selects non-null, past expiries.
//
// The orchestration lives in the PURE `papic-retention-core` module so it can be
// unit-tested without a live DB/R2; this wrapper just wires the real seams.

/**
 * Delete (or self-heal, for a converted event) up to SWEEP_LIMIT expired
 * free-sampler photos for one event. NEVER throws. Returns rows removed.
 */
export async function sweepExpiredSamplerPhotos(eventId: string): Promise<number> {
  return sweepExpiredSamplerPhotosCore(eventId, {
    isKept: eventSamplerIsKept,
    makePermanent: makeSamplerPermanent,
    deleteObject: (ref) => r2Delete(ref),
    fetchExpired: async (id, limit) => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('papic_photos')
        .select('photo_id, r2_object_key, poster_r2_key')
        .eq('event_id', id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .limit(limit);
      return { rows: (data ?? []) as SamplerRow[], readError: Boolean(error) };
    },
    deleteRows: async (photoIds) => {
      const admin = createAdminClient();
      await admin.from('papic_photos').delete().in('photo_id', photoIds);
    },
  });
}
