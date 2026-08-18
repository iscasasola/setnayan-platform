'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { reviewVendorChallenge } from '@/lib/papic-games';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  PAPIC_CAMERAS_ORDER_KEY,
  PAPIC_FREE_CAMERA_INDEX_BASE,
  PAPIC_LTD_CAP_FALLBACK_PHP,
  PAPIC_MINI_CAP_FALLBACK_PHP,
  PAPIC_MIN_PAID_CAMERAS,
  PAPIC_UNLI_CAP_FALLBACK_PHP,
  PAPIC_UNLOCK_BUNDLE_KEY,
  PAPIC_UNLOCK_LTD_BUNDLE_KEY,
  computeCameraQuote,
  isPapicUncapped,
  fetchCameraRates,
  mintPapicReferenceCode,
  provisionPaidCamerasAdmin,
} from '@/lib/papic-cameras';
import {
  countLimitedGuests,
  computeLimitedQuote,
  fetchActiveLimitedSnapshot,
  fetchEventPapicWindow,
  syncGuestCameras,
  type LimitedSnapshotRow,
  type LimitedTier,
} from '@/lib/papic-limited';
import {
  fetchPapicOneTiers,
  papicOnePointsForSkuIn,
  papicOneOrderRow,
  resolvePapicOneTarget,
} from '@/lib/papic-one';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { resolvePapicWindow, formatWindowSummary } from '@/lib/papic-window';
import { PAPIC_FIDELITY_VALUES } from '@/lib/papic-fidelity';

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
 * reviewVendorChallengeAction — Papic Games §3.6: approve (→ live) or decline
 * (→ deactivated) a pending vendor custom challenge. The RPC is the authoritative
 * gate: it re-checks couple/coordinator/admin of the mission's event and RAISEs
 * otherwise (a non-member no-ops). We deliberately DON'T reuse getCoupleEventId
 * here — it is couple-only (the RPC + the approval panel's RLS also admit
 * coordinators) and it emits a storage-scoped error message. Flag-gated in the
 * wrapper. Feedback is the revalidated panel (an actioned row leaves "pending").
 */
export async function reviewVendorChallengeAction(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  if (!eventId) {
    redirect('/dashboard');
  }

  const missionId = formData.get('mission_id');
  const decision = formData.get('decision');
  if (
    typeof missionId !== 'string' ||
    missionId.length === 0 ||
    (decision !== 'approve' && decision !== 'reject')
  ) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const supabase = await createClient();
  await reviewVendorChallenge(supabase, {
    missionId,
    approve: decision === 'approve',
  });

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic`);
}

// ==========================================================================
// Couple-authored challenges + curation (Papic Games §5). The couple has RLS
// FOR ALL on papic_missions (couple/coordinator+admin member policy), so these
// are RLS-direct writes — no RPC. The RLS WITH CHECK / USING is the authoritative
// gate: a non-member's write is rejected, so we rely on it (same posture as
// reviewVendorChallengeAction) and redirect plainly; the revalidated manager is
// the feedback. Couple challenges are PRE-APPROVED (the couple authors their own).
// ==========================================================================

/** The couple authors their own generic Photo Challenge. source='couple',
 *  mission_type='prompt', approved=true so it goes live to guests immediately. */
export async function createCoupleChallengeAction(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  const prompt = formData.get('prompt');
  if (!eventId) {
    redirect('/dashboard');
  }
  if (!papicGamesEnabled()) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const supabase = await createClient();
  await supabase.from('papic_missions').insert({
    event_id: eventId,
    mission_type: 'prompt',
    source: 'couple',
    prompt: prompt.trim().slice(0, 280),
    approved: true,
    is_active: true,
  });

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic`);
}

/**
 * Add one of Setnayan's LIBRARY challenges to this event — the couple's story
 * picker (owner 2026-08-10: "make more").
 *
 * 🔑 THE library_id IS THE POINT, NOT THE PROMPT. `createCoupleChallengeAction`
 * above copies free text and leaves library_id NULL, which is right for
 * something the couple wrote. Copying a LIBRARY prompt that way would look
 * identical on screen and be wrong underneath: the board resolver dedupes the
 * Setnayan auto-fill against `couple picks WHERE library_id = …`, so a
 * library-less copy is invisible to that check and the same question lands on
 * the board TWICE — once as theirs, once as ours. Always carry the id.
 *
 * 🔑 AND THE PROMPT IS READ FROM THE LIBRARY, NEVER FROM THE FORM. The form
 * posts an id; the text comes from the table. A client-supplied prompt here
 * would be free-text authoring wearing a library label — it would bypass
 * nothing (the § 2.2 blocklist trigger still fires) but it would let any
 * posted string be stamped with a library_id and inherit its dedup identity.
 */
