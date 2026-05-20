import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, MapPin, Star } from 'lucide-react';

import { Logo as BrandLogo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { fetchReviewStatsForMany, formatStarRating } from '@/lib/reviews';
import {
  parseVisibility,
  isBookable,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import { displayServiceLabel } from '@/lib/vendors';
import { haversineKm, formatDistanceKm } from '@/lib/geo';
import { SaveVendorButton } from '../_components/save-vendor-button';

export const metadata = {
  title: 'Compare vendors — Setnayan',
  description:
    'Side-by-side comparison of up to 3 saved Filipino wedding vendors.',
};

export const dynamic = 'force-dynamic';

const MAX_COMPARE = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  searchParams: Promise<{ ids?: string }>;
};

type CompareRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  hq_latitude: number | string | null;
  hq_longitude: number | string | null;
  public_visibility: VendorPublicVisibility;
  compatible_ceremony_types: string[] | null;
  compatible_venue_settings: string[] | null;
};

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
  // Dedupe while preserving order, cap to MAX_COMPARE.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of parts) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= MAX_COMPARE) break;
  }
  return unique;
}

export default async function CompareVendorsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const ids = parseIds(raw.ids);

  if (ids.length < 2) {
    // Fewer than two vendors is not a comparison — send the user back to
    // the marketplace where they can save more candidates.
    redirect('/vendors');
  }

  const admin = createAdminClient();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve the couple's primary event so we can render save state +
  // distance-from-venue per row. Anonymous viewers and couples without an
  // event simply don't get distance / save state — the comparison still
  // works for raw spec-vs-spec eval.
  let coupleEventId: string | null = null;
  let venueAnchor: { lat: number; lng: number } | null = null;
  if (user) {
    const userEvents = await fetchUserEvents(supabase, user.id, 'couple');
    coupleEventId = userEvents[0]?.event_id ?? null;
    if (coupleEventId) {
      const { data: ev } = await admin
        .from('events')
        .select('venue_latitude, venue_longitude')
        .eq('event_id', coupleEventId)
        .maybeSingle();
      if (
        ev?.venue_latitude !== null &&
        ev?.venue_latitude !== undefined &&
        ev?.venue_longitude !== null &&
        ev?.venue_longitude !== undefined
      ) {
        venueAnchor = {
          lat: Number(ev.venue_latitude),
          lng: Number(ev.venue_longitude),
        };
      }
    }
  }

  // Fetch the requested rows. Use admin client because anonymous viewers
  // also use this compare surface and vendor_profiles is RLS-gated.
  const { data: rowsRaw } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,hq_latitude,hq_longitude,public_visibility,compatible_ceremony_types,compatible_venue_settings',
    )
    .in('vendor_profile_id', ids)
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '');

  const rowsById = new Map<string, CompareRow>(
    ((rowsRaw ?? []) as CompareRow[]).map((r) => [r.vendor_profile_id, r]),
  );
  // Preserve the order the couple chose (URL order). Skip any IDs the
  // query dropped (deleted vendor, RLS hide, etc.) — the comparison still
  // works with N < requested count.
  const rows: CompareRow[] = ids
    .map((id) => rowsById.get(id))
    .filter((r): r is CompareRow => r !== undefined);

  if (rows.length < 2) {
    // The requested vendors aren't all visible (drift / deletes). Send
    // the couple back rather than rendering a one-column "comparison".
    redirect('/vendors');
  }

  const reviewStats = await fetchReviewStatsForMany(
    admin,
    rows.map((r) => r.vendor_profile_id),
  );

  // Lookup saved set so each column's Save button starts in the right state.
  let savedSet = new Set<string>();
  if (user && coupleEventId) {
    const { data: saved } = await supabase
      .from('event_vendors')
      .select('marketplace_vendor_id')
      .eq('event_id', coupleEventId)
      .in(
        'marketplace_vendor_id',
        rows.map((r) => r.vendor_profile_id),
      );
    savedSet = new Set(
      (saved ?? [])
        .map((s) => s.marketplace_vendor_id)
        .filter((id): id is string => Boolean(id)),
    );
  }

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
          </Link>
          <Link
            href="/vendors"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            Back to marketplace
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-6 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Compare · {rows.length} vendors
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Side-by-side comparison.
          </h1>
          <p className="max-w-prose text-sm text-ink/65">
            Specs that matter — location, rating, services, faith fit, distance
            from your reception venue if you&rsquo;ve locked one. Save the ones
            you like; their state stays in sync with your wedding shortlist.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/[0.02]">
                <th
                  scope="col"
                  className="w-32 px-3 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
                >
                  Spec
                </th>
                {rows.map((row) => (
                  <th
                    scope="col"
                    key={row.vendor_profile_id}
                    className="px-3 py-3 text-left align-top"
                  >
                    <VendorHeaderCell row={row} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-ink/80">
              <CompareRowEl label="Location">
                {rows.map((row) => (
                  <td
                    key={row.vendor_profile_id}
                    className="border-b border-ink/5 px-3 py-3 align-top"
                  >
                    {row.location_city ?? <span className="text-ink/40">—</span>}
                  </td>
                ))}
              </CompareRowEl>

              <CompareRowEl label="Distance">
                {rows.map((row) => {
                  if (!venueAnchor) {
                    return (
                      <td
                        key={row.vendor_profile_id}
                        className="border-b border-ink/5 px-3 py-3 align-top text-ink/40"
                      >
                        Set your reception venue to see distance
                      </td>
                    );
                  }
                  const lat =
                    row.hq_latitude !== null ? Number(row.hq_latitude) : NaN;
                  const lng =
                    row.hq_longitude !== null ? Number(row.hq_longitude) : NaN;
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    return (
                      <td
                        key={row.vendor_profile_id}
                        className="border-b border-ink/5 px-3 py-3 align-top text-ink/40"
                      >
                        Location not set
                      </td>
                    );
                  }
                  const km = haversineKm(
                    venueAnchor.lat,
                    venueAnchor.lng,
                    lat,
                    lng,
                  );
                  return (
                    <td
                      key={row.vendor_profile_id}
                      className="border-b border-ink/5 px-3 py-3 align-top"
                    >
                      <span className="inline-flex items-center gap-1 font-mono">
                        <MapPin
                          aria-hidden
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                        {formatDistanceKm(km)}
                      </span>
                      <p className="mt-0.5 text-[11px] text-ink/45">
                        from your venue
                      </p>
                    </td>
                  );
                })}
              </CompareRowEl>

              <CompareRowEl label="Rating">
                {rows.map((row) => {
                  const stats = reviewStats.get(row.vendor_profile_id);
                  const rating = stats?.avg_rating_overall ?? 0;
                  const count = stats?.total_count ?? 0;
                  return (
                    <td
                      key={row.vendor_profile_id}
                      className="border-b border-ink/5 px-3 py-3 align-top"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Star
                          aria-hidden
                          className={
                            rating > 0
                              ? 'h-3.5 w-3.5 fill-amber-400 text-amber-500'
                              : 'h-3.5 w-3.5 text-ink/25'
                          }
                          strokeWidth={1.75}
                        />
                        <span className="font-mono">
                          {rating > 0 ? formatStarRating(rating) : 'new'}
                        </span>
                        <span className="text-ink/45">
                          ({count} {count === 1 ? 'review' : 'reviews'})
                        </span>
                      </span>
                    </td>
                  );
                })}
              </CompareRowEl>

              <CompareRowEl label="Services">
                {rows.map((row) => (
                  <td
                    key={row.vendor_profile_id}
                    className="border-b border-ink/5 px-3 py-3 align-top"
                  >
                    {row.services.length > 0 ? (
                      <ul className="space-y-0.5">
                        {row.services.slice(0, 4).map((s) => (
                          <li key={s} className="text-xs">
                            {displayServiceLabel(s)}
                          </li>
                        ))}
                        {row.services.length > 4 ? (
                          <li className="text-xs text-ink/45">
                            +{row.services.length - 4} more
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <span className="text-ink/40">—</span>
                    )}
                  </td>
                ))}
              </CompareRowEl>

              <CompareRowEl label="Faith compat">
                {rows.map((row) => {
                  const compat = row.compatible_ceremony_types ?? [];
                  return (
                    <td
                      key={row.vendor_profile_id}
                      className="border-b border-ink/5 px-3 py-3 align-top"
                    >
                      {compat.length === 0 ? (
                        <span className="text-xs text-ink/55">All faiths</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {compat.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/65"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </CompareRowEl>

              <CompareRowEl label="Verification">
                {rows.map((row) => {
                  const visibility = parseVisibility(row.public_visibility);
                  const bookable = isBookable(visibility);
                  return (
                    <td
                      key={row.vendor_profile_id}
                      className="border-b border-ink/5 px-3 py-3 align-top"
                    >
                      {visibility === 'verified' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                          Coming soon
                        </span>
                      )}
                      {!bookable ? (
                        <p className="mt-1 text-[11px] text-ink/45">
                          Not bookable yet
                        </p>
                      ) : null}
                    </td>
                  );
                })}
              </CompareRowEl>

              <CompareRowEl label="Save">
                {rows.map((row) => (
                  <td
                    key={row.vendor_profile_id}
                    className="px-3 py-3 align-top"
                  >
                    <SaveVendorButton
                      vendorProfileId={row.vendor_profile_id}
                      initiallySaved={savedSet.has(row.vendor_profile_id)}
                      canSave={user !== null && coupleEventId !== null}
                      variant="card"
                    />
                    {row.business_slug ? (
                      <Link
                        href={`/v/${row.business_slug}`}
                        className="mt-2 inline-flex text-xs font-medium text-terracotta underline-offset-4 hover:underline"
                      >
                        View full profile →
                      </Link>
                    ) : null}
                  </td>
                ))}
              </CompareRowEl>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function VendorHeaderCell({ row }: { row: CompareRow }) {
  const initials =
    row.business_name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?';
  return (
    <div className="flex items-start gap-2">
      {row.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.logo_url}
          alt={row.business_name}
          className="h-10 w-10 shrink-0 rounded-md border border-ink/10 object-cover"
        />
      ) : (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/15 text-sm font-semibold text-terracotta-700">
          {initials}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">
          {row.business_name}
        </p>
        {row.tagline ? (
          <p className="line-clamp-2 text-xs text-ink/55">{row.tagline}</p>
        ) : null}
      </div>
    </div>
  );
}

function CompareRowEl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="border-b border-ink/5 bg-ink/[0.02] px-3 py-3 text-left align-top font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}
