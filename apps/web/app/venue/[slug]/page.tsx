import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Users,
  Wallet,
  Building2,
  Check,
  HelpCircle,
} from 'lucide-react';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/vendors';
import {
  displayVenueType,
  type PairedVenueCandidate,
} from '@/lib/venue-recommendations';
import { resolvePrimaryHostEvent } from '@/lib/events';
import { NavLinksRow } from '@/app/_components/nav-links';
import { AddVenueToPlanButton } from '@/app/vendors/_components/add-venue-to-plan-button';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
};

// ────────────────────────────────────────────────────────────────────────────
// Schema shapes
//
// `venue_directory` ships today (migration 20260526010000) with the base
// columns. Agent A's parallel PR (claude/venue-directory-reception-schema)
// extends the table with: venue_category, capacity_min, capacity_max,
// day_rate_php_min, day_rate_php_max, description, amenities,
// compatible_venue_settings, is_bookable_via_setnayan, is_demo,
// demo_batch_id. The select below tries the full set first and falls back
// to the legacy set if PostgREST returns an "unknown column" error — same
// pattern as /v/[slug] uses for the parallel `vendors.is_demo` PR.
//
// Once Agent A's PR is merged the fallback branch goes dormant. Until
// then this PR builds + deploys against either schema state.
// ────────────────────────────────────────────────────────────────────────────

type BaseVenueRow = {
  venue_directory_id: string;
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_address: string | null;
  hq_latitude: number | string | null;
  hq_longitude: number | string | null;
  compatible_ceremony_types: string[] | null;
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  hero_image_license: string | null;
  hero_image_source_url: string | null;
  source_note: string | null;
};

type ExtendedVenueRow = BaseVenueRow & {
  venue_category?: string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  day_rate_php_min?: number | null;
  day_rate_php_max?: number | null;
  description?: string | null;
  amenities?: string[] | null;
  compatible_venue_settings?: string[] | null;
  is_bookable_via_setnayan?: boolean | null;
  is_demo?: boolean | null;
  demo_batch_id?: string | null;
};

const FULL_SELECT =
  'venue_directory_id,slug,name,venue_type,location_city,hq_address,hq_latitude,hq_longitude,compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url,source_note,venue_category,capacity_min,capacity_max,day_rate_php_min,day_rate_php_max,description,amenities,compatible_venue_settings,is_bookable_via_setnayan,is_demo,demo_batch_id';

const LEGACY_SELECT =
  'venue_directory_id,slug,name,venue_type,location_city,hq_address,hq_latitude,hq_longitude,compatible_ceremony_types,hero_image_url,hero_image_attribution,hero_image_license,hero_image_source_url,source_note';

// ────────────────────────────────────────────────────────────────────────────
// Label maps — mirror the public marketplace + vendor profile chips so
// the same word lands on every surface.
// ────────────────────────────────────────────────────────────────────────────

const CEREMONY_TYPE_LABELS: Readonly<Record<string, string>> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  mixed: 'Mixed / interfaith',
};

const VENUE_SETTING_LABELS: Readonly<Record<string, string>> = {
  banquet_hall: 'Banquet hall',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination',
  heritage: 'Heritage',
  outdoor_tent: 'Outdoor tent',
  civil_registrar: 'Civil registrar',
};

// Amenity keys → human-readable labels. Extend in lockstep with Agent A's
// migration; unknown keys fall back to a startCase rendering.
const AMENITY_LABELS: Readonly<Record<string, string>> = {
  catering_included: 'Catering included',
  in_house_catering: 'In-house catering',
  bring_own_caterer: 'Bring your own caterer',
  parking_available: 'Parking available',
  valet_parking: 'Valet parking',
  air_conditioned: 'Air-conditioned',
  outdoor_space: 'Outdoor space',
  garden_grounds: 'Garden grounds',
  pool_access: 'Pool access',
  beachfront: 'Beachfront access',
  bridal_suite: 'Bridal suite',
  changing_rooms: 'Changing rooms',
  on_site_accommodations: 'On-site accommodations',
  av_equipment: 'AV equipment',
  stage_lighting: 'Stage lighting',
  sound_system: 'Sound system',
  dance_floor: 'Dance floor',
  wheelchair_accessible: 'Wheelchair accessible',
  pet_friendly: 'Pet friendly',
  smoking_allowed: 'Smoking allowed',
  generator_backup: 'Backup generator',
  wifi_available: 'Wi-Fi available',
  ceremony_space: 'Ceremony space',
  reception_space: 'Reception space',
  combined_ceremony_reception: 'Combined ceremony + reception',
  rain_contingency: 'Rain contingency',
};

