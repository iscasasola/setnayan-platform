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
 *   ?p=attributes    &s=rows | saved | empty | fail
 *   ?p=repertoire    &s=rows | search | notmusic
 *   ?p=recommend     &s=rows | empty
 *   ?p=activities    &s=rows | fail
 *   ?p=lines         &s=rows | segfail | fail | empty
 *   ?p=moodboard     &s=rows | empty
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
import { AttributesUnread, AttributesView } from '@/app/vendor-dashboard/attributes/_components/attributes-view';
import { RepertoireNotMusic, RepertoireView } from '@/app/vendor-dashboard/repertoire/_components/repertoire-view';
import { RecommendationsPanel, type LeafGroup } from '@/app/vendor-dashboard/recommendations/_panel';
import { ActivitiesView } from '@/app/vendor-dashboard/activities/_components/activities-view';
import { QuestionsSectionBody } from '@/app/vendor-dashboard/activities/questions-section';
import { TemplateFail } from '@/app/_components/template-rows';
import type { ResolvedSchema, VendorAttributePayload } from '@/lib/vendor-service-attributes';
import type { VendorActivity } from '@/lib/vendor-activities';
import type { VendorQuestion } from '@/lib/emcee-questions';
import { LinesView } from '@/app/vendor-dashboard/lines/_components/lines-view';
import type { LineRow } from '@/app/vendor-dashboard/lines/_components/line-rows';
import { StylistLibraryEditor, type StylistAsset } from '@/app/vendor-dashboard/moodboard-library/_components/stylist-library-editor';
import { ToolPin } from '@/app/vendor-dashboard/_components/tool-page';

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


const GOWNS: ResolvedSchema = {
  canonical_service: 'bridal_gowns', display_name_en: 'Bridal gowns', display_name_tl: 'Damit pangkasal', schema_version: 3,
  fields: {
    silhouettes: { type: 'multi_select', label: 'Silhouettes', required: true, options: ['ballgown', 'a_line', 'mermaid', 'sheath'] },
    fabric_type: { type: 'enum', label: 'Fabric', options: ['tulle', 'satin', 'lace'] },
    lead_time_weeks: { type: 'int', label: 'Lead time (weeks)', min: 1 },
    made_to_measure: { type: 'boolean', label: 'Made to measure' },
    designers: { type: 'multi_select_open', label: 'Designers you carry' },
  },
  filter_facets: ['fabric_type'],
  required_for_visibility: { minimum_fields: ['silhouettes', 'fabric_type'] },
} as unknown as ResolvedSchema;
const CATERING = { ...GOWNS, canonical_service: 'catering', display_name_en: 'Catering', display_name_tl: 'Handaan' } as ResolvedSchema;
const PHOTO = { ...GOWNS, canonical_service: 'photo_video', display_name_en: 'Photo & video', display_name_tl: 'Larawan at bidyo' } as ResolvedSchema;
// The gate's own column is NOT typed here: a lab is not a reader of it (tests/db/handles-have-gates.db.test.ts), so every
// fixture row reads "Visibility gate not met".
const pay = (key: string, score: number, _ok: boolean): VendorAttributePayload =>
  ({
  vendor_profile_id: 'lab', canonical_service: key, schema_version_at_fill: 3, completeness_score: score,
  updated_at: ago(2), attribute_payload: key === 'bridal_gowns' ? { silhouettes: ['ballgown', 'a_line'], lead_time_weeks: 8, made_to_measure: true, designers: ['Veluz', 'Mak Tumang'] } : {},
  }) as VendorAttributePayload;
const ATTR_ROWS = [
  { schema: GOWNS, payload: pay('bridal_gowns', 62, false) },
  { schema: CATERING, payload: pay('catering', 88, true) },
  { schema: PHOTO, payload: pay('photo_video', 40, false) },
];
const ADDABLE = [
  { key: 'hair_makeup', en: 'Hair & makeup', tl: 'Ayos at makeup' },
  { key: 'lights_sound', en: 'Lights & sound', tl: 'Ilaw at tunog' },
  { key: 'mobile_bar', en: 'Mobile bar', tl: 'Bar' },
  { key: 'venue_styling', en: 'Venue styling', tl: 'Dekorasyon' },
];

const SONGS = [
  { song_id: 1, title: 'Can’t Help Falling in Love', artist: 'Elvis Presley', performance_url: 'https://youtu.be/lab1' },
  { song_id: 2, title: 'Perfect', artist: 'Ed Sheeran', performance_url: 'https://youtu.be/lab2' },
  { song_id: 3, title: 'Ikaw', artist: 'Yeng Constantino', performance_url: null },
  { song_id: 4, title: 'Beautiful in White', artist: 'Shane Filan', performance_url: null },
  { song_id: 5, title: 'Tadhana', artist: 'Up Dharma Down', performance_url: 'https://youtu.be/lab5' },
];
const LIBRARY = [
  { song_id: 11, title: 'A Thousand Years', artist: 'Christina Perri' },
  { song_id: 12, title: 'Kahit Maputi Na ang Buhok Ko', artist: 'Rey Valera' },
  { song_id: 13, title: 'Marry You', artist: 'Bruno Mars' },
];

