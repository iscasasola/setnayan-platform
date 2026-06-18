import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';

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
 * when the event has converted by EITHER path: an active Google Drive grant
 * (the couple has their own copy) OR paid Papic ownership (the upgrade). Both are
 * checked here — not just the Drive grant — because this is also the keep-check
 * the retention sweep uses as its backstop, so it must self-heal a paid event
 * even if the PAPIC_SEATS activation hook's best-effort clear was missed. Uses
 * the service-role client (the paparazzo-claimer's own session can't read
 * oauth_grants / orders under RLS). Best-effort: any error → false, so the photo
 * just gets the safe 30-day stamp (which makeSamplerPermanent flips the moment
 * the couple converts anyway).
 */
export async function eventSamplerIsKept(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const admin = createAdminClient();
    // (1) Active Google Drive grant — the couple has their own permanent copy.
    const { data: grant } = await admin
      .from('oauth_grants')
      .select('grant_id')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle();
    if (grant) return true;
    // (2) Owns paid Papic — the upgrade path. Checked HERE (not only at the
    // PAPIC_SEATS activation hook) so the sweep self-heals a paid event even if
    // that hook's best-effort expires_at clear was missed.
    //
    // RETENTION, NOT a feature gate: uses the pending-inclusive eventOwnsPapicSeats
    // (NOT eventSkuActive). A couple who has APPLIED to upgrade (order still
    // 'submitted', under review) has committed — we must NOT delete their sampler
    // photos at day 30 just because the payment isn't verified yet. The payment
    // handshake (owner 2026-06-18) gates FEATURE access on approval; data
    // retention stays pending-inclusive so we never destroy a converting couple's
    // photos. (Reject → the keep-check re-evaluates to false on the next sweep.)
    return await eventOwnsPapicSeats(admin, eventId);
  } catch {
    return false;
  }
}
