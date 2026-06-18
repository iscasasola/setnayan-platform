'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

const PAGE = '/vendor-dashboard/packages';

function parsePesosToCentavos(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string' || raw.trim() === '') return 0;
  const n = Math.round(Number(raw.trim()) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function requirePositivePesos(raw: FormDataEntryValue | null, label: string): number {
  const c = parsePesosToCentavos(raw);
  if (c <= 0) throw new Error(`${label} must be greater than zero.`);
  return c;
}

async function requireVendorProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

export async function createVendorPackage(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const name = (formData.get('package_name') as string | null)?.trim();
  if (!name) throw new Error('Package name is required.');
  const totalCentavos = requirePositivePesos(formData.get('total_price_php'), 'Total price');
  const consumableCentavos = parsePesosToCentavos(formData.get('consumable_budget_php'));
  const isFlexible = formData.get('is_consumable_flexible') === 'on';
  const description = (formData.get('description') as string | null)?.trim() || null;
  const primaryService =
    (formData.get('primary_canonical_service') as string | null)?.trim() || 'reception_venue';

  const { error } = await supabase.from('vendor_packages').insert({
    vendor_profile_id: profile.vendor_profile_id,
    package_name: name,
    description,
    total_price_centavos: totalCentavos,
    consumable_budget_centavos: consumableCentavos,
    is_consumable_flexible: isFlexible,
    primary_canonical_service: primaryService,
    is_active: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
  redirect(PAGE + '?created=1');
}

export async function updateVendorPackage(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const packageId = (formData.get('package_id') as string | null)?.trim();
  if (!packageId) throw new Error('Package ID missing.');
  const name = (formData.get('package_name') as string | null)?.trim();
  if (!name) throw new Error('Package name is required.');
  const totalCentavos = requirePositivePesos(formData.get('total_price_php'), 'Total price');
  const consumableCentavos = parsePesosToCentavos(formData.get('consumable_budget_php'));
  const isFlexible = formData.get('is_consumable_flexible') === 'on';
  const description = (formData.get('description') as string | null)?.trim() || null;
  const primaryService =
    (formData.get('primary_canonical_service') as string | null)?.trim() || 'reception_venue';

  const { error } = await supabase
    .from('vendor_packages')
    .update({
      package_name: name,
      description,
      total_price_centavos: totalCentavos,
      consumable_budget_centavos: consumableCentavos,
      is_consumable_flexible: isFlexible,
      primary_canonical_service: primaryService,
    })
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
  redirect(PAGE + '?saved=1');
}

export async function togglePackageActive(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const packageId = (formData.get('package_id') as string | null)?.trim();
  const nextActive = formData.get('is_active') === 'true';
  const { error } = await supabase
    .from('vendor_packages')
    .update({ is_active: nextActive })
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
}

export async function deleteVendorPackage(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const packageId = (formData.get('package_id') as string | null)?.trim();
  if (!packageId) throw new Error('Package ID missing.');
  const { count } = await supabase
    .from('event_vendor_packages')
    .select('booking_id', { count: 'exact', head: true })
    .eq('package_id', packageId)
    .in('status', ['considering', 'locked']);
  if ((count ?? 0) > 0) {
    throw new Error(
      'Cannot delete a package that couples are considering or have locked. Deactivate it instead.',
    );
  }
  const { error } = await supabase
    .from('vendor_packages')
    .delete()
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function createPackageItem(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const packageId = (formData.get('package_id') as string | null)?.trim();
  if (!packageId) throw new Error('Package ID missing.');
  // Ownership check
  const { data: pkg } = await supabase
    .from('vendor_packages')
    .select('package_id')
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!pkg) throw new Error('Package not found.');
  const canonicalService =
    (formData.get('canonical_service') as string | null)?.trim() || 'reception_venue';
  const serviceDescription = (formData.get('service_description') as string | null)?.trim();
  if (!serviceDescription) throw new Error('Item description is required.');
  const isDefaultIncluded = formData.get('is_default_included') !== 'false';
  const replacementCentavos = parsePesosToCentavos(formData.get('replacement_value_php'));
  const { data: existing } = await supabase
    .from('vendor_package_items')
    .select('display_order')
    .eq('package_id', packageId)
    .order('display_order', { ascending: false })
    .limit(1);
  const displayOrder = ((existing?.[0] as { display_order?: number })?.display_order ?? -1) + 1;
  const { error } = await supabase.from('vendor_package_items').insert({
    package_id: packageId,
    canonical_service: canonicalService,
    service_description: serviceDescription,
    is_default_included: isDefaultIncluded,
    replacement_value_centavos: replacementCentavos,
    display_order: displayOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
}

export async function deletePackageItem(formData: FormData) {
  const { supabase, profile } = await requireVendorProfile();
  const itemId = (formData.get('item_id') as string | null)?.trim();
  if (!itemId) throw new Error('Item ID missing.');
  // Verify ownership via join
  const { data: item } = await supabase
    .from('vendor_package_items')
    .select('item_id, vendor_packages!inner(vendor_profile_id)')
    .eq('item_id', itemId)
    .maybeSingle();
  type ItemWithPkg = { item_id: string; vendor_packages: { vendor_profile_id: string } };
  const vendorId = (item as ItemWithPkg | null)?.vendor_packages?.vendor_profile_id;
  if (vendorId !== profile.vendor_profile_id) throw new Error('Not authorized.');
  const { error } = await supabase.from('vendor_package_items').delete().eq('item_id', itemId);
  if (error) throw new Error(error.message);
  revalidatePath(PAGE);
}
