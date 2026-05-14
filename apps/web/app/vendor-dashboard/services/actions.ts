'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

function parseCategory(raw: FormDataEntryValue | null): VendorCategory {
  if (typeof raw !== 'string' || !CATEGORY_SET.has(raw)) {
    throw new Error('Unknown service category.');
  }
  return raw as VendorCategory;
}

function parseInt0OrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error('Numeric fields must be non-negative whole numbers.');
  }
  return n;
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

export async function createVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  let category: VendorCategory;
  let starting_price_php: number | null;
  let crew_size: number | null;
  try {
    category = parseCategory(formData.get('category'));
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
    crew_size = parseInt0OrNull(formData.get('crew_size'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  const crew_meal_required = formData.get('crew_meal_required') === 'on';

  const { error } = await supabase.from('vendor_services').insert({
    vendor_profile_id: profile.vendor_profile_id,
    category,
    starting_price_php,
    crew_size,
    crew_meal_required,
    is_active: true,
  });

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function updateVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }

  let starting_price_php: number | null;
  let crew_size: number | null;
  try {
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
    crew_size = parseInt0OrNull(formData.get('crew_size'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  const crew_meal_required = formData.get('crew_meal_required') === 'on';

  const { error } = await supabase
    .from('vendor_services')
    .update({
      starting_price_php,
      crew_size,
      crew_meal_required,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function toggleVendorServiceActive(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  const nextRaw = formData.get('is_active');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }
  const is_active = nextRaw === 'true' || nextRaw === 'on' || nextRaw === '1';

  const { error } = await supabase
    .from('vendor_services')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function deleteVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }

  const { error } = await supabase
    .from('vendor_services')
    .delete()
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}
