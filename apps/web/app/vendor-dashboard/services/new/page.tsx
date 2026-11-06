import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { NewServiceMaker } from './_components/new-service-maker';
import { canvasMakerEnabled } from '@/lib/canvas-maker-flag';
import { SERVICE_PICKER_HREF } from '@/lib/service-picker-anchor';
import { loadKindDetails, loadMakerContext } from '@/lib/service-card-maker.server';

export const metadata = { title: 'New service' };

/**
 * /vendor-dashboard/services/new — Shop › Add opens THE MAKER (the simpler supplier dashboard, step 3 —
 * `prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, moment "2 · Putting up a service").
 *
 * 🔴 WHY THIS ROUTE EXISTS (owner 2026-08-28): *"we want it to directly go to a page to create a service card."* The
 * kind of service is asked ON the card ("What you offer"), the shop's own words first.
 *
 * ⚠ THIS IS A DOOR, NOT A SECOND MAKER. It renders the SAME `<CanvasMaker>` and posts the SAME `commitVendorService`
 * as `/services/new/[category]` and the edit sheet `/services/[serviceId]`; all three read through ONE loader
 * (`loadMakerContext`).
 *
 * 🔑 CANVAS-OFF FALLS BACK RATHER THAN HALF-WORKS — with `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` off this hands the vendor
 * to My Shop's picker (the 6-step wizard needs a kind from the address).
 */
export default async function NewServiceCardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!canvasMakerEnabled()) redirect(SERVICE_PICKER_HREF);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const { error } = await searchParams;

  const ctx = await loadMakerContext(supabase, profile.vendor_profile_id);
  // A one-trade shop's kind is pre-picked — its details can be drawn now; any other kind's open once it is made.
  const details = await loadKindDetails(supabase, profile.vendor_profile_id, ctx.onlyKind);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6">
      {/* No page title (owner-approved maker 2026-11-07): the maker's pinned row names the service, its surface names the
          card, and its Cancel goes back to Shop. The heading stays for a screen reader. */}
      <h1 className="sr-only">New service</h1>
      <NewServiceMaker vendorProfileId={profile.vendor_profile_id} shopName={profile.business_name ?? ''} ctx={ctx} details={details} error={typeof error === 'string' && error.length > 0 ? error : null} />
    </div>
  );
}