function amenityLabel(key: string): string {
  return AMENITY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function venueCategoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  switch (category) {
    case 'ceremony':
      return 'Ceremony venue';
    case 'reception':
      return 'Reception venue';
    case 'combined':
      return 'Combined ceremony + reception';
    default:
      return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Server-side helpers
// ────────────────────────────────────────────────────────────────────────────

async function fetchVenue(slug: string): Promise<ExtendedVenueRow | null> {
  const admin = createAdminClient();
  // Try the full select first (post-Agent-A schema). On any "unknown
  // column" error from PostgREST, fall back to the legacy select so this
  // PR keeps building if Agent A's PR lands later. The error message
  // pattern covers the four new columns this surface uses primarily —
  // PostgREST returns "column X does not exist" or includes the column
  // name in `error.message`.
  const fullRes = await admin
    .from('venue_directory')
    .select(FULL_SELECT)
    .ilike('slug', slug)
    .maybeSingle();

  if (
    fullRes.error &&
    /(venue_category|capacity_min|day_rate_php_min|amenities|compatible_venue_settings|is_bookable_via_setnayan|is_demo|demo_batch_id|description)/i.test(
      fullRes.error.message,
    )
  ) {
    const legacyRes = await admin
      .from('venue_directory')
      .select(LEGACY_SELECT)
      .ilike('slug', slug)
      .maybeSingle();
    return (legacyRes.data ?? null) as ExtendedVenueRow | null;
  }

  return (fullRes.data ?? null) as ExtendedVenueRow | null;
}

function buildDayRateLabel(min?: number | null, max?: number | null): string | null {
  if ((min === null || min === undefined || min <= 0) && (max === null || max === undefined || max <= 0)) {
    return null;
  }
  if (min && max && min !== max) {
    return `${formatPhp(min)} – ${formatPhp(max)} per day`;
  }
  const v = (min && min > 0 ? min : null) ?? (max && max > 0 ? max : null);
  return v ? `${formatPhp(v)} per day` : null;
}

function buildCapacityLabel(min?: number | null, max?: number | null): string | null {
  if ((min === null || min === undefined || min <= 0) && (max === null || max === undefined || max <= 0)) {
    return null;
  }
  if (min && max && min !== max) {
    return `${min}–${max} guests`;
  }
  const v = (max && max > 0 ? max : null) ?? (min && min > 0 ? min : null);
  return v ? `Up to ${v} guests` : null;
}

function toFiniteNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Metadata
// ────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const venue = await fetchVenue(slug);
  if (!venue) {
    return { title: 'Venue not found · Setnayan' };
  }
  const cityPart = venue.location_city ? ` · ${venue.location_city}` : '';
  const baseTitle = `${venue.name}${cityPart} · Setnayan`;
  if (venue.is_demo === true) {
    return {
      title: baseTitle,
      description: `[Demo venue — sample data for marketplace testing] ${venue.description ?? ''}`.trim(),
      robots: { index: false, follow: false },
    };
  }
  const description =
    venue.description ??
    `${venue.name} on Setnayan — ${displayVenueType(venue.venue_type)} in ${
      venue.location_city
    }. Browse availability, plan around your wedding date, and add to your plan.`;
  return {
    title: baseTitle,
    description,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default async function VenueDetailPage({ params }: Props) {
  const { slug } = await params;
  const venue = await fetchVenue(slug);
  if (!venue) {
    return <VenueNotFound slug={slug} />;
  }

  // Viewer state: same membership pattern as /v/[slug] but using the
  // shared resolvePrimaryHostEvent helper so couple-side bride/groom AND
  // V1.2 multi-host (iteration 0048) both resolve cleanly.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let coupleEventId: string | null = null;
  let isAlreadyAdded = false;
  if (user) {
    const admin = createAdminClient();
    try {
      const resolved = await resolvePrimaryHostEvent(admin, user.id);
      coupleEventId = resolved?.event_id ?? null;
    } catch {
      coupleEventId = null;
    }
    if (coupleEventId) {
      const { data: existing } = await admin
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', coupleEventId)
        .eq('source_venue_directory_id', venue.venue_directory_id)
        .maybeSingle();
      isAlreadyAdded = Boolean(existing?.vendor_id);
    }
  }

  const lat = toFiniteNumber(venue.hq_latitude);
  const lng = toFiniteNumber(venue.hq_longitude);
  const dayRateLabel = buildDayRateLabel(venue.day_rate_php_min, venue.day_rate_php_max);
  const capacityLabel = buildCapacityLabel(venue.capacity_min, venue.capacity_max);
  const categoryLabel = venueCategoryLabel(venue.venue_category);
  const isCombined = venue.venue_category === 'combined';
  const isDemo = venue.is_demo === true;
  const ceremonyTypes = venue.compatible_ceremony_types ?? [];
  const venueSettings = venue.compatible_venue_settings ?? [];
  const amenities = venue.amenities ?? [];

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Return to Dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
            >
              Plan with Setnayan
            </Link>
          )}
        </div>
      </header>

      <article className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {isDemo ? <DemoVenueBanner /> : null}

        {/* Hero — full-width photo when available, terracotta gradient
            fallback with venue name overlay otherwise. */}
        <HeroBlock
          name={venue.name}
          heroImageUrl={venue.hero_image_url}
          heroAttribution={venue.hero_image_attribution}
          heroSourceUrl={venue.hero_image_source_url}
          isDemo={isDemo}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <header className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                Setnayan venue directory
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {venue.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75">
                  <Building2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {displayVenueType(venue.venue_type)}
                </span>
                {venue.location_city ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75">
                    {venue.location_city}
                  </span>
                ) : null}
                {categoryLabel ? (
                  <span
                    className={
                      isCombined
                        ? 'inline-flex items-center gap-1.5 rounded-full bg-terracotta/15 px-3 py-1 text-sm font-medium text-terracotta-700'
                        : 'inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75'
                    }
                  >
                    {isCombined ? (
                      <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : null}
                    {categoryLabel}
                  </span>
                ) : null}
              </div>
            </header>

            {/* Key facts strip — day-rate + capacity, with explicit
                placeholders when not yet known. */}
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyFact
                icon={<Wallet aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
                label="Day rate"
                value={dayRateLabel ?? 'Inquire for current pricing'}
                muted={dayRateLabel === null}
              />
              <KeyFact
                icon={<Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
                label="Capacity"
                value={capacityLabel ?? 'Capacity on request'}
                muted={capacityLabel === null}
              />
            </section>

            {venue.description ? (
              <section className="space-y-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  About the venue
                </h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-ink/85">
                  {venue.description}
                </p>
              </section>
            ) : venue.source_note ? (
              <section className="space-y-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  About the venue
                </h2>
                <p className="text-base text-ink/75">{venue.source_note}</p>
              </section>
            ) : null}

            {/* Address + directions block. NavLinksRow already handles
                lat/lng → Google Maps · Waze · Apple Maps deep-links, with
                a text-search fallback when only the address is set. */}
            {(lat !== null && lng !== null) || venue.hq_address ? (
              <section className="space-y-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Where to find it
                </h2>
                {venue.hq_address ? (
                  <p className="text-sm text-ink/80">{venue.hq_address}</p>
                ) : null}
                <NavLinksRow
                  latitude={lat}
                  longitude={lng}
                  addressFallback={venue.hq_address ?? venue.location_city ?? null}
                  label=""
                />
              </section>
            ) : null}

            {amenities.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  What&rsquo;s on offer
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {amenities.map((a) => (
                    <li
                      key={a}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 bg-cream px-3 py-2 text-sm text-ink/80"
                    >
                      <Check
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-terracotta"
                        strokeWidth={2}
                      />
                      {amenityLabel(a)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                Wedding compatibility
              </h2>
              {ceremonyTypes.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    Ceremonies
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {ceremonyTypes.map((ct) => (
                      <li
                        key={ct}
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                      >
                        {CEREMONY_TYPE_LABELS[ct] ?? ct}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-ink/65">
                  Works for any wedding type.
                </p>
              )}

              {venueSettings.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    Venue settings
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {venueSettings.map((v) => (
                      <li
                        key={v}
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-sm text-ink/75"
                      >
                        {VENUE_SETTING_LABELS[v] ?? v.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <PairedSection
              venue={venue}
              currentEventId={coupleEventId}
            />
          </div>

          {/* Sidebar — sticky on desktop, inline at the bottom on mobile.
              CTA panel collapses gracefully for anonymous viewers. */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SidebarCard
              venue={venue}
              isAuthenticated={user !== null}
              currentEventId={coupleEventId}
              isAlreadyAdded={isAlreadyAdded}
            />
          </aside>
        </div>

        <footer className="mt-12 border-t border-ink/10 pt-6">
          <Link
            href="/vendors?folder=reception"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            ← Back to Reception folder
          </Link>
        </footer>
      </article>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function HeroBlock({
  name,
  heroImageUrl,
  heroAttribution,
  heroSourceUrl,
  isDemo,
}: {
  name: string;
  heroImageUrl: string | null;
  heroAttribution: string | null;
  heroSourceUrl: string | null;
  isDemo: boolean;
}) {
  if (heroImageUrl) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-ink/10 bg-ink/5">
        <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
          <Image
            src={heroImageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 60vw"
            className="object-cover"
            priority
          />
          {isDemo ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Demo venue
            </span>
          ) : null}
        </div>
        {heroAttribution ? (
          <p className="px-4 py-2 font-mono text-[10px] leading-tight text-ink/45">
            {heroSourceUrl ? (
              <a
                href={heroSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-ink/70 hover:underline"
              >
                {heroAttribution}
              </a>
            ) : (
              heroAttribution
            )}
          </p>
        ) : null}
      </section>
    );
  }
  // Fallback — terracotta gradient with name overlay so the page never
  // renders an empty grey rectangle. Matches the brand-voice "polite
  // editorial copy, no dev text" rule.
  const initials =
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || 'SN';
  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink/10">
      <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-terracotta/30 via-terracotta/15 to-cream sm:aspect-[21/9]">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
            Setnayan venue
          </p>
          <p className="mt-2 text-5xl font-semibold text-terracotta-700 sm:text-6xl">
            {initials}
          </p>
        </div>
        {isDemo ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
            Demo venue
          </span>
        ) : null}
      </div>
    </section>
  );
}

function KeyFact({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1.5 text-base font-medium ${
          muted ? 'text-ink/55' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SidebarCard({
  venue,
  isAuthenticated,
  currentEventId,
  isAlreadyAdded,
}: {
  venue: ExtendedVenueRow;
  isAuthenticated: boolean;
  currentEventId: string | null;
  isAlreadyAdded: boolean;
}) {
  const canAddToPlan = isAuthenticated && currentEventId !== null;
  const inquireHref = `/help?topic=venue&venue_slug=${encodeURIComponent(venue.slug)}`;

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
        Plan with this venue
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {venue.name}
      </h2>

      {/* Anonymous-viewer note → sign in. Logged-in but no event → still
          shows the button which will redirect into /dashboard/create-event
          per add-venue-to-plan-button's no_event branch. */}
      {!isAuthenticated ? (
        <p className="mt-3 text-sm text-ink/65">
          Sign in to add this venue to your plan or send an inquiry.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        <AddVenueToPlanButton
          venueDirectoryId={venue.venue_directory_id}
          initiallyAdded={isAlreadyAdded}
          canAdd={canAddToPlan}
        />

        {/* Inquiry CTA — V1 routes through the help center with venue
            context pre-filled (the help-center contact form already has
            an event-help category per iteration 0029). Once V1.2 venue
            iteration ships dedicated venue chat threads, this CTA gets
            replaced with a direct thread-create flow. */}
        <Link
          href={inquireHref}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
        >
          <HelpCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Inquire via help center
        </Link>

        {!isAuthenticated ? (
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center rounded-md bg-terracotta px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            Sign up to plan with Setnayan
          </Link>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-ink/55">
        Setnayan curates the venue list — adding to your plan saves it to
        your shortlist. Direct booking comes online with the V1.2 venue
        marketplace.
      </p>
    </section>
  );
}

/**
 * "You might also like" block — re-uses the existing
 * findPairedCeremonyVenues helper when this page is a RECEPTION venue
 * (so the couple can pick a ceremony venue nearby). For ceremony-side
 * venues we don't currently recommend reception pairings — that's a
 * V1.2 venue iteration scope.
 */
async function PairedSection({
  venue,
  currentEventId,
}: {
  venue: ExtendedVenueRow;
  currentEventId: string | null;
}) {
  const lat = toFiniteNumber(venue.hq_latitude);
  const lng = toFiniteNumber(venue.hq_longitude);
  if (lat === null || lng === null) return null;

  // Reception → Ceremony pairing only in V1 (matches the constraint in
  // findPairedCeremonyVenues per its module doc comment).
  const isReceptionSide = [
    'hotel_ballroom',
    'garden',
    'beach',
    'destination_resort',
    'heritage',
    'outdoor_tent',
  ].includes(venue.venue_type);
  if (!isReceptionSide) return null;

  const admin = createAdminClient();
  // Lazy-import to avoid pulling the recommender into the page module on
  // venues that don't surface this block.
  const { findPairedCeremonyVenues } = await import('@/lib/venue-recommendations');
  let candidates: PairedVenueCandidate[] = [];
  try {
    candidates = await findPairedCeremonyVenues(admin, {
      anchorLat: lat,
      anchorLng: lng,
      coupleCeremonyType: null, // open to all ceremonies on the detail page
      eventId: currentEventId,
    });
  } catch {
    candidates = [];
  }
  if (candidates.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Ceremony venues nearby
      </h2>
      <p className="text-sm text-ink/65">
        Within 10 km of {venue.name}. Pair a ceremony venue with this
        reception to close the planning loop in one go.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {candidates.slice(0, 4).map((c) => (
          <li key={c.venue_directory_id}>
            <Link
              href={`/venue/${c.slug}`}
              className="block rounded-xl border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/40"
            >
              <p className="text-sm font-semibold text-ink">{c.name}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                {displayVenueType(c.venue_type)}
              </p>
              <p className="mt-1 text-xs text-ink/65">
                {c.location_city} · {c.distance_km.toFixed(1)} km
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DemoVenueBanner() {
  return (
    <section
      aria-label="Demo venue"
      className="mb-6 rounded-2xl border border-amber-300/70 bg-amber-50 p-5"
    >
      <div className="flex items-start gap-3">
        <Sparkles
          aria-hidden
          className="mt-0.5 h-4 w-4 text-amber-700"
          strokeWidth={1.75}
        />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">
            Demo venue
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-amber-900">
            Sample data for marketplace testing.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-amber-900/85">
            This listing is synthetic — used by Setnayan admins to dogfood
            the venue surface before public launch. It does not appear in
            crawler indexes or the marketplace search results.
          </p>
        </div>
      </div>
    </section>
  );
}

function VenueNotFound({ slug }: { slug: string }) {
  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
          </Link>
        </div>
      </header>
      <article className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Venue not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          We couldn&rsquo;t find the venue you&rsquo;re looking for.
        </h1>
        <p className="mt-4 text-base text-ink/70">
          The venue at <span className="font-mono text-ink/85">{slug}</span> isn&rsquo;t
          in the Setnayan directory yet — or its listing has changed slug. Browse the
          Reception folder to find a fit, or contact our team if you think this is
          a mistake.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/vendors?folder=reception"
            className="inline-flex items-center justify-center rounded-md bg-terracotta px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
          >
            Browse reception venues
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center rounded-md border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
          >
            Contact help center
          </Link>
        </div>
      </article>
    </main>
  );
}

// Allow dynamic slug params — we render the polite `VenueNotFound`
// fallback component rather than throwing through `notFound()`, so a
// visitor who hits an unknown slug gets a branded back-to-Reception
// CTA instead of the generic Next 404. Matches `feedback_setnayan_no_dev_text_post_launch`.
export const dynamicParams = true;
