/**
 * /dev/supplier-tools-lab — 🧰 THE SUPPLIER TOOL PAGES REDRAW (owner-approved v3, 21 Nov 2026 ·
 * `supplier_tools_redraw_v3_fable.html`) on fixture data: no sign-in, no database. DEV-ONLY: production builds 404 this
 * route (`app/dev/layout.lab.tsx` + the first statement below).
 *
 * Draws the REAL screens the pages mount, fed fixtures instead of reads:
 *   ?p=theft-watch   &s=rows | empty | fail
 *   ?p=track-record  &s=rows | empty | fail
 *   ?p=disputes      &s=rows | empty | partial
 *   ?p=creators      &s=rows | empty
 *   ?p=manpower      &s=rows | fail | empty
 * The forms post the REAL actions; pressing them here needs a session (the lab draws, it does not save).
 * Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { paginate } from '@/lib/paginate';
import { TheftWatchView } from '@/app/vendor-dashboard/theft-watch/_components/theft-watch-view';
import { TrackRecordView } from '@/app/vendor-dashboard/track-record/_components/track-record-view';
import { DisputesView, type DisputeRow } from '@/app/vendor-dashboard/disputes/_components/disputes-view';
import { CreatorsView } from '@/app/vendor-dashboard/creators/_components/creators-view';
import type { VendorRepostFlag } from '@/lib/vendor-theft-watch';
import type { VendorTrackRecordRow } from '@/app/vendor-dashboard/_components/vendor-track-record-panel';
import type { EligibleCreator, VendorSentOffer } from '@/lib/creator-offers';
import type { VendorCreatorRoiRow } from '@/lib/creator-analytics';
import { ManpowerView } from '@/app/vendor-dashboard/manpower/_components/manpower-view';
import type { ManpowerGigRow } from '@/app/vendor-dashboard/manpower/actions';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21, 2, 0);
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

const REPOSTS: VendorRepostFlag[] = [
  { publicId: 'S89F-LAB0000001', surface: 'portfolio', r2Ref: '', status: 'open', hammingDistance: 3, createdAt: ago(9) },
  { publicId: 'S89F-LAB0000002', surface: 'service_primary', r2Ref: '', status: 'confirmed_theft', hammingDistance: 1, createdAt: ago(19) },
  { publicId: 'S89F-LAB0000003', surface: 'moodboard_library', r2Ref: '', status: 'dismissed', hammingDistance: 6, createdAt: ago(34) },
];

const TRACK: VendorTrackRecordRow[] = [
  { event_type: 'wedding', event_type_label: 'Wedding', completed_count: 8, review_count: 5, avg_rating: 4.8 },
  { event_type: 'debut', event_type_label: 'Debut', completed_count: 2, review_count: 1, avg_rating: 5 },
  { event_type: 'christening', event_type_label: 'Christening', completed_count: 1, review_count: 0, avg_rating: null },
  { event_type: 'corporate', event_type_label: 'Corporate event', completed_count: 1, review_count: 0, avg_rating: null },
];

const DISPUTES: DisputeRow[] = [
  {
    dispute_id: 'lab-d1', public_id: 'S89D-7K2P9QX4MA', category: 'late_arrival',
    description: 'The lights team arrived 40 minutes after the call time we agreed.', status: 'open',
    resolved_at: null, resolution_notes: null, counts_toward_demotion: false,
    vendor_contest: 'Traffic on SLEX; I messaged the coordinator at 3:10 PM and we were set before the march.',
    vendor_contested_at: ago(1), created_at: ago(3),
  },
  {
    dispute_id: 'lab-d2', public_id: 'S89D-2M8XRT4QWE', category: 'quality_issue',
    description: 'The album colours were off from the sample.', status: 'resolved_for_vendor',
    resolved_at: ago(73), resolution_notes: 'The sample was approved in chat on 12 Aug; the album matches it.',
    counts_toward_demotion: false, vendor_contest: null, vendor_contested_at: null, created_at: ago(80),
  },
  {
    dispute_id: 'lab-d3', public_id: 'S89D-9PZ3LA0VBN', category: 'refund_request',
    description: 'We asked for a partial refund after the cancelled second set.', status: 'resolved_for_couple',
    resolved_at: ago(90), resolution_notes: null, counts_toward_demotion: true, vendor_contest: null,
    vendor_contested_at: null, created_at: ago(99),
  },
  {
    dispute_id: 'lab-d4', public_id: 'S89D-4HCQ8W2JKD', category: 'communication',
    description: 'Replies took more than a day.', status: 'withdrawn', resolved_at: ago(140), resolution_notes: null,
    counts_toward_demotion: false, vendor_contest: null, vendor_contested_at: null, created_at: ago(142),
  },
];

const OFFERS = [
  { offerId: 'lab-o1', creatorUserId: 'lab-c1', creatorName: 'Mika Reyes', creatorSlug: null, creatorRateTerms: '20% off any package for you', audienceRateTerms: null, status: 'pending', fulfilledAt: null },
  { offerId: 'lab-o2', creatorUserId: 'lab-c4', creatorName: 'Tin & Jo Travels', creatorSlug: null, creatorRateTerms: '15% off', audienceRateTerms: null, status: 'accepted', fulfilledAt: null },
  { offerId: 'lab-o3', creatorUserId: 'lab-c5', creatorName: 'Ana Cruz', creatorSlug: null, creatorRateTerms: 'free prenup shoot', audienceRateTerms: null, status: 'expired', fulfilledAt: null },
] as unknown as VendorSentOffer[];

const ROI = [
  { creatorUserId: 'lab-c4', creatorName: 'Tin & Jo Travels', creatorSlug: null, inquiriesDriven: 12, collabStatus: 'accepted', fulfilled: false },
] as unknown as VendorCreatorRoiRow[];

const CREATORS = [
  { userId: 'lab-c1', displayName: 'Mika Reyes', slug: null, followersCount: 1200, viewCount: 8400, chapterCount: 6, inquiriesDriven: 0 },
  { userId: 'lab-c2', displayName: 'Paolo Dizon', slug: null, followersCount: 640, viewCount: 2100, chapterCount: 3, inquiriesDriven: 4 },
  { userId: 'lab-c3', displayName: 'Bea & Migs', slug: null, followersCount: 3800, viewCount: 21000, chapterCount: 11, inquiriesDriven: 31 },
] as unknown as EligibleCreator[];

const gig = (id: string, label: string, php: number, status: string, extra: Record<string, unknown> = {}) =>
  ({ gig_id: id, gig_label: label, cash_amount_php_centavos: php * 100, status, notes: null, accepted_at: status === 'pending' ? null : ago(9), completed_at: null, cancellation_reason: null, ...extra }) as unknown as ManpowerGigRow;
const GIGS_OPEN = [gig('g1', 'Extra lights crew, 2 people', 3500, 'pending')];
const GIGS_MINE = [
  gig('g2', 'Sound tech, 6 hours', 2000, 'accepted'),
  gig('g3', 'Usher team, 4 people', 4000, 'completed', { completed_at: ago(19) }),
  gig('g4', 'Generator watch', 1500, 'cancelled', { cancellation_reason: 'host moved the date' }),
];

export default async function SupplierToolsLab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const p = typeof sp.p === 'string' ? sp.p : 'theft-watch';
  const s = typeof sp.s === 'string' ? sp.s : 'rows';

  let screen: React.ReactNode = null;
  if (p === 'theft-watch') screen = <TheftWatchView reposts={s === 'fail' ? null : s === 'empty' ? [] : REPOSTS} />;
  if (p === 'track-record') screen = <TrackRecordView rows={s === 'fail' ? null : s === 'empty' ? [] : TRACK} />;
  if (p === 'disputes') {
    const rows = s === 'empty' ? [] : DISPUTES;
    screen = <DisputesView rows={rows} incomplete={s === 'partial'} paged={paginate(rows, 1)} keepParams="" />;
  }
  if (p === 'creators') {
    const empty = s === 'empty';
    screen = (
      <CreatorsView
        creators={empty ? [] : CREATORS}
        sentOffers={empty ? [] : OFFERS}
        roi={empty ? [] : ROI}
        minReach={empty ? 500 : 500}
        pendingCreatorIds={new Set(['lab-c1'])}
        sendNeedsPro
        flash={{ sent: false }}
      />
    );
  }

  if (p === 'manpower') {
    screen = (
      <ManpowerView
        openGigs={s === 'empty' ? [] : GIGS_OPEN}
        openEmpty="No gigs yet · open gigs appear here once a host you serve posts one."
        openNote={null}
        mine={s === 'fail' ? null : s === 'empty' ? [] : GIGS_MINE}
      />
    );
  }

  return (
    <div className="sn-ambient min-h-dvh pt-2" data-supplier-look="" data-lab-supplier-tools={`${p}:${s}`}>
      <main>{screen}</main>
    </div>
  );
}
