'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { parseStoredAsset } from '@/lib/uploads';
import { r2Delete } from '@/lib/r2';
import { sendEventAccountMagicLink } from '@/lib/event-account-link';
import {
  INVITED_TO_BLOCKS,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type GuestAttire,
  type InvitedToBlock,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { generateEventConnections } from '@/app/dashboard/(account)/people/actions';

// Iteration 0053 P2: the valid role set is per event type (resolveRoleSetForEvent).
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_VALUES: GuestGroupCategory[] = [
  'family',
  'friends',
  'work',
  'school',
  'officiant',
  'other',
];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];
const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function parseInvitedToBlocks(formData: FormData): InvitedToBlock[] {
  const result: InvitedToBlock[] = [];
  for (const block of INVITED_TO_BLOCKS) {
    if (formData.get(`invited_${block}`) === 'on') {
      result.push(block);
    }
  }
  return result;
}

/**
 * Host-initiated email invite (Invite/Join v2). The couple emails this guest a
 * passwordless sign-in link; on click the event is connected to their Setnayan
 * account (via connectEventForUser's email-match). Reuses the exact same
 * machinery as the guest-initiated path — this is just the couple's trigger.
 *
 * Authorized explicitly (couple membership) because sendEventAccountMagicLink
 * uses the service-role client (RLS bypass). The guest must already have an
 * email saved on their row.
 */
export async function inviteGuestByEmailAction(eventId: string, guestId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const backTo = `/dashboard/${eventId}/guests/${guestId}`;
  // Anon-draft boundary: emailing a guest a passwordless sign-in link reaches a
  // third party — a native anonymous principal must secure their plan first.
  if (user.is_anonymous) redirect(`/signup?next=${encodeURIComponent(backTo)}`);

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) return redirect(`/dashboard/${eventId}`);

  const admin = createAdminClient();
  const { data: guest } = await admin
    .from('guests')
    .select('email, deleted_at')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();

  const email = (guest?.email as string | null)?.trim();
  if (!guest || guest.deleted_at || !email) {
    return redirect(`${backTo}?invite=no_email`);
  }

  const { ok } = await sendEventAccountMagicLink({ eventId, guestId, email });
  revalidatePath(backTo);
  return redirect(`${backTo}?invite=${ok ? 'sent' : 'failed'}`);
}