export async function addLibraryChallengeAction(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  if (!eventId) {
    redirect('/dashboard');
  }
  if (!papicGamesEnabled()) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const rawLibraryId = formData.get('library_id');
  const libraryId = Number(typeof rawLibraryId === 'string' ? rawLibraryId : NaN);
  if (!Number.isInteger(libraryId)) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const supabase = await createClient();

  // The library is SELECT-granted to `authenticated`, so this runs as the
  // couple — no admin client, no widened reach. `is_active` is re-checked here
  // and not trusted from the render: the picker's list was built on a previous
  // request and a row can be retired between the page load and the tap.
  const { data: row, error } = await supabase
    .from('papic_challenge_library')
    .select('library_id,prompt,mission_type,capture_kind,is_active')
    .eq('library_id', libraryId)
    .eq('is_active', true)
    .maybeSingle();
  // A rejected read resolves with `{ error }` and a null row — it never throws.
  // Falling through on that would insert a mission with an empty prompt, so the
  // two cases are handled together and neither one writes.
  if (error || !row) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  // Idempotent: tapping Add twice (or a double-submit) must not put the same
  // question on the board twice. The picker already hides what is taken; this
  // is the guard that survives a stale render.
  const { data: existing } = await supabase
    .from('papic_missions')
    .select('mission_id')
    .eq('event_id', eventId)
    .eq('library_id', libraryId)
    .limit(1);
  if (existing && existing.length > 0) {
    revalidatePath(`/dashboard/${eventId}/studio/papic`);
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  await supabase.from('papic_missions').insert({
    event_id: eventId,
    mission_type: row.mission_type,
    source: 'couple',
    prompt: row.prompt,
    library_id: row.library_id,
    capture_kind: row.capture_kind,
    approved: true,
    is_active: true,
  });

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic`);
}

/** Hide (is_active=false) or show any of the event's missions — auto booth,
 *  approved vendor, or the couple's own. Curation, not deletion. */
export async function setCoupleChallengeActiveAction(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  const missionId = formData.get('mission_id');
  const active = formData.get('active');
  if (!eventId) {
    redirect('/dashboard');
  }
  if (!papicGamesEnabled()) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }
  if (
    typeof missionId !== 'string' ||
    missionId.length === 0 ||
    (active !== 'true' && active !== 'false')
  ) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const supabase = await createClient();
  await supabase
    .from('papic_missions')
    .update({ is_active: active === 'true' })
    .eq('mission_id', missionId)
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic`);
}

/** Delete one of the couple's OWN challenges. Auto/vendor missions are hidden via
 *  the toggle, never deleted here (a deleted auto mission would just regenerate;
 *  a vendor's challenge is theirs) — so this is scoped source='couple'. */
export async function deleteCoupleChallengeAction(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  const missionId = formData.get('mission_id');
  if (!eventId) {
    redirect('/dashboard');
  }
  if (!papicGamesEnabled()) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }
  if (typeof missionId !== 'string' || missionId.length === 0) {
    redirect(`/dashboard/${eventId}/studio/papic`);
  }

  const supabase = await createClient();
  await supabase
    .from('papic_missions')
    .delete()
    .eq('mission_id', missionId)
    .eq('event_id', eventId)
    .eq('source', 'couple');

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic`);
}

/** The five event-wide Papic looks (mirrors the CHECK on events.papic_style and
 *  PapicStyle in lib/papic-photo-styles.ts). Validated server-side so a tampered
 *  form can't write an off-list value. */
const PAPIC_STYLE_VALUES = ['ORIG', 'RETRO', 'MONO', 'CINE', 'LOMO'] as const;

/**
 * Set the event-wide Papic capture look. Couple-only (getCoupleEventId), the
 * chosen style is validated against the allow-list, then written to
 * events.papic_style via the admin client (events writes are RLS-gated).
 * Every camera on the event inherits it at capture time.
 */
export async function setPapicStyle(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const raw = formData.get('style');
  const style = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!(PAPIC_STYLE_VALUES as readonly string[]).includes(style)) {
    redirect(`/dashboard/${eventId}/studio/papic?style_error=invalid`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ papic_style: style })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?style_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic?style_set=${style}`);
}

