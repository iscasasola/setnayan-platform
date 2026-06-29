import Link from 'next/link';
import { Trophy, BarChart3, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchSpotlightAwards,
  AWARD_LABELS,
  type SpotlightAwardType,
  type SpotlightAwardRow,
} from '@/lib/spotlight-awards';

/**
 * SpotlightAwardsStrip — "This month's Spotlight Awards" homepage vendor strip.
 *
 * ⚠ ADMIN-GATED, NOT AUTO-INJECTED. This component reads ONLY rows where an
 * admin has explicitly flipped `is_homepage_featured = TRUE` in
 * /admin/spotlight-awards (featuredOnly: true). When no award is featured, it
 * renders NOTHING (returns null) — so dropping it into the homepage is inert
 * until the owner signs off on featuring and an admin features awards. Nothing
 * about the live homepage changes until that happens.
 *
 * Price-free per the homepage convention. Reuses the --m-* Clean Editorial
 * tokens. Server component — the gate read is a single indexed query.
 */

const AWARD_ICON: Record<SpotlightAwardType, React.ReactNode> = {
  top_pick: <Trophy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
  most_booked: <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
  rising: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
};

function vendorHref(row: SpotlightAwardRow): string {
  // Vendor microsite lives at /v/[slug]; fall back to /explore if the slug is
  // somehow missing (shouldn't happen for a featured vendor).
  return row.business_slug ? `/v/${row.business_slug}` : '/explore';
}

export async function SpotlightAwardsStrip() {
  let featured: SpotlightAwardRow[] = [];
  try {
    const supabase = await createClient();
    featured = await fetchSpotlightAwards(supabase, { featuredOnly: true });
  } catch {
    // Fail-silent: the homepage must never break because of an awards read.
    return null;
  }

  // The admin gate — nothing featured → render nothing on the live homepage.
  if (featured.length === 0) return null;

  return (
    <section
      aria-labelledby="spotlight-awards-heading"
      className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mb-8 text-center">
        <p
          className="m-eyebrow"
          style={{ color: 'var(--m-orange-2)' }}
        >
          This month on Setnayan
        </p>
        <h2
          id="spotlight-awards-heading"
          className="m-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Spotlight Awards
        </h2>
        <p className="mx-auto mt-3 max-w-prose text-sm text-ink/65">
          The vendors couples loved most this month — chosen by real reviews and
          real bookings.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((row) => (
          <li key={row.award_id}>
            <Link
              href={vendorHref(row)}
              className="group flex h-full items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4 transition-all hover:border-terracotta/30 hover:shadow-sm"
            >
              {row.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.logo_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-ink/10"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink/[0.05] text-ink/30">
                  {AWARD_ICON[row.award_type]}
                </div>
              )}
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta">
                  {AWARD_ICON[row.award_type]}
                  {AWARD_LABELS[row.award_type]}
                </span>
                <p className="mt-1.5 truncate text-base font-semibold text-ink group-hover:text-terracotta">
                  {row.business_name ?? 'A Setnayan vendor'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <Link
          href="/explore"
          className="text-sm font-medium text-terracotta underline-offset-4 hover:underline"
        >
          Discover more vendors
        </Link>
      </div>
    </section>
  );
}
