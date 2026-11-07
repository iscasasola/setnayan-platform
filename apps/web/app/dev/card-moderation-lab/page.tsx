/**
 * /dev/card-moderation-lab — the admin minimum for the 7 Nov 2026 supplier registration, on fixture data. No
 * sign-in, no database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL pieces —
 * the admin supplier page's `ServiceCardsSection` and the public shop page's `ServicesGallery` with cards built by
 * the real `toServiceCard` — so what it shows is what ships. Its forms post to the real action, which refuses
 * here (no admin session); press nothing but the disclosure toggles.
 *
 *   ?f=admin               Admin › a supplier › Service cards: a live card (cover + showcase), a draft, a taken-down card
 *   ?f=admin&result=…      the same, with the result line (taken-down · back-live · back-draft-gate · photo-removed)
 *   ?f=public              the shop page's Services & pricing as a couple sees it — both cards live
 *   ?f=public&after=1      the same page after "Take down card" on the band: `is_active` false + the hold, filtered by
 *                          the SAME predicate `/v/[slug]` uses (`allServices.filter((s) => s.is_active)`)
 *
 *   ?f=public&held=1       the same page while the band card is on PLAN hold (owner 2026-11-06, SERVICES LIFE CYCLE):
 *                          the hold is `is_active` false too, so the SAME predicate hides it
 *   ?f=stay-on             "Which services stay on" — a Free shop whose first booking is done, three services on:
 *                          Today's line + the REAL `StayOnPicker` (its form posts to the real action, which refuses here)
 *   ?f=stay-on&down=1      the same picker for a Pro shop with Solo scheduled (A DOWNGRADE PUTS EXTRA SERVICES ON HOLD)
 *   ?f=held                the supplier's own Services row for a held card: the REAL `PlanHoldTag` in place of the
 *                          switch, and the row line
 *
 * The database half (the hold a supplier cannot lift; a couple can no longer read the row) is
 * `tests/db/a-taken-down-card-stays-down.db.test.ts` and, for the plan hold, `tests/db/a-held-service-stays-held.db.test.ts`
 * — this page is the picture, those tests are the proof.
 */
import { notFound } from 'next/navigation';

import {
  ServiceCardsSection,
  type AdminServiceCard,
} from '@/app/admin/vendors/[vendorProfileId]/_components/service-cards-section';
import { ServicesGallery } from '@/app/v/[slug]/_components/services-gallery';
import { formatPhpRounded } from '@/lib/php';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { StayOnPicker, type StayOnPlan } from '@/app/vendor-dashboard/services/_components/stay-on-picker';
import { PlanHoldTag } from '@/app/vendor-dashboard/services/_components/plan-hold-tag';
import { StayOnTodayLineView } from '@/app/vendor-dashboard/_components/stay-on-today-line';
import { pickServicesThatStayOn } from '@/app/vendor-dashboard/services/stay-on-actions';
import { HOLD_WORDS, ladderFor, pickModeFor, type PlanCard } from '@/lib/service-plan-hold';
import type { VendorTier } from '@/lib/vendor-tier-caps';

const SHOP_ID = '00000000-0000-4000-8000-00000000c0de';
const NOW = new Date('2026-11-05T09:00:00+08:00');

const RESULT: Readonly<Record<string, string>> = {
  'taken-down': 'Card taken down. Couples can no longer see it, and the supplier has been told why.',
  'back-live': 'Card put back. It is live again, and the supplier has been told.',
  'back-draft-gate':
    'Take-down lifted, but the card could not go live again (it is missing a cover, a price or what is included). It is a draft; the supplier has been told.',
  'photo-removed': 'Photo removed from the card. The supplier has been told why.',
};

