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
import { PORTFOLIO_FREE_BASE } from '@/lib/vendor-tier-caps';
import { BadgeEarnedLine } from '@/app/vendor-dashboard/_components/badge-earned-line';
import { badgePrintSvg } from '@/lib/shop-badge-print';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { badgeTracker, badgesForPrint, nextToEarnLine, shopBadges, trackerSummary, type ShopBadgeFacts, type TrackerFacts } from '@/lib/shop-badges';

export const PAGE_LAB_STATES = ['details', 'page', 'collections', 'avatar', 'badge-today', 'badge-tiers'] as const;
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
    requiredIn: Math.min(f.docsIn, 4),
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
    fieldsLeft: 0,
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

/**
 * 🎁 A shop fresh from Setnayan's personal invite (prototype `supplier_personal_invite_2026-10-23` frame B4): the
 * admin staged the name, the category and the email; nothing else is in yet. `?s=details&invited=1`.
 */
/**
 * 🧰 A NEW SHOP, for Today's six steps (`?easy=setup`, owner 2026-10-28): fresh from the invite (B4) — name and email
 * in, the rest to do; `docs` sets how its papers stand (none · checking · fix, with the admin's reason).
 */
export function labSetupDetails(docs: 'none' | 'checking' | 'fix' = 'none', stage: 'fresh' | 'details' = 'fresh'): DetailsData {
  const d = invitedDetailsFixture();
  const checklist = stage === 'details' ? d.checklist.map((i) => ({ ...i, ok: true })) : d.checklist;
  const status = docs === 'checking' ? 'pending_review' : docs === 'fix' ? 'rejected' : null;
  return {
    ...d,
    checklist,
    profileComplete: stage === 'details',
    fieldsLeft: checklist.filter((i) => !i.ok && i.key !== 'logo').length,
    docsIn: docs === 'none' ? 0 : docs === 'fix' ? 3 : 4,
    verify: {
      ...d.verify,
      status,
      requiredIn: docs === 'none' ? 0 : docs === 'fix' ? 3 : 4,
      requiredDocsIn: docs === 'checking',
      decisionReason: docs === 'fix' ? 'The BIR 2303 photo is cut off at the bottom — upload the whole page.' : null,
    } as DetailsData['verify'],
  };
}