/**
 * Set the per-event Papic photo fidelity tier (brief PR-4) — the WRITE seam of
 * the single `events.papic_quality_tier` column the capture ingest reads
 * (lib/papic-ingest-fidelity.ts). Couple-only (getCoupleEventId); the value is
 * validated against the shared PAPIC_FIDELITY_VALUES vocabulary (mirrors the
 * column CHECK) so a tampered form can't write an off-list value. Applies to
 * photos captured AFTER the change — existing photos are never re-processed.
 */
export async function setPapicQualityTier(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const raw = formData.get('quality_tier');
  const tier = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!(PAPIC_FIDELITY_VALUES as readonly string[]).includes(tier)) {
    redirect(`/dashboard/${eventId}/studio/papic?quality_error=invalid`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ papic_quality_tier: tier })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/studio/papic?quality_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(`/dashboard/${eventId}/studio/papic?quality_set=${tier}`);
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
  // from the new claimer's per-seat count) WITHOUT deleting
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
// additive: the PAPIC_SEATS pack is untouched.
// ─────────────────────────────────────────────────────────────────────────

/** Read one rung's camera count off the posted form (absent/garbage → 0). */
function rungCount(formData: FormData, field: string): number {
  const n = Number(formData.get(field) ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Buy paid Papic cameras across the THREE rungs — `mini` (₱30) · `ltd` (₱50) ·
 * `unlimited` (₱100) — plus the legacy `roll` field, which is accepted forever
 * and folded into Mini by computeCameraQuote (roll == Mini · see
 * lib/papic-cameras.ts). Validates the minimum + per-rung cap, creates the
 * apply-then-pay order, and provisions the cameras at their rungs. Redirects
 * back to the Papic page with payment instructions (reference code + amount).
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

  const selection = {
    mini: rungCount(formData, 'mini'),
    ltd: rungCount(formData, 'ltd'),
    unlimited: rungCount(formData, 'unlimited'),
    roll: rungCount(formData, 'roll'), // legacy field name → folds into Mini
  };

  const admin = createAdminClient();

  // Cost cap + event date (the per-day validity window; days defaults to 1 —
  // "1 day for ~all weddings" per the per-camera spec).
  const { data: ev } = await admin
    .from('events')
    .select('papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, event_date, event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  const caps = {
    mini: Number(ev?.papic_mini_cap_php ?? 0) || PAPIC_MINI_CAP_FALLBACK_PHP,
    ltd: Number(ev?.papic_ltd_cap_php ?? 0) || PAPIC_LTD_CAP_FALLBACK_PHP,
    unli: Number(ev?.papic_unli_cap_php ?? 0) || PAPIC_UNLI_CAP_FALLBACK_PHP,
  };
  const uncapped = isPapicUncapped(ev?.event_type as string | null);

  // The event's capture window sets BOTH the day multiplier (price) and the
  // seat validity bounds (how long the cameras shoot). Legacy single-day events
  // fall back to 1 day anchored to event_date.
  const win = await fetchEventPapicWindow(admin, eventId);

  // Unlock owners get their tier free + uncapped (money-gated on an ACTIVE pass):
  // PAPIC_UNLOCK → Unli, PAPIC_UNLOCK_LTD (owner 2026-07-11) → Ltd. Each pass
  // covers only its own tier, so an owner never re-pays for cameras it unlocked.
  const ownsUnlock = await eventSkuActive(admin, eventId, PAPIC_UNLOCK_BUNDLE_KEY);
  const ownsUnlockLtd = await eventSkuActive(
    admin,
    eventId,
    PAPIC_UNLOCK_LTD_BUNDLE_KEY,
  );
  const rates = await fetchCameraRates(admin);
  const quote = computeCameraQuote(selection, win.days, rates, caps, {
    unliFree: ownsUnlock,
    // PAPIC_UNLOCK_LTD frees the ₱30 rung it was sold against — today's Mini
    // (legacy 'roll'). It does NOT free the new ₱50 Ltd rung.
    miniFree: ownsUnlockLtd,
    uncapped,
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
  const { data: order, error: orderErr } = await createMoneyWriterClient()
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
      miniCount: quote.miniCount,
      ltdCount: quote.ltdCount,
      unlimitedCount: quote.unlimitedCount,
      validFrom: win.startIso,
      validUntil: win.endIso,
    });
  } catch {
    // swallow — order exists; seats can be topped up on approval.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  if (isFree) {
    // Free Unli provision (umbrella owner) — cameras are already active, no
    // payment instructions. Surface a "your cameras are ready" confirmation.
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_unlock_provisioned=${quote.paidCount}`,
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

  // Chosen tier (owner 2026-06-26 — "upgrade to Unlimited"). Default Limited(roll).
  const rawTier = formData.get('tier');
  const tier: LimitedTier = rawTier === 'unlimited' ? 'unlimited' : 'roll';

  const existing = await fetchActiveLimitedSnapshot(admin, eventId);

  // Already live at the SAME tier → just re-sync (covers late RSVPs) — no new
  // order, no charge.
  if (existing && (existing.tier ?? 'roll') === tier) {
    let synced = { added: 0, revoked: 0, retiered: 0 };
    try {
      synced = await syncGuestCameras(admin, eventId, existing);
    } catch {
      // best-effort — the snapshot is already live.
    }
    revalidatePath(`/dashboard/${eventId}/studio/papic`);
    redirect(`/dashboard/${eventId}/studio/papic?limited_synced=${synced.added}`);
  }

  // Count the list + enforce the 5-camera minimum (the free tier covers the
  // first 5). Applies to a fresh activation AND a tier change/upgrade.
  const guestCount = await countLimitedGuests(admin, eventId);
  if (guestCount < 1) {
    redirect(`/dashboard/${eventId}/studio/papic?limited_error=no_guests`);
  }
  if (guestCount < PAPIC_MIN_PAID_CAMERAS) {
    redirect(`/dashboard/${eventId}/studio/papic?limited_error=below_min`);
  }

  // Rate + cap for the chosen tier (both admin-managed).
  const { data: ev } = await admin
    .from('events')
    .select('papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  const rates = await fetchCameraRates(admin);
  // The capture window sets the day multiplier (and, via syncGuestCameras, the
  // seat validity bounds). Legacy single-day events fall back to 1 day.
  const win = await fetchEventPapicWindow(admin, eventId);
  const ratePhp = tier === 'unlimited' ? rates.unlimited : rates.roll;
  // roll/limited == Mini (owner 2026-07-17 roll->Mini) → Mini cap; non-weddings
  // uncapped (charge runs to the raw subtotal).
  const capPhp = isPapicUncapped(ev?.event_type as string | null)
    ? Number.MAX_SAFE_INTEGER
    : tier === 'unlimited'
      ? Number(ev?.papic_unli_cap_php ?? 0) || PAPIC_UNLI_CAP_FALLBACK_PHP
      : Number(ev?.papic_mini_cap_php ?? 0) || PAPIC_MINI_CAP_FALLBACK_PHP;
  const quote = computeLimitedQuote(guestCount, ratePhp, capPhp, win.days);

  // Tier CHANGE (upgrade to Unlimited / switch back to Limited): supersede the
  // current snapshot first — the one-live-per-event index requires it — and
  // cancel its order while it's still awaiting payment so the couple isn't billed
  // twice. (If the old order was already PAID, it stays; the new order bills the
  // full new tier — delta-billing is a holistic-pricing-pass question, flagged.)
  if (existing) {
    await admin
      .from('papic_limited_snapshots')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .eq('snapshot_id', existing.snapshot_id);
    if (existing.order_id) {
      await admin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('order_id', existing.order_id)
        .eq('status', 'submitted');
    }
  }

  // Apply-then-pay order (the Setnayan team reconciles the transfer). The order
  // layer adds VAT for the customer invoice; requested_total_php is the base.
  const tierLabel = tier === 'unlimited' ? 'Unlimited' : 'Limited';
  const referenceCode = mintPapicReferenceCode();
  const windowLabel = formatWindowSummary(win.startIso, win.endIso);
  const description = `Papic ${tierLabel} — ${guestCount} guest camera${
    guestCount === 1 ? '' : 's'
  }${windowLabel ? ` · ${windowLabel}` : ` · ${win.days} day${win.days === 1 ? '' : 's'}`}`;
  const { data: order, error: orderErr } = await createMoneyWriterClient()
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

  // Record the frozen snapshot at the chosen tier, then materialize / re-tier the
  // guest cameras from it (syncGuestCameras provisions missing + re-tiers any
  // existing guest seats to match).
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
      tier,
    })
    .select(
      'snapshot_id, event_id, order_id, guest_count, rate_php, cap_php, frozen_bill_php, camera_cap, days, status, tier, created_at, activated_at, superseded_at',
    )
    .maybeSingle();
  if (snapErr || !snapRow) {
    redirect(
      `/dashboard/${eventId}/studio/papic?limited_error=${encodeURIComponent(
        (snapErr?.message ?? 'snapshot_failed').slice(0, 64),
      )}`,
    );
  }

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
// Papic · extra cameras — for shooters NOT on the guest list.
//
// The ONLY way to add a camera off the guest list (a videographer friend, a
// hired second shooter). These stay anonymous paparazzi_seats with claim links
// (the per-camera path). Each extra is a deliberate paid camera at the per-day
// rate, so the minimum is 1 (no bulk-of-5 gate — owner UX call 2026-06-26).
//
// Owner 2026-07-20: extras now span the FULL three-rung ladder (Mini ₱30 · Ltd
// ₱50 · Unli ₱100) rather than Unlimited-only. Every rung meters through the
// same capture-points budget from papic_tier_config, so an off-list Mini camera
// is exactly as well-defined as an on-list one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Buy extra cameras off the guest list, at any rung. Min 1 camera total.
 * Apply-then-pay. Accepts `mini` / `ltd` / `unlimited` counts (plus the legacy
 * `roll` field, folded into Mini).
 */
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

  const selection = {
    mini: rungCount(formData, 'mini'),
    ltd: rungCount(formData, 'ltd'),
    unlimited: rungCount(formData, 'unlimited'),
    roll: rungCount(formData, 'roll'), // legacy field name → folds into Mini
  };
  if (selection.mini + selection.ltd + selection.unlimited + selection.roll < 1) {
    redirect(`/dashboard/${eventId}/studio/papic?papic_error=min_extras`);
  }

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, event_date, event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  const caps = {
    mini: Number(ev?.papic_mini_cap_php ?? 0) || PAPIC_MINI_CAP_FALLBACK_PHP,
    ltd: Number(ev?.papic_ltd_cap_php ?? 0) || PAPIC_LTD_CAP_FALLBACK_PHP,
    unli: Number(ev?.papic_unli_cap_php ?? 0) || PAPIC_UNLI_CAP_FALLBACK_PHP,
  };
  const uncapped = isPapicUncapped(ev?.event_type as string | null);

  // Capture window → day multiplier + seat validity bounds (shared with the
  // guest-list cameras so the whole event opens/closes together).
  const win = await fetchEventPapicWindow(admin, eventId);

  // Unlock passes: PAPIC_UNLOCK frees Unli · PAPIC_UNLOCK_LTD frees the ₱30
  // Mini rung (the rung it was sold against — see lib/papic-cameras.ts).
  const [ownsUnlock, ownsUnlockLtd] = await Promise.all([
    eventSkuActive(admin, eventId, PAPIC_UNLOCK_BUNDLE_KEY),
    eventSkuActive(admin, eventId, PAPIC_UNLOCK_LTD_BUNDLE_KEY),
  ]);
  const rates = await fetchCameraRates(admin);
  const quote = computeCameraQuote(selection, win.days, rates, caps, {
    unliFree: ownsUnlock,
    miniFree: ownsUnlockLtd,
    uncapped,
  });

  const isFree = quote.totalPhp === 0;
  const referenceCode = mintPapicReferenceCode();
  const windowLabel = formatWindowSummary(win.startIso, win.endIso);
  const description = `Papic extra cameras — ${quote.rungSummary}${
    windowLabel
      ? ` · ${windowLabel}`
      : ` · ${win.days} day${win.days === 1 ? '' : 's'}`
  }`;
  const { data: order, error: orderErr } = await createMoneyWriterClient()
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

  // Anonymous seats at their chosen rungs (guest_id stays NULL → claim-link model).
  try {
    await provisionPaidCamerasAdmin(admin, {
      eventId,
      orderId: order.order_id,
      miniCount: quote.miniCount,
      ltdCount: quote.ltdCount,
      unlimitedCount: quote.unlimitedCount,
      validFrom: win.startIso,
      validUntil: win.endIso,
    });
  } catch {
    // swallow — order exists; seats can be topped up on approval.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  if (isFree) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_unlock_provisioned=${quote.paidCount}`,
    );
  }
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_purchased=${encodeURIComponent(
      order.public_id,
    )}&papic_ref=${encodeURIComponent(referenceCode)}&papic_amount=${quote.totalPhp}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Papic · CAPTURE WINDOW (owner 2026-06-26 · migration 20270305885232).
