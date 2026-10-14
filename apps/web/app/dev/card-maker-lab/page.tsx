/**
 * /dev/card-maker-lab — the simpler SERVICE CARD MAKER (supplier-easy step 3) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`), the production check first.
 *
 * It draws the REAL `CanvasMaker` beside the prototype's own moments
 * (`prototypes/supplier_easy_dashboard_2026-10-14_fable.html` · "2 · Putting up a service" · "2 · The service card ·
 * every field") for the prototype's three shops. Nothing here posts anywhere useful: with no session the shipped
 * save refuses.
 *
 *   ?type=church|caterer|studio   which shop (San Agustin Parish · Tita Nena's Catering · Lumina Studio)
 *   &s=new                        a new card, the kind asked on the card (default)
 *   &s=edit                       an existing card in the same maker (the edit sheet) — Live · delete · copy
 *   &s=unread                     …an existing card whose add-ons could not be read (Save waits)
 *   &s=fixed                      a new card whose kind came with the address (/services/new/[category])
 *
 * Names are the prototype's samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { CanvasMaker, type CategoryGroup, type MakerEditing, type MakerSchedule } from '@/app/vendor-dashboard/services/_components/canvas-maker';
import type { CanvasInitial } from '@/lib/canvas-initial';
import type { SupplierType } from '@/lib/service-card-maker';

const VP = '00000000-0000-4000-8000-0000000000bb';

type Shop = {
  name: string;
  type: SupplierType;
  covered: { value: string; label: string }[];
  folder: Record<string, string>;
  schedules: MakerSchedule[];
  scheduleOfKind: Record<string, string>;
  other: { value: string; label: string }[];
  edit: { kind: string; title: string; price: number; basis: 'fixed' | 'per_pax'; inclusions: string[] };
};

const SHOPS: Record<'church' | 'caterer' | 'studio', Shop> = {
  church: {
    name: 'San Agustin Parish',
    type: 'church',
    covered: [
      { value: 'religious_venue', label: 'Church wedding' },
      { value: 'church_fees', label: 'Wedding blessing' },
    ],
    folder: { religious_venue: 'venue' },
    schedules: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Church', perDay: 2 }],
    scheduleOfKind: { religious_venue: '11111111-1111-4111-8111-111111111111' },
    other: [{ value: 'church_fees', label: 'Wedding blessing' }],
    edit: { kind: 'religious_venue', title: 'Church wedding · San Agustin Parish', price: 15000, basis: 'fixed', inclusions: ['Choir', 'Flowers at the altar', 'Aircon'] },
  },
  caterer: {
    name: "Tita Nena's Catering",
    type: 'caterer',
    covered: [{ value: 'catering', label: 'Buffet catering' }],
    folder: { catering: 'feast', food_cart: 'feast' },
    schedules: [],
    scheduleOfKind: {},
    other: [],
    edit: { kind: 'catering', title: "Buffet catering · Tita Nena's", price: 450, basis: 'per_pax', inclusions: ['5 dishes', 'Rice', 'Iced tea'] },
  },
  studio: {
    name: 'Lumina Studio',
    type: 'studio',
    covered: [
      { value: 'photo_video', label: 'Full-day coverage' },
      { value: 'same_day_edit', label: 'Same-day edit' },
      { value: 'drone_coverage', label: 'Drone' },
    ],
    folder: { photo_video: 'documentary', same_day_edit: 'documentary', drone_coverage: 'documentary' },
    schedules: [
      { id: '22222222-2222-4222-8222-222222222222', name: 'Main team', perDay: 1 },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Second team', perDay: 1 },
    ],
    scheduleOfKind: { photo_video: '22222222-2222-4222-8222-222222222222' },
    other: [
      { value: 'same_day_edit', label: 'Same-day edit' },
      { value: 'drone_coverage', label: 'Drone' },
    ],
    edit: { kind: 'photo_video', title: 'Full-day coverage · Lumina Studio', price: 85000, basis: 'fixed', inclusions: ['2 shooters', '12 hours', 'Online gallery'] },
  },
};

const SOMETHING_ELSE: CategoryGroup[] = [
  {
    key: 'documentary',
    label: 'Photo & video',
    options: [
      { value: 'photographer', label: 'Photographer', standing: 'open' },
      { value: 'videographer', label: 'Videographer', standing: 'open' },
    ],
  },
  {
    key: 'feast',
    label: 'Food & drink',
    options: [
      { value: 'catering', label: 'Caterer', standing: 'open' },
      { value: 'cake_maker', label: 'Cake', standing: 'open' },
    ],
  },
  {
    key: 'design',
    label: 'Flowers & styling',
    options: [
      { value: 'florist', label: 'Florist', standing: 'open' },
      { value: 'lights_and_sound', label: 'Lights & sound', standing: 'locked', why: 'Your plan covers one kind of business. Upgrade to list under another.' },
    ],
  },
];

function editFixture(shop: Shop): { initial: CanvasInitial; editing: MakerEditing } {
  const e = shop.edit;
  return {
    initial: {
      sourceServiceId: '44444444-4444-4444-8444-444444444444',
      sourceTitle: e.title,
      sourceWasOtherCategory: false,
      title: e.title,
      includesSetnayanGift: false,
      coverageId: '7',
      crewSize: shop.type === 'church' ? '' : '2',
      recommendedLeadTimeMonths: shop.type === 'church' ? '6' : '3',
      lastMinuteEndMonths: '',
      lastMinuteSurchargePct: '',
      pricing: {
        pricing_basis: e.basis,
        starting_price_php: e.basis === 'fixed' ? e.price : null,
        base_pax: null,
        added_pax_price_php: null,
        per_pax_price_php: e.basis === 'per_pax' ? e.price : null,
        min_pax: e.basis === 'per_pax' ? 50 : null,
        hour_base_php: null,
        min_hours: null,
        extra_hour_php: null,
      },
      included: { crew_meal_included: false, transport_included: false, transport_flat_fee_php: null },
      brackets: [],
      discounts: [],
      inclusions: e.inclusions.map((label) => ({ label, worth: '' })),
      linkedCategories: [],
      coverPhotoR2Key: 'r2://media/lab/cover.jpg',
      showcaseVideoR2Key: null,
      showcasePhotoR2Keys: [],
      mediaDisplayUrls: {},
      customization: { status: 'none_linked' },
    },
    editing: {
      serviceId: '44444444-4444-4444-8444-444444444444',
      isActive: true,
      coverUrl: null,
      coverKey: 'r2://media/lab/cover.jpg',
      dailyCapacity: '',
      branchId: '',
      schedule: [
        {
          seq: 0,
          label: 'First payment',
          amount_kind: 'percent',
          percent: 20,
          amount_php: null,
          due_anchor: 'on_lock',
          due_offset_days: 0,
          cancellation_terms: 'The first payment holds your date.',
          downpayment_non_refundable: true,
          refund_window_days: 7,
          no_show_forfeit: true,
        },
      ],
      addons: [{ label: 'Extra hour', price: '5000' }],
      slots: [
        {
          slot_id: '55555555-5555-4555-8555-555555555555',
          vendor_service_id: '44444444-4444-4444-8444-444444444444',
          slot_label: 'Morning',
          start_time: '08:00:00',
          end_time: '12:00:00',
          slot_capacity: 1,
          display_order: 0,
        },
      ],
      poolId: shop.schedules[0]?.id ?? null,
      legacyPromise: null,
    },
  };
}

export default async function CardMakerLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const typeKey = sp.type === 'caterer' || sp.type === 'studio' ? sp.type : 'church';
  const s = typeof sp.s === 'string' ? sp.s : 'new';
  const shop = SHOPS[typeKey];

  const categoryOptions: CategoryGroup[] = [
    { key: 'your-coverage', label: 'What you cover', options: shop.covered.map((c) => ({ ...c, standing: 'covered' as const })) },
    ...SOMETHING_ELSE.map((g) => ({ ...g, options: g.options.filter((o) => !shop.covered.some((c) => c.value === o.value)) })),
  ];
  const coverageAsk: Record<string, { leaf: string; label: string }> = {
    photographer: { leaf: 'photo_video', label: 'Photo & Video' },
    catering: { leaf: 'catering', label: 'Catering' },
    florist: { leaf: 'florist', label: 'Florist' },
  };
  for (const c of shop.covered) delete coverageAsk[c.value];

  const isEdit = s === 'edit' || s === 'unread';
  const fixed = s === 'fixed';
  const fx = isEdit ? editFixture(shop) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6" data-lab="card-maker">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">‹ Shop</span>
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">{isEdit ? shop.edit.title : 'New service'}</h1>
      </div>
      <CanvasMaker
        categoryValue={isEdit || fixed ? shop.edit.kind : ''}
        categoryLabel={isEdit || fixed ? (shop.covered.find((c) => c.value === shop.edit.kind)?.label ?? shop.edit.kind) : ''}
        categoryOptions={isEdit || fixed ? [] : categoryOptions}
        tradeOptions={[]}
        coverageNames={shop.covered.map((c) => c.label)}
        shopName={shop.name}
        otherCategories={shop.other}
        coverages={[{ id: 7, label: `${shop.covered[0]?.label ?? 'Coverage'}` }]}
        vendorProfileId={VP}
        claimToken={null}
        eventTypeOptions={[
          { key: 'wedding', label: 'Wedding' },
          { key: 'debut', label: 'Debut' },
          { key: 'corporate', label: 'Corporate' },
        ]}
        faithOptions={[
          { key: 'catholic', label: 'Catholic' },
          { key: 'christian', label: 'Christian' },
        ]}
        coverageAudience={{ 7: { eventTypes: ['wedding'], faiths: shop.type === 'church' ? ['catholic'] : [] } }}
        coverageAllowed={{ 7: null }}
        supplierType={shop.type}
        folderOfKind={shop.folder}
        coverageAsk={isEdit ? {} : coverageAsk}
        schedules={shop.schedules}
        scheduleOfKind={shop.scheduleOfKind}
        slotsPerDay={typeKey === 'studio' ? 3 : typeKey === 'church' ? 1 : 0}
        branches={[]}
        initial={fx?.initial ?? null}
        editing={fx?.editing ?? null}
        unread={s === 'unread' ? ['add-ons'] : []}
        returnTo="/dev/card-maker-lab"
      />
    </div>
  );
}
