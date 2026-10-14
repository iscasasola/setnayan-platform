/**
 * Your details · Your page · Your collections on fixture data (simpler supplier dashboard step 5) — the REAL screens,
 * the prototype's own three suppliers (`supplier_easy_dashboard_2026-10-14_fable.html`, moments 6 · 7 · 8: the parish,
 * the caterer, the studio). Drawn only by `/dev/supplier-lab` (404 in production).
 *
 *   ?s=details&who=parish|caterer|studio      Your details (the parish: 4 of 6 · left: documents · how clients pay you)
 *   ?s=page&who=…                             Your page   (&draft=1 seeds a waiting change, as if one were made)
 *   ?s=collections&who=…                      Your collections
 *   ?s=avatar                                 the account panel with the supplier's rows (press the avatar)
 *
 * Every editor posts its SHIPPED action; with no session each one refuses — nothing is written from here. The payment
 * surface reads the database itself, so the lab hands the fold a stand-in with the fixture's methods.
 */
import { detailsProgress } from '@/lib/supplier-details';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { pageSavedFrom } from '@/lib/supplier-page-draft';
import { DEFAULT_MICROSITE } from '@/lib/vendor-microsite';
import type { CollectionsInput } from '@/lib/supplier-collections';
import type { VendorPaymentMethodRow } from '@/lib/vendor-payment-methods';
import { DetailsScreen } from '@/app/vendor-dashboard/profile/_components/details-screen';
import type { DetailsData } from '@/app/vendor-dashboard/profile/details-data';
import { BranchPanel } from '@/app/vendor-dashboard/shop/_components/branch-panel';
import { ShopSegments } from '@/app/vendor-dashboard/shop/_components/shop-segments';
import { PageParts, type PageClientData } from '@/app/vendor-dashboard/website/_components/page-parts';
import { pagePlanLines } from '@/app/vendor-dashboard/website/page-data';
import { DomainManager } from '@/app/vendor-dashboard/website/_domain-manager';
import { AutoReplyCard } from '@/app/vendor-dashboard/shop/_components/autoreply-card';
import { CollectionsList } from '@/app/vendor-dashboard/collections/_components/collections-list';
import { GalleryMedia } from '@/app/vendor-dashboard/shop/_components/gallery-media';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { OpenFoldButton } from '@/app/vendor-dashboard/_components/open-fold-button';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { supplierAvatarRows } from '@/app/vendor-dashboard/_components/supplier-avatar-rows';
import { LabSeedDraft } from './lab-seed-draft';

export const PAGE_LAB_STATES = ['details', 'page', 'collections', 'avatar'] as const;
export type PageLabState = (typeof PAGE_LAB_STATES)[number];
type Who = 'parish' | 'caterer' | 'studio';

type Fixture = {
  name: string;
  owner: string;
  services: string[];
  labels: Record<string, string>;
  city: string;
  address: string;
  phone: string;
  email: string;
  since: number;
  verified: boolean;
  docsIn: number;
  status: DetailsData['verify']['status'];
  pay: { label: string; provider: string }[];
  about: string;
  outerKm: number | null;
  tier: string;
  rating: number;
  reviews: number;
  photos: number;
  videos: number;
  collections: CollectionsInput;
};

