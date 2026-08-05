'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The couple turns face tagging off — or back on — for their own event.
 *
 * ── ONLY EVER NARROWS ───────────────────────────────────────────────────────
 * Setting this to true forces the event to mode_b whatever an admin chose.
 * Setting it back to false only RESTORES the admin's setting; it cannot switch
 * face tagging on where an admin has not, and cannot touch the
 * christening/debut lock. So "on" here means "I don't object", never "enable".
 *
 * ── WHY SERVICE-ROLE, AND WHY THAT IS SAFE ──────────────────────────────────
 * `events` UPDATE is column-privileged and its RLS is ROW-level, so any column
 * the `authenticated` role can write is writable by anyone who can update the
 * row at all. This column is therefore withheld and the write goes through the
 * admin client — AFTER the membership check below, which is what actually
 * authorises it. Exactly the shape the livestream audience switch uses.
 */
export async function setCoupleFaceTaggingDeclined(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const declined = String(formData.get('declined') ?? '') === '1';
  const back = `/dashboard/${eventId}/studio/papic`;
  if (!eventId) redirect('/dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  // THE AUTHORISATION. Only a `couple` member of this event may decide this —
  // not a coordinator, not a supplier, not any other member type. Read with the
  // caller's own client so RLS applies to the check itself.
  const { data: membership } = await supabase
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  if (!membership) redirect(back);

  const { error } = await createAdminClient()
    .from('events')
    .update({ face_tagging_declined_by_couple: declined })
    .eq('event_id', eventId);

  if (error) redirect(`${back}?faceTagging=error`);

  revalidatePath(back);
  redirect(`${back}?faceTagging=${declined ? 'off' : 'on'}`);
}
