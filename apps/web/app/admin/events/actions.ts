'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  collectEventMediaRefs,
  sweepEventMedia,
} from '@/lib/event-media-sweep';
import type { PapicFaceMode } from '@/lib/papic-face-mode';

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
  await requireAdmin();
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid event_id');
  }

  const admin = createAdminClient();

  // 🔒 THE ADDRESS IS HELD BY THE DATABASE, NOT HERE.
  //
  // This action used to write the `event_closed` hold itself. That covered the
  // admin path and ONLY the admin path — prod carries a live RLS policy
  // (`couple_can_delete_event`) letting a couple delete their own wedding
  // straight through PostgREST, with no server action involved and no hold
  // written. Removing the button closes the button, not the door.
  //
  // Migration `20271138150255` moves it into a BEFORE DELETE trigger, so every
  // path — this one, a direct API call, and one nobody has written yet — holds
  // the word. Writing it here too would be a second, driftable copy.
  /*
    🚨 THE FILES GO TOO — AND UNTIL 2026-08-28 THEY DID NOT.

    The couple's own removal collects every R2 object first and sweeps them
    after the row is gone, because afterwards there is nothing left to name
    them: the keys live on the photo rows and on the celebration itself, and
    both disappear with the DELETE. This path did not, so an admin removal left
    the photographs sitting in storage — unreachable, because the rows that
    named them were gone — while the product's own confirmation tells the couple
    "your photos and everything about this celebration are deleted for good".

    A promise made on one screen is not kept by the path that happens to run.
    Collected BEFORE, swept AFTER, best-effort: the celebration is already gone
    by then and a failed object delete must not turn a completed removal into an
    error message.
  */
  const mediaRefs = await collectEventMediaRefs(eventId);

  const { error } = await admin.from('events').delete().eq('event_id', eventId);
  if (error) throw new Error(error.message);

  if (mediaRefs && mediaRefs.length > 0) {
    const swept = await sweepEventMedia(mediaRefs);
    if (swept.failed > 0) {
      console.error(
        `[admin-delete-event] ${swept.failed} of ${mediaRefs.length} files could not be removed`,
      );
    }
  }

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
