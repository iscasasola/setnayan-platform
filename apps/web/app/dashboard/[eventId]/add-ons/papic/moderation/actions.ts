'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Iteration 0012 Papic — couple-side UGC moderation actions.
//
// Powers the couple/host gallery-moderation surface (Apple guideline 1.2 /
// Google Play UGC). Three actions, all gated on the caller being a COUPLE on
// the target event:
//   * reportCapture  — files a user_reports row that routes BOTH to the
//                       couple's own queue (event RLS) AND to Setnayan admins
//                       (is_admin RLS on user_reports). This closes the
//                       previously dead-ended report path.
//   * hideCapture     — sets papic_guest_captures.hidden_at so the photo drops
//                       out of the couple's gallery + any public surface.
//   * blockUploader   — EVENT-SCOPED block (owner-locked): inserts an
//                       event_blocked_users row so the uploading guest can no
//                       longer deposit photos into THIS event's gallery. The
//                       block never leaks to other events.
//
// The reads use the RLS-bound server client (the couple's own session); the
// writes use the admin client AFTER the app-level couple check, matching the
// existing add-ons/papic/actions.ts storage-target pattern (events/captures
// writes are RLS-gated and the couple's own session can't always satisfy the
// admin-only or service-definer write rules).

const REASONS = [
  'nudity_sexual',
  'violence',
  'hate_harassment',
  'spam',
  'not_my_event',
  'other',
] as const;
type Reason = (typeof REASONS)[number];

function isReason(v: FormDataEntryValue | null): v is Reason {
  return typeof v === 'string' && (REASONS as readonly string[]).includes(v);
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Verify the caller is signed in and a couple on the target event. Returns the
 * authenticated user id on success; redirects otherwise.
 */
async function requireCouple(eventId: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }
  return { userId: user.id };
}

const MODERATION_PATH = (eventId: string) =>
  `/dashboard/${eventId}/add-ons/papic/moderation`;

/**
 * File a report against a guest capture. Records a user_reports row visible to
 * both the couple and Setnayan admins. The capture must belong to the event.
 */
export async function reportCapture(eventId: string, formData: FormData) {
  const { userId } = await requireCouple(eventId);
  const captureId = formData.get('capture_id');
  const reason = formData.get('reason');
  const details = nullIfBlank(formData.get('details'));

  if (typeof captureId !== 'string' || captureId.length === 0) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_input`);
  }
  if (!isReason(reason)) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_reason`);
  }

  const admin = createAdminClient();

  // Confirm the capture belongs to this event before filing the report.
  const { data: cap } = await admin
    .from('papic_guest_captures')
    .select('capture_id')
    .eq('capture_id', captureId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!cap) {
    redirect(`${MODERATION_PATH(eventId)}?error=not_found`);
  }

  const { error } = await admin.from('user_reports').insert({
    reporter_user_id: userId,
    event_id: eventId,
    target_type: 'photo',
    target_id: captureId,
    reason,
    details,
  });
  if (error) {
    redirect(`${MODERATION_PATH(eventId)}?error=report_failed`);
  }

  revalidatePath(MODERATION_PATH(eventId));
  redirect(`${MODERATION_PATH(eventId)}?reported=1`);
}

/**
 * Hide (or unhide) a guest capture. Hiding sets hidden_at so the photo drops
 * out of the couple's gallery + any public surface; unhide clears it.
 */
export async function setCaptureHidden(eventId: string, formData: FormData) {
  await requireCouple(eventId);
  const captureId = formData.get('capture_id');
  const hide = formData.get('hide') === '1';

  if (typeof captureId !== 'string' || captureId.length === 0) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_input`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('papic_guest_captures')
    .update({ hidden_at: hide ? new Date().toISOString() : null })
    .eq('capture_id', captureId)
    .eq('event_id', eventId);
  if (error) {
    redirect(`${MODERATION_PATH(eventId)}?error=hide_failed`);
  }

  revalidatePath(MODERATION_PATH(eventId));
  redirect(`${MODERATION_PATH(eventId)}?${hide ? 'hidden' : 'unhidden'}=1`);
}

/**
 * Block (event-scoped) the guest who uploaded a capture. The blocked guest can
 * no longer deposit photos into THIS event's gallery; the block never leaks to
 * other events (owner-locked). Idempotent via the (event_id, blocked_guest_id)
 * unique constraint.
 */
export async function blockUploader(eventId: string, formData: FormData) {
  const { userId } = await requireCouple(eventId);
  const guestId = formData.get('guest_id');
  const reason = nullIfBlank(formData.get('reason'));

  if (typeof guestId !== 'string' || guestId.length === 0) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_input`);
  }

  const admin = createAdminClient();

  // Confirm the guest belongs to this event.
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!guest) {
    redirect(`${MODERATION_PATH(eventId)}?error=not_found`);
  }

  const { error } = await admin.from('event_blocked_users').upsert(
    {
      event_id: eventId,
      blocked_guest_id: guestId,
      blocked_by_user_id: userId,
      reason,
    },
    { onConflict: 'event_id,blocked_guest_id', ignoreDuplicates: true },
  );
  if (error) {
    redirect(`${MODERATION_PATH(eventId)}?error=block_failed`);
  }

  revalidatePath(MODERATION_PATH(eventId));
  redirect(`${MODERATION_PATH(eventId)}?blocked=1`);
}

/**
 * Couple override for the always-on NSFW screen: restore a single capture the
 * classifier withheld (moderation_state='nsfw_blocked' → 'clean'). The screen
 * itself can never be disabled (corpus hard constraint) — this only approves
 * ONE photo, and only from the 'nsfw_blocked' state so it can't race or
 * clobber consent/faceblock verdicts. Works on both capture tables.
 */
export async function approveScreenedCapture(eventId: string, formData: FormData) {
  await requireCouple(eventId);
  const table = formData.get('table');
  const id = formData.get('id');

  if (
    (table !== 'papic_guest_captures' && table !== 'papic_photos') ||
    typeof id !== 'string' ||
    id.length === 0
  ) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_input`);
  }
  const idColumn = table === 'papic_photos' ? 'photo_id' : 'capture_id';

  const admin = createAdminClient();
  const { error } = await admin
    .from(table as string)
    .update({ moderation_state: 'clean' })
    .eq(idColumn, id)
    .eq('event_id', eventId)
    .eq('moderation_state', 'nsfw_blocked');
  if (error) {
    redirect(`${MODERATION_PATH(eventId)}?error=approve_failed`);
  }

  revalidatePath(MODERATION_PATH(eventId));
  redirect(`${MODERATION_PATH(eventId)}?approved=1`);
}

/**
 * Lift an event-scoped block so the guest's camera works again on this event.
 */
export async function unblockUploader(eventId: string, formData: FormData) {
  await requireCouple(eventId);
  const guestId = formData.get('guest_id');
  if (typeof guestId !== 'string' || guestId.length === 0) {
    redirect(`${MODERATION_PATH(eventId)}?error=bad_input`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('event_blocked_users')
    .delete()
    .eq('event_id', eventId)
    .eq('blocked_guest_id', guestId);
  if (error) {
    redirect(`${MODERATION_PATH(eventId)}?error=unblock_failed`);
  }

  revalidatePath(MODERATION_PATH(eventId));
  redirect(`${MODERATION_PATH(eventId)}?unblocked=1`);
}
