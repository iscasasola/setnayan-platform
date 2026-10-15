import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  Globe,
  Handshake,
  Heart,
  Images,
  Package as PackageIcon,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { isMusicToolCategory } from '@/lib/songs';
import { shopToolShelves } from './shop-tool-shelves';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile, businessProfileChecklist } from '@/lib/vendor-profile';
import { fetchLatestApplication, requiredDocsComplete, type DocUploadMap } from '@/lib/vendor-verification';
import { fetchReviewStats, type ReviewStatsRow } from '@/lib/reviews';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { loadVendorRecaps } from '@/lib/recap-vendor';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { CopyButton } from '@/app/_components/copy-button';
import { VendorAvatar, deriveVendorInitials as deriveInitials } from '@/app/_components/vendor-avatar';

import {
  VendorServicesManager,
  type ServicesManagerSearch,
} from '@/app/vendor-dashboard/services/_components/services-manager';

import { ShopRail, ShopDoorSection } from './_components/shop-rail';
import { ShopSegments } from './_components/shop-segments';
import { CouldNotLoad } from './_components/could-not-load';
import { SoftReadLog } from '@/lib/soft-read';
import { ServicesDisclosure } from './_components/services-disclosure';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { DatesRow } from '../customers/_components/dates-row';

/** Your details, and its papers fold — where every "finish your profile" / "get verified" link on this page goes. */
const DETAILS_HREF = '/vendor-dashboard/profile';
const DOCS_HREF = '/vendor-dashboard/profile#docs';

/**
 * /vendor-dashboard/shop — "My Shop".
 *
 * The storefront home of the vendor doorway. Reworked 2026-07 (owner):
 * everything acts INLINE. Profile / Website / Team / Branch each expand their
 * function in place (ManageTiles + Collapsible) — Profile joined the inline
 * set 2026-07-02 (was the lone navigate-out tile); the QR row card toggles
 * Shortlist ↔ Locked, both rendering a real QR; the metrics strip is a
 * read-only pulse (its detail pages live in the sidebar).
 *
 * DATA — every number is LIVE (owner rule: never fabricate). The whole loader
 * is wrapped so a single query error degrades to zeros rather than crashing.
 */