const ADMIN_CARDS = (takenDown: boolean): AdminServiceCard[] => [
  {
    id: '00000000-0000-4000-8000-00000000ca01',
    publicId: 'S89S-7KQ2M4X9PA',
    title: 'Garden Wedding Live Band',
    kind: 'Live Band',
    price: `From ${formatPhpRounded(45000)}`,
    status: takenDown ? 'taken_down' : 'live',
    takenDownReason: takenDown ? 'The cover photo belongs to another studio. Please upload your own work.' : null,
    cover: { key: 'r2://setnayan-media/lab/cover.jpg', url: '/realstories/maria-juan-tagaytay.jpg' },
    showcase: [
      { key: 'r2://setnayan-media/lab/s1.jpg', url: '/realstories/jack-rose-baguio.jpg' },
      { key: 'r2://setnayan-media/lab/s2.jpg', url: '/realstories/john-jane-g2.jpg' },
      { key: 'r2://setnayan-media/lab/s3.jpg', url: '/realstories/peter-mary-g3.jpg' },
    ],
    publicHref: takenDown ? null : '/dev/card-moderation-lab?f=public',
  },
  {
    id: '00000000-0000-4000-8000-00000000ca02',
    publicId: 'S89S-3HD8W1RT6N',
    title: 'Acoustic Duo for the Ceremony',
    kind: 'Live Band',
    price: `From ${formatPhpRounded(18000)}`,
    status: 'live',
    takenDownReason: null,
    cover: { key: 'r2://setnayan-media/lab/duo.jpg', url: '/realstories/jack-jill-g1.jpg' },
    showcase: [],
    publicHref: '/dev/card-moderation-lab?f=public',
  },
  {
    id: '00000000-0000-4000-8000-00000000ca03',
    publicId: 'S89S-9ZP0B5VC2E',
    title: 'Reception Party Set',
    kind: 'Live Band',
    price: 'No price yet',
    status: 'draft',
    takenDownReason: null,
    cover: null,
    showcase: [],
    publicHref: null,
  },
];

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

/** Three services on a shop: two band cards (one kind) and a lights card (another family). */
const PLAN_CARDS = (hold: PlanCard['hold'] = null, startsOn: VendorTier | null = null): PlanCard[] => [
  { id: '00000000-0000-4000-8000-00000000ca01', name: 'Garden Wedding Live Band', kind: 'live_band', families: ['music_entertainment'], live: hold !== 'held', hold, holdStartsOn: startsOn },
  { id: '00000000-0000-4000-8000-00000000ca02', name: 'Acoustic Duo for the Ceremony', kind: 'live_band', families: ['music_entertainment'], live: true, hold: null, holdStartsOn: null },
  { id: '00000000-0000-4000-8000-00000000ca04', name: 'Stage Lights & Sound', kind: 'lights_and_sound', families: ['production_technical'], live: true, hold: null, holdStartsOn: null },
];

/** A fourth service in a third family — more than Solo holds (2 categories), for the downgrade frame. */
const PHOTO_BOOTH: PlanCard = { id: '00000000-0000-4000-8000-00000000ca05', name: 'Photo Booth Corner', kind: 'photo_booth', families: ['photo_video'], live: true, hold: null, holdStartsOn: null };

function plansFor(current: VendorTier, pending: VendorTier | null): StayOnPlan[] {
  return ladderFor(current, pending).flatMap((tier) => {
    const mode = pickModeFor(tier, current, pending);
    return mode ? [{ tier, mode }] : [];
  });
}

