'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The host adding — or removing — somebody else's chapter from their day.
 *
 * Owner, 2026-08-15: *"they can create a column for that story, and the user
 * can decide to add it or not."*
 *
 * 🔑 THIS IS THE HANDLE. `creator_chapters.host_included_at` decides whether an
 * attached chapter appears anywhere Setnayan speaks about the celebration. A
 * column that nothing can set is the failure this codebase has now hit six
 * times — the control ships in the same change as the column.
 *
 * 🔒 Runs through the service role BECAUSE the host does not own the chapter
 * row: `creator_chapters` RLS is Pattern A (`user_id = auth.uid()`), and the
 * column is revoked from `authenticated` precisely so an author cannot stamp
 * their own piece onto somebody else's wedding. The host's authority is proven
 * here instead, against `event_members`.
 */

async function requireHost(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  // 🪤 A rejected query resolves with { error } rather than throwing, so an
  // unchecked read would let a failed authority check read as a passed one.
  if (error || !data) redirect(`/dashboard/${eventId}`);
  return user.id;
}

/** Add a chapter to this celebration's public story, or take it back off. */
export async function setChapterOnMyDay(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  const chapterId = String(formData.get('chapter_id') ?? '');
  const include = String(formData.get('include') ?? '') === '1';
  if (!eventId || !chapterId) redirect('/dashboard');

  await requireHost(eventId);

  const admin = createAdminClient();
  const { error } = await admin
    .from('creator_chapters')
    .update({ host_included_at: include ? new Date().toISOString() : null })
    .eq('chapter_id', chapterId)
    // 🔒 Scoped to THIS celebration. Without it a host could flip the flag on
    // any chapter id they could guess, including one attached to a different
    // family's wedding.
    .eq('event_id', eventId);
  if (error) {
    redirect(
      `/dashboard/${eventId}/website/stories?error=${encodeURIComponent(
        'Could not save that just now — please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website/stories`);
  revalidatePath('/realstories');
  redirect(`/dashboard/${eventId}/website/stories?saved=1`);
}
