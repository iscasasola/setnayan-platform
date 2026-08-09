import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { OpenShopWizard } from './_components/open-shop-wizard';
import { getOpenShopServiceTree } from '@/lib/open-shop-service-tree';

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
      'vendor_profile_id, business_name, business_slug, logo_url, services, event_types, location_city, business_owner_name, business_owner_position, contact_phone, contact_email',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  const row = owned as {
    vendor_profile_id?: string | null;
    business_name?: string | null;
    business_slug?: string | null;
    logo_url?: string | null;
    services?: string[] | null;
    event_types?: string[] | null;
    location_city?: string | null;
    business_owner_name?: string | null;
    business_owner_position?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  } | null;
  if (row?.business_name?.trim()) redirect('/vendor-dashboard/shop');

  // Taxonomy-driven labels for the primary-service picker (degrades to the
  // in-code names on a hiccup).
  const { serviceLabels } = await fetchVendorServicePickerVocab();

  // Event-type roster the vendor can serve (admin-driven; same source the
  // marketplace ?event_type= filter + the My Shop coverage editor read). Without
  // this signal a new shop is stuck at the column default ['wedding'] and is
  // invisible for every non-wedding event it actually serves.
  const eventTypeOptions = (await getEventTypeVocab()).map((e) => ({
    key: e.key,
    label: e.label,
    emoji: e.emoji,
  }));

  // Pre-resolve a display URL for an already-uploaded logo so the <FileUpload>
  // thumbnail paints on first load (a fresh signup won't have one yet).
  // 🚨 THE TRY/CATCH IS LOAD-BEARING, NOT DEFENSIVE DECORATION (2026-08-08).
  // `displayUrlForStoredAsset` → `presignDisplayUrl` → `requireR2Client()`,
  // which THROWS when the R2 env is unset. This is a top-level await in the
  // page body, so an unhandled throw here does not degrade to "no thumbnail" —
  // it 500s the whole route, and only for a vendor who ALREADY uploaded a logo.
  // A returning vendor could not open their own onboarding wizard at all, while
  // a brand-new one sails through, which is the hardest possible shape to
  // reproduce. A logo thumbnail is decoration; the wizard is the product.
  const logoDisplayMap: Record<string, string> = {};
  if (row?.logo_url) {
    let displayUrl: string | null = null;
    try {
      displayUrl = await displayUrlForStoredAsset(row.logo_url);
    } catch {
      displayUrl = null;
    }
    if (displayUrl) logoDisplayMap[row.logo_url] = displayUrl;
  }

  // The parent -> branch -> leaf tree the picker drills (owner 2026-08-09).
  // First-party Setnayan SKUs are stripped inside — picking one would make the
  // shop invisible on /explore. Fail-soft: [] makes the wizard fall back to its
  // flat select rather than blocking a vendor from opening a shop.
  const serviceTree = await getOpenShopServiceTree().catch(() => []);
  // A re-run must show the NAME of the saved service, not its stored key.
  const savedService = row?.services?.[0] ?? '';
  const savedServiceLabel =
    serviceTree
      .flatMap((p) => p.branches.flatMap((b) => b.leaves))
      .find((l) => l.canonicalService === savedService)?.label ??
    serviceLabels?.[savedService] ??
    null;

  return (
    <OpenShopWizard
      mode={row ? 'complete' : 'create'}
      serviceLabels={serviceLabels}
      serviceTree={serviceTree}
      existingSlug={row?.business_slug ?? null}
      savedServiceLabel={savedServiceLabel}
      eventTypeOptions={eventTypeOptions}
      vendorProfileId={row?.vendor_profile_id ?? null}
      logoDisplayMap={logoDisplayMap}
      defaults={{
        shopName: row?.business_name ?? '',
        logoUrl: row?.logo_url ?? '',
        primaryService: row?.services?.[0] ?? '',
        // Seed from any existing selection so re-running onboarding never
        // clobbers a richer set the vendor set via the coverage editor; a
        // brand-new shop starts on the sensible ['wedding'] default.
        eventTypes: row?.event_types?.length ? row.event_types : ['wedding'],
        locationCity: row?.location_city ?? '',
        contactName: row?.business_owner_name ?? '',
        contactPosition: row?.business_owner_position ?? '',
        contactPhone: row?.contact_phone ?? '',
        contactEmail: row?.contact_email ?? user.email ?? '',
      }}
      error={error}
      initialStep={step === '2' ? 2 : 1}
    />
  );
}
