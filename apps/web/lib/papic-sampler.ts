import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Free Papic sampler — the locked "connect Drive OR upgrade = permanent" rule
// (owner 2026-06-16; migration 20270103000000 lines 6-8). Sampler captures carry
// a 30-day papic_photos.expires_at; converting — connecting Google Drive or
// buying paid Papic — is meant to make them permanent. Nothing used to clear the
// stamp, so the retention sweep deleted the photos of the very couples who DID
// convert, and the gallery hid them at day 30. These two helpers are the single
// place that promise lives.

/**
 * Clear the 30-day expiry on an event's free-sampler photos so they're kept
 * forever. Idempotent (paid / already-kept rows have expires_at NULL and are
 * skipped by the `.not('expires_at','is',null)` filter), service-role (bypasses
 * RLS), and best-effort — it NEVER throws, because a failure here must not roll
 * back a payment activation or a Drive connect. Returns the rows made permanent.
 */
export async function makeSamplerPermanent(eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('papic_photos')
      .update({ expires_at: null })
      .eq('event_id', eventId)
      .not('expires_at', 'is', null)
      .select('photo_id');
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Has this event already "converted" at sampler-capture time — i.e. should new
 * sampler shots be born PERMANENT instead of carrying the 30-day stamp? True
 * when an active Google Drive grant exists for the event (the connect-Drive-
 * THEN-sample ordering). Paid-Papic owners never reach the free sampler (the
 * crew page serves it only to non-owners), so the Drive grant is the realistic
 * signal. Uses the service-role client because the paparazzo-claimer's own
 * session can't read oauth_grants under RLS. Best-effort: any error → false, so
 * the photo just gets the safe 30-day stamp (which makeSamplerPermanent flips
 * the moment the couple converts anyway).
 */
export async function eventSamplerIsKept(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('oauth_grants')
      .select('grant_id')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}