const FIX: Record<Who, Fixture> = {
  parish: {
    name: 'San Agustin Parish',
    owner: 'Fr. Ramon Cruz',
    services: ['church'],
    labels: { church: 'Church · wedding venue' },
    city: 'Intramuros, Manila',
    address: 'General Luna St, Intramuros, Manila',
    phone: '0917 555 4421',
    email: 'parish@sanagustin.ph',
    since: 1607,
    verified: false,
    docsIn: 1,
    status: 'draft',
    pay: [],
    about: 'A 16th-century church. Weddings Monday to Saturday.',
    outerKm: null,
    tier: 'free',
    rating: 4.9,
    reviews: 12,
    photos: 6,
    videos: 0,
    collections: {
      page: { photos: 6, videos: 0, shown: true },
      cards: { cards: 2, photos: 5, videos: 0 },
      albums: { photos: 0, events: 0 },
      own: { items: 0 },
      delivered: { couples: 0, items: 0 },
      instagram: { configured: true, connected: false, posts: 0, shown: 0 },
      moodboard: { allowed: false, looks: 0, declined: 0 },
    },
  },
  caterer: {
    name: "Tita Nena's Catering",
    owner: 'Nena Bautista',
    services: ['catering'],
    labels: { catering: 'Caterer · buffet' },
    city: 'Tagaytay',
    address: 'Aguinaldo Hwy, Tagaytay',
    phone: '0918 555 2210',
    email: 'nena@gmail.com',
    since: 2014,
    verified: true,
    docsIn: 4,
    status: 'approved',
    pay: [
      { label: 'GCash', provider: 'GCash' },
      { label: 'BDO', provider: 'BDO' },
    ],
    about: 'Home-style Filipino buffet since 2014.',
    outerKm: 60,
    tier: 'solo',
    rating: 4.7,
    reviews: 19,
    photos: 14,
    videos: 1,
    collections: {
      page: { photos: 14, videos: 1, shown: true },
      cards: { cards: 1, photos: 6, videos: 0 },
      albums: { photos: 48, events: 3 },
      own: { items: 24 },
      delivered: { couples: 2, items: 5 },
      instagram: { configured: true, connected: true, posts: 60, shown: 12 },
      moodboard: { allowed: false, looks: 0, declined: 0 },
    },
  },
  studio: {
    name: 'Lumina Studio',
    owner: 'Paolo Reyes',
    services: ['photo_video', 'same_day_edit'],
    labels: { photo_video: 'Photo & video studio', same_day_edit: 'Same-day edit' },
    city: 'Makati',
    address: 'Legazpi Village, Makati',
    phone: '0917 555 8800',
    email: 'hello@lumina.ph',
    since: 2019,
    verified: true,
    docsIn: 4,
    status: 'approved',
    pay: [
      { label: 'BDO', provider: 'BDO' },
      { label: 'GCash', provider: 'GCash' },
    ],
    about: 'Documentary wedding films and stills since 2019.',
    outerKm: 300,
    tier: 'pro',
    rating: 4.8,
    reviews: 31,
    photos: 24,
    videos: 4,
    collections: {
      page: { photos: 24, videos: 4, shown: true },
      cards: { cards: 3, photos: 15, videos: 2 },
      albums: { photos: 312, events: 9 },
      own: { items: 95 },
      delivered: { couples: 9, items: 14 },
      instagram: { configured: true, connected: true, posts: 30, shown: 24, postsAtLeast: true },
      moodboard: { allowed: true, looks: 18, declined: 1 },
    },
  },
};

