'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { servicesReturnBase } from '@/lib/vendor-services-return';

/**
 * Service add-on write path (Vendor Services rework 2026-07-02). Replace-all,
 * mirroring setServiceLinks: DELETE then INSERT, vendor-scoped. Self-contained —
 * no RPC change; the atomic wizard picks these up on its next read.
 */

const BASE = '/vendor-dashboard/services';
const MAX_ADDONS = 12;

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

  const labels = formData.getAll('addon_label').map((v) => String(v));
  const prices = formData.getAll('addon_price').map((v) => String(v));
  const rows: {
    vendor_service_id: string;
    vendor_profile_id: string;
    label: string;
    from_price_php: number | null;
    sort_order: number;
  }[] = [];
  for (let i = 0; i < labels.length && rows.length < MAX_ADDONS; i++) {
    const label = (labels[i] ?? '').trim();
    if (!label) continue; // blank rows dropped
    const priceRaw = (prices[i] ?? '').trim();
    const priceNum = priceRaw === '' ? NaN : Math.round(Number(priceRaw));
    const from_price_php = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : null;
    rows.push({
      vendor_service_id: serviceId,
      vendor_profile_id: profile.vendor_profile_id,
      label: label.slice(0, 80),
      from_price_php,
      sort_order: rows.length,
    });
  }

  const del = await supabase
    .from('vendor_service_addons')
    .delete()
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (del.error) back(base, 'error', del.error.message);
  if (rows.length > 0) {
    const ins = await supabase.from('vendor_service_addons').insert(rows);
    if (ins.error) back(base, 'error', ins.error.message);
  }
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  back(base, 'saved');
}
