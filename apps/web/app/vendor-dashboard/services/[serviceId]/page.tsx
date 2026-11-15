import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { CanvasMaker } from '../_components/canvas-maker';
import { RefinementsEditor } from '../_components/refinements-editor';
import { CardRecordSection } from '@/app/_components/card-record-section';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { cardRecordHasSomethingToSayToTheShop, readCardBookedCount, readOneCardRecord } from '@/lib/service-card-record';
import { CardPortfolioSection } from '@/app/_components/card-portfolio-section';
import { cardPortfolioAlbums } from '@/lib/card-portfolio-albums.server';
import { readAlbumTags } from '@/lib/inspiration-tags.server';
import { portfolioSummary, toAlbumViews, workAlbumAnchor } from '@/lib/card-portfolio-albums';
import { loadCardForEdit, loadKindDetails, loadMakerContext } from '@/lib/service-card-maker.server';
import { HallsUsesPick } from '../_components/halls-uses-pick';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOKINGS_UNREAD, deleteWarningLines, openBookingsRefusal, readCardBookings } from '@/lib/service-open-bookings';
import { setServiceHalls } from '../../calendar/actions';

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { serviceId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const card = await loadCardForEdit(supabase, profile.vendor_profile_id, serviceId);
  if (!card) notFound();

  // 🏛 A VENUE'S HALLS (owner 2026-10-14, step 2): "Uses" — which halls this card books. Moved here from the retired
  // inline editor (step 3) by the supplier batch. Read only for a venue card — every other card pays nothing.
  const sellsVenue = card.category === 'venue' || card.category === 'religious_venue';
  // 🔒 "Couples who already booked keep their price" (Build 5 Lane C) — said on the price row of a card couples booked.
  // Its own read, so a refused read (null) is never taken for "nobody booked" (0).
  // 🔒 The delete sheet's open bookings (owner 10 Nov on PR #7464) — the card is proved this shop's own just above
  // (`loadCardForEdit`), so the admin read names only its own couples' events.
  // 🃏📸 ONE ALBUM, TWO PLACES (DECISION_LOG 2026-10-08, frames 71–78) rides the card-record flag: OFF → the Record and
  // Portfolio folds read and say exactly what they did before; ON → the record (or its refusal) and this card's albums.
  const recordOn = cardRecordEnabled();
  const [ctx, details, records, hallsRes, bookedNow, cardBookings, albums] = await Promise.all([
    loadMakerContext(supabase, profile.vendor_profile_id, { fixedCategory: card.category, withKindList: false }),
    loadKindDetails(supabase, profile.vendor_profile_id, card.category),
    // 🃏 Flag ON: a refused record read is SAID (frame 75), never folded into "nobody booked it". Flag OFF: not read.
    recordOn ? readOneCardRecord(supabase, serviceId).catch(() => null) : Promise.resolve(undefined),
    sellsVenue
      ? supabase
          .from('vendor_schedule_pools')
          .select('pool_id, pool_label, calendar_name, vendor_service_halls(vendor_service_id)')
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .eq('is_hall', true)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .then(
            (r) => {
              if (r.error) console.error('[supabase-error] service card halls read', r.error);
              return r;
            },
            () => ({ data: null }),
          )
      : Promise.resolve({ data: [] }),
    readCardBookedCount(supabase, serviceId),
    readCardBookings(createAdminClient(), [serviceId]),
    // The card is proved this shop's own just above (`loadCardForEdit`).
    recordOn
      ? cardPortfolioAlbums(createAdminClient(), { vendorProfileId: profile.vendor_profile_id, serviceId }).catch(() => null)
      : Promise.resolve(undefined),
  ]);
  // 🏷 Frame 6 (DECISION_LOG 2026-11-14): which inspirations each album's photos are in — the shop proved just above.
  const albumTags = albums
    ? await readAlbumTags(
        createAdminClient(),
        profile.vendor_profile_id,
        albums.flatMap((a) => a.photos.filter((ph) => ph.from === 'files').map((ph) => ph.key.slice('files:'.length))),
      )
    : null;
  const thisCardBookings = cardBookings?.get(serviceId) ?? null;
  const deleteGate = {
    refusal: thisCardBookings ? openBookingsRefusal(thisCardBookings.open) : BOOKINGS_UNREAD,
    lines: deleteWarningLines(thisCardBookings?.picked ?? 0),
  };
  const hallRows = ((hallsRes as { data: unknown }).data ?? []) as {
    pool_id: string;
    pool_label: string;
    calendar_name: string | null;
    vendor_service_halls: { vendor_service_id: string }[] | null;
  }[];
  const venueHalls = hallRows.map((h) => ({ poolId: h.pool_id, name: h.calendar_name?.trim() || h.pool_label || 'Hall' }));
  const hallUses = hallRows
    .filter((h) => (h.vendor_service_halls ?? []).some((l) => l.vendor_service_id === serviceId))
    .map((h) => h.pool_id);
  const record = records?.record ?? null;
  const here = `/vendor-dashboard/services/${serviceId}`;
  const ownPhotos = [card.initial.coverPhotoR2Key, ...card.initial.showcasePhotoR2Keys]
    .map((k) => (k ? card.initial.mediaDisplayUrls[k] : undefined))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  const recordSlot =
    records === null ? (
      <CardRecordUnread retryHref={here} />
    ) : cardRecordHasSomethingToSayToTheShop(record) ? (
      <CardRecordSection record={record} variant="vendor" />
    ) : null;
  const kindName = ctx.kindLabel(card.category);

  return (
    // No page title: the maker's surface carries the card's name (makers prototype 7 Nov 2026 § 3).
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Link href="/vendor-dashboard/shop" className="sn-press inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          Shop
        </Link>
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
        branches={ctx.branches}
        giftPacks={ctx.giftPacks}
        giftFree={ctx.giftFree}
        bookingsPerDate={ctx.bookingsPerDate}
        checkRules={ctx.checkRules}
        detailsKind={details ? card.category : null}
        detailsSlot={
          details ? (
            <RefinementsEditor canonicalService={card.category} refinements={details.refinements} initial={details.values} leafLabel={kindName} bare />
          ) : null
        }
        recordSlot={recordSlot}
        portfolioSlot={
          albums === undefined ? null : (
            <CardPortfolioSection
              work={albums ? toAlbumViews(albums, { href: (id) => `/vendor-dashboard/services/their-work#${workAlbumAnchor(id)}`, tags: albumTags }) : null}
              own={ownPhotos}
              variant="vendor"
              retryHref={here}
            />
          )
        }
        portfolioLine={albums === undefined ? null : portfolioSummary(albums)}
        initial={card.initial}
        editing={card.editing}
        bookedNow={bookedNow}
        deleteGate={deleteGate}
        unread={card.unread}
        errorLine={typeof error === 'string' && error.length > 0 ? error : null}
        returnTo={`/vendor-dashboard/services/${serviceId}`}
      />
      {/* Its own form, OUTSIDE the card form (a nested form would never post). */}
      {venueHalls.length > 0 ? (
        <HallsUsesPick serviceId={serviceId} halls={venueHalls} uses={hallUses} action={setServiceHalls} />
      ) : null}
    </div>
  );
}

/** Frame 75: a refused record read, said in the Record row's own place — never drawn as an empty record. */
function CardRecordUnread({ retryHref }: { retryHref: string }) {
  return (
    <p className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink/75" role="status" data-card-record="unread">
      <span>Couldn’t load this card’s record</span>
      <Link href={retryHref} className="sn-press inline-flex min-h-11 items-center font-medium text-sn-accent">
        Retry
      </Link>
    </p>
  );
}
