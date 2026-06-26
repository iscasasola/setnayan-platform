'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { makeSamplerPermanent } from '@/lib/papic-sampler';
import { cancelSamplerExpiryWarnings } from '@/lib/papic-sampler-emails';
import {
  PAPIC_CAMERAS_ORDER_KEY,
  PAPIC_LTD_CAP_FALLBACK_PHP,
  PAPIC_MIN_PAID_CAMERAS,
  PAPIC_UNLI_CAP_FALLBACK_PHP,
  PAPIC_UNLOCK_BUNDLE_KEY,
  computeCameraQuote,
  fetchCameraRates,
  mintPapicReferenceCode,
  provisionPaidCamerasAdmin,
} from '@/lib/papic-cameras';
import {
  countLimitedGuests,
  computeLimitedQuote,
  fetchActiveLimitedSnapshot,
  syncGuestCameras,
  type LimitedSnapshotRow,
} from '@/lib/papic-limited';

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

  // Reissue hands the seat to a NEW friend — reset the per-seat capture caps so
  // they start clean. Mark the prior claimer's captures superseded (excluded
  // from the new claimer's per-seat count + free-sampler cap) WITHOUT deleting
  // them: every photo still belongs to the event and still appears in the
  // couple's gallery (untagged-/superseded-still-delivered). Best-effort and
  // result-ignored — the token is already rotated, so a stamping hiccup (or a
  // pre-migration DB without superseded_at) must not fail the reissue.
  await supabase
    .from('papic_photos')
    .update({ superseded_at: new Date().toISOString() })
    .eq('paparazzi_seat_id', seatId)
    .is('superseded_at', null);

  revalidatePath(`/dashboard/${eventId}/studio/papic/crew`);
  redirect(`/dashboard/${eventId}/studio/papic/crew?seat_set=reissued`);
}

// ─────────────────────────────────────────────────────────────────────────
// Alaala showcase orb — couple-approval toggle (producer half of the feed).
//
// The memory orb on the public /our-story manifesto crossfades Papic clips,
// but ONLY ones that have cleared BOTH consent gates (owner-locked rule
// project_setnayan_alaala_orb_video_consent):
//   • consent_to_public            — the guest consented (set by the guest-
//                                    consent flow; a follow-up — see the
//                                    page note + CHANGELOG).
//   • couple_approved_for_showcase — the couple picked the clip → THIS action.
//
// This is the couple's gate. It flips couple_approved_for_showcase on one of
// their event's clips under the couple's own RLS session (papic_photos_couple
// _full permits the UPDATE). The orb stays cold until a clip clears both gates,
// so approving alone won't surface anything until guest consent also lands —
// that's the locked cold-start behaviour, preserved.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Toggle whether one of the couple's Papic CLIPS is approved for the public
 * Alaala showcase orb. `approve` carries the desired state ('1' = approve);
 * idempotent. Scoped to (event_id, photo_id) under the couple's session.
 */
export async function setClipShowcaseApproval(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const rawPhotoId = formData.get('photo_id');
  const photoId = typeof rawPhotoId === 'string' ? rawPhotoId.trim() : '';
  if (!photoId) {
    redirect(`/dashboard/${eventId}/studio/papic?showcase_error=missing_photo`);
  }
  const approve = formData.get('approve') === '1';

  const supabase = await createClient();
  const { error } = await supabase
    .from('papic_photos')
    .update({ couple_approved_for_showcase: approve })
    .eq('photo_id', photoId)
    .eq('event_id', eventId)
    .eq('photo_type', 'clip');

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?showcase_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  // Refresh the gallery (couple) + the public manifesto orb (ISR) so the change
  // shows on the next render of either surface.
  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  revalidatePath('/our-story');
  redirect(
    `/dashboard/${eventId}/studio/papic?showcase_set=${approve ? 'approved' : 'removed'}`,
  );
}

/**
 * Toggle whether one of the couple's GUEST-RECORDED clips is approved for the
 * public Alaala showcase orb (Option A — the producer half the orb feed reads).
 *
 * Mirrors setClipShowcaseApproval but for papic_guest_captures: the GUEST sets
 * consent_to_public at capture time (their own recording → the cleanest
 * consent); THIS action is the couple's approval gate. Both gates required
 * before the clip surfaces, so approving alone won't light the orb until the
 * guest also opted in — the locked cold-start, preserved.
 *
 * Unlike the seat-clip toggle, the couple has only a READ policy on
 * papic_guest_captures (papic_guest_captures_couple_read) — no couple UPDATE
 * policy. So the write goes through the admin client AFTER the app-level couple
 * check (the same pattern setPapicStorageR2/Drive use to update events), scoped
 * to (capture_id, event_id) so a forged call can't touch another event's clip.
 */
