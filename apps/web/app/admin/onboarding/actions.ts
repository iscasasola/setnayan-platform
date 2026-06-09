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
 * Wedding onboarding background music — now an ORDERED PLAYLIST (owner 2026-06-09;
 * was a single track 2026-06-08). The owner uploads one or more OWNED /
 * AI-generated tracks via <FileUpload multiple> → /api/upload (the form carries
 * one `bg_music_url` r2:// ref per track, in display order, by the time this
 * runs); /onboarding/wedding streams them back-to-back and loops the set. Plays
 * only when enabled AND ≥1 track is set — "enabled with no tracks" is coerced
 * off so the player never mounts with no source.
 *
 * We persist the full ordered list to `onboarding_bg_music_r2_keys` and mirror
 * the FIRST track into the legacy singular `onboarding_bg_music_r2_key` so any
 * code still reading the old column keeps working through the transition.
 */
export async function updateOnboardingMusic(formData: FormData) {
  await requireAdmin();
  const musicRefs = formData
    .getAll('bg_music_url')
    .map(r2RefOrNull)
    .filter((r): r is string => r !== null);
  const enabledRequested = formData.get('onboarding_bg_music_enabled') === 'on';
  const enabled = enabledRequested && musicRefs.length > 0;

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({
      onboarding_bg_music_r2_keys: musicRefs,
      onboarding_bg_music_r2_key: musicRefs[0] ?? null,
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