//
// The couple picks ONE window for their event's Papic — a start (day + time)
// and an end (day; the time is auto-set to end-of-day). The window sets how long
// every camera can shoot (paparazzi_seats.valid_from/valid_until) — NOT the
// price: Papic is FLAT per camera (2026-07-22 naming lock), no per-day math.
// Event-type rules live in
// lib/papic-window.ts: travel = free range (day 1 → end of trip); every other
// type is anchored to event_date (cover the day, extend BEFORE not AFTER).
//
// Set it BEFORE buying — the pickers read it for the live price. Editing it
// AFTER cameras exist re-stamps their validity bounds so capture stays truthful
// to what's shown; the already-frozen order bill is NOT retro-adjusted (a
// deliberate extension grace — flagged for the pricing-holistic review).
// ─────────────────────────────────────────────────────────────────────────

/** Set (or edit) the event's Papic capture window from the studio picker. */
export async function setPapicWindow(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const startDate = String(formData.get('start_date') ?? '').trim();
  const startTime = String(formData.get('start_time') ?? '').trim();
  const endDate = String(formData.get('end_date') ?? '').trim();

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('event_type, event_date')
    .eq('event_id', eventId)
    .maybeSingle();

  const resolved = resolvePapicWindow({
    eventType: (ev?.event_type as string | null) ?? null,
    eventDate: (ev?.event_date as string | null) ?? null,
    startDate,
    startTime,
    endDate,
  });
  if (!resolved.ok) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_window_error=${resolved.error}`,
    );
  }
  const { window: win } = resolved;

  const { error: updErr } = await admin
    .from('events')
    .update({
      papic_window_start: win.startIso,
      papic_window_end: win.endIso,
    })
    .eq('event_id', eventId);
  if (updErr) {
    redirect(
      `/dashboard/${eventId}/studio/papic?papic_window_error=${encodeURIComponent(
        updErr.message.slice(0, 48),
      )}`,
    );
  }

  // Re-stamp any already-provisioned per-camera seats so their capture window
  // matches the (possibly edited) event window. Per-camera seats live at
  // seat_index >= 100 — the FREE cameras (100..102 · brief PR-3) and the paid
  // range (>= 200); the legacy pack (1–5) keeps its own lifecycle and is
  // untouched. Best-effort — a hiccup never blocks saving the window itself.
  try {
    await admin
      .from('paparazzi_seats')
      .update({ valid_from: win.startIso, valid_until: win.endIso })
      .eq('event_id', eventId)
      .gte('seat_index', PAPIC_FREE_CAMERA_INDEX_BASE)
      .is('revoked_at', null);
  } catch {
    // swallow — the window is saved; seats re-stamp on the next sync.
  }

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_window_saved=${win.days}`,
  );
}