export async function setGuestClipShowcaseApproval(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const rawCaptureId = formData.get('photo_id');
  const captureId = typeof rawCaptureId === 'string' ? rawCaptureId.trim() : '';
  if (!captureId) {
    redirect(`/dashboard/${eventId}/studio/papic?showcase_error=missing_photo`);
  }
  const approve = formData.get('approve') === '1';

  const admin = createAdminClient();
  const { error } = await admin
    .from('papic_guest_captures')
    .update({ couple_approved_for_showcase: approve })
    .eq('capture_id', captureId)
    .eq('event_id', eventId)
    .eq('media_type', 'clip');

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?showcase_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  revalidatePath('/our-story');
  redirect(
    `/dashboard/${eventId}/studio/papic?showcase_set=${approve ? 'approved' : 'removed'}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Papic · per-CAMERA buy flow (owner-locked 2026-06-26 · PR2).
//
// A camera = a paparazzi seat with a tier. Beyond the free funnel cameras, a
// couple buys paid cameras at Roll (₱30/camera/day) or Unlimited
// (₱100/camera/day), 5-camera minimum, capped per tier (events.papic_ltd_cap_php / papic_unli_cap_php)
// (default ₱6,999). Prices are admin-managed (read from the catalog). This is
// apply-then-pay: the order lands at status='submitted' for the Setnayan team
// to reconcile, and the paid cameras are materialized immediately as PENDING
// seats (paid_order_id set) so the couple can prep invites — but capture stays
// blocked until the order is paid (the presign gate is PR3). Strictly
// additive: the free sampler + the PAPIC_SEATS pack are untouched.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Buy paid Papic cameras (Roll + Unlimited counts in the form). Validates the
 * 5-camera minimum + cost cap, creates the apply-then-pay order, and provisions
 * the cameras at their tiers. Redirects back to the Papic page with payment
 * instructions (reference code + amount).
 */
export async function purchasePapicCameras(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  // The guard already verified couple membership; re-read the user for the
  // order's purchaser id (the same createClient session the guard used).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const roll = Number(formData.get('roll') ?? 0);
  const unlimited = Number(formData.get('unlimited') ?? 0);

  const admin = createAdminClient();

  // Cost cap + event date (the per-day validity window; days defaults to 1 —
  // "1 day for ~all weddings" per the per-camera spec).
  const { data: ev } = await admin
    .from('events')
    .select('papic_ltd_cap_php, papic_unli_cap_php, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const caps = {
    ltd: Number(ev?.papic_ltd_cap_php ?? 0) || PAPIC_LTD_CAP_FALLBACK_PHP,
    unli: Number(ev?.papic_unli_cap_php ?? 0) || PAPIC_UNLI_CAP_FALLBACK_PHP,
  };
  const eventDate = (ev?.event_date as string | null) ?? null;

  // PAPIC_UNLOCK umbrella owners get the Unli tier free + uncapped (owner
  // 2026-06-26): quote with unliFree so the Unli charge collapses to ₱0. Roll
  // (Ltd) still bills normally — the umbrella covers Unli only.
  const ownsUnlock = await eventSkuActive(admin, eventId, PAPIC_UNLOCK_BUNDLE_KEY);
  const rates = await fetchCameraRates(admin);
  const quote = computeCameraQuote({ roll, unlimited }, 1, rates, caps, {
    unliFree: ownsUnlock,
  });

  if (quote.paidCount < PAPIC_MIN_PAID_CAMERAS) {
    redirect(`/dashboard/${eventId}/studio/papic?papic_error=min_cameras`);
  }

  // Order shape: when the whole quote is free (an umbrella owner provisioning
  // Unli only), nothing needs reconciling — the order lands 'fulfilled' (a ₱0
  // comp the ACTIVE PAPIC_UNLOCK already covers) so the cameras shoot at once.
  // Otherwise it's the apply-then-pay 'submitted' order the Setnayan team
  // reconciles (the Roll part); any free Unli seats provisioned on that same
  // order are freed by the capture-gate PAPIC_UNLOCK bypass (papic/actions +
  // api/upload). requested_total_php is the pre-VAT base (the order layer adds
  // VAT for the customer invoice, same as every other SKU).
  const isFree = quote.totalPhp === 0;
  const referenceCode = mintPapicReferenceCode();
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: PAPIC_CAMERAS_ORDER_KEY,
      description: quote.description,
      requested_total_php: quote.totalPhp,
      reference_code: referenceCode,
      status: isFree ? 'fulfilled' : 'submitted',
      platform: 'web',
    })
    .select('order_id, public_id')
    .maybeSingle();

  if (orderErr || !order) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_error=${encodeURIComponent(
        (orderErr?.message ?? 'order_failed').slice(0, 64),
      )}`,
    );
  }

  // Materialize the paid cameras (PENDING — capture blocked until paid, PR3).
  // Best-effort: a provisioning hiccup must not strand the order the couple
  // already owes on (the activation hook / a later top-up can recover seats).
  try {
    await provisionPaidCamerasAdmin(admin, {
      eventId,
      orderId: order.order_id,
      rollCount: quote.rollCount,
      unlimitedCount: quote.unlimitedCount,
      validFrom: eventDate,
      validUntil: eventDate,
    });
  } catch {
    // swallow — order exists; seats can be topped up on approval.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  if (isFree) {
    // Free Unli provision (umbrella owner) — cameras are already active, no
    // payment instructions. Surface a "your cameras are ready" confirmation.
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_unlock_provisioned=${quote.unlimitedCount}`,
    );
  }
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_purchased=${encodeURIComponent(
      order.public_id,
    )}&papic_ref=${encodeURIComponent(referenceCode)}&papic_amount=${quote.totalPhp}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Papic · LIMITED = the guest list (owner-locked 2026-06-26).
//
// "Ready for Papic" turns the couple's guest list into Limited cameras: every
// guest who hasn't declined gets one camera (their personal QR is the credential)
// + their own gallery. The count auto-derives from the list — no stepper. Sold
// ONCE via a reversible snapshot; after that, late "yes" RSVPs are covered for
// free within the cost cap by syncGuestCameras (the page calls it on render).
//
// Re-tapping "Ready for Papic" when Limited is already live is a FREE re-sync,
// never a second charge (the "no surprise charge" rule). A fresh paid activation
// happens only when there is no live snapshot.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Activate (or re-sync) Papic Limited for the event's guest list. Apply-then-pay
 * on the first activation; a free re-sync once Limited is already live.
 */
export async function activatePapicLimited(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const admin = createAdminClient();

  // Already live? Just re-sync (covers late RSVPs) — no new order, no charge.
  const existing = await fetchActiveLimitedSnapshot(admin, eventId);
  if (existing) {
    let synced = { added: 0, revoked: 0 };
    try {
      synced = await syncGuestCameras(admin, eventId, existing);
    } catch {
      // best-effort — the snapshot is already live.
    }
    revalidatePath(`/dashboard/${eventId}/studio/papic`);
    redirect(
      `/dashboard/${eventId}/studio/papic?limited_synced=${synced.added}`,
    );
  }

  // Fresh activation — count the list, quote against the live Ltd rate + cap.
  // Minimum 5 cameras (owner 2026-06-26): the free tier already covers the first
  // 5, so paid Limited starts at a 5-guest list — mirrors PAPIC_MIN_PAID_CAMERAS.
  const guestCount = await countLimitedGuests(admin, eventId);
  if (guestCount < 1) {
    redirect(`/dashboard/${eventId}/studio/papic?limited_error=no_guests`);
  }
  if (guestCount < PAPIC_MIN_PAID_CAMERAS) {
    redirect(`/dashboard/${eventId}/studio/papic?limited_error=below_min`);
  }

  const { data: ev } = await admin
    .from('events')
    .select('papic_ltd_cap_php')
    .eq('event_id', eventId)
    .maybeSingle();
  const capPhp = Number(ev?.papic_ltd_cap_php ?? 0) || PAPIC_LTD_CAP_FALLBACK_PHP;
  const rates = await fetchCameraRates(admin);
  const quote = computeLimitedQuote(guestCount, rates.roll, capPhp, 1);

  // Apply-then-pay order (the Setnayan team reconciles the transfer). The order
  // layer adds VAT for the customer invoice; requested_total_php is the base.
  const referenceCode = mintPapicReferenceCode();
  const description = `Papic Limited — ${guestCount} guest camera${
    guestCount === 1 ? '' : 's'
  } · 1 day`;
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: PAPIC_CAMERAS_ORDER_KEY,
      description,
      requested_total_php: quote.frozenBillPhp,
      reference_code: referenceCode,
      status: 'submitted',
      platform: 'web',
    })
    .select('order_id, public_id')
    .maybeSingle();
  if (orderErr || !order) {
    redirect(
      `/dashboard/${eventId}/studio/papic?limited_error=${encodeURIComponent(
        (orderErr?.message ?? 'order_failed').slice(0, 64),
      )}`,
    );
  }

  // Record the frozen snapshot, then materialize the guest cameras from it.
  const { data: snapRow, error: snapErr } = await admin
    .from('papic_limited_snapshots')
    .insert({
      event_id: eventId,
      order_id: order.order_id,
      guest_count: guestCount,
      rate_php: quote.ratePhp,
      cap_php: quote.capPhp,
      frozen_bill_php: quote.frozenBillPhp,
      camera_cap: quote.cameraCap,
      days: quote.days,
      status: 'pending_payment',
    })
    .select(
      'snapshot_id, event_id, order_id, guest_count, rate_php, cap_php, frozen_bill_php, camera_cap, days, status, created_at, activated_at, superseded_at',
    )
    .maybeSingle();
  if (snapErr || !snapRow) {
    redirect(
      `/dashboard/${eventId}/studio/papic?limited_error=${encodeURIComponent(
        (snapErr?.message ?? 'snapshot_failed').slice(0, 64),
      )}`,
    );
  }

  // Provision the guest cameras (PENDING — capture is blocked until the order is
  // paid, same per-camera presign gate). Best-effort: a hiccup must not strand
  // the order; the page's render-time sync recovers any missing cameras.
  try {
    await syncGuestCameras(admin, eventId, snapRow as LimitedSnapshotRow);
  } catch {
    // swallow — snapshot exists; sync runs again on the next render.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_purchased=${encodeURIComponent(
      order.public_id,
    )}&papic_ref=${encodeURIComponent(referenceCode)}&papic_amount=${quote.frozenBillPhp}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Papic · UNLIMITED extras — cameras for shooters NOT on the guest list.
//
// The ONLY way to add a camera off the guest list (a videographer friend, a
// hired second shooter). Off-list shooters have no guest record + no personal
// gallery, so they're Unlimited only — uncapped, archived to Drive. Each extra
// is a deliberate paid camera at the per-day rate, so the minimum is 1 (no
// bulk-of-5 gate — owner UX call 2026-06-26; flagged for pricing review). These
// stay anonymous paparazzi_seats with claim links (the existing per-camera path).
// ─────────────────────────────────────────────────────────────────────────

/** Buy N Unlimited extra cameras (off the guest list). Min 1. Apply-then-pay. */
export async function purchasePapicExtras(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const unlimited = Number(formData.get('unlimited') ?? 0);
  if (!Number.isFinite(unlimited) || unlimited < 1) {
    redirect(`/dashboard/${eventId}/studio/papic?papic_error=min_extras`);
  }

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('papic_ltd_cap_php, papic_unli_cap_php, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const caps = {
    ltd: Number(ev?.papic_ltd_cap_php ?? 0) || PAPIC_LTD_CAP_FALLBACK_PHP,
    unli: Number(ev?.papic_unli_cap_php ?? 0) || PAPIC_UNLI_CAP_FALLBACK_PHP,
  };
  const eventDate = (ev?.event_date as string | null) ?? null;

  // PAPIC_UNLOCK owners get Unli free + uncapped.
  const ownsUnlock = await eventSkuActive(admin, eventId, PAPIC_UNLOCK_BUNDLE_KEY);
  const rates = await fetchCameraRates(admin);
  const quote = computeCameraQuote({ roll: 0, unlimited }, 1, rates, caps, {
    unliFree: ownsUnlock,
  });

  const isFree = quote.totalPhp === 0;
  const referenceCode = mintPapicReferenceCode();
  const description = `Papic Unlimited extras — ${quote.unlimitedCount} camera${
    quote.unlimitedCount === 1 ? '' : 's'
  } · 1 day`;
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: PAPIC_CAMERAS_ORDER_KEY,
      description,
      requested_total_php: quote.totalPhp,
      reference_code: referenceCode,
      status: isFree ? 'fulfilled' : 'submitted',
      platform: 'web',
    })
    .select('order_id, public_id')
    .maybeSingle();
  if (orderErr || !order) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_error=${encodeURIComponent(
        (orderErr?.message ?? 'order_failed').slice(0, 64),
      )}`,
    );
  }

  // Anonymous Unlimited seats (guest_id stays NULL → claim-link model).
  try {
    await provisionPaidCamerasAdmin(admin, {
      eventId,
      orderId: order.order_id,
      rollCount: 0,
      unlimitedCount: quote.unlimitedCount,
      validFrom: eventDate,
      validUntil: eventDate,
    });
  } catch {
    // swallow — order exists; seats can be topped up on approval.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  if (isFree) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_unlock_provisioned=${quote.unlimitedCount}`,
    );
  }
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_purchased=${encodeURIComponent(
      order.public_id,
    )}&papic_ref=${encodeURIComponent(referenceCode)}&papic_amount=${quote.totalPhp}`,
  );
}
