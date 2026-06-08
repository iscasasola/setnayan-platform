'use server';

/**
 * Server action for the Special Message editor (Increment A.1 ·
 * Wedding_Website_Lifecycle_Spec_2026-06-07 §6.5).
 *
 * Writes events.special_message (TEXT, shipped 20260912000000). Empty = the
 * SpecialMessageWidget on /[slug] renders nothing (the section hides). Auth +
 * RLS enforce that only event members (couple / host moderators) can write —
 * runs with the host's JWT, not the admin client. Mirrors updateDressCode.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const MESSAGE_MAX = 600;

export async function updateSpecialMessage(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const raw = formData.get('message');
  const message = (typeof raw === 'string' ? raw.trim() : '').slice(0, MESSAGE_MAX);

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from('events')
    .update({ special_message: message || null })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/special-message?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website`);
  if (event?.slug) revalidatePath(`/${event.slug}`);
  redirect(`/dashboard/${eventId}/website/special-message?saved=1`);
}
