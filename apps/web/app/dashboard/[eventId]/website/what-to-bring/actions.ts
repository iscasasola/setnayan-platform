'use server';

/**
 * Server action for the What to Bring editor (Increment A.3 ·
 * Wedding_Website_Lifecycle_Spec_2026-06-07). Writes events.what_to_bring
 * (TEXT, shipped 20260918000000). Empty = the WhatToBringWidget on /[slug]
 * renders nothing (section hides). Auth + RLS enforce that only event members
 * (couple / host moderators) can write. Mirrors updateSpecialMessage.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const NOTE_MAX = 600;

export async function updateWhatToBring(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const raw = formData.get('note');
  const note = (typeof raw === 'string' ? raw.trim() : '').slice(0, NOTE_MAX);

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from('events')
    .update({ what_to_bring: note || null })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/what-to-bring?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website`);
  if (event?.slug) revalidatePath(`/${event.slug}`);
  redirect(`/dashboard/${eventId}/website/what-to-bring?saved=1`);
}
