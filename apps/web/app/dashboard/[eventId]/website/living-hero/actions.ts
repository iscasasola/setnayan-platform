'use server';

// Server action for the Living Hero Studio (iteration 0046). The boomerang MP4
// + freeze still are baked on the couple's device and PUT directly to R2 via
// /api/upload; this only persists the resulting refs:
//   • landing_page_hero_video_r2_key  ← the boomerang clip (null = photo-only)
//   • landing_page_hero_image_url      ← the freeze still (poster + print + fallback)
// Both columns already exist (lifecycle foundation 20260912000000); the public
// /[slug] hero (HeroBackgroundMedia) already autoplays the video looped with the
// still as poster, so no render change is needed. Auth mirrors the sibling
// hero-photo / site-chrome editors (event_moderators OR legacy couple row).

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function hostUserId(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  return legacy?.member_type === 'couple' ? user.id : null;
}

export async function saveLivingHero(
  eventId: string,
  clipRef: string | null,
  stillRef: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof stillRef !== 'string' || !stillRef.startsWith('r2://')) {
    return { ok: false, error: 'That upload didn’t come through — please try again.' };
  }
  if (clipRef != null && !clipRef.startsWith('r2://')) {
    return { ok: false, error: 'That upload didn’t come through — please try again.' };
  }

  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: 'You don’t have access to this wedding.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update({
      landing_page_hero_video_r2_key: clipRef,
      landing_page_hero_image_url: stillRef,
      landing_page_hero_image_uploaded_at: new Date().toISOString(),
      landing_page_hero_image_uploaded_by_user_id: userId,
    })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) return { ok: false, error: 'Could not save. Please try again.' };

  revalidatePath(`/dashboard/${eventId}/website/living-hero`);
  revalidatePath(`/dashboard/${eventId}/website`);
  if (data?.slug) revalidatePath(`/${data.slug}`);
  return { ok: true };
}