// ── Papic ONE IS RETIRED AS A PURCHASE (owner 2026-08-11) ─────────────────
//
// `purchasePapicOneCamera` lived here: buy a dedicated camera, or reload one.
// It is DELETED rather than left unreachable. Papic is one product now — a
// dedicated camera is MADE by handing shots to a QR (`setCameraShots` at the
// bottom of this file), not bought — so there is no active Papic One rung for
// it to resolve and every call would have died at `unknown_rung`.
//
// 🔑 A BUY PATH FOR A PRODUCT NOBODY CAN BUY IS WORSE THAN NO BUY PATH. It
// reads to the next person as a live product with a broken screen, and the
// honest fix looks like "re-mount the card" rather than "this was retired".
//
// What deliberately STAYS: the activation hooks in lib/sku-activation.ts and
// the deactivated tier rows they resolve against. Deleting a buy path is not
// the same as abandoning the orders it already minted.

/**
 * Buy a Papic POOL top-up — add shots to the event's SHARED pool.
 *
 * The sibling of purchasePapicOneCamera, and deliberately simpler: a pool
 * top-up lands on the EVENT, not on a camera, so there is no seat to provision,
 * nothing to reload, and no mapping row to write. `grantPapicPassPoints`
 * (lib/sku-activation.ts) already resolves the points from `papic_pass_tiers`
 * by service_key on approval and writes ONE `papic_event_point_grants` row with
 * source 'topup_order'. The pool sums grants into its total, so "uncapped and
 * repeatable" needs no new machinery — it is just another row.
 *
 * ⚠ THIS CLOSES A LIVE FAKE DOOR, it does not open a new product. The three
 * PAPIC_GUEST* rows have been is_active=true at owner-set prices since the
 * 2026-07-29 two-type lock, the onboarding services card has been printing the
 * whole ladder, and the Suite card's CTA has read "Open the pool ›" — all
 * pointing at a studio page with no pool ladder on it. The order shape below is
 * the one the approval hook has been waiting for.
 *
 * SEC-4 invariant: the browser posts a service_code — a CHOICE — and the server
 * resolves both the points and the peso figure. Nothing about the amount is
 * client-supplied.
 */
