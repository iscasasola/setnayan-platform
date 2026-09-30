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
import {
  buildEventDeleteAuditRow,
  type EventDeleteSnapshot,
} from '@/lib/admin-event-delete-audit';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import {
  GUEST_LIST_REOPEN_ACTION,
  guestListReopenPatch,
  reopenLanded,
} from '@/lib/admin-reopen-guest-list';

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

  /*
    📓 WHO REMOVED IT, AND WHAT WAS IN IT — COLLECTED BEFORE, WRITTEN AFTER.

    `admin_audit_log` has recorded admin actions since June (23 distinct action
    values in prod, append-only by database trigger). The most destructive
    action in the console was not one of them: this function ran, a celebration
    ceased to exist, and nothing anywhere said it had happened or who did it.

    The snapshot has to be taken HERE, for the same reason the media refs are —
    afterwards there is nothing left to name it. The guest and vendor counts
    come back as NULL rather than 0 when they cannot be read, because "we could
    not check" and "there were none" are different sentences and only one of
    them is true.
  */
  const snapshot = await snapshotEventForAudit(admin, eventId);

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

  let media = { collected: mediaRefs?.length ?? 0, swept: 0, failed: 0 };
  if (mediaRefs && mediaRefs.length > 0) {
    const swept = await sweepEventMedia(mediaRefs);
    media = { collected: mediaRefs.length, swept: swept.deleted, failed: swept.failed };
    if (swept.failed > 0) {
      console.error(
        `[admin-delete-event] ${swept.failed} of ${mediaRefs.length} files could not be removed`,
      );
    }
  }

  /*
    Written AFTER the delete has actually succeeded, so a refused delete can
    never leave a record of a wipe that did not happen. The cost of that order
    is the opposite risk — the row is gone and the audit insert fails — so that
    failure is shouted rather than swallowed: Sentry is live in production and
    captures a server-side console.error, which makes an unlogged deletion
    visible somewhere even when its own log could not be written.

    Non-fatal by the same contract as lib/admin-data-access.ts: the celebration
    is already gone by this point, and turning a completed removal into a red
    error screen would tell the admin the opposite of what happened.
  */
  try {
    const { error: auditError } = await admin
      .from('admin_audit_log')
      .insert(
        buildEventDeleteAuditRow({ eventId, adminUserId, snapshot, media }),
      );
    if (auditError) {
      console.error(
        `[admin-delete-event] AUDIT WRITE FAILED for ${eventId} — the celebration is deleted and unrecorded: ${auditError.message}`,
      );
    }
  } catch (e) {
    console.error(
      `[admin-delete-event] AUDIT WRITE THREW for ${eventId} — the celebration is deleted and unrecorded:`,
      e,
    );
  }

  revalidatePath('/admin/events');
}

/**
 * Read the few facts worth keeping about a celebration before it stops
 * existing. Never throws and never blocks the deletion: an unreadable count
 * comes back as null, which the audit row carries as "could not establish"
 * rather than as zero.
 */
