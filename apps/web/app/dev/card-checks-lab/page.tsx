/**
 * /dev/card-checks-lab — SERVICE CARD CHECKS on fixture data: no sign-in, no database. DEV-ONLY: production builds
 * 404 this route (`the-lab-never-ships.test.ts`), the production check first.
 *
 * It draws the REAL components the approved prototype (corpus `prototypes/service_card_checks_2026-10-26/`) asks
 * for, over the prototype's own sample rows, so the side-by-side compares the built thing — not a copy:
 *
 *   ?v=supplier-before   the after-Create moment as it ships today: the sage box + the card row's "· hidden"
 *   ?v=supplier          Delta 1 + 2: the gold "Saved · waiting for a quick check" box (HeldCardBox) + the row word
 *   ?v=queue             Integrity watch › Cards (CardsQueue + ClaimWordsFold), inside the shipped page chrome
 *   ?v=queue-before      the shipped Integrity watch chrome without the Cards tab
 *   ?v=open              a card opened (CardOpen) — evidence + verdicts
 *   (Delta 3 — the maker helper — is drawn by the real maker: /dev/card-maker-lab?type=caterer&s=edit&held=1)
 *
 * Names are the prototype's samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { LayoutGrid, Star, Store, Users, Coins } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { PillLink, PillTrack } from '@/app/_components/pill-track';
import { HeldCardBox } from '@/app/vendor-dashboard/services/_components/held-card-box';
import { CardOpen, CardsQueue, ClaimWordsFold } from '@/app/admin/integrity-watch/_cards/cards-tab';
import type { CardOpenView, CardQueueRow } from '@/app/admin/integrity-watch/_cards/cards-types';
import { buildServiceCardCongrats } from '@/lib/service-card-congrats';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';
import type { CardReason } from '@/lib/service-card-checks';

const NOW = new Date('2026-10-26T09:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const ALL_FOUR: CardReason[] = [
  { code: 'photo', matches: [{ imageFlagPublicId: 'S89N-3F8KQ2M7X4', hamming: 4, which: 'cover' }] },
  { code: 'price', pricePhp: 149, basis: 'per_pax', lowPhp: 350, medianPhp: 620, highPhp: 1200, sampleN: 23, region: 'ncr', bucket: '__all__', tolerance: 0.3 },
  { code: 'service', filed: 'barong_tagalog', filedLabel: 'Barong Tagalog', matched: 'catering', matchedLabel: 'Catering', words: ['catering', 'buffet'], ownWords: ['barong', 'tagalog', 'embroidery', 'piña'] },
  { code: 'words', hits: ['guaranteed', '#1'] },
];

const ROWS: CardQueueRow[] = [
  { flagId: 1, publicId: 'S89Y-Q2M7N4K9RT', status: 'open', title: 'Guaranteed #1 Wedding Catering', priceLine: 'from ₱149 · per guest · 2 photos', coverUrl: null, shopName: 'Casa Dulce Events', shopLine: 'Verified · 3 cards', shopVerified: true, filedLabel: 'Barong Tagalog', readsLike: 'Catering', reasons: ALL_FOUR, afterReject: false, age: hoursAgo(2), overSla: false },
  { flagId: 2, publicId: 'S89Y-H7C2P9W4LD', status: 'open', title: 'Garden Venue — Whole Day', priceLine: 'from ₱3,000 · flat · 5 photos', coverUrl: null, shopName: 'Hacienda San Isidro Gardens & Events Place of Silang, Cavite', shopLine: 'Pending review · 1 card', shopVerified: false, filedLabel: 'Venue · Garden', readsLike: null, reasons: [{ code: 'price', pricePhp: 3000, basis: 'fixed', lowPhp: 60000, medianPhp: 90000, highPhp: 150000, sampleN: 11, region: 'calabarzon', bucket: '__all__', tolerance: 0.3 }], afterReject: false, age: hoursAgo(9), overSla: false },
  { flagId: 3, publicId: 'S89Y-B4N8T2K6QZ', status: 'open', title: 'Best in Tagaytay Bridal Hair & Makeup · Airbrush · Lashes · Trial Included for Bride and Mother', priceLine: 'from ₱8,500 · flat · 4 photos', coverUrl: null, shopName: 'Glow by Marianne Dela Cruz-Villanueva', shopLine: 'Verified · 6 cards', shopVerified: true, filedLabel: 'Hair & Makeup', readsLike: null, reasons: [{ code: 'words', hits: ['best in'] }], afterReject: false, age: hoursAgo(26), overSla: false },
  { flagId: 4, publicId: 'S89Y-L5F3R8M2VX', status: 'open', title: 'Official Same-Day Edit Video', priceLine: 'from ₱25,000 · flat · 1 photo', coverUrl: null, shopName: 'Lumen Films', shopLine: 'Verified · 2 cards', shopVerified: true, filedLabel: 'Same-Day Edit', readsLike: null, reasons: [{ code: 'words', hits: ['official'] }], afterReject: false, age: hoursAgo(75), overSla: true },
];

const WORDS = [
  { phrase: 'guaranteed', note: 'a promise we can’t stand behind' },
  { phrase: '#1', note: 'a ranking nobody measured' },
  { phrase: 'best in', note: 'a ranking nobody measured' },
  { phrase: 'lowest price', note: 'a comparison' },
  { phrase: 'official', note: 'implies an appointment' },
  { phrase: '100%', note: 'a promise we can’t stand behind' },
];

function openFixture(): CardOpenView {
  const row = {
    vendor_service_id: '00000000-0000-4000-8000-00000000c0a1',
    public_id: 'S89S-7K3M2PQ8XZ',
    vendor_profile_id: '00000000-0000-4000-8000-0000000000cd',
    category: 'barong_tagalog',
    title: 'Guaranteed #1 Wedding Catering',
    starting_price_php: 149,
    pricing_basis: 'per_pax',
    per_pax_price_php: 149,
    min_pax: 1,
    is_active: false,
  } as unknown as VendorServiceRow;
  const card = toServiceCard(
    row,
    [
      { vendor_service_id: row.vendor_service_id, label: 'Buffet for 100', worth_php: null, sort_order: 0 },
      { vendor_service_id: row.vendor_service_id, label: 'Tables & linens', worth_php: null, sort_order: 1 },
      { vendor_service_id: row.vendor_service_id, label: 'Service crew', worth_php: null, sort_order: 2 },
    ],
    [],
    undefined,
    { photos: [], videoUrl: null },
    false,
    null,
    NOW,
    null,
    null,
    false,
    null,
  );
  return {
    flagId: 1,
    publicId: 'S89Y-Q2M7N4K9RT',
    serviceId: row.vendor_service_id,
    vendorProfileId: row.vendor_profile_id,
    status: 'open',
    flaggedAt: hoursAgo(2),
    afterReject: false,
    resolutionNotes: null,
    card,
    title: 'Guaranteed #1 Wedding Catering',
    shopName: 'Casa Dulce Events',
    shopState: 'Verified',
    shopVerified: true,
    shopLine: '3 cards, 2 live · joined Aug 2026 · 0 bookings',
    filedLabel: 'Barong Tagalog',
    shopCovers: 'Barong Tagalog, Catering',
    reasons: ALL_FOUR,
    pairs: [
      {
        imageFlagPublicId: 'S89N-3F8KQ2M7X4',
        hamming: 4,
        stillOpen: true,
        thisUrl: null,
        thisCaption: 'Casa Dulce Events · Service cover',
        sourceUrl: null,
        sourceCaption: 'Mesa Luna Catering · Portfolio',
      },
    ],
    bandRegionLabel: 'Metro Manila',
  };
}

function Chrome({ withCards, children }: { withCards: boolean; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8" data-lab="card-checks-admin">
      <PageMasthead title="Integrity watch" className="mb-2" />
      <div className="mb-6">
        <p className="text-sm text-ink/70">
          {withCards ? (
            <>
              Deterministic integrity screening. <span className="font-medium">Cards</span> holds service cards the
              automatic check kept out of Explore — a photo seen on another shop, a price far outside the service’s band,
              a card filed under the wrong service, or a claim word. Detect-and-review only: a card goes live on your
              Approve, and the supplier can fix and resave at any time; a resave that passes goes live by itself and
              leaves this list.
            </>
          ) : (
            <>
              Deterministic integrity screening. <span className="font-medium">Reviews</span> scores every submitted
              review on velocity/burst, rating anomaly, and shared-device reviewer clusters;{' '}
              <span className="font-medium">Listings</span> flags placeholder / abandoned / duplicate marketplace
              listings; <span className="font-medium">Inquiries</span> flags a linked identity-cluster spraying one
              supplier with fake inquiries (the supplier is the victim — never penalized).
            </>
          )}
        </p>
      </div>
      <PillTrack className="mb-4">
        <PillLink on={false} href="/dev/card-checks-lab?v=queue-before" className="gap-1.5 px-3"><Star aria-hidden className="hidden h-3.5 w-3.5 sm:inline-block" strokeWidth={2} /> Reviews</PillLink>
        <PillLink on={false} href="/dev/card-checks-lab?v=queue-before" className="gap-1.5 px-3"><Store aria-hidden className="hidden h-3.5 w-3.5 sm:inline-block" strokeWidth={2} /> Listings</PillLink>
        <PillLink on={!withCards} href="/dev/card-checks-lab?v=queue-before" aria-current={!withCards ? 'page' : undefined} className="gap-1.5 px-3"><Users aria-hidden className="hidden h-3.5 w-3.5 sm:inline-block" strokeWidth={2} /> Inquiries</PillLink>
        <PillLink on={false} href="/dev/card-checks-lab?v=queue-before" className="gap-1.5 px-3"><Coins aria-hidden className="hidden h-3.5 w-3.5 sm:inline-block" strokeWidth={2} /> Prices</PillLink>
        {withCards ? (
          <PillLink on href="/dev/card-checks-lab?v=queue" aria-current="page" className="gap-1.5 px-3"><LayoutGrid aria-hidden className="hidden h-3.5 w-3.5 sm:inline-block" strokeWidth={2} /> Cards · 4</PillLink>
        ) : null}
      </PillTrack>
      {children}
    </div>
  );
}

export default async function CardChecksLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const v = typeof sp.v === 'string' ? sp.v : 'supplier';

  if (v === 'queue' || v === 'queue-before') {
    return (
      <Chrome withCards={v === 'queue'}>
        {v === 'queue' ? (
          <>
            <CardsQueue rows={ROWS} openCount={4} status="open" reason="any" now={NOW} basePath="/dev/card-checks-lab" />
            <ClaimWordsFold words={WORDS} open={sp.words === '1'} />
          </>
        ) : null}
      </Chrome>
    );
  }
  if (v === 'open') {
    return (
      <Chrome withCards>
        <CardOpen view={openFixture()} now={NOW} basePath="/dev/card-checks-lab" />
      </Chrome>
    );
  }

  // The supplier's after-Create moment, on the shop page.
  const before = v === 'supplier-before';
  const congrats = buildServiceCardCongrats({ activeCount: 1, isDraft: false });
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-8 pt-4 sm:px-6" data-lab="card-checks-supplier">
      {before ? (
        <div role="status" className="space-y-1.5 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'var(--m-sage)', background: 'var(--m-sage)', color: 'var(--m-ink)' }}>
          <p className="font-semibold">{congrats.headline}</p>
          {congrats.care.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="font-medium">{congrats.count}</p>
        </div>
      ) : (
        <HeldCardBox
          serviceId="00000000-0000-4000-8000-00000000c0a1"
          reasons={[ALL_FOUR[0]!, ALL_FOUR[1]!, ALL_FOUR[3]!]}
          serviceLabel="Catering"
          afterReject={false}
          adminNote={null}
        />
      )}
      <p className="truncate text-xs" style={{ color: 'var(--m-slate-2)' }}>
        +₱450/guest · assigned to Main · Catering
        {before ? (
          ' · hidden'
        ) : (
          <b className="font-semibold" style={{ color: 'var(--m-orange-deep)' }}>{' · waiting for a check'}</b>
        )}
      </p>
    </div>
  );
}