function invitedDetailsFixture(): DetailsData {
  const base = detailsFixture('caterer');
  const has = new Set(['business_name', 'contact_email', 'services']);
  const checklist = base.checklist.map((i) => ({ ...i, ok: has.has(i.key) }));
  return {
    ...base,
    vendorId: 'lab-invited',
    businessName: 'Tita Nena’s Catering',
    isVerified: false,
    tier: 'pro',
    checklist,
    profileComplete: false,
    fieldsLeft: checklist.filter((i) => !i.ok && i.key !== 'logo').length,
    profileFields: {
      ...base.profileFields,
      business_name: 'Tita Nena’s Catering',
      business_owner_name: '',
      hq_address: '',
      location_city: '',
      contact_phone: '',
      contact_email: 'nena@gmail.com',
      in_business_since_year: '',
      services: ['catering'],
      serviceLabels: { catering: 'Catering' },
      vendorProfileId: 'lab-invited',
    },
    about: null,
    docsIn: 0,
    pay: { methods: [], measured: true },
    verify: { ...base.verify, status: null, vendorComplete: 0, requiredIn: 0, requiredDocsIn: false } as DetailsData['verify'],
    progress: detailsProgress({
      checklist,
      docs: { measured: true, isVerified: false, status: null, requiredIn: 0, requiredTotal: 4 },
      payMethods: 0,
    }),
    fromInvite: true,
    hasLogo: false,
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

/** 🏅 The badges' lab facts — the caterer sits at 96 of 100 (the prototype's frame), the studio has just reached 50,
 *  the parish is not verified yet and has no completed events. */
const LAB_BADGE_EVENTS: Record<Who, { events: number; unreviewed: number; awards: string[] }> = {
  parish: { events: 0, unreviewed: 0, awards: [] },
  caterer: { events: 96, unreviewed: 3, awards: [] },
  studio: { events: 50, unreviewed: 2, awards: ["Setnayan's Top Pick"] },
};
/* 🏅 The facts the earned line reads, per lab case: Verified alone (the owner’s live shot) · a 50-event milestone. */
const EARNED_FACTS: Record<string, ShopBadgeFacts> = {
  verified: { verified: true, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 },
  milestone: { verified: true, completedEvents: 50, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 },
};

/** The earned line exactly as Today mounts it (above the screen), its facts and print file handed in as data: URIs —
 *  `?s=clear&earned=verified|milestone` (page.tsx's Today states). Lives here, beside `badge-today`, so the lab's one
 *  print-file draw stays in one file (lib/every-logo-plays.test.ts's STILL entry for this file). */
export function LabEarnedLine({ which }: { which: string }) {
  const facts = EARNED_FACTS[which];
  if (!facts) return null;
  const files = Object.fromEntries(
    badgesForPrint(facts).map((b) => [b.key, `data:image/svg+xml;base64,${Buffer.from(badgePrintSvg([b])).toString('base64')}`]),
  );
  return (
    <BadgeEarnedLine
      factsUrl={`data:application/json,${encodeURIComponent(JSON.stringify({ vendorId: `lab-earned-${which}`, facts }))}`}
      labFiles={files}
    />
  );
}

export function labBadgeFacts(who: Who): TrackerFacts {
  const f = FIX[who];
  const b = LAB_BADGE_EVENTS[who];
  return {
    verified: f.verified,
    completedEvents: b.events,
    trusted: { trusted_avg_rating: f.rating, trusted_review_count: f.reviews },
    inBusinessSinceYear: f.since,
    awards: b.awards,
    nowYear: 2026,
    unreviewed: b.unreviewed,
  };
}

function pageFixture(who: Who): PageClientData {
  const f = FIX[who];
  const bf = labBadgeFacts(who);
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
    badges: { summary: trackerSummary(bf), pills: shopBadges(bf), next: nextToEarnLine(bf.completedEvents), rows: badgeTracker(bf), saveHref: `data:image/svg+xml;base64,${Buffer.from(badgePrintSvg(badgesForPrint(bf))).toString('base64')}` },
  };
}

/**
 * 💳 `&port=48|50|spend|short|unread` on collections — the portfolio priced by the free room, then the shop wallet
 * (frames port-48 · port-50 · port-spend · F3 · F1). Fake refs with flat tile images; nothing is stored.
 */
function labPortfolio(who: string, port: string | undefined) {
  // One flat 1×1 PNG stands in for every photo (a still raster — never an SVG, which would read as a logo draw).
  const tile = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4dm4fAATgAmPxoKUWAAAAAElFTkSuQmCC';
  const ref = (k: string) => `r2://setnayan-media/vendors/lab-${who}/portfolio/${k}.jpg`;
  const count = port === '48' || port === 'unread' ? 48 : port ? 50 : 0;
  const refs = Array.from({ length: count }, (_, i) => ref(`p${i}`));
  const picked = port === 'spend' || port === 'short' ? ['n1', 'n2', 'n3'].map(ref) : undefined;
  const displayMap = Object.fromEntries([...refs, ...(picked ?? [])].map((r) => [r, tile]));
  const walletBalance = port === 'unread' ? null : port === 'short' ? 1 : 128;
  return { refs, picked, displayMap, walletBalance };
}

export function PageLab({ state, who: rawWho, draft, invited = false, port }: { state: PageLabState; who?: string; draft?: boolean; /** 🎁 `&invited=1` on details — fresh from a personal invite (B4). */ invited?: boolean; port?: string }) {
  const who: Who = rawWho === 'caterer' || rawWho === 'studio' ? rawWho : 'parish';
  if (state === 'badge-tiers') {
    /* 🏅 Every step's pill (the material climbs) on a light and a dark ground, and the Verified pill on the four
       grounds of the approved prototype — the side-by-side sheet for pill.png and tiers.png. */
    const step = (n: number) => shopBadges({ verified: false, completedEvents: n, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 })[0]!;
    const verified = shopBadges({ verified: true, completedEvents: null, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 })[0]!;
    return (
      <div className="min-h-screen space-y-6 bg-cream p-4 text-ink" data-lab-badge-tiers="">
        <div className="flex flex-wrap items-center gap-3" data-lab-grounds="">
          {(['light', 'dark', 'colour', 'white'] as const).map((g) => (
            <div key={g} className="rounded-2xl p-4" style={{ background: g === 'dark' ? '#151312' : g === 'colour' ? '#1f3a2c' : g === 'white' ? '#fff' : '#F7F2E8' }}>
              <ShopBadgePill badge={verified} ground={g} size="md" />
            </div>
          ))}
        </div>
        {(['light', 'dark'] as const).map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-x-3 gap-y-6 rounded-2xl p-4 pt-6" style={{ background: g === 'dark' ? '#151312' : '#F7F2E8' }} data-lab-tiers={g}>
            {MILESTONE_THRESHOLDS.map((n) => (
              <ShopBadgePill key={n} badge={step(n)} ground={g} size="sm" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (state === 'badge-today') {
    /* 🏅 The Today line (`badge-earned-line.tsx`) on lab facts: its facts and its print file are handed in as data:
       URIs, so nothing leaves the machine and Save to print saves the REAL outlined file for this lab shop. */
    const bf = labBadgeFacts(who);
    const files = Object.fromEntries(
      badgesForPrint(bf).map((b) => [b.key, `data:image/svg+xml;base64,${Buffer.from(badgePrintSvg([b])).toString('base64')}`]),
    );
    return (
      <div className="min-h-screen bg-cream px-4 pt-4 text-ink" data-lab-badge-today="">
        <BadgeEarnedLine
          factsUrl={`data:application/json,${encodeURIComponent(JSON.stringify({ vendorId: `lab-${who}`, facts: bf }))}`}
          labFiles={files}
        />
        <p className="text-[13px] text-ink/60">Today&rsquo;s rows continue below.</p>
      </div>
    );
  }
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
            context: { hasVendor: true, vendorName: FIX[who].name, isAdmin: false, canOpenShop: false, shops: [] },
          }}
          shopRows={supplierAvatarRows()}
        />
      </div>
    );
  }
  if (state === 'details') {
    const d = invited ? invitedDetailsFixture() : detailsFixture(who);
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
              initialAutoAcceptEnabled={false}
              initialAutoAcceptThreshold={80}
            />
          }
        />
      </section>
    );
  }
  const f = FIX[who];
  const saved = pageSavedFrom(DEFAULT_MICROSITE, f.services, []);
  const lp = labPortfolio(who, port);
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
              portfolioRefs={lp.refs}
              portfolioDisplayMap={lp.displayMap}
              portfolioMax={PORTFOLIO_FREE_BASE}
              walletBalance={lp.walletBalance}
              labPicked={lp.picked}
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
