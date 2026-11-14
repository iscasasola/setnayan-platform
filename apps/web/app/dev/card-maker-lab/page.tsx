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
 *   &checks=1                     🃏 the card checks — fix before Create (owner 2026-10-26) on fixtures: the six seed claim
 *                                 words, this lab's trades (with an alias), and a photo ask that says the cover is on
 *                                 another shop's card and a showcase photo on another of this shop's cards
 *   &booked=1                     🔒 an edited card couples have booked — the price row says they keep their price (Build 5 Lane C)
 *   &host=add                     ➕ the dashboard's New service as it opens now (ruling 5820): THE ONE Add-a-service picker
 *                                 on this lab's tree, the shop's own card kinds "On your shop", "Make N cards", the maker
 *                                 behind "Start a blank card"; each pick's "+ Specialties (optional)" and the plan meter
 *   &host=add&read=shop           🔒 …when the shop's own services could not be read: the line + Try again, no picker
 *   &host=add&read=tree           🔒 …when the service list could not be read: the line + Try again, never a blank picker
 *   &portfolio=albums|none|unread 🃏📸 the edit sheet's Portfolio fold as it reads with the card-record flag ON (frames 72 · 74 · 75):
 *                                 this card's event albums + own uploads last · own uploads only · Couldn't load · Retry
 *   &record=unread                🃏 the Record fold when the record read is refused (frame 75)
 *   &work=1|unread                🃏📸 Their work (frame 78): each album names the card(s) it was booked on · retired pill
 *   &host=today                   the maker inside TODAY's host — the "What you offer" step's ＋ Start opens it as the
 *                                 same `SetupOfferFold` sheet the page draws, so its own sheets (What you offer, Preview,
 *                                 the photos…) can be checked over that sheet, not only on the standalone page
 *
 * Names are the prototype's samples: nobody real.
 */
import { LAB_FAIR_WORDS } from '../lab-fair-words';
import { CardPortfolioSection } from '@/app/_components/card-portfolio-section';
import { TheirWorkList } from '@/app/vendor-dashboard/services/their-work/their-work-list';
import { LAB_CARD_ALBUMS, LAB_CARD_SUMMARY, LAB_THEIR_OWN, LAB_THEIR_WORK } from '../card-albums-lab-fixture/fixture';
import { notFound } from 'next/navigation';
import type { CoverageParent } from '@/lib/vendor-coverages';
import { liveKindGroups } from '@/lib/service-card-kind-groups';
import { CanvasMaker, type CategoryGroup, type MakerEditing, type MakerSchedule } from '@/app/vendor-dashboard/services/_components/canvas-maker';
import type { CanvasInitial } from '@/lib/canvas-initial';
import type { SupplierType } from '@/lib/service-card-maker';
import { SetupOfferFold } from '@/app/vendor-dashboard/_components/setup-offer-fold';
import type { FreeByKind, ShopGiftPack } from '@/lib/shop-gifts';
import type { CardPhotoVerdict } from '@/lib/service-card-checks';
import type { MakerCheckRules } from '@/app/vendor-dashboard/services/_components/card-checks';
import { AddServicePicker } from '@/app/vendor-dashboard/services/new/_components/add-service-picker';

/** 🃏 `&checks=1` — the owner's six seed words (the migration's), as the maker reads them. LAB FIXTURES. */
const LAB_CLAIM_WORDS = [
  { phrase: 'guaranteed', why: 'A promise we can’t stand behind for you.' },
  { phrase: '#1', why: 'A ranking nobody measured.' },
  { phrase: 'best in', why: 'A ranking nobody measured.' },
  { phrase: 'lowest price', why: 'A comparison with other shops we can’t check.' },
  { phrase: 'official', why: 'Reads as an appointment by a brand or a venue.' },
  { phrase: '100%', why: 'A promise we can’t stand behind for you.' },
];