async function snapshotEventForAudit(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<EventDeleteSnapshot | null> {
  try {
    const { data: row, error } = await admin
      .from('events')
      .select('public_id, display_name, event_date, event_type, slug, archived, created_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !row) {
      if (error) logQueryError('snapshotEventForAudit', error);
      return null;
    }

    // Two explicit queries rather than one helper over a union of table names:
    // supabase-js resolves its row types from the literal passed to .from(),
    // and a union widens them into an error that only shows up in CI.
    const guests = await admin
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
    if (guests.error) logQueryError('snapshotEventForAudit:guests', guests.error);

    const vendors = await admin
      .from('event_vendors')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
    if (vendors.error) logQueryError('snapshotEventForAudit:event_vendors', vendors.error);

    return {
      public_id: row.public_id ?? null,
      display_name: row.display_name ?? null,
      event_date: row.event_date ?? null,
      event_type: row.event_type ?? null,
      slug: row.slug ?? null,
      archived: row.archived ?? null,
      created_at: row.created_at ?? null,
      guest_count: guests.error ? null : (guests.count ?? null),
      vendor_count: vendors.error ? null : (vendors.count ?? null),
    };
  } catch (e) {
    console.error('[admin-delete-event] snapshot threw (non-fatal):', e);
    return null;
  }
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
  const { adminUserId } = await requireAdmin();

  const eventId = String(formData.get('event_id') ?? '').trim();
  // Where to land afterwards: the per-event admin page, or the Events list.
  // Only these two — never a posted URL.
  const back = (outcome: 'saved' | 'error', code: string): never =>
    redirect(
      formData.get('from') === 'event' && eventId
        ? `/admin/events/${encodeURIComponent(eventId)}?${outcome}=${code}`
        : `/admin/accounts?tab=events&${outcome}=${code}`,
    );
  if (!eventId) back('error', 'missing_event');

  const admin = createAdminClient();

  /*
    🔓 REOPEN A FINALIZED GUEST LIST — a second intent on this action, because
    the server-action budget is at its ceiling and a new export would breach it.

    Writes all three columns (lib/admin-reopen-guest-list.ts says why clearing
    the stamp alone is undone on the couple's next visit). Through the
    service-role client, which is what `guard_pax_finalize_columns` permits and
    what `guard_guest_edits_when_locked` exempts. The row is `.select()`ed back
    so "saved" is only ever said about a write that landed.
  */
  if (formData.get('intent') === 'reopen_guest_list') {
    const { data: before, error: beforeError } = await admin
      .from('events')
      .select('guest_count_locked_at, final_pax, guest_list_edit_deadline')
      .eq('event_id', eventId)
      .maybeSingle();
    if (beforeError) {
      logQueryError('setEventFaceMode:reopen:before', beforeError);
      back('error', 'reopen_read_failed');
    }
    if (!before) back('error', 'reopen_not_found');

    const patch = guestListReopenPatch();
    const { data: after, error: updateError } = await admin
      .from('events')
      .update(patch)
      .eq('event_id', eventId)
      .select('guest_count_locked_at, final_pax, guest_list_edit_deadline');
    if (updateError) {
      logQueryError('setEventFaceMode:reopen', updateError);
      back('error', 'reopen_failed');
    }
    if (!reopenLanded(after, patch)) back('error', 'reopen_not_applied');

    // Non-fatal by the same contract as deleteEvent: the list IS reopened by
    // now, so a failed audit write is shouted, not turned into an error page.
    const { error: auditError } = await admin.from('admin_audit_log').insert({
      action: GUEST_LIST_REOPEN_ACTION,
      target_table: 'events',
      target_id: eventId,
      actor_user_id: adminUserId,
      before_json: before,
      after_json: patch,
    });
    if (auditError) {
      console.error(
        `[admin-reopen-guest-list] AUDIT WRITE FAILED for ${eventId} — the list is reopened and unrecorded: ${auditError.message}`,
      );
    }

    revalidatePath(`/admin/events/${eventId}`);
    back('saved', 'guest_list_reopened');
  }

  const raw = String(formData.get('face_mode') ?? '').trim();
  // Only the two real modes are writable, and anything unrecognised falls to
  // mode_b — the safe side. Never trust a posted string into a biometric gate.
  const mode: PapicFaceMode = raw === 'mode_a' ? 'mode_a' : 'mode_b';

  // `.select()` the row back: an update that matched nothing resolves with no
  // error, and this used to return silently either way — so a switch that did
  // not move looked exactly like one that did.
  const { data: updated, error } = await admin
    .from('events')
    .update({ papic_face_mode: mode })
    .eq('event_id', eventId)
    .select('papic_face_mode');
  if (error) {
    logQueryError('setEventFaceMode', error);
    back('error', 'face_mode_failed');
  }
  if (updated?.length !== 1 || updated[0]?.papic_face_mode !== mode) {
    back('error', 'face_mode_not_applied');
  }

  revalidatePath('/admin/accounts');
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${eventId}`);
  back('saved', mode === 'mode_a' ? 'face_mode_on' : 'face_mode_off');
}