const REC_GROUPS: LeafGroup[] = [
  {
    tileId: 'photo-video', leafLabel: 'Photo & video', suggestFlagged: false,
    active: [
      { tileId: 'photo-video', serviceCode: 'PAPIC', title: 'Guest photo album (Papic)', priceLabel: 'Price from the catalogue', rationale: 'Every guest’s photos in one album.', isOptIn: true, optInEnabled: true, flaggedNotAFit: false, addonKey: 'papic' },
      { tileId: 'photo-video', serviceCode: 'LIVE', title: 'Live Watch', priceLabel: 'Price from the catalogue', rationale: null, isOptIn: false, optInEnabled: false, flaggedNotAFit: false, addonKey: null },
    ],
    offers: [
      { tileId: 'photo-video', serviceCode: 'SDE', title: 'Same-day edit video', priceLabel: 'Price from the catalogue', rationale: 'Couples who book a same-day edit share your work the same night.', isOptIn: true, optInEnabled: false, flaggedNotAFit: false, addonKey: 'sde' },
    ],
  },
  {
    tileId: 'coordination', leafLabel: 'Coordination', suggestFlagged: true,
    active: [{ tileId: 'coordination', serviceCode: 'AI', title: 'Setnayan AI planner', priceLabel: 'Price from the catalogue', rationale: null, isOptIn: false, optInEnabled: false, flaggedNotAFit: true, addonKey: null }],
    offers: [],
  },
];

const act = (id: string, label: string, min: number, block: string, offered = true, blurb: string | null = null): VendorActivity => ({
  activity_id: id, vendor_profile_id: 'lab', label, blurb, duration_minutes: min, block_type: block, is_offered: offered, display_order: 0,
});
const ACTIVITIES = [
  act('a1', 'Principal sponsors roll call', 15, 'ceremony'),
  act('a2', 'Grand entrance', 5, 'reception'),
  act('a3', 'The shoe game', 10, 'program', true, 'The couple sit back to back and raise a shoe for each question.'),
  act('a4', 'Bouquet and garter toss', 10, 'program'),
];
const RETIRED = [act('a5', 'Money dance', 10, 'program', false), act('a6', 'Candle lighting', 5, 'ceremony', false)];
const QUESTIONS: VendorQuestion[] = [
  { question_id: 'q1', vendor_profile_id: 'lab', prompt: 'Which song should play as you enter the reception?', hint: 'the exact version, if it matters', is_asked: true, display_order: 10 },
  { question_id: 'q2', vendor_profile_id: 'lab', prompt: 'Any guests we must not seat together?', hint: null, is_asked: true, display_order: 20 },
  { question_id: 'q3', vendor_profile_id: 'lab', prompt: 'Who gives the toast?', hint: null, is_asked: true, display_order: 30 },
  { question_id: 'q4', vendor_profile_id: 'lab', prompt: 'Do you want a moment of silence?', hint: null, is_asked: false, display_order: 40 },
];

const line = (id: string, body: string, extra: Partial<LineRow>): LineRow => ({
  line_id: id, activity_id: null, label_key: null, block_type: null, body, is_private_note: false, use_count: 0, last_used_at: null, ...extra,
});
const LINES: LineRow[] = [
  line('l1', 'Ladies and gentlemen, please rise as we welcome, for the very first time as husband and wife, ⟨couple⟩!', { activity_id: 'a2', use_count: 9 }),
  line('l2', 'May we invite ⟨couple⟩ to the floor for their first dance.', { label_key: 'First dance', use_count: 6 }),
  line('l3', 'Dinner is served — enjoy, everyone.', { block_type: 'dinner', use_count: 4 }),
  line('l4', 'Thank you to ⟨venue⟩ for having us tonight.', {}),
  line('l5', 'Check the mic battery before the march.', { is_private_note: true }),
  line('l6', 'Groom’s lola is hard of hearing — face her side.', { is_private_note: true }),
];
const MB_PHOTO = (id: string, label: string, state: 'live' | 'draft' | 'rejected' | 'retired'): StylistAsset =>
  ({
    asset_id: id, asset_type: 'tablescapes', asset_subtype: null, label, storage_path: `lab/${id}.jpg`,
    approved_at: state === 'live' || state === 'retired' ? ago(5) : null, retired_at: state === 'retired' ? ago(1) : null,
    rejected_at: state === 'rejected' ? ago(2) : null, rejection_reason: state === 'rejected' ? 'This photo shows a phone number.' : null,
    created_at: ago(9), source_event_id: null, from_suggestion: false,
    // A sample picture at a real size (a flat gradient, nobody's photo), so the editor's "picture leads" is seen.
    public_url: 'data:image/png;base64,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',
    color_ranges: {},
  }) as unknown as StylistAsset;
