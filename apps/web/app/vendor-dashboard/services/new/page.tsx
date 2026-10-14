import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { CanvasMaker } from '../_components/canvas-maker';
import { RefinementsEditor } from '../_components/refinements-editor';
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
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Link href="/vendor-dashboard/shop" className="sn-press inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          Shop
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">New service</h1>
      </div>
      <CanvasMaker
        categoryValue=""
        categoryLabel=""
        categoryOptions={ctx.categoryOptions}
        tradeOptions={ctx.tradeOptions}
        firstCardEver={ctx.firstCardEver}
        coverageNames={ctx.coverageNames}
        shopName={profile.business_name ?? ''}
        otherCategories={ctx.otherCategories}
        coverages={ctx.coverages}
        vendorProfileId={profile.vendor_profile_id}
        claimToken={null}
        eventTypeOptions={ctx.eventTypeOptions}
        faithOptions={ctx.faithOptions}
        coverageAudience={ctx.coverageAudience}
        coverageAllowed={ctx.coverageAllowed}
        supplierType={ctx.supplierType}
        folderOfKind={ctx.folderOfKind}
        coverageAsk={ctx.coverageAsk}
        schedules={ctx.schedules}
        scheduleOfKind={ctx.scheduleOfKind}
        slotsPerDay={ctx.slotsPerDay}
        branches={ctx.branches}
        detailsKind={details ? ctx.onlyKind : null}
        detailsSlot={
          details && ctx.onlyKind ? (
            <RefinementsEditor
              canonicalService={ctx.onlyKind}
              refinements={details.refinements}
              initial={details.values}
              leafLabel={ctx.kindLabel(ctx.onlyKind)}
              bare
            />
          ) : null
        }
        errorLine={typeof error === 'string' && error.length > 0 ? error : null}
        returnTo="/vendor-dashboard/services/new"
        initial={null}
      />
    </div>
  );
}