/** 🃏 The lab's photo ask: the cover is on another shop's card; any showcase photo on this shop's "Grazing table". */
async function labPhotoCheck(input: { serviceId: string | null; cover: string | null; showcase: string[] }): Promise<CardPhotoVerdict[]> {
  'use server';
  if (process.env.NODE_ENV === 'production') return [];
  return [
    ...(input.cover ? [{ ref: input.cover, where: 'cover' as const, verdict: 'another_shop' as const }] : []),
    ...input.showcase.map((ref) => ({ ref, where: 'showcase' as const, verdict: 'this_shop' as const, cardTitle: 'Grazing table' })),
  ];
}

const VP = '00000000-0000-4000-8000-0000000000bb';

/**
 * The Gift dropdown's packs (7 Nov 2026) — LAB FIXTURES, never a price: the live maker reads them from the catalogue
 * (`fetchShopGiftPacks`). The stock covers the Papic pack only, so Event Plus shows its "buy first" note.
 */
const LAB_GIFT_PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST', title: 'Papic credits for their guests', kind: 'papic', credits: 100, srpCentavos: 0 },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 0 },
];
const LAB_GIFT_FREE: FreeByKind = { papic: 300, event_plus: 0, event_pro: 0, event_ultra: 0, packs: { PAPIC_GUEST: 3 } };

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
    edit: { kind: 'photo_video', title: 'Full-day coverage · Lumina Studio', price: 85000, basis: 'fixed', inclusions: ['2 shooters', '12 hours', 'Online album'] },
  },
};

/**
 * A small FAKE live taxonomy (the shape `getCoverageTaxonomy()` returns) — the "Something else" folds are drawn from it
 * by the SAME builder the loader uses (`liveKindGroups`), so this lab shows what a supplier sees, not a hand-made list.
 */
const FAKE_TREE: CoverageParent[] = [
  {
    folderId: 'documentary',
    label: 'Photo & video',
    branches: [
      { tileId: 't-photo', label: 'Photography', leaves: [
        { canonicalService: 'photography', label: 'Photography', allowedEventTypes: null },
        { canonicalService: 'drone_photography', label: 'Drone photography', allowedEventTypes: null },
      ] },
      { tileId: 't-video', label: 'Videography', leaves: [{ canonicalService: 'videography', label: 'Videography', allowedEventTypes: null }] },
    ],
  },
  {
    folderId: 'feast',
    label: 'Food & drink',
    branches: [
      { tileId: 't-cater', label: 'Catering', leaves: [
        { canonicalService: 'buffet_catering', label: 'Buffet catering', allowedEventTypes: null },
        { canonicalService: 'catering', label: 'Plated catering', allowedEventTypes: null },
      ] },
      { tileId: 't-cart', label: 'Food cart', leaves: [{ canonicalService: 'sorbetes_cart', label: 'Sorbetes cart', allowedEventTypes: null }] },
      { tileId: 't-cake', label: 'Cakes', leaves: [{ canonicalService: 'cake_maker', label: 'Cake', allowedEventTypes: null }] },
    ],
  },
  {
    folderId: 'design',
    label: 'Flowers & styling',
    branches: [
      { tileId: 't-flo', label: 'Florals', leaves: [{ canonicalService: 'florals', label: 'Florals', allowedEventTypes: null }] },
      { tileId: 't-tent', label: 'Rentals', leaves: [{ canonicalService: 'tent_rental', label: 'Tent rental', allowedEventTypes: null }] },
    ],
  },
  {
    folderId: 'production',
    label: 'Lights & production',
    branches: [
      { tileId: 't-ls', label: 'Lights & sound', leaves: [
        { canonicalService: 'lights_and_sound', label: 'Lights & sound', allowedEventTypes: null },
        { canonicalService: 'generator_hire', label: 'Generator hire', allowedEventTypes: null },
      ] },
    ],
  },
];
const LOCKED_FOLDER = 'production';

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
      inclusions: e.inclusions.map((label) => ({ label })),
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