function detailsFixture(who: Who): DetailsData {
  const f = FIX[who];
  const checklist = [
    { key: 'logo', label: 'Logo', surface: 'profile' as const, ok: true },
    { key: 'business_name', label: 'Shop name', surface: 'profile' as const, ok: true },
    { key: 'business_owner_name', label: 'Owner name', surface: 'profile' as const, ok: true },
    { key: 'maps_pin', label: 'Address', surface: 'profile' as const, ok: true },
    { key: 'contact_phone', label: 'Phone', surface: 'profile' as const, ok: true },
    { key: 'contact_email', label: 'Email', surface: 'profile' as const, ok: true },
    { key: 'in_business_since_year', label: 'In business since', surface: 'profile' as const, ok: true },
    { key: 'services', label: 'Services covered', surface: 'profile' as const, ok: true },
  ];
  const methods = f.pay.map(
    (p, i) =>
      ({
        payment_method_id: `pm-${i}`,
        method_type: 'bank',
        label: p.label,
        provider: p.provider,
      }) as unknown as VendorPaymentMethodRow,
  );
  const verify: DetailsData['verify'] = {
    status: f.status,
    vendorComplete: f.docsIn,
    vendorTotal: 8,
    requiredDocsIn: f.docsIn === 4,
    emailConfirmedAt: f.verified ? '2026-09-01T00:00:00Z' : '2026-10-01T00:00:00Z',
    phoneConfirmedAt: f.verified ? '2026-09-01T00:00:00Z' : null,
    meetScheduledAt: null,
    decisionReason: null,
    submitMissing: f.docsIn === 4 ? [] : ['the 4 required documents'],
    validateEmail: 'verify@setnayan.com',
    validatePhone: null,
  };
  return {
    vendorId: `lab-${who}`,
    businessName: f.name,
    slug: who,
    isVerified: f.verified,
    tier: f.tier,
    checklist,
    profileComplete: true,
    profileFields: {
      business_name: f.name,
      business_owner_name: f.owner,
      hq_address: f.address,
      location_city: f.city,
      hq_latitude: 14.5547,
      hq_longitude: 121.0244,
      contact_phone: f.phone,
      contact_email: f.email,
      in_business_since_year: String(f.since),
      venue_width_m: '',
      venue_length_m: '',
      capacity_min: '',
      capacity_max: '',
      logo_url: null,
      logoDisplayMap: {},
      services: f.services,
      serviceLabels: f.labels,
      extraServiceLeaves: [],
      vendorProfileId: `lab-${who}`,
    },
    businessStartDate: null,
    compatibleVenueSettings: null,
    compatibleCeremonyTypes: null,
    venueType: who === 'parish' ? 'church' : null,
    tagline: null,
    website: null,
    about: f.about,
    sameDayAvailable: false,
    socialFeatureOptOut: false,
    socialAlreadyFeatured: false,
    openCorrections: [],
    pendingCoverageSuggestion: null,
    verify,
    verifyMeasured: true,
    docsIn: f.docsIn,
    docsTotal: 4,
    branch: {
      city: f.city,
      branchLocations: 1,
      tier: f.tier,
      hqLat: 14.5547,
      hqLng: 121.0244,
      reachKm: 50,
      innerRadiusKm: f.outerKm ? 30 : null,
      outerRadiusKm: f.outerKm,
      branches: [],
      branchFeePhp: 0,
      branchAutoRadius: 25,
      branchPay: { accounts: [], open: [] } as unknown as DetailsData['branch']['branchPay'],
    },
    pay: { methods, measured: true },
    logoUnavailable: false,
    progress: detailsProgress({
      checklist,
      docs: { measured: true, isVerified: f.verified, status: f.status, requiredIn: f.docsIn, requiredTotal: 4 },
      payMethods: methods.length,
    }),
  };
}

/** The site's own sample wedding photos (public/realstories) — the lab's portfolio. */
const SAMPLE_PHOTOS = [
  '/realstories/jack-jill-g1.jpg',
  '/realstories/john-jane-g2.jpg',
  '/realstories/maria-juan-g1.jpg',
  '/realstories/sofia-reyes-c1.jpg',
  '/realstories/jack-jill-g3.jpg',
  '/realstories/maria-juan-g3.jpg',
];