export async function purchasePapicPoolTopUp(formData: FormData) {
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

  const fail = (code: string): never =>
    redirect(`/dashboard/${eventId}/studio/papic?papic_pool_error=${code}`);

  const admin = createAdminClient();

  // The rung must be a LIVE, NON-TOPUP Pool rung. Read from the table, never an
  // allow-list here: a rung an admin deactivates stops being sellable the moment
  // they deactivate it (fetchPapicPassTiers filters is_active), not the next
  // time someone edits this file. `is_topup` is excluded to match the card's
  // ladder exactly — PAPIC_GUEST_TOPUP is retired (superseded by
  // PAPIC_GUEST_10K once every rung became repeatable, 20271019231590) and its
  // activation hook stays wired only so pre-retirement orders still convert.
  // Accepting one here would sell a duplicate of a rung already on the ladder.
  const rawSku = String(formData.get('service_code') ?? '').trim();
  const tiers = await fetchPapicPassTiers(admin);
  const tier = tiers.find((t) => t.serviceCode === rawSku && !t.isTopup);
  const points = tier?.points ?? null;
  if (points === null || points <= 0) fail('unknown_rung');

  // PRICE COMES FROM THE CATALOG, never from the rung table and never from a
  // literal here — the catalog is the single billing source for every SKU.
  // is_active is checked HERE because resolveRetailChargeCentavos() does not: it
  // prices by service_code alone, so a retired rung would still quote. The
  // reject has to happen before an order exists, not after.
  const { data: catalogRow } = await admin
    .from('platform_retail_catalog_v2')
    .select('retail_price_php, is_active')
    .eq('service_code', rawSku)
    .maybeSingle();
  const pricePhp = Number(catalogRow?.retail_price_php ?? 0);
  if (!Number.isFinite(pricePhp) || pricePhp <= 0 || catalogRow?.is_active !== true) {
    fail('unavailable');
  }

  const referenceCode = mintPapicReferenceCode();
  const { data: order, error: orderErr } = await createMoneyWriterClient()
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      service_key: rawSku,
      description: `Papic — adds ${points} shots to this event`,
      requested_total_php: pricePhp,
      reference_code: referenceCode,
      status: 'submitted',
      platform: 'web',
    })
    .select('order_id, public_id')
    .maybeSingle();
  if (orderErr || !order) fail('order_failed');

  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  redirect(
    `/dashboard/${eventId}/studio/papic?papic_purchased=${encodeURIComponent(
      String(order!.public_id),
    )}&papic_ref=${encodeURIComponent(referenceCode)}&papic_amount=${pricePhp}`,
  );
}

