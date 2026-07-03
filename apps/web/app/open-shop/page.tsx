import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { OpenShopWizard } from './_components/open-shop-wizard';

/**
 * /open-shop — the ONE smart entry point behind every "Register your business"
 * CTA + the vendor signup landing (owner 2026-07-03). Routes by state:
 *
 *   • logged OUT                     → /signup?as=vendor (account + shop)
 *   • logged in, shop with a NAME    → /vendor-dashboard/shop
 *   • logged in, no shop             → the onboarding wizard (mode 'create')
 *   • logged in, never-named shop    → the wizard (mode 'complete' — a fresh
 *     signup's trigger-provisioned bare shop lands here to fill the basics)
 *
 * The wizard collects the owner-locked basics (shop name · primary service ·
 * location · contact name + number · website + social); everything else
 * continues on My Shop via the profile checklist + Get-verified journey.
 */

export const metadata = { title: 'Open your shop · Setnayan' };

export default async function OpenShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/signup?as=vendor');

  // Own-row read passes RLS. A shop that has a NAME finished onboarding.
  const { data: owned } = await supabase
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, services, location_city, business_owner_name, contact_phone, website',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const row = owned as {
    business_name?: string | null;
    services?: string[] | null;
    location_city?: string | null;
    business_owner_name?: string | null;
    contact_phone?: string | null;
    website?: string | null;
  } | null;
  if (row?.business_name?.trim()) redirect('/vendor-dashboard/shop');

  // Taxonomy-driven labels for the primary-service picker (degrades to the
  // in-code names on a hiccup).
  const { serviceLabels } = await fetchVendorServicePickerVocab();

  return (
    <OpenShopWizard
      mode={row ? 'complete' : 'create'}
      serviceLabels={serviceLabels}
      defaults={{
        shopName: row?.business_name ?? '',
        primaryService: row?.services?.[0] ?? '',
        locationCity: row?.location_city ?? '',
        contactName: row?.business_owner_name ?? '',
        contactPhone: row?.contact_phone ?? '',
        website: row?.website ?? '',
      }}
      error={error}
    />
  );
}