function pageFixture(who: Who): PageClientData {
  const f = FIX[who];
  const portfolio = SAMPLE_PHOTOS.map((url, i) => ({ key: `p${i}`, url }));
  const services = f.services.map((key) => ({ key, label: f.labels[key] ?? key }));
  return {
    vendorId: `lab-${who}`,
    businessName: f.name,
    publicPath: `/${who}`,
    displayHost: 'www.setnayan.com',
    live: f.verified,
    visible: true,
    isVerified: f.verified,
    kindWord: services[0]?.label ?? null,
    whereLine: f.outerKm ? `${f.city} · travels up to ${f.outerKm} km` : `${f.city} · couples come to you`,
    yearsLabel: `${2026 - f.since} yrs in business`,
    rating: f.rating,
    reviewCount: f.reviews,
    saved: pageSavedFrom(
      { ...DEFAULT_MICROSITE, about: f.about, featuredServiceIds: f.services.slice(0, 1) },
      f.services,
      portfolio.map((p) => p.key),
    ),
    services,
    portfolio,
    photoCount: f.photos,
    videoCount: f.videos,
    reviews: [
      { id: 'r1', label: 'Reyes · “Beautiful ceremony, very organised.”' },
      { id: 'r2', label: 'Cruz · “They caught moments we never saw.”' },
    ],
    stories: who === 'studio' ? [{ id: 's1', label: 'Ana & Miguel — Tagaytay · Mar 2026' }] : [],
    // The same question the real page asks — false for every plan while the owner's switch is off.
    personalizeAsks: vendorPaywallApplies(f.tier !== 'free'),
    proAsks: vendorPaywallApplies(f.tier === 'pro'),
    storeShell: false,
    plans: pagePlanLines(),
  };
}

export function PageLab({ state, who: rawWho, draft }: { state: PageLabState; who?: string; draft?: boolean }) {
  const who: Who = rawWho === 'caterer' || rawWho === 'studio' ? rawWho : 'parish';
  if (state === 'avatar') {
    return (
      <div className="flex justify-end p-4" data-lab-avatar="">
        <AccountSwitcher
          data={{
            userId: 'lab',
            displayName: 'Paolo Reyes',
            email: 'hello@lumina.ph',
            isAnonymous: false,
            photoUrl: null,
            events: [],
            eventsMeasured: true,
            context: { hasVendor: true, vendorName: FIX[who].name, isAdmin: false, canOpenShop: false },
          }}
          shopRows={supplierAvatarRows()}
        />
      </div>
    );
  }
  if (state === 'details') {
    const d = detailsFixture(who);
    return (
      <DetailsScreen
        d={d}
        branchBody={<BranchPanel {...d.branch} />}
        payBody={
          <p className="text-sm text-ink/60" data-lab-stand-in="pay">
            {d.pay.methods.length ? `${d.pay.methods.length} payment options` : 'No payment options yet'} — the shipped
            payment surface draws here (it reads the database itself, so the lab shows this line instead).
          </p>
        }
      />
    );
  }
  if (state === 'page') {
    const d = pageFixture(who);
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-page="" data-lab-draft={draft ? '' : undefined}>
        <ShopSegments on="page" />
        <h1 className="sr-only">Your page</h1>
        {draft ? <LabSeedDraft vendorId={d.vendorId} /> : null}
        <PageParts
          d={d}
          domainBody={<DomainManager initial={[]} />}
          autoReplyBody={
            <AutoReplyCard
              initialEnabled
              initialDailyCap={30}
              initialAutoAcceptEnabled={false}
              initialAutoAcceptThreshold={80}
              initialDailyAutoAcceptCap={5}
            />
          }
        />
      </section>
    );
  }
  const f = FIX[who];
  const saved = pageSavedFrom(DEFAULT_MICROSITE, f.services, []);
  return (
    <>
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-collections="">
        <ShopSegments on="page" />
        <h1 className="sn-h1">Your collections</h1>
        <CollectionsList
          vendorId={`lab-${who}`}
          input={f.collections}
          saved={saved}
          gallery={
            <GalleryMedia
              vendorProfileId={`lab-${who}`}
              portfolioRefs={[]}
              portfolioDisplayMap={{}}
              portfolioMax={30}
              galleryVideoLinks={[]}
              igConfigured={false}
              igConnection={null}
              igUnavailable={false}
              igMedia={[]}
              igFlash={null}
            />
          }
        />
      </section>
      <SupplierThumbRow name="collections" label="Your collections">
        <OpenFoldButton anchor="gallery-media" label="Add photos" icon="photo" />
      </SupplierThumbRow>
    </>
  );
}