/**
 * Keep — or stop keeping — ONE capture's full-resolution original.
 *
 * 🔒 OWNER-LOCKED 2026-08-10: *"they can pick which one to preserve"* and *"if
 * nothing is picked, pick all."* The column stores only the DECLINE, so absent
 * ⚠ OPT-IN (owner 2026-08-10): the column records the PICK, so absent means
 * NOT preserved. This sets or clears that pick for a single capture.
 *
 * ⚠ THIS IS NOT A DELETE. Declining lets the normal sweep replace this ORIGINAL
 * with the compressed copy that already exists. The photo stays in the gallery,
 * kept for life for everyone, paid or not. Say "compressed", never "deleted" —
 * the owner has corrected that vocabulary twice.
 *
 * 🪤 AND IT IS IRREVERSIBLE ONCE THE SWEEP HAS RUN. If the original is already
 * gone (`full_res_dropped_at` set), re-including the capture cannot bring the
 * resolution back, so this REFUSES rather than writing a mark that would quietly
 * do nothing — a control that accepts a tap and changes nothing is worse than
 * one that says no.
 *
 * 🔑 SCOPED TO THE EVENT, NOT JUST THE ID. The update carries `.eq('event_id',
 * eventId)` alongside the row id, so a tampered capture id belonging to another
 * wedding matches zero rows instead of writing there. Authorising one thing and
 * acting on another is the exact shape that left the run-of-show gate open.
 */
