import Link from 'next/link';
import { Trophy, BarChart3, TrendingUp } from 'lucide-react';
import {
  AWARD_LABELS,
  type SpotlightAwardType,
  type SpotlightHomepageVendor,
} from '@/lib/spotlight-awards';

/**
 * HomeSpotlightStrip — the PUBLIC marketing-homepage Spotlight strip.
 *
 * Renders the owner-approved, admin-featured Spotlight Award vendors as a row of
 * cards. Pure presentation: the caller (app/page.tsx) resolves the (already
 * double-gated) vendor list via `fetchHomepageSpotlight` and passes it in. An
 * empty list renders NOTHING — the strip only appears once the owner has flipped
 * `platform_settings.spotlight_homepage_enabled` on AND an admin has featured at
 * least one award row. No award logic here; it reuses the shipped schema.
 */

const AWARD_ICON: Record<SpotlightAwardType, React.ReactNode> = {
  top_pick: <Trophy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
  most_booked: <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
  rising: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />,
};

// Stable badge order within a card: Top Pick → Most Booked → Rising.
const ORDER: SpotlightAwardType[] = ['top_pick', 'most_booked', 'rising'];

// Champagne ring tint, reused across the card chrome.
const RING = 'ring-[color:var(--m-champagne,#caa45a)]/40';

export function HomeSpotlightStrip({
  vendors,
}: {
  vendors: SpotlightHomepageVendor[];
}) {
  if (!vendors || vendors.length === 0) return null;

  return (
    <section
      aria-labelledby="spotlight-heading"
      className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <header className="mb-8 flex flex-col items-center text-center">
        <p className="m-eyebrow text-[color:var(--m-orange-2,#b5762e)]">Spotlight</p>
        <h2
          id="spotlight-heading"
          className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--m-ink,#1c1917)] sm:text-3xl"
        >
          This month&rsquo;s standout vendors
        </h2>
        <p className="mt-2 max-w-prose text-sm text-[color:var(--m-slate,#57534e)]">
          Recognized on Setnayan for quality, bookings, and momentum.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => {
          const badges = [...v.award_types].sort(
            (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
          );
          const name = v.business_name ?? 'Setnayan vendor';
          const card = (
            <div className="flex h-full items-start gap-4 rounded-2xl border border-[color:var(--m-champagne,#caa45a)]/40 bg-gradient-to-br from-[#fdf6e9] to-[#faf0db] p-5">
              {v.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.logo_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
                />
              ) : (
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[color:var(--m-orange-2,#b5762e)] ring-1 ${RING}`}
                >
                  <Trophy className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="truncate text-base font-semibold tracking-tight text-[color:var(--m-ink,#1c1917)]">
                  {name}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {badges.map((t) => (
                    <span
                      key={t}
                      className={`inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[color:var(--m-orange-2,#b5762e)] ring-1 ${RING}`}
                    >
                      {AWARD_ICON[t]}
                      {AWARD_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );

          return (
            <li key={v.vendor_profile_id}>
              {v.business_slug ? (
                <Link
                  href={`/v/${v.business_slug}`}
                  className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--m-orange-2,#b5762e)] focus-visible:ring-offset-2"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
