'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { cleanStageNote } from '@/lib/stage-notes';

/**
 * SEND A NOTE TO THE HOST — from the EVENT side.
 *
 * ── WHY THIS EXISTS AT ALL, WHEN A SEND PATH ALREADY SHIPPED ────────────────
 * `event_stage_notes` and its four policies already ship (migration
 * 20271111090000), and so does a send box — but only inside the SUPPLIER
 * console, at `/vendor-dashboard/on-the-day/live/[eventId]`. At a Filipino
 * wedding the person running the floor is very often the couple's aunt or a
 * planner the couple invited: she works from the couple's own dashboard and has
 * no supplier account at all. The channel built for her was unreachable by her.
 *
 * ── NOTHING WAS WIDENED TO MAKE THIS WORK ───────────────────────────────────
 * The INSERT policy `event_stage_notes_event_insert` was already written for
 * exactly these people — it admits `current_event_ids()` (the couple) and
 * `moderator_area_level(event_id,'schedule') = 'edit'` (the delegate the couple
 * handed the running order to), alongside the booked coordinator. The gap was
 * a missing SCREEN, not a missing permission. No policy, grant, table or column
 * changes with this.
 *
 * ── WHY NOT LITERALLY CALL THE SUPPLIER-SIDE ACTION ─────────────────────────
 * Because it ends in `redirect('/vendor-dashboard/on-the-day/live/…')`, and the
 * vendor layout bounces anyone without a vendor profile straight to
 * `/dashboard`. Reusing it verbatim would throw the aunt out of the page she is
 * working from on every single send. What IS reused is everything that decides
 * whether a note may be sent and what it may contain: the same
 * `cleanStageNote`, the same caller's-own-client insert, the same
 * session-stamped author, the same policy. Only the landing differs.
 *
 * ⚠ FOLLOW-UP FOR WHOEVER OWNS `lib/stage-notes.ts`: the seven lines of insert
 * below are the supplier-side action's insert. They belong in one exported
 * helper there, with each surface keeping only its own redirect. Guarded
 * meanwhile by `lib/stage-notes-event-side.test.ts`, which asserts both files
 * still stamp the author from the session and never reach for service-role.
 */

function backToSchedule(eventId: string, flash?: 'sent' | 'error'): never {
  redirect(
    `/dashboard/${eventId}/schedule?view=event-day${flash ? `&note=${flash}` : ''}#tell-the-host`,
  );
}

export async function sendStageNoteFromEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const recipient = String(formData.get('recipient_vendor_profile_id') ?? '').trim();
  const body = cleanStageNote(formData.get('body'));

  if (!eventId) redirect('/dashboard');
  // An empty box is a slip, not a failure worth a red banner in the middle of
  // someone's reception — send them back to the same place, unchanged.
  if (!recipient || !body) backToSchedule(eventId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${eventId}/schedule`)}`);
  }

  const { error } = await supabase.from('event_stage_notes').insert({
    event_id: eventId,
    recipient_vendor_profile_id: recipient,
    // From the session, never from the form. The policy checks the same thing,
    // so a forged field would be rejected by the database as well — this keeps
    // the two honest about each other.
    author_user_id: user.id,
    body,
  });

  // A refused insert is the policy saying no. Say "it did not send" rather than
  // going quiet: a note the sender believes landed is the dangerous outcome.
  if (error) backToSchedule(eventId, 'error');

  revalidatePath(`/dashboard/${eventId}/schedule`);
  backToSchedule(eventId, 'sent');
}