export async function setCapturePreserved(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;
  const back = `/dashboard/${eventId}/studio/papic`;

  const captureId = String(formData.get('capture_id') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  // The checkbox posts nothing when unticked, so read an explicit intent marker
  // rather than `formData.has()` — an absent box and "leave it alone" are
  // indistinguishable otherwise, which is how a toggle silently inverts.
  const preserve = String(formData.get('preserve') ?? '') === 'yes';

  if (!captureId || (source !== 'seat' && source !== 'guest')) {
    redirect(`${back}?preserve_error=invalid`);
  }

  const table = source === 'seat' ? 'papic_photos' : 'papic_guest_captures';
  const idCol = source === 'seat' ? 'photo_id' : 'capture_id';

  const admin = createAdminClient();

  const { data: row, error: readErr } = await admin
    .from(table)
    .select(`${idCol}, full_res_dropped_at`)
    .eq(idCol, captureId)
    .eq('event_id', eventId)
    .maybeSingle();

  // Supabase resolves `{ error }` rather than throwing, so an unchecked failure
  // would read as "no such capture" and silently do nothing.
  if (readErr) redirect(`${back}?preserve_error=unreadable`);
  if (!row) redirect(`${back}?preserve_error=not_found`);

  if ((row as { full_res_dropped_at?: string | null }).full_res_dropped_at) {
    // The original is already the compressed copy. Nothing to keep, and nothing
    // this can undo — refuse out loud instead of writing a mark that does nothing.
    redirect(`${back}?preserve_error=already_compressed`);
  }

  const { error: writeErr } = await admin
    .from(table)
    .update({ preserved_at: preserve ? new Date().toISOString() : null })
    .eq(idCol, captureId)
    .eq('event_id', eventId);

  if (writeErr) {
    redirect(`${back}?preserve_error=${encodeURIComponent(writeErr.message.slice(0, 64))}`);
  }

  revalidatePath(back);
  redirect(`${back}?preserve_set=${preserve ? 'kept' : 'released'}`);
}

/**
 * HAND SHOTS TO ONE CAMERA'S QR — or take the unspent ones back.
 *
 * The control the owner asked for on 2026-08-11: *"the host can dedicated a
 * specific number of shots for a specific QR code. and the rest can be
 * distributed to the rest"*. Papic is one product now — you buy shots, and this
 * is where you decide which of them belong to one camera alone.
 *
 * ── IT POSTS A TARGET, NOT A DELTA ─────────────────────────────────────────
 * `shots` is what the camera should hold when this is done, not how many to
 * add. That is what makes lowering it the way you take shots back — giving and
 * taking are the same call, so neither can be the one somebody forgot to build.
 * It also makes a double-submit harmless, which matters on a form a host will
 * tap twice on a bad venue connection.
 *
 * ── WHAT THIS ACTION DOES *NOT* DECIDE ─────────────────────────────────────
 * Every rule about whether the move is allowed lives in `papic_dedicate_shots`,
 * under a row lock, in one transaction: the pot must still hold what is being
 * handed out, the camera cannot drop below what it has already shot, and the
 * camera must belong to this event. None of that is re-implemented here.
 * Deriving the same arithmetic twice is how a screen and a ledger come to
 * disagree — and the screen is the one people believe.
 *
 * SEC-4 holds trivially: nothing about money crosses the wire. The browser
 * posts a camera and a count of shots the couple already owns.
 */
export async function setCameraShots(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;
  const back = `/dashboard/${eventId}/studio/papic`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const fail = (code: string): never =>
    redirect(`${back}?shots_error=${encodeURIComponent(code)}`);

  const seatId = String(formData.get('seat_id') ?? '').trim();
  if (!seatId) fail('unknown_camera');

  const raw = String(formData.get('shots') ?? '').trim();
  const shots = Number(raw);
  // A blank box is not zero. Reading it as zero would silently pull every shot
  // off a camera because somebody cleared the field to retype it.
  if (raw === '' || !Number.isFinite(shots) || shots < 0 || !Number.isInteger(shots)) {
    fail('bad_number');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('papic_dedicate_shots', {
    p_event_id: eventId,
    p_seat_id: seatId,
    p_points: shots,
    p_actor: user!.id,
  });

  if (error) {
    // 🔑 THE REFUSAL HAS TO REACH THE SCREEN. The database refuses with a
    // specific reason; dropping it here would leave the host looking at a
    // number that did not change and no idea why — which is indistinguishable
    // from a button that does nothing. The three the function can raise are
    // mapped; anything else is reported as itself rather than swallowed.
    const message = String(error.message ?? '');
    if (/does not belong to this event/.test(message)) fail('unknown_camera');
    if (/still shared/.test(message)) fail('not_enough_left');
    if (/already taken/.test(message)) fail('already_shot');
    console.error('[papic] setCameraShots failed:', {
      event_id: eventId,
      seat_id: seatId,
      error: message,
    });
    fail('failed');
  }

  revalidatePath(back);
  redirect(`${back}?shots_set=${shots}`);
}
