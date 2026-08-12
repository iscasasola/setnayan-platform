'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import {
  CLOSED_EVENT_SLUG_ENTITY_TYPE,
  closedEventSlugHeldUntil,
} from '@/lib/closed-shop-slug';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { adminUserId: user.id };
}

/**
 * Hard-delete an event. Most child tables (guests, event_members, seating,
 * budget, schedule, RSVPs) CASCADE on events.event_id, so they go with it.
 * Orders + payouts have ON DELETE SET NULL on event_id, so their audit
 * trail survives but loses the event link. Not reversible — admins who
 * want recoverability should set archived=TRUE instead via the existing
 * archive flow.
 *
 * V1 admin-only — no soft "0 confirmed vendors" gate like couple-side
 * self-delete (0021 § 10.1). Admin is expected to read the confirm prompt
 * and proceed knowingly.
 */
export async function deleteEvent(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid event_id');
  }

  const admin = createAdminClient();

  // 🔒 HOLD THE ADDRESS FIRST — owner 2026-08-12: "a retired website address
  // will only be usable again after 1 year."
  //
  // Deleting the row frees its `slug` the same second. Measured in prod before
  // this shipped: the final address of an already-deleted wedding was claimable
  // immediately — so every invitation, save-the-date and printed QR carrying it
  // could have been handed to a stranger, and the guest following one would land
  // on somebody else's page. Every other retirement already held its word (a
  // rename for the forwarding window, a closed shop for a year); deletion was
  // the hole, and it is the case with the least warning.
  //
  // BEFORE the delete, deliberately: read the slug while the row still exists.
  // Best-effort on the WRITE — a ledger hiccup must not block an admin
  // deletion, which may itself be an erasure obligation.
  const { data: doomed } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  const retiredSlug = (doomed as { slug?: string | null } | null)?.slug?.trim();
  if (retiredSlug) {
    await admin.from('slug_change_log').insert({
      entity_type: CLOSED_EVENT_SLUG_ENTITY_TYPE,
      entity_id: eventId,
      old_slug: retiredSlug.toLowerCase(),
      // NOT NULL, and nothing reads it for a closure — the resolver filters to
      // the forwarding types and routes via entity_id, never this. Same value
      // so the row cannot be misread as a move to somewhere else.
      new_slug: retiredSlug.toLowerCase(),
      redirect_until: closedEventSlugHeldUntil(),
      changed_by: adminUserId,
    });
  }

  const { error } = await admin.from('events').delete().eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/events');
}

/**
 * Turn face auto-tagging ON or OFF for ONE event (`events.papic_face_mode`).
 *
 * ── WHY THIS ACTION HAS TO EXIST ────────────────────────────────────────────
 * `papic_face_mode` decides whether a guest's face descriptor is stored at all:
 * `faceVectorForMode` HARD-NULLS the vector on anything but an explicit
 * `mode_a`, at the DB boundary, so a crafted POST cannot slip one through.
 *
 * Until now NOTHING IN THE APP COULD WRITE THAT COLUMN. Every event in
 * production sat in `mode_b`, the column is revoked from `authenticated` and
 * `anon` (migration 20271005100000), and no server action, admin surface or
 * script ever set it. So the face models the owner activated on 2026-06-19 ran
 * and stored nothing — the feature was on at the app and off at the wall, with
 * no switch in between. Owner decision 2026-08-04: "on".
 *
 * ── WHY IT IS ADMIN-ONLY, AND STAYS ADMIN-ONLY ──────────────────────────────
 * The migration revoked this column from hosts deliberately: it is the
 * biometric switch, and it is DPIA-relevant. `service_role` keeps UPDATE, so an
 * admin action is the intended path — the DPO decides, per event, on the
 * record. Do NOT add a host-facing control without a DPO ruling.
 *
 * ⚠ THE MIGRATION'S OWN NOTE ON THIS COLUMN IS STALE. It says mode_a "turns on
 * 128-d face embedding for EVERY guest with no per-guest opt-in roster." There
 * IS a per-guest opt-in, enforced server-side on BOTH enrolment writers:
 * `biometric_consent` must be ticked, `age_affirmation` (18+) must be ticked,
 * and the RSVP path additionally refuses any guest the host marked
 * `face_recognition_excluded`. No tick, no vector — regardless of mode. What
 * mode_a changes is whether a CONSENTING adult's descriptor is kept.
 *
 * Christening and debut events stay forced to mode_b by
 * `FORCE_MODE_B_EVENT_TYPES` no matter what this writes — the guardian-consent
 * workflow does not exist, and that gate is not this action's to open.
 */
export async function setEventFaceMode(formData: FormData): Promise<void> {
  await requireAdmin();

  const eventId = String(formData.get('event_id') ?? '').trim();
  const raw = String(formData.get('face_mode') ?? '').trim();
  if (!eventId) return;
  // Only the two real modes are writable, and anything unrecognised falls to
  // mode_b — the safe side. Never trust a posted string into a biometric gate.
  const mode: PapicFaceMode = raw === 'mode_a' ? 'mode_a' : 'mode_b';

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ papic_face_mode: mode })
    .eq('event_id', eventId);
  if (error) {
    logQueryError('setEventFaceMode', error);
    return;
  }

  revalidatePath('/admin/accounts');
  revalidatePath('/admin/events');
}