/** ➕ host=add — each service's own specialty chips (the sign-up lab's shape; fixture words, nobody's real schema). */
const labChips = (key: string, label: string, values: string[], single = false) => ({
  key,
  label,
  options: values.map((v) => ({ value: v.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: v })),
  single,
});
const LAB_PICKER_SPECIALTIES = {
  cake_maker: [labChips('cake_style', 'Cake style', ['Fondant', 'Buttercream', 'Naked cake', 'Cupcake tower'])],
  drone_photography: [labChips('drone_shots', 'Shots', ['Aerial stills', 'Aerial video', 'FPV fly-through'])],
  photography: [labChips('shoot', 'Shoot', ['Pre-nup', 'Wedding day', 'Engagement'])],
  sorbetes_cart: [labChips('flavours', 'Flavours', ['Ube', 'Mango', 'Cheese', 'Chocolate'])],
};

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
    ...liveKindGroups({
      tree: FAKE_TREE,
      standingOf: (key) =>
        FAKE_TREE.find((p) => p.folderId === LOCKED_FOLDER)?.branches.some((b) => b.leaves.some((l) => l.canonicalService === key))
          ? { standing: 'locked', why: 'Your plan covers one kind of business. Upgrade to list under another.' }
          : { standing: 'open' },
      ownCategories: [],
      leadWithOwnWords: true,
      kindLabel: (k) => k,
      alreadyListed: new Set(shop.covered.map((c) => c.value)),
    }),
  ];
  const coverageAsk: Record<string, { leaf: string; label: string }> = {
    photography: { leaf: 'photography', label: 'Photography' },
    videography: { leaf: 'videography', label: 'Videography' },
    catering: { leaf: 'catering', label: 'Catering' },
    florals: { leaf: 'florals', label: 'Florals' },
  };
  for (const c of shop.covered) delete coverageAsk[c.value];

  const isEdit = s === 'edit' || s === 'unread';
  const fixed = s === 'fixed';
  const fx = isEdit ? editFixture(shop) : null;
  const inToday = sp.host === 'today';
  const withChecks = sp.checks === '1';
  const labTrades = FAKE_TREE.flatMap((p) =>
    p.branches.flatMap((b) =>
      b.leaves.map((l) => ({ key: l.canonicalService, label: l.label, branch: b.label, aliases: l.canonicalService === 'lights_and_sound' ? ['sound system'] : l.canonicalService === 'sorbetes_cart' ? ['sorbetero'] : undefined })),
    ),
  );
  const checkRules: MakerCheckRules | null = withChecks
    ? { claimWords: [...LAB_CLAIM_WORDS, ...LAB_FAIR_WORDS.filter((w) => !LAB_CLAIM_WORDS.some((c) => c.phrase === w.phrase))], trades: labTrades, ownCards: [{ id: 'lab-other', title: 'Classic Booth' }] }
    : null;

  // 🃏📸 The flag-ON reads, on fixtures (`card-albums-lab-fixture`). Absent → the maker exactly as the flag-OFF page draws it.
  const portfolio = sp.portfolio === 'albums' || sp.portfolio === 'none' || sp.portfolio === 'unread' ? sp.portfolio : null;
  const labOwn = ['/event-types/celebration.webp', '/event-types/anniversary.webp', '/event-types/gala_night.webp'];
  const portfolioSlot = portfolio ? (
    <CardPortfolioSection work={portfolio === 'unread' ? null : portfolio === 'none' ? [] : LAB_CARD_ALBUMS} own={labOwn} variant="vendor" retryHref="/dev/card-maker-lab?s=edit" />
  ) : null;
  const portfolioLine = portfolio === 'unread' ? 'Couldn’t load · Retry' : portfolio === 'none' ? 'Your own uploads only · albums come from bookings' : portfolio ? LAB_CARD_SUMMARY : null;
  const recordSlot =
    sp.record === 'unread' ? (
      <p className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink/75" role="status" data-card-record="unread">
        <span>Couldn’t load this card’s record</span>
        <span className="inline-flex min-h-11 items-center font-medium text-sn-accent">Retry</span>
      </p>
    ) : null;

  if (sp.work === '1' || sp.work === 'unread') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:px-6" data-lab="their-work">
        <div className="mb-2 flex min-h-11 items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">‹ Shop</span>
        </div>
        <h1 className="text-[22px] font-semibold text-ink">Their work</h1>
        <p className="mt-1 text-[14px] text-ink/60">One album per event · newest first · type · venue · month · no names</p>
        <TheirWorkList albums={sp.work === 'unread' ? null : LAB_THEIR_WORK} own={LAB_THEIR_OWN} retryHref="/dev/card-maker-lab?work=1" />
      </div>
    );
  }

  const maker = (
      <CanvasMaker
        recordSlot={recordSlot}
        portfolioSlot={portfolioSlot}
        portfolioLine={portfolioLine}
        categoryValue={isEdit || fixed ? shop.edit.kind : ''}
        categoryLabel={isEdit || fixed ? (shop.covered.find((c) => c.value === shop.edit.kind)?.label ?? shop.edit.kind) : ''}
        categoryOptions={isEdit || fixed ? [] : categoryOptions}
        tradeOptions={FAKE_TREE.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => ({ key: l.canonicalService, label: l.label, branch: b.label, standing: p.folderId === LOCKED_FOLDER ? ('locked' as const) : ('open' as const) }))))}
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
        branches={[]}
        giftPacks={LAB_GIFT_PACKS}
        giftFree={LAB_GIFT_FREE}
        initial={fx && sp.gift === 'pack' ? { ...fx.initial, giftPackCode: 'PAPIC_GUEST' } : (fx?.initial ?? null)}
        editing={fx?.editing ?? null}
        bookedNow={sp.booked === '1' ? 3 : undefined}
        unread={s === 'unread' ? ['add-ons'] : []}
        returnTo="/dev/card-maker-lab"
        checkRules={checkRules}
        photoCheck={withChecks ? labPhotoCheck : undefined}
      />
  );

  if (sp.host === 'add') {
    // The page's own frame (`/vendor-dashboard/services/new`): ‹ Shop · New service, then the ONE picker.
    const pickerTree = FAKE_TREE.map((p) => ({
      folderId: p.folderId,
      label: p.label,
      branches: p.branches.map((b) => ({
        tileId: b.tileId,
        label: b.label,
        photoUrl: null,
        hint: null,
        leaves: b.leaves.map((l) => ({
          canonicalService: l.canonicalService,
          label: l.label,
          tileId: b.tileId,
          aliases: labTrades.find((t) => t.key === l.canonicalService)?.aliases,
          allowedEventTypes: l.allowedEventTypes,
        })),
      })),
    }));
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6" data-lab="card-maker" data-lab-host="add">
        <div className="mb-2 flex min-h-11 items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">‹ Shop</span>
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">New service</h1>
        </div>
        <AddServicePicker
          tree={sp.read === 'tree' ? [] : pickerTree}
          specialties={LAB_PICKER_SPECIALTIES}
          onShop={sp.read === 'shop' ? null : shop.covered.map((c) => c.value)}
          maker={maker}
        />
      </div>
    );
  }

  if (inToday) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6" data-lab="card-maker" data-lab-host="today">
        <h1 className="mb-2 text-[17px] font-semibold tracking-tight text-ink">What you offer</h1>
        <SetupOfferFold services={[{ service: shop.covered[0]?.value ?? 'service', label: shop.covered[0]?.label ?? 'Service', cards: [], toGo: 3, target: 3 }]} maker={maker} />
      </div>
    );
  }

  return (
    // The route's own frame (services/[serviceId] · services/new/[category], 7 Nov 2026): a back link, no page title.
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6" data-lab="card-maker">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">‹ {isEdit ? 'Shop' : 'Services'}</span>
      </div>
      {maker}
    </div>
  );
}