export async function updateGuest(eventId: string, guestId: string, formData: FormData) {
  const first_name = clean(formData.get('first_name'));
  const last_name = clean(formData.get('last_name'));
  const display_name = clean(formData.get('display_name')) || null;
  const side = clean(formData.get('side')) as GuestSide;
  const group_category = clean(formData.get('group_category')) as GuestGroupCategory;
  const role = (clean(formData.get('role')) || 'guest') as GuestRole;
  // What the guest wears on their 3D seat-plan avatar. Validate against the
  // closed set (DB CHECK enforces the same) rather than blindly casting.
  const attireRaw = clean(formData.get('attire')) || 'neutral';
  const attire: GuestAttire = attireRaw === 'gown' || attireRaw === 'suit' ? attireRaw : 'neutral';
  const email = clean(formData.get('email')) || null;
  const mobile = clean(formData.get('mobile')) || null;
  const meal_preference =
    (clean(formData.get('meal_preference')) || null) as MealPreference | null;
  const dietary_restrictions = clean(formData.get('dietary_restrictions')) || null;
  // Tea-ceremony serving order (Chinese / Tsinoy weddings). Both optional: a
  // free-text relationship label + an integer within-side serve order (lower
  // serves first). Parse seniority defensively — non-numeric / empty → null.
  const relation = clean(formData.get('relation')) || null;
  const seniorityRaw = clean(formData.get('seniority_rank'));
  const seniorityParsed = seniorityRaw ? Number.parseInt(seniorityRaw, 10) : NaN;
  const seniority_rank = Number.isFinite(seniorityParsed) ? seniorityParsed : null;
  const rsvp_status = (clean(formData.get('rsvp_status')) || 'pending') as RsvpStatus;
  // Bride & groom are the foundation of the event — always Attending, never
  // Pending (owner directive 2026-06-03). Force it regardless of the submitted
  // value; the DB trigger (migration 20260725000000) enforces the same, this
  // keeps the action self-consistent.
  const effectiveRsvp: RsvpStatus =
    role === 'bride' || role === 'groom' ? 'attending' : rsvp_status;
  const photo_consent = clean(formData.get('photo_consent')) === 'on';
  // FaceBlock (Salamisim P2) — "blur my face on the Live Photo Wall". The
  // wall's read path reacts to this flag instantly (un-baked tiles hide,
  // fail-closed); the re-bake sweep below restores the newest tiles blurred.
  const faceblock_enabled = clean(formData.get('faceblock_enabled')) === 'on';
  // Minor safeguard (DPIA BV-8, 2026-07-05) — host marks a guest excluded from
  // face recognition (typically a minor). When ON, the guest is never enrolled
  // for auto-tagging and any existing enrolment is revoked below. Collects no age.
  const face_recognition_excluded = clean(formData.get('face_recognition_excluded')) === 'on';
  // Plus-one toggle · owner directive 2026-05-23 PM. Host approves
  // permission only; the +1's name + RSVP confirmation lands on the
  // public RSVP widget (PR B follow-up). Toggling OFF is non-
  // destructive — we unflag the primary but DO NOT soft-delete any
  // existing +1 guest row that's already linked via plus_one_of_guest_id.
  // That row stays on the list so the host can manually remove it if
  // they're sure (defends against accidental loss of a real RSVP'd +1
  // to a stray checkbox toggle).
  const plus_one_allowed = clean(formData.get('plus_one_allowed')) === 'on';
  const notes = clean(formData.get('notes')) || null;
  // Custom tags RETIRED 2026-05-23 PM — owner directive: tags now
  // auto-derived from side/group/role/table at render time, host can't
  // pick free-text. Legacy column stays in schema (no migration) but
  // we no longer read or write from this update path. Existing rows'
  // custom_tags values are preserved (the column simply doesn't appear
  // in the .update() call below so it's left untouched).
  const invited_to_blocks = parseInvitedToBlocks(formData);

  const backTo = `/dashboard/${eventId}/guests/${guestId}`;

  if (!first_name || !last_name) {
    return redirect(`${backTo}?error=missing_name`);
  }
  if (!SIDE_VALUES.includes(side)) {
    return redirect(`${backTo}?error=missing_side`);
  }
  if (!GROUP_VALUES.includes(group_category)) {
    return redirect(`${backTo}?error=missing_group`);
  }
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return redirect(`${backTo}?error=invalid_role`);
  }
  if (!RSVP_VALUES.includes(rsvp_status)) {
    return redirect(`${backTo}?error=invalid_rsvp`);
  }
  if (meal_preference && !MEAL_VALUES.includes(meal_preference)) {
    return redirect(`${backTo}?error=invalid_meal`);
  }

  const supabase = await createClient();
  // Smart seat-plan Phase 5: snapshot the tier-affecting fields before the write
  // so we only re-place the guest when role / group_category actually changed.
  const { data: prevGuest } = await supabase
    .from('guests')
    .select('role, group_category')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  const { data: updatedRows, error } = await supabase
    .from('guests')
    .update({
      first_name,
      last_name,
      display_name,
      side,
      group_category,
      role,
      attire,
      email,
      mobile,
      meal_preference,
      dietary_restrictions,
      relation,
      seniority_rank,
      rsvp_status: effectiveRsvp,
      photo_consent,
      faceblock_enabled,
      face_recognition_excluded,
      plus_one_allowed,
      notes,
      invited_to_blocks,
      rsvp_responded_at: ['attending', 'declined'].includes(effectiveRsvp) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .select('guest_id');

  if (error) {
    // The partial unique indexes (bride/groom: migration 20260531010000;
    // Muslim wali/imam/wakil: 20270308998862) raise 23505 (unique_violation)
    // when a second singleton is set. Rewrite the cryptic constraint name into
    // something the couple can act on; everything else falls through.
    const dupRole =
      (error as { code?: string }).code === '23505'
        ? singletonRoleFromIndexError(error.message)
        : null;
    const friendly = dupRole
      ? singletonRoleDuplicateMessage(dupRole)
      : error.message;
    return redirect(`${backTo}?error=${encodeURIComponent(friendly)}`);
  }

  // AUTHORIZATION GATE. The RLS-scoped UPDATE above is the edit-authorization
  // check, but a caller WITHOUT couple/coordinator-edit rights matches 0 rows
  // and returns NO error — so `!error` is not proof of authorization. The
  // service-role biometric mutations below (r2Delete + hard-delete of face
  // enrolments) bypass RLS, so they MUST NOT run unless the RLS UPDATE
  // actually touched the row. Require a returned row before proceeding;
  // otherwise an unauthorized caller could wipe an arbitrary guest's
  // biometrics/selfie via this action.
  if (!updatedRows || updatedRows.length === 0) {
    return redirect(`${backTo}?error=not_authorized`);
  }

  // RA 10173 governance — biometric withdrawal. Two host toggles reach here, and
  // they must be handled DIFFERENTLY (the old code merely set `revoked_at` for
  // both, which left `face_vector` + the full-res R2 selfie sitting in storage
  // indefinitely — the matcher ignored them, but the biometric data survived):
  //
  //  • photo_consent OFF → the selfie must go ENTIRELY. Delete the R2 selfie
  //    objects behind every enrolment for this guest (best-effort; deleting the
  //    row alone orphans the object), then HARD-DELETE the enrolment rows
  //    (destroying face_vector). The selfie display photo is nulled just below.
  //  • face_recognition_excluded, photo consent RETAINED → stop biometric
  //    processing only: revoke + NULL the face_vector, but KEEP the selfie image
  //    (it's still a consented display photo, and it shares the R2 object with
  //    the enrolment asset — deleting it would break the retained photo).
  //
  // Run the biometric mutations through the SERVICE-ROLE admin client, NOT the
  // user JWT. The guests UPDATE above is the edit-authorization gate — it only
  // succeeds for a couple (couple_writes_guest) OR a co-host/coordinator with
  // guest_list='edit' (guests_moderator_write is FOR ALL, migration
  // 20261129003000). But the ONLY write policy on guest_face_enrollments is
  // couple_writes_face_enrollment (couple/admin-only, migration 20260901000000)
  // — a coordinator's enrolment DELETE would silently match 0 rows under the
  // user JWT, leaving face_vector alive with revoked_at NULL (matcher still
  // treats it live) while r2Delete (not RLS-gated) already removed the selfie:
  // a dangling asset + a retained biometric — the exact RA 10173 gap this closes.
  // Mirrors how the account-deletion purge (admin/users/actions.ts) uses the
  // admin client. Gated on the already-succeeded, edit-authorized guests update;
  // still hard-scoped to (event_id, guest_id). Best-effort throughout.
  const bioAdmin = createAdminClient();
  if (!photo_consent) {
    const { data: enrols } = await bioAdmin
      .from('guest_face_enrollments')
      .select('asset_url')
      .eq('event_id', eventId)
      .eq('guest_id', guestId);
    for (const row of enrols ?? []) {
      const asset = parseStoredAsset((row as { asset_url?: string | null }).asset_url);
      if (asset?.kind !== 'r2') continue;
      try {
        await r2Delete({ bucket: asset.bucket, key: asset.key });
      } catch {
        /* best-effort — a storage hiccup must not block consent withdrawal */
      }
    }
    await bioAdmin
      .from('guest_face_enrollments')
      .delete()
      .eq('event_id', eventId)
      .eq('guest_id', guestId);
  } else if (face_recognition_excluded) {
    await bioAdmin
      .from('guest_face_enrollments')
      .update({ revoked_at: new Date().toISOString(), face_vector: null, vector_model: null })
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('revoked_at', null);
  }
  // Turning photo consent OFF additionally clears the selfie display photo (a
  // Gmail avatar, display-only + non-biometric, is left intact). A face-
  // recognition EXCLUSION does NOT delete the guest's photo — it only stops
  // biometric enrolment (handled above).
  if (!photo_consent) {
    await supabase
      .from('guests')
      .update({
        photo_url: null,
        photo_source: null,
        photo_updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .eq('photo_source', 'selfie');
  }

  // FaceBlock ON ⇒ existing wall tiles without a baked blur derivative are
  // hidden from the projection at the next read (fail-closed, instant). The
  // bounded sweep re-bakes the NEWEST tiles in the background so the wall
  // doesn't go dark; already-baked rows short-circuit, so re-saving with the
  // box still checked is cheap.
  if (faceblock_enabled) {
    after(async () => {
      // Hide this guest as the PUBLIC author of every Kwento they wrote (P2
      // parity with the wall) — best-effort, must not block the wall re-bake.
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        await createAdminClient().rpc('set_guest_messages_hidden_by_faceblock', {
          p_guest_id: guestId,
        });
      } catch {
        /* message-hide is best-effort; the wall re-bake below is the priority */
      }
      const { rebakeWallForEvent } = await import('@/lib/face-blur');
      await rebakeWallForEvent(eventId);
    });
  }

  // Phase 2 (person-graph · flag-off in prod): naming a bride/groom may complete
  // the SPOUSE connection PROPOSAL (once both principals resolve to a person).
  // Idempotent + flag-guarded + host-authorized inside the action; runs after
  // the response so it never delays the save. No-ops until both sides link.
  if ((role === 'bride' || role === 'groom') && peopleConnectionsEnabled()) {
    after(async () => {
      try {
        await generateEventConnections(eventId);
      } catch {
        /* non-blocking — edges regenerate idempotently on the next role/roster edit */
      }
    });
  }

  // Smart seat-plan Phase 5: role + group_category drive the seating tier — re-place
  // this guest (and their +1) only when one of those actually changed on this save.
  if (prevGuest && (prevGuest.role !== role || prevGuest.group_category !== group_category)) {
    await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [guestId] });
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(backTo);
  // Owner directive 2026-05-22: when information is saved on guest,
  // it needs to return to guest list. The guests list page consumes
  // ?saved=1 to render a "Saved." flash banner.
  return redirect(`/dashboard/${eventId}/guests?saved=1`);
}

export async function softDeleteGuest(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const supabase = await createClient();

  // RSVP-set gate (owner directive 2026-05-23) — block delete when the
  // guest has already responded (rsvp_status != 'pending'). 'pending' is
  // the only "haven't replied yet" state; attending / declined / maybe
  // are all "RSVP already set". The bulk-delete path enforces the same
  // gate; this single-guest path mirrors it for consistency.
  const { data: row, error: readErr } = await supabase
    .from('guests')
    .select('role, rsvp_status, first_name, last_name, display_name')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();

  if (readErr) {
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(readErr.message)}`,
    );
  }
  if (!row) {
    redirect(`/dashboard/${eventId}/guests?error=not_found`);
  }
  // The bride & groom are the foundation of the event — renamable, never
  // removable (owner directive 2026-06-03). Checked before the RSVP gate so
  // the couple gets the right message (they're always Attending, which would
  // otherwise trip the generic "already RSVP'd" copy).
  if (row.role === 'bride' || row.role === 'groom') {
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(
        "The bride and groom are the foundation of the event and can't be removed.",
      )}`,
    );
  }
  if (row.rsvp_status !== 'pending') {
    const displayName =
      row.display_name?.trim() || `${row.first_name} ${row.last_name}`.trim();
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(
        `${displayName || 'This guest'} has already RSVP'd — reset their RSVP to "Pending" before removing.`,
      )}`,
    );
  }

  // Release the seat assignment first (best-effort; the soft-delete
  // proceeds even if there's no row, since event_seat_assignments
  // doesn't have a row for every guest). Hard-delete here matches the
  // ON DELETE CASCADE intent — soft-deleting the guest wouldn't trip
  // the FK cascade because deleted_at is just a flag.
  await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  const { error } = await supabase
    .from('guests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/guests/${guestId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(`/dashboard/${eventId}/guests?removed=1`);
}
