'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { parseAddonRows, replaceServiceAddons } from '@/lib/service-card-save-parts';

/**
 * Service add-on write path (Vendor Services rework 2026-07-02). Replace-all,
 * mirroring setServiceLinks: DELETE then INSERT, vendor-scoped. Self-contained —
 * no RPC change; the atomic wizard picks these up on its next read.
 */

const BASE = '/vendor-dashboard/services';

function back(base: string, kind: 'saved' | 'error', msg?: string): never {
  redirect(kind === 'error' && msg ? `${base}?error=${encodeURIComponent(msg)}` : `${base}?saved=1`);
}

export async function setServiceAddons(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const base = await servicesReturnBase();

  const serviceId = String(formData.get('vendor_service_id') ?? '').trim();
  if (!serviceId) back(base, 'error', 'Missing service.');

  // Ownership: the anchor service must belong to this vendor (RLS enforces the
  // same, but fail fast with a clear message).
  const { data: svc } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!svc) back(base, 'error', 'Service not found.');

  // The one add-on parse + replace-all, shared with the maker's one save (lib/service-card-save-parts.ts).
  const err = await replaceServiceAddons(supabase, serviceId, profile.vendor_profile_id, parseAddonRows(formData));
  if (err) back(base, 'error', err);
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  back(base, 'saved');
}
