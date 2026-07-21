import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { OpenShopWizard } from './_components/open-shop-wizard';

/**
 * /open-shop — the ONE smart entry point behind every "Register your business"
 * CTA + the vendor signup landing (owner 2026-07-03). Routes by state:
 *
 *   • logged OUT                     → /login?next=/open-shop&as=vendor
 *     (login-first so we can check the account; the rail's "New? Create your
 *     vendor account" path preserves as=vendor → /signup?as=vendor)
 *   • logged in, shop with a NAME    → /vendor-dashboard/shop
 *   • logged in, no shop             → the onboarding wizard (mode 'create')
 *   • logged in, never-named shop    → the wizard (mode 'complete' — a fresh
 *     signup's trigger-provisioned bare shop lands here to fill the basics)
 *
 * The wizard collects the owner-locked basics (shop name · logo · primary
 * service · owner name · contact number · company email · location); website
 * + social links and everything else continue on My Shop via the profile
 * checklist + Get-verified journey (owner 2026-07-05).
 */

export const metadata = { title: 'Open your shop · Setnayan' };

export default async function OpenShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string }>;
}) {
  const { error, step } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out → login FIRST so we can check the account before doing anything
  // (owner 2026-07-10). `next` closes the loop back to /open-shop; `as=vendor`
  // rides through to the rail's signup link so a brand-new vendor who taps
  // "Create your vendor account" still lands on /signup?as=vendor (radio
  // preselected). Existing vendors just sign in and return here.
  if (!user) redirect('/login?next=' + encodeURIComponent('/open-shop') + '&as=vendor');

  // Own-row read passes RLS. A shop that has a NAME finished onboarding.
  const { data: owned } = await supabase
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, logo_url, services, location_city, business_owner_name, contact_phone, contact_email',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const row = owned as {
    vendor_profile_id?: string | null;
    business_name?: string | null;
    logo_url?: string | null;
    services?: string[] | null;
    location_city?: string | null;
    business_owner_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  } | null;
  if (row?.business_name?.trim()) redirect('/vendor-dashboard/shop');

  // Taxonomy-driven labels for the primary-service picker (degrades to the
  // in-code names on a hiccup).
  const { serviceLabels } = await fetchVendorServicePickerVocab();

  // Pre-resolve a display URL for an already-uploaded logo so the <FileUpload>
  // thumbnail paints on first load (a fresh signup won't have one yet).
  const logoDisplayMap: Record<string, string> = {};
  if (row?.logo_url) {
    const displayUrl = await displayUrlForStoredAsset(row.logo_url);
    if (displayUrl) logoDisplayMap[row.logo_url] = displayUrl;
  }

  return (
    <OpenShopWizard
      mode={row ? 'complete' : 'create'}
      serviceLabels={serviceLabels}
      vendorProfileId={row?.vendor_profile_id ?? null}
      logoDisplayMap={logoDisplayMap}
      defaults={{
        shopName: row?.business_name ?? '',
        logoUrl: row?.logo_url ?? '',
        primaryService: row?.services?.[0] ?? '',
        locationCity: row?.location_city ?? '',
        contactName: row?.business_owner_name ?? '',
        contactPhone: row?.contact_phone ?? '',
        contactEmail: row?.contact_email ?? user.email ?? '',
      }}
      error={error}
      initialStep={step === '2' ? 2 : 1}
    />
  );
}
