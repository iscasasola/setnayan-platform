'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { cleanStageNote } from '@/lib/stage-notes';

/**
 * Send a note to one supplier — the coordinator → emcee channel — and mark one
 * as seen.
 *
 * Both write with the CALLER'S OWN client. The policies on
 * `event_stage_notes` are the gate: the event side and the booked coordinator
 * may insert, and only the addressed supplier may stamp `read_at`. Using a
 * service-role client here would replace all of that with our own idea of it.
 */

function back(eventId: string, flash?: string): never {
  redirect(
    `/vendor-dashboard/on-the-day/live/${eventId}${flash ? `?stageNote=${flash}` : ''}`,
  );
}

export async function sendStageNote(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const recipient = String(formData.get('recipient_vendor_profile_id') ?? '').trim();
  const body = cleanStageNote(formData.get('body'));

  if (!eventId) redirect('/vendor-dashboard/on-the-day');
  // An empty note is a slip, not an error worth a banner — send them back
  // unchanged rather than shouting at someone mid-service.
  if (!recipient || !body) back(eventId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/vendor-dashboard/on-the-day/live/${eventId}`)}`);
  }

  const { error } = await supabase.from('event_stage_notes').insert({
    event_id: eventId,
    recipient_vendor_profile_id: recipient,
    // Stamped from the session, never from the form — this is what stops a note
    // being filed under someone else's name, and the policy checks it too.
    author_user_id: user.id,
    body,
  });

  if (error) back(eventId, 'error');

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  back(eventId, 'sent');
}

/**
 * The emcee marks a note as seen.
 *
 * Only they can: the UPDATE policy checks the recipient, so a sender cannot
 * stamp their own note read. A receipt the sender can forge is not a receipt.
 */
export async function markStageNoteSeen(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const noteId = String(formData.get('note_id') ?? '').trim();
  if (!eventId || !noteId) redirect('/vendor-dashboard/on-the-day');

  const supabase = await createClient();
  await supabase
    .from('event_stage_notes')
    .update({ read_at: new Date().toISOString() })
    .eq('note_id', noteId)
    .is('read_at', null);

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  back(eventId);
}
