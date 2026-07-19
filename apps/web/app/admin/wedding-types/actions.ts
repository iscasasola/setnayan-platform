'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  setWeddingTypeStatusCore,
  setWeddingTypeThresholdCore,
  type LaunchStatus,
} from '@/lib/wedding-types-mutations';

/**
 * Legacy per-religion launch-gate actions. The standalone /admin/wedding-types
 * surface was folded into the Taxonomy Studio's Vocabularies rail (Taxonomy
 * Studio PR 6) and the page now redirect()s to /admin/taxonomy. These wrappers
 * are retained for any bookmarked form POST and delegate to the shared cores in
 * lib/wedding-types-mutations.ts (the same cores the Studio calls). New edits
 * happen in the Studio; nothing new should import from here.
 */

async function requireAdmin() {
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
  return user.id;
}

function revalidateGateSurfaces() {
  revalidatePath('/admin/taxonomy');
  // The couple-facing gate reads the same table — refresh the picker surfaces
  // so a flip takes effect without waiting for their cache to lapse.
  revalidatePath('/dashboard/create-event');
  revalidatePath('/onboarding/wedding');
}

export async function setWeddingTypeStatus(formData: FormData) {
  const userId = await requireAdmin();
  const ceremonyType = String(formData.get('ceremony_type') ?? '').trim();
  const region = String(formData.get('region') ?? 'all').trim();
  const status = String(formData.get('status') ?? '').trim() as LaunchStatus;

  const admin = createAdminClient();
  const res = await setWeddingTypeStatusCore(admin, userId, ceremonyType, region, status);
  if (!res.ok) throw new Error(res.error);

  revalidateGateSurfaces();
}

export async function setWeddingTypeThreshold(formData: FormData) {
  const userId = await requireAdmin();
  const ceremonyType = String(formData.get('ceremony_type') ?? '').trim();
  const region = String(formData.get('region') ?? 'all').trim();
  const threshold = Number(formData.get('threshold'));

  const admin = createAdminClient();
  const res = await setWeddingTypeThresholdCore(admin, userId, ceremonyType, region, threshold);
  if (!res.ok) throw new Error(res.error);

  revalidateGateSurfaces();
}