export const metadata = { title: 'Shop' };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DISPLAY_HOST = SITE_URL.replace(/^https?:\/\//, '');

const nf = new Intl.NumberFormat('en-PH');

/** Start of the current ISO-ish week (Mon 00:00 local), as an ISO string. */
function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type ShopData = {
  businessName: string;
  initials: string;
  /** Presigned display URL of the uploaded logo (Hero avatar), or null → initials. */
  logoUrl: string | null;
  slug: string | null;
  city: string | null;
  primaryService: string | null;
  tier: string | null;
  isVerified: boolean;
  websiteLive: boolean;
  /* Set when the read FAILED, as opposed to legitimately returning nothing —
     the hero says "could not load your logo" instead of showing initials as if
     the shop had none. */
  logoUnavailable: boolean;
  completionPct: number;
  /** Fields of the business profile still empty (the hero's "Finish profile"). */
  fieldsLeft: number;
  verify: {
    status: VerifyStatus;
    requiredDocsIn: boolean;
    emailConfirmedAt: string | null;
    phoneConfirmedAt: string | null;
  };
  profileViewsWeek: number;
  rating: number;
  reviewCount: number;
  savedByCouples: number;
  storiesTagged: number;
  /*
   * Labels of the optional reads that FAILED on this render (see lib/soft-read).
   * A tile consults this before printing a number, because 0 and "could not be
   * read" are different claims and only one of them is about the supplier.
   */
  unreadable: string[];
  recapClips: number;
  recommendedByShops: number;
};

type VerifyStatus = 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'withdrawn' | null;

async function loadShopData(): Promise<ShopData | 'no-vendor'> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // Signed in but no shop (owned OR via team) — send them to the one-button
  // "Open your shop" gate instead of a dead fallback (owner gap-fix
  // 2026-07-03). Distinct from the error path: the caller's catch keeps the
  // degraded fallback for genuine load failures.
  if (!profile) return 'no-vendor';

  const vendorId = profile.vendor_profile_id;
  const businessName = profile.business_name ?? 'Your shop';

  // ─── EVERY READ BELOW STARTS AT ONCE ─────────────────────────────────────
  // 🔑 THE GATE ABOVE RUNS FIRST — who is signed in, and which shop is theirs
  // (`fetchOwnVendorProfile`, owned OR via team). Every read below is scoped to
  // THAT `vendorId`, and none of them needs another one's answer except where it
  // says so, and there it waits for THAT read only. They used to run one after
  // another — about twenty trips to the database, each waiting for the last —
  // and My Shop took 1.7 s to load (measured on prod, 2026-09-29). Each block is
  // STARTED here, as a promise, with its own graceful-degrade exactly as it was,
  // and they are all awaited together in the one `Promise.all` below.
  //   · stories + recaps wait for the pool bookings (they need its eventIds).
  // ⚠ ADD A NEW READ AS ANOTHER STARTED PROMISE, NOT AS ANOTHER `await` IN THIS
  // RUN — one stray `await` puts a full database trip back in front of the page.
  //
  // ✂ STEP 5 (2026-10-14) — SIXTEEN READS LEFT THIS PAGE. Door 1's panels moved to
  // their own screens: Your details (`profile/details-data.ts` — the profile
  // fields, the papers, the switches, the travel distances, the branches, the
  // corrections, the coverage suggestion, the payment methods), Your page
  // (`website/page-data.ts` — the microsite, the review picker, the stories) and
  // Your collections (`collections/collections-data.ts` — the portfolio, Instagram).
  // The team panel was a second copy of /vendor-dashboard/team. Each of those reads
  // now runs only on the screen that draws it; My Shop keeps the hero and the
  // numbers.

  // Tier — not in the shared profile select; soft-probe it.
  const tierRead = (async () => {
    let tier: string | null = null;
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('tier_state')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      // ⚠ THEIR PLAN. Refused, the shop reads as having no tier. The soft
      // ⚠ fallback stays; the reason reaches the logs.
      if (error) {
        logQueryError('VendorShopPage.tierState', error, { vendorId }, 'graceful_degrade');
      }
      tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
    } catch {
      tier = null;
    }
    return tier;
  })();

  const weekStart = startOfWeekIso();

  /*
   * 🔑 EVERY OPTIONAL READ BELOW USED TO FAIL INTO A ZERO, AND A ZERO ON A
   * PERFORMANCE TILE IS A CLAIM.
   *
   * "Saved by couples: 0", "rating 0", "views this week: 0" are not blanks.
   * They assert that nobody saved this shop, nobody rated it and nobody looked
   * at it — and the supplier cannot tell that apart from the truth. An error
   * says the system failed; a zero says THEY failed. That is the worse of the
   * two to be wrong about.
   *
   * ⚠ `soft.count` / `soft.rpcNumber` exist because a supabase builder does
   * NOT reject: it RESOLVES with `{ count: null, error }`. The old
   * `.then(r => r.count ?? 0, () => 0)` had a rejection arm that almost never
   * ran, and the real failure arrived through the SUCCESS path as a null that
   * `?? 0` turned into a confident zero.
   */
  const soft = new SoftReadLog('VendorShopPage');

  // Latest verification application — the Hero's "Get verified · N of 2" pill.
  // The contact stamps ride on the row itself (`fetchLatestApplication` merges
  // them), so there is no second read for them.
  const verifyAppRead = soft.read(
    'latestApplication',
    () => fetchLatestApplication(supabase, vendorId),
    null,
  );
  /*
   * 🔑 `null`, NOT A ZEROED ROW — the Reviews tile consults `cantRead('reviewStats')`.
   */
  const reviewStatsRead = soft.read<ReviewStatsRow | null>(
    'reviewStats',
    () => fetchReviewStats(supabase, vendorId),
    null,
  );
  const savesRead = soft.rpcNumber('savedByCouples', () =>
    supabase.rpc('count_saves_for_vendor', { p_vendor_profile_id: vendorId }),
  );
  const viewsRead = soft.count('profileViewsWeek', () =>
    supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('viewed_at', weekStart),
  );
  // LEFT ON THE POOL READ: a public claim (a story tagged to this shop) needs
  // the pool row, not the handshake.
  const bookingsRead = soft.read(
    'poolBookings',
    () => fetchVendorPoolBookings(supabase, vendorId),
    [],
  );
  const partnershipsRead = soft.count('partnerships', () =>
    supabase
      .from('vendor_partnerships')
      .select('id', { count: 'exact', head: true })
      .eq('recommended_vendor_id', vendorId)
      .eq('status', 'accepted')
      .eq('is_active', true),
  );

  // Stories + recaps need the pool bookings' eventIds — they wait for that read
  // alone, and run beside each other once it lands.
  const storiesAndRecapsRead = (async () => {
    const bookings = await bookingsRead;
    const eventIds = bookings.map((b) => b.eventId);
    return Promise.all([
      soft.read('featuredStories', () => loadVendorFeaturedStories(eventIds), []),
      soft.read('recaps', () => loadVendorRecaps(eventIds).then((r) => r.length), 0),
    ]);
  })();

  // The hero's logo. A presign hiccup must not blank the page — and must not
  // look like a shop with no logo either (`logoUnavailable`).
  const logoRead = (async () => {
    try {
      const url = profile.logo_url ? await displayUrlForStoredAsset(profile.logo_url) : null;
      return { logoUrl: url, logoUnavailable: false };
    } catch (err) {
      logQueryError('VendorShopPage.logoDisplayUrl', err, { vendorId, hasLogo: !!profile.logo_url });
      return { logoUrl: null, logoUnavailable: !!profile.logo_url };
    }
  })();

  // ─── THE ONE WAIT ────────────────────────────────────────────────────────
  const [
    tier,
    verifyApp,
    reviewStats,
    savesRes,
    viewsRes,
    partnershipsRes,
    [stories, recapCount],
    { logoUrl, logoUnavailable },
  ] = await Promise.all([
    tierRead,
    verifyAppRead,
    reviewStatsRead,
    savesRead,
    viewsRead,
    partnershipsRead,
    storiesAndRecapsRead,
    logoRead,
  ]);

  const completion = businessProfileChecklist(profile);
  const completionPct =
    completion.total === 0 ? 0 : Math.round((completion.done / completion.total) * 100);
  const verifyUploads = (verifyApp?.doc_uploads ?? {}) as DocUploadMap;

  return {
    businessName,
    initials: deriveInitials(businessName),
    logoUrl,
    slug: profile.business_slug ?? null,
    city: profile.location_city ?? null,
    primaryService: profile.services?.[0] ? titleCase(profile.services[0]) : null,
    tier,
    isVerified: profile.public_visibility === 'verified',
    websiteLive: Boolean(profile.business_slug) && isPubliclyVisible(profile.public_visibility),
    logoUnavailable,
    completionPct,
    fieldsLeft: completion.items.filter((i) => !i.ok).length,
    verify: {
      status: (verifyApp?.status as VerifyStatus) ?? null,
      requiredDocsIn: requiredDocsComplete(verifyUploads),
      emailConfirmedAt: verifyApp?.contact_email_confirmed_at ?? null,
      phoneConfirmedAt: verifyApp?.contact_phone_confirmed_at ?? null,
    },
    profileViewsWeek: viewsRes ?? 0,
    rating: Number(reviewStats?.avg_rating_overall ?? 0) || 0,
    reviewCount: Number(reviewStats?.total_count ?? 0) || 0,
    savedByCouples: savesRes ?? 0,
    storiesTagged: stories.length,
    unreadable: soft.labels,
    recapClips: recapCount,
    recommendedByShops: partnershipsRes ?? 0,
  };
}

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  solo: 'Solo',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function tierLabel(tier: string | null): string {
  if (!tier) return 'Free';
  return TIER_LABEL[tier] ?? titleCase(tier);
}