const PHOTOS = [MB_PHOTO('p1', 'Garden arch, Tagaytay', 'live'), MB_PHOTO('p2', 'Sweetheart table', 'draft'), MB_PHOTO('p3', 'Reception aisle', 'live'), MB_PHOTO('p4', 'Welcome sign', 'rejected'), MB_PHOTO('p5', 'Centrepiece', 'draft'), MB_PHOTO('p6', 'Cake table', 'retired')];

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

  if (p === 'attributes') {
    screen =
      s === 'fail' ? (
        <AttributesUnread />
      ) : (
        <AttributesView
          rows={s === 'empty' ? [] : ATTR_ROWS}
          fresh={null}
          addable={ADDABLE}
          notices={{ error: null, savedService: s === 'saved' ? 'Bridal gowns' : null, savedKey: s === 'saved' ? 'bridal_gowns' : null, missing: s === 'saved' ? ['Silhouettes', 'Fabric'] : [], removed: false, unknownAdd: null }}
        />
      );
  }
  if (p === 'repertoire') {
    screen =
      s === 'notmusic' ? (
        <RepertoireNotMusic />
      ) : (
        <RepertoireView
          repertoire={SONGS}
          results={s === 'search' ? [] : LIBRARY}
          query={s === 'search' ? 'Sana’y Wala Nang Wakas' : ''}
          own={false}
          notice={{ error: null, saved: false }}
        />
      );
  }
  if (p === 'recommend') {
    screen = (
      <RecommendationsPanel
        groups={s === 'empty' ? [] : REC_GROUPS}
        suggestSkuOptions={[]}
        connectedCouples={[{ eventId: 'lab-e1', label: 'Reyes & Santos wedding' } as never]}
        suggestedKeys={[]}
        savedFlash={false}
        flaggedFlash={false}
        suggestedFlash={false}
        errorFlash={null}
      />
    );
  }
  if (p === 'activities') {
    screen = (
      <ActivitiesView
        offered={s === 'fail' ? [] : ACTIVITIES}
        retired={s === 'fail' ? [] : RETIRED}
        minutes={40}
        measured={s !== 'fail'}
        sp={{}}
        unread={
          <TemplateFail data="activities">
            <strong>We couldn&rsquo;t load your segments.</strong> Your list has not been emptied and couples can still pick
            from it — reload before writing it out again.
          </TemplateFail>
        }
        questions={<QuestionsSectionBody measured all={QUESTIONS} starters={[{ prompt: 'Should the host speak in Tagalog, English or both?', hint: '' }, { prompt: 'Any names that are hard to pronounce?', hint: '' }] as never} />}
      />
    );
  }

  if (p === 'lines') {
    screen = (
      <LinesView
        lines={s === 'empty' || s === 'fail' ? [] : LINES}
        activities={s === 'segfail' ? null : [{ activity_id: 'a2', label: 'Grand entrance' }, { activity_id: 'a3', label: 'The shoe game' }]}
        linesRead={s !== 'fail'}
        error={null}
      />
    );
  }
  if (p === 'moodboard') {
    const photos = s === 'empty' ? [] : PHOTOS;
    screen = (
      <div className="mx-auto w-full tab:max-w-3xl px-4 pb-16 sm:px-6">
        <ToolPin route="/vendor-dashboard/moodboard-library" title="Moodboard library" right={photos.length > 0 ? String(photos.length) : undefined} sub={<span>Your real work, credited, on couples’ mood boards.</span>} />
        <StylistLibraryEditor
          initialAssets={photos}
          gallerySlots={[{ key: 'tablescapes', label: 'Tablescapes' }, { key: 'arches', label: 'Arches' }]}
          startSlot="tablescapes"
          shopPhotos={[]}
          shopPhotosFailed={false}
          backCatalogueCap={5}
          importableEditorial={s === 'empty' ? [] : ([{ mediaId: 'm1', caption: 'Day-of photo', alreadyImported: false }, { mediaId: 'm2', caption: 'Sweetheart table', alreadyImported: true }] as never)}
          importableEditorialFailed={false}
          cardsByPart={null}
        />
      </div>
    );
  }

  return (
    <div className="sn-ambient min-h-dvh pt-2" data-supplier-look="" data-lab-supplier-tools={`${p}:${s}`}>
      <main>{screen}</main>
    </div>
  );
}
