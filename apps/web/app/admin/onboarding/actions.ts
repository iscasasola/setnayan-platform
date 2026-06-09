'use server';

/**
 * /admin/onboarding server actions.
 *
 * Houses the onboarding-flow CONFIG knobs (currently the wedding onboarding's
 * background music), grouped here so that as Setnayan opens more onboarding
 * types (birthday, corporate, …), each type's settings have one home rather
 * than being scattered across the generic /admin/settings page.
 *
 * `updateOnboardingMusic` was moved here from apps/web/app/admin/settings/
 * actions.ts (owner 2026-06-09 "group any custom settings needed for the
 * onboarding"). It still writes the same platform_settings columns
 * (onboarding_bg_music_r2_key / _enabled) — the /onboarding/wedding read path
 * is UNCHANGED — so this is a relocation, not a behavior change. When a second
 * onboarding type needs its OWN music, the storage migrates to a per-type
 * onboarding_settings table; today there is one type (wedding) so the single
 * platform_settings columns are its store.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin(): Promise<void> {
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
}

function r2RefOrNull(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.startsWith('r2://') ? v : null;
}

/**
 * Wedding onboarding background music. Owner uploads an OWNED / AI-generated
 * track via <FileUpload> → /api/upload (the form carries the r2:// ref by the
 * time this runs); /onboarding/wedding streams it. Plays only when enabled AND
 * a track is set — "enabled with no track" is coerced off so the player never
 * mounts with no source.
 */
export async function updateOnboardingMusic(formData: FormData) {
  await requireAdmin();
  const musicRef = r2RefOrNull(formData.get('bg_music_url'));
  const enabledRequested = formData.get('onboarding_bg_music_enabled') === 'on';
  const enabled = enabledRequested && Boolean(musicRef);

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({
      onboarding_bg_music_r2_key: musicRef,
      onboarding_bg_music_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/onboarding');
  revalidatePath('/onboarding/wedding');
  redirect('/admin/onboarding?saved=1');
}
