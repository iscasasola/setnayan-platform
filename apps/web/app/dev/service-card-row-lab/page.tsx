/**
 * /dev/service-card-row-lab — Shop › Services: the card (no frame), then ONE row under it — Edit · Share icons and the
 * Online/Offline switch; swipe left to delete (owner 10 Nov on PR #7464; Build 5 Lane C). DEV-ONLY; production 404s
 * it. No sign-in, no database.
 *
 *   ?v=proposed (default)  the SHIPPED `ServiceCardItem` (cards built by the real `toServiceCard`): a live card with two
 *                          open bookings (turn it off / swipe it → refused, each booking named) and an offline draft
 *                          missing its cover AND what's included (turn it on → refused for both; swipe it → the
 *                          warning, then the shipped Undo).
 *   ?v=now                 the row as it drew before (side copy icon · side Online/Offline switch · "Edit · every
 *                          field"), frozen in `lab-rows.tsx` for the side-by-side ONLY.
 */
import { notFound } from 'next/navigation';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { deleteWarningLines, openBookingsRefusal, type OpenBooking } from '@/lib/service-open-bookings';
import { coverIsSet, inclusionsAreSet, priceIsSet } from '@/lib/service-publish-gate';
import { LabRows, type LabCard } from './lab-rows';

export const dynamic = 'force-dynamic';

const SHOP_ID = '00000000-0000-4000-8000-00000000c0de';
const NOW = new Date('2026-11-11T09:00:00+08:00');

function row(over: Partial<VendorServiceRow> & Pick<VendorServiceRow, 'vendor_service_id' | 'public_id' | 'title'>): VendorServiceRow {
  return {
    vendor_profile_id: SHOP_ID,
    category: 'live_band',
    starting_price_php: 45000,
    added_pax_price_php: null,
    pricing_basis: 'fixed',
    per_pax_price_php: null,
    min_pax: null,
    hour_base_php: null,
    min_hours: null,
    extra_hour_php: null,
    crew_size: 6,
    crew_meal_required: true,
    crew_meal_included: false,
    transport_included: true,
    transport_flat_fee_php: null,
    primary_photo_r2_key: null,
    showcase_video_r2_key: null,
    showcase_photo_r2_keys: [],
    is_active: true,
    branch_id: null,
    recommended_lead_time_months: null,
    last_minute_end_months: null,
    last_minute_surcharge_pct: null,
    daily_capacity: null,
    exclusive_perk_text: null,
    includes_setnayan_gift: false,
    base_pax: null,
    coverage_id: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  } as VendorServiceRow;
}

const FIXTURES: { row: VendorServiceRow; inclusions: string[]; photos: string[]; picked: number; open: OpenBooking[] }[] = [
  {
    row: row({
      vendor_service_id: '00000000-0000-4000-8000-00000000ca01',
      public_id: 'S89S-7KQ2M4X9PA',
      title: 'Garden Wedding Live Band',
      primary_photo_r2_key: 'lab/cover.jpg',
    }),
    inclusions: ['Sound system', '4 sets of 45 minutes'],
    photos: ['/realstories/maria-juan-tagaytay.jpg', '/realstories/jack-rose-baguio.jpg'],
    // Two couples' bookings not yet complete: turning it off, and deleting it, are refused — each named.
    picked: 3,
    open: [
      { eventName: 'Maria & Juan’s Wedding', eventDate: '2026-12-12' },
      { eventName: 'Jack & Rose’s Wedding', eventDate: '2027-02-14' },
    ],
  },
  {
    // The owner's 10 Nov screenshot: offline, no cover photo AND no "what's included" — refused for the photo alone.
    row: row({
      vendor_service_id: '00000000-0000-4000-8000-00000000ca02',
      public_id: 'S89S-3HD8W1RT6N',
      title: 'Acoustic Duo for the Ceremony',
      starting_price_php: 18000,
      crew_size: 2,
      is_active: false,
    }),
    inclusions: [],
    photos: [],
    // Nobody ever picked it: swipe left warns first, then deletes (with the shipped Undo).
    picked: 0,
    open: [],
  },
];

export default async function ServiceCardRowLabPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const now = sp.v === 'now';
  const cards: LabCard[] = FIXTURES.map(({ row: r, inclusions, photos, picked, open }) => ({
    id: r.vendor_service_id,
    name: r.title ?? 'Live Band',
    live: r.is_active,
    card: toServiceCard(
      r,
      inclusions.map((label, i) => ({ vendor_service_id: r.vendor_service_id, label, worth_php: null, sort_order: i })),
      [],
      undefined,
      { photos, videoUrl: null },
      false,
      null,
      NOW,
      null,
      null,
      false,
    ),
    facts: {
      hasCover: coverIsSet(r.primary_photo_r2_key),
      hasPrice: priceIsSet(r.starting_price_php),
      hasInclusions: inclusionsAreSet(inclusions),
    },
    factsLine: 'flat · assigned to You',
    offlineRefusal: openBookingsRefusal(open),
    deleteRefusal: openBookingsRefusal(open),
    warningLines: deleteWarningLines(picked),
  }));

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">
      <div className="space-y-1">
        <p className="font-serif text-2xl text-ink">Saysay Live Band</p>
        <p className="text-xs text-ink/55">Lab · My Shop › Services — {now ? 'Now (origin/main)' : 'Proposed: the card, then Edit · Share · Online/Offline — swipe left to delete'}</p>
      </div>
      <LabRows cards={cards} now={now} />
    </main>
  );
}
