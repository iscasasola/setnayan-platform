'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin actions for the per-religion launch gate (wedding_type_launch_status).
 * Lets an admin flip a religion live / coming-soon / disabled and set the
 * vendor-readiness threshold. Mirrors the admin-auth gate used across the
 * console; the table's RLS (`public.is_admin()` write) is the server-side
 * backstop, but the redirect-on-fail UX is nicer than a silent RLS rejection.
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

const ALLOWED_STATUS = ['active', 'coming_soon', 'disabled'] as const;
type Status = (typeof ALLOWED_STATUS)[number];

function revalidateGateSurfaces() {
  revalidatePath('/admin/wedding-types');
  // The couple-facing gate reads the same table — refresh the picker surfaces
  // so a flip takes effect without waiting for their cache to lapse.
  revalidatePath('/dashboard/create-event');
  revalidatePath('/onboarding/wedding');
}

export async function setWeddingTypeStatus(formData: FormData) {
  await requireAdmin();
  const ceremonyType = String(formData.get('ceremony_type') ?? '').trim();
  const region = String(formData.get('region') ?? 'all').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!ceremonyType || !ALLOWED_STATUS.includes(status as Status)) {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  // Stamp activated_at the first time a religion goes live; leave it on
  // subsequent edits so the original open date is preserved.
  if (status === 'active') {
    const { data: existing } = await admin
      .from('wedding_type_launch_status')
      .select('activated_at')
      .eq('ceremony_type', ceremonyType)
      .eq('region', region)
      .maybeSingle();
    if (!existing?.activated_at) patch.activated_at = new Date().toISOString();
  }

  const { error } = await admin
    .from('wedding_type_launch_status')
    .update(patch)
    .eq('ceremony_type', ceremonyType)
    .eq('region', region);
  if (error) throw new Error(error.message);

  revalidateGateSurfaces();
}

export async function setWeddingTypeThreshold(formData: FormData) {
  await requireAdmin();
  const ceremonyType = String(formData.get('ceremony_type') ?? '').trim();
  const region = String(formData.get('region') ?? 'all').trim();
  const raw = Number(formData.get('threshold'));
  if (!ceremonyType || !Number.isInteger(raw) || raw < 0 || raw > 100000) {
    throw new Error('Invalid threshold');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('wedding_type_launch_status')
    .update({ vendor_count_threshold: raw, updated_at: new Date().toISOString() })
    .eq('ceremony_type', ceremonyType)
    .eq('region', region);
  if (error) throw new Error(error.message);

  revalidateGateSurfaces();
}