async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<
    ServicesManagerSearch
  >;
}) {
  let data: ShopData | 'no-vendor' | null;
  try {
    data = await loadShopData();
  } catch (err) {
    // Re-throw Next's control-flow errors (redirect/notFound) so the /login
    // redirect inside the loader still navigates.
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/shop] loader failed', err);
    data = null;
  }

  // Signed in without a shop → the one-button "Open your shop" gate.
  if (data === 'no-vendor') redirect('/open-shop');

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Shop</h1>
          <p className="max-w-prose text-base text-ink/65">
            Everything that defines your shop and your reach.
          </p>
        </header>
        <div>
          <p className="text-sm text-ink/70">
            Set up your business profile first — once it&rsquo;s created, your
            storefront, reach, and reputation all live here.
          </p>
          <Link
            href="/open-shop"
            className="button-primary mt-4 inline-flex items-center gap-2"
          >
            Set up my shop
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    );
  }

  // Canonical vendor URL is the bare-root alias (www.setnayan.com/{slug}); the
  // /v/{slug} route still resolves but the editor surfaces the clean address.
  /*
   * Did the number behind this tile actually get read?
   *
   * 🪤 TAKES THE UPSTREAM LABELS TOO, AND THAT IS THE POINT. `featuredStories`
   * and `recaps` consume the ids that `poolBookings` produced. When that read
   * fails it degrades to `[]`, so both of those then SUCCEED and correctly
   * return nothing — their own probes are honest, and their tiles would print a
   * truthful-looking 0 caused by a failure two steps upstream. A failure marker
   * has to travel with the DATA, not sit on the probe that reported it.
   */
  const cantRead = (...labels: string[]) => labels.some((l) => data.unreadable.includes(l));

  const publicPath = data.slug ? `/${data.slug}` : null;
  const sp = await searchParams;

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Shop › Services · Page · How it is going (step 5) — Page is the door to Your page, details and collections. */}
      <div className="mx-auto max-w-3xl">
        <ShopSegments on="services" />
      </div>
      <HeroCard data={data} publicPath={publicPath} />

      {/* ── HOW YOU'RE DOING — read-only pulse (detail pages live in the sidebar).
          Sits above "Manage your shop" (owner 2026-07-02): see your numbers first,
          then act on them. */}
      <section className="space-y-3">
        {/* Heading kept for the a11y outline but visually removed (owner
            2026-07-02: "remove the How you're doing text"). */}
        <h2 className="sr-only">How you&rsquo;re doing</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            unavailable={cantRead('profileViewsWeek')}
            icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.profileViewsWeek)}
            label="Profile views"
            sub="this week"
          />
          <StatTile
            unavailable={cantRead('reviewStats')}
            icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
            value={data.reviewCount > 0 ? data.rating.toFixed(1) : '—'}
            label="Reviews"
            sub={`${nf.format(data.reviewCount)} review${data.reviewCount === 1 ? '' : 's'}`}
          />
          <StatTile
            unavailable={cantRead('savedByCouples')}
            icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.savedByCouples)}
            label="Saved"
            sub="couples saved you"
          />
          <StatTile
            unavailable={cantRead('featuredStories', 'poolBookings')}
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.storiesTagged)}
            label="Stories"
            sub="editorials tagged"
          />
          <StatTile
            unavailable={cantRead('recaps', 'poolBookings')}
            icon={<Images className="h-4 w-4" strokeWidth={1.75} />}
            value={data.recapClips > 0 ? nf.format(data.recapClips) : '—'}
            label="Recap"
            sub="day-of clips"
          />
          <StatTile
            unavailable={cantRead('partnerships')}
            icon={<Handshake className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.recommendedByShops)}
            label="Recommend"
            sub={`${data.recommendedByShops === 1 ? 'shop recommends' : 'shops recommend'} you`}
          />
        </div>
      </section>

      {/* The map of the six doors — see _components/shop-rail.tsx. */}
      <ShopRail />

      {/*
        ── DOOR 1 · "Your shop" (G1, drawing approved 2026-09-14) ───────────
        ✂ STEP 5 (2026-10-14): the room is now four rows into the screens the
        approved supplier prototype gives each errand — Your details (the form,
        the papers, where you work, how clients pay you), Your page (the page as
        couples scroll it, a draft and one Apply), Your collections (every photo
        and video) and Helpers (/vendor-dashboard/team, which the Team tile
        duplicated). The editors are the SAME components, mounted there.

        ⚠ THE TWO OLD ANCHORS STILL RESOLVE HERE, ONCE EACH. `#manage-shop` is on
        the rows and `#get-verified` on the documents row: links already sent —
        notifications stored with `/vendor-dashboard/shop#get-verified`, a
        bookmark — land on a row one tap from the fold. Every link this code
        still writes points straight at Your details (`/vendor-dashboard/profile#docs`).
      */}
      <ShopDoorSection
        id="d1"
        title="Your shop"
        question="Shop information, verification, branches and team"
      >
        <div id="manage-shop" className="scroll-mt-24 divide-y divide-ink/10" data-shop-doors="">
          <DatesRow
            data="shop-details"
            title="Your details"
            line="Name · what you do · where · contact · documents · how clients pay you"
            badge={
              data.fieldsLeft > 0
                ? { tone: 'wait', word: data.fieldsLeft === 1 ? '1 field left' : `${data.fieldsLeft} fields left` }
                : null
            }
            href="/vendor-dashboard/profile"
          />
          <DatesRow
            data="shop-page"
            title="Your page"
            line="As couples see it · edit · share"
            badge={data.websiteLive ? { tone: 'ok', word: 'Couples can see it' } : { tone: 'quiet', word: 'Not shown yet' }}
            href="/vendor-dashboard/website"
          />
          <DatesRow
            data="shop-collections"
            title="Your collections"
            line="Every photo and video in one place"
            href="/vendor-dashboard/collections"
          />
          <DatesRow data="shop-helpers" title="Helpers" line="Who works with you on Setnayan" href="/vendor-dashboard/team" />
        </div>
        <div id="get-verified" className="scroll-mt-24 border-t border-ink/10">
          <DatesRow
            data="shop-documents"
            title="Your documents"
            line={
              data.isVerified
                ? 'Verified'
                : data.verify.status === 'pending_review' || data.verify.status === 'in_review'
                  ? 'Setnayan is checking your documents'
                  : 'DTI or SEC · BIR 2303 · permit · a bank proof'
            }
            badge={
              data.isVerified
                ? { tone: 'ok', word: 'Verified' }
                : data.verify.status === 'pending_review' || data.verify.status === 'in_review'
                  ? { tone: 'wait', word: 'Checking' }
                  : { tone: 'wait', word: 'Send them' }
            }
            href={DOCS_HREF}
          />
        </div>
        {/* The rail's doors 4 and 5 point at these two: their rooms moved to Your
            page › Auto-reply and Your details › How clients pay you (step 5). */}
        <div id="getting-paid" className="scroll-mt-24 border-t border-ink/10">
          <DatesRow
            data="shop-getting-paid"
            title="How clients pay you"
            line="GCash · bank · what couples see"
            href="/vendor-dashboard/profile#pay"
          />
        </div>
        {vendorAutoReplyEnabled() ? (
          <div id="auto-reply" className="scroll-mt-24 border-t border-ink/10">
            <DatesRow
              data="shop-auto-reply"
              title="Auto-reply"
              line="Answers the first message"
              href="/vendor-dashboard/website#auto-reply"
            />
          </div>
        ) : null}
      </ShopDoorSection>


      {/* ── YOUR SERVICES — the full Services manager, fully consolidated onto
          My Shop (owner 2026-07-02: "My Services" retired everywhere). The
          standalone /vendor-dashboard/services route now redirects here; the
          guided-wizard child route still renders separately. Deep-links open it.

          ── MOVED UP AND OPENED BY DEFAULT 2026-08-26 ────────────────────────
          Owner named "setting up their services" as one of the jobs a shop
          owner does, and it was a shut drawer below the verification block —
          two taps from the rail to reach the thing this page is most for.
          It is now the first thing under the identity tiles, already open.
          🔑 Verification moved BELOW it deliberately: getting verified is a
          once, with its own deep-linked hero pill to jump straight to it;
          services is the work that never stops. It used to open only when a
          deep-link carried ?offpeak / ?add / ?saved / ?error / ?requested;
          `defaultOpen` is now unconditional, which is a SUPERSET of every one
          of those — each of them opened it, and it is open regardless — so no
          link that worked before can stop working. */}
      <ServicesDisclosure defaultOpen>
        <VendorServicesManager search={sp} basePath="/vendor-dashboard/shop" />
      </ServicesDisclosure>

      {/* ── PACKAGES — the doorway to the package authoring surface (flag-DARK:
          renders only behind NEXT_PUBLIC_PACKAGE_AUTHORING; flag-off = today's
          page exactly). Ships in the same PR as its route, per the
          no-orphaned-pages rule. Sits directly under Services because a package
          is a bundle OF services. */}
      {packageAuthoringEnabled() ? (
        <section id="packages" aria-labelledby="packages-heading" className="mt-4">
          <Link
            href="/vendor-dashboard/packages"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-card)' }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--m-accent-soft)', color: 'var(--m-accent)' }}
            >
              <PackageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                id="packages-heading"
                className="block text-sm font-semibold"
                style={{ color: 'var(--m-ink)' }}
              >
                Packages
              </span>
              <span className="block text-xs" style={{ color: 'var(--m-ink-soft)' }}>
                Bundle your services into something a couple can make their own
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="h-4 w-4 shrink-0"
              strokeWidth={1.75}
              style={{ color: 'var(--m-ink-soft)' }}
            />
          </Link>
        </section>
      ) : null}

      {/* AUTO-REPLY moved to Your page › Auto-reply (step 5, 2026-10-14) —
          `_components/autoreply-section.tsx`, still behind its switch, still `#auto-reply`. */}
    </section>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */
function HeroCard({
  data,
  publicPath,
}: {
  data: ShopData;
  publicPath: string | null;
}) {
  const subline = [tierLabel(data.tier), data.primaryService, data.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
      <VendorAvatar
        logoUrl={data.logoUrl}
        initials={data.initials}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold tracking-wide"
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--m-ink)' }}>
            {data.businessName}
          </h2>
          {data.isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                color: 'var(--m-sage-deep)',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Verified
            </span>
          ) : data.verify.status === 'pending_review' || data.verify.status === 'in_review' ? (
            <a
              href={DOCS_HREF}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--m-paper)', color: 'var(--m-slate)' }}
            >
              Verification in review
            </a>
          ) : (
            // The passive "Unverified" chip became the GOAL (owner redesign
            // 2026-07-03): a live step count that deep-links to the
            // Get-verified section below. Before the profile is complete the
            // pill points at the prerequisite instead (owner flow: profile
            // first → then the documents appear).
            <a
              href={DOCS_HREF}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:bg-[color:var(--m-orange-3)]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              Get verified ·{' '}
              {(data.verify.requiredDocsIn ? 1 : 0) +
                (data.verify.emailConfirmedAt && data.verify.phoneConfirmedAt ? 1 : 0)}{' '}
              of 2
            </a>
          )}
        </div>
        {subline ? (
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            {subline}
          </p>
        ) : null}
        {publicPath ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="inline-flex items-center gap-1.5 font-mono text-xs"
                style={{ color: 'var(--m-orange-2)' }}
              >
                <Globe aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">
                  {DISPLAY_HOST}
                  {publicPath}
                </span>
              </p>
              <CopyButton
                value={`${DISPLAY_HOST}${publicPath}`}
                label="Copy link"
                copiedLabel="Copied"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[color:var(--m-orange-2)] hover:bg-[color:var(--m-orange-3)]"
              />
            </div>
            {/* HOLDING AN ADDRESS IS NOT BEING LISTED. Every shop now gets one
                the moment it is named (migration 20271117527966), but the page
                behind it 404s for the public until an admin approves the shop —
                `public_visibility` is admin-only by owner ruling 2026-07-27
                ("we only show shops that are ready"). Showing the address with
                no status attached would read as "you are live", and the vendor
                would hand the link out to a 404. */}
            {!data.websiteLive ? (
              <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                This is your address for good — it goes live to couples once
                Setnayan approves your shop.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Add your shop name and we&rsquo;ll give you your web address.
          </p>
        )}
        {/* The logo the supplier uploaded could not be presigned. Without this
            the hero silently falls back to initials — exactly what a shop with
            NO logo looks like — so they are told their branding was lost when
            it was not. */}
        {data.logoUnavailable ? <CouldNotLoad what="your logo" /> : null}
      </div>

      <CompletenessRing pct={data.completionPct} />

      {/* Only offer the outbound preview when the page really renders. A hidden
          shop's own page 404s for everybody (app/v/[slug]/page.tsx checks
          `isPubliclyVisible` before the owner-preview carve-out), so linking a
          not-yet-approved vendor at their own address sends them to a 404 and
          reads as a broken product. */}
      {publicPath && data.websiteLive ? (
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          View as couple
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </a>
      ) : (
        (() => {
          // The primary CTA must track the vendor's REAL next step, never
          // contradict a 100% ring. Only an actually-unfinished profile says
          // "Finish profile"; a complete-but-unverified shop points at the
          // verification stage; a complete-and-verified shop points back into
          // the manage tiles.
          const cta =
            data.completionPct < 100
              ? { href: DETAILS_HREF, label: 'Finish profile' }
              : data.isVerified
                ? { href: DETAILS_HREF, label: 'Manage shop' }
                : { href: DOCS_HREF, label: 'Get verified' };
          return (
            <a
              href={cta.href}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
            >
              {cta.label}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </a>
          );
        })()
      )}
    </div>
  );
}

function CompletenessRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--m-orange) ${clamped * 3.6}deg, var(--m-orange-3) 0deg)`,
        }}
        role="img"
        aria-label={`Profile ${clamped}% complete`}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: '3.75rem', height: '3.75rem', background: 'var(--m-orange-4)' }}
        >
          <span
            className="font-mono text-base font-bold"
            style={{ color: 'var(--m-ink)' }}
          >
            {clamped}%
          </span>
        </div>
      </div>
      <span className="sn-eye">
        {/* Scoped to "Profile" (not a bare "Complete"): the ring measures only
            the 8 business-profile fields — NOT the public address, which is a
            separate Pro/Website step. Keeps the ring honest against the header's
            "no public address yet" and matches the Profile KPI tile's number. */}
        Profile
      </span>
    </div>
  );
}

/* ─── Read-only metric tile ─────────────────────────────────────────────── */
function StatTile({
  icon,
  value,
  label,
  sub,
  unavailable,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  /*
   * 🔑 THE READ FAILED, SO THERE IS NO NUMBER — as opposed to the number being
   * zero. Printing `0` here would assert that nobody saved this shop, nobody
   * rated it and nobody looked at it. An error blames the system; a zero blames
   * the supplier, and only one of those can be wrong in a way that hurts.
   */
  unavailable?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="inline-flex items-center justify-center gap-1.5 text-xs"
        style={{ color: 'var(--m-slate-3)' }}
      >
        <span aria-hidden style={{ color: 'var(--m-orange-2)' }}>
          {icon}
        </span>
        {label}
      </span>
      <p
        className="mt-1 font-mono text-2xl font-bold"
        style={{ color: unavailable ? 'var(--m-slate-3)' : 'var(--m-ink)' }}
      >
        {unavailable ? '–' : value}
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {unavailable ? "couldn't load — not a zero" : sub}
      </p>
    </div>
  );
}

/* ── My Shop hub (owner 5-page IA, 2026-07-12) ──────────────────────────────
 * One menu item, the whole business integrated: the shop home (profile ·
 * services · verify · website — this file's original body, incl. the
 * services fold-in from 2026-07-02) plus Contracts, Proposals (Earnings moved to Customers › Money, S-PR4),
 * How clients pay you, Manpower as tabs, and a Tools tab linking the
 * long-tail surfaces that left the sidebar. Old routes redirect in. */
import { Suspense } from 'react';
import { HardHat, Boxes } from 'lucide-react';
import {
  FeatureAccordion,
  AccordionSkeleton,
  type AccordionSection,
} from '../_components/feature-accordion';
import ManpowerSurface from '../manpower/surface';

// The folded feature sections, in strategic order below the shop home. Each
// expands in place and loads its server body on open (owner one-page IA
// 2026-07-12). Home (profile · services · verify · website) stays above.
/*
  ── CONTRACTS AND PROPOSALS LEFT THIS PAGE 2026-08-26 ───────────────────────
  Owner re-cut ("yes i agree"): a contract and a quote are papers about a deal
  with ONE customer, so a shop owner looks for them beside that customer, not
  beside their opening hours. Both now fold into the My Customers hub; their
  own routes still exist and now forward there, so every inbound link — the
  client page, the message thread's send-a-quote card, the requote nudge, the
  public proposal page — keeps working untouched.

  🔑 THIS RESTORES AN AGREEMENT THAT WAS ALREADY BROKEN. The phone's bottom bar
  has lit **Customers** for `/contracts` and `/proposals` all along, while the
  laptop rendered them under My Shop — the same question answered two ways
  depending on which screen you held. Nothing lit Shop for them, so no phone
  tab goes dark.
*/
const SHOP_SECTIONS: AccordionSection[] = [
  {
    key: 'manpower',
    label: 'Manpower',
    sub: 'Pick up paid crew gigs from events already booked',
    icon: <HardHat className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    key: 'tools',
    label: 'More tools',
    sub: 'What couples see · Working with others · Protection',
    icon: <Boxes className="h-4 w-4" strokeWidth={1.75} />,
  },
];

/*
  ── THE FOURTEEN TOOLS, ON THREE NAMED SHELVES (2026-08-26) ─────────────────
  Owner re-cut ("yes i agree"). Until now these were one undifferentiated grid
  of fourteen cards, so finding "Theft Watch" meant reading all fourteen labels.
  NOTHING IS REMOVED, RENAMED OR RE-ROUTED — every href, label and sub-line
  below is byte-identical to the flat list it replaces. The only new thing is
  which of three headings a card sits under. That is the same discipline the
  admin console's own re-cut used: order the pile, never shorten it.

  The cut is by WHO THE TOOL IS FOR, which is the only question a shop owner
  can answer without opening the card:
    · what couples see   — the shopfront's proof and its detail
    · working with others — other shops, creators, and your own team
    · protection          — the two rooms you open when something is wrong
*/
function ShopTools({
  hasMoodboardLibraryAccess,
  hasMusicRepertoireAccess,
}: {
  hasMoodboardLibraryAccess: boolean;
  hasMusicRepertoireAccess: boolean;
}) {
  const shelves = shopToolShelves(hasMoodboardLibraryAccess, hasMusicRepertoireAccess);
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
      <div className="space-y-7">
        {shelves.map((shelf) => (
          <div key={shelf.key}>
            {/* The shelf heading is the whole point of the re-cut: it is the
                one word that tells you whether the card you want is on this
                shelf without reading the cards. */}
            <h3 className="sn-eye mb-2.5">{shelf.label}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shelf.tools.map((t) => (
                <li key={t.href}>
                  {/* Flat `.sn-row` cards — 14 across this section, so blur is
                      banned here (blur budget § 1.6: no blur in >10-item
                      collections). Shelving them does not lower the count. */}
                  <Link
                    href={t.href}
                    className="sn-row sn-press block p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-ink/60">{t.sub}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The open section's body — async so <Suspense> streams a skeleton while its
 *  queries run. Only the matching one renders, so folded sections cost nothing
 *  until expanded. `tools` awaits the cheap stylist check internally so the
 *  accordion headers paint instantly. */
async function ShopSectionBody({ open }: { open: string }) {
  switch (open) {
    case 'manpower':
      return <ManpowerSurface />;
    case 'tools': {
      const [hasMoodboard, hasMusic] = await Promise.all([
        shopHasMoodboardLibraryAccess(),
        shopHasMusicRepertoireAccess(),
      ]);
      return (
        <ShopTools hasMoodboardLibraryAccess={hasMoodboard} hasMusicRepertoireAccess={hasMusic} />
      );
    }
    default:
      return null;
  }
}

export default async function VendorShopHub({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // `open` is canonical; `tab` is the legacy alias the old redirect stubs emit.
  const openRaw =
    (typeof sp.open === 'string' && sp.open) ||
    (typeof sp.tab === 'string' && sp.tab) ||
    null;
  // HOW CLIENTS PAY YOU left these folds for Your details (step 5, 2026-10-14). An
  // old `?open=payments` / `?tab=payments` link — the payout nudge's, a bookmark —
  // lands on that fold, with any flash it carried.
  if (openRaw === 'payments') {
    const qs = new URLSearchParams();
    for (const k of ['msg', 'error'] as const) {
      const v = sp[k];
      if (typeof v === 'string' && v) qs.set(k, v);
    }
    const query = qs.toString();
    redirect(`/vendor-dashboard/profile${query ? `?${query}` : ''}#pay`);
  }
  const open =
    openRaw && SHOP_SECTIONS.some((s) => s.key === openRaw) ? openRaw : null;

  return (
    <>
      {/* Home stays on top: identity · stats · Manage tiles · verify · services. */}
      <ShopHome searchParams={Promise.resolve(sp) as never} />

      {/* Everything else folds in below — one open at a time, loaded on expand.
          The id is what door 6 on the rail points at: the folds are where those
          tools live today, and a map must not point at a room that is not
          there. Naming an existing room is not building a door. */}
      <div id="shop-folds" className="scroll-mt-24">
        <FeatureAccordion sections={SHOP_SECTIONS} openKey={open}>
          {open ? (
            <Suspense fallback={<AccordionSkeleton />}>
              <ShopSectionBody open={open} />
            </Suspense>
          ) : null}
        </FeatureAccordion>
      </div>
    </>
  );
}

/** Moodboard library card gate for the More-tools tab — the shared predicate
 * both the page and the server action use (lib/moodboard-library-access.ts). */
async function shopHasMoodboardLibraryAccess(): Promise<boolean> {
  const { createClient: createShopToolsClient } = await import('@/lib/supabase/server');
  const { resolveMoodboardLibraryAccess } = await import('@/lib/moodboard-library-access');
  const supabase = await createShopToolsClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (await resolveMoodboardLibraryAccess(supabase, user?.id)).allowed;
}

/**
 * D2 (2026-09-11): the Repertoire card on the More-tools shelf listed itself
 * for EVERY shop — a caterer got a "Song bank & setlist" card that led
 * nowhere they could use. Same "one music rule" (`isMusicToolCategory`,
 * `lib/songs.ts`) the public songs block and `addRepertoireSong`'s
 * server-side refusal now share.
 */
async function shopHasMusicRepertoireAccess(): Promise<boolean> {
  const { createClient: createShopToolsClient } = await import('@/lib/supabase/server');
  const supabase = await createShopToolsClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  return isMusicToolCategory(profile?.services ?? null);
}