export default async function CardModerationLabPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; result?: string; after?: string; held?: string; down?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  if (sp.f === 'stay-on') {
    const down = sp.down === '1';
    const current: VendorTier = down ? 'pro' : 'free';
    const pending: VendorTier | null = down ? 'solo' : null;
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <p className="font-serif text-2xl text-ink">Saysay Live Band</p>
          <p className="text-xs text-ink/55">Lab · {down ? 'Pro, Solo scheduled' : 'Free, first booking done'} — Today, then My Shop › Services</p>
        </div>
        <StayOnTodayLineView text={down ? HOLD_WORDS.todayDowngrade('solo', 'November 30, 2026') : HOLD_WORDS.todayFirstBooking} />
        <div className="border-b border-ink/10 pb-4">
          <StayOnPicker
            cards={down ? [...PLAN_CARDS(), PHOTO_BOOTH] : PLAN_CARDS()}
            plans={plansFor(current, pending)}
            startPlan={pending ?? current}
            founder={false}
            owner
            nowWaits={false}
            action={pickServicesThatStayOn}
          />
        </div>
      </main>
    );
  }

  if (sp.f === 'held') {
    const cards = PLAN_CARDS('held');
    return (
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <div className="space-y-1">
          <p className="font-serif text-2xl text-ink">Saysay Live Band</p>
          <p className="text-xs text-ink/55">Lab · My Shop › Services — the band card is on plan hold</p>
        </div>
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">{c.name}</p>
                <p className="mt-0.5 text-[12px] text-ink/60">{c.hold === 'held' ? HOLD_WORDS.rowLine : 'Live'}</p>
              </div>
              {c.hold === 'held' ? <PlanHoldTag /> : <span className="text-[12px] text-ink/55">On</span>}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (sp.f === 'public') {
    const held = sp.held === '1';
    const after = sp.after === '1' || held;
    // The band card after "Take down card": the action's own write — is_active false + the hold.
    const rows = [
      row({
        vendor_service_id: '00000000-0000-4000-8000-00000000ca01',
        public_id: 'S89S-7KQ2M4X9PA',
        title: 'Garden Wedding Live Band',
        is_active: !after,
      }),
      row({
        vendor_service_id: '00000000-0000-4000-8000-00000000ca02',
        public_id: 'S89S-3HD8W1RT6N',
        title: 'Acoustic Duo for the Ceremony',
        starting_price_php: 18000,
        crew_size: 2,
      }),
    ];
    const photos: Record<string, string[]> = {
      '00000000-0000-4000-8000-00000000ca01': ['/realstories/maria-juan-tagaytay.jpg', '/realstories/jack-rose-baguio.jpg'],
      '00000000-0000-4000-8000-00000000ca02': ['/realstories/jack-jill-g1.jpg'],
    };
    // The SAME predicate the public shop page applies (app/v/[slug]/page.tsx).
    const activeServices = rows.filter((s) => s.is_active);
    const cards = activeServices.map((r) =>
      toServiceCard(
        r,
        [{ vendor_service_id: r.vendor_service_id, label: 'Sound system', worth_php: null, sort_order: 0 }],
        [],
        'Wedding · Debut',
        { photos: photos[r.vendor_service_id] ?? [], videoUrl: null },
        false,
        null,
        NOW,
        null,
        null,
        false,
      ),
    );
    return (
      <main className="min-h-dvh bg-cream">
        <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <p className="font-serif text-2xl text-ink">Saysay Live Band</p>
          <p className="text-xs text-ink/55">
            Lab · the public shop page’s Services &amp; pricing — {held ? 'while the band card is on plan hold' : after ? 'after the band card was taken down' : 'before any take-down'}
          </p>
          <h2 className="text-lg font-medium text-ink">Services &amp; pricing</h2>
          <ServicesGallery groups={[{ key: 'live_band', label: 'Live Band', cards }]} />
        </div>
      </main>
    );
  }

  const done = sp.result ? (RESULT[sp.result] ?? null) : null;
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <p className="font-serif text-2xl text-ink">Saysay Live Band</p>
        <p className="font-mono text-[11px] text-ink/55">S89V-LAB0CARDS1 · lab — Admin › a supplier</p>
      </div>
      {done ? (
        <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success-900">
          {done}
        </p>
      ) : null}
      <ServiceCardsSection shopId={SHOP_ID} cards={ADMIN_CARDS(sp.result === 'taken-down')} cap={50} />
    </main>
  );
}
