import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, Globe, MapPin, Star } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  displayServiceLabel,
  formatPhp,
  isCanonicalService,
  serviceGroupOf,
  type ServiceGroupKey,
  type VendorCategory,
} from '@/lib/vendors';
import { fetchVendorServices, type VendorServiceRow } from '@/lib/vendor-services';
import { fetchUserEvents } from '@/lib/events';
import { isFollowingVendor } from '@/lib/follow';
import { FollowGate } from '@/app/_components/follow-gate';
import {
  fetchReviewsForVendorWithCouple,
  fetchReviewStats,
  formatStarRating,
  REVIEW_AXIS_LABEL,
  type ReviewAxis,
  type ReviewWithCouple,
  type ReviewStatsRow,
} from '@/lib/reviews';

export const dynamic = 'force-dynamic';

const REVIEWS_PAGE_SIZE = 5;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviewsPage?: string }>;
};

type PublicVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_published: boolean;
};

async function fetchVendor(slug: string): Promise<PublicVendorRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published',
    )
    .ilike('business_slug', slug)
    .maybeSingle();
  return (data ?? null) as PublicVendorRow | null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  if (!vendor || !vendor.is_published) {
    return { title: 'Setnayan vendor' };
  }
  return {
    title: `${vendor.business_name} · Setnayan vendor`,
    description: vendor.tagline ?? `${vendor.business_name} on Setnayan.`,
  };
}

