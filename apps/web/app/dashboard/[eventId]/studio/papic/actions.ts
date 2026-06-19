'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { makeSamplerPermanent } from '@/lib/papic-sampler';
import { cancelSamplerExpiryWarnings } from '@/lib/papic-sampler-emails';

// Iteration 0012 Papic — storage-target server actions.
//
// Server actions for the storage-choice radio cards on the Papic setup
// page. The two actions share most of their logic; they're split so the
// form posts read cleanly ("setPapicStorageR2" / "setPapicStorageDrive")
// instead of relying on a hidden "target" field.
//
// Both actions:
//   1. Verify caller is signed in and a couple on the target event.
//   2. Refuse to switch to google_drive_only without an active
//      oauth_grants row (provider='drive', revoked_at IS NULL). The
//      Connect-Drive flow handles that upsert; switching to Drive before
//      connecting would leave the capture pipeline in a broken state.
//   3. Update events.papic_storage_target via the admin client (events
//      writes are RLS-gated; admin client bypasses the gate after the
//      app-level couple check above).
//   4. Revalidate the Papic setup page so the radio reflects the new
//      state on the next render.

async function getCoupleEventId(rawEventId: FormDataEntryValue | null): Promise<{
  ok: true;
  eventId: string;
} | { ok: false; redirectTo: string }> {
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  if (!eventId) {
    return { ok: false, redirectTo: '/dashboard' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, redirectTo: '/login' };
  }

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return {
      ok: false,
      redirectTo: `/dashboard/${eventId}/studio/papic?storage_error=not_a_couple`,
    };
  }

  return { ok: true, eventId };
}

/**
 * Switch Papic photo storage to Setnayan R2 (the default, recommended).
 * Always safe to call — no Drive grant is required.
 */
export async function setPapicStorageR2(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ papic_storage_target: 'setnayan_r2' })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?storage_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic?storage_set=r2`);
}

/**
 * Switch Papic photo storage to Google Drive only. Requires an active
 * oauth_grants row for the event (provider='drive', revoked_at IS NULL).
 * Refuses the switch otherwise — the UI gates the button on connection
 * state, but the server checks again so a stale form submission can't
 * leave the capture pipeline pointed at a phantom Drive grant.
 */
export async function setPapicStorageDrive(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const admin = createAdminClient();

  // Defensive re-check: only flip the target if the couple has actually
  // connected their Drive. The page hides the button when there's no
  // grant, but the server checks again so a stale form submission can't
  // leave the capture pipeline pointed at a phantom grant.
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle();
  if (!grant) {
    redirect(
      `/dashboard/${eventId}/studio/papic?storage_error=connect_drive_first`,
    );
  }

  const { error } = await admin
    .from('events')
    .update({ papic_storage_target: 'google_drive_only' })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?storage_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  // Switching Papic storage to Drive also satisfies "connect Drive = permanent":
  // make any already-captured sampler photos permanent + cancel the expiry
  // emails. (The OAuth callback usually does this at connect time; this covers a
  // switch made after the grant already existed.) Best-effort, never throws.
  await makeSamplerPermanent(eventId);
  await cancelSamplerExpiryWarnings(eventId);

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic?storage_set=drive`);
}

// ─────────────────────────────────────────────────────────────────────────
// Papic · 5 Seats — couple-side seat lifecycle (provision + reissue).
//
// PAPIC_SEATS (₱2,999 · "Turn five friends into your photo crew"). The
// paparazzi_seats table + RLS + the provision/claim RPCs ship in migrations
// 20260520015000 + 20260718000000. These actions are the couple's hands on
// that backend, from the /crew management surface:
//   • provisionPapicSeats — materialize the 5 seats (idempotent RPC) once the
//     event owns a paid PAPIC_SEATS order.
//   • reissuePapicSeat — mint a fresh claim token + clear the claimer on one
//     seat (a friend dropped out / the link leaked). The couple has full RLS
//     on their event's seats, so this is a plain UPDATE under their session.
//
// Both go through `getCoupleEventId` above (signed-in + couple-on-event), and
// provisioning calls the RPC under the COUPLE's session (createClient · the
// SECURITY DEFINER fn re-checks auth.uid() is a couple + the event owns
// PAPIC_SEATS, so a forged call can't provision someone else's seats).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Materialize the 5 paparazzi seats for an event that owns PAPIC_SEATS.
 * Idempotent — re-running only tops up missing seat indexes, never disturbs
 * already-claimed seats. Calls papic_provision_seats() under the couple's
 * session so the fn's auth.uid() couple + ownership checks pass.
 */
export async function provisionPapicSeats(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const supabase = await createClient();
  const { error } = await supabase.rpc('papic_provision_seats', {
    p_event_id: eventId,
  });

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic/crew?seat_error=${encodeURIComponent(
        error.message.slice(0, 80),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic/crew`);
  redirect(`/dashboard/${eventId}/studio/papic/crew?seat_set=provisioned`);
}

/**
 * Materialize the 3 FREE SAMPLER seats so a couple can TRY Papic before buying.
 * Couple-gated + idempotent + one-per-event — the papic_provision_sampler() RPC
 * re-checks auth.uid() is a couple and won't re-provision an event that already
 * has sampler seats. No paid ownership needed (it's free); the sampler seats sit
 * in their own seat_index range so they never collide with a later paid pass.
 */
export async function provisionPapicSampler(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const supabase = await createClient();
  const { error } = await supabase.rpc('papic_provision_sampler', {
    p_event_id: eventId,
  });

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic/crew?seat_error=${encodeURIComponent(
        error.message.slice(0, 80),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic/crew`);
  redirect(`/dashboard/${eventId}/studio/papic/crew?seat_set=sampler`);
}

/**
 * Reissue one seat: clear the claimer + claimed_at, lift any revoke, and mint
 * a fresh claim_qr_token so the old link/QR stops working and the couple can
 * hand the seat to someone new. The couple's paparazzi_seats_couple_full RLS
 * permits the UPDATE under their own session.
 */
export async function reissuePapicSeat(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const rawSeatId = formData.get('seat_id');
  const seatId = typeof rawSeatId === 'string' ? rawSeatId.trim() : '';
  if (!seatId) {
    redirect(`/dashboard/${eventId}/studio/papic/crew?seat_error=missing_seat`);
  }

  // 18 crypto-random bytes → 36 hex chars · same entropy posture as the RPC's
  // gen_random_bytes(18) seed and the guest qr_token format.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const freshToken = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const supabase = await createClient();
  const { error } = await supabase
    .from('paparazzi_seats')
    .update({
      claim_qr_token: freshToken,
      claimer_user_id: null,
      claimed_at: null,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('seat_id', seatId)
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic/crew?seat_error=${encodeURIComponent(
        error.message.slice(0, 80),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic/crew`);
  redirect(`/dashboard/${eventId}/studio/papic/crew?seat_set=reissued`);
}
