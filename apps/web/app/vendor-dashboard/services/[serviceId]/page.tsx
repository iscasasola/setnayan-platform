import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { CanvasMaker } from '../_components/canvas-maker';
import { RefinementsEditor } from '../_components/refinements-editor';
import { CardRecordSection } from '@/app/_components/card-record-section';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { cardRecordHasSomethingToSayToTheShop, fetchServiceCardRecords } from '@/lib/service-card-record';
import { loadCardForEdit, loadKindDetails, loadMakerContext } from '@/lib/service-card-maker.server';

export const metadata = { title: 'Your service' };

/**
 * /vendor-dashboard/services/[serviceId] — AN EXISTING CARD, IN THE SAME MAKER (the edit sheet; the simpler supplier
 * dashboard, step 3, 2026-10-14). A service row on Shop opens this: the card on top, the status line, the first
 * questions, every other field under More settings, and ONE Save (owner 2026-10-08 Q3) — the name editable (Q2), the
 * Live switch, Start another from this, Delete.
 *
 * Saves through `commitVendorService` with the card's id (the one write path), never through a per-field Save. Every
 * list the save replaces is read with its error checked (`loadCardForEdit`); an unread list blocks Save.
 */
export default async function EditServiceCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ error?: string; offpeak?: string; exp?: string; cond?: string }>;
}) {
  const { serviceId } = await params;
  const { error, offpeak, exp, cond } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const card = await loadCardForEdit(supabase, profile.vendor_profile_id, serviceId);
  if (!card) notFound();

  const [ctx, details, records] = await Promise.all([
    loadMakerContext(supabase, profile.vendor_profile_id, { fixedCategory: card.category, withKindList: false }),
    loadKindDetails(supabase, profile.vendor_profile_id, card.category),
    cardRecordEnabled() ? fetchServiceCardRecords(supabase, [serviceId]).catch(() => null) : Promise.resolve(null),
  ]);
  const record = records?.get(serviceId) ?? null;
  const kindName = ctx.kindLabel(card.category);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Link href="/vendor-dashboard/shop" className="sn-press inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          Shop
        </Link>
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">{card.initial.title || kindName}</h1>
      </div>
      <CanvasMaker
        categoryValue={card.category}
        categoryLabel={kindName}
        otherCategories={ctx.otherCategories}
        coverages={ctx.coverages}
        vendorProfileId={profile.vendor_profile_id}
        claimToken={null}
        eventTypeOptions={ctx.eventTypeOptions}
        faithOptions={ctx.faithOptions}
        coverageAudience={ctx.coverageAudience}
        coverageAllowed={ctx.coverageAllowed}
        shopName={profile.business_name ?? ''}
        supplierType={ctx.supplierType}
        folderOfKind={ctx.folderOfKind}
        coverageAsk={{}}
        schedules={ctx.schedules}
        scheduleOfKind={ctx.scheduleOfKind}
        slotsPerDay={ctx.slotsPerDay}
        branches={ctx.branches}
        detailsKind={details ? card.category : null}
        detailsSlot={
          details ? (
            <RefinementsEditor canonicalService={card.category} refinements={details.refinements} initial={details.values} leafLabel={kindName} bare />
          ) : null
        }
        recordSlot={
          cardRecordHasSomethingToSayToTheShop(record) ? <CardRecordSection record={record} variant="vendor" /> : null
        }
        initial={card.initial}
        editing={card.editing}
        unread={card.unread}
        errorLine={typeof error === 'string' && error.length > 0 ? error : null}
        returnTo={`/vendor-dashboard/services/${serviceId}`}
        discountSeed={
          offpeak === '1'
            ? {
                expiry: typeof exp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(exp) ? exp : undefined,
                conditions: typeof cond === 'string' ? cond.slice(0, 200) : undefined,
              }
            : null
        }
      />
    </div>
  );
}