export default async function PublicVendorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const vendor = await fetchVendor(slug);
  if (!vendor || !vendor.is_published) notFound();

  const pageRaw = Number(search.reviewsPage ?? '1');
  const reviewsPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = reviewsPage * REVIEWS_PAGE_SIZE;

  const admin = createAdminClient();
  const [reviewStats, reviews, allServices] = await Promise.all([
    fetchReviewStats(admin, vendor.vendor_profile_id),
    fetchReviewsForVendorWithCouple(admin, vendor.vendor_profile_id, { limit, offset: 0 }),
    fetchVendorServices(admin, vendor.vendor_profile_id),
  ]);
  const hasMore = reviewStats.total_count > reviews.length;
  const activeServices = allServices.filter((s) => s.is_active);

  // Resolve viewer state for the FollowGate (iteration 0019 § Gate). Public
  // page so the supabase client may have no user; that's fine — the gate
  // renders a "Sign in to follow" CTA in that case.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let initialFollowing = false;
  let coupleEventId: string | null = null;
  if (user) {
    initialFollowing = await isFollowingVendor(supabase, user.id, vendor.vendor_profile_id);
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = events[0]?.event_id ?? null;
  }

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
            >
              S
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
              Setnayan
            </span>
          </Link>
          <Link
            href="/signup"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Plan with Setnayan
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <Logo logoUrl={vendor.logo_url} name={vendor.business_name} />
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Setnayan vendor
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {vendor.business_name}
            </h1>
            {vendor.tagline ? (
              <p className="text-base text-ink/70">{vendor.tagline}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              {vendor.location_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.location_city}
                </span>
              ) : null}
              {vendor.contact_email ? (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_email}
                </a>
              ) : null}
              {vendor.contact_phone ? (
                <a
                  href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_phone}
                </a>
              ) : null}
              {vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Website
                </a>
              ) : null}
            </div>
            <div className="pt-4">
              <FollowGate
                vendorProfileId={vendor.vendor_profile_id}
                vendorName={vendor.business_name}
                vendorEmail={vendor.contact_email}
                isAuthenticated={user !== null}
                initialFollowing={initialFollowing}
                eventId={coupleEventId}
                revalidatePath={`/v/${slug}`}
              />
            </div>
          </div>
        </section>

        {vendor.services.length > 0 ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Services offered
            </h2>
            <ul className="flex flex-wrap gap-2">
              {vendor.services.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700"
                >
                  {displayServiceLabel(s)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {activeServices.length > 0 ? (
          <ServicesPricingSection
            services={activeServices}
            businessName={vendor.business_name}
          />
        ) : null}

        <ReviewsSection
          slug={slug}
          businessName={vendor.business_name}
          reviewStats={reviewStats}
          reviews={reviews}
          hasMore={hasMore}
          nextPage={reviewsPage + 1}
        />

        <section className="space-y-4 py-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Get in touch
          </h2>
          <p className="max-w-2xl text-sm text-ink/65">
            {vendor.contact_email ? (
              <>
                Already a Setnayan couple? Start a thread directly with{' '}
                <span className="font-medium text-ink">{vendor.business_name}</span> from your
                dashboard using the contact email above. Identity stays masked until you
                choose to share.
              </>
            ) : (
              <>
                {vendor.business_name} is on Setnayan but hasn&rsquo;t published a contact
                email yet. Check back soon.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary">
              Plan with Setnayan
            </Link>
            <Link href="/" className="button-secondary">
              Back to home
            </Link>
          </div>
        </section>

        <footer className="border-t border-ink/10 pt-6 text-xs text-ink/50">
          <p>Vendor ID · <span className="font-mono">{vendor.public_id}</span></p>
        </footer>
      </article>
    </main>
  );
}

function Logo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}

function ServicesPricingSection({
  services,
  businessName,
}: {
  services: ReadonlyArray<VendorServiceRow>;
  businessName: string;
}) {
  const byGroup = new Map<ServiceGroupKey, VendorServiceRow[]>();
  for (const s of services) {
    const key: ServiceGroupKey = isCanonicalService(s.category)
      ? serviceGroupOf(s.category as VendorCategory)
      : 'other';
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(s);
    else byGroup.set(key, [s]);
  }

  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
      <header className="space-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Services &amp; pricing
        </h2>
        <p className="text-sm text-ink/65">
          Starting prices set by {businessName}. Final quotes happen in chat.
        </p>
      </header>
      <div className="space-y-5">
        {SERVICE_GROUPS.map((group) => {
          const rows = byGroup.get(group.key);
          if (!rows || rows.length === 0) return null;
          return (
            <div key={group.key} className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {group.label}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {rows.map((s) => (
                  <li key={s.vendor_service_id}>
                    <ServiceRow row={s} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ServiceRow({ row }: { row: VendorServiceRow }) {
  const label = isCanonicalService(row.category)
    ? VENDOR_CATEGORY_LABEL[row.category as VendorCategory]
    : row.category;
  const priceLabel =
    row.starting_price_php !== null && row.starting_price_php > 0
      ? `from ${formatPhp(row.starting_price_php)}`
      : 'Inquire';
  const crewParts: string[] = [];
  if (row.crew_size !== null && row.crew_size > 0) {
    crewParts.push(`${row.crew_size} crew on-site`);
  }
  if (row.crew_meal_required) {
    crewParts.push('crew meal required');
  }
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-ink">{label}</p>
        <p className="font-mono text-sm text-ink/80">{priceLabel}</p>
      </div>
      {crewParts.length > 0 ? (
        <p className="mt-1 text-[12px] text-ink/55">{crewParts.join(' · ')}</p>
      ) : null}
    </div>
  );
}

function ReviewsSection({
  slug,
  businessName,
  reviewStats,
  reviews,
  hasMore,
  nextPage,
}: {
  slug: string;
  businessName: string;
  reviewStats: ReviewStatsRow;
  reviews: ReadonlyArray<ReviewWithCouple>;
  hasMore: boolean;
  nextPage: number;
}) {
  return (
    <section className="space-y-6 border-b border-ink/10 py-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Reviews
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            From verified couples who&rsquo;ve booked {businessName} via Setnayan.
          </p>
        </div>
      </header>

      <ReviewHeroMetrics stats={reviewStats} />

      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-6 text-sm text-ink/55">
          No reviews yet. Be the first — couples can leave a review after their service is
          marked delivered.
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <ReviewRow review={r} />
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="pt-2">
          <Link
            href={`/v/${slug}?reviewsPage=${nextPage}#reviews`}
            className="button-secondary inline-flex h-10 px-4"
          >
            Show more reviews
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function ReviewHeroMetrics({ stats }: { stats: ReviewStatsRow }) {
  const hero = stats.avg_rating_overall;
  const totals: Array<{ star: 5 | 4 | 3 | 2 | 1; count: number }> = [
    { star: 5, count: stats.count_5_star },
    { star: 4, count: stats.count_4_star },
    { star: 3, count: stats.count_3_star },
    { star: 2, count: stats.count_2_star },
    { star: 1, count: stats.count_1_star },
  ];
  const max = Math.max(1, ...totals.map((t) => t.count));

  return (
    <div className="grid gap-6 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          <Star
            className={`h-6 w-6 ${hero > 0 ? 'fill-amber-400 text-amber-500' : 'text-ink/25'}`}
            strokeWidth={1.5}
          />
          <span className="text-3xl font-semibold text-ink">
            {hero > 0 ? formatStarRating(hero) : '—'}
          </span>
        </div>
        <p className="text-xs text-ink/60">
          {stats.total_count} review{stats.total_count === 1 ? '' : 's'}
        </p>
      </div>
      <ul className="space-y-1.5 text-xs">
        {totals.map(({ star, count }) => (
          <li key={star} className="grid grid-cols-[28px_1fr_40px] items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-ink/65">
              {star}
              <Star className="h-3 w-3 fill-amber-400 text-amber-500" strokeWidth={1.5} />
            </span>
            <span className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <span
                className="block h-full bg-amber-400"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[11px] text-ink/55">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({ review }: { review: ReviewWithCouple }) {
  const author =
    review.couple_display_name && review.couple_display_name.trim().length > 0
      ? review.couple_display_name
      : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRow value={review.rating_overall} />
          <span className="text-sm font-medium text-ink">{author}</span>
        </div>
        <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
          {dateLabel}
        </time>
      </header>
      {review.body ? (
        <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{review.body}</p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-[11px] text-ink/55 sm:grid-cols-4">
        <AxisStat axis="communication" value={review.rating_communication} />
        <AxisStat axis="quality" value={review.rating_quality} />
        <AxisStat axis="value" value={review.rating_value} />
        <AxisStat axis="on_time" value={review.rating_on_time} />
      </dl>
      {review.vendor_reply ? <VendorReplyBlock review={review} /> : null}
    </article>
  );
}

function AxisStat({ axis, value }: { axis: ReviewAxis; value: number }) {
  return (
    <div className="rounded-md bg-ink/[0.03] px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
        {REVIEW_AXIS_LABEL[axis]}
      </dt>
      <dd className="flex items-center gap-1 text-ink/80">
        <Star className="h-3 w-3 fill-amber-400 text-amber-500" strokeWidth={1.5} />
        <span className="font-mono text-[11px]">{value.toFixed(0)}</span>
      </dd>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`h-4 w-4 ${
            n <= value ? 'fill-amber-400 text-amber-500' : 'text-ink/25'
          }`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function VendorReplyBlock({ review }: { review: ReviewWithCouple }) {
  const repliedAt = review.vendor_reply_at
    ? new Date(review.vendor_reply_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  return (
    <div className="mt-3 rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
        Vendor reply {repliedAt ? `· ${repliedAt}` : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{review.vendor_reply}</p>
    </div>
  );
}
