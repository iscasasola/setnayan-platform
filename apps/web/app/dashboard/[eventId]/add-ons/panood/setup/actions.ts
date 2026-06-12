'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';

/**
 * Server actions for the Panood setup page's watch-URL field — the FIRST real
 * persistence on this surface (everything else is still the 0011 mock seam).
 *
 * The couple pastes their YouTube watch/share/live link; we normalize to the
 * canonical https://www.youtube.com/watch?v=<id> form (lib/panood-watch.ts)
 * and persist to events.panood_watch_url (migration 20261122000000). The
 * guest day-of page embeds it (youtube-nocookie) during the live window when
 * PANOOD_SYSTEM is active. Non-YouTube input is silently dropped — the value
 * renders in an iframe on the public wedding page, so normalize-or-reject is
 * the injection barrier. When the broadcaster auto-creation lands (YouTube
 * Data API), it writes this same column and this manual field becomes the
 * fallback.
 *
 * Auth mirrors the shipped requireHostMembership pattern (hero-photo /
 * site-editor actions): moderators OR legacy couple membership; RLS on events
 * UPDATE is the backstop.
 */

async function requireHostMembership(eventId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple') return;

  redirect('/dashboard');
}

export async function savePanoodWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const urlRaw = formData.get('watch_url');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (typeof urlRaw !== 'string') return;

  const normalized = normalizeYouTubeWatchUrl(urlRaw);
  if (!normalized) {
    // Not a YouTube video URL — bounce back with a flag the page surfaces.
    redirect(`/dashboard/${eventId}/add-ons/panood/setup?watch_url_error=1`);
  }

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: normalized })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/add-ons/panood/setup?watch_url_saved=1`);
}

export async function clearPanoodWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase
    .from('events')
    .update({ panood_watch_url: null })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/add-ons/panood/setup`);
  revalidatePath('/[slug]', 'page');
  redirect(`/dashboard/${eventId}/add-ons/panood/setup`);
}
